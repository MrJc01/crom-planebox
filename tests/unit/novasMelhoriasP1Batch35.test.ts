// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { InventoryModal } from '../../src/ui/InventoryModal';

describe('Batch 35 — Testes das Abas Habilidades, Mapa e Opções P1', () => {
  describe('InventoryModal — Abas [Habilidades], [Mapa] e [Opções] (Itens 1188, 1190, 1191 P1)', () => {
    it('deve montar a aba [Habilidades] com a árvore visual de melhorias', () => {
      const modal = new InventoryModal({ hotbar: [] } as any);
      const container = document.createElement('div');
      modal['rebuildTabs']();

      const tabHabilidades = modal['tabsComponent']['abas'].find((a) => a.id === 'habilidades');
      expect(tabHabilidades).toBeDefined();

      tabHabilidades?.montar(container);
      expect(container.innerHTML).toContain('Mineração Ágil');
      expect(container.innerHTML).toContain('Visão Noturna');
    });

    it('deve montar a aba [Mapa] com a cartografia do mundo', () => {
      const modal = new InventoryModal({ hotbar: [] } as any);
      const container = document.createElement('div');
      modal['rebuildTabs']();

      const tabMapa = modal['tabsComponent']['abas'].find((a) => a.id === 'mapa');
      expect(tabMapa).toBeDefined();

      tabMapa?.montar(container);
      expect(container.innerHTML).toContain('Cartografia do Mundo');
      expect(container.innerHTML).toContain('Waypoints Registrados');
    });

    it('deve montar a aba [Opções] com configurações de aplicação instantânea', () => {
      const modal = new InventoryModal({ hotbar: [] } as any);
      const container = document.createElement('div');
      modal['rebuildTabs']();

      const tabOpcoes = modal['tabsComponent']['abas'].find((a) => a.id === 'opcoes');
      expect(tabOpcoes).toBeDefined();

      tabOpcoes?.montar(container);
      expect(container.innerHTML).toContain('Configurações (Aplicação Instantânea)');
      expect(container.innerHTML).toContain('Vídeo');
      expect(container.innerHTML).toContain('Áudio');
    });
  });
});
