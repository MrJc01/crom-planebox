// Contraste entre blocos — item 076.
//
// ## O problema, e por que ele é do agente
//
// O jogador pede "cria um bloco de pedra escura" e a IA gera um cinza. Já existe um cinza quase
// igual no jogo. Os dois viram blocos distintos no inventário, com nomes diferentes e receitas
// diferentes, e **indistinguíveis na tela**. O jogador quebra o errado, constrói com o errado, e
// nada no jogo o avisa — o mundo simplesmente fica confuso.
//
// Não é um erro que o agente perceba sozinho: ele não vê a tela, e do ponto de vista dele o bloco
// foi criado com sucesso. Precisa de uma regra que recuse na criação.
//
// ## Por que não comparar RGB direto
//
// A distância euclidiana em RGB não corresponde ao que o olho percebe. `#00FF00` e `#00E000` têm
// a mesma distância numérica que `#0000FF` e `#0000E0`, e o primeiro par é muito mais parecido
// aos olhos, porque a visão é bem mais sensível a variação no verde que no azul.
//
// Usar a luminância perceptual (Rec. 709) como um dos eixos corrige o pior disso sem trazer um
// espaço de cor inteiro para dentro do projeto. É a mesma ponderação já usada na gradação de cor
// em `src/render/grading.ts`, então o jogo tem uma só noção de "quanto isto é claro".

/** Cor em 0..1 por canal, como o `BlockDef` guarda. */
export type Cor = readonly [number, number, number];

/**
 * Distância perceptual entre duas cores, aproximadamente 0..1.
 *
 * Combina diferença de **luminância** (o que mais separa dois blocos de longe, com pouca luz, e
 * para quem tem daltonismo) com diferença de **matiz por canal**. A luminância pesa mais de
 * propósito: dois blocos de cores diferentes mas mesmo brilho continuam difíceis de distinguir
 * numa caverna, que é onde a maior parte do jogo acontece.
 */
export function distanciaPerceptual(a: Cor, b: Cor): number {
  const lum = (c: Cor) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const dLum = Math.abs(lum(a) - lum(b));

  const dCanal = Math.sqrt(
    ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) / 3,
  );

  return Math.min(1, dLum * 0.65 + dCanal * 0.35);
}

/**
 * Distância mínima aceitável entre a cor de topo de um bloco novo e a de um já existente.
 *
 * Calibrado para recusar o que é indistinguível sem impedir uma família coerente de blocos —
 * pedra, pedra musgosa e pedra rachada **devem** parecer parentes. Valor mais alto começaria a
 * proibir variações legítimas, e a consequência prática seria o agente inventar cores berrantes
 * para passar na validação, o que é pior que o problema original.
 */
export const DISTANCIA_MINIMA = 0.055;

export interface BlocoComparavel {
  nome: string;
  topo: Cor;
}

export interface ConflitoDeCor {
  /** Nome do bloco já existente que ficou parecido demais. */
  conflitaCom: string;
  distancia: number;
  sugestao: string;
}

/**
 * O bloco novo é distinguível de todos os existentes?
 *
 * Devolve `null` quando está tudo bem, ou o conflito **mais próximo** — só o pior, e não a lista
 * inteira: uma cor parecida com cinco cinzas gera cinco reclamações sobre o mesmo problema, e o
 * agente que lê isso tende a tratar como cinco correções separadas.
 */
export function verificarContraste(
  topoNovo: Cor,
  existentes: readonly BlocoComparavel[],
  minimo = DISTANCIA_MINIMA,
): ConflitoDeCor | null {
  let pior: ConflitoDeCor | null = null;

  for (const e of existentes) {
    const d = distanciaPerceptual(topoNovo, e.topo);
    if (d >= minimo) continue;
    if (pior && d >= pior.distancia) continue;
    pior = {
      conflitaCom: e.nome,
      distancia: d,
      sugestao: sugerirAjuste(topoNovo, e.topo),
    };
  }

  return pior;
}

/**
 * Sugestão concreta de como afastar a cor.
 *
 * Dizer "escolha outra cor" devolve o problema para quem não sabe resolvê-lo. Dizer "clareie" ou
 * "escureça" dá uma direção que o agente consegue seguir numa tentativa só — e a direção certa é
 * a que se afasta do vizinho, não uma qualquer.
 */
function sugerirAjuste(nova: Cor, existente: Cor): string {
  const lum = (c: Cor) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const ln = lum(nova);
  const le = lum(existente);
  // Empatadas na luminância: mandar para o lado que tem mais espaço até o extremo.
  const clarear = Math.abs(ln - le) < 0.01 ? ln < 0.5 : ln > le;
  return clarear
    ? 'clareie a cor de topo, ou aumente a saturação'
    : 'escureça a cor de topo, ou aumente a saturação';
}

/** Hex (`0x38bdf8` ou `'#38bdf8'`) para 0..1 por canal. */
export function corDeHex(valor: number | string): Cor {
  const n = typeof valor === 'number'
    ? valor
    : parseInt(String(valor).replace(/^#/, ''), 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
