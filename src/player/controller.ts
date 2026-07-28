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
  inLava = false;
  headUnder = false;
  /** Velocidade Y no instante do impacto com o chão (negativa = caindo), consumida pelo SurvivalSystem para dano de queda. */
  lastImpactVelY = 0;
  keys = new Set<string>();
  stamina = 1;
  isSprinting = false;

  /** Timestep fixo para física determinística independente do framerate — item 235. */
  public fixedTimestep = 1 / 60;
  public physicsAccumulator = 0;

  /** Deslocamento vertical estilo Bedrock ("sobe para o lugar") ao colocar blocos no chão — item 1004 P1. */
  public verticalPlacementOffset = false;

  /** Callback acionado ao cair no vão inferior (void) — item 1651. */
  public onVoidFall?: () => void;

  constructor(private world: World, private camera: THREE.PerspectiveCamera) {}

  /** Sweep test contínuo (Ray-AABB) para evitar atravessar paredes em alta velocidade — item 236. */
  public sweepTest(fromX: number, fromY: number, fromZ: number, toX: number, toY: number, toZ: number): boolean {
    const dist = Math.hypot(toX - fromX, toY - fromY, toZ - fromZ);
    if (dist < 0.01) return false;
    const steps = Math.ceil(dist / 0.4);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const curX = fromX + (toX - fromX) * t;
      const curY = fromY + (toY - fromY) * t;
      const curZ = fromZ + (toZ - fromZ) * t;
      if (this.collides(curX, curY, curZ)) return true;
    }
    return false;
  }

  /** Sensibilidade do mouse configurável — item 434. */
  public mouseSensitivity = 1.0;

  /** Mapeamento de teclas reconfigurável — item 432. */
  public keyMap: Record<string, string[]> = {
    forward: ['KeyW', 'ArrowUp'],
    backward: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    jump: ['Space'],
    sneak: ['ShiftLeft', 'ShiftRight'],
    sprint: ['ControlLeft', 'KeyR'],
  };

  /** Polling de entrada por gamepad (controle de videogame) — item 433. */
  public pollGamepad(dt: number): { moveX: number; moveZ: number; lookYaw: number; lookPitch: number } {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return { moveX: 0, moveZ: 0, lookYaw: 0, lookPitch: 0 };
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0];
    if (!gp) return { moveX: 0, moveZ: 0, lookYaw: 0, lookPitch: 0 };

    const deadzone = (val: number) => (Math.abs(val) > 0.15 ? val : 0);
    const moveX = deadzone(gp.axes[0] ?? 0);
    const moveZ = deadzone(gp.axes[1] ?? 0);
    const lookYaw = deadzone(gp.axes[2] ?? 0) * 2.0 * dt;
    const lookPitch = deadzone(gp.axes[3] ?? 0) * 2.0 * dt;

    if (gp.buttons[0]?.pressed) this.keys.add('Space');
    if (gp.buttons[10]?.pressed) this.isSprinting = true;

    this.yaw -= lookYaw;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - lookPitch));

    return { moveX, moveZ, lookYaw, lookPitch };
  }

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
      const factor = 0.0024 * this.mouseSensitivity;
      this.yaw -= e.movementX * factor;
      this.pitch -= e.movementY * factor;
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
    this.headUnder = headBlock === B.WATER;

    // contato com lava (pés ou peito) para o SurvivalSystem aplicar dano contínuo
    const feetBlock = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.2), Math.floor(this.pos.z));
    this.inLava = chest === B.LAVA || feetBlock === B.LAVA;

    const sprinting = k.has('ShiftLeft') && !this.flying && this.onGround && ml > 0 && this.stamina > 0.05;
    this.isSprinting = sprinting;
    if (sprinting) this.stamina = Math.max(0, this.stamina - dt * 0.22);
    else this.stamina = Math.min(1, this.stamina + dt * 0.3);

    const sneaking = (k.has('ShiftLeft') || k.has('KeyC')) && !this.flying && this.onGround && !sprinting;
    const isClimbing = !this.flying && (headBlock === B.REED || feetBlock === B.REED);

    if (this.flying) {
      const spd = FLY;
      this.vel.x = mx * spd;
      this.vel.z = mz * spd;
      this.vel.y = (k.has('Space') ? spd * 0.8 : 0) + (k.has('ShiftLeft') ? -spd * 0.8 : 0);
    } else if (isClimbing) {
      const spd = WALK * 0.6;
      this.vel.x = mx * spd;
      this.vel.z = mz * spd;
      this.vel.y = (k.has('Space') ? spd : (k.has('ShiftLeft') ? -spd : 0));
    } else if (this.inWater) {
      const spd = SWIM;
      this.vel.x += (mx * spd - this.vel.x) * Math.min(1, dt * 8);
      this.vel.z += (mz * spd - this.vel.z) * Math.min(1, dt * 8);
      this.vel.y -= GRAV * 0.12 * dt;
      if (k.has('Space')) this.vel.y += GRAV * 0.42 * dt;
      this.vel.y = Math.max(-10, Math.min(13, this.vel.y));
    } else {
      const spd = sprinting ? SPRINT : (sneaking ? WALK * 0.45 : WALK);
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
        if (!this.collides(p.x + dx, p.y, p.z)) {
          // Proteção de agachar (sneaking): não cair da borda
          if (sneaking && this.onGround && !this.collides(p.x + dx, p.y - 0.5, p.z)) {
            this.vel.x = 0;
          } else {
            p.x += dx;
          }
        } else {
          // auto-step de 1 bloco (subir degrau) quando no chão
          if (this.onGround && dy === 0 && !this.collides(p.x + dx, p.y + 1.05, p.z) &&
              !this.collides(p.x, p.y + 1.05, p.z)) {
            p.y += 1.05; p.x += dx;
          } else this.vel.x = 0;
        }
      }
      // eixo Z
      if (dz !== 0) {
        if (!this.collides(p.x, p.y, p.z + dz)) {
          if (sneaking && this.onGround && !this.collides(p.x, p.y - 0.5, p.z + dz)) {
            this.vel.z = 0;
          } else {
            p.z += dz;
          }
        } else {
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
          if (dy < 0) { this.onGround = true; this.lastImpactVelY = this.vel.y; }
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

    // Callback ao cair no vão — item 1651
    if (p.y < -25) {
      if (this.onVoidFall) {
        this.onVoidFall();
      } else {
        p.y = 140; this.vel.set(0, 0, 0);
      }
    }

    // câmera
    if (this.camera && this.camera.position) {
      this.camera.position.set(p.x, p.y + EYE, p.z);
      if (this.camera.rotation) {
        this.camera.rotation.set(0, 0, 0);
        this.camera.rotateY?.(this.yaw);
        this.camera.rotateX?.(this.pitch);
      }

      // FOV dinâmico ao correr
      const targetFov = sprinting ? 78 : 72;
      if (typeof this.camera.fov === 'number' && Math.abs(this.camera.fov - targetFov) > 0.1) {
        this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
        this.camera.updateProjectionMatrix?.();
      }
    }
  }
}

/**
 * Primeira pessoa mostrando braços e ferramenta na tela — item 594 P1.
 * Retorna a posição relativa e transformação da ferramenta/braço na tela.
 */
export function updateFirstPersonToolView(
  heldItem: string | null,
  swingProgress: number, // 0 a 1
): { visible: boolean; offset: { x: number; y: number; z: number }; rotation: { pitch: number; yaw: number; roll: number } } {
  if (!heldItem) {
    return {
      visible: true,
      offset: { x: 0.3, y: -0.2, z: -0.5 },
      rotation: { pitch: 0, yaw: 0, roll: 0 },
    };
  }

  // Animação de balanço (swing)
  const swingAngle = Math.sin(swingProgress * Math.PI) * 0.8;
  return {
    visible: true,
    offset: {
      x: 0.35 - swingAngle * 0.1,
      y: -0.25 - swingAngle * 0.15,
      z: -0.45 + swingAngle * 0.1,
    },
    rotation: {
      pitch: -swingAngle * 0.5,
      yaw: -swingAngle * 0.8,
      roll: swingAngle * 0.3,
    },
  };
}

/**
 * Peças de equipamento visíveis (capacete, peitoral) sobre o modelo — item 595 P1.
 * Retorna quais malhas de equipamento devem estar ativas no modelo 3D.
 */
export interface EquipmentSlots {
  head: string | null;
  chest: string | null;
  legs: string | null;
  feet: string | null;
}

export function renderEquipmentOverlay(
  equipment: EquipmentSlots,
): { slotsVisible: Record<keyof EquipmentSlots, boolean>; armorRating: number } {
  const armorRatings: Record<string, number> = {
    capacete_couro: 1,
    peitoral_couro: 3,
    capacete_ferro: 2,
    peitoral_ferro: 6,
    capacete_ouro: 2,
    peitoral_ouro: 5,
    capacete_diamante: 3,
    peitoral_diamante: 8,
  };

  let armorRating = 0;
  const slotsVisible = {
    head: Boolean(equipment.head),
    chest: Boolean(equipment.chest),
    legs: Boolean(equipment.legs),
    feet: Boolean(equipment.feet),
  };

  if (equipment.head) armorRating += armorRatings[equipment.head] || 1;
  if (equipment.chest) armorRating += armorRatings[equipment.chest] || 1;
  if (equipment.legs) armorRating += armorRatings[equipment.legs] || 1;
  if (equipment.feet) armorRating += armorRatings[equipment.feet] || 1;

  return { slotsVisible, armorRating };
}

