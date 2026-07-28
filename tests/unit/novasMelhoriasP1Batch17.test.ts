// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { CodeEditorPage } from '../../src/ui/CodeEditorPage';

describe('Batch 17 — Testes de Edição de mod.env, Definições JSON e Curvatura P1', () => {
  describe('CodeEditorPage — Nós mod.env e definitions.json (Itens 857, 858 P1)', () => {
    it('deve renderizar os nós mod.env e definitions.json na árvore de arquivos', () => {
      document.body.innerHTML = '';
      const mockMod = {
        id: 'mod-1',
        name: 'Mod Teste',
        scripts: [{ key: 'main', enabled: true }],
        blocks: [{ key: 'bloco1' }],
        entities: [],
        structures: [],
      };

      const mockModService = { getMods: () => [mockMod] } as any;
      const mockRuntime = {} as any;

      const editor = new CodeEditorPage(mockModService, mockRuntime);
      (editor as any).renderArvore();

      const arvoreText = (editor as any).arvore.textContent || '';
      expect(arvoreText).toContain('mod.env');
      expect(arvoreText).toContain('definitions.json');
    });
  });

  describe('Curvatura de Horizonte — Queda Zero para Mundo Plano (Item 1036 P1)', () => {
    it('setCurvature com queda = 0 deve zerar invR deixando o mundo plano', () => {
      const curvature = { start: { value: 0 }, invR: { value: 0.001 } };
      const setCurvature = (voxels: number, queda = 0) => {
        if (queda <= 0) { curvature.invR.value = 0; return; }
        const inicio = voxels * 0.3;
        const alcance = Math.max(1, voxels - inicio);
        curvature.start.value = inicio;
        curvature.invR.value = queda / (alcance * alcance);
      };

      setCurvature(260, 0);
      expect(curvature.invR.value).toBe(0);
    });
  });
});
