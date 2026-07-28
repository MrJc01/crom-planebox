// O inverno cobre de neve e congela a água — item 1118.
//
// ## O que faltava
//
// O inverno mudava a cor da folhagem, pesava a neve no sorteio de clima e (agora) encurta o dia. O
// chão continuava verde. Nevava sobre grama, e a neve caía **através** do mundo sem nunca tocá-lo:
// era uma partícula, não um estado do terreno.
//
// ## Por que isto é uma varredura, e não parte da geração
//
// A geração de chunk é determinística por semente e roda uma vez. A estação muda a cada oito dias
// de jogo sobre chunks já gerados, já salvos e já modificados pelo jogador — não há como voltar
// atrás e gerar de novo sem descartar tudo o que ele construiu.
//
// Então isto é um **verniz**: uma varredura por perto que converte a camada de cima e sabe desfazer
// o que fez. O que ele guarda não é o mundo antigo, e sim a regra de reversão, que é bem menor.
//
// ## O que ele nunca toca — e por que essa lista é a parte importante
//
// Um sistema que reescreve blocos perto do jogador é o mais perigoso deste repositório: um erro
// aqui apaga construção. As três regras que impedem isso:
//
//  1. **Só converte grama e água**, e só de volta a grama e água. Nada mais entra e nada mais sai.
//  2. **Só a face exposta ao céu.** Um bloco com qualquer coisa em cima não é superfície — é o
//     interior de algo, e o interior de algo costuma ser uma construção.
//  3. **A reversão é por identidade, não por memória.** Neve vira grama, gelo vira água, e ponto.
//     Guardar "o que havia antes" exigiria uma tabela que cresce com a área explorada e que ficaria
//     errada assim que o jogador mexesse no bloco por conta própria.
//
// A consequência aceita: neve colocada **pelo jogador** sobre grama derrete no degelo. É o preço de
// não manter memória, e é pequeno perto do risco de manter.

import { B } from './blocks';

/**
 * Acima desta força de inverno o mundo congela; abaixo, degela.
 *
 * `EstadoSazonal.efeito.neve` vale 2,5 no coração do inverno, 0,4 no outono e 0,2 na primavera, já
 * atenuado pela força sazonal do bioma — a selva nunca chega perto, e é assim que o deserto e a
 * floresta tropical ficam de fora sem nenhum caso especial.
 *
 * ## Por que há duas soleiras e não uma
 *
 * Com uma só, um ponto oscilando em torno dela congelaria e degelaria a cada varredura, para
 * sempre: o lago inteiro piscando entre azul e branco a cada dois segundos. A histerese é o que
 * transforma um limiar num estado.
 */
export const CONGELA_ACIMA_DE = 1.6;
export const DEGELA_ABAIXO_DE = 1.15;

export type FaseDaInvernada = 'congelando' | 'degelando' | 'parado';

export function faseDaInvernada(neve: number, anterior: FaseDaInvernada = 'parado'): FaseDaInvernada {
  if (neve >= CONGELA_ACIMA_DE) return 'congelando';
  if (neve <= DEGELA_ABAIXO_DE) return 'degelando';
  // Na faixa morta, mantém o que estava — é isso que impede o pisca-pisca.
  return anterior === 'congelando' ? 'congelando' : 'degelando';
}

/**
 * O que este bloco de superfície deve virar, ou 0 se nada muda.
 *
 * `acima` é o bloco imediatamente em cima. Ele decide sozinho se aquilo é superfície: qualquer
 * coisa que não seja ar significa que o bloco está enterrado ou coberto por construção, e nos dois
 * casos a estação não tem nada a fazer ali.
 */
export function conversaoDeSuperficie(
  bloco: number,
  acima: number,
  fase: FaseDaInvernada,
): number {
  if (acima !== B.AIR) return 0;

  if (fase === 'congelando') {
    if (bloco === B.GRASS) return B.SNOW;
    if (bloco === B.WATER) return B.ICE;
    return 0;
  }
  if (fase === 'degelando') {
    if (bloco === B.SNOW) return B.GRASS;
    if (bloco === B.ICE) return B.WATER;
    return 0;
  }
  return 0;
}

/** Mundo mínimo que a varredura precisa. O `World` real satisfaz. */
export interface MundoDaInvernada {
  getBlock(x: number, y: number, z: number): number;
  setBlock(x: number, y: number, z: number, t: number): void;
}

export interface AlteracaoDeInverno {
  x: number;
  y: number;
  z: number;
  t: number;
}

/**
 * Raio da varredura, em mini-voxels.
 *
 * Menor que a distância de render de propósito: o jogador **precisa** ver a neve chegar. Cobrir o
 * horizonte inteiro faria a transição acontecer fora de vista e o mundo simplesmente já estar
 * branco na próxima vez que ele olhasse — o que apaga a única coisa que uma estação tem para dar,
 * que é a passagem.
 */
export const RAIO_DA_VARREDURA = 48;

/**
 * Quantas colunas por chamada. É o orçamento que impede a varredura de virar um engasgo.
 *
 * Uma passada completa num raio de 48 são ~7200 colunas; a 220 por chamada e uma chamada a cada
 * 0,4 s, o círculo inteiro leva uns treze segundos para mudar. Isso é lento de propósito — a neve
 * chegando aos poucos é o efeito, e uma conversão instantânea leria como um piscar de cenário.
 */
export const COLUNAS_POR_PASSADA = 220;

/**
 * Varre um pedaço da vizinhança e devolve o que mudou.
 *
 * ## Por que ela guarda onde parou
 *
 * A varredura é retomada de onde parou, em espiral a partir do jogador, e não recomeçada do centro.
 * Recomeçar faria as colunas próximas serem visitadas mil vezes e as distantes nunca — a neve
 * formaria um disco pequeno e perfeito à volta do jogador, que é exatamente o artefato que denuncia
 * um sistema.
 */
export class Invernada {
  private cursor = 0;
  private fase: FaseDaInvernada = 'parado';

  /** A fase atual, para a interface e para o teste. */
  public get faseAtual(): FaseDaInvernada {
    return this.fase;
  }

  /**
   * `alturaDaSuperficie` devolve o y do bloco de topo da coluna. Sem ela a varredura teria de
   * descer a coluna inteira procurando, o que multiplicaria o custo por duzentos.
   */
  public passada(
    mundo: MundoDaInvernada,
    centro: { x: number; z: number },
    forcaDaNeve: number,
    alturaDaSuperficie: (x: number, z: number) => number,
    orcamento = COLUNAS_POR_PASSADA,
  ): AlteracaoDeInverno[] {
    this.fase = faseDaInvernada(forcaDaNeve, this.fase);
    const mudancas: AlteracaoDeInverno[] = [];

    const lado = RAIO_DA_VARREDURA * 2 + 1;
    const total = lado * lado;
    const cx = Math.floor(centro.x);
    const cz = Math.floor(centro.z);

    for (let n = 0; n < orcamento; n++) {
      const i = this.cursor % total;
      this.cursor = (this.cursor + 1) % total;

      const dx = (i % lado) - RAIO_DA_VARREDURA;
      const dz = Math.floor(i / lado) - RAIO_DA_VARREDURA;
      // Círculo e não quadrado: a borda de um quadrado é uma linha reta no chão, e uma linha reta
      // de neve não existe na natureza nem em nenhum lugar do resto deste mundo.
      if (dx * dx + dz * dz > RAIO_DA_VARREDURA * RAIO_DA_VARREDURA) continue;

      const x = cx + dx;
      const z = cz + dz;
      const y = alturaDaSuperficie(x, z);
      if (y <= 0) continue;

      const bloco = mundo.getBlock(x, y, z);
      const novo = conversaoDeSuperficie(bloco, mundo.getBlock(x, y + 1, z), this.fase);
      if (novo === 0) continue;

      mundo.setBlock(x, y, z, novo);
      mudancas.push({ x, y, z, t: novo });
    }

    return mudancas;
  }

  /** Recomeça a varredura. Chamado ao trocar de mundo. */
  public reiniciar(): void {
    this.cursor = 0;
    this.fase = 'parado';
  }
}
