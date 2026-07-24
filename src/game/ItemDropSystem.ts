// Itens físicos dropados no Modo Sobrevivência: um pequeno cubo "flutuando" (bobbing)
// no local onde o bloco foi quebrado, coletado automaticamente por ímã quando o
// jogador se aproxima — em vez de só somar direto no inventário como no Criativo.
import * as THREE from 'three';
import { BLOCKS } from '../world/blocks';
import { PlayerController } from '../player/controller';

interface DroppedItem {
  mesh: THREE.Mesh;
  blockType: number;
  count: number;
  age: number;
  vy: number;
}

const PICKUP_RADIUS = 1.6;
const MAGNET_RADIUS = 3.5;

export class ItemDropSystem {
  private items: DroppedItem[] = [];
  private geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);

  public onCollect: (blockType: number, count: number) => void = () => {};

  constructor(private scene: THREE.Scene, private player: PlayerController) {}

  public spawn(blockType: number, count: number, x: number, y: number, z: number): void {
    const def = BLOCKS[blockType];
    const color = def?.colors ? new THREE.Color(def.colors[0][0], def.colors[0][1], def.colors[0][2]) : new THREE.Color(0x38bdf8);
    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.items.push({ mesh, blockType, count, age: 0, vy: 3 });
  }

  public update(dt: number): void {
    if (this.items.length === 0) return;
    const p = this.player.pos;
    const remaining: DroppedItem[] = [];

    for (const item of this.items) {
      item.age += dt;

      // pequeno impulso inicial pra cima que se acomoda, depois só bobbing (efeito Minecraft)
      if (item.vy > 0) {
        item.mesh.position.y += item.vy * dt;
        item.vy -= dt * 9;
        if (item.vy < 0) item.vy = 0;
      } else {
        item.mesh.position.y += Math.sin(item.age * 3) * 0.15 * dt;
      }
      item.mesh.rotation.y += dt * 1.4;

      const dist = item.mesh.position.distanceTo(new THREE.Vector3(p.x, item.mesh.position.y, p.z));
      if (dist < PICKUP_RADIUS) {
        this.onCollect(item.blockType, item.count);
        this.scene.remove(item.mesh);
        continue;
      }
      if (dist < MAGNET_RADIUS) {
        const dir = new THREE.Vector3(p.x - item.mesh.position.x, 0, p.z - item.mesh.position.z).normalize();
        item.mesh.position.x += dir.x * dt * 6;
        item.mesh.position.z += dir.z * dt * 6;
      }
      remaining.push(item);
    }
    this.items = remaining;
  }

  public clearAll(): void {
    for (const item of this.items) this.scene.remove(item.mesh);
    this.items = [];
  }
}
