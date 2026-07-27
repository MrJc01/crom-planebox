// Camadas verticais com identidade — itens 495 e 496.
//
// ## O que já existia, e por que não bastava
//
// A profundidade já mudava **o que se acha**: `ORE_TIERS` distribui carvão perto da superfície e
// diamante no fundo. O que faltava era a profundidade mudar **onde se está**. Descer trinta metros
// era mecanicamente diferente e sensorialmente idêntico: mesma névoa, mesmo silêncio, mesma pedra.
//
// Sem identidade, "descer" é só um número no F3. Com ela, o jogador sabe onde está sem olhar — e é
// isso que transforma profundidade em lugar.
//
// ## Por que a camada é medida a partir da SUPERFÍCIE, e não do y absoluto
//
// Um y fixo tornaria o subsolo de uma montanha e o de um vale a mesma coisa — e o jogador que cava
// dez metros a partir do pico de uma montanha estaria, pelo número, "no subsolo profundo" com o céu
// à vista. A profundidade que importa é a relativa: quanto de rocha há acima da cabeça.
//
// ## Por que este módulo não conhece bloco nem cor de shader
//
// Ele decide **em que camada** um ponto está e **o que aquela camada é**. Quem traduz isso em névoa,
// som e minério são os módulos que já fazem essas coisas. Misturar aqui faria a regra de camada
// depender do renderizador, e ela precisa valer também dentro do Worker de geração, onde não há
// renderizador nenhum.

import { SCALE } from './chunk';

export type CamadaId = 'superficie' | 'subsolo' | 'caverna' | 'abismo';

export interface CamadaDef {
  id: CamadaId;
  nome: string;
  /** Profundidade em metros abaixo da superfície onde a camada começa. */
  inicio: number;
  /** Cor da névoa dentro da camada, em RGB 0..1. */
  neblina: [number, number, number];
  /**
   * Multiplicador do alcance da névoa. Abaixo de 1 fecha o horizonte.
   *
   * É o principal sinal de que se desceu: a caverna aperta a visão antes de qualquer texto
   * aparecer, e o jogador sente a mudança sem ler nada.
   */
  alcanceNeblina: number;
  /**
   * Luz ambiente mínima da camada, 0..1.
   *
   * Não substitui o motor de luz — soma um piso. Sem ele, o fundo é preto absoluto e a tocha vira
   * obrigatória de um jeito que não é tenso, é cego.
   */
  luzMinima: number;
  /**
   * Minérios que **só** existem nesta camada — item 496.
   *
   * Um minério listado aqui é recusado em qualquer outra camada, por mais que a faixa de
   * profundidade dele diga o contrário. É o que dá à camada um motivo próprio de existir: descer
   * não é só "mais do mesmo, mais raro", é chegar a algo que não estava lá em cima.
   */
  exclusivos: Array<'carvao' | 'ferro' | 'ouro' | 'diamante'>;
  /**
   * Multiplicador do ritmo de surgimento de hostis — item 497.
   *
   * 1 é a superfície. Acima disso, a camada gera criaturas mais depressa.
   *
   * ## Por que o perigo cresce com a profundidade, e não com o tempo
   *
   * Perigo por tempo pune quem joga devagar e não recompensa nada. Perigo por **lugar** é uma
   * escolha: descer é a decisão de trocar segurança por recurso, e é ela que dá sentido ao diamante
   * estar no fundo. Sem o perigo crescente, a única diferença entre a caverna e o abismo seria o
   * tempo de caminhada.
   *
   * O número mora aqui e não no spawner porque é uma propriedade **da camada** — quem decide o que
   * o abismo é são as camadas, e o spawner só obedece.
   */
  perigo: number;
}

/**
 * As camadas, da superfície para baixo.
 *
 * ## Os limites vêm de `ORE_TIERS`, e essa dependência é obrigatória
 *
 * A camada precisa coincidir com a mudança de conteúdo, senão o jogador cruza a fronteira visual e
 * continua achando as mesmas coisas — o que ensina que a fronteira não significa nada.
 *
 * Escrevi a primeira versão com números redondos (20 e 30) e o teste de subsolo reprovou na hora:
 * o diamante vai de 20 a 26 metros, e com o abismo começando em 30 ele ficava **exclusivo de uma
 * camada onde nunca aparece**. Nada errava — simplesmente deixou de existir diamante no mundo. É a
 * forma mais silenciosa possível de quebrar a progressão inteira.
 *
 * Os limites de hoje seguem as faixas: ouro 14–24 e diamante 20–26. O ouro perde a cauda de 20 a 24
 * por ser exclusivo da caverna, e isso é intencional — é o que separa "o metal da caverna" de "a
 * pedra do abismo" em vez de deixar os dois no mesmo lugar.
 */
export const CAMADAS: CamadaDef[] = [
  {
    id: 'superficie', nome: 'Superfície', inicio: 0,
    // A superfície não impõe névoa própria: quem manda ali é o bioma, e sobrepor isto apagaria a
    // diferença entre deserto e tundra que o sistema de biomas existe para criar.
    neblina: [0.62, 0.70, 0.80], alcanceNeblina: 1, luzMinima: 0,
    exclusivos: [], perigo: 1,
  },
  {
    id: 'subsolo', nome: 'Subsolo', inicio: 6,
    // Terra e raiz: marrom acinzentado, ainda com um resto da luz de cima.
    neblina: [0.30, 0.27, 0.24], alcanceNeblina: 0.55, luzMinima: 0.06,
    exclusivos: [], perigo: 1.25,
  },
  {
    id: 'caverna', nome: 'Caverna', inicio: 14,
    // Azul frio e fechado. É a camada do ferro e do ouro, onde a tocha passa a valer território.
    neblina: [0.13, 0.15, 0.20], alcanceNeblina: 0.34, luzMinima: 0.04,
    exclusivos: ['ouro'], perigo: 1.6,
  },
  {
    id: 'abismo', nome: 'Abismo', inicio: 20,
    // Quase preto, com um resto de brasa. O diamante mora aqui e em nenhum outro lugar.
    neblina: [0.07, 0.05, 0.06], alcanceNeblina: 0.22, luzMinima: 0.03,
    exclusivos: ['diamante'], perigo: 2.2,
  },
];

/** A camada de uma profundidade em **metros** abaixo da superfície. */
export function camadaNaProfundidade(metros: number): CamadaDef {
  let atual = CAMADAS[0];
  for (const c of CAMADAS) {
    if (metros >= c.inicio) atual = c; else break;
  }
  return atual;
}

/** A camada de um ponto, dados o y do ponto e a altura da superfície — ambos em mini-voxels. */
export function camadaEm(vy: number, superficieY: number): CamadaDef {
  return camadaNaProfundidade((superficieY - vy) / SCALE);
}

/**
 * Este minério pode existir nesta profundidade? — item 496.
 *
 * Devolve `false` quando o minério é exclusivo de **outra** camada. A pergunta é feita pelo lado do
 * minério e não pelo da camada porque a maioria dos minérios não é exclusiva de ninguém: carvão e
 * ferro atravessam camadas de propósito, e são eles que dão continuidade à descida. A exclusividade
 * é a exceção que marca o degrau.
 */
export function mineriroPermitidoNaProfundidade(
  chave: 'carvao' | 'ferro' | 'ouro' | 'diamante',
  metros: number,
): boolean {
  const dono = CAMADAS.find((c) => c.exclusivos.includes(chave));
  if (!dono) return true;
  return camadaNaProfundidade(metros).id === dono.id;
}

/**
 * Quanto o ponto já avançou dentro da camada, de 0 a 1.
 *
 * Serve para interpolar névoa e luz **dentro** da faixa, em vez de trocar de uma vez na fronteira.
 * Uma troca instantânea de cor de névoa é visível como um estalo, e o jogador aprende a posição
 * exata da fronteira — o que destrói a ilusão de estar num lugar e revela uma tabela.
 */
export function progressoNaCamada(metros: number): number {
  const i = CAMADAS.findIndex((c) => c === camadaNaProfundidade(metros));
  const atual = CAMADAS[i];
  const proxima = CAMADAS[i + 1];
  if (!proxima) return 1;
  const vao = proxima.inicio - atual.inicio;
  if (vao <= 0) return 1;
  return Math.max(0, Math.min(1, (metros - atual.inicio) / vao));
}

/**
 * Névoa e luz interpoladas para uma profundidade.
 *
 * A transição ocupa o **terço final** de cada camada. Interpolar a faixa inteira faria o jogador
 * nunca ver a cor pura de nenhuma camada — ele estaria sempre no meio de duas —, e o esforço de dar
 * identidade a cada uma se perderia numa média contínua.
 */
export function ambienteDaProfundidade(metros: number): { neblina: [number, number, number]; alcance: number; luzMinima: number } {
  const atual = camadaNaProfundidade(metros);
  const i = CAMADAS.indexOf(atual);
  const proxima = CAMADAS[i + 1];
  const t = proxima ? Math.max(0, (progressoNaCamada(metros) - 0.667) / 0.333) : 0;
  const alvo = proxima ?? atual;

  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    neblina: [
      lerp(atual.neblina[0], alvo.neblina[0]),
      lerp(atual.neblina[1], alvo.neblina[1]),
      lerp(atual.neblina[2], alvo.neblina[2]),
    ],
    alcance: lerp(atual.alcanceNeblina, alvo.alcanceNeblina),
    luzMinima: lerp(atual.luzMinima, alvo.luzMinima),
  };
}
