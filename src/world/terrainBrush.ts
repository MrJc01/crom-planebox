// Pincel de escultura de terreno no mundo — item 1613.
import { World } from './world';
import { B } from './blocks';

export type BrushMode = 'raise' | 'lower' | 'flatten' | 'smooth';

export interface TerrainBrushOptions {
  cx: number;
  cy: number;
  cz: number;
  radius: number;
  mode: BrushMode;
  targetBlock?: number;
  strength?: number;
}

export interface BrushResult {
  modifiedCount: number;
}

export class TerrainBrush {
  public static apply(world: World, options: TerrainBrushOptions): BrushResult {
    const { cx, cy, cz, radius, mode, targetBlock = B.DIRT } = options;
    const r2 = radius * radius;
    const minX = Math.floor(cx - radius), maxX = Math.ceil(cx + radius);
    const minZ = Math.floor(cz - radius), maxZ = Math.ceil(cz + radius);

    let modifiedCount = 0;

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const d2 = (x - cx) ** 2 + (z - cz) ** 2;
        if (d2 > r2) continue;

        const surfaceY = world.surfaceY(x, z);

        switch (mode) {
          case 'raise': {
            const targetY = surfaceY + 1;
            if (world.setBlock(x, targetY, z, targetBlock)) {
              modifiedCount++;
            }
            break;
          }

          case 'lower': {
            if (surfaceY > 0) {
              if (world.setBlock(x, surfaceY, z, B.AIR)) {
                modifiedCount++;
              }
            }
            break;
          }

          case 'flatten': {
            const targetY = Math.floor(cy);
            if (surfaceY < targetY) {
              for (let y = surfaceY + 1; y <= targetY; y++) {
                if (world.setBlock(x, y, z, targetBlock)) modifiedCount++;
              }
            } else if (surfaceY > targetY) {
              for (let y = surfaceY; y > targetY; y--) {
                if (world.setBlock(x, y, z, B.AIR)) modifiedCount++;
              }
            }
            break;
          }

          case 'smooth': {
            let neighborSum = 0, neighborCount = 0;
            for (let dx = -1; dx <= 1; dx++) {
              for (let dz = -1; dz <= 1; dz++) {
                neighborSum += world.surfaceY(x + dx, z + dz);
                neighborCount++;
              }
            }
            const avgY = Math.round(neighborSum / neighborCount);
            if (surfaceY < avgY) {
              if (world.setBlock(x, surfaceY + 1, z, targetBlock)) modifiedCount++;
            } else if (surfaceY > avgY) {
              if (world.setBlock(x, surfaceY, z, B.AIR)) modifiedCount++;
            }
            break;
          }
        }
      }
    }

    return { modifiedCount };
  }
}
