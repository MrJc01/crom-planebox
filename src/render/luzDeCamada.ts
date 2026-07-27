// As luzes da cena em função da profundidade — item 1437.
//
// ## O defeito que apareceu junto
//
// `luzMinima` estava declarado nas camadas e ninguém lia. Ao ir ligá-lo apareceu algo pior: as três
// luzes da cena (direcional, hemisférica e ambiente) são **globais** e seguiam só o `sunScale`.
// Debaixo de quarenta metros de rocha o sol continuava mandando: uma caverna profunda era **duas
// vezes mais clara ao meio-dia que à meia-noite**.
//
// A luz por voxel do `lighting.ts` estava certa — a caverna tem `sky = 0` e o multiplicador de cor
// desaba para o piso. O que não estava certo era o que esse piso multiplica. Nada errava; a caverna
// só respirava junto com um sol que não a alcança.
//
// ## Por que isto é global, e o que se paga por isso
//
// A profundidade é a do **jogador**, não a de cada fragmento. Quem está a dez metros olhando pela
// boca de um túnel vê a superfície lá fora com a luz do subsolo. É o mesmo compromisso que a névoa
// de bioma já assume no `setBiomeAmbience`, pela mesma razão: a alternativa é uma profundidade por
// fragmento, e ninguém sabe a altura do terreno dentro do shader sem uma textura de alturas que
// hoje não existe.
//
// Por isso o sol e a hemisférica **não** são zerados, só atenuados: apagá-los deixaria a paisagem
// vista pela boca da caverna chapada e preta, que é um erro maior do que o que se está corrigindo.
//
// ## Por que este módulo não importa Three.js
//
// São quatro números entrando e três saindo. Deixá-los aqui torna a regra verificável sem WebGL —
// e o histórico deste repositório é justamente o de código de render que roda e nunca é conferido.

/** Intensidades das três luzes da cena. */
export interface LuzesDaCena {
  sol: number;
  hemisferica: number;
  ambiente: number;
}

/**
 * Converte o piso de luz de uma camada (0..1) em intensidade de luz ambiente do Three.js.
 *
 * As camadas declaram 0,06 no subsolo, 0,04 na caverna e 0,03 no abismo. A luz ambiente da
 * superfície vai de 0,26 (noite fechada) a 0,60 (meio-dia). Com fator 5 o subsolo cai em 0,30 —
 * pouco acima de uma noite —, a caverna em 0,20 e o abismo em 0,15.
 *
 * O espaçamento importa mais que os valores absolutos: é ele que faz descer do subsolo para o
 * abismo ser perceptível sem tocha, que é o ponto inteiro do item 495.
 */
export const AMBIENTE_POR_PISO = 5;

/** Quanto o direcional e a hemisférica sobram no fundo. Ver o cabeçalho: zerar seria pior. */
const SOBRA_DO_SOL = 0.35;
const SOBRA_DA_HEMISFERICA = 0.2;

/**
 * As três intensidades para um quadro.
 *
 * - `sunScale`: intensidade do dia, 1 ao meio-dia e ~0,12 de madrugada.
 * - `pisoDaCamada`: o `luzMinima` já interpolado por `ambienteDaProfundidade`.
 * - `dentroDaTerra`: 0 na superfície, 1 a partir do começo do subsolo.
 * - `clarao`: relâmpago, 0..1. Some por cima de tudo, inclusive no subsolo — um raio ilumina a boca
 *   da caverna, e o jogador que está logo dentro dela precisa ver isso acontecer.
 */
export function luzesEm(
  sunScale: number,
  pisoDaCamada: number,
  dentroDaTerra: number,
  clarao: number,
): LuzesDaCena {
  const terra = Math.max(0, Math.min(1, dentroDaTerra));
  const diurno = 0.26 + 0.34 * sunScale;

  // `min` com o diurno: a camada é um **piso**, e um piso nunca clareia. Sem isso, o piso da
  // superfície (0,12 → 0,60) ficaria acima do ambiente de uma noite fechada (0,30), e descer à
  // meia-noite *acenderia* o mundo até os seis metros antes de escurecer. É a mesma armadilha do
  // "teto que satura" de sempre, invertida: um limite que nunca morde não avisa que existe.
  const daCamada = Math.min(pisoDaCamada * AMBIENTE_POR_PISO, diurno);

  return {
    sol: 1.75 * sunScale * (1 - terra * (1 - SOBRA_DO_SOL)) + clarao * 3.4,
    hemisferica: 0.9 * Math.max(0.3, sunScale) * (1 - terra * (1 - SOBRA_DA_HEMISFERICA)) + clarao * 2.2,
    ambiente: diurno + (daCamada - diurno) * terra + clarao * 1.2,
  };
}
