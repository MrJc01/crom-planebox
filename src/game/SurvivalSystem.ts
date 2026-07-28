// Sistema padrão de sobrevivência (Modo 2): vida, fome, dano de queda e afogamento.
// Só fica ativo quando GameModeManager.rules.hasSurvival é verdadeiro.
import { PlayerController } from '../player/controller';
import { B } from '../world/blocks';

/**
 * Quanto de fome cada item restaura. A fome só existia para drenar e matar; sem nada comestível
 * o Modo Sobrevivência era um cronômetro de morte, não um ciclo.
 */
export const FOOD_VALUE: Record<number, number> = {
  [B.LEAVES]: 6,        // folhagem crua: pouco, mas sempre disponível
  [B.PINE_LEAVES]: 6,
  [B.TALL_GRASS]: 4,
  [B.REED]: 10,
  [B.FLOWER_RED]: 8,
  [B.FLOWER_YELLOW]: 8,
};

export function foodValueOf(blockType: number): number {
  return FOOD_VALUE[blockType] ?? 0;
}

export function isEdible(blockType: number): boolean {
  return foodValueOf(blockType) > 0;
}

const FALL_DAMAGE_THRESHOLD = 22; // vel.y de impacto abaixo disso não causa dano (~1 bloco de queda)
const FALL_DAMAGE_SCALE = 1.6;    // dano por unidade de velocidade de impacto acima do limiar
const HUNGER_DECAY_PER_SEC = 100 / (60 * 12); // fome zera em ~12 minutos
const STARVE_DAMAGE_PER_SEC = 100 / 30;        // com fome zerada, morre em ~30s
const REGEN_PER_SEC = 100 / 20;                // com fome > 50%, regenera vida em ~20s
const DROWN_DAMAGE_PER_SEC = 100 / 8;          // afogando, morre em ~8s sem ar
/**
 * Reserva de ar, em segundos — item 126.
 *
 * Eram 3 segundos cravados dentro do `update`, sem nada na tela: o jogador mergulhava, e o dano
 * simplesmente começava. Sem indicador, "quanto tempo eu ainda tenho" não tinha resposta, e a única
 * forma de aprender o limite era morrer nele.
 *
 * Doze segundos porque a barra precisa de casas para esvaziar de forma legível. Com três, cada
 * bolha vale 0,3 s e a barra pula de cheia a vazia sem passar pelo meio — que é exatamente a
 * informação que ela existe para dar.
 */
export const RESERVA_DE_AR_S = 12;
/**
 * Segundos para reencher a reserva inteira fora d'água.
 *
 * Mais rápido que gastar, e de propósito: subir para respirar tem de ser uma pausa curta, senão
 * atravessar um lago vira uma sequência de esperas. O que custa é a descida, não a respirada.
 */
export const RECUPERACAO_DE_AR_S = 3.5;
const LAVA_DAMAGE_PER_SEC = 100 / 3;           // contato com lava, morre em ~3s
const BURN_DURATION = 6;                       // segundos de queimadura ao sair da lava
const BURN_DAMAGE_PER_SEC = 100 / 14;          // queimando, morre em ~14s se não apagar o fogo

export class SurvivalSystem {
  public health = 100;
  public maxHealth = 100;
  public hunger = 100;
  public maxHunger = 100;
  public alive = true;

  /**
   * Ar restante, de 0 a 1 — item 126.
   *
   * Público e legível porque a HUD o desenha. Era um `airTime` privado que só existia para comparar
   * com 3 e ninguém podia mostrar.
   */
  public ar = 1;
  private wasOnGround = true;
  /** Segundos restantes de queimadura. Sair da lava não apaga o fogo — só a água apaga. */
  public burnTime = 0;

  public onDamage: (amount: number, cause: string) => void = () => {};
  public onDeath: (cause: string) => void = () => {};
  public onChanged: () => void = () => {};

  constructor(private player: PlayerController) {}

  public reset(): void {
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.alive = true;
    this.ar = 1;
    this.wasOnGround = true;
    this.burnTime = 0;
    this.onChanged();
  }

  public armorPoints = 0;
  public currentBiomeTemperature?: number;
  public isSheltered = false;

  public applyDamage(amount: number, cause: string): void {
    if (!this.alive || amount <= 0) return;

    let finalDamage = amount;
    if (this.armorPoints > 0 && cause !== 'fome' && cause !== 'afogamento') {
      const reduction = Math.min(0.8, this.armorPoints * 0.04);
      finalDamage = Math.max(1, amount * (1 - reduction));
    }

    this.health = Math.max(0, this.health - finalDamage);
    this.onDamage(finalDamage, cause);
    this.onChanged();
    if (this.health <= 0) {
      this.alive = false;
      this.onDeath(cause);
    }
  }

  public update(dt: number): void {
    if (!this.alive) return;

    // Dano de queda: detecta transição no-chão ao aterrissar com velocidade de impacto alta.
    if (this.player.onGround && !this.wasOnGround) {
      const impact = -this.player.lastImpactVelY; // positivo = quão forte caiu
      if (impact > FALL_DAMAGE_THRESHOLD) {
        this.applyDamage((impact - FALL_DAMAGE_THRESHOLD) * FALL_DAMAGE_SCALE * 0.1, 'queda');
      }
    }
    this.wasOnGround = this.player.onGround;

    // Afogamento com reserva visível — item 126.
    //
    // O dano só começa quando o ar acaba, e a barra some sozinha ao encher: um indicador que fica
    // permanentemente na tela vira ruído, e um que aparece **por causa de alguma coisa** é lido.
    if (this.player.headUnder) {
      const antes = this.ar;
      this.ar = Math.max(0, this.ar - dt / RESERVA_DE_AR_S);
      if (antes !== this.ar) this.onChanged();
      if (this.ar <= 0) this.applyDamage(DROWN_DAMAGE_PER_SEC * dt, 'afogamento');
    } else if (this.ar < 1) {
      this.ar = Math.min(1, this.ar + dt / RECUPERACAO_DE_AR_S);
      this.onChanged();
    }

    // Lava: dano contínuo e imediato ao contato, sem tolerância, e o jogador pega fogo.
    if (this.player.inLava) {
      this.applyDamage(LAVA_DAMAGE_PER_SEC * dt, 'lava');
      this.burnTime = BURN_DURATION;
    }

    // Queimadura: continua depois de sair da lava. Entrar na água apaga na hora — é o que
    // transforma "pular fora da lava" numa fuga incompleta e dá função ao lago mais próximo.
    if (this.burnTime > 0) {
      if (this.player.inWater || this.player.headUnder) {
        this.burnTime = 0;
      } else {
        this.burnTime = Math.max(0, this.burnTime - dt);
        if (!this.player.inLava) this.applyDamage(BURN_DAMAGE_PER_SEC * dt, 'queimadura');
      }
    }

    // Fome decai com o tempo (correr acelera o consumo 2.5x) — item 226.
    const hungerMult = (this.player as any).isSprinting ? 2.5 : 1.0;
    this.hunger = Math.max(0, this.hunger - HUNGER_DECAY_PER_SEC * dt * hungerMult);
    if (this.hunger <= 0) {
      this.applyDamage(STARVE_DAMAGE_PER_SEC * dt, 'fome');
    } else if (this.hunger > 50 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + REGEN_PER_SEC * dt);
      this.onChanged();
    }

    // Temperatura por bioma e exposição ao clima — item 128.
    if (this.currentBiomeTemperature !== undefined && !this.isSheltered) {
      if (this.currentBiomeTemperature < 0.1 && this.armorPoints < 4) {
        this.applyDamage(1.5 * dt, 'congelamento');
      } else if (this.currentBiomeTemperature > 0.95 && this.armorPoints < 2) {
        this.applyDamage(1.0 * dt, 'calor');
      }
    }

    // Morte ao cair no vão inferior (void/abismo) — item 1651
    if (this.player?.pos?.y !== undefined && this.player.pos.y < -20) {
      this.applyDamage(1000, 'abismo');
    }
  }

  /**
   * O corpo atravessa um período de descanso — dormir (item 1347).
   *
   * ## O buraco que isto fecha
   *
   * Dormir corre o **relógio do mundo** a 90×, mas `update(dt)` continua recebendo o `dt` real. A
   * consequência é que uma noite inteira — cerca de seis minutos de jogo — passava para o mundo e
   * **quatro segundos** para o corpo. Metade da barra de fome deixava de ser cobrada, e dormir
   * virava a maneira mais eficiente de não comer.
   *
   * Não falharia em lugar nenhum: a fome simplesmente decairia mais devagar para quem dorme, e a
   * explicação estaria a três arquivos de distância do sintoma.
   *
   * ## Por que descansar custa MENOS que ficar acordado
   *
   * `FATOR_DE_REPOUSO` cobra metade da fome do período. Um corpo parado gasta menos que um corpo
   * cavando, e isso é o que dá à cama uma vantagem real além do tempo — sem ela, dormir seria
   * neutro e o jogador continuaria preferindo minerar a noite toda.
   *
   * ## Por que a vida volta inteira
   *
   * A regeneração normal leva ~20 s com fome acima de 50%, e a noite tem seis minutos. Simular
   * segundo a segundo daria o mesmo resultado por um caminho mais longo e mais fácil de errar; a
   * condição de fome é conferida **depois** do gasto, para uma noite que zera a barra não curar.
   */
  public descansar(segundos: number): void {
    if (segundos <= 0) return;
    const FATOR_DE_REPOUSO = 0.5;
    this.hunger = Math.max(0, this.hunger - HUNGER_DECAY_PER_SEC * segundos * FATOR_DE_REPOUSO);
    if (this.hunger > 50) this.health = this.maxHealth;
    else if (this.hunger <= 0) this.applyDamage(STARVE_DAMAGE_PER_SEC * Math.min(segundos, 10), 'fome');
    this.onChanged();
  }

  /** Consumir um item de comida restaura fome (chamado pela hotbar/inventário de sobrevivência). */
  public eat(amount: number): void {
    this.hunger = Math.min(this.maxHunger, this.hunger + amount);
    this.onChanged();
  }
}
