// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { BlockNameNormalizer, ColorblindPalette } from '../../src/world/blocks';
import { MountainGenerator, StructureGenerator, LootTableSystem } from '../../src/world/worldgen';

describe('Batch 52 — Testes de Normalização, Daltonismo, Montanhas, Estruturas e Loot P2', () => {
  describe('blocks — Normalização de Nomes de Bloco (Item 094 P2)', () => {
    it('deve normalizar acentos, caixa e espaços', () => {
      expect(BlockNameNormalizer.normalize('Pedra Escura')).toBe('pedra_escura');
      expect(BlockNameNormalizer.normalize('péDRa ÉsCuRa')).toBe('pedra_escura');
    });

    it('deve detectar duplicatas com acento/caixa diferentes', () => {
      expect(BlockNameNormalizer.isDuplicate('Pedra', 'pédra')).toBe(true);
      expect(BlockNameNormalizer.isDuplicate('Pedra', 'Areia')).toBe(false);
    });
  });

  describe('blocks — Modo Daltonismo (Item 096 P2)', () => {
    it('deve ajustar cores para cada modo de daltonismo', () => {
      const original = 0xff0000;
      const adjusted = ColorblindPalette.adjustColor(original, 'protanopia');
      expect(adjusted).not.toBe(original);
      expect(adjusted).toBeGreaterThan(0);
    });
  });

  describe('worldgen — Montanhas com Penhascos (Item 106 P2)', () => {
    it('deve gerar camadas de rocha com neve no topo', () => {
      const result = MountainGenerator.generateCliffLayers(64, 42);
      expect(result.peakHeight).toBeGreaterThan(64);
      expect(result.layers.length).toBeGreaterThan(0);
      // Topo deve ser neve
      const topo = result.layers[result.layers.length - 1];
      expect(topo.blockType).toBe(12); // B.SNOW
    });
  });

  describe('worldgen — Estruturas Geradas (Item 107 P2)', () => {
    it('deve retornar tipo de estrutura ou null deterministicamente', () => {
      const r1 = StructureGenerator.shouldPlaceStructure(100, 200, 42);
      const r2 = StructureGenerator.shouldPlaceStructure(100, 200, 42);
      expect(r1).toBe(r2);
    });
  });

  describe('worldgen — Baús de Tesouro com Loot Table (Item 108 P2)', () => {
    it('deve retornar loot para cada tipo de estrutura', () => {
      const loot = LootTableSystem.getLoot('masmorra', 42);
      expect(loot.length).toBeGreaterThan(0);
      expect(loot[0].blockType).toBeGreaterThan(0);
    });
  });
});
