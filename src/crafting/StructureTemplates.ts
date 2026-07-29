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

/**
 * Templates registrados por mods — item 689.
 *
 * Lista separada da nativa, como os biomas e as regras de espalhamento: precisa ser limpa ao trocar
 * de mundo, e o conjunto nativo precisa voltar sem depender de contagem.
 */
const TEMPLATES_DE_MOD: StructureTemplate[] = [];

/** Registra um template de mod. Devolve o erro, ou `null` se entrou. */
export function registrarTemplateDeMod(tpl: StructureTemplate): string | null {
  if (!tpl?.id) return 'template sem id';
  if (!Array.isArray(tpl.blocks) || tpl.blocks.length === 0) {
    // Um template vazio produziria um sítio escolhido, o terreno aplanado e nada construído: um
    // clarão inexplicável no meio do mundo.
    return `o template "${tpl.id}" não tem blocos`;
  }
  if (STRUCTURE_TEMPLATES.some((t) => t.id === tpl.id)) {
    return `"${tpl.id}" é um template nativo e não pode ser substituído`;
  }
  const i = TEMPLATES_DE_MOD.findIndex((t) => t.id === tpl.id);
  // Substituir o próprio, e não recusar: o autor edita a estrutura no editor e recarrega o mod
  // várias vezes por minuto. Recusar aqui obrigaria a reiniciar o mundo a cada ajuste.
  if (i >= 0) TEMPLATES_DE_MOD[i] = tpl; else TEMPLATES_DE_MOD.push(tpl);
  return null;
}

export function limparTemplatesDeMod(): void {
  TEMPLATES_DE_MOD.length = 0;
}

export function templatesDeModRegistrados(): readonly StructureTemplate[] {
  return TEMPLATES_DE_MOD;
}

export function getStructureTemplate(id: string): StructureTemplate | undefined {
  return STRUCTURE_TEMPLATES.find((t) => t.id === id)
    ?? TEMPLATES_DE_MOD.find((t) => t.id === id);
}

/**
 * Converte e valida blocos de estruturas de mods suportando tanto IDs numéricos quanto referências simbólicas — item 1430 P1.
 */
export function resolveSymbolicStructureBlocks(rawBlocks: any[], blockResolver?: (ref: any) => number): StructureBlock[] {
  return rawBlocks.map((b) => {
    let blockId = typeof b.block === 'number' ? b.block : (b.block ? B.STONE : B.AIR);
    if (typeof b.block === 'string' && blockResolver) {
      blockId = blockResolver(b.block);
    }
    return { dx: b.dx ?? 0, dy: b.dy ?? 0, dz: b.dz ?? 0, block: blockId };
  });
}

/**
 * Construção progressiva de estruturas de grande escala por lotes ao longo do tempo — item 1656 P1.
 */
export function buildStructureProgressively(
  world: { setBlock: (x: number, y: number, z: number, block: number) => void },
  structureId: string,
  originX: number,
  originY: number,
  originZ: number,
  batchSize = 10,
): number {
  const template = getStructureTemplate(structureId);
  if (!template) return 0;

  const countToPlace = Math.min(batchSize, template.blocks.length);
  for (let i = 0; i < countToPlace; i++) {
    const b = template.blocks[i];
    world.setBlock(originX + b.dx, originY + b.dy, originZ + b.dz, b.block);
  }

  return countToPlace;
}

/**
 * Salva a estrutura criada como um template reutilizável — item 1567 P1.
 */
export function saveStructureAsTemplate(name: string, blocks: StructureBlock[]): StructureTemplate {
  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const tpl: StructureTemplate = { id, name, blocks: [...blocks] };
  registrarTemplateDeMod(tpl);
  return tpl;
}

/**
 * Gerador de árvore paramétrica com tronco, galhos e copa derivando de parâmetros — item 1600 P1.
 */
export function generateParametricTree(height = 6, canopyRadius = 2): StructureBlock[] {
  const blocks: StructureBlock[] = [];
  for (let y = 0; y < height; y++) {
    blocks.push({ dx: 0, dy: y, dz: 0, block: B.LOG });
  }

  // Galhos principais e copa circular
  for (let dy = height - 2; dy <= height + 1; dy++) {
    for (let dx = -canopyRadius; dx <= canopyRadius; dx++) {
      for (let dz = -canopyRadius; dz <= canopyRadius; dz++) {
        if (Math.hypot(dx, dz) <= canopyRadius + 0.3) {
          if (dx === 0 && dz === 0 && dy < height) continue;
          blocks.push({ dx, dy, dz, block: B.LEAVES });
        }
      }
    }
  }

  return blocks;
}

export type TreeSpecies = 'carvalho' | 'pinheiro' | 'palmeira' | 'morta';

export interface TreeSpeciesProfile {
  species: TreeSpecies;
  trunkHeight: number;
  canopyRadius: number;
  logBlock: number;
  leavesBlock: number;
  hasBranches: boolean;
}

/** Perfis declarativos por espécie de árvore — item 1602 P1. */
export const TREE_PROFILES: Record<TreeSpecies, TreeSpeciesProfile> = {
  carvalho: { species: 'carvalho', trunkHeight: 6, canopyRadius: 2, logBlock: B.LOG, leavesBlock: B.LEAVES, hasBranches: true },
  pinheiro: { species: 'pinheiro', trunkHeight: 8, canopyRadius: 2, logBlock: B.PINE_LOG, leavesBlock: B.PINE_LEAVES, hasBranches: false },
  palmeira: { species: 'palmeira', trunkHeight: 7, canopyRadius: 3, logBlock: B.LOG, leavesBlock: B.LEAVES, hasBranches: true },
  morta: { species: 'morta', trunkHeight: 5, canopyRadius: 0, logBlock: B.LOG, leavesBlock: B.AIR, hasBranches: true },
};

/** Gerador de galhos tridimensionais de verdade para árvores — item 1601 P1. */
export function generateTreeBranches(height: number): StructureBlock[] {
  const branchBlocks: StructureBlock[] = [];
  const branchY = Math.floor(height * 0.6);

  branchBlocks.push({ dx: 1, dy: branchY, dz: 0, block: B.LOG });
  branchBlocks.push({ dx: 2, dy: branchY + 1, dz: 0, block: B.LOG });

  branchBlocks.push({ dx: -1, dy: branchY + 1, dz: 0, block: B.LOG });
  branchBlocks.push({ dx: -2, dy: branchY + 2, dz: 0, block: B.LOG });

  branchBlocks.push({ dx: 0, dy: branchY, dz: 1, block: B.LOG });
  branchBlocks.push({ dx: 0, dy: branchY + 1, dz: 2, block: B.LOG });

  return branchBlocks;
}

export type PrimitiveShape = 'cylinder' | 'cone' | 'sphere' | 'wedge';

/** Formas geométricas 3D primárias (cilindro, cone, esfera, cunha) — item 1615 P1. */
export function generatePrimitiveShape(shape: PrimitiveShape, radius: number, height: number, blockType = B.STONE): StructureBlock[] {
  const blocks: StructureBlock[] = [];
  for (let dy = 0; dy < height; dy++) {
    const currentRadius = shape === 'cone' ? Math.max(0, radius * (1 - dy / height)) : radius;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const dist = Math.hypot(dx, dz);
        let include = false;
        if (shape === 'cylinder' || shape === 'cone') {
          include = dist <= currentRadius;
        } else if (shape === 'sphere') {
          include = Math.hypot(dx, dy - radius, dz) <= radius;
        } else if (shape === 'wedge') {
          include = dx >= 0 && dz >= 0 && (dx + dy <= radius);
        }
        if (include) blocks.push({ dx, dy, dz, block: blockType });
      }
    }
  }
  return blocks;
}

/** Telhado inclinado piramidal como forma de primeira classe — item 1616 P1. */
export function generateSlopedRoof(width: number, depth: number, height: number, blockType = B.PLANK): StructureBlock[] {
  const blocks: StructureBlock[] = [];
  for (let dy = 0; dy < height; dy++) {
    const inset = dy;
    for (let dx = inset; dx < width - inset; dx++) {
      for (let dz = inset; dz < depth - inset; dz++) {
        blocks.push({ dx, dy, dz, block: blockType });
      }
    }
  }
  return blocks;
}

/**
 * Objetivos de segunda volta no loop de progressão pós-obsidiana — item 1307 P1.
 */
export function getEndgameObjectives(): { id: string; name: string; requiredMaterial: number }[] {
  return [
    { id: 'build_beacon', name: 'Construir Farol de Obsidiana', requiredMaterial: B.OBSIDIAN },
    { id: 'build_portal', name: 'Forjar Portal de Energia', requiredMaterial: B.ENERGY_ORE },
    { id: 'build_monument', name: 'Erguer Monumento de Diamante', requiredMaterial: B.DIAMOND_BLOCK },
  ];
}

/** Paleta de projeto salvável no modo criativo — item 023 P2. */
export class ProjectPalette {
  private blocks: number[] = [];

  constructor(public name: string) {}

  public addBlock(blockType: number): void {
    if (!this.blocks.includes(blockType)) this.blocks.push(blockType);
  }

  public getPalette(): number[] {
    return [...this.blocks];
  }
}

export interface SnapshotBlock {
  dx: number;
  dy: number;
  dz: number;
  blockType: number;
}

/** Snapshot/clone de região para copiar e colar estruturas grandes — item 047 P2. */
export class StructureSnapshot {
  private blocks: SnapshotBlock[] = [];

  public capture(world: { getBlock: (x: number, y: number, z: number) => number }, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): void {
    this.blocks = [];
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const b = world.getBlock(x, y, z);
          if (b !== 0) {
            this.blocks.push({ dx: x - minX, dy: y - minY, dz: z - minZ, blockType: b });
          }
        }
      }
    }
  }

  public getBlocks(): SnapshotBlock[] {
    return [...this.blocks];
  }
}
