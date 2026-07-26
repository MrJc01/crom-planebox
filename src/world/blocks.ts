// Registro de blocos: cores por face e propriedades físicas.

export const enum B {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  SAND = 4,
  GRAVEL = 5,
  WATER = 6,
  LOG = 7,
  LEAVES = 8,
  PLANK = 9,
  PATH = 10,
  STONE_BRICK = 11,
  SNOW = 12,
  TALL_GRASS = 13,
  FLOWER_RED = 14,
  FLOWER_YELLOW = 15,
  PINE_LOG = 16,
  PINE_LEAVES = 17,
  REED = 18,
  COBBLE = 19,
  GLASS = 20,
  IRON_BLOCK = 21,
  GOLD_BLOCK = 22,
  DIAMOND_BLOCK = 23,
  GLOWSTONE = 24,
  OBSIDIAN = 25,
  BRICK = 26,
  DARK_STONE = 27,
  LAVA = 28,
  // Minérios (adicionados na rodada de cavernas). Cabem na folga 29..63 reservada para blocos
  // nativos futuros, então nenhum save existente com blocos de mod é afetado.
  COAL_ORE = 29,
  IRON_ORE = 30,
  GOLD_ORE = 31,
  DIAMOND_ORE = 32,
  TORCH = 33,
}

export interface BlockDef {
  name: string;
  solid: boolean;      // colide com o jogador
  opaque: boolean;     // oculta faces vizinhas
  decor: boolean;      // renderizado como caixinha pequena, quebra sem ferramenta
  gravity: boolean;    // cai quando sem suporte embaixo (areia/cascalho)
  structural: boolean; // participa do colapso estrutural
  /** [topo, lateral, base] em RGB 0-1 */
  colors: [number[], number[], number[]];
  /** item concedido ao quebrar (id de bloco); -1 = nada */
  drops: number;
  /** Tier mínimo de ferramenta para o bloco realmente dropar item ao quebrar (0=mão, 1=madeira, 2=pedra, 3=ferro). Só se aplica no Modo Sobrevivência. */
  minToolTier?: number;
  /** Blocos com comportamento especial (luminoso, fluido) — usado para separar em aba própria no inventário criativo. */
  interactive?: boolean;
  /** Luz emitida pelo bloco (0-15). Reservado para a propagação de luz; por ora só metadado de mod. */
  lightLevel?: number;
  /** Veio de um mod (criado pela IA ou importado), não faz parte da paleta base. */
  custom?: boolean;
  /** Slot vazio entre ids de mod — nunca é renderizado nem listado no inventário. */
  reserved?: boolean;
  /** Mod que declarou este bloco (só para blocos custom). */
  modId?: string;
  /** Chave simbólica do bloco dentro do mod, ex.: 'rubi' em 'meumod:rubi'. */
  key?: string;
}

function c(hex: number): number[] {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

function def(
  name: string, top: number, side: number, bottom: number,
  o: Partial<Omit<BlockDef, 'name' | 'colors'>> = {},
): BlockDef {
  return {
    name,
    solid: o.solid ?? true,
    opaque: o.opaque ?? true,
    decor: o.decor ?? false,
    gravity: o.gravity ?? false,
    structural: o.structural ?? false,
    colors: [c(top), c(side), c(bottom)],
    drops: o.drops ?? -1,
    minToolTier: o.minToolTier ?? 0,
    interactive: o.interactive ?? false,
  };
}

export const BLOCKS: BlockDef[] = [];
BLOCKS[B.AIR] = def('ar', 0, 0, 0, { solid: false, opaque: false });
BLOCKS[B.GRASS] = def('grama', 0x5fb23c, 0x8a6b42, 0x7a5c38, { drops: B.DIRT });
BLOCKS[B.DIRT] = def('terra', 0x8a6b42, 0x82643d, 0x7a5c38, { drops: B.DIRT });
BLOCKS[B.STONE] = def('pedra', 0x8f9394, 0x87898b, 0x7e8082, { drops: B.COBBLE, minToolTier: 1 });
BLOCKS[B.SAND] = def('areia', 0xdccf9a, 0xd2c48e, 0xc4b681, { gravity: true, drops: B.SAND });
BLOCKS[B.GRAVEL] = def('cascalho', 0x9a938c, 0x8f8881, 0x847d76, { gravity: true, drops: B.GRAVEL });
BLOCKS[B.WATER] = def('água', 0x3f76c9, 0x3a6fc0, 0x3564ad, { solid: false, opaque: false, interactive: true });
BLOCKS[B.LOG] = def('tronco', 0x9a7d4d, 0x6e5230, 0x9a7d4d, { drops: B.LOG });
BLOCKS[B.LEAVES] = def('folhas', 0x4f9a30, 0x458a2a, 0x3d7a25, { drops: -1 });
BLOCKS[B.PLANK] = def('tábuas', 0xb08d55, 0xa5824c, 0x977544, { structural: true, drops: B.PLANK });
BLOCKS[B.PATH] = def('caminho', 0xa8a294, 0x968f81, 0x8a8376, { drops: B.COBBLE });
BLOCKS[B.STONE_BRICK] = def('tijolo de pedra', 0x9aa0a3, 0x8e9497, 0x82888b, { structural: true, drops: B.STONE_BRICK, minToolTier: 1 });
BLOCKS[B.SNOW] = def('neve', 0xf2f5f7, 0xe8ecef, 0xd8dcdf, { drops: B.DIRT });
BLOCKS[B.TALL_GRASS] = def('capim', 0x64b53e, 0x5aa838, 0x529a33, { solid: false, opaque: false, decor: true, drops: -1 });
BLOCKS[B.FLOWER_RED] = def('flor vermelha', 0xd9534a, 0x5aa838, 0x5aa838, { solid: false, opaque: false, decor: true, drops: -1 });
BLOCKS[B.FLOWER_YELLOW] = def('flor amarela', 0xe8c84a, 0x5aa838, 0x5aa838, { solid: false, opaque: false, decor: true, drops: -1 });
BLOCKS[B.PINE_LOG] = def('tronco de pinheiro', 0x6b4f2e, 0x4e3820, 0x6b4f2e, { drops: B.LOG });
BLOCKS[B.PINE_LEAVES] = def('folhas de pinheiro', 0x2e6b33, 0x28602e, 0x235628, { drops: -1 });
BLOCKS[B.REED] = def('junco', 0x7fb95a, 0x74ad52, 0x6aa04b, { solid: false, opaque: false, decor: true, drops: -1 });
BLOCKS[B.COBBLE] = def('pedregulho', 0x8a8d8f, 0x808385, 0x747779, { structural: true, drops: B.COBBLE });
BLOCKS[B.GLASS] = def('vidro', 0x93c5fd, 0x93c5fd, 0x93c5fd, { solid: true, opaque: false, drops: -1 });
BLOCKS[B.IRON_BLOCK] = def('bloco de ferro', 0xf1f5f9, 0xe2e8f0, 0xcbd5e1, { structural: true, drops: B.IRON_BLOCK, minToolTier: 2 });
BLOCKS[B.GOLD_BLOCK] = def('bloco de ouro', 0xfde047, 0xeab308, 0xca8a04, { structural: true, drops: B.GOLD_BLOCK, minToolTier: 2 });
BLOCKS[B.DIAMOND_BLOCK] = def('bloco de diamante', 0x38bdf8, 0x0284c7, 0x0369a1, { structural: true, drops: B.DIAMOND_BLOCK, minToolTier: 3 });
BLOCKS[B.GLOWSTONE] = def('pedra luminosa', 0xfef08a, 0xfde047, 0xeab308, { structural: true, drops: B.GLOWSTONE, interactive: true });
BLOCKS[B.OBSIDIAN] = def('obsidiana', 0x1e1b4b, 0x18181b, 0x09090b, { structural: true, drops: B.OBSIDIAN, minToolTier: 3 });
BLOCKS[B.BRICK] = def('tijolo', 0xb91c1c, 0x991b1b, 0x7f1d1d, { structural: true, drops: B.BRICK });
BLOCKS[B.DARK_STONE] = def('pedra escura', 0x334155, 0x1e293b, 0x0f172a, { structural: true, drops: B.DARK_STONE, minToolTier: 1 });
BLOCKS[B.LAVA] = def('lava', 0xea580c, 0xc2410c, 0x9a3412, { solid: false, opaque: false, interactive: true });
// Minérios: matriz de pedra com salpicos do mineral, por isso a cor fica entre a da pedra e a
// do metal puro. `drops` aponta para o bloco refinado correspondente, fechando a progressão
// picareta → minério → bloco.
BLOCKS[B.COAL_ORE] = def('minério de carvão', 0x6b7280, 0x5f6672, 0x555b66, { drops: B.COAL_ORE, minToolTier: 1 });
BLOCKS[B.IRON_ORE] = def('minério de ferro', 0xb0a89c, 0xa39a8e, 0x968d81, { drops: B.IRON_ORE, minToolTier: 1 });
BLOCKS[B.GOLD_ORE] = def('minério de ouro', 0xc4b06a, 0xb5a05e, 0xa69053, { drops: B.GOLD_ORE, minToolTier: 2 });
BLOCKS[B.DIAMOND_ORE] = def('minério de diamante', 0x7ba9b8, 0x6d9aa9, 0x5f8b9a, { drops: B.DIAMOND_ORE, minToolTier: 3 });
// Tocha: decorativa (caixinha pequena, quebra na mão) e a principal fonte de luz portátil.
// É `interactive` para aparecer na aba de blocos especiais do inventário criativo.
BLOCKS[B.TORCH] = def('tocha', 0xfde047, 0x9a7d4d, 0x6e5230, {
  solid: false, opaque: false, decor: true, drops: B.TORCH, interactive: true,
});
BLOCKS[B.TORCH].lightLevel = 14;

// --- Blocos customizados (sistema de mods) ---------------------------------
//
// Antes, `registerCustomBlock` fazia `BLOCKS[BLOCKS.length] = ...`: o id dependia da ordem de
// chamada dentro da sessão e nada era salvo. Ao recarregar o mundo o array voltava a ter só os
// blocos base, mas os `blockMods` no IndexedDB continuavam apontando para ids ≥ 29 — e o mesher
// (`mesher.ts`, `const def = BLOCKS[t]` seguido de `def.colors`) quebrava o chunk inteiro num id
// órfão. Ou seja, todo bloco criado pela IA corrompia o mundo no reload.
//
// Agora o id é **atribuído pelo mod e persistido junto com ele** (ver `src/mods/`), alocado a
// partir de uma base fixa. A base deixa uma folga entre a paleta base e os mods para que
// adicionar blocos nativos no futuro nunca colida com ids já gravados em saves existentes.

/** Quantidade de blocos da paleta base. Ids abaixo disso nunca pertencem a mods. */
export const VANILLA_BLOCK_COUNT = BLOCKS.length;

/** Primeiro id disponível para blocos de mod. A folga 29..63 é reserva para blocos nativos futuros. */
export const CUSTOM_BLOCK_ID_BASE = 64;

/** Teto de blocos de mod por mundo (ids 64..319). */
export const MAX_CUSTOM_BLOCKS = 256;

/**
 * Devolvido por `getBlockDef` quando um id não tem definição — acontece quando um save
 * referencia um bloco de um mod que foi removido ou não carregou. Renderiza em magenta
 * (cor de "textura faltando", convenção de engine) em vez de derrubar o mesher.
 */
export const MISSING_BLOCK: BlockDef = def('bloco ausente', 0xff00ff, 0xd400d4, 0xa800a8);

/** Slot vazio entre ids de mod: existe só para o array não ter buracos `undefined`. */
function reservedSlot(): BlockDef {
  const d = def('', 0, 0, 0, { solid: false, opaque: false });
  d.reserved = true;
  return d;
}

/**
 * Leitura segura de definição de bloco. Use no lugar de `BLOCKS[t]` em qualquer caminho que
 * desreferencie o resultado (mesher, física, UI) — um id órfão vira `MISSING_BLOCK` visível
 * em vez de um `TypeError` que apaga o chunk.
 */
export function getBlockDef(t: number): BlockDef {
  const d = BLOCKS[t];
  if (!d || d.reserved) return MISSING_BLOCK;
  return d;
}

export interface CustomBlockSpec {
  name: string;
  topColor: number | string;
  sideColor?: number | string;
  bottomColor?: number | string;
  solid?: boolean;
  opaque?: boolean;
  decor?: boolean;
  gravity?: boolean;
  structural?: boolean;
  drops?: number;
  minToolTier?: number;
  interactive?: boolean;
  lightLevel?: number;
  modId?: string;
  key?: string;
}

function toHex(value: number | string | undefined, fallback: number): number {
  if (typeof value === 'string') {
    const parsed = parseInt(value.replace('#', ''), 16);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Registra um bloco de mod **num id explícito e estável**. É o caminho usado ao reaplicar um
 * mod salvo: o id vem do pacote persistido, então o mesmo bloco recebe o mesmo id em toda
 * sessão e os `blockMods` gravados continuam válidos.
 */
export function registerCustomBlockAt(blockId: number, spec: CustomBlockSpec): number {
  if (!Number.isInteger(blockId) || blockId < CUSTOM_BLOCK_ID_BASE) {
    throw new Error(`Id de bloco customizado inválido: ${blockId} (mínimo ${CUSTOM_BLOCK_ID_BASE}).`);
  }
  if (blockId >= CUSTOM_BLOCK_ID_BASE + MAX_CUSTOM_BLOCKS) {
    throw new Error(`Id de bloco customizado ${blockId} excede o limite de ${MAX_CUSTOM_BLOCKS} blocos por mundo.`);
  }

  // Preenche o intervalo com slots reservados para o array nunca ter buracos `undefined`.
  for (let i = BLOCKS.length; i < blockId; i++) BLOCKS[i] = reservedSlot();

  const top = toHex(spec.topColor, 0x38bdf8);
  const side = toHex(spec.sideColor, top);
  const bottom = toHex(spec.bottomColor, side);

  const created = def(spec.name || `bloco ${blockId}`, top, side, bottom, {
    solid: spec.solid ?? true,
    opaque: spec.opaque ?? true,
    decor: spec.decor ?? false,
    gravity: spec.gravity ?? false,
    structural: spec.structural ?? false,
    drops: spec.drops ?? blockId,
    minToolTier: spec.minToolTier ?? 0,
    interactive: spec.interactive ?? false,
  });
  created.custom = true;
  created.lightLevel = spec.lightLevel ?? 0;
  created.modId = spec.modId;
  created.key = spec.key;

  BLOCKS[blockId] = created;
  return blockId;
}

/** Menor id livre a partir da base — usado ao criar um bloco novo, antes de persisti-lo. */
export function nextFreeCustomBlockId(): number {
  for (let id = CUSTOM_BLOCK_ID_BASE; id < CUSTOM_BLOCK_ID_BASE + MAX_CUSTOM_BLOCKS; id++) {
    const d = BLOCKS[id];
    if (!d || d.reserved) return id;
  }
  throw new Error(`Limite de ${MAX_CUSTOM_BLOCKS} blocos customizados atingido neste mundo.`);
}

/**
 * Compatibilidade com o escopo de `execute_voxel_script`: aloca o próximo id livre.
 * Diferente da versão antiga, o bloco criado aqui é capturado pelo `ModService` e salvo no
 * mundo — não desaparece mais no reload.
 */
export function registerCustomBlock(spec: CustomBlockSpec): number {
  const blockId = nextFreeCustomBlockId();
  registerCustomBlockAt(blockId, spec);
  console.log(`[blocks.ts] Bloco customizado "${spec.name}" registrado no id ${blockId}.`);
  return blockId;
}

/** Remove um bloco de mod, deixando o slot reservado (o id não é reciclado). */
export function unregisterCustomBlock(blockId: number): void {
  if (blockId < CUSTOM_BLOCK_ID_BASE || blockId >= BLOCKS.length) return;
  BLOCKS[blockId] = reservedSlot();
}

/** Descarta todos os blocos de mod. Chamado ao trocar de mundo, antes de reaplicar os mods dele. */
export function resetCustomBlocks(): void {
  BLOCKS.length = VANILLA_BLOCK_COUNT;
}

/** Blocos de mod ativos, com seus ids. */
export function listCustomBlocks(): { id: number; def: BlockDef }[] {
  const out: { id: number; def: BlockDef }[] = [];
  for (let id = CUSTOM_BLOCK_ID_BASE; id < BLOCKS.length; id++) {
    const d = BLOCKS[id];
    if (d && !d.reserved) out.push({ id, def: d });
  }
  return out;
}

/** Água e lava: voxels de fluido finito, com escoamento próprio (ver `src/world/fluids.ts`). */
export function isFluid(t: number): boolean { return t === B.WATER || t === B.LAVA; }

/** Célula que um voxel de fluido pode ocupar ao escoar (ar ou vegetação decorativa, que é levada junto). */
export function isFluidPassable(t: number): boolean { return t === B.AIR || isDecor(t); }

export function isSolid(t: number): boolean { return BLOCKS[t]?.solid ?? false; }
export function isOpaque(t: number): boolean { return BLOCKS[t]?.opaque ?? false; }
export function isDecor(t: number): boolean { return BLOCKS[t]?.decor ?? false; }
export function isLeaves(t: number): boolean { return t === B.LEAVES || t === B.PINE_LEAVES; }

/**
 * Canal de tingimento sazonal de um bloco: 0 = nenhum, 1 = folhagem, 2 = grama.
 *
 * Isto viaja como **um byte por vértice** até o shader, e é o que permite o outono pintar o mundo
 * sem regerar chunk nenhum: mudar a cor da folhagem é trocar um uniform, não remontar geometria.
 *
 * Blocos de mod entram sozinhos, pelas propriedades: um bloco `decor` não sólido é folhagem, do
 * mesmo jeito que já herda o som de folhagem em `materialOf`. Um mod que cria "samambaia" ganha
 * outono de graça, sem declarar nada.
 */
export function seasonTintOf(t: number): 0 | 1 | 2 {
  if (isLeaves(t)) return 1;
  const def = BLOCKS[t];
  if (!def || def.reserved) return 0;
  if (t === B.GRASS) return 2;
  if (def.decor && !def.solid) return 1;
  return 0;
}
export function isLog(t: number): boolean { return t === B.LOG || t === B.PINE_LOG; }
/** Bloco que serve de apoio para estruturas (terreno natural). */
export function isSupport(t: number): boolean {
  return isSolid(t) && !BLOCKS[t].structural && !isLeaves(t) && !isDecor(t);
}
/** Célula onde se pode colocar bloco por cima (substituível). */
export function isReplaceable(t: number): boolean {
  return t === B.AIR || t === B.WATER || t === B.LAVA || isDecor(t);
}
