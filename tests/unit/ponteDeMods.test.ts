// A fronteira entre o jogo e o reino dos mods — item 358.
//
// ## O que estes testes cobrem, e o que NÃO cobrem
//
// Eles ligam o núcleo do worker à ponte por duas portas falsas amarradas uma na outra, e exercitam
// a coisa inteira: carregar script, despachar evento, chamada de leitura indo e voltando, escrita
// de mão única, erro chegando dentro do `await` do script.
//
// **O que eles não provam é o isolamento.** Aqui tudo roda no mesmo reino, porque `vitest` com
// jsdom não tem `Worker`. Que `[].constructor.constructor('return this')()` devolva um global vazio
// depende de `modWorker.ts` ter apagado `fetch` e `indexedDB` num Worker de verdade, e isso exige
// um navegador. Está registrado como teste manual no checklist (item 1372), e não vale fingir aqui.
//
// A divisão é proposital: a lógica — que é onde os defeitos aparecem — fica coberta; o isolamento —
// que é onde a segurança mora — fica honestamente marcado como não coberto.

import { describe, it, expect, vi } from 'vitest';
import { instalarNucleo } from '../../src/mods/nucleoDoWorker';
import { CHAMADAS_POR_QUADRO, PonteDeMods } from '../../src/mods/PonteDeMods';
import { MEMBROS_DA_API, GLOBAIS_A_APAGAR, Porta } from '../../src/mods/protocoloDeMods';
import { ModContext, ModHostBridge, buildModAPI } from '../../src/mods/ModAPI';
import { emptyModPackage } from '../../src/mods/ModTypes';
import { B } from '../../src/world/blocks';

/** Duas portas ligadas uma na outra, entregando mensagens de forma assíncrona como um Worker real. */
function parDePortas(): [Porta, Porta] {
  const a: Porta = { postMessage: () => {}, onmessage: null };
  const b: Porta = { postMessage: () => {}, onmessage: null };
  // `queueMicrotask` e não chamada direta: um Worker real nunca entrega no mesmo tique da pilha, e
  // um teste que entrega em linha esconderia toda corrida de ordem que o código vai enfrentar.
  a.postMessage = (m) => queueMicrotask(() => b.onmessage?.({ data: m }));
  b.postMessage = (m) => queueMicrotask(() => a.onmessage?.({ data: m }));
  return [a, b];
}

function hostFalso(): ModHostBridge & { blocos: Map<string, number>; toasts: string[] } {
  const blocos = new Map<string, number>();
  const toasts: string[] = [];
  return {
    blocos, toasts,
    getBlock: (x, y, z) => blocos.get(`${x},${y},${z}`) ?? B.AIR,
    setBlock: (x, y, z, t) => { blocos.set(`${x},${y},${z}`, t); return true; },
    getGroundY: () => 12,
    spawnEntity: () => 'e1',
    listEntities: () => [],
    damageEntity: () => true,
    playerPosition: () => ({ x: 1, y: 12, z: 2 }),
    teleportPlayer: () => {},
    playerHealth: () => 87,
    giveItem: () => {},
    toast: (m: string) => { toasts.push(m); },
    timeOfDay: () => 0.75,
    modEnv: () => ({ valores: { CHAVE: 'valor-secreto' }, faltando: [] }),
  } as any;
}

/**
 * Monta o par núcleo+ponte já conectado.
 *
 * A ponte recebe a API **de verdade** (`buildModAPI`), e não um duplo: é o ponto do desenho — a
 * fronteira é transporte puro, e a lógica de `fillBox`, `findNearest`, `isNight` e companhia tem uma
 * implementação só. Testar com duplo aqui provaria o transporte e esconderia justamente o risco de
 * duas implementações divergirem.
 */
function montar(sobrepor: Record<string, any> = {}) {
  const [ladoWorker, ladoHost] = parDePortas();
  const host = hostFalso();
  const eventos = {
    carregados: [] as any[],
    falhas: [] as any[],
    handlers: [] as any[],
    logs: [] as any[],
    mortes: [] as string[],
  };

  const ctx = new ModContext(emptyModPackage('m1', 'M'));
  const api: Record<string, any> = buildModAPI(ctx, host, 'main');
  for (const [caminho, fn] of Object.entries(sobrepor)) {
    const [grupo, nome] = caminho.split('.');
    api[grupo] = { ...api[grupo], [nome]: fn };
  }

  instalarNucleo(ladoWorker);
  const ponte = new PonteDeMods(ladoHost, (id) => (id === 'm1' ? api : undefined), {
    aoCarregar: (modId, resultados) => eventos.carregados.push({ modId, resultados }),
    aoFalhar: (modId, scriptKey, erro) => eventos.falhas.push({ modId, scriptKey, erro }),
    aoRelatarHandlers: (modId, contagem) => eventos.handlers.push({ modId, contagem }),
    aoRegistrarLog: (modId, nivel, args) => eventos.logs.push({ modId, nivel, args }),
    aoDescarregar: () => {},
    aoMorrer: (motivo) => eventos.mortes.push(motivo),
  });

  return { ponte, host, eventos, api };
}

/** Deixa as mensagens em trânsito chegarem. */
const assentar = () => new Promise((r) => setTimeout(r, 0));

const CONSTANTES = { mod: { id: 'm1', name: 'M', revision: 1 }, B: { STONE: B.STONE, TORCH: B.TORCH } };

describe('carga através da fronteira', () => {
  it('CRÍTICO: um script carrega e o resultado volta', async () => {
    const { ponte, eventos } = montar();
    ponte.carregar('m1', [{ key: 'main', code: `api.on('tick', () => {});` }], CONSTANTES);
    await assentar();

    expect(eventos.carregados[0].resultados).toEqual([{ scriptKey: 'main', ok: true }]);
  });

  it('CRÍTICO: erro de sintaxe volta como falha de carga, não como silêncio', async () => {
    // Do outro lado da fronteira, um script que não compila não tem como estourar no chamador. Se
    // o resultado não voltar, o agente reporta sucesso sobre um script que nunca rodou.
    const { ponte, eventos } = montar();
    ponte.carregar('m1', [{ key: 'main', code: `isto ( não é ) javascript` }], CONSTANTES);
    await assentar();

    expect(eventos.carregados[0].resultados[0].ok).toBe(false);
    expect(eventos.carregados[0].resultados[0].error).toBeTruthy();
  });

  it('a contagem de handlers volta, para o diagnóstico continuar honesto', async () => {
    // Os handlers passam a viver do outro lado. Sem este relatório, o painel mostraria zero
    // handlers para um mod que tem cinco — e pareceria que o mod não carregou.
    const { ponte, eventos } = montar();
    ponte.carregar('m1', [{ key: 'main', code: `api.on('tick', () => {}); api.on('tick', () => {});` }], CONSTANTES);
    await assentar();

    expect(eventos.handlers[0].contagem.tick).toBe(2);
  });

  it('CRÍTICO: a contagem chega ANTES de a carga ser reportada', async () => {
    // Corrida encontrada ao ir ligar o `ModRuntime`: a contagem vinha numa mensagem própria, logo
    // depois. Quem chama `loadMod` resolve a promessa quando o resultado chega — e nesse instante a
    // contagem ainda estava em trânsito. O diagnóstico leria zero handlers para um mod recém
    // carregado, e "carregou mas não tem handler nenhum" é exatamente como um mod quebrado se
    // parece.
    //
    // Duas informações produzidas pelo mesmo ato não devem viajar separadas: quem precisa das duas
    // fica obrigado a sincronizar o que o remetente já sabia junto.
    const ordem: string[] = [];
    const [ladoWorker, ladoHost] = parDePortas();
    instalarNucleo(ladoWorker);
    new PonteDeMods(ladoHost, () => ({}), {
      aoCarregar: () => ordem.push('carregado'),
      aoRelatarHandlers: () => ordem.push('handlers'),
      aoFalhar: () => {}, aoRegistrarLog: () => {}, aoDescarregar: () => {}, aoMorrer: () => {},
    }).carregar('m1', [{ key: 'main', code: `api.on('tick', () => {});` }], CONSTANTES);
    await assentar();

    expect(ordem).toEqual(['handlers', 'carregado']);
  });

  it('as constantes chegam como VALOR, não como promessa', async () => {
    // `api.B.STONE` precisa continuar sendo um número. Se as constantes atravessassem por RPC,
    // `if (bloco === api.B.STONE)` compararia um número com uma promessa e daria sempre falso —
    // sem erro nenhum, e com o mod simplesmente nunca reagindo.
    const { ponte, eventos } = montar();
    ponte.carregar('m1', [{
      key: 'main',
      code: `if (typeof api.B.STONE !== 'number') throw new Error('B veio errado: ' + typeof api.B.STONE);`,
    }], CONSTANTES);
    await assentar();

    expect(eventos.carregados[0].resultados[0].ok, eventos.carregados[0].resultados[0].error).toBe(true);
  });
});

describe('leitura: vai e volta', () => {
  it('CRÍTICO: `await api.world.getBlock` devolve o bloco de verdade', async () => {
    const { ponte, host, eventos } = montar();
    host.blocos.set('4,12,4', B.STONE);

    ponte.carregar('m1', [{
      key: 'main',
      code: `
        api.on('tick', async () => {
          const b = await api.world.getBlock(4, 12, 4);
          api.ui.toast('vi ' + b);
        });
      `,
    }], CONSTANTES);
    await assentar();

    ponte.despachar('m1', 'tick', { dt: 0.016 });
    await assentar();
    await assentar();

    expect(host.toasts).toContain(`vi ${B.STONE}`);
    expect(eventos.falhas).toEqual([]);
  });

  it('CRÍTICO: o erro do host chega DENTRO do `await` do script', async () => {
    // É o que faz `try { await api.world.getBlock(...) } catch` funcionar como código normal. Se o
    // erro virasse um evento longe dali, o mod não teria como tratá-lo, e um pedido inválido de um
    // mod derrubaria a ponte de todos os outros.
    const { ponte, host } = montar({
      'world.findNearest': () => { throw new Error('raio grande demais'); },
    });

    ponte.carregar('m1', [{
      key: 'main',
      code: `
        api.on('tick', async () => {
          try { await api.world.findNearest('pedra', 999); }
          catch (e) { api.ui.toast('peguei: ' + e.message); }
        });
      `,
    }], CONSTANTES);
    await assentar();

    ponte.despachar('m1', 'tick', {});
    await assentar();
    await assentar();

    expect(host.toasts.some((t) => t.includes('raio grande demais'))).toBe(true);
  });
});

describe('escrita: vai e não volta', () => {
  it('CRÍTICO: escrita NÃO gera mensagem de resposta', async () => {
    // A decisão que sustenta o desempenho da fronteira. Se cada `setBlock` esperasse confirmação,
    // uma construção de 20.000 blocos viraria 20.000 idas e voltas — por um valor de retorno que
    // quase nenhum mod lê.
    const [ladoWorker, ladoHost] = parDePortas();
    const enviadasAoWorker: any[] = [];
    const original = ladoHost.postMessage;
    ladoHost.postMessage = (m: any) => { enviadasAoWorker.push(m); original(m); };

    instalarNucleo(ladoWorker);
    const ponte = new PonteDeMods(ladoHost, hostFalso(), {
      aoCarregar: () => {}, aoFalhar: () => {}, aoRelatarHandlers: () => {},
      aoRegistrarLog: () => {}, aoDescarregar: () => {}, aoMorrer: () => {},
    });

    ponte.carregar('m1', [{ key: 'main', code: `api.on('tick', () => { api.world.setBlock(1, 2, 3, 'pedra'); });` }], CONSTANTES);
    await assentar();
    enviadasAoWorker.length = 0;

    ponte.despachar('m1', 'tick', {});
    await assentar();
    await assentar();

    expect(enviadasAoWorker.filter((m) => m.t === 'resposta')).toEqual([]);
  });

  it('escrita chega ao host mesmo sem resposta', async () => {
    // Sem esta verificação, "não responder" seria satisfeito por não fazer nada.
    const escritos: unknown[][] = [];
    const { ponte } = montar({ 'world.setBlock': (...args: unknown[]) => { escritos.push(args); return true; } });

    ponte.carregar('m1', [{ key: 'main', code: `api.on('tick', () => { api.world.setBlock(7, 8, 9, 'pedra'); });` }], CONSTANTES);
    await assentar();
    ponte.despachar('m1', 'tick', {});
    await assentar();

    expect(escritos[0]).toEqual([7, 8, 9, 'pedra']);
  });
});

describe('o que NÃO atravessa a fronteira', () => {
  it('CRÍTICO: `api.storage` vive no worker e não gera chamada nenhuma', async () => {
    // O mod usa `storage` dentro de `tick`, ou seja, sessenta vezes por segundo. Uma viagem por
    // acesso seria o caminho mais rápido para tornar a fronteira insuportável — e o estado não tem
    // um único leitor deste lado.
    const chamados: string[] = [];
    const [ladoWorker, ladoHost] = parDePortas();
    instalarNucleo(ladoWorker);
    const host = hostFalso();
    const ponte = new PonteDeMods(ladoHost, host, {
      aoCarregar: () => {}, aoFalhar: () => {}, aoRelatarHandlers: () => {},
      aoRegistrarLog: () => {},
    }, new Proxy({}, {
      get: (_t, nome: string) => { chamados.push(nome); return () => undefined; },
      has: () => true,
    }) as any);

    ponte.carregar('m1', [{
      key: 'main',
      code: `
        api.on('tick', () => {
          api.storage.set('n', (api.storage.get('n') || 0) + 1);
          api.ui.toast('n=' + api.storage.get('n'));
        });
      `,
    }], CONSTANTES);
    await assentar();
    ponte.despachar('m1', 'tick', {});
    ponte.despachar('m1', 'tick', {});
    await assentar();
    await assentar();

    expect(chamados.filter((c) => c.startsWith('storage.'))).toEqual([]);
  });

  it('o estado do storage sobrevive entre eventos, do lado de lá', async () => {
    const { ponte, host } = montar();
    ponte.carregar('m1', [{
      key: 'main',
      code: `
        api.on('tick', () => {
          const n = (api.storage.get('n') || 0) + 1;
          api.storage.set('n', n);
          api.ui.toast('n=' + n);
        });
      `,
    }], CONSTANTES);
    await assentar();
    ponte.despachar('m1', 'tick', {});
    ponte.despachar('m1', 'tick', {});
    ponte.despachar('m1', 'tick', {});
    await assentar();
    await assentar();

    expect(host.toasts).toEqual(['n=1', 'n=2', 'n=3']);
  });
});

describe('erro de handler volta para quem conta', () => {
  it('CRÍTICO: exceção síncrona no handler é relatada', async () => {
    const { ponte, eventos } = montar();
    ponte.carregar('m1', [{ key: 'main', code: `api.on('tick', () => { throw new Error('boom'); });` }], CONSTANTES);
    await assentar();
    ponte.despachar('m1', 'tick', {});
    await assentar();

    expect(eventos.falhas[0]).toMatchObject({ modId: 'm1', scriptKey: 'main' });
    expect(eventos.falhas[0].erro).toContain('boom');
  });

  it('CRÍTICO: erro DEPOIS de um `await` também é relatado', async () => {
    // Sem isto, a rejeição sairia como não tratada **dentro do worker** — onde ninguém está
    // olhando, e de onde nem o console do jogador enxerga. O script erraria para sempre em
    // silêncio absoluto.
    const { ponte, eventos } = montar();
    ponte.carregar('m1', [{
      key: 'main',
      code: `api.on('tick', async () => { await api.time.ofDay(); throw new Error('tardio'); });`,
    }], CONSTANTES);
    await assentar();
    ponte.despachar('m1', 'tick', {});
    await assentar();
    await assentar();

    expect(eventos.falhas.some((f) => f.erro.includes('tardio'))).toBe(true);
  });

  it('script desligado pelo host para de ser chamado', async () => {
    // A contagem de erros e o limite continuam do lado de cá, porque é lá que estão o log e a
    // redação de segredos. O worker só precisa saber de quem parar de chamar.
    const { ponte, host } = montar();
    ponte.carregar('m1', [{ key: 'main', code: `api.on('tick', () => api.ui.toast('vivo'));` }], CONSTANTES);
    await assentar();

    ponte.despachar('m1', 'tick', {});
    await assentar();
    ponte.desligarScript('m1', 'main');
    await assentar();
    ponte.despachar('m1', 'tick', {});
    await assentar();

    expect(host.toasts).toEqual(['vivo']);
  });
});

describe('o log passa pelo lado que conhece o cofre', () => {
  it('CRÍTICO: `api.console.log` chega ao host para ser redigido', async () => {
    // A redação de segredos (seção 52) acontece ao GRAVAR, do lado que conhece o cofre. Se o log
    // fosse formatado no worker, o valor da chave de API teria que viajar até lá em texto para ser
    // mascarado — ou, pior, sairia sem máscara.
    const { ponte, eventos } = montar();
    ponte.carregar('m1', [{ key: 'main', code: `api.console.log('oi', 42);` }], CONSTANTES);
    await assentar();

    expect(eventos.logs[0]).toMatchObject({ modId: 'm1', nivel: 'log' });
    expect(eventos.logs[0].args).toEqual(['oi', 42]);
  });
});

describe('o protocolo e a ponte não saem de sincronia', () => {
  it('CRÍTICO: TODO membro declarado existe na API do mod', () => {
    // O buraco de fiação mais provável desta arquitetura: acrescentar um membro em `MEMBROS_DA_API`
    // e não existir do outro lado. Devolver `undefined` em silêncio faria o mod receber um valor
    // vazio e seguir em frente, com o defeito aparecendo três passos adiante.
    //
    // Este teste ficou possível — e muito mais forte — depois que a ponte passou a delegar à
    // `buildModAPI` em vez de reimplementar cada membro num `switch`. Com duas implementações, o
    // máximo que dava para exigir era "falhe ruidosamente"; com uma, dá para exigir que **nada
    // falte**.
    const { api } = montar();
    const faltando = Object.keys(MEMBROS_DA_API).filter((caminho) => {
      if (caminho.startsWith('console.')) return false; // desviado de propósito, para a redação
      const [grupo, nome] = caminho.split('.');
      return typeof (api as any)[grupo]?.[nome] !== 'function';
    });
    expect(faltando).toEqual([]);
  });

  it('CRÍTICO: membro inventado pelo worker é recusado, não executado', () => {
    // A ponte resolve um caminho dentro de um objeto. Sem a conferência contra o protocolo,
    // `{ metodo: 'storage.set' }` — ou pior, `{ metodo: 'constructor' }` — passaria a ser
    // executável a partir de uma mensagem.
    const { ponte } = montar();
    expect(() => (ponte as any).executar('m1', 'constructor', [])).toThrow(/desconhecido/);
    expect(() => (ponte as any).executar('m1', 'on', [])).toThrow(/desconhecido/);
  });

  it('a lista de globais a apagar cobre o que importa de verdade', () => {
    // `indexedDB` é o mais grave: é onde moram os mundos salvos e o cofre de chaves, na mesma
    // origem. `fetch` é o caminho de saída. Sem os dois, o reino vazio não é vazio.
    for (const critico of ['fetch', 'indexedDB', 'XMLHttpRequest', 'WebSocket', 'importScripts']) {
      expect(GLOBAIS_A_APAGAR).toContain(critico);
    }
  });
});

describe('orçamento de chamadas por quadro (item 1385)', () => {
  // Enquanto os scripts rodavam no thread principal, a contenção era `TICK_BUDGET_MS`. Com eles no
  // Worker, esse relógio deixou de medir o que o nome promete: mede o custo de **enfileirar**
  // mensagens, que é quase nada. O mod já não trava o quadro, e ganhou uma forma nova de fazer
  // estrago — inundar a ponte, porque cada chamada atendida roda aqui.

  it('CRÍTICO: passado o teto, a chamada é recusada', () => {
    const { ponte } = montar();
    for (let i = 0; i < CHAMADAS_POR_QUADRO; i++) {
      expect(() => (ponte as any).executar('m1', 'time.ofDay', [])).not.toThrow();
    }
    expect(() => (ponte as any).executar('m1', 'time.ofDay', [])).toThrow(/orçamento/i);
  });

  it('CRÍTICO: o quadro seguinte devolve o orçamento cheio', () => {
    // Estourar não desliga o mod. Um pico isolado não deve punir um mod que costuma ser barato — é
    // a mesma regra do orçamento de blocos.
    const { ponte } = montar();
    for (let i = 0; i <= CHAMADAS_POR_QUADRO; i++) {
      try { (ponte as any).executar('m1', 'time.ofDay', []); } catch { /* estourou de propósito */ }
    }
    ponte.novoQuadro();
    expect(() => (ponte as any).executar('m1', 'time.ofDay', [])).not.toThrow();
  });

  it('CRÍTICO: o orçamento é POR MOD, não global', () => {
    // Global seria um mod caro calando todos os outros — e o autor do mod inocente não teria como
    // descobrir por quê.
    const [ladoWorker, ladoHost] = parDePortas();
    instalarNucleo(ladoWorker);
    const ctxA = new ModContext(emptyModPackage('a', 'A'));
    const ctxB = new ModContext(emptyModPackage('b', 'B'));
    const apis: Record<string, any> = {
      a: buildModAPI(ctxA, hostFalso(), '*'),
      b: buildModAPI(ctxB, hostFalso(), '*'),
    };
    const ponte = new PonteDeMods(ladoHost, (id) => apis[id], {
      aoCarregar: () => {}, aoFalhar: () => {}, aoRelatarHandlers: () => {},
      aoRegistrarLog: () => {}, aoDescarregar: () => {}, aoMorrer: () => {},
    });

    for (let i = 0; i <= CHAMADAS_POR_QUADRO; i++) {
      try { (ponte as any).executar('a', 'time.ofDay', []); } catch { /* o mod "a" estoura */ }
    }
    expect(() => (ponte as any).executar('b', 'time.ofDay', [])).not.toThrow();
  });

  it('avisa UMA vez por quadro, não a cada chamada recusada', () => {
    // Um laço fugido faz milhares de chamadas. Um aviso por chamada encheria as 300 linhas de log do
    // mod com a mesma frase e apagaria tudo o que havia de útil antes dela.
    const { ponte, eventos } = montar();
    for (let i = 0; i < CHAMADAS_POR_QUADRO + 50; i++) {
      try { (ponte as any).executar('m1', 'time.ofDay', []); } catch { /* esperado */ }
    }
    expect(eventos.logs.filter((l) => String(l.args[0]).includes('Orçamento')).length).toBe(1);
  });

  it('o log de aviso passa mesmo com o mod estourado', () => {
    // O aviso vem do mesmo caminho que as chamadas recusadas. Se ele fosse cobrado do orçamento —
    // ou barrado por ele — o mod pararia de funcionar sem nada explicando por quê.
    const { ponte, eventos } = montar();
    for (let i = 0; i < CHAMADAS_POR_QUADRO + 5; i++) {
      try { (ponte as any).executar('m1', 'time.ofDay', []); } catch { /* esperado */ }
    }
    (ponte as any).executar('m1', 'console.log', ['ainda falo']);
    expect(eventos.logs.some((l) => l.args[0] === 'ainda falo')).toBe(true);
  });
});
