// Em que escala o clima muda — e por que os biomas eram todos minúsculos.
//
// ## A medição que começou isto
//
// Varri quatro quilômetros em linha reta e medi o comprimento de cada trecho contíguo do mesmo
// bioma. A mediana deu **24 metros**. Um bioma de vinte e quatro metros não é um bioma — é uma
// mancha. O jogador atravessa seis deles num minuto, e nenhum tem tempo de significar nada:
// não dá para "estar no deserto" quando o deserto acaba em vinte passos.
//
// | bioma | trechos em 4 km | média |
// |---|---|---|
// | praia | 40 | 18 m |
// | tundra | 17 | 58 m |
// | oceano | 15 | 85 m |
// | floresta | 3 | 11 m |
//
// ## Por que eram tão pequenos, se o ruído de clima é de 700 metros
//
// A frequência do clima nunca foi o problema. Duas outras coisas eram:
//
//  1. **A temperatura era modulada pela ALTURA** — `temp -= max(0, h - 26) * 0.03`. A altura carrega
//     colinas de 50 metros e cordilheiras de 167, com até 17 metros de amplitude. Isso é meio ponto
//     de temperatura oscilando na escala do **relevo**, e não na do clima. O bioma passava a trocar
//     junto com o terreno.
//  2. **A umidade levava `+ river * 0.3`** — e rio é estreito. Cada travessia produzia uma faixa de
//     bioma diferente com a largura da margem.
//
// Ou seja: a classificação era refém de dois campos de alta frequência que não têm nada a ver com
// clima. Baixar a frequência do ruído de clima não resolveria — os dois continuariam mandando.
//
// ## As três escalas
//
// Clima de verdade tem hierarquia. Uma faixa continental decide se aquilo é frio ou quente por
// quilômetros; dentro dela, uma variação regional decide floresta ou planície; e dentro dessa, uma
// variação local dá textura sem trocar o bioma. É por isso que os pesos caem por ordem de grandeza:
// o continental **manda**, o resto tempera.
//
// É também o que atende os dois lados do pedido — biomas enormes e biomas pequenos — sem inventar
// um mecanismo para cada: o mesmo campo dá regiões de quilômetros e, onde duas escalas se somam na
// direção contrária, bolsões de dezenas de metros.

/** Frequência por METRO. O inverso é o tamanho da célula de ruído. */
export const ESCALA_CONTINENTAL = 0.00035; // ~2,9 km
export const ESCALA_REGIONAL = 0.0016;     // ~625 m
export const ESCALA_LOCAL = 0.0075;        // ~133 m

/**
 * Quanto cada escala pesa no clima final.
 *
 * O continental sozinho daria um mundo em faixas lisas, sem nenhuma surpresa dentro delas. O local
 * sozinho é o que havia antes. A soma é o que dá regiões grandes **com** variedade interna.
 */
export const PESO_CONTINENTAL = 1;
export const PESO_REGIONAL = 0.34;
export const PESO_LOCAL = 0.11;

/**
 * A partir de quantos metros a altitude começa a esfriar, e quanto.
 *
 * Era `max(0, h - 26) * 0.03`, com o mar em 46: **toda** a terra firme estava acima do limiar, então
 * o termo valia sempre e carregava junto todo o ruído de relevo. Agora ele só morde a partir do que
 * é de fato montanha, e com um terço da força — a montanha continua fria, e a colina de dois metros
 * deixa de decidir o bioma.
 */
export const ALTITUDE_QUE_ESFRIA_M = 58;
export const FRIO_POR_METRO = 0.011;

/**
 * Quanto um rio umedece a margem.
 *
 * Era 0,3 — o bastante para trocar o bioma na largura da margem, e o resultado era uma fita de
 * pântano acompanhando cada rio do mundo. Uma margem mais úmida é certa; uma margem que é outro
 * bioma não é.
 */
export const UMIDADE_DE_RIO = 0.12;

/** O que este módulo precisa de um gerador de ruído 2D. */
export interface RuidoDeClima {
  fbm(x: number, z: number, octaves?: number): number;
}

export interface Clima {
  temp: number;
  moist: number;
}

/**
 * O clima de um ponto, em três escalas.
 *
 * `alturaM` e `rio` entram aqui — e não depois — porque as duas correções que fazem o bioma parar
 * de piscar são exatamente sobre elas. Deixá-las do lado de fora manteria o defeito a uma linha de
 * distância de voltar.
 */
export function climaEm(
  nTemp: RuidoDeClima,
  nMoist: RuidoDeClima,
  x: number,
  z: number,
  alturaM: number,
  rio: number,
): Clima {
  const emTresEscalas = (n: RuidoDeClima, dx: number, dz: number) =>
    n.fbm((x + dx) * ESCALA_CONTINENTAL, (z + dz) * ESCALA_CONTINENTAL, 2) * PESO_CONTINENTAL
    + n.fbm((x + dx) * ESCALA_REGIONAL, (z + dz) * ESCALA_REGIONAL, 2) * PESO_REGIONAL
    + n.fbm((x + dx) * ESCALA_LOCAL, (z + dz) * ESCALA_LOCAL, 2) * PESO_LOCAL;

  // Normaliza para a mesma faixa de antes (-1..1), senão os limiares de bioma — que estão calibrados
  // para essa faixa — passariam a recusar tudo ou a aceitar tudo.
  const norma = PESO_CONTINENTAL + PESO_REGIONAL + PESO_LOCAL;

  const frio = Math.max(0, alturaM - ALTITUDE_QUE_ESFRIA_M) * FRIO_POR_METRO;

  return {
    temp: emTresEscalas(nTemp, 0, 0) / norma - frio,
    moist: emTresEscalas(nMoist, 311, -47) / norma + rio * UMIDADE_DE_RIO,
  };
}
