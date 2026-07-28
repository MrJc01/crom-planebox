import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../src/world/world';
import { Chunk } from '../../src/world/chunk';
import { B } from '../../src/world/blocks';
import { Interaction } from '../../src/player/interaction';
import { CommandSystem } from '../../src/commands/CommandSystem';
import { TerrainBrush } from '../../src/world/terrainBrush';
import { ParametricTreeGenerator } from '../../src/world/parametricTrees';
import { MiniStructureEditor } from '../../src/world/miniStructureEditor';
import { LodMesher } from '../../src/world/lodMesher';

import * as THREE from 'three';
import { VoxelPhysics } from '../../src/world/physics';
import { PlayerController } from '../../src/player/controller';

describe('Roteiro Automatizado de Testes Integrados E2E — Itens 1574–1576', () => {
  let world: World;
  let interaction: Interaction;

  beforeEach(() => {
    world = new World();
    const scene = new THREE.Scene();
    const physics = new VoxelPhysics(world, scene);
    const camera = new THREE.PerspectiveCamera();
    const player = new PlayerController(world, physics, camera);

    interaction = new Interaction(world, physics, player, scene);
    // Adiciona chunk central (0,0)
    world.addChunk(new Chunk(0, 0));
  });

  it('deve simular o game loop: criação de blocos, escultura, árvores, comandos e LOD', async () => {
    // 1. Definição inicial e verificação de blocos
    expect(world.getBlock(10, 10, 10)).toBe(B.AIR);
    world.setBlock(10, 10, 10, B.STONE);
    expect(world.getBlock(10, 10, 10)).toBe(B.STONE);

    // 2. Testar Pincel de Terreno
    const brushRes = TerrainBrush.apply(world, { cx: 4, cy: 0, cz: 4, radius: 3, mode: 'raise', targetBlock: B.DIRT });
    expect(brushRes.modifiedCount).toBeGreaterThan(0);

    // 3. Testar Árvore Paramétrica
    const treeCount = ParametricTreeGenerator.place(world, { x: 8, y: 1, z: 8, species: 'carvalho' });
    expect(treeCount).toBeGreaterThan(0);

    // 4. Testar Editor In-World de Mini-Estruturas
    const editor = new MiniStructureEditor({ originX: 0, originY: 0, originZ: 0, sizeX: 4, sizeY: 4, sizeZ: 4 });
    const template = editor.exportTemplate(world, 'tmpl-test', 'Template de Teste');
    expect(template.id).toBe('tmpl-test');
    expect(template.name).toBe('Template de Teste');

    // 5. Testar Sistema de Comandos Expandido
    const commandSystem = new CommandSystem();
    const mockCtx: any = {
      callerId: 'host',
      callerIsOp: true,
      isHost: true,
      player: { pos: { set: () => {} }, vel: { set: () => {} } },
      seed: 12345,
      listPlayers: () => [{ id: 'host', name: 'JogadorHost', isOp: true }],
    };

    const resSeed = await commandSystem.execute('/seed', mockCtx);
    expect(resSeed.ok).toBe(true);
    expect(resSeed.message).toContain('12345');

    const resHelp = await commandSystem.execute('/help', mockCtx);
    expect(resHelp.ok).toBe(true);
    expect(resHelp.message).toContain('/clima');

    // 6. Testar Mesher LOD de Chunks Distantes
    const chunk = world.getChunk(0, 0)!;
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        for (let z = 0; z < 8; z++) {
          chunk.set(x, y, z, B.STONE);
        }
      }
    }
    const lodMesh = LodMesher.buildLodMesh(chunk);
    expect(lodMesh).not.toBeNull();
  });
});
