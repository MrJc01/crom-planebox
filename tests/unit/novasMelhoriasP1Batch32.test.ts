// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { Interaction } from '../../src/player/interaction';
import { World } from '../../src/world/world';
import { B } from '../../src/world/blocks';

describe('Batch 32 — Testes de Pincel de Terreno, Salões de Caverna e Lagos Subterrâneos P1', () => {
  describe('Interaction — Pincel de Terreno (Item 1613 P1)', () => {
    it('deve modificar a elevação do terreno usando o pincel de escultura', () => {
      const setBlockSpy = vi.fn();
      const mockWorld = {
        surfaceY: vi.fn().mockReturnValue(64),
        setBlock: setBlockSpy,
      } as any;
      const mockPhysics = {} as any;
      const mockPlayer = { yaw: 0, pitch: 0, position: { x: 0, y: 0, z: 0 } } as any;
      const mockScene = { add: () => {}, remove: () => {} } as any;

      const interaction = new Interaction(mockWorld, mockPhysics, mockPlayer, mockScene);

      const modified = interaction.applyTerrainBrush('raise', 2, 0, 0);
      expect(modified).toBeGreaterThan(0);
      expect(setBlockSpy).toHaveBeenCalledWith(expect.any(Number), 65, expect.any(Number), B.DIRT);
    });
  });

  describe('World — Salões de Caverna e Lagos Subterrâneos (Itens 1608, 1609 P1)', () => {
    it('deve gerar um salão de caverna escavando uma ampla cavidade', () => {
      const world = new World(12345);
      const cleared = world.generateCaveHall(0, 30, 0, 4, 3, 4);

      expect(cleared).toBeGreaterThan(0);
      expect(world.getBlock(0, 30, 0)).toBe(B.AIR);
    });

    it('deve posicionar água em áreas subterrâneas formando um lago', () => {
      const world = new World(12345);
      const waterCount = world.generateUndergroundLakes(0, 0, 15, 3);

      expect(waterCount).toBeGreaterThan(0);
      expect(world.getBlock(0, 15, 0)).toBe(B.WATER);
    });
  });
});
