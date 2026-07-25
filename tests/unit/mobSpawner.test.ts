import { describe, it, expect } from 'vitest';
import { B } from '../../src/world/blocks';
import { packLight } from '../../src/world/lighting';
import {
  MAX_HOSTILES,
  MAX_SPAWN_DISTANCE,
  MIN_SPAWN_DISTANCE,
  MobSpawner,
  SPAWN_INTERVAL,
  SPAWN_LIGHT_THRESHOLD,
  SpawnWorld,
  effectiveLight,
  findSpawnPoint,
  isSpawnable,
} from '../../src/entities/MobSpawner';
import { MOB_KINDS } from '../../src/entities/Combat';

/** Mundo de teste: chão sólido em y=9, ar acima, luz configurável por célula. */
function world(opts: { luzPadrao?: number; chaoY?: number } = {}): SpawnWorld & {
  setLight(x: number, y: number, z: number, sky: number, blk: number): void;
  setBlock(x: number, y: number, z: number, t: number): void;
} {
  const chaoY = opts.chaoY ?? 9;
  const luz = opts.luzPadrao ?? 0;
  const blocks = new Map<string, number>();
  const lights = new Map<string, number>();
  const k = (x: number, y: number, z: number) => `${x},${y},${z}`;

  return {
    setBlock(x, y, z, t) { blocks.set(k(x, y, z), t); },
    setLight(x, y, z, sky, blk) { lights.set(k(x, y, z), packLight(sky, blk)); },
    getBlock(x, y, z) {
      const explicit = blocks.get(k(x, y, z));
      if (explicit !== undefined) return explicit;
      return y <= chaoY ? B.STONE : B.AIR;
    },
    getLight(x, y, z) {
      return lights.get(k(x, y, z)) ?? luz;
    },
  };
}

const CTX = { timeOfDay: 0, sunScale: 0.12, hostileCount: 0, maxY: 128 };
const PLAYER = { x: 0, y: 10, z: 0 };

/** Gerador determinístico para os testes não dependerem de sorte. */
function rngSeq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('effectiveLight — a hora do dia entra na conta', () => {
  it('luz de céu vale integralmente ao meio-dia', () => {
    expect(effectiveLight(packLight(15, 0), 1)).toBe(15);
  });

  it('CRÍTICO: à noite a luz de céu despenca — sem isso nada nasceria na superfície', () => {
    expect(effectiveLight(packLight(15, 0), 0.12)).toBeLessThanOrEqual(SPAWN_LIGHT_THRESHOLD);
  });

  it('a tocha não é afetada pela hora — ela protege de dia e de noite', () => {
    expect(effectiveLight(packLight(0, 14), 1)).toBe(14);
    expect(effectiveLight(packLight(0, 14), 0.12)).toBe(14);
  });

  it('vale a maior entre as duas fontes', () => {
    expect(effectiveLight(packLight(15, 3), 1)).toBe(15);
    expect(effectiveLight(packLight(2, 12), 1)).toBe(12);
  });
});

describe('isSpawnable — condições do berço', () => {
  it('aceita chão sólido, dois voxels livres e escuridão', () => {
    const w = world();
    expect(isSpawnable(w, 5, 10, 5, 0.12)).toBe(true);
  });

  it('CRÍTICO: recusa célula iluminada — é isto que faz a tocha proteger a área', () => {
    const w = world();
    w.setLight(5, 10, 5, 0, 14); // tocha por perto
    expect(isSpawnable(w, 5, 10, 5, 0.12)).toBe(false);
  });

  it('recusa quando não há chão sólido embaixo', () => {
    const w = world();
    w.setBlock(5, 9, 5, B.AIR);
    expect(isSpawnable(w, 5, 10, 5, 0.12)).toBe(false);
  });

  it('recusa quando falta espaço para o corpo', () => {
    const w = world();
    w.setBlock(5, 11, 5, B.STONE); // teto colado
    expect(isSpawnable(w, 5, 10, 5, 0.12)).toBe(false);
  });

  it('recusa nascer em cima de lava ou dentro de água', () => {
    const lava = world();
    lava.setBlock(5, 9, 5, B.LAVA);
    expect(isSpawnable(lava, 5, 10, 5, 0.12)).toBe(false);

    const agua = world();
    agua.setBlock(5, 9, 5, B.WATER);
    expect(isSpawnable(agua, 5, 10, 5, 0.12)).toBe(false);
  });

  it('de dia a superfície fica segura, mesmo com a mesma luz de céu', () => {
    const w = world();
    w.setLight(5, 10, 5, 15, 0);
    expect(isSpawnable(w, 5, 10, 5, 1)).toBe(false);   // meio-dia
    expect(isSpawnable(w, 5, 10, 5, 0.12)).toBe(true); // madrugada
  });

  it('a caverna é perigosa a qualquer hora, porque não tem luz de céu', () => {
    const w = world();
    w.setLight(5, 10, 5, 0, 0);
    expect(isSpawnable(w, 5, 10, 5, 1)).toBe(true);
  });
});

describe('findSpawnPoint — escolha do ponto', () => {
  it('encontra um ponto válido num mundo escuro', () => {
    const p = findSpawnPoint(world(), PLAYER, CTX, rngSeq([0.1, 0.5]));
    expect(p).not.toBeNull();
    expect(MOB_KINDS).toContain(p!.kind);
  });

  it('CRÍTICO: respeita a distância mínima — nada materializa na cara do jogador', () => {
    for (let i = 0; i < 40; i++) {
      const p = findSpawnPoint(world(), PLAYER, CTX, Math.random);
      if (!p) continue;
      const d = Math.hypot(p.x - PLAYER.x, p.z - PLAYER.z);
      expect(d).toBeGreaterThanOrEqual(MIN_SPAWN_DISTANCE - 1.5);
      expect(d).toBeLessThanOrEqual(MAX_SPAWN_DISTANCE + 1.5);
    }
  });

  it('devolve null num mundo todo iluminado, em vez de insistir', () => {
    const w = world({ luzPadrao: packLight(15, 15) });
    expect(findSpawnPoint(w, PLAYER, { ...CTX, sunScale: 1 }, Math.random)).toBeNull();
  });

  it('devolve null quando o teto de hostis foi atingido', () => {
    const ctx = { ...CTX, hostileCount: MAX_HOSTILES };
    expect(findSpawnPoint(world(), PLAYER, ctx, Math.random)).toBeNull();
  });

  it('o ponto escolhido é sempre spawnável de fato', () => {
    for (let i = 0; i < 30; i++) {
      const w = world();
      const p = findSpawnPoint(w, PLAYER, CTX, Math.random);
      if (!p) continue;
      expect(isSpawnable(w, Math.floor(p.x), p.y, Math.floor(p.z), CTX.sunScale)).toBe(true);
    }
  });

  it('varia o tipo de mob entre os declarados', () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const p = findSpawnPoint(world(), PLAYER, CTX, Math.random);
      if (p) vistos.add(p.kind);
    }
    expect(vistos.size).toBeGreaterThan(1);
  });
});

describe('MobSpawner — ritmo', () => {
  it('não gera nada antes do intervalo', () => {
    const s = new MobSpawner();
    expect(s.update(0.5, world(), PLAYER, CTX, Math.random)).toBeNull();
  });

  it('gera ao completar o intervalo e reinicia a contagem', () => {
    const s = new MobSpawner();
    expect(s.update(SPAWN_INTERVAL + 0.1, world(), PLAYER, CTX, Math.random)).not.toBeNull();
    expect(s.update(0.1, world(), PLAYER, CTX, Math.random)).toBeNull();
  });

  it('desligado nunca gera — é assim que o Criativo fica seguro', () => {
    const s = new MobSpawner();
    s.enabled = false;
    for (let i = 0; i < 10; i++) {
      expect(s.update(SPAWN_INTERVAL + 1, world(), PLAYER, CTX, Math.random)).toBeNull();
    }
  });

  it('reset zera a contagem acumulada', () => {
    const s = new MobSpawner();
    s.update(SPAWN_INTERVAL - 0.2, world(), PLAYER, CTX, Math.random);
    s.reset();
    expect(s.update(0.3, world(), PLAYER, CTX, Math.random)).toBeNull();
  });
});
