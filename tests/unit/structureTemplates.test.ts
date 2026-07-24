import { describe, it, expect } from 'vitest';
import { STRUCTURE_TEMPLATES, getStructureTemplate } from '../../src/crafting/StructureTemplates';
import { BLOCKS } from '../../src/world/blocks';

describe('StructureTemplates', () => {
  it('tem pelo menos os 4 templates pedidos: árvore, casa, torre, muro', () => {
    const ids = STRUCTURE_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['tree', 'small_house', 'tower', 'wall']));
  });

  it('cada template tem pelo menos 1 bloco e todos os block ids existem em BLOCKS', () => {
    for (const tpl of STRUCTURE_TEMPLATES) {
      expect(tpl.blocks.length).toBeGreaterThan(0);
      for (const b of tpl.blocks) {
        expect(BLOCKS[b.block]).toBeDefined();
      }
    }
  });

  it('getStructureTemplate encontra por id e devolve undefined para id desconhecido', () => {
    expect(getStructureTemplate('tree')?.name).toBe('Árvore');
    expect(getStructureTemplate('inexistente')).toBeUndefined();
  });

  it('árvore tem tronco (LOG) na base subindo a partir de (0,0,0)', () => {
    const tree = getStructureTemplate('tree')!;
    const trunkBase = tree.blocks.find((b) => b.dx === 0 && b.dz === 0 && b.dy === 0);
    expect(trunkBase?.block).toBe(BLOCKS.findIndex((b) => b?.name === 'tronco'));
  });

  it('nenhum template tem blocos abaixo do chão (dy sempre >= 0)', () => {
    for (const tpl of STRUCTURE_TEMPLATES) {
      for (const b of tpl.blocks) {
        expect(b.dy).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
