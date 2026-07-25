import { describe, it, expect } from 'vitest';
import { B, BLOCKS } from '../../src/world/blocks';
import { SCALE } from '../../src/world/chunk';
import { ORE_TIERS, UndergroundGen } from '../../src/world/underground';
import { Value3 } from '../../src/core/noise';

const SURFACE = 30 * SCALE; // superfície a 30 m, como uma coluna típica de terreno

/** Amostra uma coluna vertical e devolve quantos voxels são caverna. */
function caveCount(gen: UndergroundGen, x: number, z: number, surfaceY = SURFACE): number {
  let n = 0;
  for (let y = 0; y <= surfaceY; y++) if (gen.isCave(x, y, z, surfaceY)) n++;
  return n;
}

describe('Value3 — ruído 3D', () => {
  const n = new Value3(1234);

  it('é determinístico para a mesma semente e coordenada', () => {
    expect(n.noise(1.5, 2.5, 3.5)).toBe(n.noise(1.5, 2.5, 3.5));
    expect(new Value3(1234).noise(1.5, 2.5, 3.5)).toBe(n.noise(1.5, 2.5, 3.5));
  });

  it('sementes diferentes produzem campos diferentes', () => {
    expect(new Value3(1).noise(4.2, 1.1, 9.3)).not.toBe(new Value3(2).noise(4.2, 1.1, 9.3));
  });

  it('fica dentro de -1..1 e nunca devolve NaN', () => {
    for (let i = 0; i < 400; i++) {
      const v = n.noise(i * 0.37, i * 0.11, i * 0.73);
      expect(Number.isNaN(v)).toBe(false);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('é contínuo: passos pequenos não dão saltos grandes', () => {
    let maxJump = 0;
    let prev = n.noise(0, 0, 0);
    for (let i = 1; i < 200; i++) {
      const v = n.noise(i * 0.01, 0, 0);
      maxJump = Math.max(maxJump, Math.abs(v - prev));
      prev = v;
    }
    expect(maxJump).toBeLessThan(0.35);
  });

  it('ridged fica em 0..1 e fbm em -1..1', () => {
    for (let i = 0; i < 120; i++) {
      const r = n.ridged(i * 0.2, i * 0.13, i * 0.31, 3);
      const f = n.fbm(i * 0.2, i * 0.13, i * 0.31, 3);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
      expect(f).toBeGreaterThanOrEqual(-1);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});

describe('UndergroundGen — cavernas', () => {
  const gen = new UndergroundGen(4242);

  it('nunca abre caverna na rocha-mãe do fundo', () => {
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y <= 2; y++) {
        expect(gen.isCave(x, y, x * 3, SURFACE), `caverna em y=${y}`).toBe(false);
      }
    }
  });

  it('CRÍTICO: não abre buraco junto à superfície — o jogador não cai andando', () => {
    // Se cavernas alcançassem a superfície, o terreno ficaria crivado de crateras.
    for (let x = -60; x < 60; x += 3) {
      for (let z = -60; z < 60; z += 7) {
        for (let y = SURFACE - 4 * SCALE; y <= SURFACE; y++) {
          expect(gen.isCave(x, y, z, SURFACE), `caverna exposta em (${x},${y},${z})`).toBe(false);
        }
      }
    }
  });

  it('gera vazio em quantidade razoável no subsolo — nem maciço, nem esponja', () => {
    let cave = 0;
    let total = 0;
    for (let x = 0; x < 48; x += 2) {
      for (let z = 0; z < 48; z += 2) {
        for (let y = 4; y < SURFACE - 5 * SCALE; y += 2) {
          total++;
          if (gen.isCave(x, y, z, SURFACE)) cave++;
        }
      }
    }
    const ratio = cave / total;
    expect(ratio, `proporção de caverna ficou em ${(ratio * 100).toFixed(1)}%`).toBeGreaterThan(0.005);
    expect(ratio).toBeLessThan(0.35);
  });

  it('é determinístico por semente e difere entre sementes', () => {
    const a = new UndergroundGen(99);
    const b = new UndergroundGen(99);
    const c = new UndergroundGen(100);

    const sampleA = caveCount(a, 17, 23);
    expect(caveCount(b, 17, 23)).toBe(sampleA);

    // Duas sementes podem coincidir numa coluna; compara o agregado de várias.
    let diff = 0;
    for (let x = 0; x < 20; x++) if (caveCount(a, x, 5) !== caveCount(c, x, 5)) diff++;
    expect(diff).toBeGreaterThan(0);
  });

  it('lava só no fundo, nunca perto da superfície', () => {
    expect(gen.isDeepLava(3)).toBe(true);
    expect(gen.isDeepLava(1)).toBe(false); // rocha-mãe
    expect(gen.isDeepLava(SURFACE - 1)).toBe(false);
  });
});

describe('UndergroundGen — veios de minério', () => {
  const gen = new UndergroundGen(777);

  it('não coloca minério na rocha-mãe nem logo abaixo da grama', () => {
    for (let x = 0; x < 30; x++) {
      expect(gen.oreAt(x, 1, x, SURFACE)).toBe(0);
      expect(gen.oreAt(x, SURFACE - 1, x, SURFACE)).toBe(0);
    }
  });

  it('só devolve blocos de minério declarados nos tiers', () => {
    const valid = new Set([0, ...ORE_TIERS.map((t) => t.block)]);
    for (let x = 0; x < 60; x++) {
      for (let y = 4; y < SURFACE; y += 3) {
        expect(valid.has(gen.oreAt(x, y, x * 2, SURFACE))).toBe(true);
      }
    }
  });

  it('todo bloco de minério existe na paleta e exige ferramenta', () => {
    for (const tier of ORE_TIERS) {
      const def = BLOCKS[tier.block];
      expect(def, `bloco ${tier.block} não existe`).toBeDefined();
      expect(def.minToolTier).toBeGreaterThan(0);
      expect(def.drops).toBe(tier.block); // dropa a si mesmo
    }
  });

  it('gera cada tipo de minério em algum lugar do subsolo', () => {
    const found = new Set<number>();
    for (let x = 0; x < 120; x++) {
      for (let z = 0; z < 40; z++) {
        for (let y = 3; y < SURFACE; y += 2) {
          const ore = gen.oreAt(x, y, z, SURFACE);
          if (ore !== 0) found.add(ore);
        }
      }
    }
    for (const tier of ORE_TIERS) {
      expect(found.has(tier.block), `${BLOCKS[tier.block].name} nunca foi gerado`).toBe(true);
    }
  });

  it('respeita a faixa de profundidade declarada por tier', () => {
    for (let x = 0; x < 100; x++) {
      for (let z = 0; z < 30; z++) {
        for (let y = 3; y < SURFACE; y++) {
          const ore = gen.oreAt(x, y, z, SURFACE);
          if (ore === 0) continue;
          const tier = ORE_TIERS.find((t) => t.block === ore)!;
          const depth = (SURFACE - y) / SCALE;
          expect(depth, `${BLOCKS[ore].name} raso demais`).toBeGreaterThanOrEqual(tier.minDepth);
          expect(depth, `${BLOCKS[ore].name} fundo demais`).toBeLessThanOrEqual(tier.maxDepth);
        }
      }
    }
  });

  it('diamante é mais raro que carvão', () => {
    let coal = 0, diamond = 0;
    for (let x = 0; x < 140; x++) {
      for (let z = 0; z < 40; z++) {
        for (let y = 3; y < SURFACE; y += 2) {
          const ore = gen.oreAt(x, y, z, SURFACE);
          if (ore === B.COAL_ORE) coal++;
          else if (ore === B.DIAMOND_ORE) diamond++;
        }
      }
    }
    expect(coal).toBeGreaterThan(0);
    expect(diamond).toBeLessThan(coal);
  });

  it('o minério vem em bolsões, não em voxels isolados', () => {
    // Acha um voxel de minério e confere que ao menos um vizinho é do mesmo tipo.
    let checked = 0;
    let withNeighbor = 0;
    for (let x = 0; x < 90 && checked < 25; x++) {
      for (let z = 0; z < 30 && checked < 25; z++) {
        for (let y = 4; y < SURFACE - 1 && checked < 25; y++) {
          const ore = gen.oreAt(x, y, z, SURFACE);
          if (ore === 0) continue;
          checked++;
          const neighbors = [
            gen.oreAt(x + 1, y, z, SURFACE), gen.oreAt(x - 1, y, z, SURFACE),
            gen.oreAt(x, y + 1, z, SURFACE), gen.oreAt(x, y - 1, z, SURFACE),
            gen.oreAt(x, y, z + 1, SURFACE), gen.oreAt(x, y, z - 1, SURFACE),
          ];
          if (neighbors.some((n) => n === ore)) withNeighbor++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(withNeighbor / checked, 'minério saiu salpicado em vez de agrupado').toBeGreaterThan(0.7);
  });

  it('é determinístico por semente', () => {
    const a = new UndergroundGen(5150);
    const b = new UndergroundGen(5150);
    for (let y = 4; y < SURFACE; y += 5) {
      expect(a.oreAt(13, y, 27, SURFACE)).toBe(b.oreAt(13, y, 27, SURFACE));
    }
  });
});
