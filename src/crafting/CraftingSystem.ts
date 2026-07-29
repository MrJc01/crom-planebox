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
    id: 'diamond_armor',
    name: 'Armadura de Diamante',
    outputBlock: B.DIAMOND_BLOCK,
    outputCount: 1,
    ingredients: { [B.DIAMOND_ORE]: 4 },
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

export type CropStage = 0 | 1 | 2 | 3;

export interface CropState {
  x: number;
  y: number;
  z: number;
  cropType: string;
  stage: CropStage;
  ticksGrown: number;
}

/** Agricultura: plantar, crescer por tick, colher — item 133 P2. */
export class FarmingSystem {
  private crops: CropState[] = [];

  public plant(x: number, y: number, z: number, cropType: string): void {
    this.crops.push({ x, y, z, cropType, stage: 0, ticksGrown: 0 });
  }

  public tick(): CropState[] {
    const ready: CropState[] = [];
    for (const c of this.crops) {
      c.ticksGrown++;
      if (c.ticksGrown >= 20 && c.stage < 3) {
        c.stage = Math.min(3, c.stage + 1) as CropStage;
        c.ticksGrown = 0;
      }
      if (c.stage === 3) ready.push(c);
    }
    return ready;
  }

  public harvest(x: number, y: number, z: number): CropState | null {
    const idx = this.crops.findIndex(c => c.x === x && c.y === y && c.z === z && c.stage === 3);
    if (idx < 0) return null;
    return this.crops.splice(idx, 1)[0];
  }
}

/** Criação de animais e reprodução — item 134 P2. */
export class AnimalBreeding {
  private cooldowns = new Map<string, number>();

  public canBreed(animalId: string): boolean {
    const cd = this.cooldowns.get(animalId) ?? 0;
    return cd <= 0;
  }

  public breed(parentA: string, parentB: string): { offspringId: string } | null {
    if (!this.canBreed(parentA) || !this.canBreed(parentB)) return null;
    this.cooldowns.set(parentA, 300);
    this.cooldowns.set(parentB, 300);
    return { offspringId: `${parentA}_${parentB}_baby` };
  }

  public tick(dt: number): void {
    for (const [id, cd] of this.cooldowns) {
      this.cooldowns.set(id, Math.max(0, cd - dt));
    }
  }
}

export interface FishingResult {
  caught: boolean;
  item: string;
  quality: number;
}

/** Pesca — item 135 P2. */
export class FishingSystem {
  public static cast(seed: number, biome: string): FishingResult {
    const h = Math.abs(Math.sin(seed * 73.1) * 43758.5453) % 1;
    if (h < 0.3) return { caught: false, item: '', quality: 0 };
    const quality = Math.floor(h * 3) + 1;
    const item = biome === 'oceano' ? 'peixe_grande' : 'peixe';
    return { caught: true, item, quality };
  }
}

export interface FurnaceState {
  inputBlock: number;
  fuelRemaining: number;
  cookProgress: number;
  outputBlock: number | null;
}

/** Fornalha com combustível e tempo de queima — item 136 P2. */
export class FurnaceProcessor {
  private static readonly SMELT_MAP: Record<number, number> = {
    30: 21, // iron ore → iron block
    31: 22, // gold ore → gold block
    4: 20,  // sand → glass
  };

  public static canSmelt(blockType: number): boolean {
    return blockType in this.SMELT_MAP;
  }

  public static tick(state: FurnaceState, dt: number): FurnaceState {
    if (state.fuelRemaining <= 0) return state;
    state.fuelRemaining -= dt;
    if (this.canSmelt(state.inputBlock)) {
      state.cookProgress += dt;
      if (state.cookProgress >= 10) {
        state.outputBlock = this.SMELT_MAP[state.inputBlock];
        state.cookProgress = 0;
      }
    }
    return state;
  }
}

/** Reparo de ferramentas — item 200 P2. */
export class ToolRepairSystem {
  public static repair(durabilityA: number, durabilityB: number, maxDurability: number): number {
    const combined = durabilityA + durabilityB + Math.floor(maxDurability * 0.1); // bônus de 10%
    return Math.min(maxDurability, combined);
  }
}

/** Reciclagem de itens — item 201 P2. */
export class ItemRecycling {
  private static readonly RECYCLE_MAP: Record<number, { outputItem: number; count: number }> = {
    21: { outputItem: 30, count: 2 }, // Bloco de ferro -> minérios
    22: { outputItem: 31, count: 2 }, // Bloco de ouro -> minérios
  };

  public static recycle(itemBlock: number): { outputItem: number; count: number } | null {
    return this.RECYCLE_MAP[itemBlock] ?? null;
  }
}

export interface MarketPrice {
  itemId: number;
  basePrice: number;
  supply: number;
  demand: number;
}

/** Moeda e mercado com NPCs / Economia de vila com oferta e demanda — itens 202, 203 P2. */
export class VillageEconomyMarket {
  private prices = new Map<number, MarketPrice>();

  public setItemPrice(itemId: number, basePrice: number, supply = 10, demand = 10): void {
    this.prices.set(itemId, { itemId, basePrice, supply, demand });
  }

  public getCurrentPrice(itemId: number): number {
    const item = this.prices.get(itemId);
    if (!item) return 1;
    // Preço sobe se demanda > oferta, cai se oferta > demanda
    const ratio = item.demand / Math.max(1, item.supply);
    return Math.max(1, Math.round(item.basePrice * ratio));
  }

  public recordTransaction(itemId: number, isBuy: boolean, count: number): void {
    const item = this.prices.get(itemId);
    if (!item) return;
    if (isBuy) {
      item.supply = Math.max(1, item.supply - count);
      item.demand += count;
    } else {
      item.supply += count;
      item.demand = Math.max(1, item.demand - count);
    }
  }
}

export interface QuestContract {
  id: string;
  title: string;
  targetBlock: number;
  targetCount: number;
  rewardCoins: number;
  completed: boolean;
}

/** Encomendas/contratos como missões — item 204 P2. */
export class QuestContractSystem {
  private contracts: QuestContract[] = [];

  public addContract(c: QuestContract): void {
    this.contracts.push(c);
  }

  public getActiveContracts(): QuestContract[] {
    return this.contracts.filter(c => !c.completed);
  }

  public tryComplete(contractId: string, playerItems: Map<number, number>): { success: boolean; reward: number } {
    const c = this.contracts.find(x => x.id === contractId && !x.completed);
    if (!c) return { success: false, reward: 0 };
    const count = playerItems.get(c.targetBlock) ?? 0;
    if (count < c.targetCount) return { success: false, reward: 0 };

    playerItems.set(c.targetBlock, count - c.targetCount);
    c.completed = true;
    return { success: true, reward: c.rewardCoins };
  }
}

export interface NonBlockItemDef {
  id: string;
  name: string;
  type: 'ferramenta' | 'comida' | 'recurso';
  value: number;
}

/** Mods podem registrar itens não-bloco (ferramentas, comida) — item 207 P2. */
export class NonBlockModItemRegistry {
  private items = new Map<string, NonBlockItemDef>();

  public register(def: NonBlockItemDef): void {
    this.items.set(def.id, def);
  }

  public get(id: string): NonBlockItemDef | undefined {
    return this.items.get(id);
  }
}

/** Autocrafting de itens intermediários — item 209 P2. */
export class AutoCraftingSystem {
  public static canAutoCraftIntermediate(recipeId: string, availableMaterials: Map<number, number>): boolean {
    const recipe = CRAFTING_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return false;
    if (recipe.ingredients) {
      for (const [blockStr, count] of Object.entries(recipe.ingredients)) {
        const blockId = Number(blockStr);
        if ((availableMaterials.get(blockId) ?? 0) < count) return false;
      }
      return true;
    }
    return false;
  }
}

/** Favoritar receitas — item 210 P2. */
export class FavoriteRecipesSystem {
  private favorites = new Set<string>();

  public toggleFavorite(recipeId: string): boolean {
    if (this.favorites.has(recipeId)) {
      this.favorites.delete(recipeId);
      return false;
    }
    this.favorites.add(recipeId);
    return true;
  }

  public isFavorite(recipeId: string): boolean {
    return this.favorites.has(recipeId);
  }

  public getFavorites(): string[] {
    return [...this.favorites];
  }
}

export interface InventoryItem {
  id: number;
  name: string;
  count: number;
}

/** Ordenação e busca no inventário — item 211 P2. */
export class InventorySearchSort {
  public static filterAndSort(items: InventoryItem[], query: string, sortBy: 'name' | 'count'): InventoryItem[] {
    const q = query.toLowerCase().trim();
    const filtered = items.filter(i => i.name.toLowerCase().includes(q));

    return filtered.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return b.count - a.count;
    });
  }
}

/** Estatísticas de uso de receita por mundo — item 216 P2. */
export class RecipeUsageStatistics {
  private usage = new Map<string, number>();

  public recordCraft(recipeId: string): void {
    const current = this.usage.get(recipeId) ?? 0;
    this.usage.set(recipeId, current + 1);
  }

  public getUsageCount(recipeId: string): number {
    return this.usage.get(recipeId) ?? 0;
  }
}

export interface ConveyorItem {
  itemId: number;
  progress: number;
}

/** Cadeia de produção automatizada (esteiras, funis) — item 215 P3. */
export class AutomationProductionChain {
  private items: ConveyorItem[] = [];

  public addItem(itemId: number): void {
    this.items.push({ itemId, progress: 0 });
  }

  public update(dt: number): ConveyorItem[] {
    for (const item of this.items) {
      item.progress = Math.min(1.0, item.progress + dt * 0.5);
    }
    const completed = this.items.filter(i => i.progress >= 1.0);
    this.items = this.items.filter(i => i.progress < 1.0);
    return completed;
  }
}

/** Redstone / circuitos lógicos — item 234 P3. */
export class RedstoneCircuitLogic {
  private signalPower = new Map<string, number>();

  public setSignal(posKey: string, power: number): void {
    this.signalPower.set(posKey, Math.max(0, Math.min(15, power)));
  }

  public getSignal(posKey: string): number {
    return this.signalPower.get(posKey) ?? 0;
  }

  public propagateSignal(fromKey: string, toKey: string): number {
    const power = this.getSignal(fromKey);
    const propagated = Math.max(0, power - 1);
    this.setSignal(toKey, propagated);
    return propagated;
  }
}
