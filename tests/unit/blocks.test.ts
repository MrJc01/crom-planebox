import { describe, it, expect } from 'vitest';
import { B, BLOCKS, isSolid, isOpaque, isReplaceable, isSupport, isDecor } from '../../src/world/blocks';

describe('blocks.ts', () => {
  it('AIR não é sólido, não é opaco e é substituível', () => {
    expect(isSolid(B.AIR)).toBe(false);
    expect(isOpaque(B.AIR)).toBe(false);
    expect(isReplaceable(B.AIR)).toBe(true);
  });

  it('STONE é sólido, opaco e não substituível', () => {
    expect(isSolid(B.STONE)).toBe(true);
    expect(isOpaque(B.STONE)).toBe(true);
    expect(isReplaceable(B.STONE)).toBe(false);
  });

  it('WATER e LAVA não são sólidos nem opacos, mas são substituíveis (dá pra construir dentro)', () => {
    for (const fluid of [B.WATER, B.LAVA]) {
      expect(isSolid(fluid)).toBe(false);
      expect(isOpaque(fluid)).toBe(false);
      expect(isReplaceable(fluid)).toBe(true);
    }
  });

  it('bloco de LAVA existe e está marcado como interativo', () => {
    expect(BLOCKS[B.LAVA]).toBeDefined();
    expect(BLOCKS[B.LAVA].interactive).toBe(true);
  });

  it('GLOWSTONE e WATER são interativos; STONE não é', () => {
    expect(BLOCKS[B.GLOWSTONE].interactive).toBe(true);
    expect(BLOCKS[B.WATER].interactive).toBe(true);
    expect(BLOCKS[B.STONE].interactive ?? false).toBe(false);
  });

  it('blocos minerais têm minToolTier > 0; blocos comuns (dirt/plank) usam o default 0', () => {
    expect(BLOCKS[B.STONE].minToolTier).toBe(1);
    expect(BLOCKS[B.IRON_BLOCK].minToolTier).toBe(2);
    expect(BLOCKS[B.DIAMOND_BLOCK].minToolTier).toBe(3);
    expect(BLOCKS[B.DIRT].minToolTier).toBe(0);
    expect(BLOCKS[B.PLANK].minToolTier).toBe(0);
  });

  it('isSupport só é true para blocos sólidos, não-estruturais, não-folhas e não-decorativos', () => {
    expect(isSupport(B.STONE)).toBe(true); // sólido, não estrutural
    expect(isSupport(B.STONE_BRICK)).toBe(false); // estrutural
    expect(isSupport(B.LEAVES)).toBe(false); // folha
    expect(isSupport(B.TALL_GRASS)).toBe(false); // decor
  });

  it('capim e flores são decorativos e não sólidos', () => {
    for (const decor of [B.TALL_GRASS, B.FLOWER_RED, B.FLOWER_YELLOW]) {
      expect(isDecor(decor)).toBe(true);
      expect(isSolid(decor)).toBe(false);
    }
  });
});
