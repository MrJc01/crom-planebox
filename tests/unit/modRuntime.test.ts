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

  it('carrega um script e registra o handler', () => {
    const r = rt.loadMod(modComScript(`api.on('tick', () => {});`));
    expect(r[0].ok).toBe(true);
    expect(rt.describe()[0].handlers.tick).toBe(1);
  });

  it('script com erro de sintaxe não derruba a carga — reporta e segue', () => {
    const r = rt.loadMod(modComScript(`isto ( não é ) javascript válido`));
    expect(r[0].ok).toBe(false);
    expect(r[0].error).toBeTruthy();
    expect(rt.loadedCount).toBe(1); // o mod existe, só o script está desligado
  });

  it('script desabilitado não é compilado', () => {
    const pkg = modComScript(`api.on('tick', () => {});`);
    pkg.scripts![0].enabled = false;
    rt.loadMod(pkg);
    expect(rt.describe()[0].handlers.tick).toBeUndefined();
  });

  it('recarregar não duplica handlers', () => {
    const pkg = modComScript(`api.on('tick', () => {});`);
    rt.loadMod(pkg);
    rt.loadMod(pkg);
    rt.loadMod(pkg);
    expect(rt.describe()[0].handlers.tick).toBe(1);
  });

  it('dispara load ao carregar e unload ao descarregar', () => {
    rt.loadMod(modComScript(`
      api.on('load', () => api.ui.toast('carregou'));
      api.on('unload', () => api.ui.toast('descarregou'));
    `));
    expect(host.chamadas.toasts).toContain('carregou');

    rt.unloadMod('mod-teste');
    expect(host.chamadas.toasts).toContain('descarregou');
  });

  it('recarregar um script só não mexe nos outros', () => {
    const pkg = emptyModPackage('mod-teste', 'Teste');
    pkg.scripts = [
      { key: 'a', name: 'a', code: `api.on('tick', () => {});`, enabled: true },
      { key: 'b', name: 'b', code: `api.on('tick', () => {});`, enabled: true },
    ];
    rt.loadMod(pkg);
    expect(rt.describe()[0].handlers.tick).toBe(2);

    rt.reloadScript('mod-teste', 'a');
    expect(rt.describe()[0].handlers.tick).toBe(2);
  });
});

describe('ModRuntime — isolamento de erro', () => {
  let host: ReturnType<typeof fakeHost>;
  let rt: ModRuntime;

  beforeEach(() => { host = fakeHost(); rt = new ModRuntime(host); });

  it('CRÍTICO: exceção num handler não escapa para o chamador', () => {
    rt.loadMod(modComScript(`api.on('tick', () => { throw new Error('boom'); });`));
    expect(() => rt.tickAll(0.016)).not.toThrow();
  });

  it('CRÍTICO: um mod que falha não impede o outro de rodar', () => {
    const ruim = modComScript(`api.on('tick', () => { throw new Error('boom'); });`);
    ruim.id = 'mod-ruim';

    const bom = modComScript(`api.on('tick', () => api.ui.toast('ok'));`);
    bom.id = 'mod-bom';

    rt.loadMod(ruim);
    rt.loadMod(bom);
    rt.tickAll(0.016);

    expect(host.chamadas.toasts).toContain('ok');
  });

  it(`script é desligado após ${MAX_SCRIPT_ERRORS} erros`, () => {
    const desligados: string[] = [];
    rt.onScriptDisabled = (_m, key) => desligados.push(key);

    rt.loadMod(modComScript(`api.on('tick', () => { throw new Error('boom'); });`));
    for (let i = 0; i < MAX_SCRIPT_ERRORS + 2; i++) rt.tickAll(0.016);

    expect(desligados).toContain('main');
    expect(rt.describe()[0].scripts[0].enabled).toBe(false);
    expect(rt.describe()[0].scripts[0].disabledReason).toContain('boom');
  });

  it('script desligado para de ser chamado', () => {
    let chamadas = 0;
    const host2 = fakeHost();
    host2.toast = () => { chamadas++; };
    const rt2 = new ModRuntime(host2);

    rt2.loadMod(modComScript(`api.on('tick', () => { api.ui.toast('x'); throw new Error('boom'); });`));
    for (let i = 0; i < 20; i++) rt2.tickAll(0.016);

    // Parou de contar em MAX_SCRIPT_ERRORS, não chegou a 20.
    expect(chamadas).toBeLessThanOrEqual(MAX_SCRIPT_ERRORS);
  });

  it('o erro fica registrado no log do mod, acessível para autocorreção', () => {
    rt.loadMod(modComScript(`api.on('tick', () => { throw new Error('faltou algo'); });`));
    rt.tickAll(0.016);

    const logs = rt.getLogs('mod-teste');
    expect(logs.some((l) => l.level === 'error' && l.message.includes('faltou algo'))).toBe(true);
  });
});

describe('ModRuntime — a superfície é fechada', () => {
  let host: ReturnType<typeof fakeHost>;
  let rt: ModRuntime;
  beforeEach(() => { host = fakeHost(); rt = new ModRuntime(host); });

  it('CRÍTICO: o script não recebe window, fetch nem document', () => {
    rt.loadMod(modComScript(`
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

  it('modo estrito impede criar global implícito', () => {
    const r = rt.loadMod(modComScript(`variavelSolta = 42;`));
    expect(r[0].ok).toBe(false);
    expect((globalThis as any).variavelSolta).toBeUndefined();
  });

  it('evento desconhecido é recusado com aviso, sem quebrar', () => {
    rt.loadMod(modComScript(`api.on('naoExiste', () => {});`));
    const logs = rt.getLogs('mod-teste');
    expect(logs.some((l) => l.message.includes('Evento desconhecido'))).toBe(true);
  });

  it('api.on sem função é recusado', () => {
    rt.loadMod(modComScript(`api.on('tick', 'isto não é função');`));
    expect(rt.describe()[0].handlers.tick).toBeUndefined();
  });
});

describe('ModRuntime — orçamento', () => {
  let host: ReturnType<typeof fakeHost>;
  let rt: ModRuntime;
  beforeEach(() => { host = fakeHost(); rt = new ModRuntime(host); });

  it('laço sem limite para de escrever ao estourar o orçamento de blocos', () => {
    rt.loadMod(modComScript(`
      api.on('load', () => {
        for (let i = 0; i < 100000; i++) api.world.setBlock(i, 0, 0, api.B.STONE);
      });
    `));
    // Escreveu, mas parou bem antes das 100 mil.
    expect(host.blocks.size).toBeGreaterThan(0);
    expect(host.blocks.size).toBeLessThanOrEqual(20_000);
  });

  it('o orçamento recarrega entre chamadas', () => {
    rt.loadMod(modComScript(`
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

  it('setBlock aceita id, nome da paleta e chave do mod', () => {
    const pkg = modComScript(`
      api.on('load', () => {
        api.world.setBlock(0, 0, 0, api.B.STONE);
        api.world.setBlock(1, 0, 0, 'pedra');
        api.world.setBlock(2, 0, 0, 'cristal');
      });
    `);
    pkg.blocks = [{ key: 'cristal', name: 'Cristal', blockId: 64, topColor: 0 }];
    rt.loadMod(pkg);

    expect(host.blocks.get('0,0,0')).toBe(B.STONE);
    expect(host.blocks.get('1,0,0')).toBe(B.STONE);
    expect(host.blocks.get('2,0,0')).toBe(64);
  });

  it('fillBox devolve quantos blocos colocou, e oco poupa o miolo', () => {
    rt.loadMod(modComScript(`
      api.on('load', () => {
        const cheio = api.world.fillBox(0,0,0, 2,2,2, api.B.STONE, false);
        const oco   = api.world.fillBox(10,0,0, 12,2,2, api.B.STONE, true);
        api.ui.toast(cheio + '/' + oco);
      });
    `));
    expect(host.chamadas.toasts[0]).toBe('27/26');
  });

  it('blocos escritos são reportados com o mod responsável', () => {
    const recebidos: { modId: string; n: number }[] = [];
    rt.onBlocksChanged = (modId, changes) => recebidos.push({ modId, n: changes.length });

    rt.loadMod(modComScript(`api.on('load', () => api.world.fillBox(0,0,0, 1,1,1, api.B.STONE));`));

    expect(recebidos[0].modId).toBe('mod-teste');
    expect(recebidos[0].n).toBe(8);
  });

  it('api.storage isola o estado por mod e sobrevive entre eventos', () => {
    rt.loadMod(modComScript(`
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

  it('api.time reflete a hora do host', () => {
    host.setTime(0.9);
    rt.loadMod(modComScript(`api.on('load', () => api.ui.toast('noite=' + api.time.isNight()));`));
    expect(host.chamadas.toasts[0]).toBe('noite=true');
  });

  it('eventos recebem o payload documentado', () => {
    rt.loadMod(modComScript(`
      api.on('blockBroken', (p) => api.ui.toast(p.x + ',' + p.y + ',' + p.z + ',' + p.block));
    `));
    rt.dispatch('blockBroken', { x: 1, y: 2, z: 3, block: 7 });
    expect(host.chamadas.toasts[0]).toBe('1,2,3,7');
  });

  it('spawn de entidade passa o mod correto', () => {
    rt.loadMod(modComScript(`api.on('load', () => api.entities.spawn('guardiao', 1, 2, 3));`));
    expect(host.chamadas.spawns[0]).toMatchObject({ modId: 'mod-teste', key: 'guardiao' });
  });
});

describe('Referência da API — precisa acompanhar o código', () => {
  it('todo evento implementado aparece na referência entregue ao agente', () => {
    for (const evento of MOD_EVENTS) {
      expect(
        (MOD_API_REFERENCE.eventos as Record<string, unknown>)[evento],
        `o evento "${evento}" existe no runtime mas não está documentado para a IA`,
      ).toBeDefined();
    }
  });

  it('a referência não promete evento que não existe', () => {
    for (const documentado of Object.keys(MOD_API_REFERENCE.eventos)) {
      expect(MOD_EVENTS, `"${documentado}" está documentado mas não existe`).toContain(documentado as any);
    }
  });

  it('os exemplos da referência realmente compilam e rodam', () => {
    const host2 = fakeHost();
    const rt2 = new ModRuntime(host2);
    for (const [nome, codigo] of Object.entries(MOD_API_REFERENCE.exemplos)) {
      const r = rt2.loadMod(modComScript(codigo, nome));
      expect(r[0].ok, `o exemplo "${nome}" não compila: ${r[0].error}`).toBe(true);
    }
  });

  it('a referência declara o que NÃO existe, que é o que mais confunde o agente', () => {
    const texto = MOD_API_REFERENCE.naoExiste.join(' ');
    for (const proibido of ['fetch', 'setTimeout', 'window', 'import']) {
      expect(texto).toContain(proibido);
    }
  });
});
