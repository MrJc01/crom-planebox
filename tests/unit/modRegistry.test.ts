import { describe, it, expect, beforeEach } from 'vitest';
import {
  BLOCKS,
  CUSTOM_BLOCK_ID_BASE,
  VANILLA_BLOCK_COUNT,
  getBlockDef,
  isOpaque,
  isSolid,
  listCustomBlocks,
  registerCustomBlock,
  registerCustomBlockAt,
  resetCustomBlocks,
  MISSING_BLOCK,
} from '../../src/world/blocks';
import {
  allocateBlockIds,
  applyAllMods,
  applyModBlocks,
  collectUsedBlockIds,
  normalizeKey,
  resolveBlockRef,
  resolveStructureBlocks,
  revokeModBlocks,
  validateModPackage,
} from '../../src/mods/ModRegistry';
import { ModPackage, emptyModPackage } from '../../src/mods/ModTypes';

function modWith(id: string, blocks: { key: string; name: string; blockId?: number }[]): ModPackage {
  const pkg = emptyModPackage(id, id);
  pkg.blocks = blocks.map((b) => ({ key: b.key, name: b.name, blockId: b.blockId as number, topColor: 0x112233 }));
  return pkg;
}

describe('blocks.ts — registro de blocos customizados', () => {
  beforeEach(() => resetCustomBlocks());

  it('resetCustomBlocks devolve o array ao tamanho da paleta base', () => {
    registerCustomBlockAt(CUSTOM_BLOCK_ID_BASE, { name: 'rubi', topColor: 0xff0000 });
    expect(BLOCKS.length).toBeGreaterThan(VANILLA_BLOCK_COUNT);
    resetCustomBlocks();
    expect(BLOCKS.length).toBe(VANILLA_BLOCK_COUNT);
  });

  it('registra num id explícito e o bloco fica acessível nesse id', () => {
    const id = registerCustomBlockAt(CUSTOM_BLOCK_ID_BASE + 5, { name: 'cristal', topColor: '#38bdf8' });
    expect(id).toBe(CUSTOM_BLOCK_ID_BASE + 5);
    expect(BLOCKS[id].name).toBe('cristal');
    expect(BLOCKS[id].custom).toBe(true);
  });

  it('não deixa buracos undefined no array ao registrar num id distante', () => {
    registerCustomBlockAt(CUSTOM_BLOCK_ID_BASE + 10, { name: 'longe', topColor: 0x00ff00 });
    for (let i = 0; i < BLOCKS.length; i++) {
      expect(BLOCKS[i], `índice ${i} ficou undefined`).toBeDefined();
    }
  });

  it('slots intermediários ficam reservados e não contam como blocos customizados', () => {
    registerCustomBlockAt(CUSTOM_BLOCK_ID_BASE + 3, { name: 'unico', topColor: 0x00ff00 });
    const customs = listCustomBlocks();
    expect(customs).toHaveLength(1);
    expect(customs[0].id).toBe(CUSTOM_BLOCK_ID_BASE + 3);
    expect(BLOCKS[CUSTOM_BLOCK_ID_BASE].reserved).toBe(true);
  });

  it('recusa id abaixo da base reservada para a paleta nativa', () => {
    expect(() => registerCustomBlockAt(10, { name: 'invasor', topColor: 0 })).toThrow();
    expect(() => registerCustomBlockAt(VANILLA_BLOCK_COUNT, { name: 'invasor', topColor: 0 })).toThrow();
  });

  it('getBlockDef devolve MISSING_BLOCK para id órfão em vez de estourar', () => {
    // Este é exatamente o cenário que quebrava o mesher: um save referenciando um bloco
    // de mod que não foi carregado. Tem de degradar visualmente, não lançar.
    expect(() => getBlockDef(9999).colors[0]).not.toThrow();
    expect(getBlockDef(9999)).toBe(MISSING_BLOCK);
    expect(getBlockDef(CUSTOM_BLOCK_ID_BASE + 2)).toBe(MISSING_BLOCK);
  });

  it('propriedades físicas declaradas pelo mod valem no isSolid/isOpaque', () => {
    const id = registerCustomBlockAt(CUSTOM_BLOCK_ID_BASE, {
      name: 'cristal etéreo', topColor: 0x38bdf8, solid: false, opaque: false,
    });
    expect(isSolid(id)).toBe(false);
    expect(isOpaque(id)).toBe(false);
  });

  it('registerCustomBlock aloca o próximo id livre a partir da base', () => {
    const a = registerCustomBlock({ name: 'a', topColor: 0 });
    const b = registerCustomBlock({ name: 'b', topColor: 0 });
    expect(a).toBe(CUSTOM_BLOCK_ID_BASE);
    expect(b).toBe(CUSTOM_BLOCK_ID_BASE + 1);
  });

  it('aceita cor em string com # e em número', () => {
    const id = registerCustomBlockAt(CUSTOM_BLOCK_ID_BASE, { name: 'x', topColor: '#ff0000' });
    expect(BLOCKS[id].colors[0][0]).toBeCloseTo(1, 5);
    expect(BLOCKS[id].colors[0][1]).toBeCloseTo(0, 5);
  });
});

describe('ModRegistry — validação', () => {
  it('aceita um mod bem formado', () => {
    const pkg = modWith('mod-a', [{ key: 'rubi', name: 'Rubi' }]);
    expect(validateModPackage(pkg)).toEqual([]);
  });

  it('recusa chave de bloco com maiúscula, espaço ou acento', () => {
    for (const badKey of ['Rubi', 'rubi bruto', 'rubí', '']) {
      const pkg = modWith('mod-a', [{ key: badKey, name: 'Rubi' }]);
      expect(validateModPackage(pkg).length, `aceitou "${badKey}"`).toBeGreaterThan(0);
    }
  });

  it('recusa chaves duplicadas dentro do mesmo mod', () => {
    const pkg = modWith('mod-a', [{ key: 'rubi', name: 'Rubi' }, { key: 'rubi', name: 'Outro' }]);
    expect(validateModPackage(pkg).some((e) => e.includes('duplicada'))).toBe(true);
  });

  it('recusa mod sem id ou sem nome', () => {
    const pkg = emptyModPackage('', '');
    const errors = validateModPackage(pkg);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('recusa entidade sem partes e estrutura vazia', () => {
    const pkg = emptyModPackage('mod-a', 'A');
    pkg.entities = [{ key: 'vazio', name: 'Vazio', parts: [] }];
    pkg.structures = [{ key: 'nada', name: 'Nada', blocks: [] }];
    const errors = validateModPackage(pkg);
    expect(errors.some((e) => e.includes('parte 3D'))).toBe(true);
    expect(errors.some((e) => e.includes('vazia'))).toBe(true);
  });

  it('normalizeKey converte texto livre em chave canônica', () => {
    expect(normalizeKey('Rubi Bruto')).toBe('rubi_bruto');
    expect(normalizeKey('Cristal Azul-Claro')).toBe('cristal_azul_claro');
    expect(normalizeKey('Árvore Mágica')).toBe('arvore_magica');
  });
});

describe('ModRegistry — alocação de ids (o que sustenta o save)', () => {
  beforeEach(() => resetCustomBlocks());

  it('atribui ids sequenciais a partir da base', () => {
    const pkg = modWith('mod-a', [{ key: 'a', name: 'A' }, { key: 'b', name: 'B' }]);
    allocateBlockIds(pkg);
    expect(pkg.blocks.map((b) => b.blockId)).toEqual([CUSTOM_BLOCK_ID_BASE, CUSTOM_BLOCK_ID_BASE + 1]);
  });

  it('preserva ids já atribuídos — um bloco salvo nunca muda de id', () => {
    const pkg = modWith('mod-a', [{ key: 'a', name: 'A', blockId: CUSTOM_BLOCK_ID_BASE + 7 }]);
    allocateBlockIds(pkg);
    expect(pkg.blocks[0].blockId).toBe(CUSTOM_BLOCK_ID_BASE + 7);
  });

  it('não reaproveita id usado por outro mod do mesmo mundo', () => {
    const existente = modWith('mod-a', [{ key: 'a', name: 'A', blockId: CUSTOM_BLOCK_ID_BASE }]);
    const novo = modWith('mod-b', [{ key: 'b', name: 'B' }]);
    allocateBlockIds(novo, [existente]);
    expect(novo.blocks[0].blockId).toBe(CUSTOM_BLOCK_ID_BASE + 1);
  });

  it('não reaproveita id de mod DESABILITADO (senão construções trocariam de bloco ao reativar)', () => {
    const desabilitado = modWith('mod-a', [{ key: 'a', name: 'A', blockId: CUSTOM_BLOCK_ID_BASE }]);
    desabilitado.enabled = false;
    const novo = modWith('mod-b', [{ key: 'b', name: 'B' }]);
    allocateBlockIds(novo, [desabilitado]);
    expect(novo.blocks[0].blockId).not.toBe(CUSTOM_BLOCK_ID_BASE);
  });

  it('collectUsedBlockIds enxerga todos os mods, habilitados ou não', () => {
    const a = modWith('mod-a', [{ key: 'a', name: 'A', blockId: 64 }]);
    const b = modWith('mod-b', [{ key: 'b', name: 'B', blockId: 70 }]);
    b.enabled = false;
    expect(collectUsedBlockIds([a, b])).toEqual(new Set([64, 70]));
  });

  it('applyModBlocks exige id alocado antes de aplicar', () => {
    const pkg = modWith('mod-a', [{ key: 'a', name: 'A' }]);
    expect(() => applyModBlocks(pkg)).toThrow(/allocateBlockIds/);
  });
});

describe('ModRegistry — ciclo de vida e estabilidade entre sessões', () => {
  beforeEach(() => resetCustomBlocks());

  it('applyAllMods aplica só os habilitados e limpa o estado anterior', () => {
    const a = modWith('mod-a', [{ key: 'a', name: 'A', blockId: 64 }]);
    const b = modWith('mod-b', [{ key: 'b', name: 'B', blockId: 65 }]);
    b.enabled = false;

    const res = applyAllMods([a, b]);
    expect(res.modsApplied).toBe(1);
    expect(res.blocksApplied).toBe(1);
    expect(BLOCKS[64].name).toBe('A');
    expect(getBlockDef(65)).toBe(MISSING_BLOCK);
  });

  it('REGRESSÃO: o bloco mantém o mesmo id depois de serializar e recarregar o mundo', () => {
    // Sessão 1: a IA cria o mod e o bloco recebe um id.
    const sessao1 = modWith('mod-rubi', [{ key: 'rubi', name: 'Rubi' }]);
    allocateBlockIds(sessao1);
    applyModBlocks(sessao1);
    const idOriginal = sessao1.blocks[0].blockId;

    // O mundo grava um bloco desse tipo em (10, 5, 10).
    const blocoSalvoNoMundo = idOriginal;

    // Sessão 2: navegador reaberto — o array volta ao estado base e o mod é relido do save.
    const salvo: ModPackage = JSON.parse(JSON.stringify(sessao1));
    resetCustomBlocks();
    expect(getBlockDef(blocoSalvoNoMundo)).toBe(MISSING_BLOCK);

    applyAllMods([salvo]);

    expect(salvo.blocks[0].blockId).toBe(idOriginal);
    expect(BLOCKS[blocoSalvoNoMundo].name).toBe('Rubi');
    expect(getBlockDef(blocoSalvoNoMundo)).not.toBe(MISSING_BLOCK);
  });

  it('revokeModBlocks tira o bloco do registro mas preserva a definição salva', () => {
    const pkg = modWith('mod-a', [{ key: 'a', name: 'A', blockId: 64 }]);
    applyModBlocks(pkg);
    expect(BLOCKS[64].name).toBe('A');

    revokeModBlocks(pkg);
    expect(getBlockDef(64)).toBe(MISSING_BLOCK);
    expect(pkg.blocks[0].blockId).toBe(64); // a definição continua íntegra para reativar

    applyModBlocks(pkg);
    expect(BLOCKS[64].name).toBe('A');
  });
});

describe('ModRegistry — referências simbólicas de bloco', () => {
  beforeEach(() => resetCustomBlocks());

  const mod = modWith('mod-cristal', [{ key: 'cristal_azul', name: 'Cristal Azul', blockId: 64 }]);
  const outro = modWith('mod-fogo', [{ key: 'brasa', name: 'Brasa', blockId: 70 }]);

  it('resolve id numérico e string numérica', () => {
    expect(resolveBlockRef(3, mod)).toBe(3);
    expect(resolveBlockRef('3', mod)).toBe(3);
  });

  it('resolve chave do próprio mod', () => {
    expect(resolveBlockRef('cristal_azul', mod)).toBe(64);
  });

  it('resolve chave qualificada "mod:chave" inclusive de outro mod', () => {
    expect(resolveBlockRef('mod-fogo:brasa', mod, [mod, outro])).toBe(70);
  });

  it('resolve nome de bloco da paleta base', () => {
    expect(resolveBlockRef('pedra', null)).toBe(3);
    expect(resolveBlockRef('Pedra', null)).toBe(3);
  });

  it('devolve null quando não resolve, em vez de cair em pedra silenciosamente', () => {
    expect(resolveBlockRef('nao_existe', mod, [mod])).toBeNull();
    expect(resolveBlockRef('', mod)).toBeNull();
  });

  it('resolveStructureBlocks converte para posições absolutas e reporta o que não resolveu', () => {
    const { placements, unresolved } = resolveStructureBlocks(
      [
        { dx: 0, dy: 0, dz: 0, block: 'cristal_azul' },
        { dx: 1, dy: 2, dz: 3, block: 'pedra' },
        { dx: 0, dy: 1, dz: 0, block: 'bloco_fantasma' },
      ],
      100, 20, -50,
      mod, [mod],
    );

    expect(placements).toEqual([
      { x: 100, y: 20, z: -50, blockType: 64 },
      { x: 101, y: 22, z: -47, blockType: 3 },
    ]);
    expect(unresolved).toEqual(['bloco_fantasma']);
  });
});
