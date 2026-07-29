// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { AnimalBreeding, FishingSystem, FurnaceProcessor } from '../../src/crafting/CraftingSystem';
import { InventoryWeightSystem, DifficultySettings } from '../../src/player/interaction';

describe('Batch 55 — Testes de Animais, Pesca, Fornalha, Peso de Inventário e Dificuldade P2', () => {
  describe('CraftingSystem — Criação de Animais (Item 134 P2)', () => {
    it('deve reproduzir dois animais disponíveis e gerar cria', () => {
      const breeding = new AnimalBreeding();
      const result = breeding.breed('vaca_1', 'vaca_2');
      expect(result).not.toBeNull();
      expect(result!.offspringId).toContain('baby');
    });

    it('deve impor cooldown após reprodução', () => {
      const breeding = new AnimalBreeding();
      breeding.breed('vaca_1', 'vaca_2');
      expect(breeding.canBreed('vaca_1')).toBe(false);
    });
  });

  describe('CraftingSystem — Pesca (Item 135 P2)', () => {
    it('deve retornar resultado determinístico por seed', () => {
      const r1 = FishingSystem.cast(42, 'rio');
      const r2 = FishingSystem.cast(42, 'rio');
      expect(r1.caught).toBe(r2.caught);
    });

    it('deve dar peixe grande no oceano quando pesca', () => {
      // Procurar seed que pega peixe
      for (let s = 1; s < 100; s++) {
        const r = FishingSystem.cast(s, 'oceano');
        if (r.caught) {
          expect(r.item).toBe('peixe_grande');
          break;
        }
      }
    });
  });

  describe('CraftingSystem — Fornalha (Item 136 P2)', () => {
    it('deve fundir minério de ferro em bloco de ferro', () => {
      expect(FurnaceProcessor.canSmelt(30)).toBe(true);
      const state = { inputBlock: 30, fuelRemaining: 20, cookProgress: 0, outputBlock: null as number | null };
      FurnaceProcessor.tick(state, 10);
      expect(state.outputBlock).toBe(21);
    });
  });

  describe('interaction — Peso de Inventário (Item 138 P2)', () => {
    it('deve calcular peso e verificar limite de carga', () => {
      const weight = new InventoryWeightSystem(50);
      weight.setBlockWeight(3, 5);
      const items = [{ block: 3, count: 10 }];
      expect(weight.calculateWeight(items)).toBe(50);
      expect(weight.canCarry(items)).toBe(true);
      expect(weight.canCarry([...items, { block: 3, count: 1 }])).toBe(false);
    });
  });

  describe('interaction — Dificuldade Configurável (Item 141 P2)', () => {
    it('deve retornar multiplicadores corretos por nível', () => {
      expect(DifficultySettings.getMultipliers('pacifico').damageMultiplier).toBe(0);
      expect(DifficultySettings.getMultipliers('dificil').spawnRate).toBe(2.0);
      expect(DifficultySettings.getMultipliers('normal').damageMultiplier).toBe(1.0);
    });
  });
});
