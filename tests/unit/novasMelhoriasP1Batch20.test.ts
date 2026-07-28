// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { UIManager } from '../../src/ui/UIManager';
import { CodeEditorPage } from '../../src/ui/CodeEditorPage';

describe('Batch 20 — Testes de Animações de Telas e Busca/Substituição P1', () => {
  describe('UIManager — Animações de Entrada/Saída com Accessibility (Item 1153 P1)', () => {
    it('deve aplicar estilos de animação quando prefers-reduced-motion é falso', () => {
      const ui = new UIManager();
      const div = document.createElement('div');

      ui.animateScreenTransition(div, true);
      expect(div.style.opacity).toBe('1');
      expect(div.style.transform).toBe('scale(1)');

      ui.animateScreenTransition(div, false);
      expect(div.style.opacity).toBe('0');
      expect(div.style.transform).toBe('scale(0.96)');
    });
  });

  describe('CodeEditorPage — Buscar e Substituir (Item 861 P1)', () => {
    it('deve substituir todas as ocorrências da palavra pesquisada no editor', () => {
      const mockModService = { getMods: () => [] } as any;
      const editor = new CodeEditorPage(mockModService, {} as any);

      (editor as any).setCodigo('const x = 10; console.log(x);');
      const count = editor.findAndReplace('x', 'contador');

      expect(count).toBe(2);
      expect((editor as any).getCodigo()).toBe('const contador = 10; console.log(contador);');
    });
  });
});
