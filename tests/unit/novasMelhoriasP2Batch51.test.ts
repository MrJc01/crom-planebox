// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { computeVisualRegressionHash } from '../../src/render/grading';
import { CreativeRuler, BiomePaletteLibrary, ModPaletteExporter, BlockDeduplicator } from '../../src/world/blocks';

describe('Batch 51 — Testes de Regressão Visual, Régua Criativa, Paletas por Bioma, Exportação JSON e Deduplicação P2', () => {
  describe('grading — Teste de Regressão Visual (Item 072 P2)', () => {
    it('deve gerar hash determinístico para mesmos pixels', () => {
      const pixels = new Uint8Array([255, 0, 0, 128, 64, 32]);
      const hash1 = computeVisualRegressionHash(pixels);
      const hash2 = computeVisualRegressionHash(pixels);
      expect(hash1).toBe(hash2);
      expect(hash1).toBeGreaterThan(0);
    });

    it('deve gerar hashes diferentes para pixels diferentes', () => {
      const a = new Uint8Array([255, 0, 0]);
      const b = new Uint8Array([0, 255, 0]);
      expect(computeVisualRegressionHash(a)).not.toBe(computeVisualRegressionHash(b));
    });
  });

  describe('blocks — Régua Criativa (Item 088 P2)', () => {
    it('deve gerar marcações de grade em intervalos regulares', () => {
      const marks = CreativeRuler.getGridMarks(16, 4);
      expect(marks).toEqual([0, 4, 8, 12, 16]);
    });

    it('deve medir distância 3D entre dois pontos', () => {
      const d = CreativeRuler.getMeasurement(0, 0, 0, 3, 4, 0);
      expect(d).toBe(5);
    });
  });

  describe('blocks — Biblioteca de Paletas por Bioma (Item 089 P2)', () => {
    it('deve retornar a paleta padrão de floresta', () => {
      const lib = new BiomePaletteLibrary();
      const p = lib.getPalette('floresta');
      expect(p.length).toBeGreaterThan(0);
      expect(p).toContain(7); // LOG
    });

    it('deve permitir adicionar paletas customizadas', () => {
      const lib = new BiomePaletteLibrary();
      lib.addBiomePalette('cogumelo', [3, 8]);
      expect(lib.getPalette('cogumelo')).toEqual([3, 8]);
    });
  });

  describe('blocks — Exportar/Importar Paleta de Mod como JSON (Item 091 P2)', () => {
    it('deve exportar e reimportar uma paleta corretamente', () => {
      const json = ModPaletteExporter.exportToJSON('medieval', [3, 11, 26]);
      const imported = ModPaletteExporter.importFromJSON(json);
      expect(imported?.name).toBe('medieval');
      expect(imported?.blocks).toEqual([3, 11, 26]);
    });

    it('deve retornar null para JSON inválido', () => {
      expect(ModPaletteExporter.importFromJSON('{')).toBeNull();
    });
  });

  describe('blocks — Deduplicação de Blocos (Item 093 P2)', () => {
    it('deve detectar blocos com cores muito próximas', () => {
      const dupes = BlockDeduplicator.findNearDuplicates([
        { id: 1, name: 'Pedra A', colorTop: 0x808080 },
        { id: 2, name: 'Pedra B', colorTop: 0x818181 },
        { id: 3, name: 'Ouro', colorTop: 0xffd700 },
      ]);
      expect(dupes.length).toBe(1);
      expect(dupes[0].a).toBe(1);
      expect(dupes[0].b).toBe(2);
    });
  });
});
