import { describe, it, expect } from 'vitest';
import { B } from '../../src/world/blocks';
import { PathWorld, canStand, findPath, stepTo } from '../../src/entities/Pathfinding';

/**
 * Mundo de teste: chão sólido em y=0, ar acima. Paredes são adicionadas à mão.
 * O "andar" jogável fica em y=1 (pés) e y=2 (cabeça).
 */
function world(): PathWorld & { wall(x: number, z: number, altura?: number): void; set(x: number, y: number, z: number, t: number): void } {
  const blocks = new Map<string, number>();
  const k = (x: number, y: number, z: number) => `${x},${y},${z}`;
  return {
    set(x, y, z, t) { blocks.set(k(x, y, z), t); },
    wall(x, z, altura = 3) {
      for (let y = 1; y <= altura; y++) blocks.set(k(x, y, z), B.STONE);
    },
    getBlock(x, y, z) {
      const explicit = blocks.get(k(x, y, z));
      if (explicit !== undefined) return explicit;
      return y <= 0 ? B.STONE : B.AIR;
    },
  };
}

/** O caminho é contíguo (cada passo é adjacente ao anterior)? */
function isContiguous(path: { x: number; y: number; z: number }[], start: { x: number; y: number; z: number }): boolean {
  let prev = start;
  for (const n of path) {
    const d = Math.abs(n.x - prev.x) + Math.abs(n.z - prev.z);
    if (d !== 1) return false;
    prev = n;
  }
  return true;
}

describe('canStand — onde a criatura cabe', () => {
  it('aceita chão sólido com dois voxels livres', () => {
    expect(canStand(world(), 0, 1, 0)).toBe(true);
  });

  it('recusa sem chão', () => {
    expect(canStand(world(), 0, 5, 0)).toBe(false);
  });

  it('recusa quando falta espaço para a cabeça', () => {
    const w = world();
    w.set(0, 2, 0, B.STONE);
    expect(canStand(w, 0, 1, 0)).toBe(false);
  });

  it('recusa dentro de bloco sólido', () => {
    const w = world();
    w.set(0, 1, 0, B.STONE);
    expect(canStand(w, 0, 1, 0)).toBe(false);
  });

  it('recusa ficar em cima de lava — mob não deve se suicidar para alcançar o jogador', () => {
    const w = world();
    w.set(0, 0, 0, B.LAVA);
    expect(canStand(w, 0, 1, 0)).toBe(false);
  });

  it('recusa abaixo do fundo do mundo', () => {
    expect(canStand(world(), 0, 0, 0)).toBe(false);
  });
});

describe('stepTo — subir degrau e descer', () => {
  it('anda no plano', () => {
    expect(stepTo(world(), 1, 1, 0, 1, 3)).toBe(1);
  });

  it('sobe um degrau de 1 voxel', () => {
    const w = world();
    w.set(1, 1, 0, B.STONE); // degrau
    expect(stepTo(w, 1, 1, 0, 1, 3)).toBe(2);
  });

  it('não sobe degrau de 2 quando só pode subir 1', () => {
    const w = world();
    w.set(1, 1, 0, B.STONE);
    w.set(1, 2, 0, B.STONE);
    expect(stepTo(w, 1, 1, 0, 1, 3)).toBeNull();
  });

  it('desce de uma plataforma até o chão, dentro do limite de queda', () => {
    const w = world();
    // Plataforma em x=0 subindo até y=4; em x=1 o terreno é o chão padrão (pés em y=1).
    for (let y = 1; y <= 3; y++) w.set(0, y, 0, B.STONE);
    expect(stepTo(w, 4, 1, 0, 1, 3)).toBe(1);
  });

  it('não desce queda maior que o limite tolerado', () => {
    const w = world();
    for (let y = 1; y <= 8; y++) w.set(0, y, 0, B.STONE);
    // De y=9 até o chão em y=1 são 8 de queda, acima do maxDrop=3.
    expect(stepTo(w, 9, 1, 0, 1, 3)).toBeNull();
  });

  it('recusa passo contra parede alta', () => {
    const w = world();
    w.wall(1, 0, 6);
    expect(stepTo(w, 1, 1, 0, 1, 3)).toBeNull();
  });
});

describe('findPath — caminho básico', () => {
  it('devolve caminho vazio quando já está no destino', () => {
    expect(findPath(world(), { x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0 })).toEqual([]);
  });

  it('anda em linha reta em terreno aberto', () => {
    const p = findPath(world(), { x: 0, y: 1, z: 0 }, { x: 5, y: 1, z: 0 })!;
    expect(p).not.toBeNull();
    expect(p[p.length - 1]).toMatchObject({ x: 5, z: 0 });
    expect(p.length).toBe(5); // ótimo: 5 passos
  });

  it('o caminho é contíguo — nenhum salto entre voxels não adjacentes', () => {
    const start = { x: 0, y: 1, z: 0 };
    const p = findPath(world(), start, { x: 6, y: 1, z: 4 })!;
    expect(isContiguous(p, start)).toBe(true);
  });

  it('todo passo do caminho é um lugar onde a criatura cabe', () => {
    const w = world();
    for (let z = -2; z <= 2; z++) w.wall(3, z);
    const p = findPath(w, { x: 0, y: 1, z: 0 }, { x: 6, y: 1, z: 0 })!;
    expect(p).not.toBeNull();
    for (const n of p) expect(canStand(w, n.x, n.y, n.z), `passo inválido em ${n.x},${n.y},${n.z}`).toBe(true);
  });

  it('desiste quando o destino está longe demais', () => {
    expect(findPath(world(), { x: 0, y: 1, z: 0 }, { x: 500, y: 1, z: 500 })).toBeNull();
  });
});

describe('findPath — o caso que travava o mob', () => {
  it('CRÍTICO: contorna uma parede em vez de encostar nela e parar', () => {
    const w = world();
    // Parede em x=3, de z=-4 a z=4, com passagem só por fora (|z| > 4).
    for (let z = -4; z <= 4; z++) w.wall(3, z);

    const start = { x: 0, y: 1, z: 0 };
    const p = findPath(w, start, { x: 6, y: 1, z: 0 })!;

    expect(p).not.toBeNull();
    expect(p[p.length - 1]).toMatchObject({ x: 6, z: 0 });

    // Prova de que deu a volta: precisou se afastar do eixo z=0.
    const desvioMax = Math.max(...p.map((n) => Math.abs(n.z)));
    expect(desvioMax).toBeGreaterThan(4);

    // E nunca atravessou a parede.
    for (const n of p) expect(w.getBlock(n.x, n.y, n.z)).not.toBe(B.STONE);
  });

  it('contorna quina em L — o caso exato do jogador se escondendo no canto', () => {
    const w = world();
    for (let z = 0; z <= 5; z++) w.wall(2, z);
    for (let x = 2; x <= 5; x++) w.wall(x, 5);

    const start = { x: 0, y: 1, z: 3 };
    const p = findPath(w, start, { x: 4, y: 1, z: 3 })!;

    expect(p).not.toBeNull();
    expect(isContiguous(p, start)).toBe(true);
    for (const n of p) expect(canStand(w, n.x, n.y, n.z)).toBe(true);
  });

  it('sobe escada de degraus até o alvo elevado', () => {
    const w = world();
    for (let i = 1; i <= 4; i++) {
      for (let y = 1; y <= i; y++) w.set(i, y, 0, B.STONE);
    }

    const p = findPath(w, { x: 0, y: 1, z: 0 }, { x: 4, y: 5, z: 0 })!;
    expect(p).not.toBeNull();
    expect(p[p.length - 1].y).toBe(5);
  });

  it('sem rota possível, entrega o melhor progresso em vez de ficar parado', () => {
    const w = world();
    // Alvo lacrado dentro de uma caixa de pedra.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) w.wall(5 + dx, 0 + dz, 4);

    const p = findPath(w, { x: 0, y: 1, z: 0 }, { x: 5, y: 1, z: 0 });
    expect(p).not.toBeNull();
    expect(p!.length).toBeGreaterThan(0);
    // Chegou perto do alvo, mesmo sem alcançá-lo.
    const ultimo = p![p!.length - 1];
    expect(Math.abs(ultimo.x - 5) + Math.abs(ultimo.z)).toBeLessThan(5);
  });
});

describe('findPath — orçamento e robustez', () => {
  it('respeita o teto de nós: nunca trava o frame num labirinto', () => {
    const w = world();
    // Grade densa de pilares — força a busca a explorar muito.
    for (let x = -20; x <= 20; x += 2) {
      for (let z = -20; z <= 20; z += 2) w.wall(x, z);
    }

    const inicio = Date.now();
    const p = findPath(w, { x: 1, y: 1, z: 1 }, { x: 19, y: 1, z: 19 }, { maxNodes: 300 });
    const decorrido = Date.now() - inicio;

    expect(decorrido).toBeLessThan(200); // volta rápido, com ou sem rota
    if (p) expect(isContiguous(p, { x: 1, y: 1, z: 1 })).toBe(true);
  });

  it('aceita coordenadas fracionárias arredondando para o voxel', () => {
    const p = findPath(world(), { x: 0.7, y: 1.2, z: 0.3 }, { x: 3.9, y: 1.1, z: 0.8 });
    expect(p).not.toBeNull();
  });

  it('é determinístico: a mesma consulta dá o mesmo caminho', () => {
    const w = world();
    for (let z = -3; z <= 3; z++) w.wall(2, z);
    const a = findPath(w, { x: 0, y: 1, z: 0 }, { x: 5, y: 1, z: 0 });
    const b = findPath(w, { x: 0, y: 1, z: 0 }, { x: 5, y: 1, z: 0 });
    expect(a).toEqual(b);
  });
});
