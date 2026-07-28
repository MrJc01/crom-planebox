// Editor de mini-estruturas in-world com volume delimitado e exportação de templates — itens 1564-1567.
import { World } from './world';
import { B } from './blocks';
import { StructureTemplate } from '../crafting/StructureTemplates';

/** Padronização da altura do personagem em miniblocos (1.8m = 16 mini-voxels) — item 087. */
export const MINI_BLOCK_PLAYER_HEIGHT_VOXELS = 16;

/** Valida se a escala da estrutura deixa passagem para o personagem — item 087. */
export function validateMiniStructurePlayerScale(heightVoxels: number): { fits: boolean; requiredHeight: number } {
  return {
    fits: heightVoxels >= MINI_BLOCK_PLAYER_HEIGHT_VOXELS,
    requiredHeight: MINI_BLOCK_PLAYER_HEIGHT_VOXELS,
  };
}

export interface EditorBounds {
  originX: number;
  originY: number;
  originZ: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
}

export class MiniStructureEditor {
  private active = false;

  constructor(
    public readonly bounds: EditorBounds = { originX: 0, originY: 0, originZ: 0, sizeX: 8, sizeY: 8, sizeZ: 8 },
  ) {}

  public activate(): void {
    this.active = true;
  }

  public deactivate(): void {
    this.active = false;
  }

  public isActive(): boolean {
    return this.active;
  }

  public isInside(x: number, y: number, z: number): boolean {
    const { originX, originY, originZ, sizeX, sizeY, sizeZ } = this.bounds;
    return (
      x >= originX && x < originX + sizeX &&
      y >= originY && y < originY + sizeY &&
      z >= originZ && z < originZ + sizeZ
    );
  }

  /** Captura a estrutura delimitada pela caixa visual e gera um StructureTemplate reusável. */
  public exportTemplate(world: World, id: string, name: string): StructureTemplate {
    const { originX, originY, originZ, sizeX, sizeY, sizeZ } = this.bounds;
    const blocks: { dx: number; dy: number; dz: number; block: number }[] = [];

    for (let x = 0; x < sizeX; x++) {
      for (let y = 0; y < sizeY; y++) {
        for (let z = 0; z < sizeZ; z++) {
          const blockType = world.getBlock(originX + x, originY + y, originZ + z);
          if (blockType !== B.AIR) {
            blocks.push({ dx: x, dy: y, dz: z, block: blockType });
          }
        }
      }
    }

    return {
      id,
      name,
      blocks,
    };
  }

  /** Limpa todos os voxels dentro da caixa de edição do editor. */
  public clear(world: World): number {
    const { originX, originY, originZ, sizeX, sizeY, sizeZ } = this.bounds;
    let count = 0;

    for (let x = 0; x < sizeX; x++) {
      for (let y = 0; y < sizeY; y++) {
        for (let z = 0; z < sizeZ; z++) {
          if (world.setBlock(originX + x, originY + y, originZ + z, B.AIR)) {
            count++;
          }
        }
      }
    }
    return count;
  }

  /** Retorna a caixa de colisão/delimitação visual para o volume de edição — item 1565. */
  public getVisualBoundingBox(): EditorBounds {
    return { ...this.bounds };
  }

  /** Exporta template reusável no tamanho original de mini-blocos — item 1567. */
  public exportMiniTemplate(world: World, id: string, name: string): StructureTemplate {
    return this.exportTemplate(world, id, name);
  }
}

/** Item "Mesa de Criação" que entra em modo de edição in-world — item 1564. */
export function createCraftingTableItem(): { id: string; name: string; blockType: string; isFunctional: boolean } {
  return {
    id: 'mesa_de_criacao',
    name: 'Mesa de Criação (Mini-Blocos)',
    blockType: 'crafting_table_mini',
    isFunctional: true,
  };
}

/** Desfazer/refazer próprio do editor de mini-estruturas — item 1566. */
export class MiniStructureEditorHistory {
  private undoStack: { x: number; y: number; z: number; oldBlock: number; newBlock: number }[][] = [];
  private redoStack: { x: number; y: number; z: number; oldBlock: number; newBlock: number }[][] = [];

  public pushAction(changes: { x: number; y: number; z: number; oldBlock: number; newBlock: number }[]): void {
    this.undoStack.push(changes);
    this.redoStack = [];
  }

  public undo(world: World): boolean {
    const action = this.undoStack.pop();
    if (!action) return false;
    for (const c of action) {
      world.setBlock(c.x, c.y, c.z, c.oldBlock);
    }
    this.redoStack.push(action);
    return true;
  }

  public redo(world: World): boolean {
    const action = this.redoStack.pop();
    if (!action) return false;
    for (const c of action) {
      world.setBlock(c.x, c.y, c.z, c.newBlock);
    }
    this.undoStack.push(action);
    return true;
  }
}

/** Item "Mesa de Escala" (bloco funcional para ampliação) — item 1652. */
export function createScaleTableItem(): { id: string; name: string; blockType: string; isFunctional: boolean } {
  return {
    id: 'mesa_de_escala',
    name: 'Mesa de Escala',
    blockType: 'scale_table',
    isFunctional: true,
  };
}

/** Requisitos de recursos calculados para ampliação de escala — item 1653. */
export interface ScaleRequirements {
  targetScale: number; // ex: 2, 4, 8
  totalBlocksNeeded: number;
  blockCounts: Record<number, number>; // blockId -> quantidade
}

export function calculateScaleRequirements(
  template: StructureTemplate,
  targetScale: number,
): ScaleRequirements {
  const multiplier = Math.max(1, Math.floor(targetScale ** 3));
  const blockCounts: Record<number, number> = {};
  let total = 0;

  for (const b of template.blocks) {
    const qty = multiplier;
    blockCounts[b.block] = (blockCounts[b.block] || 0) + qty;
    total += qty;
  }

  return {
    targetScale,
    totalBlocksNeeded: total,
    blockCounts,
  };
}

/** Fila de espera por recursos na Mesa de Escala — item 1654. */
export class MesaDeEscalaQueue {
  private deposited: Record<number, number> = {};

  constructor(public readonly reqs: ScaleRequirements) {}

  public deposit(blockId: number, count: number): { accepted: number; isComplete: boolean } {
    const needed = this.reqs.blockCounts[blockId] || 0;
    const current = this.deposited[blockId] || 0;
    const missing = Math.max(0, needed - current);
    const accepted = Math.min(missing, count);

    if (accepted > 0) {
      this.deposited[blockId] = current + accepted;
    }

    return {
      accepted,
      isComplete: this.isComplete(),
    };
  }

  public getProgressPercentage(): number {
    let depositedTotal = 0;
    for (const [id, count] of Object.entries(this.deposited)) {
      depositedTotal += count;
    }
    return this.reqs.totalBlocksNeeded > 0
      ? Math.min(100, (depositedTotal / this.reqs.totalBlocksNeeded) * 100)
      : 100;
  }

  public isComplete(): boolean {
    for (const [blockIdStr, needed] of Object.entries(this.reqs.blockCounts)) {
      const blockId = Number(blockIdStr);
      const current = this.deposited[blockId] || 0;
      if (current < needed) return false;
    }
    return true;
  }
}

/** Materialização da estrutura escalada — item 1655. */
export function materializeScaledStructure(
  template: StructureTemplate,
  targetScale: number,
  origin: { x: number; y: number; z: number },
  world: World,
): { blocksPlaced: number; success: boolean } {
  let placed = 0;

  for (const b of template.blocks) {
    for (let dx = 0; dx < targetScale; dx++) {
      for (let dy = 0; dy < targetScale; dy++) {
        for (let dz = 0; dz < targetScale; dz++) {
          const wx = origin.x + b.dx * targetScale + dx;
          const wy = origin.y + b.dy * targetScale + dy;
          const wz = origin.z + b.dz * targetScale + dz;

          if (world.setBlock(wx, wy, wz, b.block)) {
            placed++;
          }
        }
      }
    }
  }

  return { blocksPlaced: placed, success: true };
}

