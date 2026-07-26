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
}

export class PonteDeMods {
  constructor(
    private porta: Porta,
    private host: ModHostBridge,
    private cb: CallbacksDaPonte,
    /** Resolve `world.*` e outros membros que precisam de lógica além do host cru. */
    private extras: Record<string, (modId: string, args: unknown[]) => unknown> = {},
  ) {
    this.porta.onmessage = (ev) => this.receber(ev.data as ParaOHost);
  }

  private enviar(msg: ParaOWorker): void {
    this.porta.postMessage(msg);
  }

  public carregar(modId: string, scripts: Array<{ key: string; code: string }>, constantes: Record<string, unknown>): void {
    this.enviar({ t: 'carregar', modId, constantes, scripts });
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
      case 'carregado': this.cb.aoCarregar(msg.modId, msg.resultados); break;
      case 'falha': this.cb.aoFalhar(msg.modId, msg.scriptKey, msg.erro); break;
      case 'handlers': this.cb.aoRelatarHandlers(msg.modId, msg.contagem); break;
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
    if (!(metodo in MEMBROS_DA_API)) {
      // Um método que o worker inventou. Não é cenário de mod normal — é sinal de protocolo fora de
      // sincronia entre os dois lados, ou de alguém falando com a ponte por fora.
      throw new Error(`método desconhecido: ${metodo}`);
    }

    if (metodo.startsWith('console.')) {
      const nivel = metodo.slice('console.'.length) as 'log' | 'warn' | 'error';
      this.cb.aoRegistrarLog(modId, nivel, args);
      return undefined;
    }

    const extra = this.extras[metodo];
    if (extra) return extra(modId, args);

    return this.executarNoHost(modId, metodo, args);
  }

  /** Os membros que são chamada direta ao host, sem lógica pelo caminho. */
  private executarNoHost(modId: string, metodo: string, args: unknown[]): unknown {
    const h = this.host;
    const n = (v: unknown) => Math.floor(Number(v) || 0);
    switch (metodo) {
      case 'world.getBlock': return h.getBlock(n(args[0]), n(args[1]), n(args[2]));
      case 'world.getGroundY': return h.getGroundY(n(args[0]), n(args[1]));
      case 'entities.spawn': return h.spawnEntity(modId, String(args[0]), Number(args[1]), Number(args[2]), Number(args[3]));
      case 'entities.list': return h.listEntities();
      case 'entities.damage': return h.damageEntity(String(args[0]), Number(args[1]) || 0);
      case 'player.position': return h.playerPosition();
      case 'player.teleport': return h.teleportPlayer(Number(args[0]), Number(args[1]), Number(args[2]));
      case 'player.health': return h.playerHealth();
      case 'ui.toast': return h.toast(String(args[0]).slice(0, 200));
      case 'time.ofDay': return h.timeOfDay();
      case 'time.moonPhase': return h.moonPhase?.() ?? 4;
      case 'env.get': return h.modEnv(modId).valores[String(args[0])];
      case 'env.has': return h.modEnv(modId).valores[String(args[0])] !== undefined;
      case 'env.missing': return h.modEnv(modId).faltando;
      default:
        // Declarado no protocolo e sem implementação aqui nem em `extras`. É um buraco de fiação,
        // e ele **precisa** estourar: devolver `undefined` em silêncio faria o mod receber um valor
        // vazio e seguir em frente, com o defeito aparecendo três passos adiante.
        throw new Error(`membro "${metodo}" está no protocolo e não foi ligado na ponte`);
    }
  }
}
