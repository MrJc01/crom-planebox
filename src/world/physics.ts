// Física do mundo voxel:
//  - blocos com gravidade (areia/cascalho) viram entidades caindo e re-assentam
//  - colapso estrutural: estrutura sem caminho até apoio natural desaba inteira
//  - derrubada de árvores: cortar o tronco faz a copa toda cair em pedaços
//  - água preenche cavidades expostas abaixo do nível do mar (propagação animada)

import * as THREE from 'three';
import { World } from './world';
import { B, BLOCKS, isSolid, isSupport, isLog, isLeaves, isDecor, isReplaceable } from './blocks';
import { WATER_LEVEL } from './worldgen';
import { CY } from './chunk';

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
  /** callback para conceder recursos ao jogador (ex.: árvore derrubada) */
  onDrop: (blockType: number, count: number) => void = () => {};

  constructor(private world: World, scene: THREE.Scene) {
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
            // água invade célula vazia abaixo do nível do mar
            if (y <= WATER_LEVEL && this.touchesWater(x, y, z)) {
              this.waterQueue.push([x, y, z]);
            }
            continue;
          }
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
    // gravidade de areia/cascalho
    let budget = 80;
    while (this.gravityQueue.length > 0 && budget-- > 0) {
      const [x, y, z] = this.gravityQueue.shift()!;
      const t = this.world.getBlock(x, y, z);
      if (!BLOCKS[t]?.gravity) continue;
      const below = this.world.getBlock(x, y - 1, z);
      if (below === B.AIR || below === B.WATER || isDecor(below)) {
        this.world.setBlock(x, y, z, B.AIR, false);
        this.spawnDebris(t, x, y, z, 'settle');
        this.onBlockChanged(x, y, z);
      }
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
