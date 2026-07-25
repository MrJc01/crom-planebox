import { describe, it, expect, vi } from 'vitest';
import { SurvivalSystem, FOOD_VALUE, foodValueOf, isEdible } from '../../src/game/SurvivalSystem';
import { B } from '../../src/world/blocks';
import type { PlayerController } from '../../src/player/controller';

function makePlayer(overrides: Partial<PlayerController> = {}): PlayerController {
  return {
    onGround: true,
    lastImpactVelY: 0,
    headUnder: false,
    inLava: false,
    inWater: false,
    ...overrides,
  } as unknown as PlayerController;
}

describe('SurvivalSystem', () => {
  it('começa com vida e fome cheias', () => {
    const s = new SurvivalSystem(makePlayer());
    expect(s.health).toBe(s.maxHealth);
    expect(s.hunger).toBe(s.maxHunger);
    expect(s.alive).toBe(true);
  });

  it('queda leve (impacto abaixo do limiar) não causa dano', () => {
    const player = makePlayer({ onGround: false });
    const s = new SurvivalSystem(player);
    s.update(0.1); // registra que saiu do chão (wasOnGround = false)
    player.onGround = true;
    player.lastImpactVelY = -10; // bem abaixo do limiar de ~22
    s.update(0.1);
    expect(s.health).toBe(s.maxHealth);
  });

  it('queda forte (impacto acima do limiar) causa dano de queda', () => {
    const player = makePlayer({ onGround: false });
    const s = new SurvivalSystem(player);
    s.update(0.1); // sai do chão primeiro para haver transição
    player.onGround = true;
    player.lastImpactVelY = -40; // bem acima do limiar
    s.update(0.1);
    expect(s.health).toBeLessThan(s.maxHealth);
  });

  it('afogamento só causa dano depois de ~3s com a cabeça submersa', () => {
    const player = makePlayer({ headUnder: true });
    const s = new SurvivalSystem(player);
    s.update(1);
    s.update(1);
    expect(s.health).toBe(s.maxHealth); // ainda dentro da tolerância de ar
    s.update(1.5); // passa de 3s acumulados
    expect(s.health).toBeLessThan(s.maxHealth);
  });

  it('contato com lava causa dano imediato e contínuo', () => {
    const player = makePlayer({ inLava: true });
    const s = new SurvivalSystem(player);
    s.update(0.5);
    expect(s.health).toBeLessThan(s.maxHealth);
  });

  it('fome decai com o tempo', () => {
    const s = new SurvivalSystem(makePlayer());
    s.update(60); // 1 minuto
    expect(s.hunger).toBeLessThan(s.maxHunger);
  });

  it('morte dispara onDeath exatamente uma vez e marca alive=false', () => {
    const s = new SurvivalSystem(makePlayer());
    const onDeath = vi.fn();
    s.onDeath = onDeath;
    s.applyDamage(1000, 'teste');
    expect(s.alive).toBe(false);
    expect(s.health).toBe(0);
    expect(onDeath).toHaveBeenCalledTimes(1);
  });

  it('reset() restaura vida/fome cheias e alive=true', () => {
    const s = new SurvivalSystem(makePlayer());
    s.applyDamage(1000, 'teste');
    s.reset();
    expect(s.alive).toBe(true);
    expect(s.health).toBe(s.maxHealth);
    expect(s.hunger).toBe(s.maxHunger);
  });

  describe('queimadura por lava', () => {
    it('entrar na lava acende a queimadura e causa dano imediato', () => {
      const s = new SurvivalSystem(makePlayer({ inLava: true }));
      s.update(0.5);
      expect(s.health).toBeLessThan(s.maxHealth);
      expect(s.burnTime).toBeGreaterThan(0);
    });

    it('sair da lava NÃO apaga o fogo: o dano continua', () => {
      const player = makePlayer({ inLava: true });
      const s = new SurvivalSystem(player);
      s.update(0.2);

      (player as any).inLava = false;
      const afterLava = s.health;
      s.update(1);

      expect(s.health).toBeLessThan(afterLava);
      expect(s.burnTime).toBeGreaterThan(0);
    });

    it('entrar na água apaga o fogo na hora', () => {
      const player = makePlayer({ inLava: true });
      const s = new SurvivalSystem(player);
      s.update(0.2);
      expect(s.burnTime).toBeGreaterThan(0);

      (player as any).inLava = false;
      (player as any).inWater = true;
      s.update(0.1);

      expect(s.burnTime).toBe(0);
    });

    it('a queimadura expira sozinha e para de causar dano', () => {
      const player = makePlayer({ inLava: true });
      const s = new SurvivalSystem(player);
      s.update(0.1);
      (player as any).inLava = false;

      for (let i = 0; i < 20; i++) s.update(0.5); // bem além da duração
      expect(s.burnTime).toBe(0);

      const settled = s.health;
      s.update(0.5);
      // Sem fogo, a vida só pode subir (regeneração) ou ficar igual — nunca cair por queimadura.
      expect(s.health).toBeGreaterThanOrEqual(settled);
    });

    it('reset apaga a queimadura', () => {
      const s = new SurvivalSystem(makePlayer({ inLava: true }));
      s.update(0.3);
      s.reset();
      expect(s.burnTime).toBe(0);
      expect(s.health).toBe(s.maxHealth);
    });
  });

});

describe('SurvivalSystem — comida (o ciclo de fome deixou de ser só um cronômetro)', () => {
  it('itens de folhagem e vegetação são comestíveis; pedra não é', () => {
    expect(isEdible(B.LEAVES)).toBe(true);
    expect(isEdible(B.REED)).toBe(true);
    expect(isEdible(B.STONE)).toBe(false);
    expect(isEdible(B.AIR)).toBe(false);
  });

  it('comer restaura fome sem passar do máximo', () => {
    const s = new SurvivalSystem(makePlayer());
    s.hunger = 50;
    s.eat(foodValueOf(B.REED));
    expect(s.hunger).toBeGreaterThan(50);

    s.hunger = 98;
    s.eat(50);
    expect(s.hunger).toBe(s.maxHunger);
  });

  it('todo item comestível restaura uma quantidade positiva', () => {
    for (const id of Object.keys(FOOD_VALUE)) {
      expect(foodValueOf(Number(id))).toBeGreaterThan(0);
    }
  });

  it('item não comestível restaura zero, não NaN', () => {
    expect(foodValueOf(B.STONE)).toBe(0);
    expect(foodValueOf(9999)).toBe(0);
  });

  it('com fome alta o jogador regenera vida — o ciclo se fecha', () => {
    const s = new SurvivalSystem(makePlayer());
    s.health = 40;
    s.hunger = 90;
    s.update(1);
    expect(s.health).toBeGreaterThan(40);
  });

  it('com fome zerada a vida cai, mesmo sem inimigo por perto', () => {
    const s = new SurvivalSystem(makePlayer());
    s.hunger = 0;
    const antes = s.health;
    s.update(1);
    expect(s.health).toBeLessThan(antes);
  });
});
