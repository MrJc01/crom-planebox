// Regras de névoa que não dependem do renderizador — itens 1091 e 1092.
//
// São duas perguntas que o `scene.ts` fazia de improviso e que agora moram juntas, porque as duas
// decidem a mesma coisa: **onde o mundo termina, e se dá para ver que ele termina.**
//
// Ficam fora do Three.js pelo motivo de sempre nesta casa: código de render que roda e nunca é
// conferido é o modo de falha mais comum aqui. Uma cor e um multiplicador são verificáveis sem
// WebGL; o que sobra no `scene.ts` é atribuição.

import { NIVEL_DO_MAR_M } from '../world/worldgen';

/**
 * Multiplicador do alcance da névoa pela altitude — item 1092.
 *
 * ## Por que o vale tem neblina e o pico não
 *
 * O ar frio e úmido assenta no fundo dos vales; o pico fica acima dele. É a razão pela qual uma
 * montanha vista de cima aparece inteira e a mesma montanha vista do vale some a duzentos metros.
 *
 * No jogo isso faz um trabalho que nenhum outro sistema faz: **dá recompensa a subir**. Sem ele, o
 * pico de uma montanha oferece a mesma visão que a planície ao lado, e a escalada não paga nada
 * além da altura no F3.
 *
 * ## Por que é medido do nível do mar, e não da superfície local
 *
 * O oposto da camada vertical, que é medida da superfície de propósito. Aqui a pergunta é
 * "quão alto estou no mundo", e a resposta tem de ser a mesma para dois jogadores na mesma cota —
 * senão quem cava um poço no pico teria "neblina de vale" no topo da montanha.
 */
export const ALTITUDE_MAIS_LIMPA_M = NIVEL_DO_MAR_M + 26;
/** Quanto a névoa fecha no fundo de um vale. */
export const NEBLINA_DE_VALE = 0.72;
/** Quanto ela abre no alto. Acima de 1 porque o pico enxerga mais longe que a média. */
export const NEBLINA_DE_PICO = 1.12;

export function neblinaDeAltitude(alturaM: number): number {
  // Abaixo do mar não fecha mais: o fundo do vale já é o mais denso que existe, e continuar
  // fechando deixaria quem nada numa fossa sem enxergar a própria mão — sem que nada avisasse.
  const t = Math.max(0, Math.min(1, (alturaM - NIVEL_DO_MAR_M) / (ALTITUDE_MAIS_LIMPA_M - NIVEL_DO_MAR_M)));
  // Suavização cúbica: a mudança precisa ser imperceptível a cada passo e evidente ao fim da
  // subida. Linear denuncia a rampa quando se sobe uma escada.
  const s = t * t * (3 - 2 * t);
  return NEBLINA_DE_VALE + (NEBLINA_DE_PICO - NEBLINA_DE_VALE) * s;
}

/**
 * Quanto a cor do céu junto ao horizonte se aproxima da cor da névoa — item 1091.
 *
 * ## O defeito
 *
 * O céu era uma cor chapada e a névoa era essa mesma cor **tingida pelo bioma** na proporção da luz
 * do dia. De dia, num deserto, o terreno sumia numa cor areia e o céu logo acima era azul: o mundo
 * terminava numa linha reta, visível, na altura do horizonte. À noite os dois coincidiam por acaso,
 * porque o tingimento zera — que é o motivo de isto nunca ter aparecido em nenhum teste.
 *
 * ## Por que a mistura vai a 1 e não a algo menor
 *
 * No horizonte a névoa **é** o que se vê: não há terreno atrás dela, só ar. Qualquer valor abaixo
 * de 1 deixa uma diferença residual, e uma diferença residual entre duas superfícies grandes e lisas
 * é justamente o que o olho detecta melhor. A borda tem de desaparecer, não ficar sutil.
 *
 * ## Esta função existe duas vezes, e isso é assumido
 *
 * O que roda é o GLSL da cúpula em `sky.ts`; esta é a mesma conta em TypeScript, e serve para poder
 * ser verificada — nenhum teste aqui compila shader. Duas cópias de uma regra divergem, então o
 * número que governa a faixa mora **só aqui** e o shader o recebe por uniform. O formato pode
 * divergir em silêncio; a faixa, que é o que decide se o efeito aparece, não pode.
 */
export const ALCANCE_DO_HORIZONTE = 0.22;

export function misturaDoHorizonte(alturaNoCeu: number): number {
  // `alturaNoCeu` é o y normalizado da direção do olhar: 0 no horizonte, 1 no zênite.
  const t = Math.max(0, Math.min(1, alturaNoCeu));
  // A névoa domina o primeiro quinto do céu e some no resto. Uma rampa que fosse até o zênite
  // pintaria o céu inteiro da cor do bioma, e o deserto ganharia um céu cor de areia — trocando
  // uma borda visível por um erro maior.
  if (t >= ALCANCE_DO_HORIZONTE) return 0;
  const u = 1 - t / ALCANCE_DO_HORIZONTE;
  return u * u; // volta a zero suavemente, sem um segundo degrau onde a mistura acaba
}
