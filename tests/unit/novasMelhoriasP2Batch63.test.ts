// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  BlockFrictionSystem,
  ExplosionPhysics,
  ProjectilePhysics,
  MovingPlatform,
  PistonSystem,
} from '../../src/world/physics';
import { EntityPushSystem } from '../../src/entities/EntitySystem';

describe('Batch 63 — Testes de Atrito, Empurrão de Entidades, Explosões, Projéteis, Plataformas e Pistões P2', () => {
  describe('physics — Atrito por Tipo de Bloco (Item 227 P2)', () => {
    it('deve retornar atrito reduzido para gelo e elevado para areia/lama', () => {
      expect(BlockFrictionSystem.getFriction(16)).toBeGreaterThan(0.9); // Gelo
      expect(BlockFrictionSystem.getFriction(4)).toBeLessThan(0.5); // Areia
      expect(BlockFrictionSystem.getFriction(1)).toBe(0.7); // Padrão
    });
  });

  describe('EntitySystem — Empurrão entre Entidades (Item 228 P2)', () => {
    it('deve calcular força de repulsão quando duas entidades estão sobrepostas', () => {
      const posA = { x: 0, y: 0, z: 0 };
      const posB = { x: 0.5, y: 0, z: 0 };

      const rep = EntityPushSystem.calculateRepulsion(posA, posB, 1.0);
      expect(rep.pushA.x).toBeLessThan(0);
      expect(rep.pushB.x).toBeGreaterThan(0);
    });

    it('não deve empurrar se estiverem distantes', () => {
      const posA = { x: 0, y: 0, z: 0 };
      const posB = { x: 5, y: 0, z: 0 };
      const rep = EntityPushSystem.calculateRepulsion(posA, posB, 1.0);
      expect(rep.pushA.x).toBe(0);
    });
  });

  describe('physics — Explosões e Resistência a Explosão (Itens 229, 230 P2)', () => {
    it('deve calcular destruição de blocos por raio e poder', () => {
      const dummyWorld = (x: number, y: number, z: number) => {
        if (x === 0 && y === 0 && z === 1) return 2; // Terra
        if (x === 0 && y === 0 && z === 2) return 3; // Obsidian
        return 0;
      };

      const destroyed = ExplosionPhysics.calculateExplosionDestruction(0, 0, 0, 3, 50, dummyWorld);
      expect(destroyed.some(b => b.z === 1)).toBe(true); // Terra destruída
      expect(destroyed.some(b => b.z === 2)).toBe(false); // Obsidian resistiu
    });
  });

  describe('physics — Projéteis com Gravidade (Item 231 P2)', () => {
    it('deve simular balística com aceleração da gravidade e detectar colisão', () => {
      const proj = new ProjectilePhysics(0, 10, 0, 5, 0, 0, 9.8);
      const isSolid = (x: number, y: number, z: number) => y <= 0;

      for (let i = 0; i < 20; i++) {
        proj.tick(0.1, isSolid);
        if (!proj.active) break;
      }

      expect(proj.pos.y).toBeLessThan(10);
      expect(proj.active).toBe(false); // Colidiu com o chão y <= 0
    });
  });

  describe('physics — Plataformas Móveis (Item 232 P2)', () => {
    it('deve mover plataforma suavemente entre waypoints', () => {
      const p1 = new THREE.Vector3(0, 0, 0);
      const p2 = new THREE.Vector3(10, 0, 0);
      const platform = new MovingPlatform([p1, p2], 2.0);

      platform.tick(1.0);
      expect(platform.pos.x).toBe(2.0);
    });
  });

  describe('physics — Pistões Empurrando Blocos (Item 233 P2)', () => {
    it('deve calcular movimentação da fileira de blocos ao empurrar', () => {
      const dummyWorld = (x: number, y: number, z: number) => {
        if (x === 1) return 2;
        if (x === 2) return 2;
        return 0; // Espaço vazio em x = 3
      };

      const moves = PistonSystem.pushBlocks(0, 0, 0, 1, 0, 0, 12, dummyWorld);
      expect(moves).not.toBeNull();
      expect(moves?.length).toBe(2);
    });
  });
});
