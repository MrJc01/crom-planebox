// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { UndergroundGen } from '../../src/world/underground';
import { generateCoarseTerrain, SCALE_9_ENABLED } from '../../src/world/worldgen';
import { LodMesher } from '../../src/world/lodMesher';
import { Chunk } from '../../src/world/chunk';
import { allocatePaddedBuffer, measureMesherMemory, padChunkIntoDirect, unpackDirectToPadded } from '../../src/world/mesher';

describe('Batch 42 — Testes dos 10 Itens P1 Finais (Conclusão 100% dos P1s)', () => {
  describe('underground — Consulta de Caverna Otimizada (Item 1457 P1)', () => {
    it('deve retornar falso com curto-circuito para coordenadas inviáveis de caverna', () => {
      const ug = new UndergroundGen(12345);
      expect(ug.isCaveOptimized(0, 1, 0, 64)).toBe(false);
      expect(ug.isCaveOptimized(0, 60, 0, 64)).toBe(false);
    });
  });

  describe('worldgen & lodMesher — Terreno Grosso, Resolução e LOD (Itens 1582, 1583, 1584, 1627, 1628 P1)', () => {
    it('deve amostrar terreno grosso com contagem esperada de pontos', () => {
      const coarse = generateCoarseTerrain(0, 0, 4);
      expect(coarse.samplePoints).toBe(16);
      expect(SCALE_9_ENABLED).toBe(true);
    });

    it('deve extrair LOD de seção paletizada e calcular transições sem estalo', () => {
      const chunk = new Chunk(0, 0);
      const lodValue = LodMesher.getLODFromPalettedSection(chunk, 0);
      expect(typeof lodValue).toBe('number');

      const trans1 = LodMesher.smoothLODTransition(30, 64, 8);
      const trans2 = LodMesher.smoothLODTransition(100, 64, 8);

      expect(trans1).toBe(0); // Alta resolução
      expect(trans2).toBe(2); // LOD simplificado
    });
  });

  describe('mesher — Otimizações de Buffers Padded (Itens 1639, 1640, 1644, 1645 P1)', () => {
    it('deve alocar e medir memória de buffer plano padded', () => {
      const buf = allocatePaddedBuffer(10, 10, 10);
      const mem = measureMesherMemory(buf);

      expect(buf.length).toBe(1000);
      expect(mem.bytes).toBe(1000);
      expect(mem.kb).toBeCloseTo(1000 / 1024);
    });

    it('deve empacotar e desempacotar direto no buffer padded sem cópias intermediárias', () => {
      const src = new Uint8Array([1, 2, 3, 4, 5]);
      const target = new Uint8Array(10);

      const paddedSuccess = padChunkIntoDirect(src, target);
      expect(paddedSuccess).toBe(true);
      expect(target[0]).toBe(1);

      const unpackedCount = unpackDirectToPadded(src, target);
      expect(unpackedCount).toBe(5);
    });
  });
});
