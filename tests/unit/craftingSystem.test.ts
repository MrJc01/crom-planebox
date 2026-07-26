import { describe, it, expect } from 'vitest';
import { CraftingSystem, CraftCell, CRAFTING_RECIPES } from '../../src/crafting/CraftingSystem';
import { B, BLOCKS } from '../../src/world/blocks';

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

describe('CraftingSystem — cadeia dos minérios (rodada de cavernas)', () => {
  it('carvão + tronco produz tochas — o que torna a caverna explorável', () => {
    const r = CRAFTING_RECIPES.find((x) => x.id === 'torch_from_coal')!;
    expect(r).toBeDefined();
    expect(r.outputBlock).toBe(B.TORCH);
    expect(r.outputCount).toBeGreaterThan(1);
  });

  it('cada minério tem receita para virar o bloco refinado correspondente', () => {
    const pares: [number, number][] = [
      [B.IRON_ORE, B.IRON_BLOCK],
      [B.GOLD_ORE, B.GOLD_BLOCK],
      [B.DIAMOND_ORE, B.DIAMOND_BLOCK],
    ];
    for (const [ore, bloco] of pares) {
      const r = CRAFTING_RECIPES.find((x) => x.outputBlock === bloco && x.ingredients?.[ore]);
      expect(r, `sem receita de ${BLOCKS[ore].name}`).toBeDefined();
    }
  });

  it('toda receita produz um bloco que existe na paleta', () => {
    for (const r of CRAFTING_RECIPES) {
      if (r.outputBlock === undefined) continue;
      expect(BLOCKS[r.outputBlock], `receita "${r.id}" produz bloco inexistente`).toBeDefined();
    }
  });

  it('todo ingrediente citado existe na paleta', () => {
    for (const r of CRAFTING_RECIPES) {
      for (const key of Object.keys(r.ingredients ?? {})) {
        expect(BLOCKS[Number(key)], `receita "${r.id}" pede bloco inexistente`).toBeDefined();
      }
      for (const row of r.shape ?? []) {
        for (const cell of row) {
          if (cell === null) continue;
          expect(BLOCKS[cell], `receita "${r.id}" desenha bloco inexistente`).toBeDefined();
        }
      }
    }
  });
});

describe('corrente de progressão de ferramentas — itens 008 e 195', () => {
  const tiers = CRAFTING_RECIPES.filter((r) => r.outputTool).map((r) => r.outputTool!.tier).sort();

  it('CRÍTICO: a corrente vai de 1 a 4 sem buraco', () => {
    // Um degrau faltando no meio deixaria um bloco inalcançável: o jogador teria a picareta
    // anterior e nenhuma receita para a seguinte.
    expect(tiers).toEqual([1, 2, 3, 4]);
  });

  it('CRÍTICO: todo tier exigido por algum bloco tem uma picareta que o alcança', () => {
    // A verificação que importa de verdade. Um bloco pedindo tier 5 sem picareta de tier 5 é
    // conteúdo que existe no mundo e ninguém consegue pegar — e nada no jogo avisaria.
    const maiorExigido = Math.max(
      ...BLOCKS.filter((b) => b && b.minToolTier).map((b) => b!.minToolTier!),
    );
    expect(Math.max(...tiers)).toBeGreaterThanOrEqual(maiorExigido);
  });

  it('o material mais raro leva a alguma coisa', () => {
    // O diamante era o fim da corrente SEM uso: minerava-se com a picareta de ferro, montava-se o
    // bloco, e acabava ali. Uma progressão cujo último degrau não abre nada termina antes do fim —
    // o jogador para de minerar ao perceber que já tem tudo o que importa, no ferro.
    const usaDiamante = CRAFTING_RECIPES.some(
      (r) => r.outputTool && JSON.stringify(r.shape ?? []).includes(String(B.DIAMOND_BLOCK)),
    );
    expect(usaDiamante).toBe(true);
  });
});
