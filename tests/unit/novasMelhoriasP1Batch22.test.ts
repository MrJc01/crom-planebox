// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { ModsPage } from '../../src/ui/ModsPage';
import { resolveSymbolicStructureBlocks } from '../../src/crafting/StructureTemplates';

describe('Batch 22 — Testes de Manifesto de Mod, Biomas e Estruturas Simbólicas P1', () => {
  describe('ModsPage — Pré-visualização de Manifesto & Aviso de Bioma (Itens 1409, 1422 P1)', () => {
    it('deve exibir confirmação de manifesto e aviso de bioma antes de importar mod', () => {
      document.body.innerHTML = '';
      const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

      const mockModService = { getMods: () => [] } as any;
      const page = new ModsPage(mockModService, {} as any);

      const mockPackage: any = {
        id: 'biome-mod',
        name: 'Mod de Bioma',
        biomes: [{ id: 'floresta_magica' }],
        permissions: ['storage'],
      };

      const result = page.previewManifestBeforeImport(mockPackage);

      expect(confirmSpy).toHaveBeenCalled();
      const confirmMsg = confirmSpy.mock.calls[0][0];
      expect(confirmMsg).toContain('Mod de Bioma');
      expect(confirmMsg).toContain('biomas novos');
      expect(result).toBe(true);

      confirmSpy.mockRestore();
    });
  });

  describe('StructureTemplates — Resolução de Referências Simbólicas em Estruturas (Item 1430 P1)', () => {
    it('deve converter referências numéricas e simbólicas para IDs de blocos válidos', () => {
      const raw = [
        { dx: 0, dy: 0, dz: 0, block: 1 },
        { dx: 0, dy: 1, dz: 0, block: 'meumod:cristal' },
      ];

      const resolver = (ref: string) => (ref === 'meumod:cristal' ? 42 : 1);
      const resolved = resolveSymbolicStructureBlocks(raw, resolver);

      expect(resolved).toEqual([
        { dx: 0, dy: 0, dz: 0, block: 1 },
        { dx: 0, dy: 1, dz: 0, block: 42 },
      ]);
    });
  });
});
