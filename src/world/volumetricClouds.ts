// Camada 3D de nuvens volumétricas lentas acima do horizonte de render — itens 057, 1621-1623.
import * as THREE from 'three';
import { Value3 } from '../core/noise';

export interface VolumetricCloudsOptions {
  altitude?: number;
  thickness?: number;
  size?: number;
  seed?: number;
}

export class VolumetricClouds {
  public group: THREE.Group;
  private noise: Value3;
  private altitude: number;
  private size: number;
  private thickness: number;
  private cloudMesh: THREE.InstancedMesh | null = null;
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene, options: VolumetricCloudsOptions = {}) {
    this.group = new THREE.Group();
    this.altitude = options.altitude ?? 72; // metros acima do mar
    this.thickness = options.thickness ?? 8;
    this.size = options.size ?? 128;
    this.noise = new Value3(options.seed ?? 98765);

    scene.add(this.group);
    this.generateClouds();
  }

  public generateClouds(densityFactor = 1.0): void {
    if (this.cloudMesh) {
      this.group.remove(this.cloudMesh);
      this.cloudMesh.geometry.dispose();
      (this.cloudMesh.material as THREE.Material).dispose();
      this.cloudMesh = null;
    }

    const cloudVoxels: { x: number; y: number; z: number }[] = [];
    const step = 4; // Resolução dos blocos de nuvem em metros
    const threshold = 0.55 / Math.max(0.1, densityFactor);

    for (let x = -this.size / 2; x < this.size / 2; x += step) {
      for (let z = -this.size / 2; z < this.size / 2; z += step) {
        for (let y = 0; y < this.thickness; y += step) {
          const val = this.noise.fbm((x + 500) * 0.02, y * 0.05, (z + 500) * 0.02, 2);
          if (val > threshold) {
            cloudVoxels.push({ x, y: this.altitude + y, z });
          }
        }
      }
    }

    if (cloudVoxels.length === 0) return;

    const geo = new THREE.BoxGeometry(step, step, step);
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75 * Math.min(1.0, densityFactor),
      depthWrite: false,
    });

    this.cloudMesh = new THREE.InstancedMesh(geo, mat, cloudVoxels.length);

    for (let i = 0; i < cloudVoxels.length; i++) {
      const v = cloudVoxels[i];
      this.dummy.position.set(v.x, v.y, v.z);
      this.dummy.updateMatrix();
      this.cloudMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.cloudMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.cloudMesh);
  }

  /** Move as nuvens lentamente pelo céu de acordo com a velocidade do vento/tempo. */
  public update(dt: number, windSpeed = 1.5): void {
    this.group.position.x += windSpeed * dt;
    if (this.group.position.x > this.size / 2) {
      this.group.position.x = -this.size / 2;
    }
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    if (this.cloudMesh) {
      this.cloudMesh.geometry.dispose();
      (this.cloudMesh.material as THREE.Material).dispose();
    }
  }
}
