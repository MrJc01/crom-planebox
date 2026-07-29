// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  CaveExposureAdaptation,
  LightDebugView,
  LightPropagationConfig,
  SmoothVertexLighting,
  LightBarrierBlock,
  TimeFreeze,
} from '../../src/render/grading';

describe('Batch 65 — Testes de Adaptação de Exposição, Debug de Luz, Propagação, Iluminação Suave, Barreira e TimeFreeze P2', () => {
  describe('grading — Adaptação de Exposição (Item 254 P2)', () => {
    it('deve adaptar exposição gradualmente ao entrar/sair de caverna', () => {
      const adapt = new CaveExposureAdaptation();
      adapt.setTarget(true); // Entrou na caverna
      const exp1 = adapt.tick(2.0);
      expect(exp1).toBeLessThan(1.0);

      adapt.setTarget(false); // Saiu
      const exp2 = adapt.tick(5.0);
      expect(exp2).toBeGreaterThan(exp1);
    });
  });

  describe('grading — Debug View de Luz (Item 256 P2)', () => {
    it('deve codificar nível de luz em cores para debug', () => {
      const dark = LightDebugView.encodeLightLevel(0);
      expect(dark.r).toBe(0);
      expect(dark.b).toBe(1.0);

      const bright = LightDebugView.encodeLightLevel(15);
      expect(bright.r).toBe(1.0);
      expect(bright.b).toBe(0);
    });
  });

  describe('grading — Propagação Configurável (Item 258 P2)', () => {
    it('deve ajustar limites conforme a qualidade', () => {
      const cfg = new LightPropagationConfig();
      cfg.setQuality('low');
      expect(cfg.maxPropagationSteps).toBe(8);
      expect(cfg.chunkLightBudget).toBe(1024);

      cfg.setQuality('high');
      expect(cfg.maxPropagationSteps).toBe(15);
    });
  });

  describe('grading — Iluminação Suave por Vértice (Item 260 P2)', () => {
    it('deve interpolar quatro cantos para obter o nível médio', () => {
      expect(SmoothVertexLighting.interpolate([10, 14, 12, 8])).toBe(11);
    });
  });

  describe('grading — Barreira de Luz (Item 261 P2)', () => {
    it('deve identificar bloco barreira de luz', () => {
      expect(LightBarrierBlock.doesBlockLight(50)).toBe(true);
      expect(LightBarrierBlock.doesBlockLight(1)).toBe(false);
    });
  });

  describe('grading — TimeFreeze (Item 263 P2)', () => {
    it('deve congelar e descongelar o horário do dia', () => {
      const tf = new TimeFreeze();
      tf.freeze(0.75);
      expect(tf.getEffectiveTime(0.5)).toBe(0.75);

      tf.unfreeze();
      expect(tf.getEffectiveTime(0.5)).toBe(0.5);
    });
  });
});
