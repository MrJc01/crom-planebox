// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { compressRLE, decompressRLE } from '../../src/world/chunk';
import { StructuredLogger, runAutomatedTestScript } from '../../src/core/StructuredLogger';
import { B } from '../../src/world/blocks';

describe('Batch 28 — Testes de Compressão RLE, Log Estruturado e Minério de Energia P1', () => {
  describe('chunk — Compressão RLE de Chunks (Item 1581 P1)', () => {
    it('deve compactar e descompactar dados de voxel sem perdas de informação', () => {
      const data = new Uint8Array([3, 3, 3, 3, 0, 0, 0, 1, 1, 1, 1, 1]);
      const compressed = compressRLE(data);
      const decompressed = decompressRLE(compressed, data.length);

      expect(compressed).toEqual([3, 4, 0, 3, 1, 5]);
      expect(decompressed).toEqual(data);
    });
  });

  describe('StructuredLogger — Log Estruturado e Roteiro Automatizado (Itens 1575, 1576 P1)', () => {
    it('deve registrar logs em formato estruturado e executar roteiro de ações', async () => {
      const result = await runAutomatedTestScript([
        { action: 'move', x: 10, y: 64, z: 10 },
        { action: 'break', target: 'stone' },
      ]);

      expect(result.executed).toBe(2);
      expect(result.logs.length).toBeGreaterThanOrEqual(4); // start + 2 steps + complete
      expect(result.logs[0].event).toBe('script_start');
      expect(result.logs[result.logs.length - 1].event).toBe('script_complete');
    });
  });

  describe('blocks — Minério de Energia (Item 1657 P1)', () => {
    it('deve definir o id numérico de ENERGY_ORE no registro de blocos', () => {
      expect(B.ENERGY_ORE).toBe(37);
    });
  });
});
