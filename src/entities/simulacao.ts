// Quem é simulado neste quadro — item 180.
//
// ## O custo que estava sempre ligado
//
// `EntitySystem.update` roda tudo para todo mundo, todo quadro, a qualquer distância: perseguição,
// rota A*, colisão com o mundo. E o ramo dos NPCs decorativos faz uma varredura de chão que desce da
// cabeça da entidade **até o y zero** procurando o primeiro bloco sólido — até cento e trinta
// consultas por entidade por quadro, para mover um boneco que ninguém está vendo.
//
// Nada disso falha. O jogo só fica mais lento à medida que o mundo se povoa, de forma proporcional
// a quantas criaturas existem e não a quantas importam.
//
// ## Congelar, e não simular devagar
//
// A alternativa seria simular os distantes em passos maiores. Não vale: um `dt` grande na colisão
// atravessa parede, e o A* com alvo velho manda a criatura para onde o jogador estava. Uma criatura
// parada a cem metros é indistinguível de uma criatura andando a cem metros; uma criatura dentro da
// pedra não é.
//
// ## A histerese, que aqui não é enfeite
//
// Sem ela, uma criatura exatamente na fronteira alterna entre simulada e congelada a cada quadro, e
// o resultado não é "meio simulada" — é um andar aos solavancos, visível justamente em quem está no
// limite do campo de visão. Duas soleiras transformam o limiar num estado.

/**
 * Dentro deste raio, em voxels, tudo roda.
 *
 * Maior que o alcance de percepção do mais atento dos mobs (`aggroRange`), senão uma criatura
 * congelaria a poucos passos de notar o jogador e ele passaria por ela sem nada acontecer.
 */
export const RAIO_DE_SIMULACAO = 80;
/** Acima deste raio, congela. A faixa entre os dois mantém o estado anterior. */
export const RAIO_DE_CONGELAMENTO = 96;

/**
 * Esta entidade deve ser simulada neste quadro?
 *
 * `jaSimulava` é o estado do quadro anterior — é ele que dá o efeito de histerese na faixa entre os
 * dois raios. Função pura e sem estado próprio: quem guarda é a entidade.
 *
 * `emCombate` vence tudo. Uma criatura que trocou golpes com o jogador há pouco não pode congelar,
 * por mais longe que o cálculo a coloque: o caso real é o jogador recuando depressa de uma luta,
 * e uma criatura congelada no meio do golpe é um inimigo que some.
 */
export function deveSimular(
  distancia2: number,
  jaSimulava: boolean,
  emCombate = false,
): boolean {
  if (emCombate) return true;
  if (distancia2 <= RAIO_DE_SIMULACAO * RAIO_DE_SIMULACAO) return true;
  if (distancia2 > RAIO_DE_CONGELAMENTO * RAIO_DE_CONGELAMENTO) return false;
  return jaSimulava;
}

/** Distância ao quadrado, nos três eixos. Sem raiz: só serve para comparar. */
export function distancia2(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}
