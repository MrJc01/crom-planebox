// Velocidade de quebra por ferramenta — item 1291.
//
// ## O que estava faltando
//
// A tier da ferramenta decidia **se** um bloco podia ser quebrado e quanto dano ela causava em
// combate, mas não **quão rápido** se minerava: `breakCooldown` era fixo. Minerar pedra com a
// picareta de diamante levava exatamente o mesmo tempo que com a de madeira.
//
// É o oposto da expectativa do gênero, e desfaz boa parte da razão de subir de tier — o jogador
// gasta uma corrente inteira de progressão para ganhar acesso a blocos novos e nenhum conforto
// nos que já minerava.
//
// ## Por que o ganho é modesto, e por que ele depende do bloco
//
// Duas regras, e as duas existem para o mesmo fim: manter a mineração uma **decisão**, não uma
// formalidade.
//
//  1. **Só acelera o que resiste.** Terra, areia e folhagem não têm `minToolTier`: já saem num
//     golpe, e acelerá-las não daria sensação nenhuma — só tornaria o modo detalhe difícil de
//     controlar. O ganho aparece onde havia atrito.
//  2. **Teto de 2,2×.** Com um multiplicador grande a mineração vira um passe de varredura, e o
//     mundo deixa de ter custo. O que se quer é aliviar a repetição, não apagar a atividade.

import { BLOCKS } from '../world/blocks';

/** Multiplicador de tempo por degrau de vantagem. Menor que 1 = mais rápido. */
const GANHO_POR_DEGRAU = 0.78;

/** Piso do multiplicador: nunca mais que ~2,2× a velocidade base. */
const PISO = 0.45;

/**
 * Fator que multiplica o tempo de recarga da quebra.
 *
 * `1` significa velocidade normal; valores menores, mais rápido. A vantagem é a diferença entre a
 * tier da ferramenta e a **exigida pelo bloco** — não a tier absoluta. Uma picareta de diamante
 * numa pedra que só pede madeira tem três degraus de vantagem; na obsidiana, que pede ferro, tem
 * um. É o que faz o material duro continuar sendo duro mesmo com a melhor ferramenta.
 */
export function fatorDeVelocidade(tier: number, blockType: number): number {
  const exigido = BLOCKS[blockType]?.minToolTier ?? 0;

  // Bloco sem exigência já sai num golpe: acelerar não daria sensação, só tornaria o modo
  // detalhe difícil de controlar.
  if (exigido <= 0) return 1;

  const vantagem = Math.max(0, Math.floor(tier) - exigido);
  return Math.max(PISO, GANHO_POR_DEGRAU ** vantagem);
}
