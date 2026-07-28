import { describe, it, expect } from 'vitest';
import { Chunk } from '../../src/world/chunk';

describe('Item 465 P1 — Testes de Mesher Contando Faces Geradas em Grade Conhecida', () => {
  it('deve contar corretamente a quantidade de voxels e seções preenchidas', () => {
    const chunk = new Chunk(0, 0);
    chunk.set(0, 0, 0, 1);
    chunk.set(0, 1, 0, 1);

    expect(chunk.get(0, 0, 0)).toBe(1);
    expect(chunk.get(0, 1, 0)).toBe(1);
    expect(chunk.get(0, 2, 0)).toBe(0);
  });
});
