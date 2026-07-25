// Geração procedural em camadas (escala mini-voxel: SCALE voxels por metro):
//   1. continentes (fBm de baixa frequência)
//   2. montanhas (ridged multifractal mascarado)
//   3. erosão (achata planícies)
//   4. rios — escavam canais até abaixo do nível do mar, mais largos nos vales
//   5. estradas orgânicas (fitas de ruído que seguem o terreno)
//   6. biomas (temperatura × umidade) e decoração (árvores, capim, flores, pedras)
//
// O relevo é calculado em METROS (funções contínuas de ruído) e convertido
// para mini-voxels no final — o terreno vira degraus finos de 1/3 de metro,
// o visual "Lay of the Land". Tudo é função pura de (x, z, seed).

import { Simplex2 } from '../core/noise';
import { hash2, clamp, smoothstep, lerp } from '../core/rng';
import { B } from './blocks';
import { CX, CY, CZ, SCALE, blockIndex } from './chunk';
import { UndergroundGen } from './underground';

/** nível do mar em mini-voxels (20 m) */
export const WATER_LEVEL = 20 * SCALE;
const DECOR_MARGIN = 8; // copas de árvores vizinhas invadem até 8 voxels

export interface ColumnInfo {
  height: number;     // y (em voxels) do bloco de superfície
  surface: number;    // tipo do bloco de superfície
  under: number;      // tipo logo abaixo da superfície
  mountain: number;   // 0..1 máscara de montanha
  river: number;      // 0..1 intensidade do rio nesta coluna
  path: number;       // 0..1 intensidade de estrada
  temp: number;       // -1..1
  moist: number;      // -1..1
  forest: number;     // 0..1 densidade de floresta (colore o LOD distante)
}

export class WorldGen {
  private nContinent: Simplex2;
  private nMountainMask: Simplex2;
  private nRidge: Simplex2;
  private nErosion: Simplex2;
  private nHills: Simplex2;
  private nRiver: Simplex2;
  private nTemp: Simplex2;
  private nMoist: Simplex2;
  private nPath: Simplex2;
  private nWarp: Simplex2;
  /** Cavernas e veios de minério (ver `src/world/underground.ts`). */
  public underground: UndergroundGen;

  constructor(public seed: number) {
    this.underground = new UndergroundGen(seed);
    this.nContinent = new Simplex2(seed ^ 0x1a2b3c);
    this.nMountainMask = new Simplex2(seed ^ 0x2b3c4d);
    this.nRidge = new Simplex2(seed ^ 0x3c4d5e);
    this.nErosion = new Simplex2(seed ^ 0x4d5e6f);
    this.nHills = new Simplex2(seed ^ 0x5e6f70);
    this.nRiver = new Simplex2(seed ^ 0x6f7081);
    this.nTemp = new Simplex2(seed ^ 0x708192);
    this.nMoist = new Simplex2(seed ^ 0x8192a3);
    this.nPath = new Simplex2(seed ^ 0x92a3b4);
    this.nWarp = new Simplex2(seed ^ 0xa3b4c5);
  }

  column(vx: number, vz: number): ColumnInfo {
    // trabalha em METROS
    const x = vx / SCALE, z = vz / SCALE;

    // deformação de domínio: quebra a regularidade do ruído
    const wx = x + 28 * this.nWarp.noise(x * 0.005, z * 0.005);
    const wz = z + 28 * this.nWarp.noise(x * 0.005 + 137.7, z * 0.005 + 89.3);

    // camada 1 — continentes (altura em metros)
    const continent = this.nContinent.fbm(x * 0.0011, z * 0.0011, 3);
    let h = 22 + continent * 7;

    // camada 2 — montanhas
    const mMask = smoothstep(0.22, 0.62, this.nMountainMask.fbm(x * 0.0019, z * 0.0019, 3));
    const ridge = this.nRidge.ridged(x * 0.006, z * 0.006, 4);
    h += Math.pow(ridge, 1.4) * 17 * mMask;

    // camada 3 — erosão achata as terras baixas
    const erosion = smoothstep(-0.3, 0.7, this.nErosion.fbm(x * 0.0032, z * 0.0032, 3));
    h = lerp(h, 22 + continent * 4, erosion * (1 - mMask) * 0.55);

    // colinas de alta frequência
    h += this.nHills.fbm(x * 0.02, z * 0.02, 3) * 2.2 * (1 - mMask * 0.7);

    // camada 4 — rios: escavam canais; nos vales são mais largos
    const SEA = 20; // metros
    const rn = this.nRiver.fbm(wx * 0.0016, wz * 0.0016, 2);
    const rd = Math.abs(rn);
    const valley = 1 - smoothstep(0, 1, (h - SEA) / 15);
    const rWidth = 0.014 + 0.030 * valley;
    const rInfluence = rWidth * 2.4;
    let river = 0;
    if (rd < rInfluence && continent > -0.55) {
      const t = 1 - rd / rInfluence;
      const tt = t * t * (3 - 2 * t);
      river = clamp(tt * 1.7, 0, 1);
      const bed = SEA - 1.5 - 2.5 * valley;
      h = lerp(h, Math.min(h, bed), river);
    }

    // camada 5 — estradas: fitas estreitas que evitam água e picos
    const pn = Math.abs(this.nPath.fbm(wx * 0.0021 + 53.1, wz * 0.0021 - 71.9, 2));
    const pWidth = 0.010;
    let path = 0;
    if (pn < pWidth * 2.2 && h > SEA + 0.7 && river < 0.15 && mMask < 0.75) {
      path = 1 - smoothstep(pWidth, pWidth * 2.2, pn);
    }

    // camada 6 — clima
    const temp = this.nTemp.fbm(x * 0.0014, z * 0.0014, 2) - Math.max(0, h - 26) * 0.03;
    const moist = this.nMoist.fbm(x * 0.0017 + 311, z * 0.0017 - 47, 2) + river * 0.3;
    const forest = smoothstep(-0.15, 0.5, moist) * smoothstep(0.85, 0.4, mMask);

    // metros → mini-voxels
    const hi = clamp(Math.round(h * SCALE), 1, CY - 10);

    // bloco de superfície
    let surface: number = B.GRASS;
    let under: number = B.DIRT;
    if (hi <= WATER_LEVEL + 1) {
      const deep = WATER_LEVEL - hi;
      surface = deep > 4 * SCALE ? (hash2(vx, vz, this.seed ^ 77) < 0.5 ? B.GRAVEL : B.SAND) : B.SAND;
      under = B.SAND;
    } else if (hi <= WATER_LEVEL + 1.5 * SCALE && mMask < 0.5) {
      surface = B.SAND; under = B.SAND; // praia
    }
    if (mMask > 0.45 && hi > 30 * SCALE) {
      surface = B.STONE; under = B.STONE;
      if (hi > 35 * SCALE) surface = B.SNOW;
    }
    if (river > 0.55 && hi <= WATER_LEVEL) {
      surface = hash2(vx, vz, this.seed ^ 91) < 0.35 ? B.GRAVEL : B.SAND;
      under = B.SAND;
    }
    if (path > 0.42 && hi > WATER_LEVEL + 1) {
      const r = hash2(vx, vz, this.seed ^ 133);
      surface = r < 0.62 ? B.PATH : r < 0.85 ? B.GRAVEL : B.COBBLE;
      under = B.DIRT;
    }

    return { height: hi, surface, under, mountain: mMask, river, path, temp, moist, forest };
  }

  /** Árvore nesta coluna? 0 = não; 1 = carvalho; 2 = pinheiro. Célula 9×9 com vencedor único. */
  treeAt(vx: number, vz: number, col: ColumnInfo): number {
    if (col.surface !== B.GRASS || col.path > 0.05 || col.river > 0.3) return 0;
    if (col.height <= WATER_LEVEL + SCALE || col.height > CY - 34) return 0;
    const gx = Math.floor(vx / 9), gz = Math.floor(vz / 9);
    const px = gx * 9 + Math.floor(hash2(gx, gz, this.seed ^ 0xace) * 9);
    const pz = gz * 9 + Math.floor(hash2(gx, gz, this.seed ^ 0xbdf) * 9);
    if (px !== vx || pz !== vz) return 0;
    const density = 0.05 + col.forest * 0.6; // probabilidade por célula 9×9
    if (hash2(gx, gz, this.seed ^ 0x7ee) >= density) return 0;
    const cold = col.temp < -0.12 || (col.mountain > 0.5 && col.height > 27 * SCALE);
    return cold ? 2 : 1;
  }

  /** Gera o chunk completo (terreno + água + decoração + árvores com margem). */
  generateChunk(cx: number, cz: number): Uint8Array {
    const data = new Uint8Array(CX * CY * CZ);
    const baseX = cx * CX, baseZ = cz * CZ;
    const seed = this.seed;

    const cols: ColumnInfo[] = new Array(CX * CZ);

    // ---- terreno ----
    for (let z = 0; z < CZ; z++) {
      for (let x = 0; x < CX; x++) {
        const wxp = baseX + x, wzp = baseZ + z;
        const col = this.column(wxp, wzp);
        cols[x + z * CX] = col;
        const h = col.height;
        const dirtDepth = 2 * SCALE + Math.floor(hash2(wxp, wzp, seed ^ 55) * SCALE);

        for (let y = 0; y <= h; y++) {
          let t: number;
          if (y === 0) t = B.STONE;
          else if (y === h) t = col.surface;
          else if (y >= h - dirtDepth) t = col.under;
          else t = B.STONE;

          // Cavernas e minério só valem para a rocha: escavar a camada de terra logo abaixo da
          // grama abriria buracos na paisagem, e minério na terra ficaria visível da superfície.
          if (t === B.STONE) {
            if (this.underground.isCave(wxp, y, wzp, h)) {
              // Poças de lava no fundo da caverna dão perigo à camada profunda e viram fonte
              // natural para o escoamento finito de fluidos.
              t = this.underground.isDeepLava(y) ? B.LAVA : B.AIR;
            } else {
              const ore = this.underground.oreAt(wxp, y, wzp, h);
              if (ore !== 0) t = ore;
            }
          }

          data[blockIndex(x, y, z)] = t;
        }
        for (let y = h + 1; y <= WATER_LEVEL; y++) {
          data[blockIndex(x, y, z)] = B.WATER;
        }

        // ---- decoração rasteira ----
        if (h >= WATER_LEVEL && h < CY - 10) {
          const above = h + 1;
          if (data[blockIndex(x, above, z)] === B.AIR) {
            const r = hash2(wxp, wzp, seed ^ 0x51ce);
            if (col.surface === B.GRASS) {
              // capim em manchas: célula 5×5 sorteia a mancha, célula acende ~55%
              const patch = hash2(Math.floor(wxp / 5), Math.floor(wzp / 5), seed ^ 0xca11);
              const lush = 0.16 + smoothstep(-0.3, 0.6, col.moist) * 0.4;
              if (patch < lush && r < 0.55) {
                const gh = 1 + Math.floor(r * 5.4) % 3; // 1-3 voxels de capim
                for (let k = 0; k < gh; k++) {
                  data[blockIndex(x, above + k, z)] = B.TALL_GRASS;
                }
              } else if (r < 0.012) {
                const fh = 2 + (r * 997 % 2 | 0); // talo + flor
                for (let k = 0; k < fh - 1; k++) data[blockIndex(x, above + k, z)] = B.TALL_GRASS;
                data[blockIndex(x, above + fh - 1, z)] =
                  (r * 1000) % 1 < 0.5 ? B.FLOWER_RED : B.FLOWER_YELLOW;
              } else if (r > 0.9985) {
                // pedregulho decorativo (mini matacão 2×2)
                for (let dx = 0; dx < 2 && x + dx < CX; dx++) {
                  for (let dz = 0; dz < 2 && z + dz < CZ; dz++) {
                    data[blockIndex(x + dx, above, z + dz)] = B.COBBLE;
                    if (r > 0.9995) data[blockIndex(x + dx, above + 1, z + dz)] = B.COBBLE;
                  }
                }
              }
            } else if (col.surface === B.SAND && h <= WATER_LEVEL + 2 && r < 0.05) {
              const rh = 4 + ((r * 997) % 4 | 0); // junco 4-7 voxels
              for (let k = 0; k < rh && above + k < CY; k++) {
                data[blockIndex(x, above + k, z)] = B.REED;
              }
            }
          }
        }
      }
    }

    // ---- árvores (com margem para invadir de chunks vizinhos) ----
    for (let z = -DECOR_MARGIN; z < CZ + DECOR_MARGIN; z++) {
      for (let x = -DECOR_MARGIN; x < CX + DECOR_MARGIN; x++) {
        const wxp = baseX + x, wzp = baseZ + z;
        const inCore = x >= 0 && x < CX && z >= 0 && z < CZ;
        const col = inCore ? cols[x + z * CX] : this.column(wxp, wzp);
        const kind = this.treeAt(wxp, wzp, col);
        if (kind === 0) continue;
        this.placeTree(data, x, z, col.height, kind, hash2(wxp, wzp, seed ^ 0x73e5));
      }
    }

    return data;
  }

  private placeTree(data: Uint8Array, x: number, z: number, ground: number, kind: number, r: number): void {
    const put = (bx: number, by: number, bz: number, t: number, keepSolid = false) => {
      if (bx < 0 || bx >= CX || bz < 0 || bz >= CZ || by < 1 || by >= CY) return;
      const i = blockIndex(bx, by, bz);
      const cur = data[i];
      if (cur === B.AIR || cur === B.TALL_GRASS || cur === B.WATER ||
          (!keepSolid && (cur === B.LEAVES || cur === B.PINE_LEAVES))) data[i] = t;
    };

    if (kind === 1) {
      // carvalho: tronco 2×2 (12-18 voxels) + copa elipsoide
      const th = 12 + Math.floor(r * 7);
      for (let y = 1; y <= th; y++) {
        put(x, ground + y, z, B.LOG, true);
        put(x + 1, ground + y, z, B.LOG, true);
        put(x, ground + y, z + 1, B.LOG, true);
        put(x + 1, ground + y, z + 1, B.LOG, true);
      }
      const cy = ground + th;
      const rad = 4 + (r > 0.55 ? 1 : 0);
      for (let dy = -2; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad + 1; dx++) {
          for (let dz = -rad; dz <= rad + 1; dz++) {
            const ex = dx - 0.5, ez = dz - 0.5;
            const d2 = ex * ex + ez * ez + dy * dy * 1.45;
            if (d2 > rad * rad + 1) continue;
            // desbasta a casca da copa para dar textura
            if (d2 > (rad - 0.8) * (rad - 0.8) &&
                hash2(x * 13 + dx, z * 13 + dz, (dy + 16) * 131) < 0.3) continue;
            put(x + dx, cy + dy + 1, z + dz, B.LEAVES);
          }
        }
      }
    } else {
      // pinheiro: tronco fino e alto + cone de folhas em camadas
      const th = 16 + Math.floor(r * 9);
      for (let y = 1; y <= th; y++) put(x, ground + y, z, B.PINE_LOG, true);
      const layers = 7 + Math.floor(r * 3);
      for (let li = 0; li < layers; li++) {
        const y = ground + th + 1 - li * 2;
        if (y <= ground + 4) break;
        const rad = Math.min(5, 1 + Math.floor(li * 0.8));
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            for (let dz = -rad; dz <= rad; dz++) {
              const lim = rad - (dy === 1 ? 1 : 0);
              if (Math.abs(dx) + Math.abs(dz) > lim + 0.5) continue;
              put(x + dx, y - dy, z + dz, B.PINE_LEAVES);
            }
          }
        }
      }
      put(x, ground + th + 1, z, B.PINE_LEAVES);
      put(x, ground + th + 2, z, B.PINE_LEAVES);
      put(x, ground + th + 3, z, B.PINE_LEAVES);
    }
  }
}
