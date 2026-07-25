import { describe, it, expect } from 'vitest';
import { B, BLOCKS, registerCustomBlockAt, resetCustomBlocks, CUSTOM_BLOCK_ID_BASE } from '../../src/world/blocks';
import {
  LightEngine,
  LightGrid,
  MAX_LIGHT,
  blockOf,
  emission,
  lightFactor,
  opacity,
  packLight,
  skyOf,
} from '../../src/world/lighting';

const MAX_Y = 24;

/**
 * Grade de teste: coluna de ar até `MAX_Y`, com blocos colocados à mão.
 * O mundo real é 128 de altura; 24 basta para verificar o algoritmo e mantém o teste rápido.
 */
function grid(): LightGrid & { set(x: number, y: number, z: number, t: number): void; sky(x: number, y: number, z: number): number; blk(x: number, y: number, z: number): number } {
  const blocks = new Map<string, number>();
  const light = new Map<string, number>();
  const k = (x: number, y: number, z: number) => `${x},${y},${z}`;

  return {
    set(x, y, z, t) { blocks.set(k(x, y, z), t); },
    getBlock(x, y, z) {
      if (y < 0) return B.STONE;
      if (y >= MAX_Y) return B.AIR;
      return blocks.get(k(x, y, z)) ?? B.AIR;
    },
    getLight(x, y, z) {
      if (y >= MAX_Y) return 0xf0; // acima do mundo: sol pleno
      return light.get(k(x, y, z)) ?? 0;
    },
    setLight(x, y, z, v) { light.set(k(x, y, z), v); },
    sky(x, y, z) { return skyOf(light.get(k(x, y, z)) ?? 0); },
    blk(x, y, z) { return blockOf(light.get(k(x, y, z)) ?? 0); },
  };
}

/**
 * Teto sólido cobrindo bem além da área semeada. A largura importa: se o teto fosse do mesmo
 * tamanho da região semeada, as colunas abertas da borda receberiam sol até o chão e a luz
 * entraria por baixo, lateralmente — o cenário deixaria de testar o que se propõe.
 */
function roof(g: ReturnType<typeof grid>, y: number, half = 30): void {
  for (let x = -half; x <= half; x++) {
    for (let z = -half; z <= half; z++) g.set(x, y, z, B.STONE);
  }
}

/** Semeia sol em todas as colunas de uma área e propaga. */
function fullSun(g: ReturnType<typeof grid>, engine: LightEngine, r = 12): void {
  const queue: any[] = [];
  for (let z = -r; z <= r; z++) {
    for (let x = -r; x <= r; x++) engine.seedSunColumn(x, z, queue);
  }
  engine.propagateSun(queue);
}

describe('lighting — empacotamento', () => {
  it('empacota e desempacota sol e bloco sem interferência', () => {
    for (let sky = 0; sky <= 15; sky++) {
      for (let blk = 0; blk <= 15; blk++) {
        const p = packLight(sky, blk);
        expect(skyOf(p)).toBe(sky);
        expect(blockOf(p)).toBe(blk);
      }
    }
  });

  it('satura em 15 em vez de transbordar para o outro campo', () => {
    const p = packLight(99, 99);
    expect(skyOf(p)).toBeLessThanOrEqual(15);
    expect(blockOf(p)).toBeLessThanOrEqual(15);
  });
});

describe('lighting — opacidade e emissão', () => {
  it('ar não atenua; pedra bloqueia por completo', () => {
    expect(opacity(B.AIR)).toBe(0);
    expect(opacity(B.STONE)).toBe(Infinity);
  });

  it('água atenua mais que folhas, e vidro deixa passar', () => {
    expect(opacity(B.WATER)).toBeGreaterThan(opacity(B.LEAVES));
    expect(opacity(B.GLASS)).toBe(0);
  });

  it('folhagem filtra a luz em vez de bloquear — copa não vira sombra preta', () => {
    // As folhas são `opaque` na paleta (para o mesher não desenhar as faces internas da copa),
    // então esta checagem existe para garantir que a luz NÃO herde essa opacidade.
    expect(BLOCKS[B.LEAVES].opaque).toBe(true);
    expect(opacity(B.LEAVES)).toBeLessThan(Infinity);
    expect(opacity(B.PINE_LEAVES)).toBeLessThan(Infinity);
  });

  it('pedra luminosa, lava e tocha emitem; pedra comum não', () => {
    expect(emission(B.GLOWSTONE)).toBe(15);
    expect(emission(B.LAVA)).toBeGreaterThan(0);
    expect(emission(B.TORCH)).toBeGreaterThan(0);
    expect(emission(B.STONE)).toBe(0);
    expect(emission(B.AIR)).toBe(0);
  });

  it('bloco de mod com lightLevel emite de verdade (item 252)', () => {
    resetCustomBlocks();
    const id = registerCustomBlockAt(CUSTOM_BLOCK_ID_BASE, {
      name: 'cristal brilhante', topColor: 0x38bdf8, lightLevel: 11,
    });
    expect(emission(id)).toBe(11);
    resetCustomBlocks();
  });

  it('id órfão não emite nem quebra', () => {
    expect(emission(9999)).toBe(0);
  });
});

describe('lighting — luz solar', () => {
  it('céu aberto recebe luz máxima', () => {
    const g = grid();
    const e = new LightEngine(g, MAX_Y);
    fullSun(g, e);
    expect(g.sky(0, MAX_Y - 1, 0)).toBe(MAX_LIGHT);
    expect(g.sky(0, 5, 0)).toBe(MAX_LIGHT);
  });

  it('luz solar desce em linha reta sem perder nível (poço vertical fica claro no fundo)', () => {
    const g = grid();
    // Teto de pedra em y=10, com um buraco em (0,10,0).
    roof(g, 10);
    g.set(0, 10, 0, B.AIR);

    const e = new LightEngine(g, MAX_Y);
    fullSun(g, e);

    expect(g.sky(0, 9, 0)).toBe(MAX_LIGHT);
    expect(g.sky(0, 2, 0)).toBe(MAX_LIGHT); // desceu 8 voxels sem perder nada
  });

  it('CRÍTICO: caverna fechada fica escura — é o que dá função à tocha', () => {
    const g = grid();
    // Laje de pedra cobrindo tudo em y=10; embaixo é vazio.
    roof(g, 10);

    const e = new LightEngine(g, MAX_Y);
    fullSun(g, e);

    for (let y = 0; y < 10; y++) {
      expect(g.sky(0, y, 0), `y=${y} recebeu luz através da rocha`).toBe(0);
    }
  });

  it('a luz entra pela abertura e decai com a distância horizontal', () => {
    const g = grid();
    roof(g, 10);
    g.set(0, 10, 0, B.AIR); // único poço de entrada

    const e = new LightEngine(g, MAX_Y);
    fullSun(g, e);

    const perto = g.sky(1, 9, 0);
    const medio = g.sky(4, 9, 0);
    const longe = g.sky(12, 9, 0);

    expect(perto).toBeGreaterThan(medio);
    expect(medio).toBeGreaterThan(longe);

    // A luz entra com nível 15 e perde 1 por passo horizontal, então o alcance é exatamente 15
    // voxels: além disso a caverna fica preta, por mais aberta que seja a entrada.
    expect(g.sky(MAX_LIGHT, 9, 0)).toBe(0);
    expect(g.sky(MAX_LIGHT + 6, 9, 0)).toBe(0);
  });

  it('água escurece conforme se desce', () => {
    const g = grid();
    for (let y = 0; y < 10; y++) g.set(0, y, 0, B.WATER);

    const e = new LightEngine(g, MAX_Y);
    fullSun(g, e);

    expect(g.sky(0, 9, 0)).toBeLessThan(MAX_LIGHT);
    expect(g.sky(0, 2, 0)).toBeLessThan(g.sky(0, 9, 0));
  });

  it('vidro deixa a luz passar praticamente intacta', () => {
    const g = grid();
    roof(g, 10);
    g.set(0, 10, 0, B.GLASS);

    const e = new LightEngine(g, MAX_Y);
    fullSun(g, e);
    expect(g.sky(0, 9, 0)).toBe(MAX_LIGHT);
  });
});

describe('lighting — luz de bloco', () => {
  it('tocha acende a vizinhança e decai 1 por passo', () => {
    const g = grid();
    roof(g, 10);
    g.set(0, 5, 0, B.TORCH);

    const e = new LightEngine(g, MAX_Y);
    const q: any[] = [];
    e.seedBlockLight(0, 5, 0, q);
    e.propagateBlockLight(q);

    const nivel = emission(B.TORCH);
    expect(g.blk(0, 5, 0)).toBe(nivel);
    expect(g.blk(1, 5, 0)).toBe(nivel - 1);
    expect(g.blk(3, 5, 0)).toBe(nivel - 3);
  });

  it('a luz da tocha tem alcance finito e não vaza para o infinito', () => {
    const g = grid();
    g.set(0, 5, 0, B.TORCH);
    const e = new LightEngine(g, MAX_Y);
    const q: any[] = [];
    e.seedBlockLight(0, 5, 0, q);
    e.propagateBlockLight(q);

    expect(g.blk(emission(B.TORCH) + 2, 5, 0)).toBe(0);
  });

  it('a luz contorna obstáculos em vez de atravessar', () => {
    const g = grid();
    // Parede em x=1, com uma passagem em z=0 → a luz precisa dar a volta.
    for (let y = 0; y < MAX_Y; y++) for (let z = -4; z <= 4; z++) g.set(1, y, z, B.STONE);
    g.set(1, 5, 0, B.AIR);
    g.set(0, 5, 0, B.TORCH);

    const e = new LightEngine(g, MAX_Y);
    const q: any[] = [];
    e.seedBlockLight(0, 5, 0, q);
    e.propagateBlockLight(q);

    expect(g.blk(2, 5, 0)).toBeGreaterThan(0);  // passou pela abertura
    expect(g.blk(2, 5, 3)).toBeLessThan(g.blk(2, 5, 0)); // atrás da parede, mais fraco
  });

  it('sol e luz de bloco convivem sem se sobrescrever', () => {
    const g = grid();
    roof(g, 10);
    g.set(0, 5, 0, B.GLOWSTONE);

    const e = new LightEngine(g, MAX_Y);
    fullSun(g, e);
    const q: any[] = [];
    e.seedBlockLight(0, 5, 0, q);
    e.propagateBlockLight(q);

    expect(g.blk(0, 5, 0)).toBe(15);
    expect(g.sky(0, 5, 0)).toBe(0);   // continua sem sol, é subterrâneo
    expect(g.sky(0, 15, 0)).toBe(15); // e a superfície continua ensolarada
  });
});

describe('lighting — recálculo incremental', () => {
  it('colocar uma tocha acende a área na hora', () => {
    const g = grid();
    roof(g, 10);

    const e = new LightEngine(g, MAX_Y);
    fullSun(g, e);
    expect(g.blk(2, 5, 0)).toBe(0);

    g.set(0, 5, 0, B.TORCH);
    e.recalcRegion(0, 5, 0, 8);

    expect(g.blk(0, 5, 0)).toBeGreaterThan(0);
    expect(g.blk(2, 5, 0)).toBeGreaterThan(0);
  });

  it('remover a tocha apaga a área — a luz não fica presa', () => {
    const g = grid();
    roof(g, 10);
    g.set(0, 5, 0, B.TORCH);

    const e = new LightEngine(g, MAX_Y);
    fullSun(g, e);
    e.recalcRegion(0, 5, 0, 8);
    expect(g.blk(2, 5, 0)).toBeGreaterThan(0);

    g.set(0, 5, 0, B.AIR);
    e.recalcRegion(0, 5, 0, 8);

    expect(g.blk(0, 5, 0)).toBe(0);
    expect(g.blk(2, 5, 0)).toBe(0);
  });

  it('abrir um buraco no teto deixa o sol entrar', () => {
    const g = grid();
    roof(g, 10);

    const e = new LightEngine(g, MAX_Y);
    fullSun(g, e);
    expect(g.sky(0, 9, 0)).toBe(0);

    g.set(0, 10, 0, B.AIR); // jogador cava o teto
    e.recalcRegion(0, 10, 0, 8);

    expect(g.sky(0, 9, 0)).toBe(MAX_LIGHT);
  });

  it('fechar o buraco volta a escurecer', () => {
    const g = grid();
    roof(g, 10);
    g.set(0, 10, 0, B.AIR);

    const e = new LightEngine(g, MAX_Y);
    fullSun(g, e);
    expect(g.sky(0, 9, 0)).toBe(MAX_LIGHT);

    g.set(0, 10, 0, B.STONE);
    e.recalcRegion(0, 10, 0, 8);

    expect(g.sky(0, 9, 0)).toBe(0);
  });
});

describe('lightFactor — conversão para cor', () => {
  it('escuro total nunca é preto absoluto, e luz cheia é ~1', () => {
    expect(lightFactor(packLight(0, 0))).toBeGreaterThan(0);
    expect(lightFactor(packLight(0, 0))).toBeLessThan(0.15);
    expect(lightFactor(packLight(15, 0))).toBeCloseTo(1, 1);
  });

  it('é monotônico: mais luz nunca escurece', () => {
    let prev = -1;
    for (let l = 0; l <= 15; l++) {
      const f = lightFactor(packLight(l, 0));
      expect(f).toBeGreaterThan(prev);
      prev = f;
    }
  });

  it('a noite escurece a luz de céu mas NÃO a da tocha', () => {
    const noite = 0.12;
    const ceuDia = lightFactor(packLight(15, 0), 1);
    const ceuNoite = lightFactor(packLight(15, 0), noite);
    expect(ceuNoite).toBeLessThan(ceuDia);

    const tochaDia = lightFactor(packLight(0, 14), 1);
    const tochaNoite = lightFactor(packLight(0, 14), noite);
    expect(tochaNoite).toBe(tochaDia);
  });

  it('vale a maior entre luz de céu e de bloco', () => {
    expect(lightFactor(packLight(3, 12), 1)).toBe(lightFactor(packLight(0, 12), 1));
  });
});
