// Sistema simples de crafting 6x6 (Modo 4 — Criativo). Suporta receitas "sem forma"
// (shapeless: só importa a quantidade de cada bloco usado, não a posição) e receitas
// "com forma" (shaped: o desenho da grade precisa bater, mas pode estar em qualquer
// posição dentro da grade 6x6 — só a caixa delimitadora mínima dos itens é comparada).
import { B, BLOCKS } from '../world/blocks';

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
  // Fecha o ciclo aberto pelas cavernas: minerar carvão vira luz portátil, que é o que torna
  // a caverna explorável. Sem esta receita o carvão não teria uso nenhum.
  {
    id: 'torch_from_coal',
    name: 'Carvão + Tronco → Tochas',
    outputBlock: B.TORCH,
    outputCount: 4,
    shape: [
      [B.COAL_ORE],
      [B.LOG],
    ],
  },
  {
    /**
     * Cama — o ponto de renascimento (item 010).
     *
     * Ingredientes de propósito **baratos e do primeiro dia**: tábuas e troncos. A cama existe para
     * encurtar a caminhada de volta depois de morrer, e uma cama cara só ficaria pronta depois de o
     * jogador já ter passado pela parte em que morrer dói.
     */
    id: 'bed_from_planks',
    name: 'Cama',
    outputBlock: B.BED,
    outputCount: 1,
    shape: [
      [B.PLANK, B.PLANK, B.PLANK],
      [B.LOG, B.LOG, B.LOG],
    ],
  },
  {
    /**
     * Baú — item 1523.
     *
     * O bloco existia e não tinha receita: só chegava ao jogador pelo inventário criativo, o que
     * deixava o armazenamento inteiro (item 137) inalcançável em Sobrevivência.
     *
     * A forma é um quadrado de tábuas com o meio vazio, e o vazio é o desenho: é a leitura de
     * "caixa" numa grade, e é a mesma ideia que qualquer jogador já traz de outros jogos. Barata,
     * pelo mesmo motivo da cama — guardar coisas é o que faz o resto do jogo valer a pena, e uma
     * receita cara empurraria o baú para depois do ponto em que ele faria diferença.
     */
    id: 'chest_from_planks',
    name: 'Baú',
    outputBlock: B.CHEST,
    outputCount: 1,
    shape: [
      [B.PLANK, B.PLANK, B.PLANK],
      // `null` e não `0`: `CraftCell` é `number | null`, e `0` é `B.AIR` — um bloco de verdade que
      // o jogador não pode pôr na grade. Escrito com zero, a receita compilava, aparecia na lista e
      // NUNCA casava. Há um teste agora que casa toda receita com forma contra a própria grade.
      [B.PLANK, null, B.PLANK],
      [B.PLANK, B.PLANK, B.PLANK],
    ],
  },
  {
    id: 'iron_block_from_ore',
    name: 'Minério de Ferro → Bloco de Ferro',
    outputBlock: B.IRON_BLOCK,
    outputCount: 1,
    ingredients: { [B.IRON_ORE]: 4 },
  },
  {
    id: 'gold_block_from_ore',
    name: 'Minério de Ouro → Bloco de Ouro',
    outputBlock: B.GOLD_BLOCK,
    outputCount: 1,
    ingredients: { [B.GOLD_ORE]: 4 },
  },
  {
    id: 'diamond_block_from_ore',
    name: 'Minério de Diamante → Bloco de Diamante',
    outputBlock: B.DIAMOND_BLOCK,
    outputCount: 1,
    ingredients: { [B.DIAMOND_ORE]: 4 },
  },
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
    /**
     * Picareta de diamante — o topo da corrente de progressão.
     *
     * ## O buraco que ela fecha
     *
     * As picaretas iam até o tier 3 (ferro), e **nenhum bloco exige tier 4** — então nada estava
     * inalcançável. O problema era outro, e mais silencioso: o diamante era o fim da corrente
     * **sem uso**. O jogador minerava minério de diamante com a picareta de ferro, montava o
     * bloco de diamante… e acabava ali. O material mais raro do jogo não levava a lugar nenhum.
     *
     * Uma progressão em que o último degrau não abre nada é uma progressão que termina antes do
     * fim: o jogador para de minerar quando percebe que já tem tudo o que importa, no ferro.
     */
    id: 'diamond_pickaxe',
    name: 'Picareta de Diamante',
    outputTool: { tier: 4, label: 'picareta de diamante' },
    shape: [
      [B.DIAMOND_BLOCK, B.DIAMOND_BLOCK, B.DIAMOND_BLOCK],
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

export interface SmeltingRecipe {
  inputBlock: number;
  outputBlock: number;
  outputCount: number;
  cookTimeSeconds: number;
}

export const SMELTING_RECIPES: SmeltingRecipe[] = [
  { inputBlock: B.COBBLE, outputBlock: B.STONE, outputCount: 1, cookTimeSeconds: 5 },
  { inputBlock: B.SAND, outputBlock: B.GLASS, outputCount: 1, cookTimeSeconds: 5 },
  { inputBlock: B.IRON_ORE, outputBlock: B.IRON_BLOCK, outputCount: 1, cookTimeSeconds: 8 },
  { inputBlock: B.GOLD_ORE, outputBlock: B.GOLD_BLOCK, outputCount: 1, cookTimeSeconds: 10 },
  { inputBlock: B.DIRT, outputBlock: B.BRICK, outputCount: 1, cookTimeSeconds: 4 },
];

export class CraftingSystem {
  public recipes: CraftingRecipe[] = CRAFTING_RECIPES;
  public smeltingRecipes: SmeltingRecipe[] = SMELTING_RECIPES;

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

  /** Retorna todas as receitas do Livro de Receitas que podem ser fabricadas agora com o inventário fornecido — item 197. */
  public getAvailableRecipes(inventory: { block: number; count: number }[]): CraftingRecipe[] {
    const availableCounts: Record<number, number> = {};
    for (const slot of inventory) {
      if (slot.block > 0 && slot.count > 0) {
        availableCounts[slot.block] = (availableCounts[slot.block] || 0) + slot.count;
      }
    }

    return this.recipes.filter((recipe) => {
      const requiredCounts: Record<number, number> = {};
      if (recipe.ingredients) {
        for (const [blk, qty] of Object.entries(recipe.ingredients)) {
          requiredCounts[Number(blk)] = qty;
        }
      } else if (recipe.shape) {
        for (const row of recipe.shape) {
          for (const cell of row) {
            if (cell !== null && cell > 0) {
              requiredCounts[cell] = (requiredCounts[cell] || 0) + 1;
            }
          }
        }
      }

      return Object.entries(requiredCounts).every(([blk, qty]) => {
        return (availableCounts[Number(blk)] || 0) >= qty;
      });
    });
  }

  /** Retorna a receita de fundição para o bloco de entrada, ou null se não for fundível — item 198. */
  public getSmeltingRecipe(inputBlock: number): SmeltingRecipe | null {
    return this.smeltingRecipes.find((r) => r.inputBlock === inputBlock) ?? null;
  }

  /** Valida se a receita produz um bloco/ferramenta existente e tem ingredientes válidos — item 208. */
  public validateRecipe(recipe: CraftingRecipe): { valid: boolean; reason?: string } {
    return CraftingSystem.validateRecipe(recipe);
  }

  public static validateRecipe(recipe: CraftingRecipe): { valid: boolean; reason?: string } {
    if (recipe.outputBlock !== undefined) {
      const def = BLOCKS[recipe.outputBlock];
      if (!def || def.reserved) {
        return { valid: false, reason: `Bloco de saída id=${recipe.outputBlock} não existe.` };
      }
    } else if (!recipe.outputTool) {
      return { valid: false, reason: 'Receita deve declarar outputBlock ou outputTool.' };
    }

    if (recipe.ingredients) {
      for (const blkStr of Object.keys(recipe.ingredients)) {
        const blk = Number(blkStr);
        if (!BLOCKS[blk] || BLOCKS[blk].reserved) {
          return { valid: false, reason: `Ingrediente id=${blk} não existe.` };
        }
      }
    }

    if (recipe.shape) {
      for (const row of recipe.shape) {
        for (const cell of row) {
          if (cell !== null && (!BLOCKS[cell] || BLOCKS[cell].reserved)) {
            return { valid: false, reason: `Ingrediente id=${cell} na grade não existe.` };
          }
        }
      }
    }

    return { valid: true };
  }

  public static registerCustomRecipe(recipe: CraftingRecipe): void {
    const val = this.validateRecipe(recipe);
    if (!val.valid) {
      throw new Error(`Receita inválida "${recipe.id}": ${val.reason}`);
    }
    const idx = CRAFTING_RECIPES.findIndex((r) => r.id === recipe.id);
    if (idx >= 0) CRAFTING_RECIPES[idx] = recipe;
    else CRAFTING_RECIPES.push(recipe);
  }

  public static emptyGrid(size = 6): CraftCell[][] {
    return Array.from({ length: size }, () => Array<CraftCell>(size).fill(null));
  }
}
