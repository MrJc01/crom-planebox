// Chunk de coluna inteira: 32 × 128 × 32 mini-voxels em um Uint8Array.
// Escala estilo Lay of the Land: 3 mini-voxels por metro (SCALE).

export const CX = 32;
export const CY = 128;

/**
 * Teto do mundo, em voxels. Sinônimo de `CY`, com nome que diz para que serve.
 *
 * `CY` é a altura de **uma coluna de chunk** — usado por quem indexa o array. `WORLD_MAX_Y` é o
 * limite do **mundo** — usado por quem varre, valida coordenada ou posiciona alguma coisa. Os
 * dois valem o mesmo hoje porque o mundo tem exatamente uma camada de chunks na vertical; separar
 * os nomes é o que permite mudar isso depois sem caçar todo `CY` para decidir qual dos dois
 * significados ele tinha ali (item 029).
 */
export const WORLD_MAX_Y = CY;

/**
 * Y onde uma varredura de superfície de cima para baixo deve **começar**.
 *
 * ## O defeito que esta constante corrige
 *
 * Cinco lugares diferentes começavam a varredura em `120`, num mundo de `128`. Os oito voxels do
 * topo eram invisíveis para elas: construa uma torre até y=125 e o "achar a superfície" devolve o
 * chão lá embaixo, ignorando a torre. Quem teleporta ou nasce nessa coluna aparece **dentro** da
 * construção.
 *
 * O `120` provavelmente nasceu como margem de segurança, e virou um teto silencioso. Começar no
 * último voxel que existe é o único valor correto: não há nada acima dele para pular.
 */
export const TOPO_VARREDURA = WORLD_MAX_Y - 1;
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
