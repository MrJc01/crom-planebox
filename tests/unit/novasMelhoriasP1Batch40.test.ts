// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { ParametricTreeGenerator } from '../../src/world/parametricTrees';
import { blendBiomeColors, getBoundaryNoise } from '../../src/world/biomes';
import { ToolClassSystem } from '../../src/player/velocidadeDeQuebra';

describe('Batch 40 — Testes de Árvores Paramétricas, Mistura de Biomas e Classes de Ferramenta P1', () => {
  describe('ParametricTreeGenerator — Geração Paramétrica (Item 1600 P1)', () => {
    it('deve gerar a estrutura de blocos de tronco e copa paramétricos', () => {
      const treeData = ParametricTreeGenerator.generateParametricTree({
        x: 0,
        y: 64,
        z: 0,
        species: 'carvalho',
        height: 10,
      });

      expect(treeData.trunkBlocks).toBeGreaterThan(10);
      expect(treeData.leafBlocks).toBeGreaterThan(0);
    });
  });

  describe('biomes — Mistura de Cores e Ruído de Fronteira (Itens 1067, 1068 P1)', () => {
    it('deve misturar cores de bioma de forma contínua', () => {
      const colorA: [number, number, number] = [1, 0, 0];
      const colorB: [number, number, number] = [0, 1, 0];
      const blended = blendBiomeColors(colorA, colorB, 0.5);

      expect(blended[0]).toBeCloseTo(0.5);
      expect(blended[1]).toBeCloseTo(0.5);
      expect(blended[2]).toBeCloseTo(0);
    });

    it('deve calcular o ruído de fronteira entre biomas', () => {
      const noise = getBoundaryNoise(10, 20);
      expect(typeof noise).toBe('number');
    });
  });

  describe('velocidadeDeQuebra — Classes de Ferramentas (Item 1285 P1)', () => {
    it('deve calcular o dano e eficiência por classe de ferramenta', () => {
      const swordDamage = ToolClassSystem.getDamageForClass('sword', 3);
      const pickDamage = ToolClassSystem.getDamageForClass('pickaxe', 3);

      expect(swordDamage).toBeGreaterThan(pickDamage);

      const efficiency = ToolClassSystem.getMaterialEfficiency('pickaxe', 3, 3);
      expect(efficiency).toBeLessThan(1.0);
    });
  });
});
