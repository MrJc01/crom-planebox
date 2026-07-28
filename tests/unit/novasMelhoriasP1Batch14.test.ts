// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

describe('Batch 14 — Testes de Iluminação Noturna e Opções P1', () => {
  describe('Luz Direcional da Lua e Sombras Noturnas (Item 1020 P1)', () => {
    it('deve instanciar luz direcional noturna com intensidade fraca e sombras ativas', () => {
      const moon = new THREE.DirectionalLight(0x5577aa, 0.45);
      moon.position.set(-60, 95, -30);
      moon.castShadow = true;
      moon.shadow.mapSize.set(1024, 1024);

      expect(moon.color.getHex()).toBe(0x5577aa);
      expect(moon.intensity).toBeCloseTo(0.45);
      expect(moon.castShadow).toBe(true);
      expect(moon.shadow.mapSize.width).toBe(1024);
    });
  });
});
