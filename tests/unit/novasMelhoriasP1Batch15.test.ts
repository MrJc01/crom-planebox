// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryModal } from '../../src/ui/InventoryModal';
import { vazio } from '../../src/ui/theme';

describe('Batch 15 — Testes de Abas Habilidades/Mapa e Estado Vazio P1', () => {
  describe('Estado Vazio — vazio() (Item 1154 P1)', () => {
    it('deve renderizar elemento div com mensagem e dica informativa', () => {
      const el = vazio('Nenhum item encontrado', 'Tente mudar o filtro de busca.');
      expect(el.textContent).toContain('Nenhum item encontrado');
      expect(el.textContent).toContain('Tente mudar o filtro de busca.');
    });
  });

  describe('InventoryModal — Abas Habilidades e Mapa (Itens 1188, 1190 P1)', () => {
    let mockInteraction: any;

    beforeEach(() => {
      document.body.innerHTML = '';
      mockInteraction = {
        selected: 0,
        hotbar: Array.from({ length: 9 }, (_, i) => ({
          label: i === 0 ? 'Item' : 'Vazio',
          block: i === 0 ? 1 : -1,
          count: 1,
          infinite: false,
        })),
        onChanged: () => {},
      };
    });

    it('deve montar a aba Habilidades com a árvore de melhorias (Item 1188 P1)', () => {
      const modal = new InventoryModal(mockInteraction);
      modal.gateCreativeCatalog = () => false;
      modal.open();

      (modal as any).tabsComponent.ir('habilidades');
      const text = modal.raiz.textContent || '';
      expect(text).toContain('Habilidades');
      expect(text).toContain('Mineração Ágil');
      expect(text).toContain('Mochila Expandida');
    });

    it('deve montar a aba Mapa com informações de cartografia (Item 1190 P1)', () => {
      const modal = new InventoryModal(mockInteraction);
      modal.gateCreativeCatalog = () => false;
      modal.open();

      (modal as any).tabsComponent.ir('mapa');
      const text = modal.raiz.textContent || '';
      expect(text).toContain('Mapa');
      expect(text).toContain('Cartografia do Mundo');
    });
  });
});
