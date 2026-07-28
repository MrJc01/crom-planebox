import { describe, it, expect } from 'vitest';
import { UndoManager } from '../../src/storage/UndoManager';
import { World } from '../../src/world/world';
import { Chunk } from '../../src/world/chunk';

describe('Item 466 P1 — Testes de UndoManager com Histórico de Operações', () => {
  it('deve registrar alterações e permitir desfazer e refazer em cadeia', () => {
    const world = new World();
    world.addChunk(new Chunk(0, 0));

    const undoMgr = new UndoManager(world);

    // Passo 1: coloca bloco
    world.setBlock(2, 2, 2, 5);
    undoMgr.recordBatch([{ x: 2, y: 2, z: 2, oldBlock: 0, newBlock: 5 }]);

    expect(world.getBlock(2, 2, 2)).toBe(5);

    // Desfaz
    undoMgr.undo();
    expect(world.getBlock(2, 2, 2)).toBe(0);

    // Refaz
    undoMgr.redo();
    expect(world.getBlock(2, 2, 2)).toBe(5);
  });
});

