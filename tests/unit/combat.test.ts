import { describe, it, expect } from 'vitest';
import { CRAFTING_RECIPES } from '../../src/crafting/CraftingSystem';
import {
  ATTACK_COOLDOWN,
  CombatTimers,
  IFRAME_DURATION,
  MELEE_RANGE,
  MOB_KINDS,
  MOB_PROFILES,
  TIER_DAMAGE,
  damageForTier,
  isInMeleeReach,
  knockbackFrom,
} from '../../src/entities/Combat';

const OLHANDO_PARA_Z = { x: 0, y: 0, z: 1 };
const ORIGEM = { x: 0, y: 0, z: 0 };

describe('Combat — dano por tier', () => {
  it('mão vazia causa o menor dano e cada tier sobe', () => {
    for (let t = 1; t < TIER_DAMAGE.length; t++) {
      expect(damageForTier(t)).toBeGreaterThan(damageForTier(t - 1));
    }
  });

  it('tier inválido não quebra nem devolve NaN', () => {
    for (const bad of [-5, 99, NaN, undefined as any, null as any]) {
      const d = damageForTier(bad);
      expect(Number.isFinite(d)).toBe(true);
      expect(d).toBeGreaterThan(0);
    }
  });

  it('a curva é suave: o melhor tier não trivializa o combate', () => {
    // Se a picareta de diamante batesse 10x a mão, posicionamento deixaria de importar.
    const razao = damageForTier(TIER_DAMAGE.length - 1) / damageForTier(0);
    expect(razao).toBeLessThan(5);
    expect(razao).toBeGreaterThan(1.5);
  });
});

describe('Combat — alcance e cone de mira', () => {
  it('acerta o alvo logo à frente, dentro do alcance', () => {
    expect(isInMeleeReach(ORIGEM, OLHANDO_PARA_Z, { x: 0, y: 0, z: 2 })).toBe(true);
  });

  it('não acerta além do alcance', () => {
    expect(isInMeleeReach(ORIGEM, OLHANDO_PARA_Z, { x: 0, y: 0, z: MELEE_RANGE + 1 })).toBe(false);
  });

  it('CRÍTICO: não acerta quem está atrás — a mira precisa importar', () => {
    expect(isInMeleeReach(ORIGEM, OLHANDO_PARA_Z, { x: 0, y: 0, z: -2 })).toBe(false);
  });

  it('não acerta quem está perpendicular à mira', () => {
    expect(isInMeleeReach(ORIGEM, OLHANDO_PARA_Z, { x: 2.5, y: 0, z: 0 })).toBe(false);
  });

  it('acerta em diagonal moderada, dentro do cone', () => {
    expect(isInMeleeReach(ORIGEM, OLHANDO_PARA_Z, { x: 1, y: 0, z: 1.8 })).toBe(true);
  });

  it('acerta alvo acima e abaixo, dentro do cone', () => {
    expect(isInMeleeReach(ORIGEM, OLHANDO_PARA_Z, { x: 0, y: 1, z: 2 })).toBe(true);
    expect(isInMeleeReach(ORIGEM, OLHANDO_PARA_Z, { x: 0, y: -1, z: 2 })).toBe(true);
  });

  it('alvo exatamente na origem não conecta (evita divisão por zero)', () => {
    expect(isInMeleeReach(ORIGEM, OLHANDO_PARA_Z, { x: 0, y: 0, z: 0 })).toBe(false);
  });

  it('funciona com vetor de mira não normalizado', () => {
    expect(isInMeleeReach(ORIGEM, { x: 0, y: 0, z: 12 }, { x: 0, y: 0, z: 2 })).toBe(true);
  });
});

describe('Combat — recuo', () => {
  it('empurra o alvo para longe de quem bateu', () => {
    const kb = knockbackFrom(ORIGEM, { x: 0, y: 0, z: 3 });
    expect(kb.z).toBeGreaterThan(0);
    expect(kb.y).toBeGreaterThan(0); // sempre com componente vertical
  });

  it('inverte o sentido conforme o lado do golpe', () => {
    const a = knockbackFrom(ORIGEM, { x: 5, y: 0, z: 0 });
    const b = knockbackFrom(ORIGEM, { x: -5, y: 0, z: 0 });
    expect(Math.sign(a.x)).toBe(-Math.sign(b.x));
  });

  it('alvo sobreposto à origem só é empurrado para cima, sem NaN', () => {
    const kb = knockbackFrom(ORIGEM, { x: 0, y: 0, z: 0 });
    expect(Number.isNaN(kb.x)).toBe(false);
    expect(kb.x).toBe(0);
    expect(kb.z).toBe(0);
    expect(kb.y).toBeGreaterThan(0);
  });

  it('a intensidade horizontal é constante, independente da distância', () => {
    const perto = knockbackFrom(ORIGEM, { x: 0, y: 0, z: 1 });
    const longe = knockbackFrom(ORIGEM, { x: 0, y: 0, z: 9 });
    expect(Math.hypot(perto.x, perto.z)).toBeCloseTo(Math.hypot(longe.x, longe.z), 5);
  });
});

describe('CombatTimers — cadência e invulnerabilidade', () => {
  it('começa podendo atacar e podendo levar dano', () => {
    const t = new CombatTimers();
    expect(t.canAttack()).toBe(true);
    expect(t.canBeHurt()).toBe(true);
  });

  it('após atacar entra em cooldown e volta quando ele expira', () => {
    const t = new CombatTimers();
    t.markAttacked();
    expect(t.canAttack()).toBe(false);

    t.tick(ATTACK_COOLDOWN / 2);
    expect(t.canAttack()).toBe(false);

    t.tick(ATTACK_COOLDOWN);
    expect(t.canAttack()).toBe(true);
  });

  it('CRÍTICO: i-frames impedem levar vários golpes no mesmo instante (stun lock)', () => {
    const t = new CombatTimers();
    t.markHurt();
    expect(t.canBeHurt()).toBe(false);

    t.tick(0.01);
    expect(t.canBeHurt()).toBe(false);

    t.tick(IFRAME_DURATION);
    expect(t.canBeHurt()).toBe(true);
  });

  it('cooldown de ataque e invulnerabilidade são independentes', () => {
    const t = new CombatTimers();
    t.markAttacked();
    expect(t.canBeHurt()).toBe(true); // atacar não te deixa invulnerável

    const u = new CombatTimers();
    u.markHurt();
    expect(u.canAttack()).toBe(true); // levar dano não te impede de revidar
  });

  it('os contadores nunca ficam negativos', () => {
    const t = new CombatTimers();
    t.markHurt();
    for (let i = 0; i < 50; i++) t.tick(1);
    expect(t.invulnerableFor).toBe(0);
  });
});

describe('Combat — perfis de mob', () => {
  it('todo tipo declarado tem perfil completo', () => {
    for (const kind of MOB_KINDS) {
      const p = MOB_PROFILES[kind];
      expect(p, `perfil de ${kind} ausente`).toBeDefined();
      expect(p.kind).toBe(kind);
      expect(p.maxHealth).toBeGreaterThan(0);
      expect(p.attackDamage).toBeGreaterThan(0);
      expect(p.speed).toBeGreaterThan(0);
      expect(p.reach).toBeGreaterThan(0);
      expect(p.aggroRange).toBeGreaterThan(p.reach);
    }
  });

  it('os arquétipos são distintos: o mais rápido não é o mais resistente', () => {
    const rapido = MOB_KINDS.reduce((a, b) => (MOB_PROFILES[a].speed > MOB_PROFILES[b].speed ? a : b));
    const resistente = MOB_KINDS.reduce((a, b) => (MOB_PROFILES[a].maxHealth > MOB_PROFILES[b].maxHealth ? a : b));
    expect(rapido).not.toBe(resistente);
  });

  it('nenhum mob mata o jogador cheio num único golpe', () => {
    for (const kind of MOB_KINDS) {
      expect(MOB_PROFILES[kind].attackDamage).toBeLessThan(100);
    }
  });

  it('o jogador de mão vazia consegue matar qualquer mob (o jogo não fica travado)', () => {
    const danoMao = damageForTier(0);
    for (const kind of MOB_KINDS) {
      const golpes = Math.ceil(MOB_PROFILES[kind].maxHealth / danoMao);
      expect(golpes).toBeGreaterThan(1);   // mas não trivial
      expect(golpes).toBeLessThanOrEqual(12); // nem interminável
    }
  });
});

describe('a tabela de dano cobre todos os tiers que existem', () => {
  it('CRÍTICO: a melhor ferramenta do jogo bate mais que a anterior', () => {
    // `damageForTier` SATURA no último índice. Com a tabela mais curta que a corrente de
    // ferramentas, a picareta de diamante bateria exatamente como a de ferro — a receita mais
    // cara do jogo, sem nenhuma diferença.
    //
    // Um teto por saturação é o pior tipo de teto: não falha, só deixa de recompensar em
    // silêncio. Quem jogasse acharia que o diamante "não vale a pena", sem nada explicando.
    const maiorTier = Math.max(
      ...CRAFTING_RECIPES.filter((r) => r.outputTool).map((r) => r.outputTool!.tier),
    );
    expect(TIER_DAMAGE.length).toBeGreaterThan(maiorTier);
    expect(damageForTier(maiorTier)).toBeGreaterThan(damageForTier(maiorTier - 1));
  });

  it('a curva sobe sempre, sem degrau parado', () => {
    for (let t = 1; t < TIER_DAMAGE.length; t++) {
      expect(TIER_DAMAGE[t], `tier ${t} não recompensa`).toBeGreaterThan(TIER_DAMAGE[t - 1]);
    }
  });

  it('a curva continua suave — a melhor arma não é um botão de deletar inimigo', () => {
    // Sem este limite, a correção acima teria a saída fácil: inflar o último valor.
    expect(TIER_DAMAGE[TIER_DAMAGE.length - 1] / TIER_DAMAGE[0]).toBeLessThan(6);
  });
});
