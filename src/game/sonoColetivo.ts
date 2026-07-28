// A noite passa quando todos dormem — item 139.
//
// ## O que existia
//
// `porQueNaoPodeDormir` recusa o convidado com `souORelogio: peerSync.role !== 'guest'`, e a razão
// era boa: dormir corre o relógio do mundo, e o relógio do mundo é do anfitrião. Um convidado que
// acelerasse o próprio relógio veria um sol diferente do de todo mundo.
//
// A consequência, porém, é que num mundo compartilhado **a noite deixa de ter saída**. Quem
// hospeda dorme sozinho e passa a noite; quem entrou fica acordado no escuro esperando, sem nada
// que possa fazer a respeito e sem nada explicando por quê.
//
// ## Por que TODOS, e não a maioria
//
// Maioria significa ter a noite pulada contra a própria vontade — e quem estava no fundo de uma
// caverna minerando acabou de perder a noite inteira de trabalho seguro. Numa sessão de dois, que é
// o caso comum, "maioria" nem sequer quer dizer alguma coisa.
//
// Exigir todos é a única regra em que ninguém perde autonomia. O custo é que uma pessoa distraída
// segura a noite de todos — e é por isso que este módulo devolve **quem falta**, não só um `false`.
// Sem dizer o nome, o recurso vira uma espera sem explicação, que é pior que não existir.

export interface QuemDorme {
  /** Id de cada jogador presente, incluindo o anfitrião. */
  presentes: string[];
  /** Ids de quem está dormindo agora. */
  dormindo: Set<string>;
  /** Nome legível por id, para a mensagem. Um id sem nome aparece como o próprio id. */
  nomes?: Map<string, string>;
}

export interface EstadoDoSonoColetivo {
  /** Todos os presentes estão dormindo? */
  todosDormem: boolean;
  quantosDormem: number;
  total: number;
  /** Quem ainda está acordado, por nome. Vazio quando todos dormem. */
  faltam: string[];
  /** A frase pronta para a tela, ou `null` quando não há ninguém dormindo. */
  mensagem: string | null;
}

/**
 * O estado do sono da sessão.
 *
 * Função pura sobre uma fotografia: quem mantém o conjunto é o anfitrião. Separar os dois é o que
 * permite testar a regra — que é onde estão as decisões — sem simular uma sessão de rede.
 */
export function estadoDoSonoColetivo(q: QuemDorme): EstadoDoSonoColetivo {
  // `presentes` é a verdade sobre quem existe. Contar pelo conjunto de dormindo deixaria alguém que
  // saiu da sessão dormindo para sempre, e a noite nunca mais passaria — sem nada apontando a causa.
  const presentes = [...new Set(q.presentes)];
  const dormindo = presentes.filter((id) => q.dormindo.has(id));
  const acordados = presentes.filter((id) => !q.dormindo.has(id));

  const nome = (id: string) => q.nomes?.get(id) ?? id;
  const faltam = acordados.map(nome);

  if (dormindo.length === 0) {
    return { todosDormem: false, quantosDormem: 0, total: presentes.length, faltam, mensagem: null };
  }

  if (acordados.length === 0) {
    return {
      todosDormem: true,
      quantosDormem: dormindo.length,
      total: presentes.length,
      faltam: [],
      mensagem: presentes.length > 1 ? 'Todos dormiram. A noite está passando...' : null,
    };
  }

  return {
    todosDormem: false,
    quantosDormem: dormindo.length,
    total: presentes.length,
    faltam,
    // Diz o número **e** os nomes: o número sozinho não responde "quem?", e sem essa resposta a
    // única saída do jogador é perguntar no chat.
    mensagem: `Dormindo ${dormindo.length}/${presentes.length} — falta ${faltam.join(', ')}.`,
  };
}

/**
 * Guarda quem está dormindo. Só o anfitrião mantém uma.
 *
 * Existe como classe e não como um `Set` solto por causa de `sairam`: esquecer de tirar quem
 * desconectou é o modo de falha que trava a noite para sempre, e é fácil de esquecer porque só
 * acontece quando alguém sai **enquanto** dorme.
 */
export class RegistroDeSono {
  private dormindo = new Set<string>();

  public marcar(playerId: string, estaDormindo: boolean): void {
    if (estaDormindo) this.dormindo.add(playerId);
    else this.dormindo.delete(playerId);
  }

  public estaDormindo(playerId: string): boolean {
    return this.dormindo.has(playerId);
  }

  /** Remove quem não está mais presente. Chamar sempre que a lista de presentes mudar. */
  public sairam(presentes: string[]): void {
    const vivos = new Set(presentes);
    for (const id of [...this.dormindo]) if (!vivos.has(id)) this.dormindo.delete(id);
  }

  public get conjunto(): Set<string> {
    return this.dormindo;
  }

  public limpar(): void {
    this.dormindo.clear();
  }
}
