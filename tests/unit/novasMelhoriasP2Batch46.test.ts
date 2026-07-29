// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { VillageGenerator, FactionReputation } from '../../src/entities/EntitySystem';
import { EnchantmentSystem, Enchantment } from '../../src/player/velocidadeDeQuebra';
import { BlockTickSystem, BlockMetadataStore } from '../../src/world/blocks';

describe('Batch 46 — Testes de Vilas, Facções, Encantamentos, Tick de Bloco e Metadados P2', () => {
  describe('EntitySystem — Geração de Vila com NPCs (Item 013 P2)', () => {
    it('deve gerar uma vila com prédios e NPCs com missões', () => {
      const village = VillageGenerator.generateVillage(5, 10, 42);
      expect(village.buildings).toBeGreaterThanOrEqual(3);
      expect(village.npcs.length).toBeGreaterThan(0);
      expect(village.npcs[0].completed).toBe(false);
    });
  });

  describe('EntitySystem — Reputação com Facções (Item 014 P2)', () => {
    it('deve modificar reputação e classificar a posição com a facção', () => {
      const rep = new FactionReputation();
      expect(rep.getStanding('elfos')).toBe('neutro');

      rep.modifyReputation('elfos', 50);
      expect(rep.getStanding('elfos')).toBe('amigável');

      rep.modifyReputation('orcs', -40);
      expect(rep.getStanding('orcs')).toBe('hostil');
    });
  });

  describe('velocidadeDeQuebra — Encantamentos em Ferramentas (Item 017 P2)', () => {
    it('deve aplicar bônus de velocidade e dano por encantamento', () => {
      const enchants: Enchantment[] = [
        { id: 'eficiencia', level: 3, maxLevel: 5 },
        { id: 'afiacao', level: 2, maxLevel: 5 },
      ];
      const speed = EnchantmentSystem.applySpeedBonus(1.0, enchants);
      expect(speed).toBeGreaterThan(1.0);

      const damage = EnchantmentSystem.applyDamageBonus(5.0, enchants);
      expect(damage).toBeGreaterThan(5.0);
    });
  });

  describe('blocks — Tick de Bloco Agendado (Item 036 P2)', () => {
    it('deve agendar e disparar ticks de bloco no timing correto', () => {
      const ticks = new BlockTickSystem();
      ticks.schedule(0, 64, 0, 1, 3);

      expect(ticks.tick()).toHaveLength(0);
      expect(ticks.tick()).toHaveLength(0);
      const ready = ticks.tick();
      expect(ready).toHaveLength(1);
      expect(ready[0].blockType).toBe(1);
    });
  });

  describe('blocks — Metadados por Bloco (Item 037 P2)', () => {
    it('deve armazenar e consultar metadados de rotação e estado', () => {
      const store = new BlockMetadataStore();
      store.set(10, 64, 20, { rotation: 2, state: 'ativo' });

      const meta = store.get(10, 64, 20);
      expect(meta?.rotation).toBe(2);
      expect(meta?.state).toBe('ativo');

      store.remove(10, 64, 20);
      expect(store.get(10, 64, 20)).toBeUndefined();
    });
  });
});
