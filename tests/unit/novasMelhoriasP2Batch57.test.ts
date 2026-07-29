// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { ElementalResistance, BossPhasePattern, BossSummonArena } from '../../src/entities/Combat';
import { FlyingPathfinding3D, PlaceableTrap, PathWorld } from '../../src/entities/Pathfinding';

describe('Batch 57 — Testes de Resistência Elemental, Fases de Boss, Arena de Invocação, Pathfinding 3D e Armadilhas P2', () => {
  describe('Combat — Resistências Elementais (Item 155 P2)', () => {
    it('deve reduzir dano conforme a resistência', () => {
      const el = new ElementalResistance();
      el.setResistance('fogo', 0.5); // 50% de resistência a fogo
      expect(el.calculateDamage(20, 'fogo')).toBe(10);
      expect(el.calculateDamage(20, 'fisico')).toBe(20);
    });

    it('deve tornar o inimigo imune se resistência for 1.0', () => {
      const el = new ElementalResistance();
      el.setResistance('gelo', 1.0);
      expect(el.calculateDamage(50, 'gelo')).toBe(0);
    });
  });

  describe('Combat — Boss com Fases e Padrões de Ataque (Item 156 P2)', () => {
    it('deve mudar de fase e padrão conforme a vida diminui', () => {
      const boss = new BossPhasePattern(100);
      expect(boss.updatePhase(100)).toBe('fase1');
      expect(boss.getAttackPattern()).toBe('basic_melee');

      expect(boss.updatePhase(50)).toBe('fase2');
      expect(boss.getAttackPattern()).toBe('charge_and_summon');

      expect(boss.updatePhase(20)).toBe('fase3');
      expect(boss.getAttackPattern()).toBe('frenzy_area_attack');
    });
  });

  describe('Combat — Arenas de Boss com Invocação (Item 157 P2)', () => {
    it('deve invocar o boss apenas com item de invocação em altura adequada', () => {
      expect(BossSummonArena.canSummon('item_invocacao_boss', 0, 64, 0)).toBe(true);
      expect(BossSummonArena.canSummon('outro_item', 0, 64, 0)).toBe(false);

      const res = BossSummonArena.summonBoss('item_invocacao_boss', 10, 65, 10);
      expect(res?.bossSpawned).toBe(true);
      expect(res?.arenaRadius).toBe(25);
    });
  });

  describe('Pathfinding — Pathfinding 3D para Voadores (Item 158 P2)', () => {
    it('deve traçar caminho 3D em direção ao alvo', () => {
      const dummyWorld: PathWorld = { getBlock: () => 0 };
      const path = FlyingPathfinding3D.find3DPath(dummyWorld, { x: 0, y: 10, z: 0 }, { x: 3, y: 13, z: 3 }, 10);
      expect(path.length).toBeGreaterThan(1);
      const last = path[path.length - 1];
      expect(last.x).toBe(3);
      expect(last.y).toBe(13);
      expect(last.z).toBe(3);
    });
  });

  describe('Pathfinding — Armadilhas Colocáveis (Item 159 P2)', () => {
    it('deve disparar armadilha e causar dano quando pisada', () => {
      const trapSys = new PlaceableTrap();
      trapSys.place(5, 64, 5, 'espinho', 15);

      const t1 = trapSys.checkTrigger(5, 64, 5);
      expect(t1).not.toBeNull();
      expect(t1?.damage).toBe(15);
      expect(t1?.triggered).toBe(true);

      // Não deve disparar duas vezes
      const t2 = trapSys.checkTrigger(5, 64, 5);
      expect(t2).toBeNull();
    });
  });
});
