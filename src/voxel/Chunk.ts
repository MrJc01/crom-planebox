import { BlockType } from './BlockTypes';

export const CHUNK_SIZE = 16; // 16x16x16 blocks per sub-chunk

export class Chunk {
  public readonly cx: number;
  public readonly cy: number;
  public readonly cz: number;
  public readonly key: string;
  private blocks: Uint8Array;
  public isDirty: boolean = true;
  public mesh: any = null; // Babylon Mesh reference

  constructor(cx: number, cy: number, cz: number) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.key = `${cx},${cy},${cz}`;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
  }

  private getIndex(x: number, y: number, z: number): number {
    return (x * CHUNK_SIZE * CHUNK_SIZE) + (y * CHUNK_SIZE) + z;
  }

  public getBlock(x: number, y: number, z: number): BlockType {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return BlockType.AIR;
    }
    return this.blocks[this.getIndex(x, y, z)] as BlockType;
  }

  public setBlock(x: number, y: number, z: number, blockType: BlockType): boolean {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return false;
    }
    const idx = this.getIndex(x, y, z);
    if (this.blocks[idx] !== blockType) {
      this.blocks[idx] = blockType;
      this.isDirty = true;
      return true;
    }
    return false;
  }

  public getBlocksArray(): Uint8Array {
    return this.blocks;
  }

  public isEmpty(): boolean {
    for (let i = 0; i < this.blocks.length; i++) {
      if (this.blocks[i] !== BlockType.AIR) return false;
    }
    return true;
  }
}
