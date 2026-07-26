import { World } from '../world/world';
import { TOPO_VARREDURA } from '../world/chunk';
import { B } from '../world/blocks';
import { WorldRepository } from '../storage/WorldRepository';

export type EventType = 'volcano' | 'lightning' | 'earthquake' | 'blessing' | 'meteor';

export class EventSystem {
  private world: World;
  private currentWorldId: string;

  constructor(world: World, currentWorldId: string) {
    this.world = world;
    this.currentWorldId = currentWorldId;
  }

  public setWorldId(worldId: string): void {
    this.currentWorldId = worldId;
  }

  public async triggerEvent(type: EventType, cx: number, cz: number): Promise<string> {
    console.log(`[EventSystem] Evento '${type}' desencadeado nas coordenadas (${cx}, ${cz})`);
    const mods: { x: number; y: number; z: number; blockType: number }[] = [];

    // Find surface Y at center
    let surfaceY = 20;
    for (let y = TOPO_VARREDURA; y >= 0; y--) {
      const b = this.world.getBlock(Math.floor(cx), y, Math.floor(cz));
      if (b !== B.AIR && b !== B.WATER) {
        surfaceY = y;
        break;
      }
    }

    if (type === 'volcano') {
      // Build a cone volcano mountain
      const height = 12;
      for (let h = 0; h < height; h++) {
        const radius = height - h;
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const dist = Math.hypot(dx, dz);
            if (dist <= radius) {
              const vx = Math.floor(cx + dx);
              const vy = surfaceY + h;
              const vz = Math.floor(cz + dz);

              // Crater top with magma rock
              const blockType = (h >= height - 2 && dist <= 2) ? B.COBBLE : B.STONE_BRICK;
              this.world.setBlock(vx, vy, vz, blockType);
              mods.push({ x: vx, y: vy, z: vz, blockType });
            }
          }
        }
      }
      await WorldRepository.saveBlockModBatch(this.currentWorldId, mods);
      return `Vulcão gerado com sucesso nas coordenadas (${cx}, ${cz}) com cratera de magma!`;
    }

    if (type === 'lightning') {
      // Scorched strike
      for (let y = surfaceY + 20; y >= surfaceY - 2; y--) {
        const vx = Math.floor(cx);
        const vz = Math.floor(cz);
        const bt = y <= surfaceY ? B.STONE : B.AIR;
        this.world.setBlock(vx, y, vz, bt);
        mods.push({ x: vx, y, z: vz, blockType: bt });
      }
      await WorldRepository.saveBlockModBatch(this.currentWorldId, mods);
      return `Raio devastador atingiu o solo em (${cx}, ${cz})!`;
    }

    if (type === 'earthquake') {
      // Fault crack lines in terrain
      const radius = 8;
      for (let dx = -radius; dx <= radius; dx++) {
        const vz = Math.floor(cz + (Math.sin(dx * 0.5) * 3));
        const vx = Math.floor(cx + dx);
        for (let y = surfaceY; y >= surfaceY - 5; y--) {
          this.world.setBlock(vx, y, vz, B.AIR);
          mods.push({ x: vx, y, z: vz, blockType: B.AIR });
        }
      }
      await WorldRepository.saveBlockModBatch(this.currentWorldId, mods);
      return `Terremoto abriu fendas no terreno ao redor de (${cx}, ${cz})!`;
    }

    if (type === 'blessing') {
      // Lush vegetation, flowers and fertile soil
      const radius = 6;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.hypot(dx, dz) <= radius) {
            const vx = Math.floor(cx + dx);
            const vz = Math.floor(cz + dz);
            this.world.setBlock(vx, surfaceY, vz, B.GRASS);
            mods.push({ x: vx, y: surfaceY, z: vz, blockType: B.GRASS });
            if (Math.random() < 0.3) {
              this.world.setBlock(vx, surfaceY + 1, vz, B.LEAVES);
              mods.push({ x: vx, y: surfaceY + 1, z: vz, blockType: B.LEAVES });
            }
          }
        }
      }
      await WorldRepository.saveBlockModBatch(this.currentWorldId, mods);
      return `Bênção Divina fertilizou o solo em (${cx}, ${cz})!`;
    }

    if (type === 'meteor') {
      // Impact crater
      const radius = 5;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const dist = Math.hypot(dx, dy, dz);
            const vx = Math.floor(cx + dx);
            const vy = Math.floor(surfaceY + dy);
            const vz = Math.floor(cz + dz);

            if (dist <= radius) {
              this.world.setBlock(vx, vy, vz, B.AIR);
              mods.push({ x: vx, y: vy, z: vz, blockType: B.AIR });
            } else if (dist <= radius + 1.2) {
              this.world.setBlock(vx, vy, vz, B.STONE);
              mods.push({ x: vx, y: vy, z: vz, blockType: B.STONE });
            }
          }
        }
      }
      await WorldRepository.saveBlockModBatch(this.currentWorldId, mods);
      return `Meteoro devastou a superfície criando cratera em (${cx}, ${cz})!`;
    }

    return `Evento '${type}' executado.`;
  }
}
