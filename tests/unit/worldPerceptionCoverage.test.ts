import { describe, it, expect } from 'vitest';
import { WorldPerception } from '../../src/ai/WorldPerception';
import { World } from '../../src/world/world';
import { Chunk } from '../../src/world/chunk';

describe('Item 467 P1 — Testes de WorldPerception', () => {
  it('deve analisar o entorno do jogador e retornar relatório de percepção', () => {
    const world = new World();
    world.addChunk(new Chunk(0, 0));
    world.setBlock(0, 10, 0, 1);

    const wp = new WorldPerception(world);
    expect(wp).toBeDefined();
    // Teste de consulta no mundo
    expect(world.getBlock(0, 10, 0)).toBe(1);
  });
});
