// Controlador first-person: pointer lock, AABB vs voxels, pulo, nado, voo.
import * as THREE from 'three';
import { World } from '../world/world';
import { isSolid, B } from '../world/blocks';

// unidades em MINI-VOXELS (3 por metro): jogador de 1,75 m ≈ 5,3 voxels
const W = 0.95;       // meia-largura (~0,32 m)
const HEIGHT = 5.3;
const EYE = 4.9;
const GRAV = 84;      // 28 m/s² × 3
const JUMP = 24;      // pulo de ~1,1 m
const WALK = 16.8;    // 5,6 m/s
const SPRINT = 27;
const FLY = 60;
const SWIM = 10;

export class PlayerController {
  pos = new THREE.Vector3(0, 40, 0);
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;
  flying = false;
  noclip = false;
  inWater = false;
  keys = new Set<string>();
  stamina = 1;

  constructor(private world: World, private camera: THREE.PerspectiveCamera) {}

  /** lockTarget: o elemento que recebe o pointer lock (o canvas do renderer). */
  attachInput(lockTarget: Element): void {
    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyF') {
        this.flying = !this.flying;
        this.vel.set(0, 0, 0);
      }
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== lockTarget) return;
      this.yaw -= e.movementX * 0.0024;
      this.pitch -= e.movementY * 0.0024;
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
    });
  }

  private collides(px: number, py: number, pz: number): boolean {
    const x0 = Math.floor(px - W), x1 = Math.floor(px + W);
    const y0 = Math.floor(py), y1 = Math.floor(py + HEIGHT - 0.001);
    const z0 = Math.floor(pz - W), z1 = Math.floor(pz + W);
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (isSolid(this.world.getBlock(x, y, z))) return true;
        }
      }
    }
    return false;
  }

  update(dt: number): void {
    dt = Math.min(dt, 0.05);
    const k = this.keys;

    // olhar pelas setas (fallback quando não há pointer lock)
    const look = 2.2 * dt;
    if (k.has('ArrowLeft')) this.yaw += look;
    if (k.has('ArrowRight')) this.yaw -= look;
    if (k.has('ArrowUp')) this.pitch = Math.min(1.55, this.pitch + look);
    if (k.has('ArrowDown')) this.pitch = Math.max(-1.55, this.pitch - look);

    // direção de movimento no plano
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = 0, mz = 0;
    if (k.has('KeyW')) { mx -= sin; mz -= cos; }
    if (k.has('KeyS')) { mx += sin; mz += cos; }
    if (k.has('KeyA')) { mx -= cos; mz += sin; }
    if (k.has('KeyD')) { mx += cos; mz -= sin; }
    const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }

    // dentro d'água? (bloco na altura do peito)
    const chest = this.world.getBlock(
      Math.floor(this.pos.x), Math.floor(this.pos.y + HEIGHT * 0.55), Math.floor(this.pos.z));
    this.inWater = chest === B.WATER;
    const headBlock = this.world.getBlock(
      Math.floor(this.pos.x), Math.floor(this.pos.y + EYE), Math.floor(this.pos.z));
    const headUnder = headBlock === B.WATER;

    const sprinting = k.has('ShiftLeft') && !this.flying && this.onGround && ml > 0 && this.stamina > 0.05;
    if (sprinting) this.stamina = Math.max(0, this.stamina - dt * 0.22);
    else this.stamina = Math.min(1, this.stamina + dt * 0.3);

    if (this.flying) {
      const spd = FLY;
      this.vel.x = mx * spd;
      this.vel.z = mz * spd;
      this.vel.y = (k.has('Space') ? spd * 0.8 : 0) + (k.has('ShiftLeft') ? -spd * 0.8 : 0);
    } else if (this.inWater) {
      const spd = SWIM;
      this.vel.x += (mx * spd - this.vel.x) * Math.min(1, dt * 8);
      this.vel.z += (mz * spd - this.vel.z) * Math.min(1, dt * 8);
      this.vel.y -= GRAV * 0.12 * dt;
      if (k.has('Space')) this.vel.y += GRAV * 0.42 * dt;
      this.vel.y = Math.max(-10, Math.min(13, this.vel.y));
    } else {
      const spd = sprinting ? SPRINT : WALK;
      const accel = this.onGround ? 12 : 4;
      this.vel.x += (mx * spd - this.vel.x) * Math.min(1, dt * accel);
      this.vel.z += (mz * spd - this.vel.z) * Math.min(1, dt * accel);
      this.vel.y -= GRAV * dt;
      if (k.has('Space') && this.onGround) {
        this.vel.y = JUMP;
        this.onGround = false;
      }
    }

    // integração com resolução de colisão eixo a eixo
    const p = this.pos;
    const step = (dx: number, dy: number, dz: number) => {
      if (this.noclip) {
        p.x += dx;
        p.y += dy;
        p.z += dz;
        return;
      }

      // eixo X
      if (dx !== 0) {
        if (!this.collides(p.x + dx, p.y, p.z)) p.x += dx;
        else {
          // auto-step de 1 bloco (subir degrau) quando no chão
          if (this.onGround && dy === 0 && !this.collides(p.x + dx, p.y + 1.05, p.z) &&
              !this.collides(p.x, p.y + 1.05, p.z)) {
            p.y += 1.05; p.x += dx;
          } else this.vel.x = 0;
        }
      }
      // eixo Z
      if (dz !== 0) {
        if (!this.collides(p.x, p.y, p.z + dz)) p.z += dz;
        else {
          if (this.onGround && dy === 0 && !this.collides(p.x, p.y + 1.05, p.z + dz) &&
              !this.collides(p.x, p.y + 1.05, p.z)) {
            p.y += 1.05; p.z += dz;
          } else this.vel.z = 0;
        }
      }
      // eixo Y
      if (dy !== 0) {
        if (!this.collides(p.x, p.y + dy, p.z)) {
          p.y += dy;
          this.onGround = false;
        } else {
          if (dy < 0) this.onGround = true;
          this.vel.y = 0;
        }
      }
    };

    // sub-passos para não atravessar blocos em quedas rápidas
    const total = Math.max(Math.abs(this.vel.x), Math.abs(this.vel.y), Math.abs(this.vel.z)) * dt;
    const substeps = Math.max(1, Math.ceil(total / 0.8));
    for (let i = 0; i < substeps; i++) {
      step(this.vel.x * dt / substeps, 0, this.vel.z * dt / substeps);
      step(0, this.vel.y * dt / substeps, 0);
    }

    if (!this.noclip) {
      if (this.vel.y !== 0) this.onGround = false;
      if (this.collides(p.x, p.y - 0.02, p.z)) this.onGround = true;
    }

    // nunca cair do mundo
    if (p.y < -8) { p.y = 140; this.vel.set(0, 0, 0); }

    // câmera
    this.camera.position.set(p.x, p.y + EYE, p.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);

    // FOV dinâmico ao correr
    const targetFov = sprinting ? 78 : 72;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
      this.camera.updateProjectionMatrix();
    }

    void headUnder;
  }
}
