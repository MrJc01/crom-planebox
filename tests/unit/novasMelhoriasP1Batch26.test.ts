// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { Interaction } from '../../src/player/interaction';
import { buildStructureProgressively } from '../../src/crafting/StructureTemplates';

describe('Batch 26 — Testes de Edição de Voxel, Preview de Espaço e Construção Progressiva P1', () => {
  describe('Interaction — Modo de Edição de Voxel & Preview de Espaço (Itens 1564, 1565, 1658 P1)', () => {
    it('deve alternar o modo de edição de voxel delimitado', () => {
      const mockWorld = {} as any;
      const mockPhysics = {} as any;
      const mockPlayer = { yaw: 0, pitch: 0, position: { x: 0, y: 0, z: 0 } } as any;
      const mockScene = { add: () => {}, remove: () => {} } as any;

      const interaction = new Interaction(mockWorld, mockPhysics, mockPlayer, mockScene);
      expect(interaction.isInVoxelEditMode()).toBe(false);

      interaction.enterVoxelEditingMode();
      expect(interaction.isInVoxelEditMode()).toBe(true);

      interaction.exitVoxelEditingMode();
      expect(interaction.isInVoxelEditMode()).toBe(false);
    });

    it('deve calcular o bounding box e a contagem de blocos para preview de espaço da estrutura', () => {
      const mockWorld = {} as any;
      const mockPhysics = {} as any;
      const mockPlayer = { yaw: 0, pitch: 0, position: { x: 0, y: 0, z: 0 } } as any;
      const mockScene = { add: () => {}, remove: () => {} } as any;

      const interaction = new Interaction(mockWorld, mockPhysics, mockPlayer, mockScene);
      const bounds = interaction.previewStructureBounds('tree', 10, 64, 10);

      expect(bounds).not.toBeNull();
      expect(bounds!.count).toBeGreaterThan(0);
      expect(bounds!.minY).toBeLessThanOrEqual(bounds!.maxY);
    });
  });

  describe('StructureTemplates — Construção Progressiva de Estrutura (Item 1656 P1)', () => {
    it('deve colocar os blocos da estrutura em lotes no mundo', () => {
      const setBlockSpy = vi.fn();
      const mockWorld = { setBlock: setBlockSpy };

      const placed = buildStructureProgressively(mockWorld, 'tree', 0, 0, 0, 5);

      expect(placed).toBe(5);
      expect(setBlockSpy).toHaveBeenCalledTimes(5);
    });
  });
});
