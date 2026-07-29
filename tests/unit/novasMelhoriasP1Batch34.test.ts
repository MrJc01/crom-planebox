// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { InventoryModal } from '../../src/ui/InventoryModal';
import { updateRainPuddles } from '../../src/world/invernada';
import { B } from '../../src/world/blocks';

describe('Batch 34 — Testes de Mochila, Indicadores de Sobrevivência e Poças de Chuva P1', () => {
  describe('InventoryModal — Mochila e Indicadores de Sobrevivência (Itens 1668, 1669 P1)', () => {
    it('deve renderizar a grade da mochila de sobrevivência', () => {
      const mockInteraction = {
        hotbar: [],
        inventory: { slots: [{ block: B.STONE, count: 64 }] },
      } as any;

      const modal = new InventoryModal(mockInteraction);
      const container = document.createElement('div');
      modal.renderBackpackGrid(container);

      expect(container.children.length).toBe(1);
      expect(container.innerHTML).toContain('64');
    });

    it('deve renderizar indicadores visuais de armadura e durabilidade', () => {
      const modal = new InventoryModal({ hotbar: [] } as any);
      const container = document.createElement('div');
      container.appendChild(document.createElement('div'));
      modal.renderSurvivalStats(container);

      expect(container.innerHTML).toContain('Armadura');
      expect(container.innerHTML).toContain('Durabilidade');
    });
  });

  describe('invernada — Poças d\'Água Dinâmicas com Chuva (Item 1621 P1)', () => {
    it('deve acumular poças na chuva e secá-las sob sol', () => {
      const setBlockSpy = vi.fn();
      let currentBlock = B.DIRT;
      const mockWorld = {
        surfaceY: vi.fn().mockReturnValue(64),
        getBlock: vi.fn(() => currentBlock),
        setBlock: setBlockSpy,
      };

      const countRain = updateRainPuddles(mockWorld, true, 0, 0, 1);
      expect(countRain).toBeGreaterThan(0);
      expect(setBlockSpy).toHaveBeenCalledWith(expect.any(Number), 65, expect.any(Number), B.WATER);

      currentBlock = B.WATER;
      const countSun = updateRainPuddles(mockWorld, false, 0, 0, 1);
      expect(countSun).toBeGreaterThan(0);
      expect(setBlockSpy).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expect.any(Number), B.AIR);
    });
  });
});
