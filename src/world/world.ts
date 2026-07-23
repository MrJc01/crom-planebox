// Mundo: mapa de chunks, acesso a blocos em coordenadas globais, dirty-tracking.
import { Chunk, chunkKey, CX, CY, CZ } from './chunk';
import { B } from './blocks';

export class World {
  chunks = new Map<string, Chunk>();
  /** chunks aguardando geração no worker */
  pending = new Set<string>();

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }

  addChunk(chunk: Chunk): void {
    this.chunks.set(chunkKey(chunk.cx, chunk.cz), chunk);
  }

  /** Ar acima do mundo, pedra abaixo (para AO/culling nas bordas verticais). */
  getBlock(x: number, y: number, z: number): number {
    if (y < 0) return B.STONE;
    if (y >= CY) return B.AIR;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return B.AIR;
    return c.data[(x - cx * CX) + CX * ((z - cz * CZ) + CZ * y)];
  }

  /** Define bloco e marca os chunks afetados como dirty. Retorna false se o chunk não existe. */
  setBlock(x: number, y: number, z: number, t: number, markEdited = true): boolean {
    if (y < 0 || y >= CY) return false;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return false;
    const lx = x - cx * CX, lz = z - cz * CZ;
    c.data[lx + CX * (lz + CZ * y)] = t;
    c.dirty = true;
    if (markEdited) c.edited = true;
    // bordas: vizinhos precisam re-mesh (culling/AO atravessa a fronteira)
    if (lx <= 0) this.markDirty(cx - 1, cz);
    if (lx >= CX - 1) this.markDirty(cx + 1, cz);
    if (lz <= 0) this.markDirty(cx, cz - 1);
    if (lz >= CZ - 1) this.markDirty(cx, cz + 1);
    if (lx <= 0 && lz <= 0) this.markDirty(cx - 1, cz - 1);
    if (lx >= CX - 1 && lz >= CZ - 1) this.markDirty(cx + 1, cz + 1);
    if (lx <= 0 && lz >= CZ - 1) this.markDirty(cx - 1, cz + 1);
    if (lx >= CX - 1 && lz <= 0) this.markDirty(cx + 1, cz - 1);
    return true;
  }

  private markDirty(cx: number, cz: number): void {
    const c = this.chunks.get(chunkKey(cx, cz));
    if (c) c.dirty = true;
  }

  /** Todos os 8 vizinhos existem? (necessário para mesh com AO correto) */
  neighborsReady(cx: number, cz: number): boolean {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        if (!this.chunks.has(chunkKey(cx + dx, cz + dz))) return false;
      }
    }
    return true;
  }

  /** Copia o chunk + borda de 1 bloco para um array denso (mesh rápido). */
  padChunk(cx: number, cz: number): Uint8Array {
    const PX = CX + 2, PZ = CZ + 2;
    const out = new Uint8Array(PX * (CY + 2) * PZ);
    // referências diretas aos 9 chunks — evita lookup por string no loop quente
    const nb: (Uint8Array | null)[] = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        nb.push(this.getChunk(cx + dx, cz + dz)?.data ?? null);
      }
    }
    // y = -1 → pedra (chão do mundo); y = CY → ar (já zerado, AIR = 0)
    out.fill(B.STONE, 0, PX * PZ);
    for (let y = 0; y < CY; y++) {
      const oy = PX * PZ * (y + 1);
      for (let z = -1; z <= CZ; z++) {
        const dzi = z < 0 ? 0 : z >= CZ ? 2 : 1;
        const lz = z < 0 ? z + CZ : z >= CZ ? z - CZ : z;
        const oz = oy + PX * (z + 1);
        for (let x = -1; x <= CX; x++) {
          const dxi = x < 0 ? 0 : x >= CX ? 2 : 1;
          const src = nb[dzi * 3 + dxi];
          if (!src) continue;
          const lx = x < 0 ? x + CX : x >= CX ? x - CX : x;
          out[oz + (x + 1)] = src[lx + CX * (lz + CZ * y)];
        }
      }
    }
    return out;
  }

  /** Altura do primeiro bloco sólido olhando de cima (para spawn/física). */
  surfaceY(x: number, z: number): number {
    for (let y = CY - 1; y >= 0; y--) {
      const t = this.getBlock(x, y, z);
      if (t !== B.AIR && t !== B.WATER && t !== B.TALL_GRASS &&
          t !== B.FLOWER_RED && t !== B.FLOWER_YELLOW && t !== B.REED) return y;
    }
    return 0;
  }
}
