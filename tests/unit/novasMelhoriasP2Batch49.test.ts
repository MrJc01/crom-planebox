// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { VerticalChunkSection } from '../../src/world/chunk';
import { BlockEntityStore, StainedGlassBlock, MiniBlockShapes } from '../../src/world/blocks';
import { frustumCullChunk } from '../../src/render/scene';

describe('Batch 49 — Testes de Seções Verticais, Entidades de Bloco, Frustum Culling, Vidro Colorido e Miniblocos P2', () => {
  describe('chunk — Seção Vertical de Chunk 16³ (Item 035 P2)', () => {
    it('deve armazenar e acessar voxels na seção de 16³', () => {
      const section = new VerticalChunkSection(2);
      section.setBlock(5, 3, 7, 3);
      expect(section.getBlock(5, 3, 7)).toBe(3);
    });
  });

  describe('blocks — Entidades Associadas a Blocos (Item 038 P2)', () => {
    it('deve guardar e carregar dados de entidade de bloco (baú/placa/fornalha)', () => {
      const store = new BlockEntityStore();
      store.set(10, 64, 10, { type: 'chest', items: [1, 2, 3] });

      const data = store.get(10, 64, 10);
      expect(data?.type).toBe('chest');
      expect(data?.items).toEqual([1, 2, 3]);

      store.remove(10, 64, 10);
      expect(store.get(10, 64, 10)).toBeUndefined();
    });
  });

  describe('scene — Frustum Culling Explícito por Chunk (Item 067 P2)', () => {
    it('deve testar visibilidade de chunk por distância de frustum', () => {
      const min = { x: 0, y: 0, z: 0 };
      const max = { x: 16, y: 128, z: 16 };
      const camNear = { x: 5, y: 64, z: 5 };
      const camFar = { x: 500, y: 64, z: 500 };

      expect(frustumCullChunk(min, max, camNear, 128)).toBe(true);
      expect(frustumCullChunk(min, max, camFar, 128)).toBe(false);
    });
  });

  describe('blocks — Vidro Colorido Translucidez (Item 081 P2)', () => {
    it('deve retornar configuração de transparência parcial', () => {
      const cfg = StainedGlassBlock.getTranslucencyConfig(0xff0000, 0.5);
      expect(cfg.isTransparent).toBe(true);
      expect(cfg.alpha).toBe(0.5);
    });
  });

  describe('blocks — Miniblocos e Formas Alternativas (Item 084 P2)', () => {
    it('deve calcular limites de bounding box para laje, poste e cerca', () => {
      const laje = MiniBlockShapes.getShapeBounds('laje');
      expect(laje.maxY).toBe(0.5);

      const poste = MiniBlockShapes.getShapeBounds('poste');
      expect(poste.maxX - poste.minX).toBe(0.25);
    });
  });
});
