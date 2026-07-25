import { describe, it, expect } from 'vitest';
import { B } from '../../src/world/blocks';
import { FluidSystem, FluidWorld, LAVA_SPREAD, WATER_SPREAD, findSlideTarget, maxSpreadFor } from '../../src/world/fluids';

/**
 * Mundo de teste: grade esparsa em memória. O que não foi definido é ar, exceto y < 0, que é
 * pedra — mesma convenção do `World` real (chão do mundo), para os fluidos não caírem no vazio.
 */
function grid(initial: Record<string, number> = {}): FluidWorld & { cells: Map<string, number>; count(t: number): number } {
  const cells = new Map<string, number>(Object.entries(initial));
  return {
    cells,
    getBlock(x, y, z) {
      if (y < 0) return B.STONE;
      return cells.get(`${x},${y},${z}`) ?? B.AIR;
    },
    setBlock(x, y, z, t) {
      cells.set(`${x},${y},${z}`, t);
      return true;
    },
    count(t: number) {
      let n = 0;
      for (const v of cells.values()) if (v === t) n++;
      return n;
    },
  };
}

/**
 * Piso sólido contínuo em `y`, de -r a r nos dois eixos. Um bloco solto NÃO serve de piso:
 * o fluido corretamente escorrega pela beirada dele, que é justamente a mecânica em teste.
 */
function floorAt(y: number, r = 12, block = B.STONE): Record<string, number> {
  const cells: Record<string, number> = {};
  for (let x = -r; x <= r; x++) {
    for (let z = -r; z <= r; z++) cells[`${x},${y},${z}`] = block;
  }
  return cells;
}

/** Roda a simulação até estabilizar, com teto para não mascarar um loop infinito como sucesso. */
function settle(fluids: FluidSystem, maxSteps = 400): number {
  let steps = 0;
  while (fluids.pendingCount > 0 && steps < maxSteps) {
    fluids.step();
    steps++;
  }
  return steps;
}

describe('FluidSystem — queda', () => {
  it('um voxel de água cai até encostar no chão', () => {
    const w = grid({ ...floorAt(0), '0,5,0': B.WATER });
    const f = new FluidSystem(w);
    f.activate(0, 5, 0);
    settle(f);

    expect(w.getBlock(0, 5, 0)).toBe(B.AIR);
    expect(w.getBlock(0, 1, 0)).toBe(B.WATER);
  });

  it('a massa é conservada: nunca cria um voxel de fluido novo', () => {
    const w = grid({ ...floorAt(0), '0,4,0': B.WATER, '0,5,0': B.WATER, '0,6,0': B.WATER });
    const f = new FluidSystem(w);
    for (const y of [4, 5, 6]) f.activate(0, y, 0);
    settle(f);

    expect(w.count(B.WATER)).toBe(3);
  });

  it('não atravessa bloco sólido', () => {
    const w = grid({ ...floorAt(0), '0,1,0': B.WATER });
    const f = new FluidSystem(w);
    f.activate(0, 1, 0);
    settle(f);

    expect(w.getBlock(0, 1, 0)).toBe(B.WATER);
    expect(w.getBlock(0, 0, 0)).toBe(B.STONE);
  });
});

describe('FluidSystem — escoamento finito (o requisito: nada de fonte infinita)', () => {
  /** Plataforma sólida em y=0, de -40 a 40 nos dois eixos. */
  function platform(): ReturnType<typeof grid> {
    return grid(floorAt(0, 40));
  }

  it('a poça para de crescer: um voxel jamais cobre o plano inteiro', () => {
    const w = platform();
    w.setBlock(0, 1, 0, B.WATER);
    const f = new FluidSystem(w);
    f.activate(0, 1, 0);

    const steps = settle(f);

    expect(steps).toBeLessThan(400); // terminou de verdade, não foi cortado pelo teto
    expect(w.count(B.WATER)).toBe(1); // continua sendo UM voxel — só mudou de lugar
    expect(f.pendingCount).toBe(0);
  });

  it('o alcance lateral respeita o orçamento de espalhamento', () => {
    const w = platform();
    w.setBlock(0, 1, 0, B.WATER);
    const f = new FluidSystem(w);
    f.activate(0, 1, 0);
    settle(f);

    // Achando onde o voxel parou, a distância de Manhattan até a origem não pode passar do orçamento.
    let found: [number, number] | null = null;
    for (const [key, v] of w.cells) {
      if (v !== B.WATER) continue;
      const [x, , z] = key.split(',').map(Number);
      found = [x, z];
    }
    expect(found).not.toBeNull();
    expect(Math.abs(found![0]) + Math.abs(found![1])).toBeLessThanOrEqual(WATER_SPREAD);
  });

  it('a água procura a beirada e despenca em vez de ficar no platô', () => {
    // Plataforma só até x=2; em x=3 há um abismo até o chão em y=0.
    const cells: Record<string, number> = {};
    for (let x = 0; x <= 2; x++) cells[`${x},5,0`] = B.STONE;
    for (let x = 0; x <= 6; x++) cells[`${x},0,0`] = B.STONE;
    const w = grid(cells);

    w.setBlock(0, 6, 0, B.WATER);
    const f = new FluidSystem(w);
    f.activate(0, 6, 0);
    settle(f);

    // Achou a beirada, saiu do topo da plataforma e desceu — sem se multiplicar.
    expect(w.count(B.WATER)).toBe(1);
    let finalY = Infinity;
    for (const [key, v] of w.cells) {
      if (v === B.WATER) finalY = Number(key.split(',')[1]);
    }
    expect(finalY).toBeLessThan(5);
  });

  it('lava escorre menos que água (viscosidade)', () => {
    expect(maxSpreadFor(B.LAVA)).toBe(LAVA_SPREAD);
    expect(maxSpreadFor(B.WATER)).toBe(WATER_SPREAD);
    expect(LAVA_SPREAD).toBeLessThan(WATER_SPREAD);
  });

  it('atravessa vegetação decorativa em vez de ficar presa nela', () => {
    const w = grid({ ...floorAt(0), '0,1,0': B.TALL_GRASS, '0,3,0': B.WATER });
    const f = new FluidSystem(w);
    f.activate(0, 3, 0);
    settle(f);

    expect(w.getBlock(0, 1, 0)).toBe(B.WATER);
  });
});

describe('FluidSystem — interação água/lava', () => {
  it('água caindo sobre lava transforma a lava em obsidiana', () => {
    const w = grid({ '0,0,0': B.STONE, '0,1,0': B.LAVA, '0,2,0': B.WATER });
    const f = new FluidSystem(w);
    f.activate(0, 2, 0);
    f.step();

    expect(w.getBlock(0, 1, 0)).toBe(B.OBSIDIAN);
    expect(w.getBlock(0, 2, 0)).toBe(B.WATER); // a água permanece
  });

  it('lava escorrendo contra água também solidifica', () => {
    // Lava encaixotada: a água em (1,1,0) é a ÚNICA direção livre, senão a lava prefere a beirada.
    const w = grid({
      ...floorAt(0, 2),
      '-1,1,0': B.STONE, '0,1,1': B.STONE, '0,1,-1': B.STONE,
      '1,1,0': B.WATER, '0,1,0': B.LAVA,
    });
    const f = new FluidSystem(w);
    f.activate(0, 1, 0);
    f.step();

    expect(w.getBlock(1, 1, 0)).toBe(B.OBSIDIAN);
  });
});

describe('FluidSystem — reativação', () => {
  it('quebrar o bloco debaixo de uma poça parada faz a água voltar a escoar', () => {
    const w = grid({ ...floorAt(0), '0,1,0': B.WATER });
    const f = new FluidSystem(w);
    f.activate(0, 1, 0);
    settle(f);
    expect(f.pendingCount).toBe(0);

    w.setBlock(0, 0, 0, B.AIR); // jogador cava embaixo
    f.disturb(0, 0, 0);
    expect(f.pendingCount).toBeGreaterThan(0);

    settle(f);
    expect(w.getBlock(0, 0, 0)).toBe(B.WATER);
    expect(w.getBlock(0, 1, 0)).toBe(B.AIR);
  });

  it('step() sem nada ativo é barato e não altera o mundo', () => {
    const w = grid({ '0,0,0': B.STONE });
    const f = new FluidSystem(w);
    expect(f.step()).toEqual([]);
    expect(w.cells.size).toBe(1);
  });

  it('activate ignora célula que não é fluido', () => {
    const w = grid({ '0,0,0': B.STONE });
    const f = new FluidSystem(w);
    f.activate(0, 0, 0);
    f.activate(5, 5, 5);
    expect(f.pendingCount).toBe(0);
  });
});

describe('findSlideTarget — ângulo de repouso da areia', () => {
  it('não escorrega quando o monte é plano e estável', () => {
    const w = grid({
      '0,0,0': B.STONE, '1,0,0': B.STONE, '-1,0,0': B.STONE,
      '0,0,1': B.STONE, '0,0,-1': B.STONE,
      '0,1,0': B.SAND,
    });
    expect(findSlideTarget(w, 0, 1, 0)).toBeNull();
  });

  it('escorrega na diagonal quando há um degrau vazio ao lado', () => {
    // Areia em (0,1,0) apoiada; ao lado (1,1,0) está livre e (1,0,0) também → íngreme demais.
    const w = grid({ '0,0,0': B.STONE, '0,1,0': B.SAND });
    const target = findSlideTarget(w, 0, 1, 0);

    expect(target).not.toBeNull();
    expect(target!.y).toBe(0);
    expect(Math.abs(target!.x) + Math.abs(target!.z)).toBe(1);
  });

  it('não escorrega se o lado está livre mas o degrau abaixo é sólido (encosta apoiada)', () => {
    const w = grid({
      '0,0,0': B.STONE, '0,1,0': B.SAND,
      '1,0,0': B.STONE, '-1,0,0': B.STONE, '0,0,1': B.STONE, '0,0,-1': B.STONE,
    });
    // Os quatro lados em y=1 estão livres, mas todos têm chão sólido em y=0.
    expect(findSlideTarget(w, 0, 1, 0)).toBeNull();
  });

  it('o desempate muda a direção escolhida, evitando viés sempre para o mesmo lado', () => {
    const w = grid({ '0,0,0': B.STONE, '0,1,0': B.SAND });
    const a = findSlideTarget(w, 0, 1, 0, 0)!;
    const b = findSlideTarget(w, 0, 1, 0, 1)!;
    expect([a.x, a.z]).not.toEqual([b.x, b.z]);
  });

  it('um voxel isolado em terreno plano NÃO rasteja: fica onde caiu', () => {
    const w = grid({ ...floorAt(0), '0,1,0': B.WATER });
    const f = new FluidSystem(w);
    f.activate(0, 1, 0);
    settle(f);
    expect(w.getBlock(0, 1, 0)).toBe(B.WATER);
  });

  it('uma coluna empilhada se nivela numa poça larga (pressão de cima)', () => {
    const w = grid({ ...floorAt(0), '0,1,0': B.WATER, '0,2,0': B.WATER, '0,3,0': B.WATER });
    const f = new FluidSystem(w);
    for (const y of [1, 2, 3]) f.activate(0, y, 0);
    settle(f);

    expect(w.count(B.WATER)).toBe(3);
    // Não sobrou coluna de 3 de altura: a água se espalhou lateralmente.
    expect(w.getBlock(0, 3, 0)).toBe(B.AIR);
  });

  it('escorrega para dentro de vegetação decorativa (o tufo é soterrado)', () => {
    const w = grid({ '0,0,0': B.STONE, '0,1,0': B.SAND, '1,1,0': B.TALL_GRASS });
    const target = findSlideTarget(w, 0, 1, 0, 0);
    expect(target).toMatchObject({ x: 1, y: 0, z: 0 });
  });
});
