// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { LandClaimSystem } from '../../src/world/world';
import { StructureSnapshot } from '../../src/crafting/StructureTemplates';
import { applyFilmicToneMapping } from '../../src/render/grading';
import { generateBlockBreakParticles } from '../../src/render/precipitation';
import { getBreakCrackStage } from '../../src/player/interaction';

describe('Batch 47 — Testes de Claims, Snapshot, ToneMapping, Partículas e Rachaduras P2', () => {
  describe('world — Regiões Protegidas / Claim (Item 041 P2)', () => {
    it('deve proteger área e permitir alteração apenas pelo proprietário', () => {
      const claims = new LandClaimSystem();
      claims.addClaim({ id: 'c1', ownerId: 'player1', minX: 0, maxX: 10, minZ: 0, maxZ: 10 });

      expect(claims.canModify(5, 5, 'player1')).toBe(true);
      expect(claims.canModify(5, 5, 'player2')).toBe(false);
      expect(claims.canModify(20, 20, 'player2')).toBe(true);
    });
  });

  describe('StructureTemplates — Snapshot / Clone de Região (Item 047 P2)', () => {
    it('deve capturar blocos em um volume 3D', () => {
      const snap = new StructureSnapshot();
      const mockWorld = {
        getBlock: (x: number, y: number, z: number) => (x === 1 && y === 1 && z === 1 ? 3 : 0),
      };

      snap.capture(mockWorld, 0, 0, 0, 2, 2, 2);
      const blocks = snap.getBlocks();

      expect(blocks.length).toBe(1);
      expect(blocks[0].blockType).toBe(3);
    });
  });

  describe('grading — Tonemapping Fílmico Leve (Item 059 P2)', () => {
    it('deve aplicar curva fílmica mantendo valores normalizados', () => {
      const mapped = applyFilmicToneMapping([0.5, 0.8, 1.2]);

      expect(mapped[0]).toBeGreaterThan(0);
      expect(mapped[0]).toBeLessThanOrEqual(1.0);
      expect(mapped[2]).toBeLessThanOrEqual(1.0);
    });
  });

  describe('precipitation — Partículas de Quebra (Item 061 P2)', () => {
    it('deve retornar a partícula correspondente ao bloco quebrado', () => {
      const pWater = generateBlockBreakParticles(6);
      expect(pWater.type).toBe('respingo');

      const pLava = generateBlockBreakParticles(28);
      expect(pLava.type).toBe('fagulha');

      const pStone = generateBlockBreakParticles(3);
      expect(pStone.type).toBe('poeira');
    });
  });

  describe('interaction — Estágios de Rachadura (Item 064 P2)', () => {
    it('deve mapear o progresso de quebra para o estágio de rachadura (0 a 9)', () => {
      expect(getBreakCrackStage(0)).toBe(-1);
      expect(getBreakCrackStage(0.15)).toBe(1);
      expect(getBreakCrackStage(0.95)).toBe(9);
    });
  });
});
