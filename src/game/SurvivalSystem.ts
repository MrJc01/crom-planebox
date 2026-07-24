// Sistema padrão de sobrevivência (Modo 2): vida, fome, dano de queda e afogamento.
// Só fica ativo quando GameModeManager.rules.hasSurvival é verdadeiro.
import { PlayerController } from '../player/controller';

const FALL_DAMAGE_THRESHOLD = 22; // vel.y de impacto abaixo disso não causa dano (~1 bloco de queda)
const FALL_DAMAGE_SCALE = 1.6;    // dano por unidade de velocidade de impacto acima do limiar
const HUNGER_DECAY_PER_SEC = 100 / (60 * 12); // fome zera em ~12 minutos
const STARVE_DAMAGE_PER_SEC = 100 / 30;        // com fome zerada, morre em ~30s
const REGEN_PER_SEC = 100 / 20;                // com fome > 50%, regenera vida em ~20s
const DROWN_DAMAGE_PER_SEC = 100 / 8;          // afogando, morre em ~8s sem ar
const LAVA_DAMAGE_PER_SEC = 100 / 3;           // contato com lava, morre em ~3s

export class SurvivalSystem {
  public health = 100;
  public maxHealth = 100;
  public hunger = 100;
  public maxHunger = 100;
  public alive = true;

  private airTime = 0;
  private wasOnGround = true;

  public onDamage: (amount: number, cause: string) => void = () => {};
  public onDeath: (cause: string) => void = () => {};
  public onChanged: () => void = () => {};

  constructor(private player: PlayerController) {}

  public reset(): void {
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.alive = true;
    this.airTime = 0;
    this.wasOnGround = true;
    this.onChanged();
  }

  public applyDamage(amount: number, cause: string): void {
    if (!this.alive || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.onDamage(amount, cause);
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

    // Afogamento: cabeça submersa por mais de ~3s começa a causar dano contínuo.
    if (this.player.headUnder) {
      this.airTime += dt;
      if (this.airTime > 3) this.applyDamage(DROWN_DAMAGE_PER_SEC * dt, 'afogamento');
    } else {
      this.airTime = 0;
    }

    // Lava: dano contínuo e imediato ao contato, sem tolerância.
    if (this.player.inLava) {
      this.applyDamage(LAVA_DAMAGE_PER_SEC * dt, 'lava');
    }

    // Fome decai com o tempo; sem fome, a vida decai; com fome > 50%, a vida regenera aos poucos.
    this.hunger = Math.max(0, this.hunger - HUNGER_DECAY_PER_SEC * dt);
    if (this.hunger <= 0) {
      this.applyDamage(STARVE_DAMAGE_PER_SEC * dt, 'fome');
    } else if (this.hunger > 50 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + REGEN_PER_SEC * dt);
      this.onChanged();
    }
  }

  /** Consumir um item de comida restaura fome (chamado pela hotbar/inventário de sobrevivência). */
  public eat(amount: number): void {
    this.hunger = Math.min(this.maxHunger, this.hunger + amount);
    this.onChanged();
  }
}
