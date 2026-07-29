// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  DecorativeBlockCollision,
  ModCustomPhysicsRegistry,
  PhysicsTestScenarios,
} from '../../src/world/physics';
import { ColoredBlockLight, EntityShadowProjection } from '../../src/render/grading';

describe('Batch 64 — Testes de Colisão Decorativa, Física Customizada, Cenários de Teste, Luz Colorida e Sombras P2', () => {
  describe('physics — Colisão com Blocos Decorativos (Item 237 P2)', () => {
    it('deve retornar hitbox menor para tochas', () => {
      const hb = DecorativeBlockCollision.getHitbox(12);
      expect(hb.sizeX).toBe(0.5);
      expect(hb.sizeY).toBe(1);
    });

    it('deve detectar se ponto está dentro do hitbox', () => {
      expect(DecorativeBlockCollision.isInsideHitbox(12, 0.5, 0.5, 0.5)).toBe(true);
      expect(DecorativeBlockCollision.isInsideHitbox(12, 0.1, 0.5, 0.1)).toBe(false);
    });
  });

  describe('physics — Física Customizada de Mods (Item 239 P2)', () => {
    it('deve registrar e consultar definições de física por bloco', () => {
      const reg = new ModCustomPhysicsRegistry();
      reg.register({ blockId: 99, bounce: 0.8, slowFactor: 0.5 });

      const def = reg.get(99);
      expect(def?.bounce).toBe(0.8);
      expect(def?.slowFactor).toBe(0.5);
    });
  });

  describe('physics — Cenários de Teste de Física (Item 240 P2)', () => {
    it('deve simular gravidade e parar no chão y=0', () => {
      const finalY = PhysicsTestScenarios.runGravityTest(100, 200, 0.016);
      expect(finalY).toBe(0);
    });
  });

  describe('grading — Luz Colorida por Bloco Emissivo (Item 251 P2)', () => {
    it('deve retornar emissão de tocha com cor âmbar', () => {
      const emission = ColoredBlockLight.getEmission(12);
      expect(emission).not.toBeNull();
      expect(emission!.r).toBe(1.0);
      expect(emission!.intensity).toBe(12);
    });

    it('deve retornar null para blocos sem emissão', () => {
      expect(ColoredBlockLight.getEmission(1)).toBeNull();
    });
  });

  describe('grading — Sombra Projetada por Entidades (Item 253 P2)', () => {
    it('deve calcular raio de sombra proporcional ao ângulo solar', () => {
      const r1 = EntityShadowProjection.computeShadowRadius(2.0, Math.PI / 2);
      const r2 = EntityShadowProjection.computeShadowRadius(2.0, Math.PI / 6);
      expect(r1).toBeLessThan(r2); // Sol alto = sombra menor
    });

    it('deve calcular opacidade decaindo com a distância', () => {
      expect(EntityShadowProjection.computeShadowOpacity(0, 5)).toBe(1.0);
      expect(EntityShadowProjection.computeShadowOpacity(5, 5)).toBe(0);
    });
  });
});
