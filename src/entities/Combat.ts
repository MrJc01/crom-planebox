// Regras de combate: dano, alcance, cooldown, recuo e invulnerabilidade temporária.
//
// Módulo puro de propósito — só matemática e estado numérico, sem Three.js nem DOM. O combate é
// o subsistema onde um erro de balanceamento passa despercebido por muito tempo (o jogador
// culpa a "sensação" do jogo, não o número), então cada regra aqui é verificável em teste.
//
// Escala: distâncias em metros do mundo, tempos em segundos.

import { B } from '../world/blocks';

/** Alcance do golpe corpo a corpo, em metros. */
export const MELEE_RANGE = 3.2;
/** Ângulo máximo entre a mira e o alvo para o golpe conectar (~70° de abertura total). */
export const MELEE_CONE_COS = 0.34;
/** Intervalo mínimo entre dois golpes do jogador. */
export const ATTACK_COOLDOWN = 0.42;
/** Janela de invulnerabilidade após levar dano — impede "stun lock" por dano contínuo. */
export const IFRAME_DURATION = 0.5;

/**
 * Dano por tier de ferramenta equipada. Índice = `toolTier` (0 = mão vazia).
 *
 * A curva é deliberadamente suave: a picareta de diamante bate ~4× a mão, não 20×, para o
 * combate continuar dependendo de posicionamento e não virar um botão de deletar inimigo.
 *
 * ## O índice 4 estava faltando
 *
 * A tabela ia até o índice 3 e o comentário ao lado já falava em "picareta de diamante" — que
 * não existia. `damageForTier` **satura** no último índice, então uma picareta de tier 4
 * bateria exatamente como a de ferro: a receita mais cara do jogo, sem nenhuma diferença.
 *
 * Um teto por saturação é o pior tipo de teto, porque não falha — só deixa de recompensar, em
 * silêncio. Quem jogasse acharia que o diamante "não vale a pena", sem nada explicando.
 */
export const TIER_DAMAGE = [2, 3.5, 5, 7, 9.5];

/**
 * Durabilidade por tier de ferramenta: quantos usos (quebrar bloco ou golpear) antes de quebrar.
 * Sem desgaste, a primeira picareta de diamante encerra a progressão de equipamento — a
 * ferramenta deixa de ser uma decisão e vira um item permanente. Tier 0 (mão) não desgasta.
 */
export const TIER_DURABILITY = [Infinity, 60, 132, 260];

export function durabilityForTier(tier: number): number {
  const t = Math.max(0, Math.min(TIER_DURABILITY.length - 1, Math.floor(tier || 0)));
  return TIER_DURABILITY[t];
}

/** Força do recuo aplicado ao alvo, em m/s. */
export const KNOCKBACK_SPEED = 6.5;
/** Componente vertical do recuo — dá o "poP" de acerto sem lançar o alvo longe. */
export const KNOCKBACK_LIFT = 3.2;

export function damageForTier(tier: number): number {
  const t = Math.max(0, Math.min(TIER_DAMAGE.length - 1, Math.floor(tier || 0)));
  return TIER_DAMAGE[t];
}

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * O alvo está dentro do alcance E dentro do cone de mira?
 *
 * O cone existe para o golpe não acertar quem está atrás do jogador: só a distância produziria
 * a sensação de acertar "pelas costas" e tornaria a mira irrelevante.
 */
export function isInMeleeReach(origin: Vec3Like, forward: Vec3Like, target: Vec3Like, range = MELEE_RANGE): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;

  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist > range || dist < 1e-6) return false;

  // Produto escalar normalizado = cosseno do ângulo entre a mira e a direção do alvo.
  const fLen = Math.sqrt(forward.x * forward.x + forward.y * forward.y + forward.z * forward.z) || 1;
  const dot = (dx * forward.x + dy * forward.y + dz * forward.z) / (dist * fLen);
  return dot >= MELEE_CONE_COS;
}

/** Vetor de recuo: empurra na direção origem→alvo, com um empurrão para cima. */
export function knockbackFrom(origin: Vec3Like, target: Vec3Like, speed = KNOCKBACK_SPEED): Vec3Like {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return { x: 0, y: KNOCKBACK_LIFT, z: 0 };
  return { x: (dx / len) * speed, y: KNOCKBACK_LIFT, z: (dz / len) * speed };
}

/**
 * Controlador de cooldown e invulnerabilidade de um combatente.
 *
 * Separado da entidade porque o jogador e os mobs seguem exatamente as mesmas regras — duplicar
 * essa contagem nos dois lados é como as janelas de i-frame acabam divergindo na prática.
 */
export class CombatTimers {
  private attackCooldown = 0;
  private invulnerable = 0;

  public tick(dt: number): void {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
  }

  public canAttack(): boolean {
    return this.attackCooldown <= 0;
  }

  public markAttacked(cooldown = ATTACK_COOLDOWN): void {
    this.attackCooldown = cooldown;
  }

  /** Pode receber dano agora? Falso durante a janela de invulnerabilidade. */
  public canBeHurt(): boolean {
    return this.invulnerable <= 0;
  }

  public markHurt(duration = IFRAME_DURATION): void {
    this.invulnerable = duration;
  }

  public get invulnerableFor(): number {
    return this.invulnerable;
  }
}

export type MobKind = 'zumbi' | 'esqueleto' | 'aranha';

export interface MobProfile {
  kind: MobKind;
  name: string;
  maxHealth: number;
  /** Dano por golpe encostado no jogador. */
  attackDamage: number;
  /** Intervalo entre ataques do mob. */
  attackInterval: number;
  speed: number;
  /** Raio em que o mob percebe o jogador e passa a persegui-lo. */
  aggroRange: number;
  /** Distância em que consegue encostar o golpe. */
  reach: number;
  bodyColor: number;
  headColor: number;
  /** Bloco dropado ao morrer, ou -1 para nada. */
  drop: number;
  dropCount: number;
}

/**
 * Perfis dos hostis. Três arquétipos distintos, para o jogador precisar mudar de postura em vez
 * de repetir o mesmo golpe: o zumbi é lento e resistente, a aranha é rápida e frágil, o
 * esqueleto fica no meio e recua menos.
 */
export const MOB_PROFILES: Record<MobKind, MobProfile> = {
  zumbi: {
    kind: 'zumbi', name: 'Zumbi', maxHealth: 20, attackDamage: 6, attackInterval: 1.2,
    speed: 1.8, aggroRange: 16, reach: 1.6, bodyColor: 0x3f6212, headColor: 0x4d7c0f,
    // Loot escolhido para alimentar o próprio ciclo que gera o inimigo: carvão vira tocha,
    // tocha impede o spawn. Enfrentar a noite compra a luz que torna a noite segura.
    drop: B.COAL_ORE, dropCount: 1,
  },
  esqueleto: {
    kind: 'esqueleto', name: 'Esqueleto', maxHealth: 14, attackDamage: 4, attackInterval: 0.9,
    speed: 2.4, aggroRange: 20, reach: 1.8, bodyColor: 0xe2e8f0, headColor: 0xf1f5f9,
    // Ferro: sobe o tier de picareta, que abre os minérios profundos.
    drop: B.IRON_ORE, dropCount: 1,
  },
  aranha: {
    kind: 'aranha', name: 'Aranha', maxHealth: 10, attackDamage: 3, attackInterval: 0.6,
    speed: 3.6, aggroRange: 14, reach: 1.5, bodyColor: 0x1c1917, headColor: 0x44403c,
    // A aranha é a ameaça de pressão, não de recompensa: rápida, frágil e sem loot.
    drop: -1, dropCount: 0,
  },
};

export const MOB_KINDS: MobKind[] = ['zumbi', 'esqueleto', 'aranha'];

export type StatusEffectId = 'veneno' | 'regeneracao' | 'velocidade' | 'resistencia' | 'lentidao';

export interface ActiveStatusEffect {
  id: StatusEffectId;
  duration: number;
  level: number;
}

/** Efeitos de status (veneno, regeneração, velocidade) — item 131 P2. */
export class StatusEffectSystem {
  private effects: ActiveStatusEffect[] = [];

  public apply(id: StatusEffectId, duration: number, level = 1): void {
    const existing = this.effects.find(e => e.id === id);
    if (existing) { existing.duration = Math.max(existing.duration, duration); existing.level = level; }
    else this.effects.push({ id, duration, level });
  }

  public tick(dt: number): { healthDelta: number; speedMultiplier: number } {
    let healthDelta = 0;
    let speedMultiplier = 1.0;
    this.effects = this.effects.filter(e => {
      e.duration -= dt;
      if (e.id === 'veneno') healthDelta -= e.level * dt;
      if (e.id === 'regeneracao') healthDelta += e.level * 0.5 * dt;
      if (e.id === 'velocidade') speedMultiplier += 0.2 * e.level;
      if (e.id === 'lentidao') speedMultiplier -= 0.15 * e.level;
      return e.duration > 0;
    });
    return { healthDelta, speedMultiplier: Math.max(0.1, speedMultiplier) };
  }

  public active(): ActiveStatusEffect[] {
    return [...this.effects];
  }
}

export interface PotionRecipe {
  id: string;
  name: string;
  effect: StatusEffectId;
  duration: number;
  level: number;
  ingredients: number[];
}

/** Poções craftáveis — item 132 P2. */
export class PotionCrafting {
  private static readonly RECIPES: PotionRecipe[] = [
    { id: 'potion_health', name: 'Poção de Cura', effect: 'regeneracao', duration: 10, level: 1, ingredients: [14, 6] },
    { id: 'potion_speed', name: 'Poção de Velocidade', effect: 'velocidade', duration: 30, level: 1, ingredients: [4, 6] },
    { id: 'potion_resist', name: 'Poção de Resistência', effect: 'resistencia', duration: 60, level: 1, ingredients: [3, 6] },
  ];

  public static getRecipes(): PotionRecipe[] {
    return [...this.RECIPES];
  }

  public static canCraft(availableItems: number[]): PotionRecipe[] {
    return this.RECIPES.filter(r => r.ingredients.every(i => availableItems.includes(i)));
  }
}

/** Bloqueio/parry com escudo — item 153 P2. */
export class ShieldParry {
  public isBlocking = false;
  private parryWindowMs = 200;
  private blockStartTime = 0;

  public startBlock(timestamp: number): void {
    this.isBlocking = true;
    this.blockStartTime = timestamp;
  }

  public stopBlock(): void {
    this.isBlocking = false;
  }

  public calculateDamageReduction(incomingDamage: number, timestamp: number): { finalDamage: number; isParry: boolean } {
    if (!this.isBlocking) return { finalDamage: incomingDamage, isParry: false };
    const elapsed = timestamp - this.blockStartTime;
    if (elapsed <= this.parryWindowMs) {
      return { finalDamage: 0, isParry: true }; // parry perfeito
    }
    return { finalDamage: incomingDamage * 0.3, isParry: false }; // bloqueio normal
  }
}

/** Ataque carregado — item 154 P2. */
export class ChargedAttack {
  private chargeStart = 0;
  private maxChargeMs = 2000;

  public startCharge(timestamp: number): void {
    this.chargeStart = timestamp;
  }

  public release(timestamp: number, baseDamage: number): { damage: number; chargePercent: number } {
    const elapsed = timestamp - this.chargeStart;
    const chargePercent = Math.min(1.0, elapsed / this.maxChargeMs);
    const multiplier = 1.0 + chargePercent * 2.0; // até 3x dano
    return { damage: baseDamage * multiplier, chargePercent };
  }
}

export type ElementType = 'fogo' | 'gelo' | 'raio' | 'fisico';

/** Inimigos com resistências elementais — item 155 P2. */
export class ElementalResistance {
  private resistances = new Map<ElementType, number>(); // 0 = sem redução, 1 = imune, <0 = fraqueza

  public setResistance(element: ElementType, factor: number): void {
    this.resistances.set(element, factor);
  }

  public calculateDamage(rawDamage: number, element: ElementType): number {
    const res = this.resistances.get(element) ?? 0;
    const finalDamage = rawDamage * (1 - res);
    return Math.max(0, finalDamage);
  }
}

export type BossPhase = 'fase1' | 'fase2' | 'fase3';

/** Bosses com fases e padrões de ataque — item 156 P2. */
export class BossPhasePattern {
  public currentPhase: BossPhase = 'fase1';
  private maxHealth: number;

  constructor(maxHealth = 100) {
    this.maxHealth = maxHealth;
  }

  public updatePhase(currentHealth: number): BossPhase {
    const pct = currentHealth / this.maxHealth;
    if (pct <= 0.3) this.currentPhase = 'fase3';
    else if (pct <= 0.6) this.currentPhase = 'fase2';
    else this.currentPhase = 'fase1';
    return this.currentPhase;
  }

  public getAttackPattern(): string {
    if (this.currentPhase === 'fase3') return 'frenzy_area_attack';
    if (this.currentPhase === 'fase2') return 'charge_and_summon';
    return 'basic_melee';
  }
}

/** Arenas de boss com invocação por item — item 157 P2. */
export class BossSummonArena {
  public static canSummon(itemId: string, x: number, y: number, z: number): boolean {
    return itemId === 'item_invocacao_boss' && y >= 64;
  }

  public static summonBoss(itemId: string, x: number, y: number, z: number): { bossSpawned: boolean; bossId: string; arenaRadius: number } | null {
    if (!this.canSummon(itemId, x, y, z)) return null;
    return { bossSpawned: true, bossId: 'boss_rei_voxel', arenaRadius: 25 };
  }
}
