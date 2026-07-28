// A duração do dia claro muda com a estação — item 1120.
//
// ## O que estava declarado e sem leitor
//
// `PerfilSazonal.duracaoDoDia` existe desde que as estações existem: 1,15 no verão, 0,78 no
// inverno. Nada no jogo o consultava. O inverno esfriava a cor, pesava a neve no sorteio de clima
// e mudava o crescimento — e o dia continuava com exatamente a mesma duração do dia de verão, que é
// a coisa mais imediata que uma estação faz.
//
// ## Por que distorcer o relógio em vez de mudar a velocidade dele
//
// A tentação é fazer o relógio correr mais devagar de noite no inverno. Isso quebra tudo o que
// depende de o dia durar `DAY_LENGTH` segundos: a sincronização entre pares, o contador de dias, o
// sono, e o próprio ano — um ano de inverno mais longo desalinharia as estações do calendário que
// as define.
//
// Aqui o relógio real continua uniforme e o que muda é **onde o sol está** para uma dada hora. A
// distorção é uma remapeação monotônica de `[0,1]` em `[0,1]` que move o nascer e o pôr do sol
// mantendo fixos o meio-dia e a meia-noite. O dia continua durando o mesmo tanto; o que encolhe é
// a parte dele em que há sol.
//
// ## Por que os três âncoras, e não uma curva
//
// Uma curva suave (seno, potência) pareceria mais elegante e teria um defeito: ela move o meio-dia.
// Com o sol no ponto alto fora do meio do dia, o relógio do jogo deixa de bater com o céu, e é o
// tipo de erro que ninguém consegue nomear — só sente que "está estranho".
//
// Os âncoras são meia-noite (0), nascer (0,25 aparente), pôr (0,75 aparente) e meia-noite de novo.
// Entre eles, linear. A quebra de inclinação cai exatamente no nascer e no pôr do sol, que é onde a
// luz já está mudando depressa e onde ninguém percebe uma mudança de ritmo.

/**
 * Fração do dia em que há sol, no relógio aparente. Vem de `scene.ts`, onde a elevação solar é
 * `-cos(t * 2π)`: positiva exatamente entre 0,25 e 0,75.
 */
export const NASCER_APARENTE = 0.25;
export const POR_APARENTE = 0.75;

/**
 * Limites do multiplicador.
 *
 * Um inverno com 0,3 daria três horas de sol e um jogo injogável; um verão com 2 daria um dia sem
 * noite, e a noite é metade das mecânicas. Os perfis padrão vão de 0,78 a 1,15 e o limite existe
 * para o mod que declara um perfil próprio — `api.season.defineProfile` aceita qualquer número.
 */
export const DURACAO_MINIMA = 0.55;
export const DURACAO_MAXIMA = 1.45;

/**
 * A hora **aparente** (onde o sol está) para uma hora real do relógio.
 *
 * `duracao` é o multiplicador da estação: 1 devolve a entrada sem tocar, e essa igualdade é exata
 * de propósito — o caminho neutro não pode introduzir nem um erro de arredondamento no relógio que
 * todo o resto do jogo consome.
 */
export function horaAparente(horaReal: number, duracao: number): number {
  if (duracao === 1) return horaReal;

  const d = Math.max(DURACAO_MINIMA, Math.min(DURACAO_MAXIMA, duracao));
  // Onde o sol nasce e se põe no relógio REAL. A metade do dia claro encolhe ou estica em torno do
  // meio-dia, que fica parado.
  const metade = 0.25 * d;
  const nascerReal = 0.5 - metade;
  const porReal = 0.5 + metade;

  const t = ((horaReal % 1) + 1) % 1;

  if (t < nascerReal) {
    // Madrugada: de meia-noite ao nascer.
    return (t / nascerReal) * NASCER_APARENTE;
  }
  if (t < porReal) {
    // Dia claro.
    return NASCER_APARENTE + ((t - nascerReal) / (porReal - nascerReal)) * (POR_APARENTE - NASCER_APARENTE);
  }
  // Noite: do pôr à meia-noite seguinte.
  return POR_APARENTE + ((t - porReal) / (1 - porReal)) * (1 - POR_APARENTE);
}

/**
 * Quantas horas de jogo (em frações de dia) há de sol nesta estação.
 *
 * Existe para a interface poder dizer "o dia está encurtando" sem refazer a conta — e para o teste
 * verificar a promessa do item por medição, e não por inspeção da fórmula.
 */
export function fracaoDeSol(duracao: number): number {
  const d = Math.max(DURACAO_MINIMA, Math.min(DURACAO_MAXIMA, duracao));
  return 0.5 * d;
}
