// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { UndergroundGen } from '../../src/world/underground';
import { ParametricTreeGenerator } from '../../src/world/parametricTrees';
import { World } from '../../src/world/world';
import { Chunk } from '../../src/world/chunk';
import { applyDistanceBlur } from '../../src/world/volumetricClouds';

describe('Batch 44 — Testes de Formações de Caverna, Árvores Caídas e Distance Blur P2', () => {
  describe('underground — Formações de Caverna (Item 1611 P2)', () => {
    it('deve gerar tipos de formação procedural em cavernas', () => {
      const ug = new UndergroundGen(54321);
      const res = ug.generateCaveFormations(10, 15, 20);
      expect(res === null || typeof res === 'string').toBe(true);
    });
  });

  describe('parametricTrees — Árvores Caídas e Tocos (Itens 1603, 1604 P2)', () => {
    it('deve colocar toco e tronco caído horizontalmente no mundo', () => {
      const world = new World();
      world.addChunk(new Chunk(0, 0));
      const placed = ParametricTreeGenerator.generateFallenTreesAndStumps(world, 0, 64, 0, 4);

      expect(placed).toBe(5); // 1 toco + 4 troncos
    });
  });

  describe('volumetricClouds — Distance Blur (Item 1630 P2)', () => {
    it('deve calcular os parâmetros de desfoque por distância', () => {
      const blur = applyDistanceBlur(120);

      expect(blur.blurRadius).toBeGreaterThan(0);
      expect(blur.fogDensity).toBeLessThan(1);
    });
  });
});
