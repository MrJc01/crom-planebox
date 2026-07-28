// Gerador de árvores paramétricas procedurais com tronco, galhos e copas — itens 1600-1602.
import { World } from './world';
import { B } from './blocks';

export type TreeSpecies = 'carvalho' | 'pinheiro' | 'acacia' | 'cerejeira';

export interface ParametricTreeOptions {
  x: number;
  y: number;
  z: number;
  species: TreeSpecies;
  height?: number;
  age?: number;
}

export class ParametricTreeGenerator {
  public static place(world: World, options: ParametricTreeOptions): number {
    const { x, y, z, species, height = 8 } = options;
    let placedCount = 0;

    const logBlock = species === 'pinheiro' ? B.LOG : B.LOG;
    const leafBlock = B.LEAVES;

    // 1. Tronco vertical principal
    for (let h = 0; h < height; h++) {
      if (world.setBlock(x, y + h, z, logBlock)) placedCount++;
    }

    const canopyStartY = y + Math.floor(height * 0.6);

    // 2. Galhos laterais procedurais por espécie
    if (species === 'carvalho' || species === 'acacia') {
      const branchHeight = y + Math.floor(height * 0.7);
      const dirs = [
        { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
        { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
      ];
      for (const d of dirs) {
        for (let len = 1; len <= 2; len++) {
          if (world.setBlock(x + d.dx * len, branchHeight + len - 1, z + d.dz * len, logBlock)) {
            placedCount++;
          }
        }
      }
    }

    // 3. Copa de folhas procedurais
    const leafRadius = species === 'pinheiro' ? 2 : 3;
    for (let ly = canopyStartY; ly <= y + height + 1; ly++) {
      const layerR = species === 'pinheiro'
        ? Math.max(1, leafRadius - Math.floor((ly - canopyStartY) / 2))
        : leafRadius - Math.abs(ly - (y + height - 1));

      for (let lx = -layerR; lx <= layerR; lx++) {
        for (let lz = -layerR; lz <= layerR; lz++) {
          if (Math.abs(lx) === layerR && Math.abs(lz) === layerR && Math.random() > 0.4) continue;
          const targetX = x + lx, targetY = ly, targetZ = z + lz;
          const existing = world.getBlock(targetX, targetY, targetZ);
          if (existing === B.AIR) {
            if (world.setBlock(targetX, targetY, targetZ, leafBlock)) placedCount++;
          }
        }
      }
    }

    return placedCount;
  }
}
