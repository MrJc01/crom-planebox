// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { SimulatedPeerProtocolTest } from '../../src/net/PeerSync';
import {
  DedicatedWorkerPersistence,
  MesherBenchmark,
  WorldGen100ChunksBenchmark,
  CIPerformanceRegressionTest,
} from '../../src/world/world';
import {
  AILazyLoader,
  BundleCodeSplitting,
  ThreeSelectiveImports,
  WeakGPUDetector,
  MotionReducer,
  HighContrastHUD,
} from '../../src/render/scene';

describe('Batch 73 — Testes de Performance, Benchmarks, GPU, Acessibilidade e WebWorker P2', () => {
  describe('net — Testes do Protocolo com Peers Simulados (Item 395 P2)', () => {
    it('deve simular handshake e medir latência estimada', () => {
      const res = SimulatedPeerProtocolTest.simulateProtocolHandshake('peerA', 'peerB');
      expect(res.success).toBe(true);
      expect(res.latencyMs).toBeGreaterThan(0);
    });
  });

  describe('world — WebWorker & Benchmarks (Itens 413, 417, 418, 419 P2)', () => {
    it('deve checar suporte a WebWorker', () => {
      expect(typeof DedicatedWorkerPersistence.isWorkerAvailable()).toBe('boolean');
    });

    it('deve executar benchmark do mesher e retornar contagem de quads', () => {
      const bench = MesherBenchmark.runBenchmark(100);
      expect(bench.quadsProcessed).toBe(100);
      expect(bench.timeMs).toBeGreaterThan(0);
    });

    it('deve executar benchmark de 100 chunks', () => {
      const bench = WorldGen100ChunksBenchmark.run100ChunksTest();
      expect(bench.chunksGenerated).toBe(100);
    });

    it('deve validar orçamento de performance para o CI', () => {
      expect(CIPerformanceRegressionTest.assertPerformanceBudget(50, 100)).toBe(true);
      expect(CIPerformanceRegressionTest.assertPerformanceBudget(150, 100)).toBe(false);
    });
  });

  describe('render — Lazy Load, Splitting, GPU e Acessibilidade (Itens 420, 421, 422, 424, 438, 439 P2)', () => {
    it('deve carregar módulo de IA sob demanda (lazy load)', async () => {
      const res = await AILazyLoader.loadAIModule();
      expect(res.loaded).toBe(true);
    });

    it('deve listar chunks de code splitting', () => {
      expect(BundleCodeSplitting.getChunksList()).toContain('ai_module');
    });

    it('deve indicar imports seletivos de Three.js', () => {
      expect(ThreeSelectiveImports.isSelective()).toBe(true);
    });

    it('deve detectar GPU fraca por FPS ou renderizador', () => {
      expect(WeakGPUDetector.isWeakGPU(15)).toBe(true);
      expect(WeakGPUDetector.isWeakGPU(60, 'NVIDIA GeForce RTX 3080')).toBe(false);
    });

    it('deve desativar balanço de câmera com redutor de movimento', () => {
      const mr = new MotionReducer();
      expect(mr.getCameraBobbingFactor()).toBe(1.0);

      mr.reduceMotion = true;
      expect(mr.getCameraBobbingFactor()).toBe(0);
    });

    it('deve fornecer cores de alto contraste para o HUD', () => {
      const hud = new HighContrastHUD();
      hud.highContrast = true;
      expect(hud.getTextColor()).toBe('#FFFFFF');
      expect(hud.getBackgroundColor()).toBe('#000000');
    });
  });
});
