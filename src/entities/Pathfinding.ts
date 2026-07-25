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
 * Cache de rotas.
 *
 * Vários mobs perseguem o MESMO jogador, no MESMO terreno, recalculando a cada 0,35 s. As
 * consultas se repetem muito, e cada uma refazia a busca do zero. Isto é memoização de estado —
 * a ideia que o artigo do crompressor mede como ganho ao deduplicar estados repetidos em
 * simulação, aplicada aqui sem depender de nada externo.
 *
 * A chave arredonda o alvo para uma célula: dois mobs perseguindo o jogador que andou meio voxel
 * devem reaproveitar a mesma rota. O TTL curto existe porque o terreno muda — um mod ou o
 * jogador pode abrir uma passagem, e uma rota velha ficaria contornando uma parede que não
 * existe mais.
 */
const CACHE_TTL_MS = 900;
const CACHE_MAX = 128;
/** Célula de agregação do alvo, em voxels. Maior = mais acerto, rota menos precisa. */
const GOAL_CELL = 2;

interface CacheEntry {
  path: PathNode[] | null;
  expiraEm: number;
}

const routeCache = new Map<string, CacheEntry>();
const cacheStats = { hits: 0, misses: 0 };

/** Estatísticas de reaproveitamento, para medir antes de concluir qualquer coisa. */
export function getPathCacheStats(): { hits: number; misses: number; hitRate: number; size: number } {
  const total = cacheStats.hits + cacheStats.misses;
  return {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate: total > 0 ? cacheStats.hits / total : 0,
    size: routeCache.size,
  };
}

export function resetPathCache(): void {
  routeCache.clear();
  cacheStats.hits = 0;
  cacheStats.misses = 0;
}

/** Invalida tudo: chamado quando o mundo muda de forma que possa abrir ou fechar passagem. */
export function invalidatePathCache(): void {
  routeCache.clear();
}

/**
 * Caminho de `start` até `goal`, ou `null` se não houver dentro do orçamento.
 *
 * O resultado **não inclui** o nó inicial: são os passos a seguir. Quando o alvo exato não é
 * alcançável (o jogador pulou num pilar, por exemplo), devolve o caminho até o ponto explorado
 * mais próximo dele — chegar perto é infinitamente melhor que ficar parado.
 */
/**
 * Versão com memoização. É a que a IA das criaturas usa; `findPath` continua puro e direto,
 * para os testes verificarem o algoritmo sem cache no caminho.
 */
export function findPathCached(
  world: PathWorld,
  start: PathNode,
  goal: PathNode,
  options: PathOptions = {},
  agora = Date.now(),
): PathNode[] | null {
  const sx = Math.floor(start.x), sy = Math.floor(start.y), sz = Math.floor(start.z);
  const gx = Math.floor(goal.x / GOAL_CELL), gy = Math.floor(goal.y / GOAL_CELL), gz = Math.floor(goal.z / GOAL_CELL);
  const chave = `${sx},${sy},${sz}>${gx},${gy},${gz}`;

  const cacheado = routeCache.get(chave);
  if (cacheado && cacheado.expiraEm > agora) {
    cacheStats.hits++;
    // Cópia: quem consome consome os waypoints com `shift()`, e mutar o cache
    // faria a próxima criatura receber uma rota pela metade.
    return cacheado.path ? cacheado.path.map((n) => ({ ...n })) : null;
  }

  cacheStats.misses++;
  const path = findPath(world, start, goal, options);

  if (routeCache.size >= CACHE_MAX) {
    // Descarte simples do mais antigo: o Map do JS mantém ordem de inserção.
    const maisAntigo = routeCache.keys().next().value;
    if (maisAntigo !== undefined) routeCache.delete(maisAntigo);
  }
  routeCache.set(chave, { path, expiraEm: agora + CACHE_TTL_MS });

  return path ? path.map((n) => ({ ...n })) : null;
}

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
