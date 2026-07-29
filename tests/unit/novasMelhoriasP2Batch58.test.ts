// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  AutomaticDefenseTowerSystem,
  PvPWorldSetting,
  SafeZoneManager,
  CustomModWeaponRegistry,
  DifficultyScaling,
} from '../../src/entities/EntitySystem';

describe('Batch 58 — Testes de Torres Automáticas, PvP, Zonas Seguras, Armas de Mods e Escalonamento P2', () => {
  describe('EntitySystem — Torres Automáticas (Item 160 P2)', () => {
    it('deve disparar contra inimigos dentro do alcance', () => {
      const sys = new AutomaticDefenseTowerSystem();
      sys.placeTower(0, 64, 0, 10, 15, 1.0);

      const hostiles = [
        { id: 'mob1', x: 5, y: 64, z: 0, health: 20 },
        { id: 'mob2', x: 50, y: 64, z: 0, health: 20 },
      ];

      const shots = sys.tick(1.0, hostiles);
      expect(shots.length).toBe(1);
      expect(shots[0].targetId).toBe('mob1');
      expect(shots[0].damage).toBe(15);
    });
  });

  describe('EntitySystem — PvP Opcional (Item 162 P2)', () => {
    it('deve bloquear ataque PvP se desativado', () => {
      const pvp = new PvPWorldSetting();
      expect(pvp.canAttackPlayer('player1', 'player2')).toBe(false);

      pvp.pvpEnabled = true;
      expect(pvp.canAttackPlayer('player1', 'player2')).toBe(true);
    });

    it('não deve permitir auto-ataque mesmo com PvP ligado', () => {
      const pvp = new PvPWorldSetting();
      pvp.pvpEnabled = true;
      expect(pvp.canAttackPlayer('player1', 'player1')).toBe(false);
    });
  });

  describe('EntitySystem — Zonas Seguras (Item 163 P2)', () => {
    it('deve identificar se uma posição está dentro de zona segura', () => {
      const safe = new SafeZoneManager();
      safe.addSafeZone(100, 100, 20);

      expect(safe.isInSafeZone(105, 105)).toBe(true);
      expect(safe.isInSafeZone(200, 200)).toBe(false);
    });
  });

  describe('EntitySystem — Armas de Mods Customizadas (Item 167 P2)', () => {
    it('deve registrar e consultar armas de mods', () => {
      const reg = new CustomModWeaponRegistry();
      reg.register({ id: 'espada_fogo', name: 'Espada Flamejante', damage: 25, effect: 'queimar' });

      const w = reg.get('espada_fogo');
      expect(w).not.toBeUndefined();
      expect(w?.damage).toBe(25);
      expect(w?.effect).toBe('queimar');
    });
  });

  describe('EntitySystem — Escalonamento de Dificuldade (Item 168 P2)', () => {
    it('deve aumentar multiplicador com dias e bosses derrotados', () => {
      const initial = DifficultyScaling.calculateMultiplier(0, 0);
      expect(initial).toBe(1.0);

      const scaled = DifficultyScaling.calculateMultiplier(10, 2);
      expect(scaled).toBeGreaterThan(1.5);
    });
  });
});
