// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  VillageEconomyMarket,
  QuestContractSystem,
  NonBlockModItemRegistry,
  AutoCraftingSystem,
} from '../../src/crafting/CraftingSystem';

describe('Batch 61 — Testes de Economia de Vila, Contratos, Mod Items e Autocrafting P2', () => {
  describe('CraftingSystem — Economia de Vila com Oferta e Demanda (Itens 202, 203 P2)', () => {
    it('deve calcular preço dinâmico conforme a oferta e demanda', () => {
      const market = new VillageEconomyMarket();
      market.setItemPrice(30, 10, 10, 10); // Preço base = 10

      expect(market.getCurrentPrice(30)).toBe(10);

      // Comprar aumenta demanda e reduz oferta, subindo o preço
      market.recordTransaction(30, true, 5);
      expect(market.getCurrentPrice(30)).toBeGreaterThan(10);
    });
  });

  describe('CraftingSystem — Encomendas/Contratos (Item 204 P2)', () => {
    it('deve permitir aceitar e completar contratos de entrega', () => {
      const quests = new QuestContractSystem();
      quests.addContract({
        id: 'c1',
        title: 'Entrega de Madeira',
        targetBlock: 7,
        targetCount: 10,
        rewardCoins: 50,
        completed: false,
      });

      const inv = new Map<number, number>([[7, 15]]);
      const result = quests.tryComplete('c1', inv);

      expect(result.success).toBe(true);
      expect(result.reward).toBe(50);
      expect(inv.get(7)).toBe(5);
      expect(quests.getActiveContracts().length).toBe(0);
    });
  });

  describe('CraftingSystem — Itens Não-Bloco de Mods (Item 207 P2)', () => {
    it('deve registrar e recuperar ferramentas/comidas de mods', () => {
      const reg = new NonBlockModItemRegistry();
      reg.register({ id: 'maca_dourada', name: 'Maçã Dourada', type: 'comida', value: 100 });

      const item = reg.get('maca_dourada');
      expect(item?.type).toBe('comida');
      expect(item?.value).toBe(100);
    });
  });

  describe('CraftingSystem — Autocrafting de Itens Intermediários (Item 209 P2)', () => {
    it('deve verificar se é possível craftar automaticamente item intermediário', () => {
      const inv = new Map<number, number>([[7, 4]]); // Madeira para tábuas
      expect(AutoCraftingSystem.canAutoCraftIntermediate('crafting_table', inv)).toBe(false);
    });
  });
});
