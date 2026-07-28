// Baús: guardar coisa num lugar — item 137.
//
// ## O que faltava, e o que a falta custava
//
// Não havia armazenamento nenhum. Tudo o que o jogador tem cabe na hotbar, e o que não cabe é
// largado no chão — onde agora expira (item 1330). Sem baú, o jogo tem um teto de posses que não é
// uma decisão de desenho: é a ausência de um lugar para pôr as coisas.
//
// O efeito em cascata é maior que parece. Sem onde guardar, minerar além do necessário não faz
// sentido, construir uma base não tem função além de dormir, e a progressão inteira fica presa ao
// que se carrega. O baú é o que transforma um abrigo num lugar para onde se volta.
//
// ## Por que o inventário é indexado por POSIÇÃO e não por objeto de baú
//
// Um baú não é uma entidade: é um bloco. Ele não anda, não tem estado além do conteúdo, e
// desaparece quando o bloco é quebrado. Amarrar o conteúdo à posição do bloco elimina uma classe
// inteira de problemas — não há id para vazar, não há objeto órfão quando o bloco some por outro
// caminho (explosão, script de mod, `fill_box`), e recarregar o mundo não precisa reconciliar
// nada.
//
// O preço é que **quebrar o bloco tem de devolver o conteúdo**, e isso é responsabilidade de quem
// quebra. É a única regra que este módulo não consegue impor sozinho, e por isso está escrita aqui.

import { B, BLOCKS } from '../world/blocks';

/** Colunas × linhas. 27 é o tamanho que se lê de relance sem virar uma planilha. */
export const COLUNAS_DO_BAU = 9;
export const LINHAS_DO_BAU = 3;
export const SLOTS_DO_BAU = COLUNAS_DO_BAU * LINHAS_DO_BAU;

/**
 * Máximo por pilha.
 *
 * A hotbar do jogo trabalha com contagens muito maiores (milhares), e o baú **não** herda isso de
 * propósito: um limite por pilha é o que dá função à quantidade de slots. Sem ele, um baú de 27
 * slots guardaria o mundo inteiro e o número de slots seria decoração.
 */
export const MAX_POR_PILHA = 999;

export interface PilhaDeBau {
  block: number;
  count: number;
}

/** Uma posição de bloco vira a chave do baú. Inteiros, sempre — ver `chaveDoBau`. */
export function chaveDoBau(x: number, y: number, z: number): string {
  return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

/** Um baú vazio: 27 buracos. `null` e não um objeto com `count: 0` — ver `normalizar`. */
export function bauVazio(): (PilhaDeBau | null)[] {
  return new Array(SLOTS_DO_BAU).fill(null);
}

/**
 * Um slot com contagem zero vira buraco.
 *
 * A alternativa — deixar `{ block: X, count: 0 }` — cria um slot que *parece* ocupado para o
 * empilhamento e vazio para o desenho. Foi assim que a primeira versão do `depositar` encheu um baú
 * de pilhas invisíveis de zero item, e o baú ficou "cheio" mostrando 27 quadrados vazios.
 */
function normalizar(p: PilhaDeBau | null): PilhaDeBau | null {
  if (!p || p.count <= 0 || p.block === B.AIR) return null;
  return p;
}

export interface ResultadoDeDeposito {
  /** Quantos entraram de fato. */
  guardados: number;
  /** Quantos sobraram por falta de espaço. */
  sobra: number;
}

/**
 * Guarda itens no baú, empilhando no que já existe antes de abrir slot novo.
 *
 * Empilhar primeiro não é otimização: é o que faz "guardar tudo" produzir um baú organizado em vez
 * de 27 pilhas de um item cada, que é o resultado de preencher na ordem dos buracos.
 *
 * Muta o array recebido — o baú é um estado, e copiá-lo a cada depósito faria a interface ter de
 * reatribuir a referência em toda operação, que é a maneira mais fácil de perder uma escrita.
 */
export function depositar(
  slots: (PilhaDeBau | null)[],
  block: number,
  count: number,
): ResultadoDeDeposito {
  if (block === B.AIR || count <= 0) return { guardados: 0, sobra: Math.max(0, count) };

  let restante = count;

  // Primeira passada: completa pilhas do mesmo tipo.
  for (let i = 0; i < slots.length && restante > 0; i++) {
    const p = normalizar(slots[i]);
    slots[i] = p;
    if (!p || p.block !== block) continue;
    const cabe = Math.min(restante, MAX_POR_PILHA - p.count);
    if (cabe <= 0) continue;
    p.count += cabe;
    restante -= cabe;
  }

  // Segunda passada: abre slots novos.
  for (let i = 0; i < slots.length && restante > 0; i++) {
    if (normalizar(slots[i])) continue;
    const cabe = Math.min(restante, MAX_POR_PILHA);
    slots[i] = { block, count: cabe };
    restante -= cabe;
  }

  return { guardados: count - restante, sobra: restante };
}

/**
 * Retira uma pilha inteira de um slot e devolve o que havia.
 *
 * Pilha inteira e não "um item": tirar de um em um de um baú de 27 slots é um exercício de
 * paciência, e o jogo não tem nenhuma mecânica que dependa de contagem fina.
 */
export function retirar(slots: (PilhaDeBau | null)[], indice: number): PilhaDeBau | null {
  if (indice < 0 || indice >= slots.length) return null;
  const p = normalizar(slots[indice]);
  slots[indice] = null;
  return p;
}

/** Quantos slots estão ocupados. */
export function ocupacao(slots: (PilhaDeBau | null)[]): number {
  let n = 0;
  for (const p of slots) if (normalizar(p)) n++;
  return n;
}

export function estaVazio(slots: (PilhaDeBau | null)[]): boolean {
  return ocupacao(slots) === 0;
}

/**
 * Tudo o que está dentro, para devolver ao jogador quando o bloco é quebrado.
 *
 * Devolve cópias e esvazia o baú na mesma chamada: quem quebra o bloco precisa das duas coisas
 * juntas, e separá-las abriria a janela em que o conteúdo existe em dois lugares — se algo falhar
 * no meio, o jogador duplica o inventário inteiro.
 */
export function esvaziar(slots: (PilhaDeBau | null)[]): PilhaDeBau[] {
  const fora: PilhaDeBau[] = [];
  for (let i = 0; i < slots.length; i++) {
    const p = normalizar(slots[i]);
    if (p) fora.push({ block: p.block, count: p.count });
    slots[i] = null;
  }
  return fora;
}

/** O nome do bloco, para a interface não precisar conhecer a paleta. */
export function nomeDoBloco(block: number): string {
  return BLOCKS[block]?.name ?? `bloco ${block}`;
}

/**
 * Valida o que veio do banco.
 *
 * Um save escrito por outra versão — ou por um mod que mexeu direto na tabela — pode trazer
 * qualquer coisa. Um baú com 400 slots ou com `count: NaN` quebraria a interface longe daqui, e o
 * sintoma seria "o inventário não abre" sem nada apontando para o dado.
 */
export function sanearBau(bruto: unknown): (PilhaDeBau | null)[] {
  const slots = bauVazio();
  if (!Array.isArray(bruto)) return slots;
  for (let i = 0; i < Math.min(bruto.length, SLOTS_DO_BAU); i++) {
    const p = bruto[i] as Partial<PilhaDeBau> | null;
    if (!p || typeof p !== 'object') continue;
    const block = Number(p.block);
    const count = Math.floor(Number(p.count));
    if (!Number.isFinite(block) || !Number.isFinite(count)) continue;
    if (block === B.AIR || count <= 0) continue;
    slots[i] = { block, count: Math.min(count, MAX_POR_PILHA) };
  }
  return slots;
}
