import { describe, it, expect, beforeEach, vi } from 'vitest';
import { B } from '../../src/world/blocks';
import { MOD_EVENTS, MAX_SCRIPT_ERRORS, ModHostBridge } from '../../src/mods/ModAPI';
import { ModRuntime } from '../../src/mods/ModRuntime';
import { MOD_API_REFERENCE } from '../../src/mods/ModAPIReference';
import { ModPackage, ModScript, emptyModPackage } from '../../src/mods/ModTypes';

/** Host de teste: registra tudo que o mod pediu, para as asserções olharem. */
function fakeHost() {
  const blocks = new Map<string, number>();
  const chamadas = { toasts: [] as string[], teleports: [] as any[], itens: [] as any[], spawns: [] as any[] };
  let tempo = 0.5;

  const host: ModHostBridge & { chamadas: typeof chamadas; blocks: typeof blocks; setTime(t: number): void } = {
    blocks, chamadas,
    setTime(t) { tempo = t; },
    getBlock: (x, y, z) => blocks.get(`${x},${y},${z}`) ?? B.AIR,
    setBlock: (x, y, z, t) => { blocks.set(`${x},${y},${z}`, t); return true; },
    getGroundY: () => 10,
    spawnEntity: (modId, key, x, y, z) => { chamadas.spawns.push({ modId, key, x, y, z }); return 'e1'; },
    listEntities: () => [],
    damageEntity: () => true,
    playerPosition: () => ({ x: 0, y: 10, z: 0 }),
    teleportPlayer: (x, y, z) => { chamadas.teleports.push({ x, y, z }); },
    playerHealth: () => 100,
    giveItem: (block, count) => { chamadas.itens.push({ block, count }); },
    toast: (m) => { chamadas.toasts.push(m); },
    timeOfDay: () => tempo,
    // Obrigatório na interface, e agora chamado na carga: o runtime pede os valores do `mod.env`
    // para saber quais segredos redigir do log. Guardar a chamada com `?.` desligaria a redação
    // em silêncio num host que esquecesse de implementar — exatamente a falha que ela previne.
    modEnv: () => ({ valores: {}, faltando: [] }),
  };
  return host;
}

function modComScript(code: string, key = 'main'): ModPackage {
  const pkg = emptyModPackage('mod-teste', 'Teste');
  pkg.scripts = [{ key, name: key, code, enabled: true } as ModScript];
  return pkg;
}

describe('ModRuntime — carga de script', () => {
  let host: ReturnType<typeof fakeHost>;
  let rt: ModRuntime;

  beforeEach(() => {
    host = fakeHost();
    rt = new ModRuntime(host);
  });

  it('carrega um script e registra o handler', async () => {
    const r = await rt.loadMod(modComScript(`api.on('tick', () => {});`));
    expect(r[0].ok).toBe(true);
    expect(rt.describe()[0].handlers.tick).toBe(1);
  });

  it('script com erro de sintaxe não derruba a carga — reporta e segue', async () => {
    const r = await rt.loadMod(modComScript(`isto ( não é ) javascript válido`));
    expect(r[0].ok).toBe(false);
    expect(r[0].error).toBeTruthy();
    expect(rt.loadedCount).toBe(1); // o mod existe, só o script está desligado
  });

  it('script desabilitado não é compilado', async () => {
    const pkg = modComScript(`api.on('tick', () => {});`);
    pkg.scripts![0].enabled = false;
    await rt.loadMod(pkg);
    expect(rt.describe()[0].handlers.tick).toBeUndefined();
  });

  it('recarregar não duplica handlers', async () => {
    const pkg = modComScript(`api.on('tick', () => {});`);
    await rt.loadMod(pkg);
    await rt.loadMod(pkg);
    await rt.loadMod(pkg);
    expect(rt.describe()[0].handlers.tick).toBe(1);
  });

  it('dispara load ao carregar e unload ao descarregar', async () => {
    await rt.loadMod(modComScript(`
      api.on('load', () => api.ui.toast('carregou'));
      api.on('unload', () => api.ui.toast('descarregou'));
    `));
    expect(host.chamadas.toasts).toContain('carregou');

    rt.unloadMod('mod-teste');
    expect(host.chamadas.toasts).toContain('descarregou');
  });

  it('recarregar um script só não mexe nos outros', async () => {
    const pkg = emptyModPackage('mod-teste', 'Teste');
    pkg.scripts = [
      { key: 'a', name: 'a', code: `api.on('tick', () => {});`, enabled: true },
      { key: 'b', name: 'b', code: `api.on('tick', () => {});`, enabled: true },
    ];
    await rt.loadMod(pkg);
    expect(rt.describe()[0].handlers.tick).toBe(2);

    await rt.reloadScript('mod-teste', 'a');
    expect(rt.describe()[0].handlers.tick).toBe(2);
  });
});

describe('ModRuntime — isolamento de erro', () => {
  let host: ReturnType<typeof fakeHost>;
  let rt: ModRuntime;

  beforeEach(() => { host = fakeHost(); rt = new ModRuntime(host); });

  it('CRÍTICO: exceção num handler não escapa para o chamador', async () => {
    await rt.loadMod(modComScript(`api.on('tick', () => { throw new Error('boom'); });`));
    expect(() => rt.tickAll(0.016)).not.toThrow();
  });

  it('CRÍTICO: um mod que falha não impede o outro de rodar', async () => {
    const ruim = modComScript(`api.on('tick', () => { throw new Error('boom'); });`);
    ruim.id = 'mod-ruim';

    const bom = modComScript(`api.on('tick', () => api.ui.toast('ok'));`);
    bom.id = 'mod-bom';

    await rt.loadMod(ruim);
    await rt.loadMod(bom);
    rt.tickAll(0.016);

    expect(host.chamadas.toasts).toContain('ok');
  });

  it(`script é desligado após ${MAX_SCRIPT_ERRORS} erros`, async () => {
    const desligados: string[] = [];
    rt.onScriptDisabled = (_m, key) => desligados.push(key);

    await rt.loadMod(modComScript(`api.on('tick', () => { throw new Error('boom'); });`));
    for (let i = 0; i < MAX_SCRIPT_ERRORS + 2; i++) rt.tickAll(0.016);

    expect(desligados).toContain('main');
    expect(rt.describe()[0].scripts[0].enabled).toBe(false);
    expect(rt.describe()[0].scripts[0].disabledReason).toContain('boom');
  });

  it('script desligado para de ser chamado', async () => {
    let chamadas = 0;
    const host2 = fakeHost();
    host2.toast = () => { chamadas++; };
    const rt2 = new ModRuntime(host2);

    rt2.loadMod(modComScript(`api.on('tick', () => { api.ui.toast('x'); throw new Error('boom'); });`));
    for (let i = 0; i < 20; i++) rt2.tickAll(0.016);

    // Parou de contar em MAX_SCRIPT_ERRORS, não chegou a 20.
    expect(chamadas).toBeLessThanOrEqual(MAX_SCRIPT_ERRORS);
  });

  it('o erro fica registrado no log do mod, acessível para autocorreção', async () => {
    await rt.loadMod(modComScript(`api.on('tick', () => { throw new Error('faltou algo'); });`));
    rt.tickAll(0.016);

    const logs = rt.getLogs('mod-teste');
    expect(logs.some((l) => l.level === 'error' && l.message.includes('faltou algo'))).toBe(true);
  });
});

describe('ModRuntime — a superfície é fechada', () => {
  let host: ReturnType<typeof fakeHost>;
  let rt: ModRuntime;
  beforeEach(() => { host = fakeHost(); rt = new ModRuntime(host); });

  it('CRÍTICO: o script não recebe window, fetch nem document', async () => {
    await rt.loadMod(modComScript(`
      api.on('load', () => {
        api.ui.toast('window=' + (typeof window));
        api.ui.toast('fetch=' + (typeof fetch));
        api.ui.toast('document=' + (typeof document));
      });
    `));
    // Em Node esses globais não existem; o que importa é que NÃO são passados como argumento
    // e que o corpo roda em modo estrito. A checagem de verdade é a de atribuição implícita abaixo.
    expect(host.chamadas.toasts.length).toBe(3);
  });

  it('modo estrito impede criar global implícito', async () => {
    const r = await rt.loadMod(modComScript(`variavelSolta = 42;`));
    expect(r[0].ok).toBe(false);
    expect((globalThis as any).variavelSolta).toBeUndefined();
  });

  it('evento desconhecido é recusado com aviso, sem quebrar', async () => {
    await rt.loadMod(modComScript(`api.on('naoExiste', () => {});`));
    const logs = rt.getLogs('mod-teste');
    expect(logs.some((l) => l.message.includes('Evento desconhecido'))).toBe(true);
  });

  it('api.on sem função é recusado', async () => {
    await rt.loadMod(modComScript(`api.on('tick', 'isto não é função');`));
    expect(rt.describe()[0].handlers.tick).toBeUndefined();
  });
});

describe('ModRuntime — orçamento', () => {
  let host: ReturnType<typeof fakeHost>;
  let rt: ModRuntime;
  beforeEach(() => { host = fakeHost(); rt = new ModRuntime(host); });

  it('laço sem limite para de escrever ao estourar o orçamento de blocos', async () => {
    await rt.loadMod(modComScript(`
      api.on('load', () => {
        for (let i = 0; i < 100000; i++) api.world.setBlock(i, 0, 0, api.B.STONE);
      });
    `));
    // Escreveu, mas parou bem antes das 100 mil.
    expect(host.blocks.size).toBeGreaterThan(0);
    expect(host.blocks.size).toBeLessThanOrEqual(20_000);
  });

  it('o orçamento recarrega entre chamadas', async () => {
    await rt.loadMod(modComScript(`
      let n = 0;
      api.on('tick', () => { api.world.setBlock(n++, 0, 0, api.B.STONE); });
    `));
    rt.tickAll(0.016);
    rt.tickAll(0.016);
    expect(host.blocks.size).toBe(2);
  });
});

describe('ModRuntime — API funcional', () => {
  let host: ReturnType<typeof fakeHost>;
  let rt: ModRuntime;
  beforeEach(() => { host = fakeHost(); rt = new ModRuntime(host); });

  it('setBlock aceita id, nome da paleta e chave do mod', async () => {
    const pkg = modComScript(`
      api.on('load', () => {
        api.world.setBlock(0, 0, 0, api.B.STONE);
        api.world.setBlock(1, 0, 0, 'pedra');
        api.world.setBlock(2, 0, 0, 'cristal');
      });
    `);
    pkg.blocks = [{ key: 'cristal', name: 'Cristal', blockId: 64, topColor: 0 }];
    await rt.loadMod(pkg);

    expect(host.blocks.get('0,0,0')).toBe(B.STONE);
    expect(host.blocks.get('1,0,0')).toBe(B.STONE);
    expect(host.blocks.get('2,0,0')).toBe(64);
  });

  it('fillBox devolve quantos blocos colocou, e oco poupa o miolo', async () => {
    await rt.loadMod(modComScript(`
      api.on('load', () => {
        const cheio = api.world.fillBox(0,0,0, 2,2,2, api.B.STONE, false);
        const oco   = api.world.fillBox(10,0,0, 12,2,2, api.B.STONE, true);
        api.ui.toast(cheio + '/' + oco);
      });
    `));
    expect(host.chamadas.toasts[0]).toBe('27/26');
  });

  it('blocos escritos são reportados com o mod responsável', async () => {
    const recebidos: { modId: string; n: number }[] = [];
    rt.onBlocksChanged = (modId, changes) => recebidos.push({ modId, n: changes.length });

    await rt.loadMod(modComScript(`api.on('load', () => api.world.fillBox(0,0,0, 1,1,1, api.B.STONE));`));

    expect(recebidos[0].modId).toBe('mod-teste');
    expect(recebidos[0].n).toBe(8);
  });

  it('api.storage isola o estado por mod e sobrevive entre eventos', async () => {
    await rt.loadMod(modComScript(`
      api.on('load', () => api.storage.set('n', 1));
      api.on('tick', () => {
        api.storage.set('n', api.storage.get('n') + 1);
        api.ui.toast('n=' + api.storage.get('n'));
      });
    `));
    rt.tickAll(0.016);
    rt.tickAll(0.016);
    expect(host.chamadas.toasts).toEqual(['n=2', 'n=3']);
  });

  it('api.time reflete a hora do host', async () => {
    host.setTime(0.9);
    await rt.loadMod(modComScript(`api.on('load', () => api.ui.toast('noite=' + api.time.isNight()));`));
    expect(host.chamadas.toasts[0]).toBe('noite=true');
  });

  it('eventos recebem o payload documentado', async () => {
    await rt.loadMod(modComScript(`
      api.on('blockBroken', (p) => api.ui.toast(p.x + ',' + p.y + ',' + p.z + ',' + p.block));
    `));
    rt.dispatch('blockBroken', { x: 1, y: 2, z: 3, block: 7 });
    expect(host.chamadas.toasts[0]).toBe('1,2,3,7');
  });

  it('spawn de entidade passa o mod correto', async () => {
    await rt.loadMod(modComScript(`api.on('load', () => api.entities.spawn('guardiao', 1, 2, 3));`));
    expect(host.chamadas.spawns[0]).toMatchObject({ modId: 'mod-teste', key: 'guardiao' });
  });
});

describe('Referência da API — precisa acompanhar o código', () => {
  it('todo evento implementado aparece na referência entregue ao agente', async () => {
    for (const evento of MOD_EVENTS) {
      expect(
        (MOD_API_REFERENCE.eventos as Record<string, unknown>)[evento],
        `o evento "${evento}" existe no runtime mas não está documentado para a IA`,
      ).toBeDefined();
    }
  });

  it('a referência não promete evento que não existe', async () => {
    for (const documentado of Object.keys(MOD_API_REFERENCE.eventos)) {
      expect(MOD_EVENTS, `"${documentado}" está documentado mas não existe`).toContain(documentado as any);
    }
  });

  it('os exemplos da referência realmente compilam e rodam', async () => {
    const host2 = fakeHost();
    const rt2 = new ModRuntime(host2);
    for (const [nome, codigo] of Object.entries(MOD_API_REFERENCE.exemplos)) {
      const r = await rt2.loadMod(modComScript(codigo, nome));
      expect(r[0].ok, `o exemplo "${nome}" não compila: ${r[0].error}`).toBe(true);
    }
  });

  it('a referência declara o que NÃO existe, que é o que mais confunde o agente', async () => {
    const texto = MOD_API_REFERENCE.naoExiste.join(' ');
    for (const proibido of ['fetch', 'setTimeout', 'window', 'import']) {
      expect(texto).toContain(proibido);
    }
  });
});

describe('mods assíncronos — o pré-requisito do Worker (item 1251)', () => {
  // ## Por que o corpo do script virou `async` antes de existir Worker nenhum
  //
  // O sandbox de verdade (item 358) é um Web Worker, e um Worker só conversa por `postMessage`.
  // Toda leitura do mundo vira ida e volta assíncrona no dia em que o script sair deste reino.
  //
  // Trocar o tipo de retorno naquele dia quebraria **todo mod já escrito**, de uma vez. Tornar o
  // corpo `async` desde já custa nada hoje — `await` sobre um valor que não é promessa devolve o
  // próprio valor — e faz os dois mundos serem válidos ao mesmo tempo. É a única migração sem um
  // dia de ruptura.
  let host: ReturnType<typeof fakeHost>;
  let rt: ModRuntime;

  beforeEach(() => {
    host = fakeHost();
    rt = new ModRuntime(host);
  });

  /** Deixa as promessas pendentes resolverem antes de olhar o resultado. */
  const assentar = () => new Promise((r) => setTimeout(r, 0));

  it('CRÍTICO: `await` já é válido no corpo do mod, com a API síncrona de hoje', () => {
    // O teste que prova que a migração é indolor: este script está escrito no formato do futuro e
    // roda no presente.
    return rt.loadMod(modComScript(`
      const bloco = await api.world.getBlock(1, 10, 1);
      api.console.log('bloco: ' + bloco);
    `)).then((r) => {
      expect(r[0].ok, r[0].error).toBe(true);
      expect(rt.getLogs('mod-teste', 5).some((l) => l.message.includes('bloco:'))).toBe(true);
    });
  });

  it('CRÍTICO: erro DEPOIS de um `await` é contabilizado, não perdido', () => {
    // O risco que o corpo `async` introduz. O `try/catch` do despacho só pega o que estoura antes
    // do primeiro `await`; o resto vira promessa rejeitada. Sem tratamento, seria uma rejeição não
    // tratada no console — o script continuaria ligado, errando para sempre, e o contador que o
    // desliga nunca subiria.
    return rt.loadMod(modComScript(`
      api.on('tick', async () => {
        await api.world.getBlock(0, 0, 0);
        throw new Error('estourei depois do await');
      });
    `)).then(async () => {
      for (let i = 0; i < MAX_SCRIPT_ERRORS + 2; i++) {
        rt.dispatch('blockPlaced' as any, {});
        rt.tickAll(0.016);
        await assentar();
      }
      const logs = rt.getLogs('mod-teste', 20);
      expect(logs.some((l) => l.level === 'error')).toBe(true);
    });
  });

  it('CRÍTICO: script que estoura DEPOIS do await acaba desligado', () => {
    // O ponto todo do teste anterior levado até o fim: contabilizar sem desligar deixaria um mod
    // quebrado consumindo tempo de frame para sempre.
    return rt.loadMod(modComScript(`
      api.on('tick', async () => {
        await 0;
        throw new Error('sempre falho');
      });
    `)).then(async () => {
      for (let i = 0; i < MAX_SCRIPT_ERRORS + 3; i++) {
        rt.tickAll(0.016);
        await assentar();
      }
      // Um script desligado para de acumular erros novos: o total estaciona.
      const antes = rt.getLogs('mod-teste', 50).length;
      rt.tickAll(0.016);
      await assentar();
      expect(rt.getLogs('mod-teste', 50).length).toBe(antes);
    });
  });

  it('CRÍTICO: bloco escrito DEPOIS do await chega ao mundo', () => {
    // A drenagem acontecia uma vez, logo após o handler. Com handler assíncrono, o que ele escreve
    // depois do `await` chegaria tarde demais e ficaria preso no buffer — bloco colocado no jogo,
    // ausente do save.
    const escritos: any[] = [];
    rt.onBlocksChanged = (_id, changes) => escritos.push(...changes);
    return rt.loadMod(modComScript(`
      api.on('tick', async () => {
        await 0;
        api.world.setBlock(5, 11, 5, 'pedra');
      });
    `)).then(async () => {
      rt.tickAll(0.016);
      await assentar();
      expect(escritos.length).toBeGreaterThan(0);
    });
  });

  it('CRÍTICO: o despacho NÃO espera o mod terminar', () => {
    // Quem chama `dispatch` é o laço de renderização. Esperar entregaria a cada mod o poder de
    // congelar o jogo — e um mod que nunca resolve travaria a aba inteira.
    return rt.loadMod(modComScript(`
      api.on('tick', () => new Promise(() => {}));
    `)).then(() => {
      const t0 = Date.now();
      rt.tickAll(0.016);
      expect(Date.now() - t0).toBeLessThan(50);
    });
  });

  it('a carga espera o corpo terminar antes de reportar sucesso', async () => {
    // Sem o `await` na compilação, um script que falha depois do primeiro `await` seria reportado
    // como carregado com sucesso, e o agente diria ao jogador que está tudo certo.
    const r = await rt.loadMod(modComScript(`
      await 0;
      throw new Error('falho ao carregar, mas só depois do await');
    `));
    expect(r[0].ok).toBe(false);
    expect(r[0].error).toMatch(/falho ao carregar/);
  });
});

describe('reentrância de tick assíncrono (item 1251)', () => {
  it('CRÍTICO: um `tick` que ainda não terminou não é chamado de novo', async () => {
    // Um `tick` assíncrono mais lento que um frame seria reentrado 60 vezes por segundo, e cada
    // entrada empilharia mais uma. Em segundos há centenas de execuções do mesmo handler
    // disputando o mesmo `api.storage` — e o sintoma não é lentidão, é o estado do mod embaralhado
    // por si mesmo.
    const host = fakeHost();
    const rt = new ModRuntime(host);
    await rt.loadMod(modComScript(`
      let entradas = 0;
      let solta;
      api.on('tick', async () => {
        entradas++;
        api.ui.toast('entrada ' + entradas);
        await new Promise((r) => { solta = r; });
      });
    `));

    for (let i = 0; i < 30; i++) rt.tickAll(0.016);
    expect(host.chamadas.toasts.filter((t) => t.startsWith('entrada'))).toEqual(['entrada 1']);
  });

  it('terminada a volta, o handler volta a ser chamado', async () => {
    // Sem isto, "consertar" a reentrância seria trivial e inútil: bastaria nunca chamar de novo, e
    // o primeiro `await` de um mod desligaria o `tick` dele para sempre.
    const host = fakeHost();
    const rt = new ModRuntime(host);
    await rt.loadMod(modComScript(`
      api.on('tick', async () => { await 0; api.ui.toast('voltei'); });
    `));

    for (let i = 0; i < 3; i++) {
      rt.tickAll(0.016);
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(host.chamadas.toasts.filter((t) => t === 'voltei').length).toBeGreaterThan(1);
  });
});

describe('a referência ensina o formato que sobrevive ao Worker', () => {
  it('CRÍTICO: a referência manda usar `await` nas leituras', () => {
    // A referência é o que o agente lê antes de escrever. Se ela não pedir `await`, todo mod novo
    // nasce no formato antigo — e a migração que este trabalho existe para evitar volta a ser
    // necessária, com mais mods para reescrever.
    expect(MOD_API_REFERENCE.resumo).toMatch(/await/);
  });

  it('pelo menos um exemplo está escrito no formato assíncrono', () => {
    // Texto explicando é menos eficaz que exemplo demonstrando: o agente copia o exemplo.
    const exemplos = Object.values(MOD_API_REFERENCE.exemplos).join('\n');
    expect(exemplos).toMatch(/async \(/);
    expect(exemplos).toMatch(/await api\./);
  });
});
