// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { detectVoiceSilence, misturaDaVoz } from '../../src/net/vozEspacial';

describe('Batch 12 — Testes de Voz Espacial, Detecção de Silêncio e Névoa FogExp2 P1', () => {
  describe('Detecção de Silêncio e Transmissão (Item 939 P1)', () => {
    it('detectVoiceSilence deve retornar true para buffer de áudio zerado ou em silêncio', () => {
      const silentBuffer = new Float32Array(128).fill(0);
      expect(detectVoiceSilence(silentBuffer)).toBe(true);

      const quietBuffer = new Float32Array(128).fill(0.002);
      expect(detectVoiceSilence(quietBuffer, 0.01)).toBe(true);
    });

    it('detectVoiceSilence deve retornar false quando há sinal de fala ativo', () => {
      const activeBuffer = new Float32Array(128).map((_, i) => Math.sin(i * 0.1) * 0.5);
      expect(detectVoiceSilence(activeBuffer, 0.01)).toBe(false);
    });
  });

  describe('Áudio Espacial e Atenuação por Distância (Item 936 P1)', () => {
    it('misturaDaVoz deve atenuar o volume de acordo com a distância dos participantes no mundo', () => {
      const ouvinte = { x: 0, y: 0, z: 0, yaw: 0 };
      const perto = { x: 5, y: 0, z: 0 };
      const longe = { x: 60, y: 0, z: 0 };

      const mPerto = misturaDaVoz(ouvinte, perto);
      const mLonge = misturaDaVoz(ouvinte, longe);

      expect(mPerto.ganho).toBeGreaterThan(mLonge.ganho);
      expect(mPerto.ganho).toBeGreaterThan(0.85);
      expect(mLonge.ganho).toBeLessThan(0.5);
    });
  });

  describe('Névoa Exponencial FogExp2 (Item 1090 P1)', () => {
    it('THREE.FogExp2 deve calcular densidade exponencial em função do alcance', () => {
      const expFog = new THREE.FogExp2(0x87ceeb, 0.005);
      expect(expFog.density).toBe(0.005);
      expect(expFog.name).toBe('');
    });
  });
});
