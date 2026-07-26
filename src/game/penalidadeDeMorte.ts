// O que a morte custa — item 011, e a resposta à lacuna 1309.
//
// ## Por que isto importa mais do que parece
//
// Morrer devolvia o jogador ao spawn com o inventário intacto. O efeito não é "o jogo é fácil": é
// que **o risco deixa de ser informação**. Descer 25 metros atrás de diamante e cair na lava custa
// a caminhada de volta, e nada mais — então não há decisão a tomar sobre quando descer, o que
// levar, ou quando voltar com o que já se tem. O loop central (`docs/LOOP_CENTRAL.md`) pede que os
// passos 10 a 13 tenham peso, e sem custo de morte eles são só distância.
//
// ## As três opções, e por que são três
//
// Não é uma escala de dificuldade — são três jogos diferentes:
//
// - `manter`: construir sem atrito. Quem usa o mundo como tela não deveria perder uma tarde de
//   coleta por um passo em falso.
// - `dropar`: o padrão. A morte custa o que você estava carregando, e dá o momento tenso de voltar
//   ao lugar onde caiu antes que os itens sumam.
// - `hardcore`: uma vida. O mundo se encerra, e é o único modo em que cada descida é decisão final.
//
// ## O que NÃO cai: as ferramentas
//
// Regra deliberada: **a penalidade é o material que você carregava, não a progressão que você
// destravou.** Perder a picareta de diamante numa queda apagaria de uma vez uma corrente inteira de
// progressão — e a reação de quem joga não é "vou com mais cuidado", é parar de descer. O medo que
// faz alguém sair do jogo não é o mesmo que faz alguém jogar melhor.
//
// Tem também um motivo prático e honesto: `ItemDropSystem.spawn` só sabe largar **blocos**. Uma
// ferramenta largada no chão não teria como ser representada nem recolhida hoje.

export type PenalidadeDeMorte = 'manter' | 'dropar' | 'hardcore';

/**
 * O padrão de um mundo **novo**.
 *
 * `dropar` porque um mundo sem custo de morte não tem como ensinar o risco, e é a regra que a
 * maioria de quem chega ao gênero espera encontrar.
 */
export const PENALIDADE_PADRAO: PenalidadeDeMorte = 'dropar';

/**
 * O padrão de um mundo **já existente**, gravado antes de este campo existir.
 *
 * `manter` — o comportamento que aquele mundo sempre teve. Fazer a atualização do jogo mudar em
 * silêncio as regras de um mundo em andamento é a pior surpresa possível: o jogador perderia o
 * inventário na próxima morte por uma decisão que ninguém tomou nem comunicou.
 */
export const PENALIDADE_DE_MUNDO_ANTIGO: PenalidadeDeMorte = 'manter';

export const ROTULOS: Record<PenalidadeDeMorte, { titulo: string; descricao: string }> = {
  manter: {
    titulo: 'Manter tudo',
    descricao: 'Você volta ao spawn com o inventário intacto. Para construir sem atrito.',
  },
  dropar: {
    titulo: 'Largar os itens',
    descricao: 'Os blocos que você carregava caem onde você morreu. As ferramentas ficam com você.',
  },
  hardcore: {
    titulo: 'Uma vida só',
    descricao: 'Ao morrer, o mundo é encerrado e não pode mais ser jogado. Sem volta.',
  },
};

/** O mínimo de um slot da hotbar que esta regra precisa conhecer. */
export interface SlotDeInventario {
  block: number;
  count: number;
  infinite?: boolean;
  toolTier?: number;
}

export interface ItemLargado {
  block: number;
  count: number;
}

export interface ResultadoDaMorte {
  /** Blocos a largar no chão, no ponto da morte. */
  largar: ItemLargado[];
  /** Índices dos slots que devem ser esvaziados. */
  esvaziar: number[];
  /** O mundo acabou (só em `hardcore`). */
  encerraMundo: boolean;
}

/**
 * O que acontece com o inventário nesta morte.
 *
 * Função pura: não mexe na hotbar, **descreve** a mudança. Quem chama decide quando aplicar — e é
 * o que permite testar a regra sem um mundo, um sistema de drops e uma cena.
 */
export function aplicarPenalidade(
  modo: PenalidadeDeMorte,
  hotbar: readonly SlotDeInventario[],
): ResultadoDaMorte {
  if (modo === 'manter') return { largar: [], esvaziar: [], encerraMundo: false };
  // No hardcore o mundo acaba: largar itens num mundo que ninguém vai reabrir seria trabalho para
  // ninguém ver, e ainda deixaria entidades soltas no save final.
  if (modo === 'hardcore') return { largar: [], esvaziar: [], encerraMundo: true };

  const largar: ItemLargado[] = [];
  const esvaziar: number[] = [];
  for (let i = 0; i < hotbar.length; i++) {
    const s = hotbar[i];
    if (!s) continue;
    // Ferramenta fica. É a progressão, não a carga — ver o cabeçalho.
    if (s.toolTier !== undefined) continue;
    // `infinite` é a marca do inventário criativo: não é carga, é uma paleta.
    if (s.infinite) continue;
    if (s.block < 0 || s.count <= 0) continue;
    largar.push({ block: s.block, count: s.count });
    esvaziar.push(i);
  }
  return { largar, esvaziar, encerraMundo: false };
}

/** Lê a penalidade de um registro de mundo, aplicando o padrão certo para cada origem. */
export function penalidadeDoMundo(valor: string | undefined | null): PenalidadeDeMorte {
  if (valor === 'manter' || valor === 'dropar' || valor === 'hardcore') return valor;
  return PENALIDADE_DE_MUNDO_ANTIGO;
}
