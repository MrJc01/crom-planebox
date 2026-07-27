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
/** Quantas oitavas o memo do reticulado cobre. Além disto a amostra é calculada sem cache. */
const OITAVAS_COM_MEMO = 8;

export class Value3 {
  /**
   * Memo do reticulado — item 1450.
   *
   * ## O que este cache é, e por que ele não muda o mundo
   *
   * Os oito cantos de uma célula dependem só de `(xi, yi, zi, seed)`, e o gerador percorre o mundo
   * coluna a coluna — x e z ficam parados por cento e quarenta voxels seguidos enquanto só y anda.
   * Guardar o que não depende da fração de y e reusar devolve **exatamente** o mesmo número: não é
   * aproximação, é deixar de recalcular um hash puro. Isso é uma promessa, e `memoDeRuido.test.ts`
   * compara com `toBe` contra o caminho sem cache para que continue sendo.
   *
   * ## Por que vale tanto aqui
   *
   * A frequência do campo de cavernas é por **metro** (0,045), mas a amostragem é por
   * **mini-voxel** (3 por metro). Uma célula do reticulado tem 22 metros em x/z: 67 mini-voxels,
   * mais larga do que o chunk inteiro, que tem 32. Em y a célula cobre 33 mini-voxels. Uma coluna
   * de 140 voxels atravessa cinco células e fazia cento e quarenta vezes o trabalho de cinco.
   *
   * Medido: `isCave` era 87% do custo de gerar um chunk, e o chunk custava 131 ms. Passou a 40.
   *
   * ## Por que um slot por oitava, e não um só
   *
   * `fbm` e `ridged` alternam frequências dentro da mesma chamada: oitava 0, oitava 1, oitava 0 do
   * voxel seguinte. Com um slot único cada amostra expulsaria a anterior e o acerto seria zero —
   * o cache custaria mais do que economiza, silenciosamente.
   */
  /**
   * Um bloco contíguo de 8 doubles por oitava — a chave e o que ela guarda, lado a lado:
   * `[x, yi, z, w, x00, x10, x01, x11]`.
   *
   * Foram cinco arrays separados primeiro, e um por campo lia melhor. Mas são oito acessos por
   * amostra e a amostra roda meio milhão de vezes por chunk: juntar tudo numa linha só recuperou
   * parte do custo, e aqui isso é o item inteiro.
   *
   * `NaN` no começo é o que dispensa uma flag de "slot vazio" — ver `noiseMemo`.
   */
  private memo = new Float64Array(OITAVAS_COM_MEMO * 8).fill(NaN);

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

  /**
   * `noise` reaproveitando tudo o que não depende de y.
   *
   * ## Por que o memo é por coluna, e não por célula do reticulado
   *
   * O gerador percorre o mundo coluna a coluna: x e z ficam **constantes** por 140 voxels seguidos
   * e só y anda. Guardar os oito cantos economizaria os hashes, mas ainda pagaria três `floor`,
   * três `fade` e sete `lerp` por amostra — e dessas, tudo o que envolve x e z daria o mesmo
   * resultado 140 vezes.
   *
   * Então o memo guarda tudo o que não depende da fração de y: os oito hashes, o `floor` e o `fade`
   * de x e z, e as quatro interpolações em x. Com o cache quente sobra um `floor`, um `fade` e três
   * `lerp`.
   *
   * ## Por que quatro valores e não dois
   *
   * Dava para colapsar também em z e guardar só os dois planos y = yi e y = yi+1 — sobrariam um
   * `lerp` em vez de três, e cheguei a escrever assim. Mas isso inverte a ordem das operações:
   * `lerp(lerp(a,b,w), lerp(c,d,w), v)` é a mesma álgebra que `lerp(lerp(a,c,v), lerp(b,d,v), w)`
   * e **não é o mesmo double**. Os testes acusaram uma diferença de um ULP.
   *
   * Um ULP não é nada até o valor cair em cima do limiar de caverna: aí é uma parede que existe ou
   * não existe. Os cinquenta chunks que comparei saíram byte a byte iguais, o que só quer dizer que
   * nenhum voxel estava exatamente na navalha *ali* — não que nenhum esteja. Dois `lerp` por
   * amostra é um preço baixo por não depender de sorte.
   *
   * ## A chave é em ponto flutuante, de propósito
   *
   * Chavear pelos índices inteiros da célula pareceria certo e seria errado: dois pontos dentro da
   * mesma célula têm pesos de interpolação diferentes, e o segundo receberia o valor do primeiro.
   * Dentro de uma coluna o double de x e z é literalmente o mesmo, então a igualdade exata acerta.
   *
   * O `NaN` inicial dispensa uma flag de "slot vazio": `NaN !== x` é verdadeiro para qualquer `x`,
   * então a primeira chamada de cada slot sempre erra o cache. Um sentinela numérico qualquer seria
   * uma coordenada válida e devolveria o valor errado no dia em que o mundo chegasse lá — sem erro
   * nenhum, só terreno diferente.
   */
  private noiseMemo(x: number, y: number, z: number, slot: number): number {
    const yi = Math.floor(y);
    const m = this.memo;
    const b = slot * 8;

    if (m[b] !== x || m[b + 1] !== yi || m[b + 2] !== z) {
      const xi = Math.floor(x), zi = Math.floor(z);
      const u = Value3.fade(x - xi);
      const s = this.seed;

      m[b] = x; m[b + 1] = yi; m[b + 2] = z;
      m[b + 3] = Value3.fade(z - zi);
      m[b + 4] = lerp(hash3(xi, yi, zi, s), hash3(xi + 1, yi, zi, s), u);                     // x00
      m[b + 5] = lerp(hash3(xi, yi + 1, zi, s), hash3(xi + 1, yi + 1, zi, s), u);             // x10
      m[b + 6] = lerp(hash3(xi, yi, zi + 1, s), hash3(xi + 1, yi, zi + 1, s), u);             // x01
      m[b + 7] = lerp(hash3(xi, yi + 1, zi + 1, s), hash3(xi + 1, yi + 1, zi + 1, s), u);     // x11
    }

    // A ordem — interpolar em y dentro de cada plano de z, depois entre os planos — é a mesma de
    // `noise`, e tem de continuar sendo: a álgebra comuta e o ponto flutuante não.
    const v = Value3.fade(y - yi);
    const t = m[b + 4] + (m[b + 5] - m[b + 4]) * v;
    const u2 = m[b + 6] + (m[b + 7] - m[b + 6]) * v;
    return (t + (u2 - t) * m[b + 3]) * 2 - 1; // -1..1
  }

  /** fBm de N oitavas, normalizado para -1..1. */
  fbm(x: number, y: number, z: number, octaves = 3): number {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = i < OITAVAS_COM_MEMO
        ? this.noiseMemo(x * freq, y * freq, z * freq, i)
        : this.noise(x * freq, y * freq, z * freq);
      sum += n * amp;
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
      const n = i < OITAVAS_COM_MEMO
        ? this.noiseMemo(x * freq, y * freq, z * freq, i)
        : this.noise(x * freq, y * freq, z * freq);
      sum += (1 - Math.abs(n)) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm; // 0..1
  }
}
