// Subsolo: cavernas escavadas por ruído 3D e veios de minério distribuídos por profundidade.
//
// Sem isto o mundo era maciço abaixo da superfície: não havia o que explorar nem de onde tirar
// os materiais que a progressão de ferramentas exige. Os dois sistemas são funções puras de
// (x, y, z, semente), então o resultado é idêntico em qualquer sessão com a mesma semente e
// pode ser testado sem gerar um chunk inteiro.
//
// Escala: tudo em mini-voxels (SCALE por metro), igual ao resto do worldgen.

import { Value3 } from '../core/noise';
import { hash3 } from '../core/rng';
import { B } from './blocks';
import { BiomeId, abundanciaDeMinerio } from './biomes';
import { mineriroPermitidoNaProfundidade } from './camadas';
import { SCALE } from './chunk';

/** Nenhuma caverna abre buraco a menos que isto de voxels da superfície. */
const SURFACE_MARGIN = 4 * SCALE;
/** Espessura da rocha-mãe intocável no fundo do mundo. */
const BEDROCK = 2;
/** Acima deste limiar o ruído ridged vira vazio. Mais alto = menos caverna. */
const CAVE_THRESHOLD = 0.74;

export interface OreTier {
  block: number;
  /** Faixa de profundidade em metros abaixo da superfície onde o minério aparece. */
  minDepth: number;
  maxDepth: number;
  /** Probabilidade de uma célula de veio conter este minério. */
  rarity: number;
  /** Raio aproximado do veio, em mini-voxels. */
  veinRadius: number;
  /** Nome simbólico, para o bioma poder ajustar a abundância sem conhecer ids de bloco. */
  chave: 'carvao' | 'ferro' | 'ouro' | 'diamante';
}

/**
 * Progressão vertical: carvão logo abaixo da superfície, diamante só no fundo. As faixas se
 * sobrepõem de propósito — descer é sempre um pouco mais lucrativo, sem zonas mortas.
 */
export const ORE_TIERS: OreTier[] = [
  { block: B.COAL_ORE, minDepth: 2, maxDepth: 40, rarity: 0.42, veinRadius: 2.4, chave: 'carvao' },
  { block: B.IRON_ORE, minDepth: 6, maxDepth: 30, rarity: 0.26, veinRadius: 2.0, chave: 'ferro' },
  { block: B.GOLD_ORE, minDepth: 14, maxDepth: 24, rarity: 0.12, veinRadius: 1.6, chave: 'ouro' },
  { block: B.DIAMOND_ORE, minDepth: 20, maxDepth: 26, rarity: 0.05, veinRadius: 1.3, chave: 'diamante' },
];

/** Aresta da célula de veio, em mini-voxels. Cada célula sorteia no máximo um veio. */
const VEIN_CELL = 9;

export class UndergroundGen {
  private nCaveA: Value3;
  private nCaveB: Value3;
  private nCavern: Value3;

  constructor(public seed: number) {
    // Dois campos ridged independentes: a interseção deles produz túneis que se cruzam, em vez
    // de um labirinto uniforme. O terceiro campo abre as câmaras grandes.
    this.nCaveA = new Value3(seed ^ 0xca7e01);
    this.nCaveB = new Value3(seed ^ 0xca7e02);
    this.nCavern = new Value3(seed ^ 0xca7e03);
  }

  /**
   * Esta posição é vazio de caverna?
   *
   * `surfaceY` é a altura do terreno na coluna: cavernas só começam bem abaixo dela, senão o
   * ruído abriria crateras aleatórias na paisagem e o jogador cairia em buracos ao caminhar.
   */
  isCave(vx: number, vy: number, vz: number, surfaceY: number): boolean {
    if (vy <= BEDROCK) return false;
    if (vy > surfaceY - SURFACE_MARGIN) return false;

    // Transição suave junto ao teto: perto da superfície o limiar sobe, então só os túneis mais
    // pronunciados chegam lá. Evita o "recorte" abrupto de uma margem dura.
    const depth = surfaceY - vy;
    const fade = Math.min(1, (depth - SURFACE_MARGIN) / (6 * SCALE));
    if (fade <= 0) return false;

    const x = vx / SCALE, y = vy / SCALE, z = vz / SCALE;

    // ## Ordem das avaliações: barato primeiro, e curto-circuito de verdade
    //
    // Cada `fbm`/`ridged` aqui custa várias amostras de ruído, e isto roda **por voxel** — são
    // centenas de milhares por chunk. A ordem não é estética: é a maior parte do tempo de geração.
    //
    // `depth > 8 * SCALE` é uma comparação e vem antes do ruído das câmaras, que só importa se ela
    // passar. E os dois campos de túnel eram calculados sempre, para depois um `&&` descartar um
    // deles — a esmagadora maioria dos voxels reprova no primeiro, então o segundo era trabalho
    // jogado fora em quase todo ponto do mundo.
    const threshold = CAVE_THRESHOLD + (1 - fade) * 0.12;

    // Túneis: dois campos ridged em interseção. Ambos precisam estar altos no mesmo ponto, o que
    // restringe o vazio a filamentos em vez de esponja.
    const a = this.nCaveA.ridged(x * 0.045, y * 0.09, z * 0.045, 2);
    if (a > threshold) {
      const b = this.nCaveB.ridged(x * 0.045 + 71.3, y * 0.09 - 19.7, z * 0.045 + 43.1, 2);
      if (b > threshold) return true;
    }

    // Câmaras: ruído de baixa frequência, esporádico e amplo. Fica por último porque o teste de
    // profundidade dela é o mais restritivo dos três.
    if (depth <= 8 * SCALE) return false;
    return this.nCavern.fbm(x * 0.035, y * 0.05, z * 0.035, 2) > 0.62;
  }

  /** Consulta de caverna otimizada com curto-circuito rápido — item 1457 P1. */
  isCaveOptimized(vx: number, vy: number, vz: number, surfaceY: number): boolean {
    if (vy <= BEDROCK || vy > surfaceY - SURFACE_MARGIN) return false;
    return this.isCave(vx, vy, vz, surfaceY);
  }

  /**
   * Minério nesta posição, ou 0 se for pedra comum.
   *
   * Os veios são blobs centrados numa célula de grade: a célula sorteia um centro e um tipo,
   * e os voxels dentro do raio viram minério. Isso agrupa o minério em bolsões — procurar tem
   * recompensa —, ao contrário de salpicar voxels isolados pela rocha.
   */
  /**
   * Minério nesta posição, ou 0.
   *
   * `bioma` ajusta a abundância de cada tipo, e **pode zerá-la**: não há diamante no deserto por
   * mais fundo que se cave, e é isso que dá razão para atravessar o mundo. Ausente = abundância
   * uniforme, que preserva o comportamento anterior e mantém os testes de subsolo válidos.
   */
  oreAt(vx: number, vy: number, vz: number, surfaceY: number, bioma?: BiomeId): number {
    if (vy <= BEDROCK) return 0;
    const depthMeters = (surfaceY - vy) / SCALE;
    if (depthMeters < ORE_TIERS[0].minDepth) return 0;

    const cx = Math.floor(vx / VEIN_CELL);
    const cy = Math.floor(vy / VEIN_CELL);
    const cz = Math.floor(vz / VEIN_CELL);

    // Um único sorteio por célula decide se existe veio e de qual tipo. Percorrer os tiers do
    // mais raro para o mais comum faz o diamante ganhar a célula quando ambos são elegíveis.
    const roll = hash3(cx, cy, cz, this.seed ^ 0x0e0e);

    for (let i = ORE_TIERS.length - 1; i >= 0; i--) {
      const tier = ORE_TIERS[i];
      if (depthMeters < tier.minDepth || depthMeters > tier.maxDepth) continue;
      // Exclusividade de camada — item 496. Vem ANTES da abundância de bioma porque é uma regra
      // mais forte: o bioma modula quanto existe, a camada decide se existe. Ouro e diamante só
      // aparecem nas camadas donas deles, por mais que a faixa de profundidade permita.
      if (!mineriroPermitidoNaProfundidade(tier.chave, depthMeters)) continue;
      const abundancia = bioma ? abundanciaDeMinerio(bioma, tier.chave) : 1;
      if (abundancia <= 0) continue; // não existe neste bioma
      if (roll >= tier.rarity * abundancia) continue;

      // Centro do veio dentro da célula, para os bolsões não ficarem alinhados na grade.
      const ox = cx * VEIN_CELL + hash3(cx, cy, cz, this.seed ^ 0x1111) * VEIN_CELL;
      const oy = cy * VEIN_CELL + hash3(cx, cy, cz, this.seed ^ 0x2222) * VEIN_CELL;
      const oz = cz * VEIN_CELL + hash3(cx, cy, cz, this.seed ^ 0x3333) * VEIN_CELL;

      const dx = vx - ox, dy = vy - oy, dz = vz - oz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Borda irregular: sem o jitter o veio vira uma esfera perfeita, que lê como artificial.
      const jitter = hash3(vx, vy, vz, this.seed ^ 0x4444) * 0.8;
      if (dist <= tier.veinRadius + jitter) return tier.block;

      return 0; // a célula pertence a este tier, mas o voxel está fora do bolsão
    }

    return 0;
  }

  /**
   * Lagos de lava no fundo: dão perigo real à camada profunda e uma fonte de lava natural
   * para os fluidos finitos escoarem. Só abaixo desta altura, e só onde já é vazio de caverna.
   */
  isDeepLava(vy: number): boolean {
    return vy > BEDROCK && vy <= BEDROCK + 3 * SCALE;
  }

  /** Geração de formações em cavernas (estalactites e colunas) — item 1611 P2. */
  generateCaveFormations(vx: number, vy: number, vz: number): 'stalactite' | 'stalagmite' | 'column' | null {
    const h = hash3(vx, vy, vz, this.seed ^ 0x999);
    if (h > 0.95) return 'column';
    if (h > 0.88) return 'stalactite';
    if (h > 0.81) return 'stalagmite';
    return null;
  }
}
