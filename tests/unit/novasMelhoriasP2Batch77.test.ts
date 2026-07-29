// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  PositionalFluidSound,
  SplashParticleSystem,
  CustomModFluidRegistry,
  FluidWorkerSimulation,
  FluidStateCompressor,
  Fluid5000VoxelsBenchmark,
} from '../../src/world/physics';

describe('Batch 77 — Testes de Áudio Posicional de Fluido, Respingo, Fluidos Customizados de Mod, Worker & Benchmark P2', () => {
  describe('physics — Som Posicional de Fluido (Item 550 P2)', () => {
    it('deve atenuar volume pela distância do fluido', () => {
      expect(PositionalFluidSound.getSoundVolume(0, 20)).toBe(1.0);
      expect(PositionalFluidSound.getSoundVolume(10, 20)).toBe(0.5);
      expect(PositionalFluidSound.getSoundVolume(20, 20)).toBe(0);
    });
  });

  describe('physics — Partículas de Respingo (Item 551 P2)', () => {
    it('deve gerar contagem e velocidade de partículas de acordo com velocidade de queda', () => {
      const splash = SplashParticleSystem.generateSplashParticles(-10);
      expect(splash.count).toBe(30);
      expect(splash.speed).toBe(4.0);
    });
  });

  describe('physics — Fluidos Customizados de Mods (Item 552 P2)', () => {
    it('deve registrar e consultar fluidos com viscosidade customizada', () => {
      const reg = new CustomModFluidRegistry();
      reg.register({ id: 'mel', name: 'Mel', viscosity: 5.0, damageOnTouch: 0 });

      const fluid = reg.get('mel');
      expect(fluid?.viscosity).toBe(5.0);
    });
  });

  describe('physics — Simulação de Fluido em Worker & Compactação de Save (Itens 553, 554 P2)', () => {
    it('deve verificar suporte a worker e preparar payload', () => {
      expect(typeof FluidWorkerSimulation.isWorkerSupported()).toBe('boolean');
      const payload = FluidWorkerSimulation.prepareWorkerPayload(['0,0,0']);
      expect(payload.byteLength).toBeGreaterThan(0);
    });

    it('deve compactar e descompactar estados ativos de fluido', () => {
      const states = [{ key: '1,2,3', level: 7 }];
      const compressed = FluidStateCompressor.compressState(states);
      expect(compressed.byteLength).toBeGreaterThan(0);

      const decompressed = FluidStateCompressor.decompressState(compressed);
      expect(decompressed).toEqual(states);
    });
  });

  describe('physics — Benchmark 5.000 Voxels de Fluido (Item 556 P2)', () => {
    it('deve processar benchmark de 5.000 voxels com sucesso', () => {
      const res = Fluid5000VoxelsBenchmark.runSimulation(5000);
      expect(res.voxelsProcessed).toBe(5000);
      expect(res.timeMs).toBeGreaterThan(0);
    });
  });
});
