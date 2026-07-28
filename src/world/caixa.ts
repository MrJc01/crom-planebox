// A geometria de uma caixa de blocos, num lugar só — item 044.
//
// ## As três cópias
//
// O laço de preencher caixa existia três vezes, escrito à mão em cada uma:
//
//  - `ModAPI.fillBox` — conta quantos colocou e devolve o número;
//  - `MCPExecutors` no caso `fill_box` — acumula um lote para salvar e para o `onBlocksChanged`;
//  - `MCPExecutors` de novo, dentro de `execute_voxel_script` — acumula também o desfazer.
//
// As três fazem coisas diferentes com cada célula, e é por isso que a duplicação sobreviveu: não
// dava para extrair "preencher uma caixa" sem escolher um dos três efeitos. O que dá para extrair é
// a **geometria** — quais células a caixa tem —, e é só isso que este módulo faz.
//
// Duas das três já tinham divergido. `ModAPI` escreve a condição de vazado como
// `hollow && x !== minX && ...` e as outras duas como `if (hollow) { const isEdge = ...; if (!isEdge)
// continue; }`. São equivalentes hoje. Nada garantia que continuassem.
//
// ## O limite, que não existia em nenhuma das três
//
// Nenhuma cópia perguntava o tamanho antes de começar. Uma caixa de 200 de lado são oito milhões de
// células: a aba trava, sem erro e sem fim, e do lado de fora parece que o jogo morreu. É um pedido
// que a IA pode fazer sozinha, por engano de dígito, e o jogador não tem como cancelar.
//
// O corte é por número de células e não por lado, porque é o número de células que custa: uma caixa
// de 400×400×1 é tão cara quanto uma de 58³ e passaria por qualquer limite de aresta.

/**
 * Teto de células que uma caixa pode tocar de uma vez.
 *
 * 250 mil é grande o bastante para qualquer construção que alguém desenhe de propósito — uma casa
 * de 60×60×60 oca cabe — e pequeno o bastante para caber num quadro sem engasgo perceptível.
 */
export const MAX_CELULAS_DA_CAIXA = 250_000;

export interface LimitesDaCaixa {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

/** Normaliza dois cantos em limites ordenados, com as coordenadas em inteiros. */
export function limitesDaCaixa(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
): LimitesDaCaixa {
  const a = Math.floor(x1), b = Math.floor(x2);
  const c = Math.floor(y1), d = Math.floor(y2);
  const e = Math.floor(z1), f = Math.floor(z2);
  return {
    minX: Math.min(a, b), maxX: Math.max(a, b),
    minY: Math.min(c, d), maxY: Math.max(c, d),
    minZ: Math.min(e, f), maxZ: Math.max(e, f),
  };
}

/** Quantas células a caixa tem, cheia. É o volume, sem descontar o vazado. */
export function volumeDaCaixa(l: LimitesDaCaixa): number {
  return (l.maxX - l.minX + 1) * (l.maxY - l.minY + 1) * (l.maxZ - l.minZ + 1);
}

/**
 * Esta célula está na casca da caixa?
 *
 * ## Por que uma caixa achatada é toda casca
 *
 * Numa caixa de espessura 1 em algum eixo, `minY === maxY`, então **toda** célula satisfaz
 * `y === minY` e nada é descartado. É o comportamento certo e não é óbvio: sem ele, pedir uma laje
 * de um bloco de altura "oca" devolveria nada — um chão que some, com o argumento `hollow` como
 * única pista, três chamadas acima.
 */
export function naCascaDaCaixa(l: LimitesDaCaixa, x: number, y: number, z: number): boolean {
  return x === l.minX || x === l.maxX
    || y === l.minY || y === l.maxY
    || z === l.minZ || z === l.maxZ;
}

export interface ResultadoDaCaixa {
  /** Quantas células foram visitadas. */
  visitadas: number;
  /** A caixa foi cortada pelo limite? */
  truncada: boolean;
  /** O volume que teria sido percorrido sem o limite. */
  volumePedido: number;
}

/**
 * Percorre as células da caixa, chamando `visitar` em cada uma.
 *
 * O que fazer com a célula é do chamador — contar, salvar, registrar desfazer. Este módulo só
 * responde **quais** células a caixa tem, que é a parte que estava copiada.
 *
 * `visitar` pode devolver `false` para interromper; usado por quem tem orçamento próprio.
 */
export function percorrerCaixa(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  vazada: boolean,
  visitar: (x: number, y: number, z: number) => boolean | void,
): ResultadoDaCaixa {
  const l = limitesDaCaixa(x1, y1, z1, x2, y2, z2);
  const volumePedido = volumeDaCaixa(l);

  // A recusa é total, e não "faz o que couber". Uma caixa cortada pela metade deixa uma construção
  // incompleta que parece um defeito de geração, e quem pediu não tem como saber onde ela parou.
  if (volumePedido > MAX_CELULAS_DA_CAIXA) {
    return { visitadas: 0, truncada: true, volumePedido };
  }

  let visitadas = 0;
  for (let x = l.minX; x <= l.maxX; x++) {
    for (let y = l.minY; y <= l.maxY; y++) {
      for (let z = l.minZ; z <= l.maxZ; z++) {
        if (vazada && !naCascaDaCaixa(l, x, y, z)) continue;
        visitadas++;
        if (visitar(x, y, z) === false) return { visitadas, truncada: false, volumePedido };
      }
    }
  }
  return { visitadas, truncada: false, volumePedido };
}

/** A frase de recusa, para os três chamadores dizerem a mesma coisa. */
export function recusaDeCaixa(volumePedido: number): string {
  return `Caixa grande demais: ${volumePedido.toLocaleString('pt-BR')} blocos, e o limite é `
    + `${MAX_CELULAS_DA_CAIXA.toLocaleString('pt-BR')}. Divida em partes menores.`;
}
