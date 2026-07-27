// O que roda DENTRO do reino isolado — item 358.
//
// Separado de `modWorker.ts` de propósito: aquele arquivo é uma casca de dez linhas que apaga os
// globais e amarra isto ao `self` do Worker. Toda a lógica mora aqui, recebendo uma `Porta` —
// e é isso que a torna testável, porque `vitest` com jsdom não tem `Worker`.
//
// A separação não é só conveniência de teste. É a fronteira entre **o que precisa de um navegador
// de verdade para ser verificado** (o isolamento: o global vazio, a fuga pelo construtor devolvendo
// nada) e **o que é lógica comum** (compilar, registrar handler, despachar, empacotar chamada). A
// segunda parte é a que tem defeito com frequência, e ela fica coberta.

import { compilarScriptDeMod } from './sandbox';
import { MEMBROS_DA_API, MsgCarregar, MsgEvento, MsgRecarregar, ParaOHost, ParaOWorker, Porta } from './protocoloDeMods';
import { MOD_EVENTS } from './ModAPI';

interface HandlerRegistrado {
  scriptKey: string;
  fn: (payload: unknown) => unknown;
}

interface ModCarregado {
  handlers: Map<string, HandlerRegistrado[]>;
  /** Estado do `api.storage`, que vive aqui e nunca atravessa. */
  storage: Map<string, unknown>;
  /** Scripts que já falharam demais e não devem mais ser chamados. */
  desligados: Set<string>;
}

/**
 * Instala o núcleo numa porta.
 *
 * Devolve nada: a partir daqui tudo acontece por mensagem. Quem testa constrói uma porta falsa,
 * empurra mensagens e olha o que sai — sem `Worker`, sem navegador.
 */
export function instalarNucleo(porta: Porta): void {
  const mods = new Map<string, ModCarregado>();

  /**
   * Handlers de `tick` que ainda não terminaram.
   *
   * `WeakSet` sobre a própria função: quando o mod for descarregado ela deve poder ser coletada sem
   * ninguém lembrar de removê-la daqui. Um `Set` comum seguraria a função e, por ela, o escopo
   * inteiro do script.
   */
  const emVoo = new WeakSet<Function>();

  /** Leituras aguardando resposta do host, por id. */
  const pendentes = new Map<number, { resolver: (v: unknown) => void; rejeitar: (e: Error) => void }>();
  let proximoId = 1;

  const enviar = (msg: ParaOHost) => porta.postMessage(msg);

  /**
   * Empacota uma chamada de API.
   *
   * Escrita: vai e devolve `true` sem esperar. É a decisão que faz uma construção de 20.000 blocos
   * custar 20.000 mensagens de mão única em vez de 20.000 idas e voltas — o mod não fica preso
   * esperando uma confirmação que ninguém lê.
   */
  function chamar(modId: string, metodo: string, args: unknown[]): unknown {
    if (MEMBROS_DA_API[metodo] === 'escrita') {
      enviar({ t: 'chamada', modId, metodo, args });
      return true;
    }
    const id = proximoId++;
    return new Promise((resolver, rejeitar) => {
      pendentes.set(id, { resolver, rejeitar });
      enviar({ t: 'chamada', id, modId, metodo, args });
    });
  }

  /**
   * Monta o objeto `api` que o script vê.
   *
   * As constantes vêm prontas do host e são espalhadas primeiro; os membros chamáveis são criados
   * a partir de `MEMBROS_DA_API`, e não escritos à mão. Escrever trinta proxies à mão é o convite
   * mais direto que existe para um deles ficar de fora — e um membro esquecido não dá erro: ele
   * simplesmente é `undefined` no meio do script de alguém.
   */
  function montarApi(modId: string, scriptKey: string, constantes: Record<string, unknown>): Record<string, any> {
    const registro = mods.get(modId)!;
    const api: Record<string, any> = { ...constantes };

    for (const caminho of Object.keys(MEMBROS_DA_API)) {
      const [grupo, nome] = caminho.split('.');
      api[grupo] = api[grupo] ?? {};
      api[grupo][nome] = (...args: unknown[]) => chamar(modId, caminho, args);
    }

    api.on = (evento: string, fn: unknown) => {
      // As duas recusas avisam em vez de calar. Um `api.on('tickk', ...)` que some sem dizer nada é
      // um mod que "não funciona" sem nenhuma pista — e quem escreveu foi uma IA, que vai reler o
      // log procurando o que fazer diferente.
      if (!(MOD_EVENTS as readonly string[]).includes(evento)) {
        api.console.warn(`Evento desconhecido "${evento}". Válidos: ${MOD_EVENTS.join(', ')}`);
        return;
      }
      if (typeof fn !== 'function') {
        api.console.warn(`on("${evento}") precisa de uma função.`);
        return;
      }
      const lista = registro.handlers.get(evento) ?? [];
      lista.push({ scriptKey, fn: fn as (p: unknown) => unknown });
      registro.handlers.set(evento, lista);
    };

    // `storage` fica inteiro aqui: é estado do mod, ninguém do outro lado o lê, e o mod o usa
    // dentro de `tick` — ou seja, sessenta vezes por segundo. Uma viagem por acesso seria o
    // caminho mais rápido para tornar a fronteira insuportável.
    api.storage = {
      get: (k: string) => registro.storage.get(String(k)),
      set: (k: string, v: unknown) => { registro.storage.set(String(k), v); },
      has: (k: string) => registro.storage.has(String(k)),
      keys: () => Array.from(registro.storage.keys()),
    };

    api.Math = Math;
    return api;
  }

  async function carregar(msg: MsgCarregar): Promise<void> {
    mods.set(msg.modId, { handlers: new Map(), storage: new Map(), desligados: new Set() });
    const resultados: Array<{ scriptKey: string; ok: boolean; error?: string }> = [];

    // Em série: os scripts de um mod se veem pelo mesmo registro, e a ordem em que registram
    // handlers é observável.
    for (const s of msg.scripts) {
      try {
        await compilarScriptDeMod(s.code)(montarApi(msg.modId, s.key, msg.constantes));
        resultados.push({ scriptKey: s.key, ok: true });
      } catch (err: any) {
        resultados.push({ scriptKey: s.key, ok: false, error: err?.message || String(err) });
      }
    }

    // A contagem vai JUNTO com o resultado, e não numa mensagem seguinte: quem chama `loadMod`
    // resolve a promessa quando o resultado chega, e a contagem em trânsito faria o diagnóstico ler
    // zero handlers para um mod recém-carregado — que é exatamente como um mod quebrado se parece.
    enviar({ t: 'carregado', modId: msg.modId, resultados, handlers: contarHandlers(msg.modId) });
  }

  /**
   * Recompila um script só.
   *
   * Os handlers **daquele** script saem primeiro. Sem isso, salvar no editor cinco vezes deixaria
   * cinco cópias do mesmo handler registradas, e o mod passaria a reagir cinco vezes a cada evento
   * — que é o defeito clássico de recarregar sem limpar.
   */
  async function recarregar(msg: MsgRecarregar): Promise<void> {
    const reg = mods.get(msg.modId);
    if (!reg) return;
    for (const [evento, lista] of reg.handlers) {
      reg.handlers.set(evento, lista.filter((h) => h.scriptKey !== msg.scriptKey));
    }
    reg.desligados.delete(msg.scriptKey);

    let resultado: { scriptKey: string; ok: boolean; error?: string };
    try {
      await compilarScriptDeMod(msg.code)(montarApi(msg.modId, msg.scriptKey, msg.constantes));
      resultado = { scriptKey: msg.scriptKey, ok: true };
    } catch (err: any) {
      resultado = { scriptKey: msg.scriptKey, ok: false, error: err?.message || String(err) };
    }
    enviar({ t: 'carregado', modId: msg.modId, resultados: [resultado], handlers: contarHandlers(msg.modId) });
  }

  function contarHandlers(modId: string): Record<string, number> {
    const reg = mods.get(modId);
    const contagem: Record<string, number> = {};
    if (reg) for (const [evento, lista] of reg.handlers) contagem[evento] = lista.length;
    return contagem;
  }

  function despachar(msg: MsgEvento): void {
    const reg = mods.get(msg.modId);
    const lista = reg?.handlers.get(msg.evento);
    if (!reg || !lista) return;

    // Cópia: um handler pode registrar ou remover outro durante o despacho.
    for (const { scriptKey, fn } of [...lista]) {
      if (reg.desligados.has(scriptKey)) continue;

      // Um `tick` assíncrono mais lento que um quadro seria reentrado sessenta vezes por segundo, e
      // cada entrada empilharia mais uma. Em segundos há centenas de execuções do mesmo handler
      // disputando o mesmo `api.storage` — e o sintoma não é lentidão, é o estado do mod embaralhado
      // por si mesmo.
      //
      // Isto mora aqui, e não do lado do host, porque é aqui que as funções vivem: do outro lado só
      // se sabe que um evento foi enviado, nunca se o anterior terminou. A guarda passou a ser mais
      // necessária que antes — no reino isolado, **toda** leitura da API é uma ida e volta de
      // verdade, então qualquer `await` já dura mais que um quadro.
      if (msg.evento === 'tick' && emVoo.has(fn)) continue;

      try {
        const r = fn(msg.payload) as unknown;
        // O erro depois do primeiro `await` vira rejeição, e sem isto ele sairia como rejeição não
        // tratada **dentro do worker** — onde ninguém está olhando, e de onde nem o console do
        // jogador enxerga. O script erraria para sempre em silêncio absoluto.
        if (r && typeof (r as { then?: unknown }).then === 'function') {
          emVoo.add(fn);
          (r as Promise<unknown>).then(
            () => emVoo.delete(fn),
            (e) => { emVoo.delete(fn); relatarFalha(msg.modId, scriptKey, e); },
          );
        }
      } catch (err) {
        relatarFalha(msg.modId, scriptKey, err);
      }
    }
  }

  function relatarFalha(modId: string, scriptKey: string, err: unknown): void {
    enviar({ t: 'falha', modId, scriptKey, erro: (err as Error)?.message || String(err) });
  }

  /** O host manda desligar um script que já errou demais. A contagem é dele, não daqui. */
  function desligarScript(modId: string, scriptKey: string): void {
    mods.get(modId)?.desligados.add(scriptKey);
  }

  porta.onmessage = (ev: { data: unknown }) => {
    const msg = ev.data as ParaOWorker & { scriptKey?: string };
    switch (msg.t) {
      case 'carregar':
        void carregar(msg);
        break;
      case 'recarregar':
        void recarregar(msg);
        break;
      case 'evento':
        // `desligar` viaja como um evento reservado: o host conta os erros (é ele que tem o log e o
        // limite), e só avisa o worker de quem parar de chamar.
        if (msg.evento === '__desligar') desligarScript(msg.modId, (msg.payload as any)?.scriptKey);
        else despachar(msg);
        break;
      case 'descarregar':
        mods.delete(msg.modId);
        // Confirma DEPOIS de esquecer: tudo o que o `unload` escreveu de forma síncrona já saiu
        // na frente, e o host pode drenar uma última vez sabendo que não vem mais nada.
        enviar({ t: 'descarregado', modId: msg.modId });
        break;
      case 'resposta': {
        const p = pendentes.get(msg.id);
        if (!p) return;
        pendentes.delete(msg.id);
        // O erro do host chega **dentro** do `await` do script, e não como um evento longe dali:
        // `try { await api.world.getBlock(...) } catch` funciona como qualquer código normal.
        if (msg.ok) p.resolver(msg.valor);
        else p.rejeitar(new Error(msg.erro || 'falha na chamada ao host'));
        break;
      }
    }
  };
}
