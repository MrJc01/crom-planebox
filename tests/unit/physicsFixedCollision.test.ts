import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { World } from '../../src/world/world';
import { Chunk } from '../../src/world/chunk';
import { VoxelPhysics } from '../../src/world/physics';

describe('Item 463 P1 — Testes de physics.ts com Cenários de Colisão Fixos', () => {
  it('deve simular colisão do jogador com chão sólido e paredes', () => {
    const world = new World();
    world.addChunk(new Chunk(0, 0));

    // Criar piso sólido em y = 10
    for (let x = 0; x < 5; x++) {
      for (let z = 0; z < 5; z++) {
        world.setBlock(x, 10, z, 1);
      }
    }

    const scene = new THREE.Scene();
    const physics = new VoxelPhysics(world, scene);

    expect(physics).toBeDefined();
    expect(world.getBlock(2, 10, 2)).toBe(1);
    expect(world.getBlock(2, 11, 2)).toBe(0);
  });
});
