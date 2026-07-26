// Objetivos que guiam o jogador novato — item 007, e a espinha do loop central do item 006.
//
// ## O problema
//
// O jogo tinha cinco modos, sobrevivência com vida e fome, minérios por profundidade e uma
// corrente de ferramentas de quatro degraus — e **nada que dissesse ao jogador o que fazer com
// isso**. Quem entra pela primeira vez vê um mundo aberto, uma hotbar e nenhuma direção. A
// consequência não é confusão: é o jogador construir uma casinha, achar que viu tudo, e sair.
//
// Toda a progressão que existe (madeira → pedra → ferro → diamante → obsidiana) já está no jogo,
// mas é **invisível**: nada avisa que a picareta de madeira abre a pedra, que o carvão vira tocha,
// nem que a tocha é o que torna a caverna explorável. O jogador teria que deduzir a cadeia inteira
// olhando receitas.
//
// ## As três regras de desenho
//
// **Um passo de cada vez.** A lista inteira na tela é uma lista de tarefas, não um jogo — e um
// novato diante de treze caixinhas continua sem saber por onde começar. `atual()` devolve **um**
// objetivo, o primeiro pendente. O resto existe, mas não é mostrado até chegar a vez.
//
// **A ordem é sugestão, não trilho.** Cada evento é testado contra *todos* os objetivos pendentes,
// não só contra o atual. Quem cair numa caverna e achar ferro antes de fabricar a picareta de
// madeira tem o objetivo do ferro marcado na hora. O contrário — só avançar na ordem — obrigaria o
// jogador a refazer o que já fez, que é a maneira mais rápida de transformar um guia em estorvo.
//
// **Concluído nunca volta a pendente.** O progresso é monotônico. Sem isso, "fabrique tábuas"
// desmarcaria quando o jogador gastasse as tábuas na bancada, e o guia mandaria de volta para a
// árvore alguém que já está no ferro.
//
// ## Por que eventos, e não uma varredura do inventário
//
// Perguntar "o jogador tem tábuas?" a cada quadro parece mais simples e é errado por duas vias: é
// um teste de *posse*, não de *feito* (quem gastou o item deixa de ter feito), e não distingue
// fabricar de receber de um mod ou de um amigo. Evento é o registro do que aconteceu, e é o que
// não se desfaz.
//
// Os objetivos são quase todos de **primeira vez** (`meta: 1`) de propósito. Uma meta de "quebre
// 20 pedras" seria satisfeita por uma célula só no Modo Detalhe, onde uma quebra são 27
// mini-voxels — a contagem mentiria por um fator de 27 dependendo de um modo que não tem nada a
// ver com o objetivo.

import { B } from '../world/blocks';

/**
 * O que o mundo reporta ao rastreador.
 *
 * Deliberadamente pequeno: cada variante corresponde a um ponto de instrumentação que já existe no
 * jogo (`inter.onBlockChange`, `collectCraft`, a virada do dia no laço principal, a posição do
 * jogador). Um tipo de evento sem origem real seria código dormente — o defeito que mais apareceu
 * neste projeto.
 */
export type EventoDeProgresso =
  /** Um bloco saiu do mundo. `bloco` é o tipo que estava ali. */
  | { tipo: 'quebrou'; bloco: number }
  /** Uma receita foi coletada da bancada. Bloco de saída, ou `tier` se for ferramenta. */
  | { tipo: 'fabricou'; bloco?: number; tier?: number }
  /** O jogador está num espaço fechado com a noite lá fora (ver `abrigo.ts`). */
  | { tipo: 'abrigado' }
  /** Profundidade atual, em metros abaixo de onde o jogador apareceu. */
  | { tipo: 'profundidade'; metros: number }
  /** O relógio do mundo virou o dia. */
  | { tipo: 'amanheceu' };

export interface DefinicaoDeObjetivo {
  id: string;
  titulo: string;
  /** Frase curta que diz **como** avançar. É o que separa um guia de um placar. */
  dica: string;
  /** Quantas vezes o evento precisa acontecer. Quase sempre 1 — ver o cabeçalho. */
  meta: number;
  /** Quanto este evento soma ao objetivo. 0 = não interessa. */
  conta: (e: EventoDeProgresso) => number;
}

/** Um evento que casa exatamente uma vez com um bloco quebrado. */
const aoQuebrar = (bloco: number) => (e: EventoDeProgresso) =>
  e.tipo === 'quebrou' && e.bloco === bloco ? 1 : 0;

/** Um evento de fabricação de ferramenta **daquele tier ou melhor**. */
const aoFabricarTier = (tier: number) => (e: EventoDeProgresso) =>
  e.tipo === 'fabricou' && (e.tier ?? 0) >= tier ? 1 : 0;

const aoFabricarBloco = (bloco: number) => (e: EventoDeProgresso) =>
  e.tipo === 'fabricou' && e.bloco === bloco ? 1 : 0;

/**
 * A corrente do primeiro dia, na ordem em que ela se resolve sozinha.
 *
 * Ela **é** o loop central do item 006 escrito em passos concretos: acordar e cortar madeira →
 * fabricar → descer atrás de material → iluminar → sobreviver à noite → descer mais fundo. Cada
 * degrau depende do anterior por mecânica, não por decreto: sem picareta de madeira não sai pedra,
 * sem carvão não sai tocha, sem tocha a caverna é escura demais para achar ferro.
 */
export const OBJETIVOS: DefinicaoDeObjetivo[] = [
  {
    id: 'primeira_madeira',
    titulo: 'Derrube sua primeira árvore',
    dica: 'Mire num tronco e segure o botão esquerdo. A árvore inteira cai.',
    meta: 1,
    conta: (e) => (e.tipo === 'quebrou' && (e.bloco === B.LOG || e.bloco === B.PINE_LOG) ? 1 : 0),
  },
  {
    id: 'tabuas',
    titulo: 'Transforme o tronco em tábuas',
    dica: 'Abra o inventário [E] e use a Mesa de Crafting: 1 tronco vira 4 tábuas.',
    meta: 1,
    conta: aoFabricarBloco(B.PLANK),
  },
  {
    id: 'picareta_madeira',
    titulo: 'Fabrique a picareta de madeira',
    dica: 'Três tábuas em cima, dois troncos descendo pelo meio. É ela que abre a pedra.',
    meta: 1,
    conta: aoFabricarTier(1),
  },
  {
    id: 'primeira_pedra',
    titulo: 'Minere pedra',
    dica: 'Com a picareta na mão, quebre pedra. Sem ferramenta, ela quebra mas não rende nada.',
    meta: 1,
    conta: aoQuebrar(B.STONE),
  },
  {
    id: 'picareta_pedra',
    titulo: 'Suba para a picareta de pedra',
    dica: 'Mesma forma da anterior, trocando as tábuas por pedregulho. Dura mais e minera mais rápido.',
    meta: 1,
    conta: aoFabricarTier(2),
  },
  {
    // Este é o único objetivo que verifica um *estado* do mundo, e não um ato do jogador. A versão
    // anterior contava doze blocos colocados — doze blocos de terra em fila cumpriam, e a primeira
    // noite pegava o jogador do lado de fora depois de o jogo ter dito que estava tudo certo.
    id: 'abrigo',
    titulo: 'Esteja abrigado quando escurecer',
    dica: 'Coloque blocos com o botão direito e feche um espaço — ou tape a boca de uma caverna.',
    meta: 1,
    conta: (e) => (e.tipo === 'abrigado' ? 1 : 0),
  },
  {
    id: 'carvao',
    titulo: 'Encontre carvão',
    dica: 'Ele aparece já nos primeiros metros abaixo da superfície, salpicado na pedra.',
    meta: 1,
    conta: aoQuebrar(B.COAL_ORE),
  },
  {
    id: 'tochas',
    titulo: 'Faça tochas',
    dica: 'Carvão em cima de um tronco rende 4 tochas — é o que torna a caverna explorável.',
    meta: 1,
    conta: aoFabricarBloco(B.TORCH),
  },
  {
    id: 'primeira_noite',
    titulo: 'Sobreviva até o amanhecer',
    dica: 'Fique abrigado ou em movimento. O dia volta sozinho.',
    meta: 1,
    conta: (e) => (e.tipo === 'amanheceu' ? 1 : 0),
  },
  {
    id: 'desceu',
    titulo: 'Desça 15 metros abaixo da superfície',
    dica: 'Cave para baixo em escada, nunca em linha reta sob os pés.',
    meta: 1,
    conta: (e) => (e.tipo === 'profundidade' && e.metros >= 15 ? 1 : 0),
  },
  {
    id: 'ferro',
    titulo: 'Encontre minério de ferro',
    dica: 'Entre 6 e 30 metros de profundidade. A picareta de pedra já dá conta dele.',
    meta: 1,
    conta: aoQuebrar(B.IRON_ORE),
  },
  {
    id: 'picareta_ferro',
    titulo: 'Fabrique a picareta de ferro',
    dica: 'Quatro minérios viram um bloco de ferro; três blocos e dois troncos, a picareta.',
    meta: 1,
    conta: aoFabricarTier(3),
  },
  {
    id: 'diamante',
    titulo: 'Encontre diamante',
    dica: 'Só no fundo, entre 20 e 26 metros. Precisa da picareta de ferro para render.',
    meta: 1,
    conta: aoQuebrar(B.DIAMOND_ORE),
  },
  {
    id: 'picareta_diamante',
    titulo: 'Fabrique a picareta de diamante',
    dica: 'O último degrau. Minera mais rápido e é a única que coleta obsidiana.',
    meta: 1,
    conta: aoFabricarTier(4),
  },
  {
    id: 'obsidiana',
    titulo: 'Colete obsidiana',
    dica: 'Ela se forma onde a água encosta na lava. Nenhuma outra picareta a recolhe.',
    meta: 1,
    conta: aoQuebrar(B.OBSIDIAN),
  },
];

export interface ObjetivoEmCurso {
  def: DefinicaoDeObjetivo;
  progresso: number;
}

/**
 * Estado dos objetivos de um mundo.
 *
 * Guarda **contagem por id**, não índice do passo atual. Um índice suporia que a ordem é
 * obrigatória e perderia o objetivo que o jogador cumpriu fora de hora — que é o caso comum, não a
 * exceção: ninguém desce numa caverna seguindo uma lista.
 */
export class RastreadorDeObjetivos {
  private progresso = new Map<string, number>();

  constructor(private readonly defs: readonly DefinicaoDeObjetivo[] = OBJETIVOS) {}

  /**
   * Registra um evento e devolve os objetivos **concluídos agora** — só os que cruzaram a meta
   * neste evento, para quem chama poder anunciar cada conquista exatamente uma vez.
   */
  registrar(e: EventoDeProgresso): DefinicaoDeObjetivo[] {
    const novos: DefinicaoDeObjetivo[] = [];
    for (const def of this.defs) {
      const antes = this.progresso.get(def.id) ?? 0;
      if (antes >= def.meta) continue; // monotônico: concluído não volta a pendente
      const soma = def.conta(e);
      if (soma <= 0) continue;
      const depois = antes + soma;
      this.progresso.set(def.id, depois);
      if (depois >= def.meta) novos.push(def);
    }
    return novos;
  }

  /** O próximo passo a mostrar, ou `null` quando a corrente acabou. */
  atual(): ObjetivoEmCurso | null {
    for (const def of this.defs) {
      const p = this.progresso.get(def.id) ?? 0;
      if (p < def.meta) return { def, progresso: p };
    }
    return null;
  }

  /**
   * A corrente inteira, para a tela que a mostra por extenso.
   *
   * O cartão do HUD mostra um passo; esta é a visão de quem quer rever o que já fez ou espiar o
   * que vem. São públicos diferentes e não podem ser a mesma tela: a lista completa no canto da
   * tela devolve ao novato exatamente o problema que o guia existe para resolver.
   */
  listar(): Array<{ def: DefinicaoDeObjetivo; progresso: number; concluido: boolean }> {
    return this.defs.map((def) => {
      const progresso = Math.min(def.meta, this.progresso.get(def.id) ?? 0);
      return { def, progresso, concluido: progresso >= def.meta };
    });
  }

  concluido(id: string): boolean {
    const def = this.defs.find((d) => d.id === id);
    return !!def && (this.progresso.get(def.id) ?? 0) >= def.meta;
  }

  get totalConcluidos(): number {
    return this.defs.filter((d) => this.concluido(d.id)).length;
  }

  get total(): number {
    return this.defs.length;
  }

  /**
   * Estado para o save do mundo.
   *
   * Grava só o que está em andamento ou concluído, por id. Salvar o índice do passo tornaria o
   * save frágil a qualquer reordenação da lista — um objetivo inserido no meio deslocaria todo o
   * progresso de todos os mundos já salvos.
   */
  serializar(): Record<string, number> {
    return Object.fromEntries(this.progresso);
  }

  /** Restaura do save, ignorando ids que não existem mais (objetivo removido numa versão nova). */
  restaurar(dados: Record<string, number> | undefined | null): void {
    this.progresso.clear();
    if (!dados) return;
    for (const def of this.defs) {
      const v = dados[def.id];
      if (typeof v === 'number' && v > 0) this.progresso.set(def.id, v);
    }
  }
}
