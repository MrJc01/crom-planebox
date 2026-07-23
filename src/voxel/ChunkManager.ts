import { Scene, Mesh, StandardMaterial, Color3 } from '@babylonjs/core';
import { Chunk, CHUNK_SIZE } from './Chunk';
import { BlockType, VOXEL_SIZE } from './BlockTypes';
import { GreedyMesher } from './GreedyMesher';
import { WorldRepository } from '../storage/WorldRepository';

export interface ChunkGenConfig {
  groundHeight: number; // in blocks (default 4)
  surfaceBlock: BlockType; // default GRASS
  subSurfaceBlock: BlockType; // default DIRT
  bedrockBlock: BlockType; // default STONE
}

export class ChunkManager {
  private scene: Scene;
  private currentWorldId: string = 'default-world';
  private chunks: Map<string, Chunk> = new Map();
  private blockMods: Map<string, BlockType> = new Map();
  private material: StandardMaterial;
  private transparentMaterial: StandardMaterial;

  public config: ChunkGenConfig = {
    groundHeight: 4,
    surfaceBlock: BlockType.GRASS,
    subSurfaceBlock: BlockType.DIRT,
    bedrockBlock: BlockType.STONE
  };

  constructor(scene: Scene) {
    this.scene = scene;

    // Solid block material with vertex colors
    this.material = new StandardMaterial('voxelMaterial', this.scene);
    this.material.backFaceCulling = false;
    this.material.specularColor = new Color3(0.1, 0.1, 0.1);

    // Transparent block material (glass, water)
    this.transparentMaterial = new StandardMaterial('voxelTransparentMat', this.scene);
    this.transparentMaterial.backFaceCulling = false;
    this.transparentMaterial.alpha = 0.85;
    this.transparentMaterial.specularColor = new Color3(0.2, 0.2, 0.2);
  }

  public getChunkKey(cx: number, cy: number, cz: number): string {
    return `${cx},${cy},${cz}`;
  }

  public getChunkCoord(worldVal: number): { chunk: number; local: number } {
    const chunk = Math.floor(worldVal / CHUNK_SIZE);
    let local = worldVal % CHUNK_SIZE;
    if (local < 0) local += CHUNK_SIZE;
    return { chunk, local };
  }

  public async loadWorld(worldId: string, groundHeight: number = 4): Promise<void> {
    this.currentWorldId = worldId;
    this.config.groundHeight = groundHeight;
    
    // Clear current scene meshes
    this.clearAllChunks();

    // Fetch block modifications from IndexedDB
    this.blockMods = await WorldRepository.getBlockModsForWorld(worldId);

    // Initial chunk area around origin (-2 to +2 in X and Z, 0 to 1 in Y)
    this.generateChunkRegion(-2, 2, 0, 1, -2, 2);
  }

  public clearAllChunks(): void {
    for (const chunk of this.chunks.values()) {
      if (chunk.mesh) {
        chunk.mesh.dispose();
        chunk.mesh = null;
      }
    }
    this.chunks.clear();
    this.blockMods.clear();
  }

  public generateChunkRegion(minCx: number, maxCx: number, minCy: number, maxCy: number, minCz: number, maxCz: number): void {
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cz = minCz; cz <= maxCz; cz++) {
          this.getOrCreateChunk(cx, cy, cz);
        }
      }
    }
    this.rebuildDirtyChunks();
  }

  private getOrCreateChunk(cx: number, cy: number, cz: number): Chunk {
    const key = this.getChunkKey(cx, cy, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cy, cz);
      this.chunks.set(key, chunk);
      this.generateChunkTerrain(chunk);
    }
    return chunk;
  }

  private generateChunkTerrain(chunk: Chunk): void {
    const chunkWorldX = chunk.cx * CHUNK_SIZE;
    const chunkWorldY = chunk.cy * CHUNK_SIZE;
    const chunkWorldZ = chunk.cz * CHUNK_SIZE;

    const gh = this.config.groundHeight;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          const wy = chunkWorldY + ly;
          const wx = chunkWorldX + lx;
          const wz = chunkWorldZ + lz;

          // Default terrain generation
          let type = BlockType.AIR;
          if (wy < gh - 3) {
            type = this.config.bedrockBlock;
          } else if (wy < gh - 1) {
            type = this.config.subSurfaceBlock;
          } else if (wy === gh - 1) {
            type = this.config.surfaceBlock;
          }

          // Check if there is an IndexedDB override (modification)
          const modKey = `${wx},${wy},${wz}`;
          if (this.blockMods.has(modKey)) {
            type = this.blockMods.get(modKey)!;
          }

          chunk.setBlock(lx, ly, lz, type);
        }
      }
    }
    chunk.isDirty = true;
  }

  public getBlockAt(wx: number, wy: number, wz: number): BlockType {
    const modKey = `${wx},${wy},${wz}`;
    if (this.blockMods.has(modKey)) {
      return this.blockMods.get(modKey)!;
    }

    const { chunk: cx, local: lx } = this.getChunkCoord(wx);
    const { chunk: cy, local: ly } = this.getChunkCoord(wy);
    const { chunk: cz, local: lz } = this.getChunkCoord(wz);

    const chunkKey = this.getChunkKey(cx, cy, cz);
    const chunk = this.chunks.get(chunkKey);
    if (!chunk) {
      // Calculate procedural block without chunk created
      const gh = this.config.groundHeight;
      if (wy < gh - 3) return this.config.bedrockBlock;
      if (wy < gh - 1) return this.config.subSurfaceBlock;
      if (wy === gh - 1) return this.config.surfaceBlock;
      return BlockType.AIR;
    }
    return chunk.getBlock(lx, ly, lz);
  }

  public async setBlockAt(wx: number, wy: number, wz: number, type: BlockType, saveToDb: boolean = true): Promise<void> {
    const modKey = `${wx},${wy},${wz}`;
    this.blockMods.set(modKey, type);

    const { chunk: cx, local: lx } = this.getChunkCoord(wx);
    const { chunk: cy, local: ly } = this.getChunkCoord(wy);
    const { chunk: cz, local: lz } = this.getChunkCoord(wz);

    const chunk = this.getOrCreateChunk(cx, cy, cz);
    chunk.setBlock(lx, ly, lz, type);
    chunk.isDirty = true;

    // Mark neighbor chunks dirty if block is on border
    if (lx === 0) this.markChunkDirty(cx - 1, cy, cz);
    if (lx === CHUNK_SIZE - 1) this.markChunkDirty(cx + 1, cy, cz);
    if (ly === 0) this.markChunkDirty(cx, cy - 1, cz);
    if (ly === CHUNK_SIZE - 1) this.markChunkDirty(cx, cy + 1, cz);
    if (lz === 0) this.markChunkDirty(cx, cy, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markChunkDirty(cx, cy, cz + 1);

    this.rebuildDirtyChunks();

    if (saveToDb && this.currentWorldId) {
      await WorldRepository.saveBlockMod(this.currentWorldId, wx, wy, wz, type);
    }
  }

  public async setBlockBatch(blocks: { x: number; y: number; z: number; type: BlockType }[], saveToDb: boolean = true): Promise<void> {
    for (const b of blocks) {
      const modKey = `${b.x},${b.y},${b.z}`;
      this.blockMods.set(modKey, b.type);

      const { chunk: cx, local: lx } = this.getChunkCoord(b.x);
      const { chunk: cy, local: ly } = this.getChunkCoord(b.y);
      const { chunk: cz, local: lz } = this.getChunkCoord(b.z);

      const chunk = this.getOrCreateChunk(cx, cy, cz);
      chunk.setBlock(lx, ly, lz, b.type);
      chunk.isDirty = true;
    }

    this.rebuildDirtyChunks();

    if (saveToDb && this.currentWorldId) {
      await WorldRepository.saveBlockModBatch(
        this.currentWorldId,
        blocks.map(b => ({ x: b.x, y: b.y, z: b.z, blockType: b.type }))
      );
    }
  }

  public markChunkDirty(cx: number, cy: number, cz: number): void {
    const chunk = this.chunks.get(this.getChunkKey(cx, cy, cz));
    if (chunk) chunk.isDirty = true;
  }

  public rebuildDirtyChunks(): void {
    const neighborGetter: GreedyMesherNeighborGetter = (wx, wy, wz) => this.getBlockAt(wx, wy, wz);

    for (const chunk of this.chunks.values()) {
      if (!chunk.isDirty) continue;
      chunk.isDirty = false;

      const vertexData = GreedyMesher.generateMeshVertexData(chunk, neighborGetter);

      if (chunk.mesh) {
        chunk.mesh.dispose();
        chunk.mesh = null;
      }

      if (vertexData) {
        const mesh = new Mesh(`chunk_${chunk.key}`, this.scene);
        vertexData.applyToMesh(mesh);
        
        // Position mesh in world coordinates
        mesh.position.set(
          chunk.cx * CHUNK_SIZE * VOXEL_SIZE,
          chunk.cy * CHUNK_SIZE * VOXEL_SIZE,
          chunk.cz * CHUNK_SIZE * VOXEL_SIZE
        );

        mesh.material = this.material;
        chunk.mesh = mesh;
      }
    }
  }

  public async resetWorldData(): Promise<void> {
    if (!this.currentWorldId) return;
    await WorldRepository.clearWorldBlockMods(this.currentWorldId);
    this.blockMods.clear();
    for (const chunk of this.chunks.values()) {
      this.generateChunkTerrain(chunk);
    }
    this.rebuildDirtyChunks();
  }

  public async reconfigureChunkGen(config: Partial<ChunkGenConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.resetWorldData();
  }
}

type GreedyMesherNeighborGetter = (wx: number, wy: number, wz: number) => BlockType;
