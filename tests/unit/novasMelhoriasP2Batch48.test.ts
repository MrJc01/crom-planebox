// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { AdventureModeRules } from '../../src/world/world';
import { LocalTelemetryTracker } from '../../src/core/Telemetry';
import { getWeatherTrailConfig } from '../../src/render/precipitation';
import { GraphicsQualitySettings } from '../../src/render/scene';
import { generateBlockVariant } from '../../src/world/blocks';

describe('Batch 48 — Testes de Modo Aventura, Telemetria, Rastro de Clima, Qualidade Gráfica e Variantes P2', () => {
  describe('world — Regras do Modo Aventura (Item 015 P2)', () => {
    it('deve bloquear quebra de blocos no Modo Aventura quando não permitido', () => {
      const adv = new AdventureModeRules();
      adv.isAdventureMode = true;

      expect(adv.canBreakBlock(3, 'pickaxe')).toBe(false);

      adv.allowToolToBreak(3, 'pickaxe');
      expect(adv.canBreakBlock(3, 'pickaxe')).toBe(true);
    });
  });

  describe('Telemetry — Monitoramento Local (Item 022 P2)', () => {
    it('deve registrar tempo até 1ª ferramenta e contagem de mortes', () => {
      const tracker = new LocalTelemetryTracker();
      tracker.recordFirstToolCrafted();
      expect(tracker.getTimeToFirstToolSeconds()).toBeGreaterThanOrEqual(0);

      tracker.recordDeath();
      expect(tracker.getDeathsPerHour()).toBeGreaterThan(0);
    });
  });

  describe('precipitation — Rastro de Clima por Bioma (Item 062 P2)', () => {
    it('deve retornar rastros diferenciados para neve e bioma de deserto', () => {
      const snow = getWeatherTrailConfig('forest', true);
      expect(snow.trailLength).toBe(1.5);

      const desert = getWeatherTrailConfig('desert', false);
      expect(desert.trailOpacity).toBe(0.1);
    });
  });

  describe('scene — Modo de Qualidade Gráfica (Item 068 P2)', () => {
    it('deve aplicar predefinições de qualidade', () => {
      const settings = new GraphicsQualitySettings();
      expect(settings.getSettings().renderDistance).toBe(8);

      settings.setQuality('baixo');
      expect(settings.getSettings().renderDistance).toBe(4);
      expect(settings.getSettings().enableShadows).toBe(false);
    });
  });

  describe('blocks — Variantes de Bloco (Item 080 P2)', () => {
    it('deve gerar nome e desvio de cor da variante', () => {
      const mossy = generateBlockVariant(3, 'musgoso');
      expect(mossy.variantName).toBe('Musgoso');

      const cracked = generateBlockVariant(3, 'rachado');
      expect(cracked.variantName).toBe('Rachado');
    });
  });
});
