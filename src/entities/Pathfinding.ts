// Busca de caminho A* em grade de voxels, para os hostis contornarem obstáculos.
//
// A rodada anterior deu colisão aos mobs — eles pararam de atravessar rocha —, mas eles ainda
// perseguiam em linha reta. Bastava o jogador se esconder atrás de uma quina em L para o mob
// encostar na parede e travar ali. Isso era o teto da qualidade do combate.
//
// Módulo puro: recebe uma interface mínima de mundo, sem Three.js. O custo é controlado por um
// orçamento de nós — num mundo voxel é sempre possível construir um labirinto que esgote
// qualquer busca, e travar o frame é pior que o mob não achar o caminho.

import { B, isSolid } from '../world/blocks';

export interface PathWorld {
  getBlock(x: number, y: number, z: number): number;
}

export interface PathNode {
  x: number;
  y: number;
  z: number;
}

export interface PathOptions {
  /** Máximo de nós expandidos antes de desistir. Protege o frame. */
  maxNodes?: number;
  /** Altura de degrau que a criatura sobe sem pular. */
  stepUp?: number;
  /** Queda máxima tolerada sem dano. */
  maxDrop?: number;
  /** Distância de Manhattan além da qual nem tenta. */
  maxDistance?: number;
}

const DEFAULTS: Required<PathOptions> = {
  maxNodes: 900,
  stepUp: 1,
  maxDrop: 3,
  maxDistance: 48,
};

/** Direções horizontais. Sem diagonais: elas atravessam quina entre dois blocos sólidos. */
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * A criatura consegue ficar de pé aqui? Precisa de chão sólido e dois voxels livres.
 * `y` é a posição dos pés.
 */
export function canStand(world: PathWorld, x: number, y: number, z: number): boolean {
  if (y <= 0) return false;
  if (!isSolid(world.getBlock(x, y - 1, z))) return false;
  if (isSolid(world.getBlock(x, y, z))) return false;
  if (isSolid(world.getBlock(x, y + 1, z))) return false;
  // Lava é intransponível de propósito: um mob que se joga na lava para alcançar o jogador
  // parece quebrado, não inteligente.
  if (world.getBlock(x, y - 1, z) === B.LAVA) return false;
  return true;
}

/**
 * A partir de (x,y,z), qual altura a criatura assume ao se mover para (nx,nz)?
 * Devolve o `y` de destino, ou `null` se o passo é impossível.
 */
export function stepTo(
  world: PathWorld,
  y: number,
  nx: number,
  nz: number,
  stepUp: number,
  maxDrop: number,
): number | null {
  // Mesmo nível.
  if (canStand(world, nx, y, nz)) return y;

  // Subir degrau: precisa de espaço livre acima da cabeça atual para não "atravessar" o teto.
  for (let up = 1; up <= stepUp; up++) {
    if (isSolid(world.getBlock(nx, y + 1 + up, nz))) break;
    if (canStand(world, nx, y + up, nz)) return y + up;
  }

  // Descer: cai até encontrar chão, dentro do limite tolerado.
  for (let down = 1; down <= maxDrop; down++) {
    if (canStand(world, nx, y - down, nz)) return y - down;
    if (isSolid(world.getBlock(nx, y - down - 1, nz))) break; // bateu em chão inválido
  }

  return null;
}

/** Heurística: distância de Manhattan. Admissível na grade sem diagonais, então A* é ótimo. */
function heuristic(a: PathNode, b: PathNode): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
}

interface OpenEntry {
  key: string;
  x: number;
  y: number;
  z: number;
  g: number;
  f: number;
}

/**
 * Fila de prioridade binária. Uma lista ordenada seria mais simples, mas o `sort` a cada
 * inserção domina o custo justamente nos casos difíceis, que é onde o orçamento importa.
 */
class MinHeap {
  private items: OpenEntry[] = [];

  get size(): number {
    return this.items.length;
  }

  push(entry: OpenEntry): void {
    this.items.push(entry);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].f <= this.items[i].f) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): OpenEntry | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let smallest = i;
        if (l < this.items.length && this.items[l].f < this.items[smallest].f) smallest = l;
        if (r < this.items.length && this.items[r].f < this.items[smallest].f) smallest = r;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

/**
 * Caminho de `start` até `goal`, ou `null` se não houver dentro do orçamento.
 *
 * O resultado **não inclui** o nó inicial: são os passos a seguir. Quando o alvo exato não é
 * alcançável (o jogador pulou num pilar, por exemplo), devolve o caminho até o ponto explorado
 * mais próximo dele — chegar perto é infinitamente melhor que ficar parado.
 */
export function findPath(
  world: PathWorld,
  start: PathNode,
  goal: PathNode,
  options: PathOptions = {},
): PathNode[] | null {
  const opt = { ...DEFAULTS, ...options };

  const s = { x: Math.floor(start.x), y: Math.floor(start.y), z: Math.floor(start.z) };
  const g = { x: Math.floor(goal.x), y: Math.floor(goal.y), z: Math.floor(goal.z) };

  if (heuristic(s, g) > opt.maxDistance) return null;
  if (s.x === g.x && s.y === g.y && s.z === g.z) return [];

  const open = new MinHeap();
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  const nodes = new Map<string, PathNode>();

  const sKey = key(s.x, s.y, s.z);
  gScore.set(sKey, 0);
  nodes.set(sKey, s);
  open.push({ key: sKey, ...s, g: 0, f: heuristic(s, g) });

  let expanded = 0;
  let bestKey = sKey;
  let bestH = heuristic(s, g);

  while (open.size > 0 && expanded < opt.maxNodes) {
    const current = open.pop()!;
    // Entrada obsoleta: já achamos um caminho melhor até aqui depois de enfileirar esta.
    if ((gScore.get(current.key) ?? Infinity) < current.g) continue;

    expanded++;

    if (current.x === g.x && current.y === g.y && current.z === g.z) {
      return reconstruct(cameFrom, nodes, current.key, sKey);
    }

    const h = heuristic(current, g);
    if (h < bestH) {
      bestH = h;
      bestKey = current.key;
    }

    for (const [dx, dz] of DIRS) {
      const nx = current.x + dx, nz = current.z + dz;
      const ny = stepTo(world, current.y, nx, nz, opt.stepUp, opt.maxDrop);
      if (ny === null) continue;

      const nKey = key(nx, ny, nz);
      // Subir e descer custam um pouco mais: o caminho plano é preferido quando ambos servem.
      const cost = 1 + Math.abs(ny - current.y) * 0.4;
      const tentative = current.g + cost;

      if (tentative >= (gScore.get(nKey) ?? Infinity)) continue;

      gScore.set(nKey, tentative);
      cameFrom.set(nKey, current.key);
      const node = { x: nx, y: ny, z: nz };
      nodes.set(nKey, node);
      open.push({ key: nKey, ...node, g: tentative, f: tentative + heuristic(node, g) });
    }
  }

  // Sem caminho completo: entrega o melhor progresso conseguido, se houver algum.
  if (bestKey !== sKey) return reconstruct(cameFrom, nodes, bestKey, sKey);
  return null;
}

function reconstruct(
  cameFrom: Map<string, string>,
  nodes: Map<string, PathNode>,
  endKey: string,
  startKey: string,
): PathNode[] {
  const path: PathNode[] = [];
  let k: string | undefined = endKey;
  while (k && k !== startKey) {
    const n = nodes.get(k);
    if (n) path.push(n);
    k = cameFrom.get(k);
  }
  return path.reverse();
}
