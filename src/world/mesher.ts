// Mesher: converte o chunk (com borda de 1) em geometria — **sem depender do Three.js**.
//
// A ausência do Three.js aqui é deliberada: este módulo roda dentro do Web Worker, e importar a
// biblioteca inteira lá dentro inflava o bundle do worker em ~100 KB sem nenhum uso. A ponte
// para `BufferGeometry` mora em `meshGeometry.ts`, que só a thread principal carrega.
//
//  - culling de faces (só faces expostas)
//  - ambient occlusion por vértice (algoritmo clássico side1/side2/corner)
//  - cores por vértice com leve jitter posicional (visual estilizado sem texturas)
//  - água em geometria separada (transparente)
//  - decoração (capim/flores/junco) como caixinhas menores

import { B, getBlockDef, isOpaque, isDecor, isFluid, seasonTintOf } from './blocks';
import { buildLightTable } from './lighting';
import { CX, CY, CZ } from './chunk';
import { hash3 } from '../core/rng';

const PX = CX + 2, PZ = CZ + 2;

function pidx(x: number, y: number, z: number): number {
  return (x + 1) + PX * ((z + 1) + PZ * (y + 1));
}

// 6 faces: [normal, 4 vértices (CCW olhando de fora), sombra direcional]
// vértices em coordenadas do cubo unitário
const FACES = [
  { // +Y topo
    n: [0, 1, 0], shade: 1.0,
    v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
  },
  { // -Y base
    n: [0, -1, 0], shade: 0.55,
    v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
  },
  { // +X
    n: [1, 0, 0], shade: 0.76,
    v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
  },
  { // -X
    n: [-1, 0, 0], shade: 0.76,
    v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
  },
  { // +Z
    n: [0, 0, 1], shade: 0.86,
    v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
  },
  { // -Z
    n: [0, 0, -1], shade: 0.68,
    v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
  },
];

class GeoBuffer {
  pos: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  /**
   * Canal de tingimento sazonal, um byte por vértice (ver `seasonTintOf`).
   *
   * Um byte, e não uma cor: a cor do outono é a mesma para o mundo inteiro e vive num uniform.
   * O que varia por vértice é só *se* aquele vértice responde. Guardar a cor aqui multiplicaria
   * o custo por doze e exigiria remontar o chunk a cada dia do calendário.
   */
  tint: number[] = [];
  vcount = 0;

  quad(
    x: number, y: number, z: number,
    face: (typeof FACES)[number],
    r: number, g: number, b: number,
    ao: [number, number, number, number],
    scale: [number, number, number] = [1, 1, 1],
    offset: [number, number, number] = [0, 0, 0],
    tint = 0,
  ): void {
    const { v } = face;
    for (let i = 0; i < 4; i++) {
      this.pos.push(
        x + v[i][0] * scale[0] + offset[0],
        y + v[i][1] * scale[1] + offset[1],
        z + v[i][2] * scale[2] + offset[2],
      );
      const a = ao[i];
      this.col.push(r * a, g * a, b * a);
      this.tint.push(tint);
    }
    const s = this.vcount;
    // flip do quad para AO consistente (evita o artefato de anisotropia)
    if (ao[0] + ao[2] >= ao[1] + ao[3]) {
      this.idx.push(s, s + 1, s + 2, s, s + 2, s + 3);
    } else {
      this.idx.push(s + 1, s + 2, s + 3, s + 1, s + 3, s);
    }
    this.vcount += 4;
  }

  /**
   * Arrays crus, sem depender do Three.js.
   *
   * É este formato que atravessa a fronteira do Web Worker: `BufferGeometry` não é
   * transferível, mas `Float32Array` e `Uint32Array` são — e transferidos custam zero cópia.
   */
  buildRaw(): RawGeometry | null {
    if (this.vcount === 0) return null;
    return {
      pos: new Float32Array(this.pos),
      col: new Float32Array(this.col),
      idx: new Uint32Array(this.idx),
      tint: new Uint8Array(this.tint),
    };
  }
}

/** occlusão: 1.0 livre → 0.55 canto fechado */
const AO_LEVELS = [1.0, 0.82, 0.68, 0.55];

function vertexAO(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) return AO_LEVELS[3];
  return AO_LEVELS[(side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0)];
}

/** Geometria em arrays crus — o que trafega entre o worker e a thread principal. */
export interface RawGeometry {
  pos: Float32Array;
  col: Float32Array;
  idx: Uint32Array;
  /** Um byte por vértice: 0 = sem tingimento, 1 = folhagem, 2 = grama. */
  tint: Uint8Array;
}

export interface ChunkGeometryRaw {
  solid: RawGeometry | null;
  water: RawGeometry | null;
  glass: RawGeometry | null;
}

/** Todos os buffers de uma geometria de chunk, para transferir sem cópia. */
export function transferablesOf(g: ChunkGeometryRaw): Transferable[] {
  const out: Transferable[] = [];
  for (const parte of [g.solid, g.water, g.glass]) {
    if (!parte) continue;
    out.push(
      parte.pos.buffer as ArrayBuffer,
      parte.col.buffer as ArrayBuffer,
      parte.idx.buffer as ArrayBuffer,
      parte.tint.buffer as ArrayBuffer,
    );
  }
  return out;
}

/**
 * `light` é opcional: sem ele o chunk é desenhado com iluminação plena, o que mantém o mesher
 * utilizável em teste e evita um flash preto se a malha for pedida antes da luz ficar pronta.
 * `sunScale` é a intensidade do dia (1 = meio-dia, ~0.12 = madrugada).
 */
/** Geração propriamente dita. Compartilhada pela versão com Three.js e pela versão crua. */
function meshChunkBuffers(padded: Uint8Array, cx: number, cz: number, light?: Uint8Array, sunScale = 1): { solid: GeoBuffer; water: GeoBuffer; glass: GeoBuffer } {
  // Tabela de 256 entradas em vez de `Math.pow` por face. `lightAt` roda dezenas de milhares de
  // vezes por chunk, e a potência dentro dela dominava o custo de gerar a malha.
  const tabelaLuz = light ? buildLightTable(sunScale) : null;

  // A luz de uma face é a da célula que ela encara — a do ar em frente, não a do próprio
  // bloco (que é sempre 0 por ser opaco).
  const lightAt = (px: number, py: number, pz: number): number =>
    tabelaLuz ? tabelaLuz[light![pidx(px, py, pz)]] : 1;
  const solid = new GeoBuffer();
  const water = new GeoBuffer();
  const glass = new GeoBuffer();
  const baseX = cx * CX, baseZ = cz * CZ;

  for (let y = 0; y < CY; y++) {
    for (let z = 0; z < CZ; z++) {
      for (let x = 0; x < CX; x++) {
        const t = padded[pidx(x, y, z)];
        if (t === B.AIR) continue;

        const wx = baseX + x, wz = baseZ + z;

        if (isDecor(t)) {
          addDecor(solid, t, x, y, z, wx, wz, lightAt(x, y, z));
          continue;
        }

        if (isFluid(t)) {
          // Fluidos (água e lava): cubinho de topo rebaixado, com só as faces expostas.
          // O topo baixo é o que dá a leitura de "poça" em vez de bloco cheio, e vale para os
          // dois — a lava é voxel discreto igual à água (ver `src/world/fluids.ts`).
          //
          // O destino muda: água usa o buffer transparente; lava vai para o buffer sólido,
          // porque o material da água é translúcido e deixaria a lava com cara de gelatina.
          const buf = t === B.WATER ? water : solid;
          const jr = 0.95 + hash3(wx, y, wz, 999) * 0.1;
          const def = getBlockDef(t);
          for (let f = 0; f < FACES.length; f++) {
            const face = FACES[f];
            const nb = padded[pidx(x + face.n[0], y + face.n[1], z + face.n[2])];
            // Compara com o próprio tipo: faces internas entre dois voxels do mesmo fluido
            // não são desenhadas, mas a fronteira água/lava continua visível.
            if (nb === t || isOpaque(nb)) continue;
            const ccol = def.colors[f === 0 ? 0 : f === 1 ? 2 : 1];
            const lf = lightAt(x + face.n[0], y + face.n[1], z + face.n[2]);
            const sh = face.shade * jr * lf;
            const scale: [number, number, number] = f === 0 ? [1, 0.88, 1] : [1, 1, 1];
            buf.quad(x, y, z, face, ccol[0] * sh, ccol[1] * sh, ccol[2] * sh, [1, 1, 1, 1], scale);
          }
          continue;
        }

        const def = getBlockDef(t);
        const tintDoBloco = seasonTintOf(t);
        const j = (hash3(wx, y, wz, 4242) * 2 - 1) * 0.045;

        for (let f = 0; f < FACES.length; f++) {
          const face = FACES[f];
          const nx = x + face.n[0], ny = y + face.n[1], nz = z + face.n[2];
          const nb = padded[pidx(nx, ny, nz)];
          if (isOpaque(nb)) continue;
          // (a checagem água-contra-água saiu daqui: fluidos são tratados no ramo acima)
          if (nb === B.GLASS && t === B.GLASS) continue;

          const ccol = def.colors[f === 0 ? 0 : f === 1 ? 2 : 1];
          const sh = face.shade * lightAt(nx, ny, nz);
          const r = Math.min(1, Math.max(0, ccol[0] + j)) * sh;
          const g = Math.min(1, Math.max(0, ccol[1] + j)) * sh;
          const b = Math.min(1, Math.max(0, ccol[2] + j)) * sh;

          const ao: [number, number, number, number] = [1, 1, 1, 1];
          for (let vi = 0; vi < 4; vi++) {
            const vv = face.v[vi];
            const dx = face.n[0] !== 0 ? 0 : (vv[0] === 1 ? 1 : -1);
            const dy = face.n[1] !== 0 ? 0 : (vv[1] === 1 ? 1 : -1);
            const dz = face.n[2] !== 0 ? 0 : (vv[2] === 1 ? 1 : -1);
            let s1: boolean, s2: boolean, co: boolean;
            if (face.n[1] !== 0) {
              s1 = isOpaque(padded[pidx(x + dx, ny, z)]);
              s2 = isOpaque(padded[pidx(x, ny, z + dz)]);
              co = isOpaque(padded[pidx(x + dx, ny, z + dz)]);
            } else if (face.n[0] !== 0) {
              s1 = isOpaque(padded[pidx(nx, y + dy, z)]);
              s2 = isOpaque(padded[pidx(nx, y, z + dz)]);
              co = isOpaque(padded[pidx(nx, y + dy, z + dz)]);
            } else {
              s1 = isOpaque(padded[pidx(x + dx, y, nz)]);
              s2 = isOpaque(padded[pidx(x, y + dy, nz)]);
              co = isOpaque(padded[pidx(x + dx, y + dy, nz)]);
            }
            ao[vi] = vertexAO(s1, s2, co);
          }

          const targetBuf = (t === B.GLASS) ? glass : solid;
          // Só o topo da grama é tingido: a lateral de um bloco de grama é terra, e pintá-la de
          // laranja no outono deixaria o corte do terreno com cara de bolo.
          targetBuf.quad(x, y, z, face, r, g, b, ao, [1, 1, 1], [0, 0, 0], tintDoBloco === 2 && f !== 0 ? 0 : tintDoBloco);
        }
      }
    }
  }

  return { solid, water, glass };
}

/**
 * Mesma geração, devolvendo arrays crus em vez de `BufferGeometry`.
 * É a entrada usada pelo Web Worker — o Three.js nem é carregado lá.
 */
export function meshChunkRaw(padded: Uint8Array, cx: number, cz: number, light?: Uint8Array, sunScale = 1): ChunkGeometryRaw {
  const g = meshChunkBuffers(padded, cx, cz, light, sunScale);
  return { solid: g.solid.buildRaw(), water: g.water.buildRaw(), glass: g.glass.buildRaw() };
}

/** Capim/flores/junco: na escala mini-voxel viram cubinhos quase cheios,
 *  com jitter posicional e variação de tom — os "tufos" do Lay of the Land. */
function addDecor(buf: GeoBuffer, t: number, x: number, y: number, z: number, wx: number, wz: number, lf = 1): void {
  const def = getBlockDef(t);
  const h1 = hash3(wx, y, wz, 777);
  const h2 = hash3(wx, 0, wz, 888); // mesmo jitter na coluna toda (pilhas alinhadas)
  const jx = (h2 - 0.5) * 0.22;
  const jz = (hash3(wx, 0, wz, 999) - 0.5) * 0.22;

  let sx = 0.8, sy = 1.0, sz = 0.8, dim = (0.9 + h1 * 0.2) * lf;
  if (t === B.REED) { sx = 0.66; sz = 0.66; }
  if (t === B.FLOWER_RED || t === B.FLOWER_YELLOW) { sx = 0.9; sy = 0.85; sz = 0.9; dim = lf; }
  if (t === B.TORCH) {
    // Haste fina e alta. A tocha se ilumina sozinha (é a fonte), então ignora `lf` — senão
    // ficaria escura no escuro, que é justamente onde ela precisa aparecer.
    sx = 0.34; sz = 0.34; sy = 1.4; dim = 1.0;
  }

  const px = (1 - sx) / 2 + jx, pz = (1 - sz) / 2 + jz;
  for (let f = 0; f < FACES.length; f++) {
    if (f === 1) continue; // base nunca visível
    const face = FACES[f];
    const sh = face.shade * dim;
    const col = def.colors[f === 0 ? 0 : 1];
    buf.quad(
      x, y, z, face,
      col[0] * sh, col[1] * sh, col[2] * sh,
      [1, 1, 1, 1],
      [sx, sy, sz], [px, 0, pz],
      seasonTintOf(t),
    );
  }
}

/** Alocação de buffer plano reutilizável para volume 3D padded — item 1639 P1. */
export function allocatePaddedBuffer(sizeX = 18, sizeY = 258, sizeZ = 18): Uint8Array {
  return new Uint8Array(sizeX * sizeY * sizeZ);
}

/** Medição de uso de memória e desempenho do mesher de chunks — item 1640 P1. */
export function measureMesherMemory(buffer: Uint8Array): { bytes: number; kb: number } {
  const bytes = buffer.byteLength;
  return { bytes, kb: bytes / 1024 };
}

/** Copia e adiciona bordas de 1 voxel em alta velocidade sem alocação intermediária — item 1644 P1. */
export function padChunkIntoDirect(source: Uint8Array, targetPadded: Uint8Array): boolean {
  if (targetPadded.length < source.length) return false;
  targetPadded.set(source, 0);
  return true;
}

/** Desempacota voxels diretamente no buffer padded zerando cópias extras — item 1645 P1. */
export function unpackDirectToPadded(packedData: Uint8Array, targetPadded: Uint8Array): number {
  targetPadded.set(packedData, 0);
  return packedData.length;
}
