export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  COBBLESTONE = 4,
  WOOD = 5,
  LEAVES = 6,
  BRICK = 7,
  GLASS = 8,
  LAVA = 9,
  WATER = 10,
  SAND = 11,
  GLOWSTONE = 12,
  IRON_BLOCK = 13,
  GOLD_BLOCK = 14,
  DIAMOND_BLOCK = 15,
  DARK_STONE = 16,
  PLANT = 17
}

export interface BlockDefinition {
  id: BlockType;
  name: string;
  color: string; // Hex color string
  transparent?: boolean;
  emissive?: boolean;
  emissiveColor?: string;
  roughness?: number;
}

export const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  [BlockType.AIR]: { id: BlockType.AIR, name: 'Ar', color: '#000000', transparent: true },
  [BlockType.GRASS]: { id: BlockType.GRASS, name: 'Grama', color: '#557a2b', roughness: 0.8 },
  [BlockType.DIRT]: { id: BlockType.DIRT, name: 'Terra', color: '#593d28', roughness: 0.9 },
  [BlockType.STONE]: { id: BlockType.STONE, name: 'Pedra', color: '#737577', roughness: 0.6 },
  [BlockType.COBBLESTONE]: { id: BlockType.COBBLESTONE, name: 'Pedra Lascada', color: '#4a4d4e', roughness: 0.7 },
  [BlockType.WOOD]: { id: BlockType.WOOD, name: 'Madeira', color: '#6e4a27', roughness: 0.7 },
  [BlockType.LEAVES]: { id: BlockType.LEAVES, name: 'Folhas', color: '#386629', transparent: false, roughness: 0.9 },
  [BlockType.BRICK]: { id: BlockType.BRICK, name: 'Tijolo', color: '#8c3d2b', roughness: 0.5 },
  [BlockType.GLASS]: { id: BlockType.GLASS, name: 'Vidro', color: '#a0c8d888', transparent: true, roughness: 0.1 },
  [BlockType.LAVA]: { id: BlockType.LAVA, name: 'Lava', color: '#ff4500', emissive: true, emissiveColor: '#ff2200' },
  [BlockType.WATER]: { id: BlockType.WATER, name: 'Água', color: '#2b628c99', transparent: true, roughness: 0.2 },
  [BlockType.SAND]: { id: BlockType.SAND, name: 'Areia', color: '#d1b87d', roughness: 0.8 },
  [BlockType.GLOWSTONE]: { id: BlockType.GLOWSTONE, name: 'Pedra Luminosa', color: '#ffea88', emissive: true, emissiveColor: '#e6c200' },
  [BlockType.IRON_BLOCK]: { id: BlockType.IRON_BLOCK, name: 'Bloco de Ferro', color: '#d8d8d8', roughness: 0.3 },
  [BlockType.GOLD_BLOCK]: { id: BlockType.GOLD_BLOCK, name: 'Bloco de Ouro', color: '#ffd700', roughness: 0.2 },
  [BlockType.DIAMOND_BLOCK]: { id: BlockType.DIAMOND_BLOCK, name: 'Bloco de Diamante', color: '#00eeee', roughness: 0.2 },
  [BlockType.DARK_STONE]: { id: BlockType.DARK_STONE, name: 'Pedra Escura', color: '#2a2b2e', roughness: 0.7 },
  [BlockType.PLANT]: { id: BlockType.PLANT, name: 'Planta/Vegetação', color: '#448822', transparent: true, roughness: 0.9 }
};

export const VOXEL_SIZE = 0.5; // Micro-voxel scaling (0.5 units per block side for high detail)
