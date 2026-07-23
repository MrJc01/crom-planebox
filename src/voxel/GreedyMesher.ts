import { VertexData } from '@babylonjs/core';
import { Chunk, CHUNK_SIZE } from './Chunk';
import { BlockType, BLOCK_DEFINITIONS, VOXEL_SIZE } from './BlockTypes';

function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } {
  let clean = hex.replace('#', '');
  if (clean.length === 6) {
    clean += 'ff';
  }
  const num = parseInt(clean, 16);
  return {
    r: ((num >> 24) & 255) / 255,
    g: ((num >> 16) & 255) / 255,
    b: ((num >> 8) & 255) / 255,
    a: (num & 255) / 255
  };
}

// Direction vectors for 6 faces: +X, -X, +Y, -Y, +Z, -Z
const MASK_FACES = [
  { dir: [1, 0, 0], norm: [1, 0, 0], shade: 0.85 },   // Right (+X)
  { dir: [-1, 0, 0], norm: [-1, 0, 0], shade: 0.85 }, // Left (-X)
  { dir: [0, 1, 0], norm: [0, 1, 0], shade: 1.0 },    // Top (+Y)
  { dir: [0, -1, 0], norm: [0, -1, 0], shade: 0.5 },  // Bottom (-Y)
  { dir: [0, 0, 1], norm: [0, 0, 1], shade: 0.9 },    // Front (+Z)
  { dir: [0, 0, -1], norm: [0, 0, -1], shade: 0.75 }  // Back (-Z)
];

export type NeighborBlockGetter = (worldX: number, worldY: number, worldZ: number) => BlockType;

export class GreedyMesher {
  public static generateMeshVertexData(chunk: Chunk, getBlockAt: NeighborBlockGetter): VertexData | null {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const chunkWorldX = chunk.cx * CHUNK_SIZE;
    const chunkWorldY = chunk.cy * CHUNK_SIZE;
    const chunkWorldZ = chunk.cz * CHUNK_SIZE;

    let vertexOffset = 0;

    // Loop through all 6 faces
    for (let face = 0; face < 6; face++) {
      const faceInfo = MASK_FACES[face];
      const [dx, dy, dz] = faceInfo.dir;
      const [nx, ny, nz] = faceInfo.norm;
      const shade = faceInfo.shade;

      // Scan per face
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 0; y < CHUNK_SIZE; y++) {
          for (let z = 0; z < CHUNK_SIZE; z++) {
            const currentBlock = chunk.getBlock(x, y, z);
            if (currentBlock === BlockType.AIR) continue;

            const wx = chunkWorldX + x;
            const wy = chunkWorldY + y;
            const wz = chunkWorldZ + z;

            const neighborBlock = getBlockAt(wx + dx, wy + dy, wz + dz);
            
            const currentDef = BLOCK_DEFINITIONS[currentBlock];
            const neighborDef = BLOCK_DEFINITIONS[neighborBlock];

            const isNeighborOpaque = neighborBlock !== BlockType.AIR && !neighborDef?.transparent;
            if (isNeighborOpaque) continue;

            // Generate quad for this face
            const px = x * VOXEL_SIZE;
            const py = y * VOXEL_SIZE;
            const pz = z * VOXEL_SIZE;
            const s = VOXEL_SIZE;

            const col = hexToRgb(currentDef.color);
            const r = col.r * shade;
            const g = col.g * shade;
            const b = col.b * shade;
            const a = col.a;

            let corners: number[][] = [];

            if (face === 0) { // +X Right
              corners = [
                [px + s, py, pz],
                [px + s, py + s, pz],
                [px + s, py + s, pz + s],
                [px + s, py, pz + s]
              ];
            } else if (face === 1) { // -X Left
              corners = [
                [px, py, pz + s],
                [px, py + s, pz + s],
                [px, py + s, pz],
                [px, py, pz]
              ];
            } else if (face === 2) { // +Y Top (Correct Counter-Clockwise orientation)
              corners = [
                [px, py + s, pz + s],
                [px + s, py + s, pz + s],
                [px + s, py + s, pz],
                [px, py + s, pz]
              ];
            } else if (face === 3) { // -Y Bottom
              corners = [
                [px, py, pz],
                [px + s, py, pz],
                [px + s, py, pz + s],
                [px, py, pz + s]
              ];
            } else if (face === 4) { // +Z Front
              corners = [
                [px + s, py, pz + s],
                [px + s, py + s, pz + s],
                [px, py + s, pz + s],
                [px, py, pz + s]
              ];
            } else if (face === 5) { // -Z Back
              corners = [
                [px, py, pz],
                [px, py + s, pz],
                [px + s, py + s, pz],
                [px + s, py, pz]
              ];
            }

            for (const c of corners) {
              positions.push(c[0], c[1], c[2]);
              normals.push(nx, ny, nz);
              colors.push(r, g, b, a);
            }

            indices.push(
              vertexOffset, vertexOffset + 1, vertexOffset + 2,
              vertexOffset, vertexOffset + 2, vertexOffset + 3
            );
            vertexOffset += 4;
          }
        }
      }
    }

    if (positions.length === 0) return null;

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;

    return vertexData;
  }
}
