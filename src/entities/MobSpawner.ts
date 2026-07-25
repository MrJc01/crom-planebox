// Decide onde e quando surgem inimigos hostis.
//
// A regra central é o **nível de luz**: hostis só nascem no escuro. É isso que transforma o
// motor de luz da rodada anterior em mecânica de jogo — a tocha deixa de ser decoração e vira
// ferramenta de controle de território, e a caverna passa a ser perigosa por ser escura, não
// por um contador arbitrário de profundidade.
//
// Módulo puro: recebe uma interface mínima de mundo e uma fonte de aleatoriedade injetável,
// para os testes poderem fixar a semente e verificar cada regra isoladamente.

import { B, isSolid } from '../world/blocks';
import { skyOf, blockOf } from '../world/lighting';
import { MOB_KINDS, MobKind } from './Combat';

export interface SpawnWorld {
  getBlock(x: number, y: number, z: number): number;
  /** Luz empacotada `(sol << 4) | bloco`, como em `src/world/lighting.ts`. */
  getLight(x: number, y: number, z: number): number;
}

/** Acima deste nível de luz efetiva, nada hostil nasce. */
export const SPAWN_LIGHT_THRESHOLD = 6;
/** Não nasce a menos que isto do jogador — evita o mob materializar na cara dele. */
export const MIN_SPAWN_DISTANCE = 14;
/** Nem além disto: fora do alcance visível é desperdício de simulação. */
export const MAX_SPAWN_DISTANCE = 42;
/** Teto de hostis simultâneos. */
export const MAX_HOSTILES = 18;
/** Segundos entre tentativas de spawn. */
export const SPAWN_INTERVAL = 4;

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  kind: MobKind;
}

export interface SpawnContext {
  /** Fração do dia (0 = meia-noite, 0.5 = meio-dia). */
  timeOfDay: number;
  /** Intensidade solar atual, 0..1 — a mesma que o mesher usa. */
  sunScale: number;
  hostileCount: number;
  maxY: number;
}

/**
 * Luz efetiva numa célula, já considerando a hora: a luz de céu vale menos à noite.
 *
 * Sem esse ajuste, a superfície teria luz de céu 15 o tempo todo e **nada nasceria de noite** —
 * a mecânica inteira ficaria restrita a cavernas.
 */
export function effectiveLight(packed: number, sunScale: number): number {
  return Math.max(skyOf(packed) * sunScale, blockOf(packed));
}

/** A célula serve de berço? Precisa de chão sólido, dois voxels livres acima e estar escura. */
export function isSpawnable(world: SpawnWorld, x: number, y: number, z: number, sunScale: number): boolean {
  const ground = world.getBlock(x, y - 1, z);
  if (!isSolid(ground)) return false;

  // Espaço para o corpo. Sem isto o mob nasce entalado dentro da rocha e fica preso.
  if (world.getBlock(x, y, z) !== B.AIR) return false;
  if (world.getBlock(x, y + 1, z) !== B.AIR) return false;

  // Nada nasce dentro de fluido nem em cima de lava.
  if (ground === B.LAVA || ground === B.WATER) return false;

  return effectiveLight(world.getLight(x, y, z), sunScale) <= SPAWN_LIGHT_THRESHOLD;
}

/**
 * Procura um ponto de spawn válido perto do jogador.
 *
 * Faz um número limitado de sorteios e desiste — insistir até achar travaria o frame num mundo
 * todo iluminado, que é exatamente a situação em que o jogo *não deve* gerar inimigos.
 */
export function findSpawnPoint(
  world: SpawnWorld,
  player: { x: number; y: number; z: number },
  ctx: SpawnContext,
  rng: () => number = Math.random,
  attempts = 24,
): SpawnPoint | null {
  if (ctx.hostileCount >= MAX_HOSTILES) return null;

  for (let i = 0; i < attempts; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = MIN_SPAWN_DISTANCE + rng() * (MAX_SPAWN_DISTANCE - MIN_SPAWN_DISTANCE);

    const x = Math.floor(player.x + Math.cos(angle) * dist);
    const z = Math.floor(player.z + Math.sin(angle) * dist);

    // Varre uma faixa vertical ao redor da altura do jogador: pega tanto a superfície quanto o
    // andar de caverna logo abaixo dele, sem escanear a coluna inteira a cada tentativa.
    const y0 = Math.max(1, Math.floor(player.y) - 20);
    const y1 = Math.min(ctx.maxY - 2, Math.floor(player.y) + 12);

    for (let y = y1; y >= y0; y--) {
      if (!isSpawnable(world, x, y, z, ctx.sunScale)) continue;
      const kind = MOB_KINDS[Math.floor(rng() * MOB_KINDS.length)] ?? 'zumbi';
      return { x: x + 0.5, y, z: z + 0.5, kind };
    }
  }

  return null;
}

/**
 * Mantém o ritmo de spawn. Separado da busca para o `main` só precisar chamar `update(dt)` e
 * receber um ponto quando for a hora.
 */
export class MobSpawner {
  private timer = 0;
  /** Desligável — o modo criativo e o modo clássico não devem gerar hostis. */
  public enabled = true;

  public update(
    dt: number,
    world: SpawnWorld,
    player: { x: number; y: number; z: number },
    ctx: SpawnContext,
    rng: () => number = Math.random,
  ): SpawnPoint | null {
    if (!this.enabled) return null;

    this.timer += dt;
    if (this.timer < SPAWN_INTERVAL) return null;
    this.timer = 0;

    return findSpawnPoint(world, player, ctx, rng);
  }

  public reset(): void {
    this.timer = 0;
  }
}
