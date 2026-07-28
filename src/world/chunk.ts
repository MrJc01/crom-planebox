// Chunk de coluna inteira: 32 × 256 × 32 mini-voxels em um Uint8Array.
// Escala estilo Lay of the Land: 3 mini-voxels por metro (SCALE).
import {
  Secao,
  secaoHomogenea,
  lerSecao,
  escreverSecao,
  empacotarDePlano,
  escreverPlanoEm,
} from './paleta';

export const CX = 32;

/**
 * Altura de uma coluna de chunk, em mini-voxels — item 029.
 *
 * ## O que a medição mostrou, e por que 128 era o número errado
 *
 * O item pedia "aumentar o limite vertical porque as varreduras assumem y < 128". Medindo antes de
 * mexer, o teto **nunca era tocado**: a coluna mais alta de uma amostra de 26 mil dava 38 m num
 * mundo de 42,7. Zero por cento das colunas encostavam nele.
 *
 * O aperto era embaixo. Superfície a 22 m, rocha-mãe em zero: **21 metros de rocha** para faixas de
 * minério que pedem até 40. O diamante tinha 23% da faixa dele existindo de verdade.
 *
 * 256 mini-voxels são 85 metros: com o mar a 46 m, sobram ~48 m de rocha (as faixas inteiras cabem)
 * e ~23 m livres acima da montanha mais alta para construir.
 *
 * O custo é memória: 256 KB por chunk em vez de 128. Com o raio de visão de 6 chunks e descarte em
 * 9, o pior caso sai de ~46 MB para ~92 MB de dados de bloco. É o preço de o subsolo existir.
 */
export const CY = 256;

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
  secoes: Secao[];
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
    this.light = new Uint8Array(CHUNK_VOLUME);
    this.secoes = new Array(512);
    if (data) {
      this.fromFlatArray(data);
    } else {
      for (let i = 0; i < 512; i++) {
        this.secoes[i] = secaoHomogenea(0);
      }
    }
  }

  /** Compatibilidade para código legado que acessa `.data` como Uint8Array plano. */
  get data(): Uint8Array {
    return this.toFlatArray();
  }

  set data(flat: Uint8Array) {
    this.fromFlatArray(flat);
  }

  get(x: number, y: number, z: number): number {
    const sx = x >> 3, sy = y >> 3, sz = z >> 3;
    const secIdx = sx + 4 * (sz + 4 * sy);
    const lx = x & 7, ly = y & 7, lz = z & 7;
    const localIdx = lx + 8 * (lz + 8 * ly);
    return lerSecao(this.secoes[secIdx], localIdx);
  }

  set(x: number, y: number, z: number, t: number): void {
    const sx = x >> 3, sy = y >> 3, sz = z >> 3;
    const secIdx = sx + 4 * (sz + 4 * sy);
    const lx = x & 7, ly = y & 7, lz = z & 7;
    const localIdx = lx + 8 * (lz + 8 * ly);
    this.secoes[secIdx] = escreverSecao(this.secoes[secIdx], localIdx, t);
  }

  toFlatArray(out?: Uint8Array): Uint8Array {
    const res = out ?? new Uint8Array(CHUNK_VOLUME);
    for (let sy = 0; sy < 32; sy++) {
      for (let sz = 0; sz < 4; sz++) {
        for (let sx = 0; sx < 4; sx++) {
          const secIdx = sx + 4 * (sz + 4 * sy);
          const base = 8 * sx + 256 * sz + 8192 * sy;
          escreverPlanoEm(this.secoes[secIdx], res, base, 32, 1024);
        }
      }
    }
    return res;
  }

  fromFlatArray(fonte: Uint8Array): void {
    for (let sy = 0; sy < 32; sy++) {
      for (let sz = 0; sz < 4; sz++) {
        for (let sx = 0; sx < 4; sx++) {
          const secIdx = sx + 4 * (sz + 4 * sy);
          const base = 8 * sx + 256 * sz + 8192 * sy;
          this.secoes[secIdx] = empacotarDePlano(fonte, base, 32, 1024);
        }
      }
    }
  }
}

/**
 * Paletização de chunk — item 033 P1.
 * Converte um array de blocos para uma tabela de paleta + índices locais,
 * reduzindo memória quando poucos tipos distintos são usados.
 */
export function paletizeChunk(
  blocks: Uint8Array,
): { palette: number[]; indices: Uint8Array } {
  const paletteMap = new Map<number, number>();
  const palette: number[] = [];
  const indices = new Uint8Array(blocks.length);

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    let idx = paletteMap.get(b);
    if (idx === undefined) {
      idx = palette.length;
      palette.push(b);
      paletteMap.set(b, idx);
    }
    indices[i] = idx;
  }
  return { palette, indices };
}

