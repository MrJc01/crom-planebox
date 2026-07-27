// Quanto tempo um item largado dura no chão — item 1330.
//
// ## O que estava errado
//
// `DroppedItem` já contava `age` e ninguém lia. Os itens ficavam no chão para sempre: minerar uma
// veia e não recolher tudo deixava cubos girando naquele ponto pelo resto da partida, e um mundo
// jogado por algumas horas acumula centenas deles — cada um com uma malha, um material e um teste
// de distância por quadro.
//
// E o pior caso não é o desempenho. Quem morre duas vezes no mesmo lugar fica com **duas pilhas
// indistinguíveis**, sem saber qual é a de agora, sem saber se alguma vai sumir, e sem nada no jogo
// que responda a nenhuma das duas perguntas.
//
// ## Por que o que caiu na morte dura muito mais
//
// Perder o inventário é a punição; perdê-lo por não ter conseguido voltar a tempo é outra punição
// em cima, e essa o jogador não escolheu. A morte costuma acontecer longe, com o caminho de volta
// atravessando o que matou — o tempo tem de dar para uma segunda tentativa depois de uma primeira
// que deu errado.
//
// Mas **expira também**, e isso é deliberado: um item que nunca some transforma cada morte num
// marco permanente no mundo, e o jogador acaba com um cemitério de pilhas que ele não pode limpar.
//
// ## Por que piscar antes, e não só sumir
//
// Sumir sem aviso é indistinguível de um bug — o jogador larga algo, se afasta, volta e não está
// mais lá. A piscada é a única coisa que transforma "sumiu" em "estava acabando e eu vi".

export type OrigemDoItem = 'comum' | 'morte';

/** Vida de um item largado ao quebrar um bloco ou soltar do inventário. */
export const VIDA_COMUM_S = 300;
/** Vida do que caiu na morte. Cinco vezes maior — o caminho de volta costuma dar errado uma vez. */
export const VIDA_DE_MORTE_S = 1500;

/**
 * Segundos de aviso antes de sumir.
 *
 * Longo o bastante para ser visto por quem está por perto e ainda dar tempo de correr até lá: uma
 * piscada de dois segundos avisaria e não serviria para nada, que é a pior combinação possível.
 */
export const AVISO_S = 30;

/** Piscadas por segundo durante o aviso. */
const RITMO_DA_PISCADA = 3;

export function vidaDe(origem: OrigemDoItem): number {
  return origem === 'morte' ? VIDA_DE_MORTE_S : VIDA_COMUM_S;
}

export interface EstadoDoItem {
  /** Já passou da vida — o chamador deve removê-lo. */
  expirado: boolean;
  /** Está na janela de aviso. */
  avisando: boolean;
  /** Opacidade a aplicar, 0..1. Fora do aviso é sempre 1. */
  opacidade: number;
}

/**
 * O estado visual de um item com esta idade.
 *
 * Função pura do tempo, sem estado guardado: dois itens da mesma idade piscam **em fase**, e isso é
 * intencional. Uma pilha de itens caídos juntos piscando cada um por conta própria vira cintilação
 * aleatória, que lê como falha de renderização e não como aviso.
 */
export function estadoDoItem(idade: number, origem: OrigemDoItem = 'comum'): EstadoDoItem {
  const vida = vidaDe(origem);
  if (idade >= vida) return { expirado: true, avisando: false, opacidade: 0 };

  const restante = vida - idade;
  if (restante > AVISO_S) return { expirado: false, avisando: false, opacidade: 1 };

  // A piscada acelera conforme o fim se aproxima: no começo do aviso é um pulso lento e no fim é
  // urgente. Um ritmo constante diz "isto vai sumir"; um ritmo que acelera diz *quando*.
  //
  // A fase é a **integral** da frequência ao longo do aviso, e não o tempo multiplicado por ela.
  // A primeira versão fez a multiplicação — `idade * R * (1 + urgencia * 2)` — e o teste de
  // aceleração reprovou: com `idade` na casa das centenas, a derivada é dominada pelo termo
  // `idade * dR/dt` e a piscada sai rapidíssima do começo ao fim, sem acelerar coisa nenhuma. Um
  // efeito que existe, roda, e faz o oposto do que o comentário promete.
  //
  // Contado a partir do início do aviso, `f(e) = R * (1 + 2e/AVISO)` integra em `R * (e + e²/AVISO)`.
  const decorrido = AVISO_S - restante;
  const fase = RITMO_DA_PISCADA * (decorrido + (decorrido * decorrido) / AVISO_S);
  // Nunca chega a zero: um item invisível por meio quadro é indistinguível de um item que já sumiu,
  // e o jogador pararia de procurá-lo cedo demais.
  const opacidade = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(fase * Math.PI * 2));

  return { expirado: false, avisando: true, opacidade };
}
