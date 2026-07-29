// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  FavoriteRecipesSystem,
  InventorySearchSort,
  RecipeUsageStatistics,
} from '../../src/crafting/CraftingSystem';
import { DragDropHotbarInventory, RecipePreview3D } from '../../src/player/interaction';

describe('Batch 62 — Testes de Receitas Favoritas, Ordenação do Inventário, Drag&Drop, Pré-visualização 3D e Estatísticas P2', () => {
  describe('CraftingSystem — Favoritar Receitas (Item 210 P2)', () => {
    it('deve alternar receitas favoritas', () => {
      const favs = new FavoriteRecipesSystem();
      expect(favs.toggleFavorite('plank_from_log')).toBe(true);
      expect(favs.isFavorite('plank_from_log')).toBe(true);

      expect(favs.toggleFavorite('plank_from_log')).toBe(false);
      expect(favs.isFavorite('plank_from_log')).toBe(false);
    });
  });

  describe('CraftingSystem — Busca e Ordenação no Inventário (Item 211 P2)', () => {
    it('deve filtrar por nome e ordenar por quantidade ou nome', () => {
      const items = [
        { id: 1, name: 'Terra', count: 64 },
        { id: 2, name: 'Pedra', count: 100 },
        { id: 3, name: 'Tijolo', count: 10 },
      ];

      const sortedByCount = InventorySearchSort.filterAndSort(items, '', 'count');
      expect(sortedByCount[0].name).toBe('Pedra');

      const filtered = InventorySearchSort.filterAndSort(items, 'ti', 'name');
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Tijolo');
    });
  });

  describe('interaction — Arrastar e Soltar (Item 213 P2)', () => {
    it('deve trocar slots entre inventário e hotbar', () => {
      const inv = new DragDropHotbarInventory();
      inv.setHotbarSlot(0, 10);
      inv.setInventorySlot(5, 20);

      inv.swapSlot('hotbar', 0, 'inventory', 5);

      expect(inv.getHotbar()[0]).toBe(20);
      expect(inv.getInventory()[5]).toBe(10);
    });
  });

  describe('interaction — Pré-visualização 3D de Receita (Item 214 P2)', () => {
    it('deve retornar dados de pré-visualização 3D', () => {
      const preview = RecipePreview3D.getPreviewData('plank_from_log');
      expect(preview.meshType).toBe('box_preview');
      expect(preview.scale).toBe(1.0);
    });
  });

  describe('CraftingSystem — Estatísticas de Uso de Receita (Item 216 P2)', () => {
    it('deve contabilizar o número de crafts realizados', () => {
      const stats = new RecipeUsageStatistics();
      stats.recordCraft('torch_from_coal');
      stats.recordCraft('torch_from_coal');

      expect(stats.getUsageCount('torch_from_coal')).toBe(2);
      expect(stats.getUsageCount('outra_receita')).toBe(0);
    });
  });
});
