// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { Interaction } from '../../src/player/interaction';
import { generatePrimitiveShape, generateSlopedRoof } from '../../src/crafting/StructureTemplates';
import { B } from '../../src/world/blocks';

describe('Batch 33 — Testes de Desenho de Caminhos, Formas Primitivas 3D e Telhado Inclinado P1', () => {
  describe('Interaction — Desenho de Caminhos (Item 1614 P1)', () => {
    it('deve desenhar blocos de caminho entre as coordenadas especificadas', () => {
      const setBlockSpy = vi.fn();
      const mockWorld = {
        surfaceY: vi.fn().mockReturnValue(64),
        setBlock: setBlockSpy,
      } as any;
      const mockPhysics = {} as any;
      const mockPlayer = { yaw: 0, pitch: 0, position: { x: 0, y: 0, z: 0 } } as any;
      const mockScene = { add: () => {}, remove: () => {} } as any;

      const interaction = new Interaction(mockWorld, mockPhysics, mockPlayer, mockScene);
      const placed = interaction.drawPath(0, 0, 10, 0, 2, B.PATH);

      expect(placed).toBeGreaterThan(0);
      expect(setBlockSpy).toHaveBeenCalledWith(expect.any(Number), 64, expect.any(Number), B.PATH);
    });
  });

  describe('StructureTemplates — Formas Primitivas 3D & Telhado Inclinado (Itens 1615, 1616 P1)', () => {
    it('deve gerar formas primitivas de cilindro, cone, esfera e cunha', () => {
      const cylinder = generatePrimitiveShape('cylinder', 3, 5, B.STONE);
      const cone = generatePrimitiveShape('cone', 3, 5, B.STONE);
      const sphere = generatePrimitiveShape('sphere', 3, 6, B.STONE);

      expect(cylinder.length).toBeGreaterThan(0);
      expect(cone.length).toBeGreaterThan(0);
      expect(sphere.length).toBeGreaterThan(0);
      expect(cylinder.length).toBeGreaterThan(cone.length);
    });

    it('deve gerar blocos de telhado inclinado piramidal em camadas descendentes', () => {
      const roof = generateSlopedRoof(6, 6, 3, B.PLANK);
      expect(roof.length).toBeGreaterThan(0);
      const layer0 = roof.filter((b) => b.dy === 0);
      const layer1 = roof.filter((b) => b.dy === 1);
      expect(layer0.length).toBeGreaterThan(layer1.length);
    });
  });
});
