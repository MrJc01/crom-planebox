// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { HeldToolRenderer } from '../../src/player/interaction';
import { World } from '../../src/world/world';
import { reconcileCurvatureAndFog } from '../../src/world/volumetricClouds';

describe('Batch 39 — Testes de Pose de Braço em 1ª Pessoa, Orçamento de Re-mesh e Curvatura com Neblina P1', () => {
  describe('HeldToolRenderer — Pose de Braço em 1ª Pessoa (Item 949 P1)', () => {
    it('deve devolver uma pose própria de braço em 1ª pessoa com deslocamento durante ataque', () => {
      const renderer = new HeldToolRenderer();
      const poseInicial = renderer.getArmPose();

      expect(poseInicial.posX).toBeCloseTo(0.35);
      expect(poseInicial.posY).toBeCloseTo(-0.35);

      renderer.triggerPunchAnimation();
      renderer.updateAnimation(0.1);
      const poseAtaque = renderer.getArmPose();

      expect(poseAtaque.rotX).not.toBe(poseInicial.rotX);
    });
  });

  describe('World — Orçamento de Re-mesh por Frame (Item 973 P1)', () => {
    it('deve respeitar o orçamento de re-mesh por frame durante o ciclo dia/noite', () => {
      const world = new World();
      world.queueChunkForReMesh(0, 0);
      world.queueChunkForReMesh(1, 0);
      world.queueChunkForReMesh(2, 0);
      world.queueChunkForReMesh(3, 0);
      world.queueChunkForReMesh(4, 0);

      const processadosBatch1 = world.processReMeshQueue(3);
      expect(processadosBatch1).toBe(3);

      const processadosBatch2 = world.processReMeshQueue(3);
      expect(processadosBatch2).toBe(2);
    });
  });

  describe('volumetricClouds — Harmonização de Curvatura e Neblina (Item 1037 P1)', () => {
    it('deve conciliar o alcance da neblina garantindo que o horizonte curvado fique interno à névoa', () => {
      const res = reconcileCurvatureAndFog(120, 2000);
      expect(res.maxVisibleCurvature).toBeLessThanOrEqual(res.effectiveFogDistance);
    });
  });
});
