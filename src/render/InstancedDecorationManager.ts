// Gerenciamento instanciado de elementos decorativos (flores, plantas, pedras) — item 066.
import * as THREE from 'three';

export interface DecorationInstance {
  x: number;
  y: number;
  z: number;
  scale?: number;
  colorHex?: number;
}

export class InstancedDecorationManager {
  public group: THREE.Group;
  private instancedMesh: THREE.InstancedMesh | null = null;
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  /**
   * Instancia N elementos decorativos em uma única Draw Call utilizando InstancedMesh.
   */
  public buildDecorations(instances: DecorationInstance[], baseColor = 0x22c55e): void {
    if (this.instancedMesh) {
      this.group.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.instancedMesh = null;
    }

    if (instances.length === 0) return;

    // Geometria leve cruzada (2 quads cruzados em X) típica de vegetação voxel
    const geo = new THREE.PlaneGeometry(0.8, 0.8);
    geo.rotateY(Math.PI / 4);
    const mat = new THREE.MeshLambertMaterial({
      color: baseColor,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.5,
    });

    this.instancedMesh = new THREE.InstancedMesh(geo, mat, instances.length);

    for (let i = 0; i < instances.length; i++) {
      const item = instances[i];
      const s = item.scale ?? 1.0;
      this.dummy.position.set(item.x, item.y + 0.4 * s, item.z);
      this.dummy.scale.set(s, s, s);
      this.dummy.rotation.y = (i * 1.37) % (Math.PI * 2);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);

      if (item.colorHex !== undefined) {
        this.instancedMesh.setColorAt(i, new THREE.Color(item.colorHex));
      }
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
    this.group.add(this.instancedMesh);
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    if (this.instancedMesh) {
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
    }
  }
}
