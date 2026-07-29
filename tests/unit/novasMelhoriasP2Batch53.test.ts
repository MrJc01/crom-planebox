// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { DesertBiomeFeatures, SwampBiomeFeatures, SnowAccumulationSystem } from '../../src/world/biomes';
import { applyWorldGenParameters, DEFAULT_WORLD_PARAMS, AlternativeGenerators } from '../../src/world/worldgen';

describe('Batch 53 — Testes de Biomas Especiais, Parâmetros de Geração e Geradores Alternativos P2', () => {
  describe('biomes — Deserto com Cactos e Oásis (Item 109 P2)', () => {
    it('deve decidir deterministicamente se um cacto nasce na posição', () => {
      const r1 = DesertBiomeFeatures.shouldPlaceCactus(10, 20, 42);
      const r2 = DesertBiomeFeatures.shouldPlaceCactus(10, 20, 42);
      expect(r1).toBe(r2);
    });

    it('deve decidir se há oásis na posição', () => {
      expect(typeof DesertBiomeFeatures.isOasis(50, 100, 42)).toBe('boolean');
    });
  });

  describe('biomes — Pântano com Água Escura (Item 110 P2)', () => {
    it('deve retornar tom escuro para água do pântano', () => {
      expect(SwampBiomeFeatures.getWaterTint()).toBe(0x2d4a1e);
    });

    it('deve ter densidade de névoa elevada', () => {
      expect(SwampBiomeFeatures.getFogDensity()).toBeGreaterThan(0.2);
    });
  });

  describe('biomes — Neve com Acúmulo Dinâmico (Item 111 P2)', () => {
    it('deve acumular neve em temperaturas baixas', () => {
      expect(SnowAccumulationSystem.getAccumulationLayer(0.1, 0.8)).toBeGreaterThan(0);
    });

    it('não deve acumular neve em temperaturas altas', () => {
      expect(SnowAccumulationSystem.getAccumulationLayer(0.5, 1.0)).toBe(0);
    });

    it('deve derreter com temperatura acima de 0.5', () => {
      expect(SnowAccumulationSystem.shouldMelt(0.6)).toBe(true);
      expect(SnowAccumulationSystem.shouldMelt(0.3)).toBe(false);
    });
  });

  describe('worldgen — Parâmetros Ajustáveis (Item 115 P2)', () => {
    it('deve aplicar amplitude e nível do mar ao terreno base', () => {
      const h = applyWorldGenParameters(80, { ...DEFAULT_WORLD_PARAMS, amplitude: 2.0 });
      expect(h).toBeGreaterThan(80);
    });

    it('deve retornar pelo menos 1 de altura', () => {
      expect(applyWorldGenParameters(0, { amplitude: 0.1, scale: 1, seaLevel: 0 })).toBeGreaterThanOrEqual(1);
    });
  });

  describe('worldgen — Geradores Alternativos (Item 116 P2)', () => {
    it('superflat deve retornar altura fixa de 4', () => {
      expect(AlternativeGenerators.getHeight(10, 20, 'superflat', 42)).toBe(4);
    });

    it('amplificado deve gerar alturas maiores que padrão', () => {
      const h = AlternativeGenerators.getHeight(10, 20, 'amplificado', 42);
      expect(h).toBeGreaterThanOrEqual(30);
    });
  });
});
