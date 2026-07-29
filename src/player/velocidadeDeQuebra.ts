// Velocidade de quebra por ferramenta — item 1291.
//
// ## O que estava faltando
//
// A tier da ferramenta decidia **se** um bloco podia ser quebrado e quanto dano ela causava em
// combate, mas não **quão rápido** se minerava: `breakCooldown` era fixo. Minerar pedra com a
// picareta de diamante levava exatamente o mesmo tempo que com a de madeira.
//
// É o oposto da expectativa do gênero, e desfaz boa parte da razão de subir de tier — o jogador
// gasta uma corrente inteira de progressão para ganhar acesso a blocos novos e nenhum conforto
// nos que já minerava.
//
// ## Por que o ganho é modesto, e por que ele depende do bloco
//
// Duas regras, e as duas existem para o mesmo fim: manter a mineração uma **decisão**, não uma
// formalidade.
//
//  1. **Só acelera o que resiste.** Terra, areia e folhagem não têm `minToolTier`: já saem num
//     golpe, e acelerá-las não daria sensação nenhuma — só tornaria o modo detalhe difícil de
//     controlar. O ganho aparece onde havia atrito.
//  2. **Teto de 2,2×.** Com um multiplicador grande a mineração vira um passe de varredura, e o
//     mundo deixa de ter custo. O que se quer é aliviar a repetição, não apagar a atividade.

import { BLOCKS } from '../world/blocks';

/** Multiplicador de tempo por degrau de vantagem. Menor que 1 = mais rápido. */
const GANHO_POR_DEGRAU = 0.78;

/** Piso do multiplicador: nunca mais que ~2,2× a velocidade base. */
const PISO = 0.45;

/**
 * Fator que multiplica o tempo de recarga da quebra.
 *
 * `1` significa velocidade normal; valores menores, mais rápido. A vantagem é a diferença entre a
 * tier da ferramenta e a **exigida pelo bloco** — não a tier absoluta. Uma picareta de diamante
 * numa pedra que só pede madeira tem três degraus de vantagem; na obsidiana, que pede ferro, tem
 * um. É o que faz o material duro continuar sendo duro mesmo com a melhor ferramenta.
 */
export type ToolClass = 'pickaxe' | 'axe' | 'shovel' | 'sword';

export function fatorDeVelocidade(tier: number, blockType: number): number {
  const exigido = BLOCKS[blockType]?.minToolTier ?? 0;

  // Bloco sem exigência já sai num golpe: acelerar não daria sensação, só tornaria o modo
  // detalhe difícil de controlar.
  if (exigido <= 0) return 1;

  const vantagem = Math.max(0, Math.floor(tier) - exigido);
  return Math.max(PISO, GANHO_POR_DEGRAU ** vantagem);
}

/**
 * Multiplicador de velocidade por classe da ferramenta versus o tipo de material — item 1292 P1.
 */
export function getToolClassSpeed(toolClass: ToolClass, blockType: number): number {
  if (toolClass === 'pickaxe' && (blockType === 3 || blockType === 11 || blockType === 19 || blockType === 25 || blockType === 27)) return 0.5; // rochas / alvenaria
  if (toolClass === 'axe' && (blockType === 7 || blockType === 9 || blockType === 16)) return 0.5; // madeira / troncos
  if (toolClass === 'shovel' && (blockType === 2 || blockType === 4 || blockType === 5 || blockType === 10)) return 0.5; // terra / areia / cascalho
  if (toolClass === 'sword' && (blockType === 8 || blockType === 13 || blockType === 17)) return 0.4; // vegetação / folhas
  return 1.0;
}

/**
 * Sistema de classe de ferramentas (velocidade por material, dano por tipo) — item 1285 P1.
 */
export class ToolClassSystem {
  public static getDamageForClass(toolClass: ToolClass, tier: number): number {
    const baseDamage = tier * 2 + 3;
    if (toolClass === 'sword') return baseDamage + 3;
    if (toolClass === 'axe') return baseDamage + 2;
    if (toolClass === 'pickaxe') return baseDamage;
    return baseDamage - 1;
  }

  public static getMaterialEfficiency(toolClass: ToolClass, tier: number, blockType: number): number {
    const speed = getToolClassSpeed(toolClass, blockType);
    const tierBonus = fatorDeVelocidade(tier, blockType);
    return speed * tierBonus;
  }
}

/** Tipos de encantamento / afixo disponíveis — item 017 P2. */
export type EnchantmentId = 'eficiencia' | 'fortuna' | 'durabilidade' | 'afiacao' | 'toque_suave';

export interface Enchantment {
  id: EnchantmentId;
  level: number;
  maxLevel: number;
}

/** Sistema de encantamentos/afixos em ferramentas — item 017 P2. */
export class EnchantmentSystem {
  private static readonly ENCHANTMENTS: Record<EnchantmentId, { maxLevel: number; speedBonus: number; damageBonus: number }> = {
    eficiencia: { maxLevel: 5, speedBonus: 0.25, damageBonus: 0 },
    fortuna: { maxLevel: 3, speedBonus: 0, damageBonus: 0 },
    durabilidade: { maxLevel: 3, speedBonus: 0, damageBonus: 0 },
    afiacao: { maxLevel: 5, speedBonus: 0, damageBonus: 1.5 },
    toque_suave: { maxLevel: 1, speedBonus: 0, damageBonus: 0 },
  };

  public static applySpeedBonus(baseSpeed: number, enchantments: Enchantment[]): number {
    let speed = baseSpeed;
    for (const e of enchantments) {
      const def = this.ENCHANTMENTS[e.id];
      if (def) speed += def.speedBonus * Math.min(e.level, def.maxLevel);
    }
    return speed;
  }

  public static applyDamageBonus(baseDamage: number, enchantments: Enchantment[]): number {
    let damage = baseDamage;
    for (const e of enchantments) {
      const def = this.ENCHANTMENTS[e.id];
      if (def) damage += def.damageBonus * Math.min(e.level, def.maxLevel);
    }
    return damage;
  }

  public static getMaxLevel(id: EnchantmentId): number {
    return this.ENCHANTMENTS[id]?.maxLevel ?? 0;
  }
}
