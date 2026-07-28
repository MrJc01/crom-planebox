// Projétil balístico de arco e flecha — item 148.
import * as THREE from 'three';
import { World } from '../world/world';
import { isSolid, B } from '../world/blocks';

export interface ArrowOptions {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed?: number;
  damage?: number;
  ownerId?: string;
}

export class ArrowProjectile {
  public pos: THREE.Vector3;
  public vel: THREE.Vector3;
  public damage: number;
  public ownerId: string;
  public mesh: THREE.Mesh;
  public alive = true;
  private gravity = 18; // m/s²

  constructor(scene: THREE.Scene, options: ArrowOptions) {
    this.pos = options.pos.clone();
    const speed = options.speed ?? 32;
    this.vel = options.dir.clone().normalize().multiplyScalar(speed);
    this.damage = options.damage ?? 15;
    this.ownerId = options.ownerId ?? 'player';

    // Geometria 3D da flecha (haste fina)
    const geo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 4);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xd97706 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
  }

  public update(dt: number, world: World, onHitEntity?: (x: number, y: number, z: number, damage: number) => boolean): void {
    if (!this.alive) return;

    // Aplicar gravidade balística
    this.vel.y -= this.gravity * dt;

    // Atualizar posição
    const nextPos = this.pos.clone().addScaledVector(this.vel, dt);

    // Testar colisão com o mundo (voxels sólidos)
    const bx = Math.floor(nextPos.x);
    const by = Math.floor(nextPos.y);
    const bz = Math.floor(nextPos.z);

    if (isSolid(world.getBlock(bx, by, bz))) {
      this.alive = false;
      this.mesh.visible = false;
      return;
    }

    // Testar acerto em entidades
    if (onHitEntity && onHitEntity(nextPos.x, nextPos.y, nextPos.z, this.damage)) {
      this.alive = false;
      this.mesh.visible = false;
      return;
    }

    this.pos.copy(nextPos);
    this.mesh.position.copy(this.pos);
    this.mesh.lookAt(this.pos.clone().add(this.vel));
  }

  public destroy(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
