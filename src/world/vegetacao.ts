// A vegetação cresce, e a estação decide quanto — item 1119.
//
// ## O que não existia
//
// `PerfilSazonal.crescimento` existe desde as estações (1,6 na primavera, 0 no inverno) e estava
// exposto aos mods por `api.season.growth()`. Só que **não havia crescimento nenhum para modular**:
// o capim e as flores eram espalhados na geração do chunk e ficavam ali, imutáveis, para sempre. Um
// mod podia perguntar a velocidade de uma coisa que não acontecia.
//
// O sintoma no jogo: cavar um buraco e tapar com terra deixava uma cicatriz marrom permanente na
// paisagem. Nada nunca se recuperava de nada.
//
// ## Duas coisas crescem, e a ordem entre elas importa
//
//  1. **A terra exposta vira grama**, se houver grama ao lado. Isto é *espalhamento*: sem o
//     vizinho, terra no meio de um deserto de terra viraria grama sozinha, o que lê como magia e
//     não como natureza.
//  2. **A grama exposta cria capim e flor** no ar acima dela.
//
// A terra primeiro, porque é a que fecha a cicatriz; o capim é enfeite por cima do que já sarou.
//
// ## Por que isto NÃO planta árvore
//
// Uma árvore ocupa dezenas de voxels e apareceria dentro de uma casa cujo teto o jogador ainda não
// fechou, ou por cima de uma plantação. Crescimento que só adiciona uma camada rasteira é
// reversível com um clique; uma árvore não é. Se um dia houver muda plantada pelo jogador, ela é
// que deve virar árvore — porque aí ele escolheu o lugar.

import { B } from './blocks';

/** Mundo mínimo que a varredura precisa. */
export interface MundoDaVegetacao {
  getBlock(x: number, y: number, z: number): number;
  setBlock(x: number, y: number, z: number, t: number): void;
}

export interface BrotoDeVegetacao {
  x: number;
  y: number;
  z: number;
  t: number;
}

/**
 * Chance por candidato por passada, na velocidade neutra (`crescimento = 1`).
 *
 * Baixa de propósito: o crescimento tem de ser algo que o jogador **nota que aconteceu** ao voltar
 * a um lugar, e não algo que ele vê acontecendo. Grama brotando na frente dos olhos lê como
 * cintilação de textura.
 */
export const CHANCE_DE_GRAMA = 0.06;
/** Capim e flor são mais raros que a grama: eles enfeitam o que já sarou. */
export const CHANCE_DE_CAPIM = 0.015;
/** Das vezes em que nasce algo rasteiro, esta fração vira flor em vez de capim. */
export const FRACAO_DE_FLOR = 0.18;

export const RAIO_DA_VARREDURA = 40;
export const COLUNAS_POR_PASSADA = 160;

/**
 * O que pode nascer nesta coluna, ou 0.
 *
 * `sorteio` já vem multiplicado pela velocidade da estação pelo chamador — aqui ele é só um número
 * em 0..1 comparado com as chances. Manter a estação fora desta função é o que permite testá-la
 * sem construir um estado sazonal inteiro.
 */
export function brotarEm(
  mundo: MundoDaVegetacao,
  x: number, y: number, z: number,
  chanceGrama: number, chanceCapim: number,
  sorteio: () => number,
): number {
  const aqui = mundo.getBlock(x, y, z);
  const acima = mundo.getBlock(x, y + 1, z);

  // Coberto por qualquer coisa não é superfície. Mesma regra da invernada, e pelo mesmo motivo: o
  // que está debaixo de um bloco costuma ser o interior de uma construção.
  if (acima !== B.AIR) return 0;

  if (aqui === B.DIRT) {
    // Espalhamento: precisa de grama num dos quatro lados, na mesma altura.
    const temVizinha =
      mundo.getBlock(x + 1, y, z) === B.GRASS || mundo.getBlock(x - 1, y, z) === B.GRASS ||
      mundo.getBlock(x, y, z + 1) === B.GRASS || mundo.getBlock(x, y, z - 1) === B.GRASS;
    if (!temVizinha) return 0;
    return sorteio() < chanceGrama ? B.GRASS : 0;
  }

  if (aqui === B.GRASS) {
    if (sorteio() >= chanceCapim) return 0;
    return sorteio() < FRACAO_DE_FLOR
      ? (sorteio() < 0.5 ? B.FLOWER_RED : B.FLOWER_YELLOW)
      : B.TALL_GRASS;
  }

  return 0;
}

/**
 * Varredura de crescimento, irmã da `Invernada`.
 *
 * Mesma forma — cursor em espiral, orçamento por passada, recorte circular — e pelas mesmas razões,
 * que estão documentadas lá. O que muda é o que ela escreve e o fato de ela ser **probabilística**:
 * a invernada converte tudo o que encontra, esta sorteia. Por isso ela nunca "estabiliza": um campo
 * de grama continua produzindo capim para sempre, devagar, que é o comportamento certo.
 */
export class Vegetacao {
  private cursor = 0;

  public passada(
    mundo: MundoDaVegetacao,
    centro: { x: number; z: number },
    velocidade: number,
    alturaDaSuperficie: (x: number, z: number) => number,
    sorteio: () => number = Math.random,
    orcamento = COLUNAS_POR_PASSADA,
  ): BrotoDeVegetacao[] {
    // Inverno para tudo. O `<= 0` é o item inteiro, e é um caminho que precisa ser barato: no
    // inverno esta função é chamada centenas de vezes e não deve tocar em nada.
    if (velocidade <= 0) return [];

    const chanceGrama = CHANCE_DE_GRAMA * velocidade;
    const chanceCapim = CHANCE_DE_CAPIM * velocidade;

    const brotos: BrotoDeVegetacao[] = [];
    const lado = RAIO_DA_VARREDURA * 2 + 1;
    const total = lado * lado;
    const cx = Math.floor(centro.x);
    const cz = Math.floor(centro.z);

    for (let n = 0; n < orcamento; n++) {
      const i = this.cursor % total;
      this.cursor = (this.cursor + 1) % total;

      const dx = (i % lado) - RAIO_DA_VARREDURA;
      const dz = Math.floor(i / lado) - RAIO_DA_VARREDURA;
      if (dx * dx + dz * dz > RAIO_DA_VARREDURA * RAIO_DA_VARREDURA) continue;

      const x = cx + dx;
      const z = cz + dz;
      const y = alturaDaSuperficie(x, z);
      if (y <= 0) continue;

      const novo = brotarEm(mundo, x, y, z, chanceGrama, chanceCapim, sorteio);
      if (novo === 0) continue;

      // Grama substitui a terra no lugar dela; capim e flor nascem **acima**. Escrever os dois no
      // mesmo y apagaria o chão debaixo do capim e deixaria um buraco no terreno.
      const alvoY = novo === B.GRASS ? y : y + 1;
      mundo.setBlock(x, alvoY, z, novo);
      brotos.push({ x, y: alvoY, z, t: novo });
    }

    return brotos;
  }

  public reiniciar(): void {
    this.cursor = 0;
  }
}
