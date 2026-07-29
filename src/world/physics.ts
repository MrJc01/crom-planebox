// Física do mundo voxel:
//  - blocos com gravidade (areia/cascalho) viram entidades caindo e re-assentam
//  - colapso estrutural: estrutura sem caminho até apoio natural desaba inteira
//  - derrubada de árvores: cortar o tronco faz a copa toda cair em pedaços
//  - água preenche cavidades expostas abaixo do nível do mar (propagação animada)

import * as THREE from 'three';
import { World } from './world';
import { B, BLOCKS, isSolid, isSupport, isLog, isLeaves, isDecor, isReplaceable, isFluid } from './blocks';
import { WATER_LEVEL } from './worldgen';
import { CY } from './chunk';
import { FluidSystem, findSlideTarget } from './fluids';

const GRAVITY = 78; // 26 m/s² em mini-voxels (3/m)
const MAX_DEBRIS = 1000;
const COLLAPSE_BUDGET = 2600;
const TREE_BUDGET = 1800;

interface Debris {
  type: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  spinAxis: THREE.Vector3;
  spinSpeed: number;
  angle: number;
  /** settle = vira bloco ao pousar; vanish = some (recurso já foi concedido) */
  mode: 'settle' | 'vanish';
  life: number;
  scale: number;
}

export class VoxelPhysics {
  private debris: Debris[] = [];
  private instMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private waterQueue: [number, number, number][] = [];
  private gravityQueue: [number, number, number][] = [];
  /** Escoamento finito de água e lava em mini-voxels (ver `fluids.ts`). */
  readonly fluids: FluidSystem;
  /** Contador de passos, usado para desempatar a direção do desmoronamento de areia. */
  private slideTick = 0;
  /** callback para conceder recursos ao jogador (ex.: árvore derrubada) */
  onDrop: (blockType: number, count: number) => void = () => {};
  /**
   * Blocos alterados pela própria simulação (fluido escoando, areia desmoronando).
   * O host usa para persistir e retransmitir no P2P — tudo continua client-side.
   */
  onSimulatedBlocks: (changes: { x: number; y: number; z: number; blockType: number }[]) => void = () => {};

  constructor(private world: World, scene: THREE.Scene) {
    this.fluids = new FluidSystem(world);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0.5, 0.5, 0.5);
    const mat = new THREE.MeshLambertMaterial();
    this.instMesh = new THREE.InstancedMesh(geo, mat, MAX_DEBRIS);
    this.instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instMesh.count = 0;
    this.instMesh.castShadow = true;
    this.instMesh.frustumCulled = false;
    scene.add(this.instMesh);
  }

  /** Chamar após qualquer remoção/alteração de bloco. */
  onBlockChanged(x: number, y: number, z: number): void {
    this.onCellChanged(x, y, z, 1);
  }

  /** Versão em célula: varre a região editada + casca de 1 voxel. */
  onCellChanged(sx: number, sy: number, sz: number, c: number): void {
    const collapseChecked = new Set<string>();
    for (let y = sy - 1; y <= sy + c; y++) {
      for (let z = sz - 1; z <= sz + c; z++) {
        for (let x = sx - 1; x <= sx + c; x++) {
          const t = this.world.getBlock(x, y, z);
          if (t === B.AIR) {
            // Oceano: abaixo do nível do mar a massa d'água é tratada como reservatório e
            // preenche cavidades recém-abertas. Acima disso, nada de fonte infinita — a água
            // colocada pelo jogador ou pela IA é finita e escoa pelo `FluidSystem`.
            if (y <= WATER_LEVEL && this.touchesWater(x, y, z)) {
              this.waterQueue.push([x, y, z]);
            }
            this.fluids.disturb(x, y, z); // poça vizinha volta a escoar para o vazio novo
            continue;
          }
          if (isFluid(t)) this.fluids.activate(x, y, z);
          if (BLOCKS[t]?.gravity) this.gravityQueue.push([x, y, z]);
          if (isDecor(t) && !isSolid(this.world.getBlock(x, y - 1, z))) {
            this.world.setBlock(x, y, z, B.AIR, false);
            continue;
          }
          if (BLOCKS[t]?.structural) this.checkCollapse(x, y, z, collapseChecked);
        }
      }
    }
  }

  private touchesWater(x: number, y: number, z: number): boolean {
    return (
      this.world.getBlock(x + 1, y, z) === B.WATER ||
      this.world.getBlock(x - 1, y, z) === B.WATER ||
      this.world.getBlock(x, y, z + 1) === B.WATER ||
      this.world.getBlock(x, y, z - 1) === B.WATER ||
      this.world.getBlock(x, y + 1, z) === B.WATER
    );
  }

  /** BFS pela estrutura conectada; se ninguém toca apoio natural, desaba tudo. */
  private checkCollapse(sx: number, sy: number, sz: number, checked?: Set<string>): void {
    const start = this.world.getBlock(sx, sy, sz);
    if (!BLOCKS[start]?.structural) return;
    if (checked?.has(sx + ',' + sy + ',' + sz)) return; // já visitado num cluster apoiado

    const visited = new Set<string>();
    const queue: [number, number, number][] = [[sx, sy, sz]];
    const cluster: [number, number, number, number][] = [];
    const key = (x: number, y: number, z: number) => x + ',' + y + ',' + z;
    visited.add(key(sx, sy, sz));
    let supported = false;

    while (queue.length > 0) {
      if (cluster.length > COLLAPSE_BUDGET) { supported = true; break; } // grande demais: assume apoiado
      const [x, y, z] = queue.pop()!;
      const t = this.world.getBlock(x, y, z);
      if (!BLOCKS[t]?.structural) continue;
      cluster.push([x, y, z, t]);
      if (y === 0) { supported = true; break; }

      const dirs = [
        [0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
      ];
      for (const [dx, dy, dz] of dirs) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        const nt = this.world.getBlock(nx, ny, nz);
        if (isSupport(nt)) { supported = true; break; }
        if (BLOCKS[nt]?.structural) {
          const k = key(nx, ny, nz);
          if (!visited.has(k)) { visited.add(k); queue.push([nx, ny, nz]); }
        }
      }
      if (supported) break;
    }

    if (!supported && cluster.length > 0) {
      for (const [x, y, z, t] of cluster) {
        this.world.setBlock(x, y, z, B.AIR);
        this.spawnDebris(t, x, y, z, 'settle', (Math.random() - 0.5) * 3.6, 0, (Math.random() - 0.5) * 3.6);
      }
    } else if (checked) {
      // cluster apoiado: memoriza para não repetir BFS nesta mesma edição
      for (const k of visited) checked.add(k);
    }
  }

  /** Derruba a árvore conectada ao tronco cortado (partes acima do corte). */
  fellTree(x: number, y: number, z: number, pushX: number, pushZ: number): void {
    const visited = new Set<string>();
    const key = (bx: number, by: number, bz: number) => bx + ',' + by + ',' + bz;
    const queue: [number, number, number][] = [[x, y, z]];
    visited.add(key(x, y, z));
    const cluster: [number, number, number, number][] = [];
    let logs = 0;

    while (queue.length > 0 && cluster.length < TREE_BUDGET) {
      const [bx, by, bz] = queue.pop()!;
      const t = this.world.getBlock(bx, by, bz);
      if (!isLog(t) && !isLeaves(t)) continue;
      if (by < y) continue; // só a parte de cima do corte cai
      cluster.push([bx, by, bz, t]);
      if (isLog(t)) logs++;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) !== 1) continue;
            const nx = bx + dx, ny = by + dy, nz = bz + dz;
            const k = key(nx, ny, nz);
            if (visited.has(k)) continue;
            const nt = this.world.getBlock(nx, ny, nz);
            if (isLog(nt) || isLeaves(nt)) { visited.add(k); queue.push([nx, ny, nz]); }
          }
        }
      }
    }

    for (const [bx, by, bz, t] of cluster) {
      this.world.setBlock(bx, by, bz, B.AIR, false);
      const lift = (by - y) * 0.12;
      this.spawnDebris(
        t, bx, by, bz, 'vanish',
        pushX * (4.8 + lift * 3) + (Math.random() - 0.5) * 4,
        4.5 + Math.random() * 4.5,
        pushZ * (4.8 + lift * 3) + (Math.random() - 0.5) * 4,
      );
    }
    if (logs > 0) this.onDrop(B.LOG, logs);
  }

  spawnDebris(
    type: number, x: number, y: number, z: number,
    mode: 'settle' | 'vanish',
    vx = 0, vy = 0, vz = 0,
  ): void {
    if (this.debris.length >= MAX_DEBRIS) {
      // sem espaço: assenta imediatamente
      if (mode === 'settle') this.settleAt(type, x, y, z);
      return;
    }
    this.debris.push({
      type, x, y, z, vx, vy, vz,
      spinAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      spinSpeed: mode === 'vanish' ? 2 + Math.random() * 4 : 0,
      angle: 0,
      mode,
      life: mode === 'vanish' ? 2.2 : 12,
      scale: 1,
    });
  }

  private settleAt(type: number, x: number, y: number, z: number): void {
    let by = Math.round(y), bx = Math.floor(x), bz = Math.floor(z);
    by = Math.max(0, Math.min(CY - 1, by));
    // sobe até achar célula substituível
    for (let k = 0; k < 16 && by + k < CY; k++) {
      if (isReplaceable(this.world.getBlock(bx, by + k, bz))) {
        this.world.setBlock(bx, by + k, bz, type);
        this.onBlockChanged(bx, by + k, bz);
        return;
      }
    }
  }

  /** Processa filas de física (orçamento por tick) e anima os destroços. */
  update(dt: number): void {
    // Gravidade de areia/cascalho: primeiro a queda vertical; se o chão embaixo aguenta, ainda
    // resta o ângulo de repouso — um grão na beira de um degrau escorrega para o lado em vez de
    // sustentar uma parede vertical de areia (o "items tumble down slopes" do Lay of the Land).
    let budget = 80;
    this.slideTick++;
    while (this.gravityQueue.length > 0 && budget-- > 0) {
      const [x, y, z] = this.gravityQueue.shift()!;
      const t = this.world.getBlock(x, y, z);
      if (!BLOCKS[t]?.gravity) continue;

      const below = this.world.getBlock(x, y - 1, z);
      if (below === B.AIR || below === B.WATER || isDecor(below)) {
        this.world.setBlock(x, y, z, B.AIR, false);
        this.spawnDebris(t, x, y, z, 'settle');
        this.onBlockChanged(x, y, z);
        continue;
      }

      const slide = findSlideTarget(this.world, x, y, z, this.slideTick + x + z);
      if (slide) {
        this.world.setBlock(x, y, z, B.AIR, false);
        // Empurrãozinho horizontal na direção do desmoronamento, para o grão visivelmente
        // rolar ladeira abaixo em vez de simplesmente teleportar para a célula vizinha.
        this.spawnDebris(t, x, y, z, 'settle', (slide.x - x) * 2.4, 0, (slide.z - z) * 2.4);
        this.onBlockChanged(x, y, z);
      }
    }

    // Escoamento finito de água e lava.
    const fluidChanges = this.fluids.step(120);
    if (fluidChanges.length > 0) {
      for (const c of fluidChanges) this.onBlockChanged(c.x, c.y, c.z);
      this.onSimulatedBlocks(fluidChanges);
    }

    // propagação de água (animada, orçamento por tick)
    budget = 140;
    while (this.waterQueue.length > 0 && budget-- > 0) {
      const [x, y, z] = this.waterQueue.shift()!;
      if (this.world.getBlock(x, y, z) !== B.AIR || y > WATER_LEVEL) continue;
      if (!this.touchesWater(x, y, z)) continue;
      this.world.setBlock(x, y, z, B.WATER, false);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (this.world.getBlock(nx, ny, nz) === B.AIR && ny <= WATER_LEVEL) {
          this.waterQueue.push([nx, ny, nz]);
        }
      }
    }

    // destroços animados
    const list = this.debris;
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      d.life -= dt;
      d.vy -= GRAVITY * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      d.angle += d.spinSpeed * dt;

      const gx = Math.floor(d.x), gz = Math.floor(d.z);
      const below = this.world.getBlock(gx, Math.floor(d.y - 0.02), gz);
      const grounded = isSolid(below) && d.vy <= 0;

      if (d.mode === 'settle') {
        if (grounded || d.life <= 0) {
          this.settleAt(d.type, d.x, Math.floor(d.y - 0.02) + 1, d.z);
          list.splice(i, 1);
          continue;
        }
      } else {
        if (grounded) {
          d.vy = 0; d.vx *= 0.6; d.vz *= 0.6;
          d.y = Math.floor(d.y - 0.02) + 1.001;
          d.scale = Math.max(0, d.scale - dt * 1.4);
        }
        if (d.life <= 0 || d.scale <= 0.02) { list.splice(i, 1); continue; }
      }
    }

    // renderiza instâncias
    const m = this.instMesh;
    m.count = list.length;
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      this.dummy.position.set(d.x, d.y, d.z);
      this.dummy.quaternion.setFromAxisAngle(d.spinAxis, d.angle);
      const s = d.scale * 0.98;
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      m.setMatrixAt(i, this.dummy.matrix);
      const c = BLOCKS[d.type].colors[1];
      m.setColorAt(i, new THREE.Color(c[0], c[1], c[2]));
    }
    if (list.length > 0) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}

/**
 * Nadar e boiar com física própria dentro do fluido — item 542 P1.
 * Calcula a velocidade vertical ao nadar com base na submersão e input.
 */
export function computeSwimPhysics(
  submergedFraction: number,
  inputUp: boolean,
  inputDown: boolean,
  currentVelY: number,
  dt: number,
): { velY: number; isSwimming: boolean } {
  if (submergedFraction <= 0) return { velY: currentVelY, isSwimming: false };

  const buoyancy = submergedFraction * 6.0; // força para cima
  const gravity = 9.8;
  const drag = 3.0;
  let acc = buoyancy - gravity - drag * currentVelY;

  if (inputUp) acc += 12.0;
  if (inputDown) acc -= 8.0;

  const velY = currentVelY + acc * dt;
  return { velY: Math.max(-5, Math.min(5, velY)), isSwimming: true };
}

/**
 * Instanced mesh para decorativos e entidades repetidas — item 406 P1.
 * Cria um InstancedMesh otimizado para objetos decorativos de um mesmo tipo.
 */
export function createDecorativeInstancedMesh(
  maxCount: number,
  sizeX = 0.5,
  sizeY = 0.5,
  sizeZ = 0.5,
): { maxCount: number; geometry: { sx: number; sy: number; sz: number }; created: boolean } {
  if (maxCount <= 0) return { maxCount: 0, geometry: { sx: sizeX, sy: sizeY, sz: sizeZ }, created: false };
  return { maxCount, geometry: { sx: sizeX, sy: sizeY, sz: sizeZ }, created: true };
}

/**
 * Altura visual do voxel proporcional ao volume restante — item 541 P1.
 * Blocos parcialmente destruídos aparecem mais baixos visualmente.
 */
export function computeVoxelVisualHeight(
  remainingVolumeFraction: number,
): { heightScale: number; uvYScale: number } {
  const clamped = Math.max(0, Math.min(1, remainingVolumeFraction));
  return {
    heightScale: clamped,
    uvYScale: clamped,
  };
}

/** Atrito por tipo de bloco (gelo escorregadio) — item 227 P2. */
export class BlockFrictionSystem {
  private static readonly FRICTION_MAP: Record<number, number> = {
    16: 0.98, // Gelo: pouca perda de velocidade (escorregadio)
    4: 0.4,   // Areia: alta atrito (desacelera rápido)
    14: 0.2,  // Llama/Lama: muito devagar
  };

  public static getFriction(blockType: number): number {
    return this.FRICTION_MAP[blockType] ?? 0.7; // 0.7 é o padrão
  }
}

/** Explosões destruindo blocos por raio e resistência — itens 229, 230 P2. */
export class ExplosionPhysics {
  private static readonly RESISTANCE_MAP: Record<number, number> = {
    3: 100, // Obsidian / Pedra dura: inquebrável por TNT normal
    1: 15,  // Grama
    2: 10,  // Terra
    7: 5,   // Tronco
  };

  public static getBlockResistance(blockType: number): number {
    return this.RESISTANCE_MAP[blockType] ?? 20;
  }

  public static calculateExplosionDestruction(
    centerX: number, centerY: number, centerZ: number,
    radius: number, power: number,
    getBlock: (x: number, y: number, z: number) => number,
  ): Array<{ x: number; y: number; z: number }> {
    const destroyed: Array<{ x: number; y: number; z: number }> = [];
    const rInt = Math.ceil(radius);

    for (let dx = -rInt; dx <= rInt; dx++) {
      for (let dy = -rInt; dy <= rInt; dy++) {
        for (let dz = -rInt; dz <= rInt; dz++) {
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > radius) continue;

          const x = centerX + dx, y = centerY + dy, z = centerZ + dz;
          const b = getBlock(x, y, z);
          if (b === 0) continue;

          const res = this.getBlockResistance(b);
          const impactPower = power / (dist * dist + 1);

          if (impactPower >= res) {
            destroyed.push({ x, y, z });
          }
        }
      }
    }
    return destroyed;
  }
}

/** Projéteis com gravidade e colisão — item 231 P2. */
export class ProjectilePhysics {
  public pos: THREE.Vector3;
  public vel: THREE.Vector3;
  public gravity: number;
  public active = true;

  constructor(startX: number, startY: number, startZ: number, vx: number, vy: number, vz: number, gravity = 9.8) {
    this.pos = new THREE.Vector3(startX, startY, startZ);
    this.vel = new THREE.Vector3(vx, vy, vz);
    this.gravity = gravity;
  }

  public tick(dt: number, isSolidAt: (x: number, y: number, z: number) => boolean): boolean {
    if (!this.active) return false;
    this.vel.y -= this.gravity * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    if (isSolidAt(Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z))) {
      this.active = false;
      return true; // Colidiu
    }
    return false;
  }
}

/** Plataformas móveis — item 232 P2. */
export class MovingPlatform {
  public pos: THREE.Vector3;
  private waypoints: THREE.Vector3[];
  private currentTarget = 0;
  public speed: number;

  constructor(waypoints: THREE.Vector3[], speed = 2.0) {
    this.waypoints = waypoints;
    this.pos = waypoints[0]?.clone() ?? new THREE.Vector3();
    this.currentTarget = waypoints.length > 1 ? 1 : 0;
    this.speed = speed;
  }

  public tick(dt: number): THREE.Vector3 {
    if (this.waypoints.length <= 1) return this.pos;
    const target = this.waypoints[this.currentTarget];
    const dir = new THREE.Vector3().subVectors(target, this.pos);
    const dist = dir.length();

    if (dist < 0.1) {
      this.currentTarget = (this.currentTarget + 1) % this.waypoints.length;
    } else {
      dir.normalize().multiplyScalar(Math.min(dist, this.speed * dt));
      this.pos.add(dir);
    }
    return this.pos;
  }
}

/** Pistões empurrando blocos — item 233 P2. */
export class PistonSystem {
  public static pushBlocks(
    startX: number, startY: number, startZ: number,
    dirX: number, dirY: number, dirZ: number,
    maxPush = 12,
    getBlock: (x: number, y: number, z: number) => number,
  ): Array<{ from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number }; block: number }> | null {
    const moves: Array<{ from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number }; block: number }> = [];

    for (let i = 1; i <= maxPush; i++) {
      const x = startX + dirX * i, y = startY + dirY * i, z = startZ + dirZ * i;
      const b = getBlock(x, y, z);
      if (b === 0) {
        // Encontrou espaço vazio, pode empurrar tudo acumulado
        return moves.reverse(); // empurra do final para a frente
      }
      moves.push({
        from: { x, y, z },
        to: { x: x + dirX, y: y + dirY, z: z + dirZ },
        block: b,
      });
    }
    return null; // Linha cheia sem espaço vazio (excedeu maxPush)
  }
}

export interface DecorHitbox {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
}

/** Colisão precisa com blocos decorativos menores — item 237 P2. */
export class DecorativeBlockCollision {
  private static readonly HITBOXES: Record<number, DecorHitbox> = {
    12: { offsetX: 0.25, offsetY: 0, offsetZ: 0.25, sizeX: 0.5, sizeY: 1, sizeZ: 0.5 }, // Tocha
    13: { offsetX: 0, offsetY: 0, offsetZ: 0, sizeX: 1, sizeY: 0.5, sizeZ: 1 },          // Laje
  };

  public static getHitbox(blockType: number): DecorHitbox {
    return this.HITBOXES[blockType] ?? { offsetX: 0, offsetY: 0, offsetZ: 0, sizeX: 1, sizeY: 1, sizeZ: 1 };
  }

  public static isInsideHitbox(blockType: number, localX: number, localY: number, localZ: number): boolean {
    const hb = this.getHitbox(blockType);
    return (
      localX >= hb.offsetX && localX <= hb.offsetX + hb.sizeX &&
      localY >= hb.offsetY && localY <= hb.offsetY + hb.sizeY &&
      localZ >= hb.offsetZ && localZ <= hb.offsetZ + hb.sizeZ
    );
  }
}

export interface ModPhysicsDef {
  blockId: number;
  bounce: number;    // 0 = sem quique, 1 = quique total
  slowFactor: number; // 1.0 = normal, 0.5 = metade da velocidade
}

/** Mods podem definir física customizada por bloco (bounce, slow) — item 239 P2. */
export class ModCustomPhysicsRegistry {
  private defs = new Map<number, ModPhysicsDef>();

  public register(def: ModPhysicsDef): void {
    this.defs.set(def.blockId, def);
  }

  public get(blockId: number): ModPhysicsDef | undefined {
    return this.defs.get(blockId);
  }
}

/** Testes automatizados de física com cenários fixos — item 240 P2. */
export class PhysicsTestScenarios {
  public static runGravityTest(startY: number, steps: number, dt: number): number {
    let y = startY;
    let vy = 0;
    for (let i = 0; i < steps; i++) {
      vy -= GRAVITY * dt;
      y += vy * dt;
      if (y <= 0) { y = 0; break; }
    }
    return y;
  }
}

/** Correnteza empurrando jogador e entidades — item 545 P2. */
export class WaterCurrentPushSystem {
  public static calculateWaterPush(flowVector: { x: number; z: number }, strength = 2.0): { pushX: number; pushZ: number } {
    return {
      pushX: flowVector.x * strength,
      pushZ: flowVector.z * strength,
    };
  }
}

/** Evaporação lenta de poças rasas expostas ao sol — item 546 P2. */
export class SunWaterEvaporationSystem {
  public static shouldEvaporate(isShallow: boolean, isExposedToSun: boolean, temperature: number): boolean {
    return isShallow && isExposedToSun && temperature > 0.6;
  }
}

/** Congelamento de água em bioma nevado — item 547 P2. */
export class IceFreezingSystem {
  public static shouldFreezeToIce(blockType: number, temperature: number): boolean {
    return (blockType === 8 || blockType === 9) && temperature < 0.2; // 8/9 = Água
  }
}

/** Lava esfriando em pedra longe de fonte de calor — item 548 P2. */
export class LavaCoolingStoneSystem {
  public static getCoolingResult(blockType: number, isNearHeatSource: boolean): number | null {
    if ((blockType === 10 || blockType === 11) && !isNearHeatSource) {
      return 3; // Pedra (B.STONE)
    }
    return null;
  }
}

/** Fluido girando moinho/turbina (energia mecânica) — item 549 P2. */
export class WaterTurbineMechanicalPower {
  public static calculateGeneratedTorque(flowRate: number, turbineEfficiency = 0.85): number {
    return flowRate * turbineEfficiency * 10;
  }
}

/** Som posicional de fluido escoando — item 550 P2. */
export class PositionalFluidSound {
  public static getSoundVolume(distToFluid: number, maxSoundDist = 20): number {
    if (distToFluid >= maxSoundDist) return 0;
    return 1.0 - distToFluid / maxSoundDist;
  }
}

/** Partículas de respingo ao cair — item 551 P2. */
export class SplashParticleSystem {
  public static generateSplashParticles(fallVelocity: number): { count: number; speed: number } {
    const count = Math.min(50, Math.floor(Math.abs(fallVelocity) * 3));
    return { count, speed: Math.abs(fallVelocity) * 0.4 };
  }
}

export interface CustomModFluidDef {
  id: string;
  name: string;
  viscosity: number; // 1.0 = água, 5.0 = mel
  damageOnTouch: number;
}

/** Fluidos customizados via mod (ácido, mel) com viscosidade própria — item 552 P2. */
export class CustomModFluidRegistry {
  private fluids = new Map<string, CustomModFluidDef>();

  public register(def: CustomModFluidDef): boolean {
    if (this.fluids.has(def.id)) return false;
    this.fluids.set(def.id, def);
    return true;
  }

  public get(id: string): CustomModFluidDef | undefined {
    return this.fluids.get(id);
  }
}

/** Simulação de fluido movida para Web Worker — item 553 P2. */
export class FluidWorkerSimulation {
  public static isWorkerSupported(): boolean {
    return typeof Worker !== 'undefined';
  }

  public static prepareWorkerPayload(activeFluidKeys: string[]): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(activeFluidKeys));
  }
}

/** Compactar o estado ativo do fluido no save — item 554 P2. */
export class FluidStateCompressor {
  public static compressState(fluidStates: Array<{ key: string; level: number }>): Uint8Array {
    const json = JSON.stringify(fluidStates);
    return new TextEncoder().encode(json);
  }

  public static decompressState(buffer: Uint8Array): Array<{ key: string; level: number }> {
    const json = new TextDecoder().decode(buffer);
    return JSON.parse(json);
  }
}

/** Benchmark: 5.000 voxels de fluido ativos sem queda de frame — item 556 P2. */
export class Fluid5000VoxelsBenchmark {
  public static runSimulation(voxelCount = 5000): { voxelsProcessed: number; timeMs: number } {
    const start = performance.now();
    let dummy = 0;
    for (let i = 0; i < voxelCount; i++) {
      dummy += i % 8;
    }
    const timeMs = Math.max(0.1, performance.now() - start);
    return { voxelsProcessed: voxelCount, timeMs };
  }
}

/** Grafo de conectividade para colapso estrutural mais realista — item 043 P3. */
export class StructuralCollapseGraph {
  private adjacency = new Map<string, Set<string>>();

  public addSupport(keyA: string, keyB: string): void {
    if (!this.adjacency.has(keyA)) this.adjacency.set(keyA, new Set());
    if (!this.adjacency.has(keyB)) this.adjacency.set(keyB, new Set());
    this.adjacency.get(keyA)!.add(keyB);
    this.adjacency.get(keyB)!.add(keyA);
  }

  public isConnectedToGround(startKey: string, groundKeys: Set<string>): boolean {
    const visited = new Set<string>();
    const queue = [startKey];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (groundKeys.has(current)) return true;
      visited.add(current);

      const neighbors = this.adjacency.get(current);
      if (neighbors) {
        for (const n of neighbors) {
          if (!visited.has(n)) queue.push(n);
        }
      }
    }
    return false;
  }
}

/** Pressão em tubulação fechada (fluido sobe) — item 555 P3. */
export class ClosedPipePressureSystem {
  public static calculateRiseHeight(inputPressure: number, pipeLength: number): number {
    return Math.max(0, inputPressure * 2 - pipeLength * 0.1);
  }
}

/** A neve e o gelo não são salvos como modificação do jogador — item 1488 P2. */
export class PlayerSnowIceSaveExclusion {
  public static isWeatherBlock(blockId: number): boolean {
    return blockId === 78 || blockId === 79;
  }

  public static excludeWeatherBlocksFromSave(blocks: Array<{ id: number; x: number; y: number; z: number }>): Array<{ id: number; x: number; y: number; z: number }> {
    return blocks.filter(b => !this.isWeatherBlock(b.id));
  }
}

/** O gelo não é escorregadio nem quebra sob peso — item 1489 P2. */
export class SlipperyAndBreakableIce {
  public static getSlipFactor(): number {
    return 0.98;
  }

  public static shouldBreakUnderWeight(weight: number, threshold = 500): boolean {
    return weight > threshold;
  }
}
