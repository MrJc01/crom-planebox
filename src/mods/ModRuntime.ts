// Coordena os mods: carrega, distribui eventos, conta erros e guarda o log.
//
// ## O que este arquivo deixou de ser — item 358
//
// Ele **executava** os scripts: compilava, chamava os handlers, pegava as exceções. Agora não. Os
// scripts vivem num Web Worker cujo global foi esvaziado (`modWorker.ts`), e daqui saem mensagens.
//
// A diferença não é de organização, é de garantia. O sandbox anterior negava o alcance ao global
// por `with` + `Proxy`, e sempre foi honesto sobre o limite: `[].constructor.constructor('return
// this')()` continuava devolvendo o objeto global **deste** reino, com `fetch` e `indexedDB` dentro
// — e o IndexedDB da mesma origem é onde moram os mundos salvos e o cofre de chaves de API.
//
// No Worker, a mesma fuga continua funcionando e deixa de servir para nada: devolve o global de
// **lá**, que foi esvaziado antes de existir um único script. Deixou de ser uma corrida entre o que
// eu lembrei de bloquear e o que o navegador vai ganhar amanhã.
//
// ## O que ficou aqui, e por quê
//
// Contagem de erros, desligamento de script e log. Todos os três por causa de um só motivo: a
// **redação de segredos** (seção 52 do checklist) acontece ao gravar o log, do lado que conhece o
// cofre. Se o log fosse formatado no worker, o valor da chave de API teria que viajar até lá em
// texto para ser mascarado — ou sairia sem máscara.

import { ModPackage } from './ModTypes';
import { ModContext, ModEvent, ModHostBridge, buildModAPI } from './ModAPI';
import { PonteDeMods } from './PonteDeMods';
import { Porta } from './protocoloDeMods';

/**
 * Teto de tempo por quadro para o conjunto de todos os `tick`, em milissegundos.
 *
 * **Já não é aplicado**, e a constante fica porque a referência da API a documenta para o autor de
 * mod. Com os scripts do outro lado da fronteira, medir tempo aqui mediria o custo de enfileirar
 * mensagens — quase nada — e daria a impressão de um limite que não existe. O limite certo é
 * mensagens por quadro (item 1371), e ele está pendente.
 */
export const TICK_BUDGET_MS = 4;

export interface ScriptLoadResult {
  scriptKey: string;
  ok: boolean;
  error?: string;
}

/**
 * O reino de execução de verdade: um `Worker` de módulo.
 *
 * `new URL(..., import.meta.url)` é a forma que o Vite reconhece para empacotar o worker como um
 * bundle próprio. Sem ela, o caminho seria resolvido só em tempo de execução e o arquivo não
 * entraria na build.
 *
 * O `Worker` só fala `postMessage`/`onmessage`, que é exatamente a `Porta` — daí não haver
 * adaptação nenhuma aqui.
 */
export function criarPortaDeWorker(): Porta {
  return new Worker(new URL('./modWorker.ts', import.meta.url), { type: 'module' }) as unknown as Porta;
}

export class ModRuntime {
  private contexts = new Map<string, ModContext>();
  /**
   * Uma instância de `api` por script, reaproveitada em toda chamada dele.
   *
   * Precisa ser a MESMA: o handler registrado pelo script fecha sobre o `api` que recebeu na
   * compilação. Construir um novo a cada despacho fazia o runtime drenar um objeto vazio,
   * enquanto os blocos escritos ficavam presos no `api` original — ou seja, bloco colocado
   * dentro de um evento nunca chegava a ser salvo nem sincronizado.
   */
  private apis = new Map<string, Record<string, any>>();
  /**
   * Contextos já descarregados, esperando a última drenagem.
   *
   * O handler de `unload` costuma **apagar do mundo o que o mod construiu** — é o que a referência
   * manda fazer nele. As escritas dele chegam por mensagem, depois de o contexto já ter saído de
   * `contexts`. Sem esta sala de espera, a limpeza do mod seria descartada em silêncio e o mundo
   * ficaria com os restos de um mod que ninguém mais consegue reverter.
   */
  private saindo = new Map<string, { ctx: ModContext; api: Record<string, any> }>();
  /** Cargas em curso, resolvidas quando o outro lado responde. */
  private cargasPendentes = new Map<string, (r: ScriptLoadResult[]) => void>();
  private ponte: PonteDeMods;
  private host: ModHostBridge;
  /** Avisado a cada lote de blocos alterado por script, com o mod responsável. */
  public onBlocksChanged: (modId: string, changes: { x: number; y: number; z: number; blockType: number }[]) => void = () => {};
  /** Avisado quando um script é desligado por erros repetidos. */
  public onScriptDisabled: (modId: string, scriptKey: string, reason: string) => void = () => {};

  /**
   * @param criarPorta de onde vem o reino de execução. O padrão é um `Worker` de verdade — que é o
   * ponto do item 358. Injetável porque `vitest` com jsdom não tem `Worker`, e porque um teste que
   * precisa de navegador não é um teste que se roda a cada commit.
   */
  constructor(host: ModHostBridge, criarPorta: () => Porta = criarPortaDeWorker) {
    this.host = host;
    this.ponte = new PonteDeMods(criarPorta(), (modId) => this.apis.get(modId), {
      aoCarregar: (modId, resultados) => this.aoCarregar(modId, resultados),
      aoFalhar: (modId, scriptKey, erro) => this.aoFalhar(modId, scriptKey, erro),
      aoRelatarHandlers: (modId, contagem) => {
        const ctx = this.contexts.get(modId);
        if (ctx) ctx.handlerCount = contagem;
      },
      aoRegistrarLog: (modId, nivel, args) => this.contexts.get(modId)?.log(nivel, ...args),
      aoDescarregar: (modId) => this.aoDescarregar(modId),
    });
  }

  /** Constantes que o script vê sem atravessar a fronteira — ver `protocoloDeMods.ts`. */
  private constantesDe(ctx: ModContext): Record<string, unknown> {
    const api = this.apiDoMod(ctx);
    return { mod: api.mod, B: api.B, audio: { nomes: api.audio.nomes } };
  }

  private aoCarregar(modId: string, resultados: ScriptLoadResult[]): void {
    const ctx = this.contexts.get(modId);
    if (ctx) {
      for (const r of resultados) {
        if (r.ok) { ctx.disabledScripts.delete(r.scriptKey); continue; }
        ctx.log('error', `[${r.scriptKey}] falha ao carregar: ${r.error}`);
        ctx.disabledScripts.set(r.scriptKey, r.error ?? 'erro');
        this.onScriptDisabled(modId, r.scriptKey, r.error ?? 'erro');
      }
      this.drenar(ctx);
    }
    this.cargasPendentes.get(modId)?.(resultados);
    this.cargasPendentes.delete(modId);
  }

  private aoFalhar(modId: string, scriptKey: string, erro: string): void {
    const ctx = this.contexts.get(modId);
    if (!ctx) return;
    const desligou = ctx.recordError(scriptKey, new Error(erro));
    this.drenar(ctx);
    if (!desligou) return;
    // Contar e não avisar deixaria o script marcado como desligado deste lado e ainda sendo
    // chamado do outro — errando para sempre, com o log já parado de crescer.
    this.ponte.desligarScript(modId, scriptKey);
    this.onScriptDisabled(modId, scriptKey, ctx.disabledScripts.get(scriptKey) ?? 'erro');
  }

  private aoDescarregar(modId: string): void {
    const pendente = this.saindo.get(modId);
    if (!pendente) return;
    this.saindo.delete(modId);
    const changes = pendente.api.__drain();
    if (changes.length > 0) this.onBlocksChanged(modId, changes);
  }

  public getContext(modId: string): ModContext | undefined {
    return this.contexts.get(modId);
  }

  public get loadedCount(): number {
    return this.contexts.size;
  }

  /**
   * Carrega (ou recarrega) os scripts de um mod.
   *
   * Recarregar dispara `unload` antes de descartar o contexto anterior: é a chance de o mod
   * limpar o que criou. Sem isso, editar um script no editor acumularia handlers duplicados a
   * cada salvamento.
   */
  public async loadMod(pkg: ModPackage): Promise<ScriptLoadResult[]> {
    if (this.contexts.has(pkg.id)) this.unloadMod(pkg.id);

    const ctx = new ModContext(pkg);
    // Os segredos deste mod, para o log nunca guardá-los. Vem do host porque é ele quem conhece
    // o cofre; o runtime não deve nem saber de onde os valores saem.
    ctx.segredos = Object.values(this.host.modEnv(pkg.id).valores ?? {});
    this.contexts.set(pkg.id, ctx);

    const scripts = (pkg.scripts ?? []).filter((s) => s.enabled).map((s) => ({ key: s.key, code: s.code }));
    const resultados = await new Promise<ScriptLoadResult[]>((resolver) => {
      this.cargasPendentes.set(pkg.id, resolver);
      this.ponte.carregar(pkg.id, scripts, this.constantesDe(ctx));
    });

    this.dispatchTo(ctx, 'load', {});
    // Drena logo depois do `load`. Sem isto, um mod que constrói no `load` — o caso mais comum de
    // todos — só teria os blocos gravados no quadro seguinte, e quem chama `loadMod` e olha o mundo
    // na linha de baixo veria um mundo vazio.
    this.drenar(ctx);
    return resultados;
  }

  /**
   * A API deste mod, do lado do jogo.
   *
   * Uma por **mod**, e não mais uma por script. O `scriptKey` só servia para `api.on` saber de quem
   * era o handler, e `api.on` mudou de lado da fronteira — os handlers vivem no reino de execução.
   * O que sobra aqui é o buffer de blocos e o orçamento, que sempre foram do mod inteiro.
   */
  private apiDoMod(ctx: ModContext): Record<string, any> {
    let api = this.apis.get(ctx.mod.id);
    if (!api) {
      api = buildModAPI(ctx, this.host, '*');
      this.apis.set(ctx.mod.id, api);
    }
    return api;
  }

  /** Recarrega um script só, sem tocar nos demais do mesmo mod. */
  public async reloadScript(modId: string, scriptKey: string): Promise<ScriptLoadResult | null> {
    const ctx = this.contexts.get(modId);
    if (!ctx) return null;
    const script = (ctx.mod.scripts ?? []).find((s) => s.key === scriptKey);
    if (!script) return null;

    ctx.disabledScripts.delete(scriptKey);
    if (!script.enabled) return { scriptKey, ok: true };

    // Recarrega só este script. Mandar o mod inteiro seria mais simples e estaria errado: apagaria
    // o `api.storage` dos outros e dispararia o `load` deles de novo — o autor mexe numa linha e vê
    // o mod inteiro reiniciar.
    const resultados = await new Promise<ScriptLoadResult[]>((resolver) => {
      this.cargasPendentes.set(modId, resolver);
      this.ponte.recarregarScript(modId, scriptKey, script.code, this.constantesDe(ctx));
    });
    return resultados[0] ?? { scriptKey, ok: true };
  }

  public unloadMod(modId: string): void {
    const ctx = this.contexts.get(modId);
    if (!ctx) return;

    // A ordem importa e é o ponto todo desta função: o evento vai primeiro, o `descarregar` depois.
    // As mensagens são ordenadas, então o handler de `unload` — que é onde o mod apaga do mundo o
    // que construiu — roda antes de o outro lado esquecer o mod, e as escritas dele entram na fila
    // à frente da confirmação.
    const api = this.apiDoMod(ctx);
    this.ponte.despachar(modId, 'unload', {});
    this.ponte.descarregar(modId);
    this.saindo.set(modId, { ctx, api });

    this.contexts.delete(modId);
    this.apis.delete(modId);
  }

  public unloadAll(): void {
    for (const id of Array.from(this.contexts.keys())) this.unloadMod(id);
  }

  /**
   * Distribui um evento para todos os mods carregados.
   * `tick` tem tratamento próprio (orçamento de tempo) e usa `tickAll`.
   */
  public dispatch(event: Exclude<ModEvent, 'tick'>, payload: any): void {
    for (const ctx of this.contexts.values()) this.dispatchTo(ctx, event, payload);
  }

  /**
   * `tick` de todos os mods.
   *
   * ## O orçamento mudou de natureza, e vale dizer como
   *
   * Antes ele media **milissegundos de CPU deste thread**, porque os handlers rodavam aqui: dez
   * mods razoáveis podiam, juntos, fazer o que um mod ruim faria sozinho. Com os scripts do outro
   * lado da fronteira, um mod já não consegue travar o quadro — o pior que ele faz é inundar a
   * ponte de mensagens.
   *
   * Medir tempo aqui passaria a medir o custo de enfileirar mensagens, que é quase nada, e daria a
   * impressão de que existe um limite quando não existe. O limite certo é **mensagens por quadro**,
   * e ele está registrado como item 1371 — pendente, e dito como pendente em vez de fingido por um
   * cronômetro que não mede mais o que o nome dele promete.
   */
  public tickAll(dt: number): void {
    // Recarrega o orçamento de mensagens de todos os mods. Fica ANTES do despacho, para o que este
    // quadro pedir ser cobrado deste quadro.
    this.ponte.novoQuadro();
    if (this.contexts.size === 0 && this.saindo.size === 0) return;
    for (const ctx of this.contexts.values()) this.dispatchTo(ctx, 'tick', { dt });

    // Drenagem por quadro. As escritas do mod chegam por mensagem, depois de o handler ter
    // terminado, então já não existe "logo após o handler" para drenar. Uma vez por quadro é o
    // ritmo natural: o atraso máximo é um quadro, e o custo é uma varredura de um punhado de mods.
    for (const ctx of this.contexts.values()) this.drenar(ctx);
  }

  /**
   * Manda o evento para o reino de execução.
   *
   * Não há mais `try/catch` aqui, e a ausência é o ponto: as funções estão do outro lado, e o que
   * elas quebram quebra lá. O erro volta por `aoFalhar`, que é onde a contagem e o desligamento
   * continuam morando — junto do log, que é onde a redação de segredos acontece.
   */
  private dispatchTo(ctx: ModContext, event: ModEvent, payload: any): void {
    this.ponte.despachar(ctx.mod.id, event, payload);
  }

  /**
   * Recolhe os blocos que os scripts deste mod alteraram e avisa o host.
   *
   * O contexto é reconferido porque uma escrita pode chegar **depois** do mod ser descarregado — o
   * jogador desligou o mod, ou o editor salvou uma revisão nova, enquanto mensagens ainda estavam
   * em trânsito. Sem esta guarda, os blocos de um mod que já não existe seriam gravados e
   * replicados em nome dele, e o desfazer do mod não os alcançaria: chegaram depois de a atribuição
   * ter sido apagada.
   */
  private drenar(ctx: ModContext): void {
    const api = this.apis.get(ctx.mod.id);
    if (!api) return;
    const changes = api.__drain();
    if (changes.length === 0) return;
    if (this.contexts.get(ctx.mod.id) !== ctx) return; // mod descarregado ou recarregado no meio
    this.onBlocksChanged(ctx.mod.id, changes);
  }

  /**
   * Atribui ao mod um bloco escrito FORA do script dele — item 704.
   *
   * ## Por que isto precisa existir
   *
   * O agente altera o mundo por dois caminhos: o script do mod (que já registrava) e as
   * ferramentas diretas `set_block`, `fill_box` e `execute_voxel_script`. As segundas escreviam
   * no mundo sem atribuição nenhuma — e o que não tem dono **não pode ser revertido**.
   *
   * Na prática isso partia a reversão ao meio: o jogador pedia "faça uma torre", o agente usava
   * `fill_box`, e depois "desfaça esse mod" deixava a torre de pé. A metade que veio do script
   * sumia, a metade que veio da ferramenta ficava. Pior que não reverter nada, porque o resultado
   * é um mundo em estado intermediário que ninguém pediu.
   *
   * Silencioso quando não há mod de sessão: uma sessão livre não tem a quem atribuir, e isso é
   * legítimo — não é erro, é o modo de uso em que o jogador mexe no mundo sem estar fazendo mod.
   */
  public registrarBlocoColocado(modId: string, x: number, y: number, z: number, antes: number, depois: number): void {
    const ctx = this.contexts.get(modId);
    if (!ctx) return;
    const chave = `${x},${y},${z}`;
    const ja = ctx.placedBlocks.get(chave);
    ctx.placedBlocks.set(chave, { antes: ja ? ja.antes : antes, depois });
  }

  /**
   * Desfaz os blocos que um mod colocou nesta sessão — item 705.
   *
   * ## A guarda que faz isto ser seguro
   *
   * Só restaura onde o bloco **ainda é o que o mod pôs**. Se o jogador quebrou aquele bloco
   * depois, ou construiu por cima, a posição é deixada em paz: reverter sobre uma edição do
   * jogador destruiria trabalho dele para desfazer o de outro. É a diferença entre "desfazer o
   * mod" e "voltar o mundo no tempo".
   *
   * Devolve as posições revertidas, para o chamador propagar aos convidados e salvar.
   */
  public reverterBlocosDoMod(modId: string): { x: number; y: number; z: number; blockType: number }[] {
    const ctx = this.contexts.get(modId);
    if (!ctx) return [];

    const revertidos: { x: number; y: number; z: number; blockType: number }[] = [];
    for (const [chave, { antes, depois }] of ctx.placedBlocks) {
      const [x, y, z] = chave.split(',').map(Number);
      if (this.host.getBlock(x, y, z) !== depois) continue; // o jogador mexeu aqui: não tocar
      if (!this.host.setBlock(x, y, z, antes)) continue;
      revertidos.push({ x, y, z, blockType: antes });
    }

    ctx.placedBlocks.clear();
    if (revertidos.length > 0) this.onBlocksChanged(modId, revertidos);
    return revertidos;
  }

  /** Diagnóstico para a UI e para o agente: estado de cada mod carregado. */
  public describe(): {
    modId: string;
    scripts: { key: string; enabled: boolean; disabledReason?: string }[];
    handlers: Record<string, number>;
    logs: number;
    blocksPlaced: number;
  }[] {
    return Array.from(this.contexts.values()).map((ctx) => {
      // A contagem vem do reino de execução (`ctx.handlerCount`), e não de uma lista local: as
      // funções vivem lá. Ler `ctx.handlers` aqui mostraria zero para todo mod carregado.
      const handlers: Record<string, number> = {};
      for (const [event, n] of Object.entries(ctx.handlerCount)) {
        if (n > 0) handlers[event] = n;
      }
      return {
        modId: ctx.mod.id,
        scripts: (ctx.mod.scripts ?? []).map((s) => ({
          key: s.key,
          enabled: s.enabled && !ctx.disabledScripts.has(s.key),
          disabledReason: ctx.disabledScripts.get(s.key),
        })),
        handlers,
        logs: ctx.logs.length,
        blocksPlaced: ctx.placedBlocks.size,
      };
    });
  }

  /** Últimas linhas de log de um mod, para o editor e para a autocorreção do agente. */
  public getLogs(modId: string, limit = 40): { level: string; message: string; timestamp: number }[] {
    const ctx = this.contexts.get(modId);
    if (!ctx) return [];
    return ctx.logs.slice(-limit);
  }
}
