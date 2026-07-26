// Executa os scripts dos mods e distribui os eventos do jogo entre eles.
//
// O runtime é o lugar onde o isolamento vira concreto: compilar, chamar e falhar acontecem
// todos aqui, e nenhuma dessas três coisas pode escapar para o loop do jogo. Um mod quebrado
// deve produzir um log e sumir de cena — nunca uma tela preta.
//
// Orçamento de tempo: `tick` roda em todo frame, somando todos os mods. Um orçamento global por
// frame impede que dez mods razoáveis, juntos, façam o que um mod ruim faria sozinho.

import { ModPackage, ModScript } from './ModTypes';
import { compilarScriptDeMod } from './sandbox';
import { ModContext, ModEvent, ModHostBridge, buildModAPI } from './ModAPI';

/** Teto de tempo por frame para o conjunto de todos os `tick`, em milissegundos. */
export const TICK_BUDGET_MS = 4;

/**
 * É uma promessa (ou qualquer coisa com `.then`)?
 *
 * O teste é por `.then` e não por `instanceof Promise`: um mod pode devolver a promessa de outro
 * reino de execução — do Worker do item 358, por exemplo — e ela não seria `instanceof` a Promise
 * desta janela. Verificar a forma em vez da linhagem é o que faz isto continuar valendo depois.
 */
function ehPromessa(v: unknown): v is Promise<unknown> {
  return !!v && typeof (v as { then?: unknown }).then === 'function';
}

export interface ScriptLoadResult {
  scriptKey: string;
  ok: boolean;
  error?: string;
}

export class ModRuntime {
  private contexts = new Map<string, ModContext>();
  /**
   * Handlers assíncronos que ainda não terminaram.
   *
   * `WeakSet` e não `Set`: a chave é a própria função do mod, e quando o mod é descarregado ela
   * deve poder ser coletada sem ninguém precisar lembrar de removê-la daqui. Um `Set` comum
   * seguraria a função — e, por ela, o escopo inteiro do script — para sempre.
   */
  private emVoo = new WeakSet<Function>();
  /**
   * Uma instância de `api` por script, reaproveitada em toda chamada dele.
   *
   * Precisa ser a MESMA: o handler registrado pelo script fecha sobre o `api` que recebeu na
   * compilação. Construir um novo a cada despacho fazia o runtime drenar um objeto vazio,
   * enquanto os blocos escritos ficavam presos no `api` original — ou seja, bloco colocado
   * dentro de um evento nunca chegava a ser salvo nem sincronizado.
   */
  private apis = new Map<string, Record<string, any>>();
  private host: ModHostBridge;
  /** Avisado a cada lote de blocos alterado por script, com o mod responsável. */
  public onBlocksChanged: (modId: string, changes: { x: number; y: number; z: number; blockType: number }[]) => void = () => {};
  /** Avisado quando um script é desligado por erros repetidos. */
  public onScriptDisabled: (modId: string, scriptKey: string, reason: string) => void = () => {};

  constructor(host: ModHostBridge) {
    this.host = host;
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

    const resultados: ScriptLoadResult[] = [];
    // Em série, e não em paralelo com `Promise.all`: os scripts de um mod se veem pelo mesmo
    // contexto, e a ordem em que registram handlers é observável. Carregar em paralelo tornaria
    // essa ordem dependente de quando cada `await` interno resolve — não determinística, e
    // diferente a cada execução.
    for (const script of pkg.scripts ?? []) {
      if (!script.enabled) continue;
      resultados.push(await this.compile(ctx, script));
    }

    this.dispatchTo(ctx, 'load', {});
    return resultados;
  }

  /** Compila um script e roda seu corpo, que é onde os `api.on(...)` são registrados. */
  private apiFor(ctx: ModContext, scriptKey: string): Record<string, any> {
    const chave = `${ctx.mod.id}:${scriptKey}`;
    let api = this.apis.get(chave);
    if (!api) {
      api = buildModAPI(ctx, this.host, scriptKey);
      this.apis.set(chave, api);
    }
    return api;
  }

  private async compile(ctx: ModContext, script: ModScript): Promise<ScriptLoadResult> {
    // Descarta a instância anterior: recarregar precisa reiniciar o orçamento e o buffer.
    this.apis.delete(`${ctx.mod.id}:${script.key}`);
    const api = this.apiFor(ctx, script.key);
    try {
      // O escopo global é SOMBREADO — ver `src/mods/sandbox.ts`.
      //
      // O comentário que estava aqui afirmava que `new Function` com um parâmetro só impedia o
      // corpo de ver `window` e `globalThis`. Era falso: `new Function` isola do escopo LOCAL de
      // quem cria, e o corpo continua avaliado no escopo global, com `fetch`, `document`,
      // `localStorage` e `indexedDB` ao alcance. Num projeto onde estes scripts são escritos por
      // uma IA e rodam na mesma origem do cofre de chaves, isso não era um detalhe.
      // O `await` não é decorativo: com o corpo `async`, um erro **síncrono** do script vira uma
      // promessa rejeitada. Sem esperá-la aqui, o `catch` abaixo nunca dispararia, o script seria
      // reportado como carregado com sucesso, e o erro sairia como rejeição não tratada no console
      // — longe do mod que a causou e sem desligar script nenhum.
      await compilarScriptDeMod(script.code)(api);
      this.flush(ctx, api);
      return { scriptKey: script.key, ok: true };
    } catch (err: any) {
      const msg = err?.message || String(err);
      ctx.log('error', `[${script.key}] falha ao carregar: ${msg}`);
      ctx.disabledScripts.set(script.key, msg);
      ctx.removeHandlersOf(script.key);
      this.onScriptDisabled(ctx.mod.id, script.key, msg);
      return { scriptKey: script.key, ok: false, error: msg };
    }
  }

  /** Recarrega um script só, sem tocar nos demais do mesmo mod. */
  public async reloadScript(modId: string, scriptKey: string): Promise<ScriptLoadResult | null> {
    const ctx = this.contexts.get(modId);
    if (!ctx) return null;
    const script = (ctx.mod.scripts ?? []).find((s) => s.key === scriptKey);
    if (!script) return null;

    ctx.removeHandlersOf(scriptKey);
    ctx.disabledScripts.delete(scriptKey);
    if (!script.enabled) return { scriptKey, ok: true };
    return this.compile(ctx, script);
  }

  public unloadMod(modId: string): void {
    const ctx = this.contexts.get(modId);
    if (!ctx) return;
    this.dispatchTo(ctx, 'unload', {});
    ctx.reset();
    this.contexts.delete(modId);
    for (const chave of Array.from(this.apis.keys())) {
      if (chave.startsWith(`${modId}:`)) this.apis.delete(chave);
    }
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
   * `tick` de todos os mods, com orçamento global de tempo.
   * Ao estourar, os mods restantes são pulados **neste frame** — nunca desligados: um pico
   * isolado não deve punir um mod que costuma ser barato.
   */
  public tickAll(dt: number): void {
    if (this.contexts.size === 0) return;
    const limite = performance.now() + TICK_BUDGET_MS;

    for (const ctx of this.contexts.values()) {
      this.dispatchTo(ctx, 'tick', { dt });
      if (performance.now() > limite) break;
    }
  }

  private dispatchTo(ctx: ModContext, event: ModEvent, payload: any): void {
    const list = ctx.handlers.get(event);
    if (!list || list.length === 0) return;

    // Cópia da lista: um handler pode registrar ou remover outro durante o despacho.
    for (const { scriptKey, fn } of [...list]) {
      if (ctx.disabledScripts.has(scriptKey)) continue;

      // Um `tick` assíncrono que demora mais que um frame seria reentrado 60 vezes por segundo, e
      // cada entrada empilharia mais uma. Em segundos há centenas de execuções do mesmo handler
      // disputando o mesmo `api.storage` — e o sintoma não é lentidão, é o estado do mod embaralhado
      // por si mesmo.
      //
      // Só o `tick` é pulado: ele é periódico, e perder uma volta é o mesmo que o orçamento de tempo
      // já faz. Os outros eventos vêm de uma ação do jogador e perder um seria perder o fato.
      if (event === 'tick' && this.emVoo.has(fn)) continue;

      const api = this.apiFor(ctx, scriptKey);
      try {
        const resultado = fn.call(undefined, payload) as unknown;

        // Handler assíncrono (item 1251). O `try/catch` só pega o que estoura ANTES do primeiro
        // `await`; o que estourar depois vira uma promessa rejeitada, e sem este tratamento seria
        // uma rejeição não tratada no console — o script continuaria ligado, errando para sempre,
        // e o contador de erros que desliga o script nunca subiria.
        //
        // O despacho **não** espera: quem chama é o laço de renderização, e travá-lo até um mod
        // terminar entregaria a cada mod o poder de congelar o jogo.
        if (ehPromessa(resultado)) {
          this.emVoo.add(fn);
          resultado.then(
            () => { this.emVoo.delete(fn); this.flush(ctx, api); },
            (err) => {
              this.emVoo.delete(fn);
              this.registrarFalha(ctx, scriptKey, err);
              // Descarrega o que o handler chegou a escrever antes de falhar: metade de uma
              // construção no mundo e nada no save é pior que a construção inteira.
              this.flush(ctx, api);
            },
          );
        }
      } catch (err) {
        this.registrarFalha(ctx, scriptKey, err);
      }
      this.flush(ctx, api);
    }
  }

  /** Contabiliza um erro de handler e desliga o script se ele passou do limite. */
  private registrarFalha(ctx: ModContext, scriptKey: string, err: unknown): void {
    const desligou = ctx.recordError(scriptKey, err);
    if (desligou) {
      this.onScriptDisabled(ctx.mod.id, scriptKey, ctx.disabledScripts.get(scriptKey) ?? 'erro');
    }
  }

  /**
   * Recolhe os blocos que o handler alterou e avisa o host para persistir e sincronizar.
   *
   * O contexto é reconferido porque um handler assíncrono pode terminar **depois** do mod ser
   * descarregado — o jogador desligou o mod, ou o editor salvou uma revisão nova, enquanto uma
   * promessa ainda corria. Sem esta guarda, os blocos de um mod que já não existe seriam gravados
   * e replicados em nome dele, e o desfazer do mod não os alcançaria: eles chegaram depois de a
   * atribuição ter sido apagada.
   */
  private flush(ctx: ModContext, api: Record<string, any>): void {
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
      const handlers: Record<string, number> = {};
      for (const [event, list] of ctx.handlers) {
        if (list.length > 0) handlers[event] = list.length;
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
