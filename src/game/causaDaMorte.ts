// Como o jogador morreu, em palavras — item 143.
//
// ## O que estava jogado fora
//
// `SurvivalSystem.onDeath(cause)` sempre entregou a causa, e o `main` a recebia como `() => {}`:
// o parâmetro chegava e era descartado na assinatura. Sete causas distintas eram calculadas com
// cuidado — queda, afogamento, lava, queimadura, fome, criatura — e todas viravam a mesma tela.
//
// O custo disso não é estético. Morrer sem saber do quê é a diferença entre "eu errei" e "o jogo me
// matou": na primeira o jogador muda o que faz, na segunda ele fecha a aba. E há causas que são
// literalmente invisíveis — a queimadura mata **depois** de sair da lava, e quem morre a dez metros
// de distância dela não tem nenhuma pista de que o fogo ainda estava pegando.
//
// ## Por que a frase é na segunda pessoa e no passado
//
// "Você se afogou" e não "Morte por afogamento". A segunda é um rótulo de sistema; a primeira é o
// que aconteceu com você. É a diferença entre um relatório e uma história, e o jogo inteiro depende
// de o jogador achar que a coisa aconteceu com ele.

/** As causas que o `SurvivalSystem` e o combate emitem. */
export type CausaDaMorte =
  | 'queda' | 'afogamento' | 'lava' | 'queimadura' | 'fome' | 'criatura' | 'desconhecida';

interface Descricao {
  frase: string;
  /**
   * Uma linha sobre o que fazer diferente.
   *
   * Só onde há algo a dizer que o jogador possa não saber. Uma dica óbvia ("não caia de lugares
   * altos") ensina que as dicas não valem a pena ler, e a partir daí ele para de ler todas.
   */
  dica?: string;
}

const DESCRICOES: Record<CausaDaMorte, Descricao> = {
  queda: { frase: 'Você caiu de muito alto.' },
  afogamento: {
    frase: 'Você ficou sem ar.',
    dica: 'A barra de bolhas avisa antes — ela aparece assim que a cabeça submerge.',
  },
  lava: { frase: 'Você entrou na lava.' },
  queimadura: {
    frase: 'Você continuou queimando depois de sair da lava.',
    // A causa mais invisível de todas: mata longe da lava, e nada na tela liga uma coisa à outra.
    dica: 'Só a água apaga o fogo. Sair da lava não basta.',
  },
  fome: {
    frase: 'Você morreu de fome.',
    dica: 'Comer antes da barra zerar evita o dano — e acima da metade, a vida se recupera sozinha.',
  },
  criatura: { frase: 'Você foi morto por uma criatura.' },
  desconhecida: { frase: 'Você morreu.' },
};

/** Normaliza uma causa vinda de fora — inclusive de um mod, que pode mandar qualquer string. */
export function causaConhecida(bruta: string | undefined): CausaDaMorte {
  if (bruta && bruta in DESCRICOES) return bruta as CausaDaMorte;
  return 'desconhecida';
}

/**
 * A frase e a dica para uma causa.
 *
 * Nunca devolve vazio: uma causa desconhecida — de um mod, ou de um caminho que ainda não existe —
 * cai em "Você morreu", que é pior que a frase certa e muito melhor que uma tela sem explicação
 * nenhuma, que é o que havia.
 */
export function descreverMorte(bruta: string | undefined): Descricao {
  return DESCRICOES[causaConhecida(bruta)];
}

/** O texto completo, pronto para a tela. */
export function textoDaMorte(bruta: string | undefined): string {
  const d = descreverMorte(bruta);
  return d.dica ? `${d.frase} ${d.dica}` : d.frase;
}
