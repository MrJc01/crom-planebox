// Sistema simples de crafting 6x6 (Modo 4 — Criativo). Suporta receitas "sem forma"
// (shapeless: só importa a quantidade de cada bloco usado, não a posição) e receitas
// "com forma" (shaped: o desenho da grade precisa bater, mas pode estar em qualquer
// posição dentro da grade 6x6 — só a caixa delimitadora mínima dos itens é comparada).
import { B } from '../world/blocks';

export type CraftCell = number | null; // id de bloco (B.*) ou null = vazio

export interface CraftingRecipe {
  id: string;
  name: string;
  /** Receita de bloco: qual bloco e quantos sai. Ignorado se `outputTool` estiver definido. */
  outputBlock?: number;
  outputCount?: number;
  /** Receita de FERRAMENTA (picareta): sai um item de hotbar com toolTier, não um bloco colocável. */
  outputTool?: { tier: number; label: string };
  /** Se definido, é uma receita com forma (shape[row][col]); senão usa `ingredients` (shapeless). */
  shape?: CraftCell[][];
  /** Receita sem forma: { blockId: quantidadeNecessária } */
  ingredients?: Record<number, number>;
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  { id: 'plank_from_log', name: 'Tronco → Tábuas', outputBlock: B.PLANK, outputCount: 4, ingredients: { [B.LOG]: 1 } },
  { id: 'glass_from_sand', name: 'Areia → Vidro', outputBlock: B.GLASS, outputCount: 1, ingredients: { [B.SAND]: 2 } },
  { id: 'brick_from_dirt', name: 'Terra → Tijolo', outputBlock: B.BRICK, outputCount: 1, ingredients: { [B.DIRT]: 2 } },
  { id: 'stonebrick_from_stone', name: 'Pedra → Tijolo de Pedra', outputBlock: B.STONE_BRICK, outputCount: 4, ingredients: { [B.STONE]: 4 } },
  {
    id: 'glowstone_cross',
    name: 'Cruz de Ouro → Pedra Luminosa',
    outputBlock: B.GLOWSTONE,
    outputCount: 1,
    shape: [
      [null, B.GOLD_BLOCK, null],
      [B.GOLD_BLOCK, B.GOLD_BLOCK, B.GOLD_BLOCK],
      [null, B.GOLD_BLOCK, null],
    ],
  },
  {
    id: 'wood_pickaxe',
    name: 'Picareta de Madeira',
    outputTool: { tier: 1, label: 'picareta de madeira' },
    shape: [
      [B.PLANK, B.PLANK, B.PLANK],
      [null, B.LOG, null],
      [null, B.LOG, null],
    ],
  },
  {
    id: 'stone_pickaxe',
    name: 'Picareta de Pedra',
    outputTool: { tier: 2, label: 'picareta de pedra' },
    shape: [
      [B.COBBLE, B.COBBLE, B.COBBLE],
      [null, B.LOG, null],
      [null, B.LOG, null],
    ],
  },
  {
    id: 'iron_pickaxe',
    name: 'Picareta de Ferro',
    outputTool: { tier: 3, label: 'picareta de ferro' },
    shape: [
      [B.IRON_BLOCK, B.IRON_BLOCK, B.IRON_BLOCK],
      [null, B.LOG, null],
      [null, B.LOG, null],
    ],
  },
];

/** Recorta a menor caixa delimitadora contendo todas as células não nulas. */
function boundingBox(grid: CraftCell[][]): CraftCell[][] | null {
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== null) {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      }
    }
  }
  if (minR === Infinity) return null; // grade vazia
  const out: CraftCell[][] = [];
  for (let r = minR; r <= maxR; r++) {
    out.push(grid[r].slice(minC, maxC + 1));
  }
  return out;
}

function shapesEqual(a: CraftCell[][], b: CraftCell[][]): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

export class CraftingSystem {
  public recipes: CraftingRecipe[] = CRAFTING_RECIPES;

  /** Retorna a receita que bate com o estado atual da grade 6x6, ou null se nenhuma bater. */
  public match(grid: CraftCell[][]): CraftingRecipe | null {
    const trimmed = boundingBox(grid);
    if (!trimmed) return null;

    // Contagem total por tipo de bloco (para receitas shapeless)
    const counts: Record<number, number> = {};
    let totalFilled = 0;
    for (const row of trimmed) {
      for (const cell of row) {
        if (cell !== null) {
          counts[cell] = (counts[cell] || 0) + 1;
          totalFilled++;
        }
      }
    }

    for (const recipe of this.recipes) {
      if (recipe.shape) {
        const recipeTrimmed = boundingBox(recipe.shape);
        if (recipeTrimmed && shapesEqual(trimmed, recipeTrimmed)) return recipe;
      } else if (recipe.ingredients) {
        const requiredTypes = Object.keys(recipe.ingredients).map(Number);
        const requiredTotal = requiredTypes.reduce((s, t) => s + recipe.ingredients![t], 0);
        if (requiredTotal !== totalFilled) continue;
        const ok = requiredTypes.every((t) => counts[t] === recipe.ingredients![t]);
        if (ok && Object.keys(counts).length === requiredTypes.length) return recipe;
      }
    }
    return null;
  }

  public static emptyGrid(size = 6): CraftCell[][] {
    return Array.from({ length: size }, () => Array<CraftCell>(size).fill(null));
  }
}
