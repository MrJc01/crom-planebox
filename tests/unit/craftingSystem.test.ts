import { describe, it, expect } from 'vitest';
import { CraftingSystem, CraftCell } from '../../src/crafting/CraftingSystem';
import { B } from '../../src/world/blocks';

function gridFrom(rows: (number | null)[][]): CraftCell[][] {
  const grid = CraftingSystem.emptyGrid(6);
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) grid[r][c] = rows[r][c];
  }
  return grid;
}

describe('CraftingSystem', () => {
  const crafting = new CraftingSystem();

  it('grade vazia não bate com nenhuma receita', () => {
    expect(crafting.match(CraftingSystem.emptyGrid(6))).toBeNull();
  });

  it('receita shapeless (1 tronco -> tábuas) bate independente da posição na grade', () => {
    const grid = gridFrom([[B.LOG]]);
    // move o tronco para outra célula qualquer da grade 6x6
    grid[3][4] = B.LOG;
    grid[0][0] = null;
    const match = crafting.match(grid);
    expect(match?.id).toBe('plank_from_log');
    expect(match?.outputBlock).toBe(B.PLANK);
  });

  it('receita shapeless com quantidade errada não bate', () => {
    const grid = gridFrom([[B.SAND, B.SAND, B.SAND]]); // glass_from_sand exige exatamente 2
    expect(crafting.match(grid)).toBeNull();
  });

  it('receita shapeless com bloco extra de outro tipo não bate (mistura invalida)', () => {
    const grid = gridFrom([[B.SAND, B.SAND, B.DIRT]]);
    expect(crafting.match(grid)).toBeNull();
  });

  it('receita com forma (cruz de ouro) bate em qualquer posição da grade 6x6', () => {
    const grid = CraftingSystem.emptyGrid(6);
    // desenha a cruz deslocada (não no canto 0,0) para provar que a comparação usa bounding-box, não posição absoluta
    grid[2][2] = B.GOLD_BLOCK;
    grid[3][1] = B.GOLD_BLOCK;
    grid[3][2] = B.GOLD_BLOCK;
    grid[3][3] = B.GOLD_BLOCK;
    grid[4][2] = B.GOLD_BLOCK;
    const match = crafting.match(grid);
    expect(match?.id).toBe('glowstone_cross');
    expect(match?.outputBlock).toBe(B.GLOWSTONE);
  });

  it('receita com forma não bate se um bloco do desenho estiver faltando', () => {
    const grid = CraftingSystem.emptyGrid(6);
    grid[2][2] = B.GOLD_BLOCK;
    grid[3][1] = B.GOLD_BLOCK;
    grid[3][2] = B.GOLD_BLOCK;
    // falta grid[3][3] e grid[4][2] da cruz completa
    expect(crafting.match(grid)).toBeNull();
  });

  it('receita de ferramenta (picareta de madeira) devolve outputTool em vez de outputBlock', () => {
    const grid = CraftingSystem.emptyGrid(6);
    grid[0][0] = B.PLANK; grid[0][1] = B.PLANK; grid[0][2] = B.PLANK;
    grid[1][1] = B.LOG;
    grid[2][1] = B.LOG;
    const match = crafting.match(grid);
    expect(match?.id).toBe('wood_pickaxe');
    expect(match?.outputTool?.tier).toBe(1);
    expect(match?.outputBlock).toBeUndefined();
  });
});
