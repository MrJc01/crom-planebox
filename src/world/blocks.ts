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

export function registerCustomBlock(defData: {
  name: string;
  topColor: number | string;
  sideColor?: number | string;
  bottomColor?: number | string;
  solid?: boolean;
  opaque?: boolean;
}): number {
  const top = typeof defData.topColor === 'string' ? parseInt(defData.topColor.replace('#', ''), 16) : (defData.topColor || 0x38bdf8);
  const side = typeof defData.sideColor === 'string' ? parseInt(defData.sideColor.replace('#', ''), 16) : (defData.sideColor ?? top);
  const bottom = typeof defData.bottomColor === 'string' ? parseInt(defData.bottomColor.replace('#', ''), 16) : (defData.bottomColor ?? side);

  const blockId = BLOCKS.length;
  BLOCKS[blockId] = def(defData.name, top, side, bottom, {
    solid: defData.solid ?? true,
    opaque: defData.opaque ?? true
  });
  console.log(`🧱 [blocks.ts] Novo Bloco Personalizado registrado ID: ${blockId} ("${defData.name}")!`);
  return blockId;
}

export function isSolid(t: number): boolean { return BLOCKS[t]?.solid ?? false; }
export function isOpaque(t: number): boolean { return BLOCKS[t]?.opaque ?? false; }
export function isDecor(t: number): boolean { return BLOCKS[t]?.decor ?? false; }
export function isLeaves(t: number): boolean { return t === B.LEAVES || t === B.PINE_LEAVES; }
export function isLog(t: number): boolean { return t === B.LOG || t === B.PINE_LOG; }
/** Bloco que serve de apoio para estruturas (terreno natural). */
export function isSupport(t: number): boolean {
  return isSolid(t) && !BLOCKS[t].structural && !isLeaves(t) && !isDecor(t);
}
/** Célula onde se pode colocar bloco por cima (substituível). */
export function isReplaceable(t: number): boolean {
  return t === B.AIR || t === B.WATER || t === B.LAVA || isDecor(t);
}
