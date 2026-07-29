// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { TREE_PROFILES, generateTreeBranches } from '../../src/crafting/StructureTemplates';
import { World } from '../../src/world/world';
import { B } from '../../src/world/blocks';

describe('Batch 31 — Testes de Galhos de Árvore, Perfis por Espécie e Fendas Verticais P1', () => {
  describe('StructureTemplates — Galhos e Perfis por Espécie de Árvore (Itens 1601, 1602 P1)', () => {
    it('deve possuir perfis cadastrados para carvalho, pinheiro, palmeira e morta', () => {
      expect(TREE_PROFILES.carvalho.trunkHeight).toBe(6);
      expect(TREE_PROFILES.pinheiro.leavesBlock).toBe(B.PINE_LEAVES);
      expect(TREE_PROFILES.morta.leavesBlock).toBe(B.AIR);
    });

    it('deve gerar galhos tridimensionais estendidos em várias direções', () => {
      const branches = generateTreeBranches(8);
      expect(branches.length).toBeGreaterThan(0);
      expect(branches.some((b) => b.dx > 0)).toBe(true);
      expect(branches.some((b) => b.dx < 0)).toBe(true);
    });
  });

  describe('World — Geração de Fendas Verticais (Item 1607 P1)', () => {
    it('deve abrir blocos de ar em profundidade simulando uma ravina vertical', () => {
      const setBlockSpy = vi.fn();
      const world = new World(12345);
      world.setBlock = setBlockSpy;
      vi.spyOn(world, 'surfaceY').mockReturnValue(40);

      world.generateVerticalRavine(0, 0, 10, 5);

      expect(setBlockSpy).toHaveBeenCalled();
      expect(setBlockSpy).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expect.any(Number), B.AIR);
    });
  });
});
