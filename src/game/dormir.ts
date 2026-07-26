// Dormir até o amanhecer — item 1339.
//
// ## Por que a cama sozinha não bastava
//
// A cama definia onde renascer, e nada mais. Isso é metade do que uma cama significa no gênero, e
// era a metade menos interessante: o jogador que fez tudo certo — casa fechada, tocha acesa, cama
// no canto — ainda tinha que **esperar a noite passar olhando para a parede**. Sete minutos e meio
// de relógio real, sem nada para fazer, como recompensa por ter se preparado bem.
//
// É também o que faltava para o item 009 ter consequência. A noite só é um evento de tensão se
// houver uma alternativa a atravessá-la; sem dormir, ela não é tensão, é intervalo.
//
// ## As quatro recusas, e o que cada uma protege
//
// Elas ficam aqui, num módulo puro, porque cada uma é uma regra de jogo com uma razão — não uma
// guarda defensiva. Enterradas num `if` composto dentro do laço principal, seriam indistinguíveis
// umas das outras e a primeira a ser "simplificada" levaria a razão junto.

export interface EstadoParaDormir {
  ehNoite: boolean;
  abrigado: boolean;
  /** Este cliente é a autoridade do relógio do mundo (anfitrião ou partida local). */
  souORelogio: boolean;
  jaDormindo: boolean;
}

/**
 * Por que este jogador **não** pode dormir agora, ou `null` se pode.
 *
 * Devolve a frase pronta, e não um código de erro, porque a recusa só serve se explicar. "Não é
 * possível dormir" manda o jogador adivinhar entre quatro motivos diferentes, e o mais provável é
 * ele concluir que a cama está quebrada.
 */
export function porQueNaoPodeDormir(e: EstadoParaDormir): string | null {
  if (e.jaDormindo) return 'Você já está dormindo.';

  // Dormir de dia adiantaria o relógio um dia inteiro para pular... o dia. O jogador perderia as
  // horas de luz, que são justamente quando dá para explorar a superfície em segurança.
  if (!e.ehNoite) return 'Só dá para dormir de noite.';

  // A céu aberto a cama viraria um botão de pular a noite, e a noite é metade do jogo: o perigo, o
  // motivo de construir, o motivo de fazer tochas. Exigir abrigo é o que faz dormir ser a
  // recompensa por ter se preparado, em vez de a maneira de não precisar se preparar.
  if (!e.abrigado) return 'É perigoso dormir a céu aberto — feche um espaço primeiro.';

  // O relógio do mundo é do anfitrião. Um convidado adiantando o próprio relógio veria um
  // amanhecer que não aconteceu para mais ninguém, e a correção seguinte o puxaria de volta para a
  // noite — o sol subiria e desceria na cara dele.
  if (!e.souORelogio) return 'Só o anfitrião pode adiantar o relógio deste mundo.';

  return null;
}

/**
 * Quantas vezes mais rápido o relógio corre enquanto se dorme.
 *
 * Não é um salto instantâneo de propósito. A luz do céu está assada na cor dos vértices, e o mundo
 * é re-meshado quando `sunScale` cruza o limiar; um salto faria isso acontecer de uma vez, com o
 * sol pulando no céu e um engasgo visível. Correndo rápido, a passagem acontece nos mesmos degraus
 * de sempre, só depressa.
 *
 * 90× leva a noite inteira (cerca de 40% do dia, ~6 minutos de relógio real) em uns 4 segundos —
 * tempo de ler "Dormindo até o amanhecer" e ver o céu clarear, sem virar espera.
 */
export const RITMO_DORMINDO = 90;

/**
 * Já é hora de acordar?
 *
 * A comparação é pela **fase**, e não por um valor de `timeOfDay`: a fase é a mesma noção que o
 * resto do jogo usa para decidir o que é noite, e um número solto aqui poderia sair de sincronia
 * com ela sem que nada apontasse a discordância.
 */
export function deveAcordar(fase: string): boolean {
  return fase !== 'noite';
}
