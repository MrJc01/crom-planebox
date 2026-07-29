// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { CraftingSystem } from '../../src/crafting/CraftingSystem';
import { getToolClassSpeed } from '../../src/player/velocidadeDeQuebra';
import { generateParametricTree } from '../../src/crafting/StructureTemplates';
import { B } from '../../src/world/blocks';

describe('Batch 30 — Testes de Receitas de Diamante, Classes de Ferramenta e Árvore Paramétrica P1', () => {
  describe('CraftingSystem — Receita de Armadura de Diamante (Item 1286 P1)', () => {
    it('deve possuir a receita diamond_armor cadastrada', () => {
      const crafting = new CraftingSystem();
      const recipe = crafting.recipes.find((r) => r.id === 'diamond_armor');

      expect(recipe).toBeDefined();
      expect(recipe?.outputBlock).toBe(B.DIAMOND_BLOCK);
    });
  });

  describe('velocidadeDeQuebra — Classes de Ferramenta (Item 1292 P1)', () => {
    it('deve retornar multiplicador de velocidade otimizado para a ferramenta adequada', () => {
      expect(getToolClassSpeed('pickaxe', B.STONE)).toBe(0.5);
      expect(getToolClassSpeed('axe', B.LOG)).toBe(0.5);
      expect(getToolClassSpeed('shovel', B.DIRT)).toBe(0.5);
      expect(getToolClassSpeed('sword', B.LEAVES)).toBe(0.4);
      expect(getToolClassSpeed('pickaxe', B.DIRT)).toBe(1.0);
    });
  });

  describe('StructureTemplates — Gerador de Árvore Paramétrica (Item 1600 P1)', () => {
    it('deve gerar blocos de tronco e copa proporcionalmente à altura e raio especificados', () => {
      const tree = generateParametricTree(8, 3);
      expect(tree.length).toBeGreaterThan(20);

      const trunkBlocks = tree.filter((b) => b.block === B.LOG);
      expect(trunkBlocks.length).toBe(8);
    });
  });
});
