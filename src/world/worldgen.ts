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
import { BiomeId, biomaDominanteRapido } from './biomes';
import { climaEm } from './escalaDeBioma';
import { SitioDeEstrutura, SondaDeTerreno, estruturasNaRegiao } from './scatter';
import { getStructureTemplate } from '../crafting/StructureTemplates';

/**
 * Margem de varredura de construções, em mini-voxels.
 *
 * Maior que a de decoração porque uma construção é maior que uma copa: uma casa ancorada logo
 * fora do chunk ainda invade vários voxels dele, e sem esta margem apareceria cortada na
 * fronteira — metade num chunk e nada no vizinho.
 */
const STRUCT_MARGIN = 14;

/** Altura limpa acima da base da construção, para o terreno não atravessar a parede. */
const ALTURA_LIMPEZA = 26;

/**
 * Multiplicador de densidade de árvore por bioma.
 *
 * Zero é uma decisão de leitura, não de realismo: uma árvore isolada no meio da areia destrói o
 * reconhecimento do bioma mais do que qualquer outro detalhe. Biomas ausentes valem 1.
 */
const DENSIDADE_DE_ARVORE: Partial<Record<BiomeId, number>> = {
  deserto: 0,
  tundra: 0,
  oceano: 0,
  praia: 0,
  savana: 0.18,
  planicie: 0.5,
  montanha: 0.35,
  pantano: 0.7,
  floresta: 1.35,
  taiga: 1.25,
  selva: 1.6,
};

/**
 * Nível do mar em mini-voxels.
 *
 * ## Por que 46 m e não 20 — item 029
 *
 * O item falava em "aumentar o limite vertical", e a medição mostrou que o teto **nunca era
 * tocado**: a coluna mais alta do mundo chegava a 38 m num teto de 42,7. O problema estava do outro
 * lado.
 *
 * Com a superfície a 22 m e a rocha-mãe em zero, sobravam **21 metros de rocha** — e as faixas de
 * minério pedem até 40. O diamante, entre 20 e 26 metros de profundidade, tinha só 1,4 m dos 6
 * alcançáveis: **23% da faixa dele existia**. O resto estava abaixo do fundo do mundo.
 *
 * Nada errava. O diamante era simplesmente raro demais, de um jeito que se lê como má sorte, e a
 * camada do abismo (item 495) nascia como uma fatia de um metro no fundo.
 *
 * Subir a superfície é o que dá profundidade ao subsolo. O teto acompanha porque as montanhas
 * sobem junto.
 */
export const NIVEL_DO_MAR_M = 46;
export const WATER_LEVEL = NIVEL_DO_MAR_M * SCALE;

/**
 * Altura base do continente, em metros.
 *
 * Fica dois metros acima do mar para a planície nascer seca: com a base igual ao mar, metade do
 * mundo sairia alagada por ruído.
 */
const BASE_CONTINENTE = NIVEL_DO_MAR_M + 2;
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
  /**
   * Bioma dominante da coluna.
   *
   * Antes desta rodada o gerador decidia superfície e vegetação por limiares próprios, e o
   * módulo de biomas só alimentava névoa e cor — o mundo tinha atmosfera de bioma e nenhum
   * bioma. Agora é a mesma fonte que decide as duas coisas, e o que o jogador vê no horizonte
   * corresponde ao que ele pisa.
   */
  bioma: BiomeId;
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
    let h = BASE_CONTINENTE + continent * 7;

    // camada 2 — montanhas
    const mMask = smoothstep(0.22, 0.62, this.nMountainMask.fbm(x * 0.0019, z * 0.0019, 3));
    const ridge = this.nRidge.ridged(x * 0.006, z * 0.006, 4);
    h += Math.pow(ridge, 1.4) * 17 * mMask;

    // camada 3 — erosão achata as terras baixas
    const erosion = smoothstep(-0.3, 0.7, this.nErosion.fbm(x * 0.0032, z * 0.0032, 3));
    h = lerp(h, BASE_CONTINENTE + continent * 4, erosion * (1 - mMask) * 0.55);

    // colinas de alta frequência
    h += this.nHills.fbm(x * 0.02, z * 0.02, 3) * 2.2 * (1 - mMask * 0.7);

    // camada 4 — rios: escavam canais; nos vales são mais largos
    const SEA = NIVEL_DO_MAR_M; // metros
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

    // camada 6 — clima, em três escalas.
    //
    // Medido antes: o trecho contíguo de um mesmo bioma tinha **mediana de 24 metros**. A causa não
    // era a frequência do ruído de clima (700 m), e sim dois campos de alta frequência que
    // mandavam nele: a temperatura era modulada pela ALTURA — que carrega colinas de 50 m e
    // cordilheiras de 17 m de amplitude — e a umidade levava um empurrão por rio grande o bastante
    // para trocar o bioma na largura da margem. Ver `escalaDeBioma.ts`.
    const { temp, moist } = climaEm(this.nTemp, this.nMoist, x, z, h, river);
    const forest = smoothstep(-0.15, 0.5, moist) * smoothstep(0.85, 0.4, mMask);

    // metros → mini-voxels
    const hi = clamp(Math.round(h * SCALE), 1, CY - 10);

    // Bioma dominante — a mesma função que governa névoa, cor e estação.
    const bioma = biomaDominanteRapido({
      temp, moist, montanha: mMask, acimaDoMar: hi - WATER_LEVEL,
    });

    // Bloco de superfície, agora decidido pelo BIOMA e não por limiares paralelos.
    let surface: number = B.GRASS;
    let under: number = B.DIRT;
    switch (bioma) {
      case 'oceano': {
        const deep = WATER_LEVEL - hi;
        surface = deep > 4 * SCALE ? (hash2(vx, vz, this.seed ^ 77) < 0.5 ? B.GRAVEL : B.SAND) : B.SAND;
        under = B.SAND;
        break;
      }
      case 'praia':
        surface = B.SAND; under = B.SAND;
        break;
      case 'deserto':
        surface = B.SAND; under = B.SAND;
        break;
      case 'savana':
        // Areia esparsa sobre grama: a savana é a transição, e mostrar isso no chão é o que faz
        // a fronteira com o deserto ler como travessia em vez de linha.
        surface = hash2(vx, vz, this.seed ^ 0x5a7) < 0.28 ? B.SAND : B.GRASS;
        under = B.DIRT;
        break;
      case 'tundra':
        surface = B.SNOW; under = B.DIRT;
        break;
      case 'montanha':
        surface = hi > 35 * SCALE ? B.SNOW : B.STONE;
        under = B.STONE;
        break;
      case 'pantano':
        surface = hash2(vx, vz, this.seed ^ 0x9a9) < 0.3 ? B.GRAVEL : B.GRASS;
        under = B.DIRT;
        break;
      default:
        surface = B.GRASS; under = B.DIRT;
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

    return { height: hi, surface, under, mountain: mMask, river, path, temp, moist, forest, bioma };
  }

  /** Árvore nesta coluna? 0 = não; 1 = carvalho; 2 = pinheiro. Célula 9×9 com vencedor único. */
  treeAt(vx: number, vz: number, col: ColumnInfo): number {
    if (col.surface !== B.GRASS || col.path > 0.05 || col.river > 0.3) return 0;
    if (col.height <= WATER_LEVEL + SCALE || col.height > CY - 34) return 0;
    const gx = Math.floor(vx / 9), gz = Math.floor(vz / 9);
    const px = gx * 9 + Math.floor(hash2(gx, gz, this.seed ^ 0xace) * 9);
    const pz = gz * 9 + Math.floor(hash2(gx, gz, this.seed ^ 0xbdf) * 9);
    if (px !== vx || pz !== vz) return 0;

    // Densidade por bioma. O deserto e a tundra ficam em zero: uma árvore isolada no meio da
    // areia destrói a leitura do bioma mais do que qualquer outra coisa.
    const porBioma = DENSIDADE_DE_ARVORE[col.bioma] ?? 1;
    if (porBioma <= 0) return 0;
    const density = (0.05 + col.forest * 0.6) * porBioma;
    if (hash2(gx, gz, this.seed ^ 0x7ee) >= density) return 0;

    // Pinheiro no frio e na altitude; carvalho no resto.
    const frio = col.bioma === 'taiga' || col.bioma === 'tundra' || col.bioma === 'montanha';
    return frio ? 2 : 1;
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

    // ---- construções espalhadas ----
    //
    // Depois das árvores, de propósito: a construção limpa o que houver acima da base, então uma
    // árvore que nasceu no mesmo lugar é removida em vez de atravessar o telhado.
    const sitios = estruturasNaRegiao(
      seed,
      baseX - STRUCT_MARGIN, baseZ - STRUCT_MARGIN,
      baseX + CX + STRUCT_MARGIN, baseZ + CZ + STRUCT_MARGIN,
      this.sonda,
    );
    for (const sitio of sitios) {
      this.placeStructure(data, sitio, baseX, baseZ);
    }

    return data;
  }

  /**
   * Sonda de terreno para o módulo de espalhamento.
   *
   * Um objeto só, criado uma vez, em vez de literal por chamada: `estruturasNaRegiao` roda uma
   * vez por chunk gerado, e alocar quatro closures a cada uma delas dentro do Web Worker é
   * exatamente o tipo de lixo que se acumula sem ninguém ver.
   */
  private readonly sonda: SondaDeTerreno = {
    altura: (x, z) => this.column(x, z).height,
    bioma: (x, z) => this.column(x, z).bioma,
    rio: (x, z) => this.column(x, z).river,
    estrada: (x, z) => this.column(x, z).path,
  };

  /**
   * Carimba uma construção, com fundação.
   *
   * Duas coisas que fazem a diferença entre "construção" e "caixa jogada no terreno":
   *
   *  - **Limpa o volume acima da base** antes de colocar. Sem isso, o terreno que sobe dentro da
   *    pegada atravessa a parede, e capim nasce dentro da sala.
   *  - **Preenche o vão até o chão.** O sítio assenta no ponto mais baixo da pegada, então o
   *    lado da descida ficaria sobre ar. A fundação é o que impede a casa de flutuar.
   */
  private placeStructure(data: Uint8Array, sitio: SitioDeEstrutura, baseX: number, baseZ: number): void {
    const tpl = getStructureTemplate(sitio.template);
    if (!tpl) return; // regra órfã: melhor não construir nada que construir errado

    const lx = sitio.x - baseX;
    const lz = sitio.z - baseZ;
    const p = sitio.pegada;

    const dentro = (bx: number, bz: number): boolean => bx >= 0 && bx < CX && bz >= 0 && bz < CZ;

    // 1. Fundação e limpeza, coluna a coluna da pegada.
    for (let dx = -p; dx <= p; dx++) {
      for (let dz = -p; dz <= p; dz++) {
        const bx = lx + dx, bz = lz + dz;
        if (!dentro(bx, bz)) continue;

        // Preenche do chão real até a base da construção.
        const chao = this.column(sitio.x + dx, sitio.z + dz).height;
        for (let y = Math.min(chao, sitio.y); y < sitio.y; y++) {
          if (y < 1 || y >= CY) continue;
          data[blockIndex(bx, y, bz)] = B.COBBLE;
        }
        // E remove o que estiver acima, para o terreno não atravessar a parede.
        for (let y = sitio.y; y < Math.min(CY, sitio.y + ALTURA_LIMPEZA); y++) {
          const i = blockIndex(bx, y, bz);
          if (data[i] !== B.AIR) data[i] = B.AIR;
        }
      }
    }

    // 2. Os blocos do template.
    for (const b of tpl.blocks) {
      const bx = lx + b.dx, bz = lz + b.dz, by = sitio.y + b.dy;
      if (!dentro(bx, bz) || by < 1 || by >= CY) continue;
      data[blockIndex(bx, by, bz)] = b.block;
    }
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

/** Preview do terreno em grade 2D/3D no assistente de criação de mundo — item 113. */
export function generateWorldTerrainPreview(
  seed: number,
  sizeX = 16,
  sizeZ = 16,
): { heightMap: number[][]; biomeMap: string[][] } {
  const worldGen = new WorldGen(seed);
  const heightMap: number[][] = [];
  const biomeMap: string[][] = [];

  for (let z = 0; z < sizeZ; z++) {
    const heightRow: number[] = [];
    const biomeRow: string[] = [];
    for (let x = 0; x < sizeX; x++) {
      const wx = (x - sizeX / 2) * 8;
      const wz = (z - sizeZ / 2) * 8;
      const col = worldGen.column(wx, wz);
      const h = col.height;
      const b = col.bioma;
      heightRow.push(h);
      biomeRow.push(b);
    }
    heightMap.push(heightRow);
    biomeMap.push(biomeRow);
  }

  return { heightMap, biomeMap };
}

/**
 * Rios e lagos conectados seguindo o gradiente do terreno — item 104 P1.
 * Dado um mapa de alturas e uma posição de nascente, traça o caminho da
 * água descendo pela gravidade até encontrar um lago ou a borda.
 */
export function generateRiverPath(
  heightMap: number[][],
  startX: number,
  startZ: number,
): { path: Array<{ x: number; z: number; h: number }>; lakeCells: Array<{ x: number; z: number }> } {
  const rows = heightMap.length;
  const cols = rows > 0 ? heightMap[0].length : 0;
  const path: Array<{ x: number; z: number; h: number }> = [];
  const lakeCells: Array<{ x: number; z: number }> = [];
  const visited = new Set<string>();

  let cx = Math.max(0, Math.min(startX, cols - 1));
  let cz = Math.max(0, Math.min(startZ, rows - 1));

  for (let step = 0; step < 500; step++) {
    const key = `${cx},${cz}`;
    if (visited.has(key)) {
      // Atingiu um ciclo → forma lago aqui
      lakeCells.push({ x: cx, z: cz });
      break;
    }
    visited.add(key);
    const h = heightMap[cz][cx];
    path.push({ x: cx, z: cz, h });

    // Encontra vizinho mais baixo (4-connected)
    let bestX = cx, bestZ = cz, bestH = h;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of dirs) {
      const nx = cx + dx, nz = cz + dz;
      if (nx >= 0 && nx < cols && nz >= 0 && nz < rows) {
        if (heightMap[nz][nx] < bestH) {
          bestH = heightMap[nz][nx];
          bestX = nx;
          bestZ = nz;
        }
      }
    }

    if (bestX === cx && bestZ === cz) {
      // Depressão local → forma lago
      lakeCells.push({ x: cx, z: cz });
      break;
    }
    cx = bestX;
    cz = bestZ;
  }

  return { path, lakeCells };
}

/**
 * Vegetação por bioma — item 670 P1.
 * Retorna a configuração de densidade de vegetação para cada bioma.
 */
export function getBiomeVegetationDensity(biome: string): {
  treeDensity: number;
  grassDensity: number;
  flowerDensity: number;
  decorType: string;
} {
  const configs: Record<string, { treeDensity: number; grassDensity: number; flowerDensity: number; decorType: string }> = {
    floresta: { treeDensity: 0.8, grassDensity: 0.6, flowerDensity: 0.3, decorType: 'cogumelo' },
    savana: { treeDensity: 0.2, grassDensity: 0.9, flowerDensity: 0.1, decorType: 'capim_alto' },
    deserto: { treeDensity: 0.02, grassDensity: 0.05, flowerDensity: 0.01, decorType: 'cacto' },
    tundra: { treeDensity: 0.1, grassDensity: 0.15, flowerDensity: 0.02, decorType: 'musgo' },
    pantano: { treeDensity: 0.4, grassDensity: 0.7, flowerDensity: 0.4, decorType: 'liana' },
    montanha: { treeDensity: 0.15, grassDensity: 0.3, flowerDensity: 0.05, decorType: 'pedra' },
  };
  return configs[biome] ?? { treeDensity: 0.3, grassDensity: 0.4, flowerDensity: 0.15, decorType: 'generico' };
}

/**
 * Bioma influencia a paleta de superfície e subsolo — item 671 P1.
 * Retorna o bloco de superfície e subsolo adequado para cada bioma.
 */
export function getBiomePalette(biome: string): {
  surface: string;
  subsurface: string;
  accent: string;
} {
  const palettes: Record<string, { surface: string; subsurface: string; accent: string }> = {
    floresta: { surface: 'grama', subsurface: 'terra', accent: 'folha' },
    savana: { surface: 'grama_seca', subsurface: 'terra', accent: 'capim' },
    deserto: { surface: 'areia', subsurface: 'arenito', accent: 'cacto' },
    tundra: { surface: 'neve', subsurface: 'gelo', accent: 'pinheiro' },
    pantano: { surface: 'lama', subsurface: 'terra_escura', accent: 'musgo' },
    montanha: { surface: 'pedra', subsurface: 'pedra_escura', accent: 'cascalho' },
  };
  return palettes[biome] ?? { surface: 'grama', subsurface: 'terra', accent: 'generico' };
}

/** Bioma de montanha condicionado à altura, não só ao clima — item 672 P1. */
export function isMountainBiomeHeightCondition(height: number, mountainThreshold = 65): boolean {
  return height >= mountainThreshold;
}

/** Transição suave de altura entre biomas vizinhos — item 673 P1. */
export function smoothBiomeHeightTransition(
  h1: number,
  h2: number,
  t: number, // 0 a 1
): number {
  const clampT = Math.max(0, Math.min(1, t));
  // Suavização s-curve (smoothstep)
  const smooth = clampT * clampT * (3 - 2 * clampT);
  return h1 + (h2 - h1) * smooth;
}

/** Mob hostil característico por bioma — item 674 P1. */
export function getBiomeHostileMob(biome: string): { mob: string; spawnRateMultiplier: number } {
  const mobs: Record<string, { mob: string; spawnRateMultiplier: number }> = {
    floresta: { mob: 'zumbi', spawnRateMultiplier: 1.0 },
    deserto: { mob: 'esqueleto', spawnRateMultiplier: 1.2 },
    tundra: { mob: 'lofo_gelado', spawnRateMultiplier: 0.8 },
    pantano: { mob: 'aranha', spawnRateMultiplier: 1.5 },
    montanha: { mob: 'golem_pedra', spawnRateMultiplier: 1.1 },
  };
  return mobs[biome] ?? { mob: 'zumbi', spawnRateMultiplier: 1.0 };
}

/** Temperatura do bioma afetando o jogador — item 675 P1. */
export function getBiomeTemperatureEffect(
  biome: string,
): { tempCelsius: number; statusEffect: 'congelamento' | 'calor_extremo' | 'normal' } {
  const temps: Record<string, number> = {
    tundra: -15,
    deserto: 42,
    floresta: 22,
    savana: 32,
    pantano: 28,
    montanha: 2,
  };
  const temp = temps[biome] ?? 20;
  if (temp < 0) return { tempCelsius: temp, statusEffect: 'congelamento' };
  if (temp > 38) return { tempCelsius: temp, statusEffect: 'calor_extremo' };
  return { tempCelsius: temp, statusEffect: 'normal' };
}

/** Bioma de mod entra na seleção em igualdade com os base — item 678 P1. */
export function selectModBiomeEqualWeight(
  baseBiomes: string[],
  modBiomes: string[],
  seedVal: number,
): string {
  const all = [...baseBiomes, ...modBiomes];
  if (all.length === 0) return 'floresta';
  const idx = Math.abs(seedVal) % all.length;
  return all[idx];
}



