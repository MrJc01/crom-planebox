// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { getWaterReflectionParams } from '../../src/render/luzDeCamada';
import { getWindAnimationParams } from '../../src/render/precipitation';
import { ConfigurableEmissiveBlock, DirectionalBlockRotation, CompositeBlockModel } from '../../src/world/blocks';

describe('Batch 50 — Testes de Reflexo de Água, Animação de Vento, Emissivos, Rotação e Modelos Compostos P2', () => {
  describe('luzDeCamada — Reflexo de Água SSR (Item 060 P2)', () => {
    it('deve calcular parâmetros de distorção de onda e reflexão Fresnel', () => {
      const params = getWaterReflectionParams(64, 1.5);
      expect(params.fresnelReflectivity).toBeGreaterThan(0);
      expect(typeof params.waveDistortion).toBe('number');
    });
  });

  describe('precipitation — Animação de Vento (Item 065 P2)', () => {
    it('deve calcular deslocamentos de folhagem por tempo e velocidade do vento', () => {
      const wind = getWindAnimationParams(2.0, 1.5);
      expect(wind.flexIntensity).toBeCloseTo(0.225);
      expect(typeof wind.offsetX).toBe('number');
    });
  });

  describe('blocks — Blocos Emissivos Configuráveis (Item 082 P2)', () => {
    it('deve armazenar e retornar níveis de iluminação customizados', () => {
      const emissive = new ConfigurableEmissiveBlock();
      emissive.setEmission(24, 14);

      expect(emissive.getEmission(24)).toBe(14);
      expect(emissive.getEmission(3, 0)).toBe(0);
    });
  });

  describe('blocks — Rotação Direcional em 4 Lados (Item 085 P2)', () => {
    it('deve retornar ângulos em radianos para os 4 pontos cardeais', () => {
      expect(DirectionalBlockRotation.getRotationAngle('north')).toBe(0);
      expect(DirectionalBlockRotation.getRotationAngle('east')).toBe(Math.PI * 0.5);
      expect(DirectionalBlockRotation.getRotationAngle('south')).toBe(Math.PI);
      expect(DirectionalBlockRotation.getRotationAngle('west')).toBe(Math.PI * 1.5);
    });
  });

  describe('blocks — Modelos Compostos de Miniblocos (Item 086 P2)', () => {
    it('deve gerar a composição de partes para mesa e cadeira', () => {
      const mesa = CompositeBlockModel.createModel('mesa');
      expect(mesa.length).toBe(5); // 1 tampo + 4 pernas

      const cadeira = CompositeBlockModel.createModel('cadeira');
      expect(cadeira.length).toBe(6); // 1 assento + 1 encosto + 4 pernas
    });
  });
});
