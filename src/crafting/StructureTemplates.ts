// Templates de estrutura ("edifícios") colocáveis como item no Modo Criativo — igual uma
// árvore pronta, em vez de bloco a bloco. Cada template é gerado por função (não hardcoded
// manualmente) como uma lista de blocos relativos a uma origem (0,0,0), que o Interaction
// usa tanto para desenhar o preview transparente quanto para "carimbar" no mundo ao colocar.
import { B } from '../world/blocks';

export interface StructureBlock {
  dx: number;
  dy: number;
  dz: number;
  block: number;
}

export interface StructureTemplate {
  id: string;
  name: string;
  blocks: StructureBlock[];
}

function generateTree(): StructureBlock[] {
  const blocks: StructureBlock[] = [];
  const trunkHeight = 5;
  for (let y = 0; y < trunkHeight; y++) blocks.push({ dx: 0, dy: y, dz: 0, block: B.LOG });

  const canopyLayers = [
    { y: trunkHeight - 2, r: 2 },
    { y: trunkHeight - 1, r: 2 },
    { y: trunkHeight, r: 1.4 },
    { y: trunkHeight + 1, r: 0.8 },
  ];
  for (const layer of canopyLayers) {
    const r = Math.ceil(layer.r);
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.hypot(dx, dz) > layer.r + 0.4) continue;
        if (dx === 0 && dz === 0 && layer.y < trunkHeight) continue; // não sobrepõe o tronco
        blocks.push({ dx, dy: layer.y, dz, block: B.LEAVES });
      }
    }
  }
  return blocks;
}

function generateSmallHouse(): StructureBlock[] {
  const blocks: StructureBlock[] = [];
  const w = 5, d = 5, h = 4;
  const doorX = Math.floor(w / 2);
  const windowZ = Math.floor(d / 2);

  for (let x = 0; x < w; x++) {
    for (let z = 0; z < d; z++) blocks.push({ dx: x, dy: 0, dz: z, block: B.PLANK });
  }

  for (let y = 1; y <= h; y++) {
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        const isEdge = x === 0 || x === w - 1 || z === 0 || z === d - 1;
        if (!isEdge) continue;
        if (z === 0 && x === doorX && y <= 2) continue; // vão da porta
        if ((x === 0 || x === w - 1) && z === windowZ && y === 2) {
          blocks.push({ dx: x, dy: y, dz: z, block: B.GLASS });
          continue;
        }
        blocks.push({ dx: x, dy: y, dz: z, block: B.STONE_BRICK });
      }
    }
  }

  for (let x = -1; x <= w; x++) {
    for (let z = -1; z <= d; z++) blocks.push({ dx: x, dy: h + 1, dz: z, block: B.PLANK });
  }

  blocks.push({ dx: doorX, dy: h, dz: windowZ, block: B.GLOWSTONE });
  return blocks;
}

function generateTower(): StructureBlock[] {
  const blocks: StructureBlock[] = [];
  const radius = 2, height = 10;
  for (let y = 0; y < height; y++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const dist = Math.hypot(dx, dz);
        if (dist <= radius && dist > radius - 1.1) {
          blocks.push({ dx, dy: y, dz, block: B.STONE_BRICK });
        }
      }
    }
  }
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (Math.hypot(dx, dz) <= radius) blocks.push({ dx, dy: height, dz, block: B.STONE_BRICK });
    }
  }
  // merlons (ameias) alternadas no topo
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const dist = Math.hypot(dx, dz);
      if (dist <= radius && dist > radius - 1.1 && (dx + dz) % 2 === 0) {
        blocks.push({ dx, dy: height + 1, dz, block: B.STONE_BRICK });
      }
    }
  }
  return blocks;
}

function generateWall(length = 8): StructureBlock[] {
  const blocks: StructureBlock[] = [];
  const height = 3;
  for (let x = 0; x < length; x++) {
    for (let y = 0; y < height; y++) blocks.push({ dx: x, dy: y, dz: 0, block: B.COBBLE });
  }
  return blocks;
}

export const STRUCTURE_TEMPLATES: StructureTemplate[] = [
  { id: 'tree', name: 'Árvore', blocks: generateTree() },
  { id: 'small_house', name: 'Casa Pequena', blocks: generateSmallHouse() },
  { id: 'tower', name: 'Torre', blocks: generateTower() },
  { id: 'wall', name: 'Muro', blocks: generateWall(8) },
];

export function getStructureTemplate(id: string): StructureTemplate | undefined {
  return STRUCTURE_TEMPLATES.find((t) => t.id === id);
}
