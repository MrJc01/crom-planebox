import { describe, it, expect, vi } from 'vitest';
import { SurvivalSystem } from '../../src/game/SurvivalSystem';
import type { PlayerController } from '../../src/player/controller';

function makePlayer(overrides: Partial<PlayerController> = {}): PlayerController {
  return {
    onGround: true,
    lastImpactVelY: 0,
    headUnder: false,
    inLava: false,
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
});
