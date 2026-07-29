// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  IncrementalSaveSystem,
  StorageQuotaMonitor,
  CompactBinaryExporter,
  MergeWorldImporter,
  WorldCloner,
} from '../../src/world/world';

describe('Batch 66 — Testes de Save Incremental, Quota, Exportação/Importação Binária e Clonagem P2', () => {
  describe('world — Save Incremental (Item 280 P2)', () => {
    it('deve salvar chunks em lotes', () => {
      const saveSys = new IncrementalSaveSystem();
      saveSys.markDirtyChunk('0,0');
      saveSys.markDirtyChunk('0,1');
      saveSys.markDirtyChunk('1,0');

      const res = saveSys.saveBatch(2);
      expect(res.savedCount).toBe(2);
      expect(res.remaining).toBe(1);
    });
  });

  describe('world — Monitor de Quota de Armazenamento (Item 282 P2)', () => {
    it('deve emitir aviso quando uso exceder 90%', () => {
      const q1 = StorageQuotaMonitor.checkQuota(50, 100);
      expect(q1.isWarning).toBe(false);

      const q2 = StorageQuotaMonitor.checkQuota(95, 100);
      expect(q2.isWarning).toBe(true);
      expect(q2.usagePercent).toBe(95);
    });
  });

  describe('world — Exportação Binária Compacta (Item 283 P2)', () => {
    it('deve exportar e importar dados preservando os blocos', () => {
      const data = [1, 2, 3, 0, 7];
      const bin = CompactBinaryExporter.exportToBinary(data);
      expect(bin).toBeInstanceOf(Uint8Array);

      const imported = CompactBinaryExporter.importFromBinary(bin);
      expect(imported).toEqual(data);
    });
  });

  describe('world — Importação Mesclada (Item 284 P2)', () => {
    it('deve mesclar dados sem sobrescrever com blocos de ar', () => {
      const existing = new Map<string, number>([['0,0,0', 1], ['1,0,0', 2]]);
      const incoming = new Map<string, number>([['0,0,0', 0], ['1,0,0', 3], ['2,0,0', 4]]);

      const merged = MergeWorldImporter.mergeWorldData(existing, incoming);
      expect(merged.get('0,0,0')).toBe(1); // Manteve 1 pois incoming era 0
      expect(merged.get('1,0,0')).toBe(3); // Sobrescreveu com bloco válido 3
      expect(merged.get('2,0,0')).toBe(4); // Adicionou novo bloco
    });
  });

  describe('world — Clonar Mundo (Item 285 P2)', () => {
    it('deve gerar nome duplicado para mundo clonado', () => {
      const clone = WorldCloner.cloneWorld('MeuMundo');
      expect(clone.cloned).toBe(true);
      expect(clone.newName).toBe('MeuMundo_Copia');
    });
  });
});
