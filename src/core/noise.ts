// Simplex 2D semeado + fractais (fBm, ridged). Sem dependências externas.
import { mulberry32, hash3, lerp } from './rng';

const GRAD = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

export class Simplex2 {
  private perm = new Uint8Array(512);

  constructor(seed: number) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    const rnd = mulberry32(seed);
    for (let i = 255; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  /** Ruído em [-1, 1]. */
  noise(xin: number, yin: number): number {
    const perm = this.perm;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      const g = GRAD[perm[ii + perm[jj]] & 7];
      n += t0 * t0 * (g[0] * x0 + g[1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      const g = GRAD[perm[ii + i1 + perm[jj + j1]] & 7];
      n += t1 * t1 * (g[0] * x1 + g[1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      const g = GRAD[perm[ii + 1 + perm[jj + 1]] & 7];
      n += t2 * t2 * (g[0] * x2 + g[1] * y2);
    }
    return 70 * n;
  }

  /** fBm em [-1, 1] (aprox). */
  fbm(x: number, y: number, octaves: number, lacunarity = 2, gain = 0.5): number {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(x * freq, y * freq);
      norm += amp;
      amp *= gain; freq *= lacunarity;
    }
    return sum / norm;
  }

  /** Ridged multifractal em [0, 1] — cristas afiadas para montanhas. */
  ridged(x: number, y: number, octaves: number, lacunarity = 2, gain = 0.5): number {
    let amp = 0.5, freq = 1, sum = 0, prev = 1;
    for (let o = 0; o < octaves; o++) {
      const r = 1 - Math.abs(this.noise(x * freq, y * freq));
      const v = r * r;
      sum += v * amp * prev;
      prev = v;
      amp *= gain; freq *= lacunarity;
    }
    return Math.min(1, sum);
  }
}

/**
 * Value noise 3D com interpolação trilinear e suavização quíntica.
 *
 * Existe para as cavernas: `Simplex2` só resolve o relevo (uma altura por coluna) e não
 * consegue descrever um vazio que passa por dentro da montanha. Value noise é mais barato que
 * simplex 3D e, para máscara de caverna, a diferença de qualidade não aparece — o que importa
 * é ser contínuo, determinístico por semente e rápido, porque roda uma vez por voxel de pedra.
 */
export class Value3 {
  constructor(private seed: number) {}

  /** Suavização quíntica de Perlin: derivada segunda contínua, sem artefato de grade visível. */
  private static fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  noise(x: number, y: number, z: number): number {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;

    const u = Value3.fade(xf), v = Value3.fade(yf), w = Value3.fade(zf);
    const s = this.seed;

    const c000 = hash3(xi, yi, zi, s);
    const c100 = hash3(xi + 1, yi, zi, s);
    const c010 = hash3(xi, yi + 1, zi, s);
    const c110 = hash3(xi + 1, yi + 1, zi, s);
    const c001 = hash3(xi, yi, zi + 1, s);
    const c101 = hash3(xi + 1, yi, zi + 1, s);
    const c011 = hash3(xi, yi + 1, zi + 1, s);
    const c111 = hash3(xi + 1, yi + 1, zi + 1, s);

    const x00 = lerp(c000, c100, u);
    const x10 = lerp(c010, c110, u);
    const x01 = lerp(c001, c101, u);
    const x11 = lerp(c011, c111, u);

    return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w) * 2 - 1; // -1..1
  }

  /** fBm de N oitavas, normalizado para -1..1. */
  fbm(x: number, y: number, z: number, octaves = 3): number {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise(x * freq, y * freq, z * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }

  /**
   * Ruído "ridged": |noise| invertido, que produz vales estreitos e conectados em vez de
   * bolhas isoladas. É o que dá o formato de túnel às cavernas.
   */
  ridged(x: number, y: number, z: number, octaves = 3): number {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += (1 - Math.abs(this.noise(x * freq, y * freq, z * freq))) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm; // 0..1
  }
}
