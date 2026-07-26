import { World } from '../world/world';
import { TOPO_VARREDURA } from '../world/chunk';
import { BLOCKS, B } from '../world/blocks';
import { WorldRepository } from '../storage/WorldRepository';

export interface AreaAnalysisResult {
  centerX: number;
  centerZ: number;
  radius: number;
  averageHeight: number;
  maxHeight: number;
  minHeight: number;
  biomeGuess: string;
  totalVoxelsAnalyzed: number;
  blockDistribution: Record<string, number>;
}

export class WorldPerception {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Analyzes a circular area around (centerX, centerZ) with radius.
   * Returns terrain elevation, biome type, and block type breakdown.
   */
  public analyzeArea(centerX: number, centerZ: number, radius: number = 16): AreaAnalysisResult {
    const minX = Math.floor(centerX - radius);
    const maxX = Math.ceil(centerX + radius);
    const minZ = Math.floor(centerZ - radius);
    const maxZ = Math.ceil(centerZ + radius);

    let totalHeight = 0;
    let samplesCount = 0;
    let maxHeight = -1;
    let minHeight = 256;
    const distribution: Record<string, number> = {};

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const dist = Math.hypot(x - centerX, z - centerZ);
        if (dist > radius) continue;

        // Find surface Y
        let surfaceY = 0;
        for (let y = TOPO_VARREDURA; y >= 0; y--) {
          const block = this.world.getBlock(x, y, z);
          if (block !== B.AIR && block !== B.WATER) {
            surfaceY = y;
            const blockName = BLOCKS[block]?.name || `Bloco_${block}`;
            distribution[blockName] = (distribution[blockName] || 0) + 1;
            break;
          }
        }

        totalHeight += surfaceY;
        samplesCount++;
        if (surfaceY > maxHeight) maxHeight = surfaceY;
        if (surfaceY < minHeight) minHeight = surfaceY;
      }
    }

    const avgHeight = samplesCount > 0 ? totalHeight / samplesCount : 0;

    // Guess biome based on dominant surface blocks
    let biomeGuess = 'Planície Verdejante';
    const grassCount = distribution['Grama'] || 0;
    const sandCount = distribution['Areia'] || 0;
    const stoneCount = distribution['Pedra'] || distribution['Tijolo de Pedra'] || 0;
    const snowCount = distribution['Neve'] || 0;

    if (sandCount > grassCount && sandCount > stoneCount) {
      biomeGuess = 'Deserto de Areia';
    } else if (stoneCount > grassCount) {
      biomeGuess = 'Montanhas Rochosas';
    } else if (snowCount > grassCount) {
      biomeGuess = 'Tundra Gelada';
    } else if (avgHeight < 6) {
      biomeGuess = 'Baixada / Litoral';
    }

    return {
      centerX,
      centerZ,
      radius,
      averageHeight: Number(avgHeight.toFixed(1)),
      maxHeight,
      minHeight: minHeight === 256 ? 0 : minHeight,
      biomeGuess,
      totalVoxelsAnalyzed: samplesCount,
      blockDistribution: distribution
    };
  }

  /**
   * Returns a global summary of the active world.
   */
  public async getWorldSummary(worldId: string): Promise<any> {
    const worldRecord = await WorldRepository.getWorld(worldId);
    const mods = await WorldRepository.getBlockModsForWorld(worldId);
    const threads = await WorldRepository.getChatThreads(worldId);

    return {
      worldId,
      name: worldRecord?.name || 'Mundo Voxel',
      seed: worldRecord?.seed,
      cameraMode: worldRecord?.cameraMode,
      totalModifiedVoxels: mods.size,
      totalChatThreads: threads.length,
      chunksLoadedInMemory: this.world.chunks.size
    };
  }
}
