// Fases da lua e a claridade que elas dão à noite.
//
// O Minecraft vanilla tem oito fases, mas elas **não** mudam a luminosidade: a noite tem nível
// de luz 4 fixo, seja lua cheia ou nova, e a fase só influencia o surgimento de slimes. Aqui a
// decisão é outra, e deliberada: **a fase governa a claridade**.
//
// O motivo é de jogo, não de simulação. Com claridade fixa, a fase lunar é enfeite — o jogador
// nunca precisa olhar para o céu. Com claridade variável, a mesma base e a mesma caverna mudam
// de dificuldade conforme a noite, e "que lua é hoje?" vira uma pergunta com consequência.
//
// Módulo puro: só aritmética, sem Three.js. A curva de claridade é o tipo de coisa que se ajusta
// por tentativa, e um teste que fixa as invariantes evita que o ajuste quebre o essencial.

/** Quantidade de fases num ciclo completo. */
export const FASES_LUNARES = 8;

export type NomeFase =
  | 'nova' | 'crescente côncava' | 'quarto crescente' | 'crescente gibosa'
  | 'cheia' | 'minguante gibosa' | 'quarto minguante' | 'minguante côncava';

const NOMES: NomeFase[] = [
  'nova', 'crescente côncava', 'quarto crescente', 'crescente gibosa',
  'cheia', 'minguante gibosa', 'quarto minguante', 'minguante côncava',
];

/** Fase (0..7) do dia informado. 0 = lua nova, 4 = lua cheia. */
export function faseDoDia(dia: number): number {
  const d = Math.floor(dia);
  // Resto sempre positivo: dia negativo aparece ao voltar o relógio do mundo.
  return ((d % FASES_LUNARES) + FASES_LUNARES) % FASES_LUNARES;
}

export function nomeDaFase(fase: number): NomeFase {
  return NOMES[faseDoDia(fase)];
}

/**
 * Fração iluminada do disco, 0 (nova) a 1 (cheia).
 * É o que desenha a lua e também o que governa a claridade da noite.
 */
export function iluminacaoDaFase(fase: number): number {
  const f = faseDoDia(fase);
  const meio = FASES_LUNARES / 2;
  return 1 - Math.abs(f - meio) / meio;
}

/** Claridade mínima da noite: quase preto na lua nova. */
export const NOITE_MAIS_ESCURA = 0.035;
/** Claridade máxima: lua cheia, o suficiente para andar sem tocha. */
export const NOITE_MAIS_CLARA = 0.19;

/**
 * Intensidade da luz de céu durante a noite, conforme a fase.
 *
 * A curva não é linear: usa a raiz da iluminação porque a percepção de brilho é logarítmica —
 * com resposta linear, metade das fases pareceriam igualmente escuras e a variação só apareceria
 * perto da lua cheia.
 */
export function claridadeNoturna(fase: number): number {
  const i = iluminacaoDaFase(fase);
  return NOITE_MAIS_ESCURA + (NOITE_MAIS_CLARA - NOITE_MAIS_ESCURA) * Math.sqrt(i);
}

/**
 * A noite está escura o bastante para exigir tocha?
 *
 * O limiar é sobre a **iluminação** (metade do disco), não sobre a claridade resultante: como a
 * curva de brilho usa raiz, ela sobe rápido, e um limiar no meio da faixa de brilho classificaria
 * só a lua nova como escura — sete das oito noites seriam "claras", e a variação perderia o
 * sentido. Pela iluminação, as três noites em torno da lua nova são as escuras.
 */
export function noiteEscura(fase: number): boolean {
  return iluminacaoDaFase(fase) < 0.5;
}

/**
 * Dia do mundo a partir do tempo acumulado.
 * `timeOfDay` é a fração do dia atual; `dia` conta os ciclos completos desde o início.
 */
export function diaDoMundo(diasCompletos: number, timeOfDay: number): number {
  return Math.floor(diasCompletos) + (timeOfDay >= 1 ? 1 : 0);
}
