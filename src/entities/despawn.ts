// Quando uma criatura deixa de existir — item 1321.
//
// ## O buraco
//
// A regra de abrigo valia para o **berço** e não para quem já estava dentro. `isSpawnable` recusa o
// interior da casa, e é só isso: quem fecha a porta com um zumbi dentro fica com ele lá para
// sempre. O jogador constrói exatamente para se proteger e a construção não o protege do caso mais
// óbvio de todos — e, pior, não há como saber que aquilo é permanente.
//
// Não havia despawn nenhum, aliás. Nem por abrigo, nem por distância: uma criatura só saía do mundo
// morrendo ou ao recarregar. Quem gerasse hostis num canto do mundo e atravessasse para outro
// levava o teto de hostis consigo, ocupado por criaturas a quatrocentos metros que nunca mais
// veria — e o teto ocupado significa que **nada nasce perto**. O sintoma é o mundo ficar
// inexplicavelmente vazio depois de uma hora de jogo.
//
// ## Por que sumir, e não empurrar para fora
//
// "Expulsar" no sentido literal exigiria achar uma saída, e o caso interessante é justamente o de
// não haver saída — a casa está fechada, é para isso que ela existe. Teleportar para fora seria
// visível e arbitrário. Sumir é o que os jogos deste gênero fazem, e o que o jogador lê como "a
// noite passou e ele foi embora".
//
// ## Por que uma espera, e não sumir no quadro em que a condição vale
//
// Uma criatura que evapora na frente do jogador é pior que uma criatura presa: uma é um incômodo, a
// outra denuncia que o mundo é uma simulação frouxa. A espera contínua resolve os dois lados — e é
// contínua de propósito: sair do abrigo por um instante e voltar **reinicia** a conta, senão bastaria
// o mob atravessar a soleira uma vez para ficar marcado para sempre.

import { MobKind } from './Combat';

/** Segundos que a condição precisa valer **sem interrupção** para a criatura sumir. */
export const ESPERA_NO_ABRIGO_S = 8;
export const ESPERA_LONGE_S = 12;

/**
 * Distância, em mini-voxels, além da qual a criatura deixa de importar.
 *
 * `MAX_SPAWN_DISTANCE` são 64. O dobro dá folga para o jogador andar em volta sem que as criaturas
 * que ele acabou de ver comecem a sumir atrás dele — que seria visível e seria pior que o problema.
 */
export const DISTANCIA_DE_ESQUECIMENTO = 128;

/**
 * Uma criatura que interagiu com o jogador há pouco não some, aconteça o que acontecer.
 *
 * É a regra que impede o caso constrangedor: o jogador está apanhando de um zumbi, recua para
 * dentro de casa, e o zumbi que o está mordendo desaparece. Isso não lê como abrigo — lê como o
 * jogo desistindo da luta no meio.
 */
export const CARENCIA_APOS_COMBATE_S = 10;

export type MotivoDeDespawn = 'preso-no-abrigo' | 'longe-demais';

export interface CriaturaObservada {
  id: string;
  kind?: MobKind;
  x: number;
  y: number;
  z: number;
  /** Segundos desde o último golpe dado ou levado. `Infinity` = nunca lutou. */
  desdeOCombate: number;
}

export interface ContextoDeDespawn {
  jogador: { x: number; y: number; z: number };
  /** A célula está dentro do abrigo do jogador? Ausente = ninguém está abrigado. */
  dentroDoAbrigo?: (x: number, y: number, z: number) => boolean;
}

/**
 * Por que esta criatura deveria sumir **agora**, ou `null`.
 *
 * Função pura e sem relógio: quem acumula o tempo é `RelogioDeDespawn`. Separar os dois é o que
 * permite testar a regra sem simular quadros e o relógio sem conhecer as regras.
 */
export function motivoDeDespawn(
  c: CriaturaObservada,
  ctx: ContextoDeDespawn,
): MotivoDeDespawn | null {
  // A carência vem primeiro e vence tudo. Ver `CARENCIA_APOS_COMBATE_S`.
  if (c.desdeOCombate < CARENCIA_APOS_COMBATE_S) return null;

  if (ctx.dentroDoAbrigo?.(Math.floor(c.x), Math.floor(c.y), Math.floor(c.z))) {
    return 'preso-no-abrigo';
  }

  const dx = c.x - ctx.jogador.x;
  const dy = c.y - ctx.jogador.y;
  const dz = c.z - ctx.jogador.z;
  if (dx * dx + dy * dy + dz * dz > DISTANCIA_DE_ESQUECIMENTO * DISTANCIA_DE_ESQUECIMENTO) {
    return 'longe-demais';
  }

  return null;
}

function esperaDe(motivo: MotivoDeDespawn): number {
  return motivo === 'preso-no-abrigo' ? ESPERA_NO_ABRIGO_S : ESPERA_LONGE_S;
}

/**
 * Acumula, por criatura, há quanto tempo o motivo vale sem interrupção.
 *
 * ## Por que o motivo faz parte do estado
 *
 * Uma criatura pode passar de "presa no abrigo" para "longe demais" sem nunca deixar de ter algum
 * motivo. Somar os dois tempos misturaria duas contas com esperas diferentes; guardar o motivo faz
 * a troca reiniciar, que é o comportamento correto — são condições distintas, e cada uma merece a
 * sua espera inteira.
 */
export class RelogioDeDespawn {
  private acumulado = new Map<string, { motivo: MotivoDeDespawn; tempo: number }>();

  /**
   * Avança um quadro e devolve quem deve sumir.
   *
   * `dt` é limitado pelo mesmo motivo de sempre: voltar de uma aba em segundo plano entrega
   * dezenas de segundos de uma vez, e sem limite todas as criaturas elegíveis sumiriam no instante
   * em que a janela retoma — de uma vez, na frente do jogador.
   */
  public avancar(
    criaturas: CriaturaObservada[],
    ctx: ContextoDeDespawn,
    dt: number,
  ): { id: string; motivo: MotivoDeDespawn }[] {
    const passo = Math.min(Math.max(dt, 0), 0.25);
    const saindo: { id: string; motivo: MotivoDeDespawn }[] = [];
    const vistos = new Set<string>();

    for (const c of criaturas) {
      vistos.add(c.id);
      const motivo = motivoDeDespawn(c, ctx);
      if (!motivo) {
        this.acumulado.delete(c.id);
        continue;
      }

      const anterior = this.acumulado.get(c.id);
      const tempo = anterior && anterior.motivo === motivo ? anterior.tempo + passo : passo;

      if (tempo >= esperaDe(motivo)) {
        this.acumulado.delete(c.id);
        saindo.push({ id: c.id, motivo });
      } else {
        this.acumulado.set(c.id, { motivo, tempo });
      }
    }

    // Quem morreu ou já saiu não deve deixar entrada para trás: o mapa cresceria pelo tempo de
    // sessão inteiro, e um id reaproveitado herdaria a conta de outra criatura.
    for (const id of [...this.acumulado.keys()]) if (!vistos.has(id)) this.acumulado.delete(id);

    return saindo;
  }

  /** Quanto tempo esta criatura já acumulou. Existe para o teste e para depuração. */
  public tempoDe(id: string): number {
    return this.acumulado.get(id)?.tempo ?? 0;
  }

  public limpar(): void {
    this.acumulado.clear();
  }
}
