// Itens físicos dropados no Modo Sobrevivência: um pequeno cubo "flutuando" (bobbing)
// no local onde o bloco foi quebrado, coletado automaticamente por ímã quando o
// jogador se aproxima — em vez de só somar direto no inventário como no Criativo.
import * as THREE from 'three';
import { BLOCKS } from '../world/blocks';
import { PlayerController } from '../player/controller';
import { OrigemDoItem, estadoDoItem } from './vidaDoItem';

interface DroppedItem {
  mesh: THREE.Mesh;
  blockType: number;
  count: number;
  age: number;
  vy: number;
  /** De onde veio. Decide a vida útil e o aviso — ver `vidaDoItem.ts`. */
  origem: OrigemDoItem;
}

const PICKUP_RADIUS = 1.6;
const MAGNET_RADIUS = 3.5;

export class ItemDropSystem {
  private items: DroppedItem[] = [];
  private geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);

  public onCollect: (blockType: number, count: number) => void = () => {};

  constructor(private scene: THREE.Scene, private player: PlayerController) {}

  public spawn(
    blockType: number, count: number, x: number, y: number, z: number,
    origem: OrigemDoItem = 'comum',
  ): void {
    const def = BLOCKS[blockType];
    const color = def?.colors ? new THREE.Color(def.colors[0][0], def.colors[0][1], def.colors[0][2]) : new THREE.Color(0x38bdf8);
    // `transparent` desde o começo, e não ligado só quando a piscada chega: trocar o modo de um
    // material em uso força o three.js a recompilar o programa, e isso aconteceria com dezenas de
    // itens ao mesmo tempo — exatamente no instante em que o jogador está correndo para pegá-los.
    const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.position.set(x, y, z);
    // O que caiu na morte é maior. É a diferença que responde "qual destas pilhas é a minha?" sem
    // nenhum texto, e continua respondendo depois de duas mortes no mesmo lugar.
    if (origem === 'morte') mesh.scale.setScalar(1.6);
    this.scene.add(mesh);
    this.items.push({ mesh, blockType, count, age: 0, vy: 3, origem });
  }

  public update(dt: number): void {
    if (this.items.length === 0) return;
    const p = this.player.pos;
    const remaining: DroppedItem[] = [];

    for (const item of this.items) {
      item.age += dt;

      // Expiração e aviso — item 1330. `age` já era contado e ninguém lia: os itens ficavam no
      // chão pelo resto da partida, um teste de distância e uma malha cada, para sempre.
      const estado = estadoDoItem(item.age, item.origem);
      if (estado.expirado) {
        this.scene.remove(item.mesh);
        (item.mesh.material as THREE.Material).dispose();
        continue;
      }
      (item.mesh.material as THREE.MeshLambertMaterial).opacity = estado.opacidade;

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
        // Um material por item, então um `dispose` por item. Sem isto cada bloco quebrado numa
        // sessão deixa um programa de GPU vivo até a página fechar.
        (item.mesh.material as THREE.Material).dispose();
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
    for (const item of this.items) {
      this.scene.remove(item.mesh);
      (item.mesh.material as THREE.Material).dispose();
    }
    this.items = [];
  }

  /** Quantos itens estão no chão agora. Existe para teste e para o painel de depuração. */
  public get contagem(): number {
    return this.items.length;
  }
}
