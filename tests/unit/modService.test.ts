import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModPackage } from '../../src/mods/ModTypes';

/**
 * Repositório falso em memória. O ModService é a camada de efeitos colaterais, então testá-lo
 * de verdade exige substituir só o IndexedDB — a lógica de mod, mundo e entidades continua
 * sendo a real. `__fake` expõe o estado para as asserções e para simular um "reload".
 */
vi.mock('../../src/storage/WorldRepository', () => {
  const state = {
    mods: new Map<string, ModPackage>(),
    entities: new Map<string, any>(),
    blockMods: [] as { x: number; y: number; z: number; blockType: number }[],
    revisions: [] as any[],
    threadMods: new Map<string, string | undefined>(),
  };

  const WorldRepository = {
    async getMods(_worldId: string) {
      return Array.from(state.mods.values()).map((p) => JSON.parse(JSON.stringify(p)));
    },
    async saveMod(_worldId: string, pkg: ModPackage) {
      state.mods.set(pkg.id, JSON.parse(JSON.stringify(pkg)));
    },
    async deleteMod(_worldId: string, modId: string) {
      state.mods.delete(modId);
      for (const [id, e] of state.entities) if (e.modId === modId) state.entities.delete(id);
    },
    async purgeBlocksOfTypes(_worldId: string, blockIds: number[]) {
      const targets = new Set(blockIds);
      const hits = state.blockMods.filter((m) => targets.has(m.blockType));
      state.blockMods = state.blockMods.filter((m) => !targets.has(m.blockType));
      return hits.map((m) => ({ x: m.x, y: m.y, z: m.z }));
    },
    async getModEntityInstances(_worldId: string) {
      return Array.from(state.entities.values());
    },
    async saveModEntityInstance(rec: any) {
      state.entities.set(rec.id, rec);
    },
    async deleteModEntityInstance(_worldId: string, id: string) {
      state.entities.delete(id);
    },
    async saveBlockModBatch(_worldId: string, mods: any[]) {
      state.blockMods.push(...mods);
    },
    // --- Versionamento e vínculo com a sessão de chat ---
    async saveModRevision(_worldId: string, rev: any) {
      state.revisions.push(JSON.parse(JSON.stringify(rev)));
    },
    async getModRevisions(_worldId: string, modId: string) {
      return state.revisions.filter((r) => r.modId === modId).sort((a, b) => b.revision - a.revision);
    },
    async getModRevision(_worldId: string, modId: string, revision: number) {
      return state.revisions.find((r) => r.modId === modId && r.revision === revision);
    },
    async deleteModRevisions(_worldId: string, modId: string) {
      state.revisions = state.revisions.filter((r) => r.modId !== modId);
    },
    async setThreadMod(threadId: string, modId?: string) {
      state.threadMods.set(threadId, modId);
    },
    async getModByThread(_worldId: string, threadId: string) {
      const modId = state.threadMods.get(threadId);
      return modId ? state.mods.get(modId) : undefined;
    },
  };

  return { WorldRepository, __fake: state };
});

import { ModService } from '../../src/mods/ModService';
import { WorldRepository } from '../../src/storage/WorldRepository';
import { BLOCKS, CUSTOM_BLOCK_ID_BASE, getBlockDef, MISSING_BLOCK, resetCustomBlocks } from '../../src/world/blocks';

const fake = (await import('../../src/storage/WorldRepository') as any).__fake as {
  mods: Map<string, ModPackage>;
  entities: Map<string, any>;
  blockMods: { x: number; y: number; z: number; blockType: number }[];
  revisions: any[];
  threadMods: Map<string, string | undefined>;
};

/** Mundo mínimo: só precisa registrar o que foi escrito. */
function fakeWorld() {
  const placed = new Map<string, number>();
  return {
    placed,
    setBlock(x: number, y: number, z: number, t: number) {
      placed.set(`${x},${y},${z}`, t);
      return true;
    },
    getBlock(x: number, y: number, z: number) {
      return placed.get(`${x},${y},${z}`) ?? 0;
    },
  };
}

/** EntitySystem mínimo: devolve um registro com id e posição, como o real. */
function fakeEntitySystem() {
  const created: any[] = [];
  return {
    created,
    createCustomEntity(config: any) {
      const rec = {
        id: `entity-${created.length}`,
        name: config.name,
        pos: { x: config.x, y: config.y, z: config.z },
      };
      created.push({ ...config, id: rec.id });
      return rec;
    },
  };
}

function newService() {
  const world = fakeWorld();
  const entities = fakeEntitySystem();
  const svc = new ModService(world as any, 'mundo-1', entities as any);
  return { svc, world, entities };
}

describe('ModService — criação de conteúdo pela IA', () => {
  beforeEach(() => {
    resetCustomBlocks();
    fake.mods.clear();
    fake.entities.clear();
    fake.blockMods.length = 0;
    fake.revisions.length = 0;
    fake.threadMods.clear();
  });

  it('cria um mod e o persiste', async () => {
    const { svc } = newService();
    const res = await svc.createMod('Reino de Cristal', 'Bioma novo');

    expect(res.ok).toBe(true);
    expect(res.details.modId).toBe('mod-reino_de_cristal');
    expect(fake.mods.has('mod-reino_de_cristal')).toBe(true);
  });

  it('criar duas vezes o mesmo mod não duplica nem apaga o conteúdo existente', async () => {
    const { svc } = newService();
    const { details } = await svc.createMod('Cristal');
    await svc.addBlock(details.modId, { key: 'azul', name: 'Cristal Azul', topColor: '#38bdf8' });

    const segunda = await svc.createMod('Cristal');
    expect(segunda.ok).toBe(true);
    expect(fake.mods.size).toBe(1);
    expect(fake.mods.get(details.modId)!.blocks).toHaveLength(1);
  });

  it('adiciona bloco, registra na hora e salva com id estável', async () => {
    const { svc } = newService();
    const { details } = await svc.createMod('Cristal');
    const res = await svc.addBlock(details.modId, { key: 'azul', name: 'Cristal Azul', topColor: '#38bdf8', opaque: false });

    expect(res.ok).toBe(true);
    expect(res.details.blockId).toBe(CUSTOM_BLOCK_ID_BASE);
    expect(BLOCKS[CUSTOM_BLOCK_ID_BASE].name).toBe('Cristal Azul');
    expect(BLOCKS[CUSTOM_BLOCK_ID_BASE].opaque).toBe(false);
    expect(fake.mods.get(details.modId)!.blocks[0].blockId).toBe(CUSTOM_BLOCK_ID_BASE);
  });

  it('normaliza a chave do bloco e recusa duplicata', async () => {
    const { svc } = newService();
    const { details } = await svc.createMod('Cristal');
    await svc.addBlock(details.modId, { key: 'Cristal Azul', name: 'Cristal Azul', topColor: 0 });
    const dup = await svc.addBlock(details.modId, { key: 'cristal_azul', name: 'Outro', topColor: 0 });

    expect(fake.mods.get(details.modId)!.blocks[0].key).toBe('cristal_azul');
    expect(dup.ok).toBe(false);
    expect(dup.message).toContain('já tem um bloco');
  });

  it('recusa adicionar conteúdo a um mod inexistente com mensagem acionável', async () => {
    const { svc } = newService();
    const res = await svc.addBlock('mod-fantasma', { key: 'x', name: 'X', topColor: 0 });
    expect(res.ok).toBe(false);
    expect(res.message).toContain('create_mod');
  });

  it('adiciona espécie de entidade e recusa a que não tem partes', async () => {
    const { svc } = newService();
    const { details } = await svc.createMod('Bestiário');

    const ok = await svc.addEntity(details.modId, {
      key: 'dragao', name: 'Dragão Dourado',
      parts: [{ offsetX: 0, offsetY: 1, offsetZ: 0, sizeX: 1, sizeY: 1, sizeZ: 2, color: '#eab308' }],
    });
    expect(ok.ok).toBe(true);

    const vazia = await svc.addEntity(details.modId, { key: 'fantasma', name: 'Fantasma', parts: [] });
    expect(vazia.ok).toBe(false);
  });

  it('recusa estrutura que cita bloco inexistente, em vez de carimbar buracos depois', async () => {
    const { svc } = newService();
    const { details } = await svc.createMod('Templos');

    const res = await svc.addStructure(details.modId, {
      key: 'templo', name: 'Templo',
      blocks: [{ dx: 0, dy: 0, dz: 0, block: 'bloco_que_nao_existe' }],
    });

    expect(res.ok).toBe(false);
    expect(res.message).toContain('não existem');
    expect(fake.mods.get(details.modId)!.structures).toHaveLength(0);
  });

  it('aceita estrutura que mistura bloco do mod com bloco da paleta base', async () => {
    const { svc } = newService();
    const { details } = await svc.createMod('Templos');
    await svc.addBlock(details.modId, { key: 'cristal', name: 'Cristal', topColor: 0x38bdf8 });

    const res = await svc.addStructure(details.modId, {
      key: 'altar', name: 'Altar',
      blocks: [
        { dx: 0, dy: 0, dz: 0, block: 'pedra' },
        { dx: 0, dy: 1, dz: 0, block: 'cristal' },
      ],
    });
    expect(res.ok).toBe(true);
  });
});

describe('ModService — colocar conteúdo no mundo e salvar', () => {
  beforeEach(() => {
    resetCustomBlocks();
    fake.mods.clear();
    fake.entities.clear();
    fake.blockMods.length = 0;
    fake.revisions.length = 0;
    fake.threadMods.clear();
  });

  it('carimba a estrutura no mundo e salva os blocos', async () => {
    const { svc, world } = newService();
    const { details } = await svc.createMod('Templos');
    await svc.addBlock(details.modId, { key: 'cristal', name: 'Cristal', topColor: 0x38bdf8 });
    await svc.addStructure(details.modId, {
      key: 'altar', name: 'Altar',
      blocks: [
        { dx: 0, dy: 0, dz: 0, block: 'pedra' },
        { dx: 0, dy: 1, dz: 0, block: 'cristal' },
      ],
    });

    const res = await svc.placeStructure(details.modId, 'altar', 10, 5, -3);

    expect(res.ok).toBe(true);
    expect(world.placed.get('10,5,-3')).toBe(3);
    expect(world.placed.get('10,6,-3')).toBe(CUSTOM_BLOCK_ID_BASE);
    expect(fake.blockMods).toHaveLength(2);
  });

  it('spawna entidade do mod e SALVA a instância no mundo', async () => {
    const { svc, entities } = newService();
    const { details } = await svc.createMod('Bestiário');
    await svc.addEntity(details.modId, {
      key: 'dragao', name: 'Dragão',
      parts: [{ offsetX: 0, offsetY: 1, offsetZ: 0, sizeX: 1, sizeY: 1, sizeZ: 1, color: 0 }],
    });

    const res = await svc.spawnEntity(details.modId, 'dragao', 20, 8, 30);

    expect(res.ok).toBe(true);
    expect(entities.created).toHaveLength(1);
    expect(fake.entities.size).toBe(1);
    const saved = Array.from(fake.entities.values())[0];
    expect(saved).toMatchObject({ modId: details.modId, entityKey: 'dragao', x: 20, y: 8, z: 30 });
  });

  it('notifica onBlocksChanged para o multiplayer P2P retransmitir', async () => {
    const { svc } = newService();
    const seen: any[] = [];
    svc.onBlocksChanged = (m) => seen.push(...m);

    const { details } = await svc.createMod('Templos');
    await svc.addStructure(details.modId, { key: 'p', name: 'P', blocks: [{ dx: 0, dy: 0, dz: 0, block: 'pedra' }] });
    await svc.placeStructure(details.modId, 'p', 0, 0, 0);

    expect(seen).toHaveLength(1);
  });
});

describe('ModService — ciclo completo com reload (o requisito central)', () => {
  beforeEach(() => {
    resetCustomBlocks();
    fake.mods.clear();
    fake.entities.clear();
    fake.blockMods.length = 0;
    fake.revisions.length = 0;
    fake.threadMods.clear();
  });

  it('REGRESSÃO: bloco, estrutura e entidade criados pela IA sobrevivem ao recarregar o mundo', async () => {
    // --- Sessão 1: a IA cria uma modificação inteira -------------------------------------
    const s1 = newService();
    const { details } = await s1.svc.createMod('Reino de Cristal');
    const blocoRes = await s1.svc.addBlock(details.modId, { key: 'cristal', name: 'Cristal Azul', topColor: '#38bdf8' });
    await s1.svc.addEntity(details.modId, {
      key: 'guardiao', name: 'Guardião',
      parts: [{ offsetX: 0, offsetY: 1, offsetZ: 0, sizeX: 1, sizeY: 2, sizeZ: 1, color: '#38bdf8' }],
    });
    await s1.svc.addStructure(details.modId, {
      key: 'torre', name: 'Torre de Cristal',
      blocks: [0, 1, 2].map((dy) => ({ dx: 0, dy, dz: 0, block: 'cristal' })),
    });
    await s1.svc.placeStructure(details.modId, 'torre', 50, 10, 50);
    await s1.svc.spawnEntity(details.modId, 'guardiao', 52, 10, 50);

    const idDoBloco = blocoRes.details.blockId;
    expect(s1.world.placed.get('50,11,50')).toBe(idDoBloco);

    // --- Fecha o navegador: o array global volta ao estado base ---------------------------
    resetCustomBlocks();
    expect(getBlockDef(idDoBloco)).toBe(MISSING_BLOCK);

    // --- Sessão 2: mundo recarregado do zero ---------------------------------------------
    const s2 = newService();
    const summary = await s2.svc.loadForWorld('mundo-1');

    expect(summary.mods).toBe(1);
    expect(summary.blocks).toBe(1);
    expect(summary.entities).toBe(1);

    // O bloco voltou com o MESMO id que o mundo tinha salvo.
    expect(BLOCKS[idDoBloco].name).toBe('Cristal Azul');
    expect(getBlockDef(idDoBloco)).not.toBe(MISSING_BLOCK);

    // A entidade foi recriada na posição salva.
    expect(s2.entities.created).toHaveLength(1);
    expect(s2.entities.created[0]).toMatchObject({ name: 'Guardião', x: 52, z: 50 });

    // E a estrutura continua carimbável, resolvendo a mesma referência simbólica.
    const recarimbo = await s2.svc.placeStructure(details.modId, 'torre', 0, 0, 0);
    expect(recarimbo.ok).toBe(true);
    expect(s2.world.placed.get('0,1,0')).toBe(idDoBloco);
  });

  it('mod desabilitado não é aplicado no load, mas suas definições continuam salvas', async () => {
    const s1 = newService();
    const { details } = await s1.svc.createMod('Cristal');
    const blocoRes = await s1.svc.addBlock(details.modId, { key: 'c', name: 'Cristal', topColor: 0 });
    await s1.svc.setEnabled(details.modId, false);

    resetCustomBlocks();
    const s2 = newService();
    const summary = await s2.svc.loadForWorld('mundo-1');

    expect(summary.mods).toBe(0);
    expect(getBlockDef(blocoRes.details.blockId)).toBe(MISSING_BLOCK);
    expect(s2.svc.getMod(details.modId)!.blocks).toHaveLength(1);

    // Reativar traz o bloco de volta no mesmo id.
    await s2.svc.setEnabled(details.modId, true);
    expect(BLOCKS[blocoRes.details.blockId].name).toBe('Cristal');
  });

  it('remover um mod limpa do mundo os blocos que ele havia colocado', async () => {
    const { svc, world } = newService();
    const { details } = await svc.createMod('Cristal');
    const blocoRes = await svc.addBlock(details.modId, { key: 'c', name: 'Cristal', topColor: 0 });
    await svc.addStructure(details.modId, { key: 't', name: 'T', blocks: [{ dx: 0, dy: 0, dz: 0, block: 'c' }] });
    await svc.placeStructure(details.modId, 't', 7, 7, 7);
    expect(world.placed.get('7,7,7')).toBe(blocoRes.details.blockId);

    const res = await svc.deleteMod(details.modId);

    expect(res.ok).toBe(true);
    expect(res.details.purged).toBe(1);
    expect(world.placed.get('7,7,7')).toBe(0); // virou ar, não ficou id órfão
    expect(fake.mods.size).toBe(0);
    expect(getBlockDef(blocoRes.details.blockId)).toBe(MISSING_BLOCK);
  });
});

describe('ModService — exportar e importar', () => {
  beforeEach(() => {
    resetCustomBlocks();
    fake.mods.clear();
    fake.entities.clear();
    fake.blockMods.length = 0;
    fake.revisions.length = 0;
    fake.threadMods.clear();
  });

  it('exporta JSON portátil e devolve null para mod inexistente', async () => {
    const { svc } = newService();
    const { details } = await svc.createMod('Cristal');
    await svc.addBlock(details.modId, { key: 'c', name: 'Cristal', topColor: 0x38bdf8 });

    const pkg = svc.exportMod(details.modId)!;
    expect(pkg.formatVersion).toBe(1);
    expect(pkg.mod.blocks[0].key).toBe('c');
    expect(svc.exportMod('inexistente')).toBeNull();
  });

  it('importa realocando ids para não sobrescrever um mod já instalado', async () => {
    const { svc } = newService();

    // Mod nativo deste mundo, ocupando o primeiro id.
    const nativo = await svc.createMod('Nativo');
    await svc.addBlock(nativo.details.modId, { key: 'pedra_azul', name: 'Pedra Azul', topColor: 0 });
    expect(BLOCKS[CUSTOM_BLOCK_ID_BASE].name).toBe('Pedra Azul');

    // Mod de fora que também acha que é dono do id base.
    const externo = {
      formatVersion: 1,
      exportedAt: Date.now(),
      mod: {
        id: 'mod-externo', name: 'Externo', version: '1.0.0', enabled: true,
        blocks: [{ key: 'rubi', name: 'Rubi', blockId: CUSTOM_BLOCK_ID_BASE, topColor: '#ff0000' }],
        entities: [], structures: [], createdAt: 0, updatedAt: 0,
      },
    };

    const res = await svc.importMod(externo as any);

    expect(res.ok).toBe(true);
    expect(BLOCKS[CUSTOM_BLOCK_ID_BASE].name).toBe('Pedra Azul'); // o nativo não foi sobrescrito
    expect(BLOCKS[CUSTOM_BLOCK_ID_BASE + 1].name).toBe('Rubi');
  });

  it('importar um mod com id já usado gera um id novo em vez de sobrescrever', async () => {
    const { svc } = newService();
    await svc.createMod('Cristal', '', 'mod-cristal');
    const pkg = svc.exportMod('mod-cristal')!;

    const res = await svc.importMod(pkg);

    expect(res.ok).toBe(true);
    expect(res.details.modId).not.toBe('mod-cristal');
    expect(fake.mods.size).toBe(2);
  });

  it('recusa payload inválido', async () => {
    const { svc } = newService();
    expect((await svc.importMod({} as any)).ok).toBe(false);
    expect((await svc.importMod({ mod: { id: '', name: '' } } as any)).ok).toBe(false);
  });
});

describe('ModService — adoção de blocos criados dentro de execute_voxel_script', () => {
  beforeEach(() => {
    resetCustomBlocks();
    fake.mods.clear();
    fake.entities.clear();
    fake.blockMods.length = 0;
    fake.revisions.length = 0;
    fake.threadMods.clear();
  });

  it('adota blocos avulsos num mod salvo, fechando o caminho antigo de bloco efêmero', async () => {
    const { svc } = newService();
    const { registerCustomBlock } = await import('../../src/world/blocks');

    // Simula o que a IA faz dentro do script.
    const id = registerCustomBlock({ name: 'Areia Mágica', topColor: '#fde047' });

    const adotados = await svc.adoptOrphanBlocks();

    expect(adotados).toBe(1);
    const salvo = fake.mods.get('mod-avulsos')!;
    expect(salvo.blocks[0]).toMatchObject({ blockId: id, name: 'Areia Mágica', key: 'areia_magica' });
  });

  it('é idempotente: rodar de novo não duplica os mesmos blocos', async () => {
    const { svc } = newService();
    const { registerCustomBlock } = await import('../../src/world/blocks');
    registerCustomBlock({ name: 'Areia Mágica', topColor: '#fde047' });

    await svc.adoptOrphanBlocks();
    const segunda = await svc.adoptOrphanBlocks();

    expect(segunda).toBe(0);
    expect(fake.mods.get('mod-avulsos')!.blocks).toHaveLength(1);
  });

  it('o bloco adotado volta com o mesmo id depois do reload', async () => {
    const s1 = newService();
    const { registerCustomBlock } = await import('../../src/world/blocks');
    const id = registerCustomBlock({ name: 'Areia Mágica', topColor: '#fde047' });
    await s1.svc.adoptOrphanBlocks();

    resetCustomBlocks();
    const s2 = newService();
    await s2.svc.loadForWorld('mundo-1');

    expect(BLOCKS[id].name).toBe('Areia Mágica');
  });
});

describe('ModService — sincronização P2P (o convidado precisa concordar sobre os ids)', () => {
  beforeEach(() => {
    resetCustomBlocks();
    fake.mods.clear();
    fake.entities.clear();
    fake.blockMods.length = 0;
    fake.revisions.length = 0;
    fake.threadMods.clear();
  });

  it('REGRESSÃO: o convidado registra o bloco no MESMO id do anfitrião', () => {
    // Diferente de importMod, aqui realocar seria fatal: as mensagens `block_update` carregam
    // só o número do bloco, então divergir de id faz o convidado pintar o mundo trocado.
    const doAnfitriao: ModPackage = {
      id: 'mod-cristal', name: 'Cristal', version: '1.0.0', enabled: true,
      blocks: [{ key: 'azul', name: 'Cristal Azul', blockId: CUSTOM_BLOCK_ID_BASE + 5, topColor: '#38bdf8' }],
      entities: [], structures: [], createdAt: 0, updatedAt: 0,
    };

    const { svc } = newService();
    return svc.applyRemoteMods([doAnfitriao]).then((n) => {
      expect(n).toBe(1);
      expect(BLOCKS[CUSTOM_BLOCK_ID_BASE + 5].name).toBe('Cristal Azul');
      expect(svc.getMod('mod-cristal')!.blocks[0].blockId).toBe(CUSTOM_BLOCK_ID_BASE + 5);
    });
  });

  it('mod remoto é persistido, para sobreviver a uma reconexão', async () => {
    const { svc } = newService();
    await svc.applyRemoteMods([{
      id: 'mod-x', name: 'X', version: '1.0.0', enabled: true,
      blocks: [{ key: 'a', name: 'A', blockId: 70, topColor: 0 }],
      entities: [], structures: [], createdAt: 0, updatedAt: 0,
    } as ModPackage]);

    expect(fake.mods.has('mod-x')).toBe(true);
  });

  it('mod remoto inválido é recusado sem derrubar os demais', async () => {
    const { svc } = newService();
    const applied = await svc.applyRemoteMods([
      { id: '', name: '', version: '1', enabled: true, blocks: [], entities: [], structures: [], createdAt: 0, updatedAt: 0 } as ModPackage,
      { id: 'mod-ok', name: 'OK', version: '1', enabled: true, blocks: [{ key: 'b', name: 'B', blockId: 80, topColor: 0 }], entities: [], structures: [], createdAt: 0, updatedAt: 0 } as ModPackage,
    ]);

    expect(applied).toBe(1);
    expect(BLOCKS[80].name).toBe('B');
  });

  it('applyRemoteMods NÃO dispara onModChanged — senão o mod ecoaria de volta para a rede', async () => {
    const { svc } = newService();
    const echoes: string[] = [];
    svc.onModChanged = (m) => echoes.push(m.id);

    await svc.applyRemoteMods([{
      id: 'mod-remoto', name: 'Remoto', version: '1.0.0', enabled: true,
      blocks: [{ key: 'a', name: 'A', blockId: 90, topColor: 0 }],
      entities: [], structures: [], createdAt: 0, updatedAt: 0,
    } as ModPackage]);

    expect(echoes).toEqual([]);
  });

  it('criar um mod localmente DISPARA onModChanged, para o anfitrião replicar', async () => {
    const { svc } = newService();
    const echoes: string[] = [];
    svc.onModChanged = (m) => echoes.push(m.id);

    const { details } = await svc.createMod('Local');
    await svc.addBlock(details.modId, { key: 'c', name: 'C', topColor: 0 });

    expect(echoes.length).toBeGreaterThanOrEqual(2); // criação + adição de bloco
    expect(echoes[0]).toBe(details.modId);
  });
});
