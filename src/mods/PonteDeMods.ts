// A ponte entre o jogo e o reino onde os scripts de mod rodam — item 358.
//
// Do lado de cá da fronteira. Ela é dona do `Worker`, traduz cada chamada que vem de lá numa
// chamada do `ModHostBridge` que já existia, e empurra os eventos do jogo para dentro.
//
// ## O que ela deliberadamente NÃO faz
//
// Não conta erros, não guarda log, não decide desligar script. Isso continua no `ModRuntime`, e a
// separação tem uma razão concreta: a **redação de segredos** (seção 52) acontece ao gravar o log,
// do lado que conhece o cofre. Se o log fosse formatado no worker, o valor da chave de API teria
// que viajar até lá em texto para ser mascarado — ou pior, sairia sem máscara.
//
// ## Por que ela recebe uma fábrica de porta, e não um `Worker`
//
// `vitest` com jsdom não tem `Worker`. Recebendo qualquer coisa que fale `postMessage`, a ponte
// inteira fica testável com um duplo — e o que sobra sem cobertura é só o isolamento em si, que
// exige um navegador de verdade e está registrado como tal.

import { MEMBROS_DA_API, MsgChamada, ParaOHost, ParaOWorker, Porta } from './protocoloDeMods';
import { ModHostBridge } from './ModAPI';

export interface CallbacksDaPonte {
  /** Um script terminou de carregar (ou falhou). */
  aoCarregar(modId: string, resultados: Array<{ scriptKey: string; ok: boolean; error?: string }>): void;
  /** Um handler estourou. Quem conta e desliga é o `ModRuntime`. */
  aoFalhar(modId: string, scriptKey: string, erro: string): void;
  /** Quantos handlers por evento — só para o painel de diagnóstico. */
  aoRelatarHandlers(modId: string, contagem: Record<string, number>): void;
  /** O script pediu para registrar no log. Passa pela redação de segredos lá no `ModContext`. */
  aoRegistrarLog(modId: string, nivel: 'log' | 'warn' | 'error', args: unknown[]): void;
  /** O worker esqueceu o mod. Momento exato de drenar pela última vez e soltar o contexto. */
  aoDescarregar(modId: string): void;
}

export class PonteDeMods {
  /**
   * @param apiDoMod devolve a API **já construída** daquele mod — a mesma `buildModAPI` de sempre.
   *
   * ## Por que a ponte delega em vez de reimplementar
   *
   * A primeira versão tinha um `switch` traduzindo cada membro para uma chamada do host. Estava
   * errada por duplicação: `fillBox` conta blocos, `findNearest` varre um cubo, `setBlock` resolve
   * nome de bloco e cobra do orçamento, `isNight` interpreta a hora. Reescrever isso aqui criaria
   * **duas** implementações de cada regra, e a segunda a mudar sairia de sincronia em silêncio — um
   * mod se comportando diferente conforme o lado em que roda é o pior defeito possível numa
   * migração como esta.
   *
   * Resolvendo o caminho dentro do objeto que `buildModAPI` já devolve, existe uma implementação
   * só. A fronteira vira transporte puro, que é tudo o que ela deveria ser.
   */
  constructor(
    private porta: Porta,
    private apiDoMod: (modId: string) => Record<string, any> | undefined,
    private cb: CallbacksDaPonte,
  ) {
    this.porta.onmessage = (ev) => this.receber(ev.data as ParaOHost);
  }

  private enviar(msg: ParaOWorker): void {
    this.porta.postMessage(msg);
  }

  public carregar(modId: string, scripts: Array<{ key: string; code: string }>, constantes: Record<string, unknown>): void {
    this.enviar({ t: 'carregar', modId, constantes, scripts });
  }

  public recarregarScript(modId: string, scriptKey: string, code: string, constantes: Record<string, unknown>): void {
    this.enviar({ t: 'recarregar', modId, scriptKey, code, constantes });
  }

  public despachar(modId: string, evento: string, payload: unknown): void {
    this.enviar({ t: 'evento', modId, evento, payload });
  }

  public descarregar(modId: string): void {
    this.enviar({ t: 'descarregar', modId });
  }

  /** Manda o worker parar de chamar um script que já errou demais. */
  public desligarScript(modId: string, scriptKey: string): void {
    this.enviar({ t: 'evento', modId, evento: '__desligar', payload: { scriptKey } });
  }

  private receber(msg: ParaOHost): void {
    switch (msg.t) {
      case 'chamada': this.atender(msg); break;
      case 'carregado':
        // A contagem chega junto, então o diagnóstico já está certo quando a carga é reportada.
        this.cb.aoRelatarHandlers(msg.modId, msg.handlers);
        this.cb.aoCarregar(msg.modId, msg.resultados);
        break;
      case 'falha': this.cb.aoFalhar(msg.modId, msg.scriptKey, msg.erro); break;
      case 'handlers': this.cb.aoRelatarHandlers(msg.modId, msg.contagem); break;
      case 'descarregado': this.cb.aoDescarregar(msg.modId); break;
    }
  }

  /**
   * Executa uma chamada vinda do worker.
   *
   * Erros **não** derrubam a ponte: eles voltam pelo `ok: false` e chegam dentro do `await` do
   * script. Um mod pedindo algo impossível é um erro daquele mod, e deve estourar no `try/catch`
   * dele — não no despachante que atende todos os outros.
   */
  private atender(msg: MsgChamada): void {
    let valor: unknown;
    let erro: string | undefined;
    try {
      valor = this.executar(msg.modId, msg.metodo, msg.args);
    } catch (e: any) {
      erro = e?.message || String(e);
    }

    // Escrita não tem id: nada a responder. Responder assim mesmo criaria uma mensagem por bloco
    // colocado, desfazendo exatamente a economia que a mão única existe para conseguir.
    if (msg.id === undefined) return;
    this.enviar({ t: 'resposta', id: msg.id, ok: erro === undefined, valor, erro });
  }

  private executar(modId: string, metodo: string, args: unknown[]): unknown {
    // `Object.hasOwn`, e **não** `metodo in MEMBROS_DA_API`.
    //
    // `in` percorre a cadeia de protótipos, então `constructor`, `toString`, `valueOf`,
    // `hasOwnProperty` e `__proto__` passariam pela conferência — nomes que vêm de graça em todo
    // objeto literal e que nunca estiveram no protocolo. Nenhum deles chega a executar hoje, porque
    // o passo seguinte não os encontra na API, mas a guarda estaria aceitando o que deveria recusar.
    //
    // Numa fronteira em que o outro lado roda código escrito por uma IA, "não executa por acaso" é
    // uma garantia diferente de "é recusado por regra", e só a segunda continua valendo depois de
    // alguém mudar o passo seguinte.
    if (!Object.hasOwn(MEMBROS_DA_API, metodo)) {
      // Um método que o worker inventou. Não é cenário de mod normal — é sinal de protocolo fora de
      // sincronia entre os dois lados, ou de alguém falando com a ponte por fora.
      throw new Error(`método desconhecido: ${metodo}`);
    }

    // O log é o único membro que NÃO passa pela API do mod, e o desvio é proposital: a redação de
    // segredos (seção 52) acontece ao gravar, no `ModContext`, e quem sabe formatar a linha é o
    // runtime — não a API.
    if (metodo.startsWith('console.')) {
      const nivel = metodo.slice('console.'.length) as 'log' | 'warn' | 'error';
      this.cb.aoRegistrarLog(modId, nivel, args);
      return undefined;
    }

    const api = this.apiDoMod(modId);
    if (!api) {
      // O mod foi descarregado enquanto uma chamada estava em trânsito. Não é defeito: é a corrida
      // normal de uma fronteira assíncrona, e o erro chega no `await` do script, que já não importa.
      throw new Error(`mod "${modId}" não está carregado`);
    }

    const [grupo, nome] = metodo.split('.');
    const fn = api[grupo]?.[nome];
    if (typeof fn !== 'function') {
      // Declarado no protocolo e ausente da API. É um buraco de fiação, e ele **precisa** estourar:
      // devolver `undefined` em silêncio faria o mod receber um valor vazio e seguir em frente, com
      // o defeito aparecendo três passos adiante.
      throw new Error(`membro "${metodo}" está no protocolo e não existe na API do mod`);
    }
    return fn.apply(api[grupo], args);
  }
}
