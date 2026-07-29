// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import {
  GroundYColumnCache,
  TypedBlockStorage,
  SaveDebounceBlocks,
  DistanceBehaviorThrottle,
} from '../../src/world/worldgen';

describe('Batch 72 — Testes de Otimização (Cache GroundY, TypedArrays, Save Debounce, Distance Throttle) P2', () => {
  describe('worldgen — Cache de GroundY por Coluna (Item 410 P2)', () => {
    it('deve reutilizar resultado calculado anteriormente', () => {
      const cache = new GroundYColumnCache();
      const computeFn = vi.fn((x: number, z: number) => 64);

      const y1 = cache.getGroundY(10, 20, computeFn);
      const y2 = cache.getGroundY(10, 20, computeFn);

      expect(y1).toBe(64);
      expect(y2).toBe(64);
      expect(computeFn).toHaveBeenCalledTimes(1); // Só calculou uma vez
    });
  });

  describe('worldgen — TypedBlockStorage (Item 411 P2)', () => {
    it('deve armazenar e consultar blocos em Uint8Array', () => {
      const storage = new TypedBlockStorage(100);
      storage.setBlock(5, 12);
      expect(storage.getBlock(5)).toBe(12);
      expect(storage.getRawBuffer()).toBeInstanceOf(Uint8Array);
    });
  });

  describe('worldgen — Save Debounce de Blocos (Item 414 P2)', () => {
    it('deve agrupar salvamentos dentro do janela de debounce', async () => {
      vi.useFakeTimers();
      const db = new SaveDebounceBlocks();
      const onSave = vi.fn();

      db.scheduleSave('0,0', onSave, 500);
      db.scheduleSave('0,1', onSave, 500);

      expect(onSave).not.toHaveBeenCalled();

      vi.advanceTimersByTime(600);
      expect(onSave).toHaveBeenCalledWith(['0,0', '0,1']);
      vi.useRealTimers();
    });
  });

  describe('worldgen — Throttle por Distância (Item 416 P2)', () => {
    it('deve desativar scripts de comportamento quando muito distantes do jogador', () => {
      const pPos = { x: 0, y: 64, z: 0 };
      expect(DistanceBehaviorThrottle.shouldRunBehavior({ x: 10, y: 64, z: 10 }, pPos, 64)).toBe(true);
      expect(DistanceBehaviorThrottle.shouldRunBehavior({ x: 200, y: 64, z: 200 }, pPos, 64)).toBe(false);
    });
  });
});
