// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { Appearance, CharacterRace } from '../../src/player/Appearance';
import { WorldRepository } from '../../src/storage/WorldRepository';

vi.mock('../../src/storage/Database', () => ({
  db: {
    worlds: {
      put: vi.fn().mockResolvedValue(true),
    },
  },
}));

describe('Batch 27 — Testes de Raças, Atributos Extensíveis e Mundo Determinístico P1', () => {
  describe('Appearance — Raças de Personagem & Atributos Extensíveis (Itens 1571, 1572 P1)', () => {
    it('deve suportar raças de personagem e saco de atributos dinâmicos', () => {
      const race: CharacterRace = 'elfo';
      const appearance: Appearance = {
        name: 'Legolas',
        skin: '#e2e8f0',
        hair: '#fef08a',
        shirt: '#15803d',
        pants: '#3f6212',
        boots: '#451a03',
        accent: '#fbbf24',
        eyes: '#0284c7',
        hairStyle: 'longo',
        build: 1.0,
        race,
        customAttributes: { agilidade: 15, mana: 100 },
      };

      expect(appearance.race).toBe('elfo');
      expect(appearance.customAttributes).toEqual({ agilidade: 15, mana: 100 });
    });
  });

  describe('WorldRepository — Mundo de Testes Determinístico (Item 1574 P1)', () => {
    it('deve criar um registro de mundo com semente fixa e id previsível', async () => {
      const world = await WorldRepository.createDeterministicTestWorld(99999);

      expect(world.id).toBe('test-world-99999');
      expect(world.seed).toBe(99999);
      expect(world.defaultGameMode).toBe('creative');
    });
  });
});
