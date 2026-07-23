import * as THREE from 'three';
import { World } from '../world/world';
import { PlayerController } from '../player/controller';
import { B, BLOCKS, registerCustomBlock } from '../world/blocks';
import { WorldRepository } from '../storage/WorldRepository';
import { WorldPerception } from './WorldPerception';
import { EntitySystem } from '../entities/EntitySystem';
import { EventSystem } from '../events/EventSystem';
import { UndoManager, BlockChange } from '../storage/UndoManager';

function parseBlockType(name: string): number {
  const upper = (name || '').toUpperCase().trim();
  for (let i = 0; i < BLOCKS.length; i++) {
    const def = BLOCKS[i];
    if (def && def.name.toUpperCase() === upper) {
      return i;
    }
  }
  if (upper === 'AIR' || upper === 'AR') return B.AIR;
  if (upper === 'STONE' || upper === 'PEDRA') return B.STONE;
  if (upper === 'DIRT' || upper === 'TERRA') return B.DIRT;
  if (upper === 'GRASS' || upper === 'GRAMA') return B.GRASS;
  if (upper === 'WOOD' || upper === 'TRONCO' || upper === 'LOG') return B.LOG;
  if (upper === 'PLANK' || upper === 'TÁBUAS') return B.PLANK;
  if (upper === 'BRICK' || upper === 'TIJOLO') return B.BRICK;
  if (upper === 'STONE_BRICK' || upper === 'TIJOLO_DE_PEDRA') return B.STONE_BRICK;
  if (upper === 'LEAVES' || upper === 'FOLHAS') return B.LEAVES;
  if (upper === 'WATER' || upper === 'ÁGUA') return B.WATER;
  if (upper === 'SAND' || upper === 'AREIA') return B.SAND;
  if (upper === 'GLASS' || upper === 'VIDRO') return B.GLASS;
  if (upper === 'IRON_BLOCK' || upper === 'FERRO') return B.IRON_BLOCK;
  if (upper === 'GOLD_BLOCK' || upper === 'OURO') return B.GOLD_BLOCK;
  if (upper === 'DIAMOND_BLOCK' || upper === 'DIAMANTE') return B.DIAMOND_BLOCK;
  if (upper === 'GLOWSTONE' || upper === 'LUMINOSA') return B.GLOWSTONE;
  if (upper === 'OBSIDIAN' || upper === 'OBSIDIANA') return B.OBSIDIAN;
  if (upper === 'DARK_STONE' || upper === 'PEDRA_ESCURA') return B.DARK_STONE;
  return B.STONE;
}

export class MCPExecutors {
  private world: World;
  private player: PlayerController;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private currentWorldId: string;
  private perception: WorldPerception;
  public entitySystem?: EntitySystem;
  public eventSystem?: EventSystem;
  public undoManager?: UndoManager;

  constructor(
    world: World,
    player: PlayerController,
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    currentWorldId: string,
    entitySystem?: EntitySystem,
    eventSystem?: EventSystem,
    undoManager?: UndoManager
  ) {
    this.world = world;
    this.player = player;
    this.scene = scene;
    this.renderer = renderer;
    this.currentWorldId = currentWorldId;
    this.perception = new WorldPerception(world);
    this.entitySystem = entitySystem;
    this.eventSystem = eventSystem;
    this.undoManager = undoManager;
  }

  public setWorldId(worldId: string): void {
    this.currentWorldId = worldId;
  }

  public async executeTool(name: string, args: any): Promise<{ result: any; snapshotImage?: string }> {
    console.log(`🛠️ [MCPExecutors] Executando ferramenta "${name}" com os argumentos:`, args);
    switch (name) {
      case 'set_block': {
        const type = parseBlockType(args.block_type);
        const x = Number(args.x) || 0;
        const y = Number(args.y) || 0;
        const z = Number(args.z) || 0;
        this.world.setBlock(x, y, z, type);
        await WorldRepository.saveBlockMod(this.currentWorldId, x, y, z, type);
        return { result: `Bloco ${BLOCKS[type]?.name || type} colocado em (${x}, ${y}, ${z}).` };
      }

      case 'fill_box': {
        const type = parseBlockType(args.block_type);
        const minX = Math.min(Number(args.x1) || 0, Number(args.x2) || 0);
        const maxX = Math.max(Number(args.x1) || 0, Number(args.x2) || 0);
        const minY = Math.min(Number(args.y1) || 0, Number(args.y2) || 0);
        const maxY = Math.max(Number(args.y1) || 0, Number(args.y2) || 0);
        const minZ = Math.min(Number(args.z1) || 0, Number(args.z2) || 0);
        const maxZ = Math.max(Number(args.z1) || 0, Number(args.z2) || 0);

        const isHollow = !!args.hollow;
        const mods: { x: number; y: number; z: number; blockType: number }[] = [];

        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
              if (isHollow) {
                const isEdge = x === minX || x === maxX || y === minY || y === maxY || z === minZ || z === maxZ;
                if (!isEdge) continue;
              }
              this.world.setBlock(x, y, z, type);
              mods.push({ x, y, z, blockType: type });
            }
          }
        }

        await WorldRepository.saveBlockModBatch(this.currentWorldId, mods);
        return { result: `Caixa preenchida com ${mods.length} blocos de ${BLOCKS[type]?.name || type}.` };
      }

      case 'capture_snapshot': {
        const cx = Number(args.x) || 0;
        const cy = Number(args.y) || 0;
        const cz = Number(args.z) || 0;
        const tx = Number(args.targetX) || 0;
        const ty = Number(args.targetY) || 0;
        const tz = Number(args.targetZ) || 0;

        const snapCam = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 1000);
        snapCam.position.set(cx, cy, cz);
        snapCam.lookAt(tx, ty, tz);

        this.renderer.render(this.scene, snapCam);
        const dataUrl = this.renderer.domElement.toDataURL('image/png');

        return {
          result: `Snapshot visual capturado de (${cx}, ${cy}, ${cz}) olhando para (${tx}, ${ty}, ${tz}).`,
          snapshotImage: dataUrl
        };
      }

      case 'reset_world': {
        await WorldRepository.clearWorldBlockMods(this.currentWorldId);
        return { result: 'Mundo resetado para o estado original.' };
      }

      case 'reconfigure_player': {
        if (args.is_flying !== undefined) this.player.flying = args.is_flying;
        if (args.x !== undefined && args.y !== undefined && args.z !== undefined) {
          this.player.pos.set(args.x, args.y, args.z);
        }
        return { result: `Jogador atualizado: Voo=${this.player.flying}, Posição=(${this.player.pos.x.toFixed(1)}, ${this.player.pos.y.toFixed(1)}, ${this.player.pos.z.toFixed(1)}).` };
      }

      case 'query_world_area': {
        const x = Number(args.x) || 0;
        const z = Number(args.z) || 0;
        const r = Number(args.radius) || 16;
        const analysis = this.perception.analyzeArea(x, z, r);
        return { result: analysis };
      }

      case 'get_world_summary': {
        const summary = await this.perception.getWorldSummary(this.currentWorldId);
        return { result: summary };
      }

      case 'reset_chunk_area': {
        const minX = Math.min(Number(args.x1) || 0, Number(args.x2) || 0);
        const maxX = Math.max(Number(args.x1) || 0, Number(args.x2) || 0);
        const minZ = Math.min(Number(args.z1) || 0, Number(args.z2) || 0);
        const maxZ = Math.max(Number(args.z1) || 0, Number(args.z2) || 0);

        const count = await WorldRepository.clearChunkAreaBlockMods(this.currentWorldId, minX, maxX, minZ, maxZ);
        return { result: `Região de (${minX}, ${minZ}) a (${maxX}, ${maxZ}) resetada com sucesso. ${count} modificações de blocos foram removidas e revertidas para a semente original do terreno.` };
      }

      case 'spawn_entity': {
        if (this.entitySystem) {
          const type = args.type || 'human';
          const name = args.name || 'Habitante';
          const x = Number(args.x) || 0;
          const z = Number(args.z) || 0;
          const faction = args.faction || 'Reino';
          const role = args.role || 'Cidadão';
          const entity = this.entitySystem.spawnEntity(type, name, x, 20, z, faction, role);
          return { result: `Entidade '${entity.name}' (${entity.type}) da facção [${entity.faction}] gerada com sucesso em (${entity.pos.x.toFixed(1)}, ${entity.pos.z.toFixed(1)})!` };
        }
        return { result: 'Sistema de entidades indisponível.' };
      }

      case 'list_entities': {
        if (this.entitySystem) {
          return { result: this.entitySystem.listEntities() };
        }
        return { result: [] };
      }

      case 'control_entity': {
        if (this.entitySystem) {
          const ok = this.entitySystem.controlEntity(args.id, Number(args.targetX) || 0, Number(args.targetZ) || 0, args.newRole);
          return { result: ok ? `Comando enviado para entidade '${args.id}'.` : `Entidade '${args.id}' não encontrada.` };
        }
        return { result: 'Sistema de entidades indisponível.' };
      }

      case 'trigger_world_event': {
        if (this.eventSystem) {
          const msg = await this.eventSystem.triggerEvent(args.event_type || 'meteor', Number(args.x) || 0, Number(args.z) || 0);
          return { result: msg };
        }
        return { result: 'Sistema de eventos indisponível.' };
      }

      case 'batch_set_blocks': {
        let blocksList: any[] = [];
        if (typeof args.blocks === 'string') {
          try { blocksList = JSON.parse(args.blocks); } catch {}
        } else if (Array.isArray(args.blocks)) {
          blocksList = args.blocks;
        }

        const mods: { x: number; y: number; z: number; blockType: number }[] = [];

        for (const item of blocksList) {
          if (!item) continue;
          const x = Number(item.x);
          const y = Number(item.y);
          const z = Number(item.z);
          if (isNaN(x) || isNaN(y) || isNaN(z)) continue;

          const type = parseBlockType(item.block_type || item.type || item.block);
          this.world.setBlock(x, y, z, type);
          mods.push({ x, y, z, blockType: type });
        }

        await WorldRepository.saveBlockModBatch(this.currentWorldId, mods);
        return { result: `Construção livre personalizada realizada com sucesso (${mods.length} blocos alterados em tempo real nas coordenadas especificadas)!` };
      }

      case 'execute_voxel_script': {
        const rawCode = args.code || '';
        console.log(`📜 [MCPExecutors] Executando script em código JavaScript gerado pela IA:\n`, rawCode);

        const mods: { x: number; y: number; z: number; blockType: number }[] = [];
        const undoChanges: BlockChange[] = [];

        const setBlock = (x: number, y: number, z: number, blockType: any) => {
          const type = typeof blockType === 'number' ? blockType : parseBlockType(String(blockType));
          const oldBlock = this.world.getBlock(x, y, z);
          if (oldBlock !== type) {
            this.world.setBlock(x, y, z, type);
            mods.push({ x, y, z, blockType: type });
            undoChanges.push({ x, y, z, oldBlock, newBlock: type });
          }
        };

        const fillBox = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, blockType: any, hollow: boolean = false) => {
          const type = typeof blockType === 'number' ? blockType : parseBlockType(String(blockType));
          const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
          const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
          const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);

          for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
              for (let z = minZ; z <= maxZ; z++) {
                if (hollow) {
                  const isEdge = x === minX || x === maxX || y === minY || y === maxY || z === minZ || z === maxZ;
                  if (!isEdge) continue;
                }
                setBlock(x, y, z, type);
              }
            }
          }
        };

        const getBlock = (x: number, y: number, z: number) => {
          return this.world.getBlock(x, y, z);
        };

        const getGroundY = (x: number, z: number) => {
          for (let y = 120; y >= 0; y--) {
            const b = this.world.getBlock(Math.floor(x), y, Math.floor(z));
            if (b !== B.AIR && b !== B.WATER) return y;
          }
          return 4;
        };

        const BLOCK_ENUM = {
          AIR: B.AIR, GRASS: B.GRASS, DIRT: B.DIRT, STONE: B.STONE, SAND: B.SAND,
          GRAVEL: B.GRAVEL, WATER: B.WATER, LOG: B.LOG, LEAVES: B.LEAVES, PLANK: B.PLANK,
          PATH: B.PATH, STONE_BRICK: B.STONE_BRICK, SNOW: B.SNOW, TALL_GRASS: B.TALL_GRASS,
          FLOWER_RED: B.FLOWER_RED, FLOWER_YELLOW: B.FLOWER_YELLOW, PINE_LOG: B.PINE_LOG,
          PINE_LEAVES: B.PINE_LEAVES, REED: B.REED, COBBLE: B.COBBLE,
          GLASS: B.GLASS, IRON_BLOCK: B.IRON_BLOCK, GOLD_BLOCK: B.GOLD_BLOCK,
          DIAMOND_BLOCK: B.DIAMOND_BLOCK, GLOWSTONE: B.GLOWSTONE, OBSIDIAN: B.OBSIDIAN,
          BRICK: B.BRICK, DARK_STONE: B.DARK_STONE, WOOD: B.LOG
        };

        const breakBlock = (x: number, y: number, z: number) => {
          setBlock(x, y, z, B.AIR);
        };

        const clearArea = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
          fillBox(x1, y1, z1, x2, y2, z2, B.AIR, false);
        };

        const flattenArea = (x1: number, z1: number, x2: number, z2: number, targetY?: number, surfaceBlock = B.GRASS) => {
          const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
          const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
          
          if (targetY === undefined) {
            targetY = getGroundY(Math.floor((minX + maxX) / 2), Math.floor((minZ + maxZ) / 2));
          }

          for (let z = minZ; z <= maxZ; z++) {
            for (let x = minX; x <= maxX; x++) {
              for (let y = targetY + 1; y < 128; y++) {
                if (getBlock(x, y, z) !== B.AIR) {
                  setBlock(x, y, z, B.AIR);
                }
              }
              setBlock(x, targetY, z, surfaceBlock);
              for (let y = targetY - 1; y >= Math.max(0, targetY - 6); y--) {
                if (getBlock(x, y, z) === B.AIR) {
                  setBlock(x, y, z, B.DIRT);
                }
              }
            }
          }
        };

        const createEntity = (config: any) => {
          if (this.entitySystem) {
            return this.entitySystem.createCustomEntity(config);
          }
          return null;
        };

        const executeVoxelScript = (subCode: string) => {
          if (typeof subCode === 'string') {
            try {
              const subFunc = new Function('setBlock', 'breakBlock', 'fillBox', 'clearArea', 'flattenArea', 'getBlock', 'getGroundY', 'createEntity', 'registerCustomBlock', 'B', 'Math', 'console', 'executeVoxelScript', subCode);
              subFunc(setBlock, breakBlock, fillBox, clearArea, flattenArea, getBlock, getGroundY, createEntity, registerCustomBlock, BLOCK_ENUM, Math, console, executeVoxelScript);
            } catch (e) {
              console.error(`❌ [MCPExecutors] Erro ao executar subCode em executeVoxelScript:`, e);
            }
          }
        };

        try {
          const scriptFunc = new Function('setBlock', 'breakBlock', 'fillBox', 'clearArea', 'flattenArea', 'getBlock', 'getGroundY', 'createEntity', 'registerCustomBlock', 'B', 'Math', 'console', 'executeVoxelScript', rawCode);
          scriptFunc(setBlock, breakBlock, fillBox, clearArea, flattenArea, getBlock, getGroundY, createEntity, registerCustomBlock, BLOCK_ENUM, Math, console, executeVoxelScript);

          await WorldRepository.saveBlockModBatch(this.currentWorldId, mods);

          // Capturar snapshot visual automático do centro da construção para a IA ver a foto
          let snapDataUrl: string | undefined = undefined;
          if (mods.length > 0) {
            let avgX = 0, avgY = 0, avgZ = 0;
            for (const m of mods) { avgX += m.x; avgY += m.y; avgZ += m.z; }
            avgX = Math.round(avgX / mods.length);
            avgY = Math.round(avgY / mods.length);
            avgZ = Math.round(avgZ / mods.length);

            const snapCam = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 1000);
            snapCam.position.set(avgX + 15, avgY + 12, avgZ + 15);
            snapCam.lookAt(avgX, avgY, avgZ);
            this.renderer.render(this.scene, snapCam);
            snapDataUrl = this.renderer.domElement.toDataURL('image/png');
          }

          return {
            result: `Script executado com sucesso! ${mods.length} blocos gerados pela IA e aplicados no mundo 3D em tempo real.`,
            snapshotImage: snapDataUrl
          };
        } catch (err: any) {
          console.error(`❌ [MCPExecutors] Erro na execução do script de código da IA:`, err);
          return { result: `Erro ao executar script de código da IA: ${err?.message || err}` };
        }
      }

      case 'search_chat_and_code': {
        const logs = await WorldRepository.getChatMessages(this.currentWorldId);
        const matches = logs.filter(l => l.content.toLowerCase().includes(args.query.toLowerCase()));
        return {
          result: `Encontradas ${matches.length} mensagens no histórico:\n` +
            matches.map(m => `[${m.role}]: ${m.content}`).join('\n')
        };
      }

      default:
        return { result: `Ferramenta '${name}' desconhecida.` };
    }
  }
}
