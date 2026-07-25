// Chunk de coluna inteira: 32 × 128 × 32 mini-voxels em um Uint8Array.
// Escala estilo Lay of the Land: 3 mini-voxels por metro (SCALE).

export const CX = 32;
export const CY = 128;
export const CZ = 32;
/** mini-voxels por metro */
export const SCALE = 3;
export const CHUNK_VOLUME = CX * CY * CZ;

export function blockIndex(x: number, y: number, z: number): number {
  return x + CX * (z + CZ * y);
}

export function chunkKey(cx: number, cz: number): string {
  return cx + ',' + cz;
}

export class Chunk {
  data: Uint8Array;
  /**
   * Luz por voxel, `(sol << 4) | bloco`. Não entra no save: é derivada dos blocos e
   * recalculada ao carregar, então persistir só gastaria espaço e arriscaria ficar defasada.
   */
  light: Uint8Array;
  /** precisa re-gerar a malha */
  dirty = true;
  /** a luz ainda não foi calculada para este chunk */
  lightDirty = true;
  /** foi modificado pelo jogador (entra no save) */
  edited = false;

  constructor(
    public cx: number,
    public cz: number,
    data?: Uint8Array,
  ) {
    this.data = data ?? new Uint8Array(CHUNK_VOLUME);
    this.light = new Uint8Array(CHUNK_VOLUME);
  }

  get(x: number, y: number, z: number): number {
    return this.data[x + CX * (z + CZ * y)];
  }

  set(x: number, y: number, z: number, t: number): void {
    this.data[x + CX * (z + CZ * y)] = t;
  }
}
