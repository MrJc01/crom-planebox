// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { ModBiomeRegistry } from '../../src/mods/ModAPI';
import { RegionRegenerator } from '../../src/world/world';
import { StatusEffectSystem, PotionCrafting } from '../../src/entities/Combat';
import { FarmingSystem } from '../../src/crafting/CraftingSystem';

describe('Batch 54 — Testes de Mod Biomas, Regeneração, Status, Poções e Agricultura P2', () => {
  describe('ModAPI — Registro de Biomas por Mod (Item 118 P2)', () => {
    it('deve registrar e listar biomas de mod', () => {
      const reg = new ModBiomeRegistry();
      expect(reg.register({ id: 'cogumelo', temperature: 0.7, humidity: 0.9, surfaceBlock: 2, subBlock: 3 })).toBe(true);
      expect(reg.list().length).toBe(1);
      expect(reg.get('cogumelo')?.temperature).toBe(0.7);
    });

    it('não deve registrar bioma duplicado', () => {
      const reg = new ModBiomeRegistry();
      reg.register({ id: 'x', temperature: 0, humidity: 0, surfaceBlock: 1, subBlock: 2 });
      expect(reg.register({ id: 'x', temperature: 0, humidity: 0, surfaceBlock: 1, subBlock: 2 })).toBe(false);
    });
  });

  describe('world — Regeneração Preservando Construções (Item 119 P2)', () => {
    it('deve regenerar bloco natural e preservar bloco do jogador', () => {
      const regen = new RegionRegenerator();
      regen.markPlayerBuilt(5, 64, 5);

      expect(regen.regenerateBlock(5, 64, 5, 3).regenerated).toBe(false);
      expect(regen.regenerateBlock(10, 64, 10, 3).regenerated).toBe(true);
    });
  });

  describe('Combat — Efeitos de Status (Item 131 P2)', () => {
    it('deve aplicar veneno e calcular delta de vida', () => {
      const sys = new StatusEffectSystem();
      sys.apply('veneno', 5, 2);
      const result = sys.tick(1);
      expect(result.healthDelta).toBeLessThan(0);
    });

    it('deve aplicar velocidade e calcular multiplicador', () => {
      const sys = new StatusEffectSystem();
      sys.apply('velocidade', 10, 1);
      const result = sys.tick(1);
      expect(result.speedMultiplier).toBeGreaterThan(1.0);
    });
  });

  describe('Combat — Poções Craftáveis (Item 132 P2)', () => {
    it('deve retornar receitas de poções', () => {
      const recipes = PotionCrafting.getRecipes();
      expect(recipes.length).toBeGreaterThan(0);
    });

    it('deve filtrar poções craftáveis pelos itens disponíveis', () => {
      const craftable = PotionCrafting.canCraft([14, 6, 3]);
      expect(craftable.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('CraftingSystem — Agricultura (Item 133 P2)', () => {
    it('deve plantar, crescer por ticks e colher', () => {
      const farm = new FarmingSystem();
      farm.plant(0, 64, 0, 'trigo');

      // Cresce por 60 ticks (3 estágios × 20 ticks)
      for (let i = 0; i < 60; i++) farm.tick();

      const harvested = farm.harvest(0, 64, 0);
      expect(harvested).not.toBeNull();
      expect(harvested!.stage).toBe(3);
    });
  });
});
