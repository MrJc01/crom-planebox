// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Interaction } from '../../src/player/interaction';
import { InventoryModal } from '../../src/ui/InventoryModal';

describe('Batch 37 — Testes de Quebra em Grupo, Preview Translucido e Chat de IA no Menu P1', () => {
  describe('Interaction — Quebra em Grupo e Preview Translucido (Itens 1659, 1660 P1)', () => {
    const mockScene = { add: () => {}, remove: () => {} } as any;

    it('deve calcular a área de quebra em grupo para modos 3x3 e círculo', () => {
      const interaction = new Interaction({} as any, {} as any, { yaw: 0, pitch: 0, position: { x: 0, y: 0, z: 0 } } as any, mockScene);

      const singleArea = interaction.getBreakArea(1, 'single', 0, 64, 0);
      expect(singleArea.length).toBe(1);

      const area3x3 = interaction.getBreakArea(1, '3x3', 0, 64, 0);
      expect(area3x3.length).toBe(9);

      const circleArea = interaction.getBreakArea(2, 'circle', 0, 64, 0);
      expect(circleArea.length).toBeGreaterThan(1);
    });

    it('deve retornar contagem de blocos destacados para preview translúcido', () => {
      const interaction = new Interaction({} as any, {} as any, { yaw: 0, pitch: 0, position: { x: 0, y: 0, z: 0 } } as any, mockScene);
      const preview = interaction.renderMiningPreview(1, '3x3', 0, 64, 0);

      expect(preview.highlightedCount).toBe(9);
    });
  });

  describe('InventoryModal — Aba de Chat no Menu (Item 1556 P1)', () => {
    it('deve montar a aba [Chat IA] com a lista de sessões de conversa', () => {
      const modal = new InventoryModal({ hotbar: [] } as any);
      const container = document.createElement('div');
      modal['rebuildTabs']();

      const tabChat = modal['tabsComponent']['abas'].find((a) => a.id === 'chat');
      expect(tabChat).toBeDefined();

      tabChat?.montar(container);
      expect(container.innerHTML).toContain('Sessões da IA Engenheira');
      expect(container.innerHTML).toContain('Sessão Principal');
    });
  });
});
