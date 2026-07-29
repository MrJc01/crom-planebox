// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { ThirstSystem, HardcoreMode, WorldStatistics } from '../../src/player/interaction';
import { ShieldParry, ChargedAttack } from '../../src/entities/Combat';

describe('Batch 56 — Testes de Sede, Hardcore, Estatísticas, Parry e Ataque Carregado P2', () => {
  describe('interaction — Sede (Item 140 P2)', () => {
    it('deve diminuir a sede com o tempo quando ativado', () => {
      const thirst = new ThirstSystem(true);
      const initial = thirst.thirst;
      thirst.tick(10);
      expect(thirst.thirst).toBeLessThan(initial);
    });

    it('não deve diminuir a sede se estiver desativado', () => {
      const thirst = new ThirstSystem(false);
      const initial = thirst.thirst;
      thirst.tick(10);
      expect(thirst.thirst).toBe(initial);
    });

    it('deve restaurar a sede ao beber', () => {
      const thirst = new ThirstSystem(true);
      thirst.tick(50);
      thirst.drink(5);
      expect(thirst.thirst).toBeGreaterThan(17.5);
    });
  });

  describe('interaction — Modo Hardcore (Item 142 P2)', () => {
    it('deve indicar exclusão de mundo na morte se for hardcore', () => {
      const hc = new HardcoreMode();
      hc.isHardcore = true;
      const res = hc.onDeath();
      expect(res.deleteWorld).toBe(true);
      expect(res.message).toContain('apagado');
    });

    it('não deve apagar mundo se não for hardcore', () => {
      const hc = new HardcoreMode();
      const res = hc.onDeath();
      expect(res.deleteWorld).toBe(false);
    });
  });

  describe('interaction — Estatísticas do Mundo (Item 144 P2)', () => {
    it('deve registrar progresso do jogador', () => {
      const stats = new WorldStatistics();
      stats.recordBlockPlaced();
      stats.recordBlockBroken();
      stats.recordDeath();
      stats.addDistance(100);
      stats.addPlayTime(60);

      expect(stats.blocksPlaced).toBe(1);
      expect(stats.blocksBroken).toBe(1);
      expect(stats.deaths).toBe(1);
      expect(stats.distanceWalked).toBe(100);
      expect(stats.playTimeSeconds).toBe(60);
    });
  });

  describe('Combat — Bloqueio/Parry com Escudo (Item 153 P2)', () => {
    it('deve dar parry perfeito dentro da janela de 200ms', () => {
      const parry = new ShieldParry();
      parry.startBlock(1000);
      const res = parry.calculateDamageReduction(10, 1100);
      expect(res.isParry).toBe(true);
      expect(res.finalDamage).toBe(0);
    });

    it('deve dar bloqueio parcial após janela de parry', () => {
      const parry = new ShieldParry();
      parry.startBlock(1000);
      const res = parry.calculateDamageReduction(10, 1300);
      expect(res.isParry).toBe(false);
      expect(res.finalDamage).toBe(3);
    });
  });

  describe('Combat — Ataque Carregado (Item 154 P2)', () => {
    it('deve calcular dano proporcional ao tempo de carga', () => {
      const ca = new ChargedAttack();
      ca.startCharge(1000);
      const resHalf = ca.release(2000, 10);
      expect(resHalf.chargePercent).toBe(0.5);
      expect(resHalf.damage).toBe(20);

      ca.startCharge(1000);
      const resFull = ca.release(3000, 10);
      expect(resFull.chargePercent).toBe(1.0);
      expect(resFull.damage).toBe(30);
    });
  });
});
