import * as THREE from 'three';
import { TOPO_VARREDURA, WORLD_MAX_Y } from '../world/chunk';
import { World } from '../world/world';
import { PlayerController } from '../player/controller';
import { B, BLOCKS, registerCustomBlock } from '../world/blocks';
import { WorldRepository } from '../storage/WorldRepository';
import { WorldPerception } from './WorldPerception';
import { EntitySystem } from '../entities/EntitySystem';
import { EventSystem } from '../events/EventSystem';
import { UndoManager, BlockChange } from '../storage/UndoManager';
import { UIExecutors } from './UIExecutors';
import { getStructureTemplate } from '../crafting/StructureTemplates';
import { SCALE } from '../world/chunk';
import { ModService } from '../mods/ModService';
import { ModRuntime } from '../mods/ModRuntime';
import { MOD_API_REFERENCE } from '../mods/ModAPIReference';
import { resolveBlockRef } from '../mods/ModRegistry';

/**
 * `modsForLookup` é preenchido pelo `MCPExecutors` ativo para que `parseBlockType` também
 * reconheça blocos de mod — tanto pelo nome exibido quanto pela referência simbólica
 * ("meumod:cristal_azul"). Sem isso, pedir `set_block` com um bloco recém-criado pela própria
 * IA cairia no fallback silencioso `B.STONE`.
 */
let modsForLookup: any[] = [];

function parseBlockType(name: string): number {
  const upper = (name || '').toUpperCase().trim();
  for (let i = 0; i < BLOCKS.length; i++) {
    const def = BLOCKS[i];
    if (def && !def.reserved && def.name.toUpperCase() === upper) {
      return i;
    }
  }

  // Blocos de mod por chave simbólica, antes dos aliases fixos da paleta base.
  const modHit = resolveBlockRef(name, null, modsForLookup);
  if (modHit !== null && modHit >= 0) return modHit;
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
  // Auditoria 24/07/2026: estes três nomes eram anunciados nas descrições das ferramentas MCP
  // (set_block/fill_box) mas nunca tinham alias aqui — pedir "COBBLESTONE" ou "LAVA" caía
  // silenciosamente no fallback B.STONE em vez do bloco certo. Corrigido.
  if (upper === 'COBBLE' || upper === 'COBBLESTONE' || upper === 'PEDREGULHO') return B.COBBLE;
  if (upper === 'LAVA') return B.LAVA;
  if (upper === 'GRAVEL' || upper === 'CASCALHO') return B.GRAVEL;
  if (upper === 'PATH' || upper === 'CAMINHO') return B.PATH;
  if (upper === 'SNOW' || upper === 'NEVE') return B.SNOW;
  return B.STONE;
}

/** Alguns modelos mandam arrays como string JSON; aceita as duas formas sem quebrar. */
function safeJsonArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export interface ScriptErrorLog {
  timestamp: number;
  code: string;
  message: string;
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
  public uiExecutors: UIExecutors;
  /** Sistema de mods: cria e persiste blocos, entidades e estruturas inéditas no mundo. */
  public modService: ModService;
  /** Runtime que executa os scripts dos mods. Injetado pelo `main`. */
  public modRuntime?: ModRuntime;

  /**
   * Escreve um bloco atribuindo-o ao mod da sessão — item 704.
   *
   * Todo caminho de escrita do agente passa por aqui. Deixar cada `case` chamar `world.setBlock`
   * direto é o que permitiu metade das alterações ficarem sem dono: um caminho novo nasce sem a
   * atribuição, e ninguém percebe até alguém tentar reverter.
   */
  private escreverBloco(x: number, y: number, z: number, tipo: number): boolean {
    const mod = this.modService.getModForActiveThread();
    // Lido antes de escrever: é o valor que a reversão precisa para restaurar o terreno.
    const antes = mod ? this.world.getBlock(x, y, z) : 0;
    if (!this.world.setBlock(x, y, z, tipo)) return false;
    if (mod) this.modRuntime?.registrarBlocoColocado(mod.id, x, y, z, antes, tipo);
    return true;
  }
  /** Log das últimas falhas de execute_voxel_script, para a IA se autocorrigir sem o usuário colar erros manualmente. */
  private recentErrors: ScriptErrorLog[] = [];
  /** Notifica blocos alterados pela IA — usado pelo host para retransmitir via PeerSync. */
  public onBlocksChanged: (mods: { x: number; y: number; z: number; blockType: number }[]) => void = () => {};

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
    this.uiExecutors = new UIExecutors(currentWorldId);
    this.modService = new ModService(world, currentWorldId, entitySystem);
    this.modService.onBlocksChanged = (mods) => this.onBlocksChanged(mods);
  }

  public setWorldId(worldId: string): void {
    this.currentWorldId = worldId;
    this.uiExecutors.setWorldId(worldId);
  }

  /**
   * Recarrega os mods do mundo (blocos nos ids salvos + entidades colocadas) e mantém a tabela
   * de lookup de `parseBlockType` sincronizada. Chamado por `main.ts` ao trocar de mundo.
   */
  public async loadModsForWorld(worldId: string): Promise<{ mods: number; blocks: number; entities: number }> {
    const summary = await this.modService.loadForWorld(worldId);
    modsForLookup = this.modService.getMods();
    return summary;
  }

  private syncModLookup(): void {
    modsForLookup = this.modService.getMods();
  }

  /**
   * Resolve o mod que a ferramenta vai editar, ou devolve a orientação de sessão livre.
   * Centralizado para todas as ferramentas de escrita recusarem da mesma forma.
   */
  private targetMod(args: any, acao: string): { modId: string } | { erro: string } {
    const mod = this.modService.resolveTargetMod(args?.mod_id);
    if (!mod) return { erro: this.modService.freeSessionHint(acao) };
    return { modId: mod.id };
  }

  private snapshotFrom(cx: number, cy: number, cz: number, tx: number, ty: number, tz: number): string {
    const snapCam = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 1000);
    snapCam.position.set(cx, cy, cz);
    snapCam.lookAt(tx, ty, tz);
    this.renderer.render(this.scene, snapCam);
    return this.renderer.domElement.toDataURL('image/png');
  }

  /** Altura da primeira superfície sólida em (x, z) — para spawnar sem enterrar nem flutuar. */
  private groundYAt(x: number, z: number): number {
    for (let y = TOPO_VARREDURA; y >= 0; y--) {
      const b = this.world.getBlock(Math.floor(x), y, Math.floor(z));
      if (b !== B.AIR && b !== B.WATER) return y;
    }
    return 4;
  }

  private logScriptError(code: string, message: string): void {
    this.recentErrors.push({ timestamp: Date.now(), code: code.slice(0, 400), message });
    if (this.recentErrors.length > 20) this.recentErrors.shift();
  }

  public async executeTool(name: string, args: any): Promise<{ result: any; snapshotImage?: string }> {
    console.log(`[MCPExecutors] Executando ferramenta "${name}" com os argumentos:`, args);

    if (UIExecutors.isUITool(name)) {
      const uiResult = await this.uiExecutors.execute(name, args);
      if (uiResult) return uiResult;
    }

    switch (name) {
      case 'set_block': {
        const type = parseBlockType(args.block_type);
        const x = Number(args.x) || 0;
        const y = Number(args.y) || 0;
        const z = Number(args.z) || 0;
        this.escreverBloco(x, y, z, type);
        await WorldRepository.saveBlockMod(this.currentWorldId, x, y, z, type);
        this.onBlocksChanged([{ x, y, z, blockType: type }]);
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
              this.escreverBloco(x, y, z, type);
              mods.push({ x, y, z, blockType: type });
            }
          }
        }

        await WorldRepository.saveBlockModBatch(this.currentWorldId, mods);
        this.onBlocksChanged(mods);
        return { result: `Caixa preenchida com ${mods.length} blocos de ${BLOCKS[type]?.name || type}.` };
      }

      case 'capture_snapshot': {
        const cx = Number(args.x) || 0;
        const cy = Number(args.y) || 0;
        const cz = Number(args.z) || 0;
        const tx = Number(args.targetX) || 0;
        const ty = Number(args.targetY) || 0;
        const tz = Number(args.targetZ) || 0;

        const dataUrl = this.snapshotFrom(cx, cy, cz, tx, ty, tz);

        return {
          result: `Snapshot visual capturado de (${cx}, ${cy}, ${cz}) olhando para (${tx}, ${ty}, ${tz}).`,
          snapshotImage: dataUrl
        };
      }

      case 'capture_multi_angle': {
        // Tira 4 fotos automáticas (frente, direita, trás, esquerda, todas em diagonal de cima)
        // ao redor de um ponto central, para a IA validar visualmente uma construção de uma vez,
        // sem precisar lembrar de chamar capture_snapshot várias vezes manualmente.
        const tx = Number(args.targetX) || 0;
        const ty = Number(args.targetY) || 0;
        const tz = Number(args.targetZ) || 0;
        const dist = Number(args.distance) || 18;
        const height = Number(args.height) || 12;

        const angles = [0, 90, 180, 270];
        const images: string[] = [];
        for (const deg of angles) {
          const rad = (deg * Math.PI) / 180;
          const cx = tx + Math.sin(rad) * dist;
          const cz = tz + Math.cos(rad) * dist;
          images.push(this.snapshotFrom(cx, ty + height, cz, tx, ty, tz));
        }

        return {
          result: `4 fotos capturadas ao redor de (${tx}, ${ty}, ${tz}) (frente/direita/trás/esquerda). Analise todas antes de decidir se precisa corrigir algo.`,
          snapshotImage: images[0],
          multiSnapshotImages: images
        } as any;
      }

      case 'possess_entity': {
        // Caminho alternativo ao spawn_entity/execute_voxel_script->createEntity: em vez de gerar
        // um NPC decorativo, transforma o PRÓPRIO jogador na entidade indicada (teleporta até ela
        // e remove o NPC decorativo, já que a câmera do jogador passa a fazer o papel dela).
        if (!this.entitySystem) return { result: 'Sistema de entidades indisponível.' };
        const id = String(args.entity_id || '');
        const taken = this.entitySystem.takeControlOf(id);
        if (!taken) return { result: `Entidade '${id}' não encontrada.` };
        this.player.pos.set(taken.x, taken.y, taken.z);
        this.player.vel.set(0, 0, 0);
        return { result: `Jogador agora está controlando/assumiu o lugar de '${taken.name}' em (${taken.x.toFixed(1)}, ${taken.y.toFixed(1)}, ${taken.z.toFixed(1)}).` };
      }

      case 'list_recent_errors': {
        if (this.recentErrors.length === 0) {
          return { result: 'Nenhum erro registrado nesta sessão.' };
        }
        return { result: this.recentErrors.slice(-10) };
      }

      case 'stamp_structure': {
        const templateId = String(args.template_id || '');
        const template = getStructureTemplate(templateId);
        if (!template) {
          return { result: `Template de estrutura '${templateId}' não encontrado. Use 'tree', 'small_house', 'tower' ou 'wall'.` };
        }
        const bx = Math.floor((Number(args.x) || 0) / SCALE) * SCALE;
        const by = Math.floor((Number(args.y) || 0) / SCALE) * SCALE;
        const bz = Math.floor((Number(args.z) || 0) / SCALE) * SCALE;

        const mods: { x: number; y: number; z: number; blockType: number }[] = [];
        for (const b of template.blocks) {
          const ox = bx + b.dx * SCALE, oy = by + b.dy * SCALE, oz = bz + b.dz * SCALE;
          for (let x = ox; x < ox + SCALE; x++) {
            for (let y = oy; y < oy + SCALE; y++) {
              for (let z = oz; z < oz + SCALE; z++) {
                if (this.escreverBloco(x, y, z, b.block)) mods.push({ x, y, z, blockType: b.block });
              }
            }
          }
        }
        await WorldRepository.saveBlockModBatch(this.currentWorldId, mods);
        this.onBlocksChanged(mods);

        const snapDataUrl = this.snapshotFrom(bx + SCALE * 8, by + SCALE * 6, bz + SCALE * 8, bx, by, bz);
        return {
          result: `Estrutura '${template.name}' carimbada em (${bx}, ${by}, ${bz}) com ${mods.length} mini-blocos.`,
          snapshotImage: snapDataUrl,
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
          this.escreverBloco(x, y, z, type);
          mods.push({ x, y, z, blockType: type });
        }

        await WorldRepository.saveBlockModBatch(this.currentWorldId, mods);
        this.onBlocksChanged(mods);
        return { result: `Construção livre personalizada realizada com sucesso (${mods.length} blocos alterados em tempo real nas coordenadas especificadas)!` };
      }

      case 'execute_voxel_script': {
        const rawCode = args.code || '';
        console.log(`[MCPExecutors] Executando script em código JavaScript gerado pela IA:\n`, rawCode);

        const mods: { x: number; y: number; z: number; blockType: number }[] = [];
        const undoChanges: BlockChange[] = [];
        const subScriptErrors: string[] = [];

        // Guarda de tempo: scripts gerados pela IA rodam em new Function() sem preempção real,
        // então um loop mal formado pode travar a aba. Como não dá para interromper JS síncrono
        // no meio, a defesa prática é abortar futuras escritas de bloco (o caso comum de "loop
        // infinito" aqui é um laço chamando setBlock repetidamente) assim que o orçamento estourar.
        const deadline = Date.now() + 4000;
        let deadlineHit = false;
        const checkDeadline = (): boolean => {
          if (Date.now() > deadline) {
            if (!deadlineHit) {
              deadlineHit = true;
              subScriptErrors.push('Execução interrompida: tempo limite de 4s excedido (possível loop com muitas iterações). Divida a construção em scripts menores.');
            }
            return true;
          }
          return false;
        };

        const setBlock = (x: number, y: number, z: number, blockType: any) => {
          if (checkDeadline()) return;
          const type = typeof blockType === 'number' ? blockType : parseBlockType(String(blockType));
          const oldBlock = this.world.getBlock(x, y, z);
          if (oldBlock !== type) {
            this.escreverBloco(x, y, z, type);
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
          for (let y = TOPO_VARREDURA; y >= 0; y--) {
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
          BRICK: B.BRICK, DARK_STONE: B.DARK_STONE, WOOD: B.LOG, LAVA: B.LAVA
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
              for (let y = targetY + 1; y < WORLD_MAX_Y; y++) {
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
            } catch (e: any) {
              const msg = e?.message || String(e);
              console.error(`[MCPExecutors] Erro ao executar subCode em executeVoxelScript:`, e);
              subScriptErrors.push(`Sub-script: ${msg}`);
              this.logScriptError(subCode, msg);
            }
          }
        };

        try {
          const scriptFunc = new Function('setBlock', 'breakBlock', 'fillBox', 'clearArea', 'flattenArea', 'getBlock', 'getGroundY', 'createEntity', 'registerCustomBlock', 'B', 'Math', 'console', 'executeVoxelScript', rawCode);
          scriptFunc(setBlock, breakBlock, fillBox, clearArea, flattenArea, getBlock, getGroundY, createEntity, registerCustomBlock, BLOCK_ENUM, Math, console, executeVoxelScript);

          await WorldRepository.saveBlockModBatch(this.currentWorldId, mods);
          this.onBlocksChanged(mods);

          // Registra o lote para poder ser desfeito. Antes, `undoChanges` era montado e
          // descartado — `recordBatch` não era chamado em lugar nenhum do projeto, então
          // nenhuma construção da IA era reversível.
          if (undoChanges.length > 0) this.undoManager?.recordBatch(undoChanges);

          // Blocos criados com `registerCustomBlock` dentro do script não pertencem a nenhum mod
          // ainda. Adotá-los aqui é o que impede o bug antigo: sem isso o bloco existia só em
          // memória, e no reload as posições salvas apontavam para um id inexistente.
          const adopted = await this.modService.adoptOrphanBlocks();
          if (adopted > 0) this.syncModLookup();

          // Capturar snapshot visual automático do centro da construção para a IA ver a foto
          let snapDataUrl: string | undefined = undefined;
          if (mods.length > 0) {
            let avgX = 0, avgY = 0, avgZ = 0;
            for (const m of mods) { avgX += m.x; avgY += m.y; avgZ += m.z; }
            avgX = Math.round(avgX / mods.length);
            avgY = Math.round(avgY / mods.length);
            avgZ = Math.round(avgZ / mods.length);
            snapDataUrl = this.snapshotFrom(avgX + 15, avgY + 12, avgZ + 15, avgX, avgY, avgZ);
          }

          const errorSuffix = subScriptErrors.length > 0
            ? `\nErros durante a execução (verifique e corrija): ${subScriptErrors.join(' | ')}`
            : '';
          const modSuffix = adopted > 0
            ? `\n${adopted} bloco(s) customizados criados no script foram salvos no mod "mod-avulsos" e continuarão existindo depois de recarregar o mundo.`
            : '';

          return {
            result: `Script executado! ${mods.length} blocos gerados pela IA e aplicados no mundo 3D em tempo real.${errorSuffix}${modSuffix}`,
            snapshotImage: snapDataUrl
          };
        } catch (err: any) {
          const msg = err?.message || String(err);
          console.error(`[MCPExecutors] Erro na execução do script de código da IA:`, err);
          this.logScriptError(rawCode, msg);
          return { result: `Erro ao executar script de código da IA: ${msg}\nUse a ferramenta 'list_recent_errors' se precisar consultar novamente este e outros erros recentes.` };
        }
      }

      // --- Sistema de Mods ------------------------------------------------------------------
      case 'create_mod': {
        const res = await this.modService.createMod(String(args.name || 'Mod sem nome'), String(args.description || ''), args.mod_id);
        this.syncModLookup();
        return { result: res.message };
      }

      case 'define_mod_block': {
        const alvo = this.targetMod(args, 'criar um bloco');
        if ('erro' in alvo) return { result: alvo.erro };
        const res = await this.modService.addBlock(alvo.modId, {
          key: String(args.key || args.name || ''),
          name: String(args.name || ''),
          topColor: args.top_color,
          sideColor: args.side_color,
          bottomColor: args.bottom_color,
          solid: args.solid,
          opaque: args.opaque,
          decor: args.decor,
          gravity: args.gravity,
          structural: args.structural,
          minToolTier: args.min_tool_tier,
          lightLevel: args.light_level,
          interactive: args.interactive,
        });
        this.syncModLookup();
        return { result: res.message };
      }

      case 'define_mod_biome': {
        const alvo = this.targetMod(args, 'criar um bioma');
        if ('erro' in alvo) return { result: alvo.erro };
        const res = await this.modService.addBiome(alvo.modId, {
          key: String(args.key || args.name || 'bioma'),
          nome: String(args.name || 'Bioma'),
          temp: Number(args.temp ?? 0),
          moist: Number(args.moist ?? 0),
          grama: args.grass_color,
          folhagem: args.foliage_color,
          neblina: args.fog_color,
          alcanceNeblina: args.fog_range,
          saturacao: args.saturation,
          sazonal: args.seasonal,
          minerios: args.ores,
        });
        return { result: res.message };
      }

      case 'define_mod_entity': {
        const alvo = this.targetMod(args, 'criar uma criatura');
        if ('erro' in alvo) return { result: alvo.erro };
        const parts = Array.isArray(args.parts) ? args.parts : safeJsonArray(args.parts);
        const res = await this.modService.addEntity(alvo.modId, {
          key: String(args.key || args.name || ''),
          name: String(args.name || 'Criatura'),
          faction: args.faction,
          role: args.role,
          health: args.health,
          parts: parts as any,
          behaviorScript: args.behavior_script,
        });
        this.syncModLookup();
        return { result: res.message };
      }

      case 'define_mod_structure': {
        const alvo = this.targetMod(args, 'criar uma estrutura');
        if ('erro' in alvo) return { result: alvo.erro };
        const blocks = Array.isArray(args.blocks) ? args.blocks : safeJsonArray(args.blocks);
        const res = await this.modService.addStructure(alvo.modId, {
          key: String(args.key || args.name || ''),
          name: String(args.name || 'Estrutura'),
          blocks: blocks as any,
        });
        this.syncModLookup();
        return { result: res.message };
      }

      case 'spawn_mod_entity': {
        const x = Number(args.x) || 0;
        const z = Number(args.z) || 0;
        // Sem `y`, encaixa na superfície — evita a criatura nascer enterrada ou flutuando.
        const y = args.y !== undefined ? Number(args.y) : this.groundYAt(x, z) + 1;
        const alvo = this.targetMod(args, 'colocar uma criatura no mundo');
        if ('erro' in alvo) return { result: alvo.erro };
        const res = await this.modService.spawnEntity(alvo.modId, String(args.entity_key || ''), x, y, z);
        return { result: res.message };
      }

      case 'place_mod_structure': {
        const alvo = this.targetMod(args, 'carimbar uma estrutura');
        if ('erro' in alvo) return { result: alvo.erro };
        const res = await this.modService.placeStructure(
          alvo.modId,
          String(args.structure_key || ''),
          Number(args.x) || 0,
          Number(args.y) || 0,
          Number(args.z) || 0,
        );
        if (!res.ok) return { result: res.message };

        const snap = this.snapshotFrom(
          (Number(args.x) || 0) + 18, (Number(args.y) || 0) + 14, (Number(args.z) || 0) + 18,
          Number(args.x) || 0, Number(args.y) || 0, Number(args.z) || 0,
        );
        return { result: res.message, snapshotImage: snap };
      }

      case 'define_mod_script': {
        const alvo = this.targetMod(args, 'escrever um script');
        if ('erro' in alvo) return { result: alvo.erro };

        const res = await this.modService.setScript(alvo.modId, {
          key: String(args.key || 'main'),
          name: args.name,
          code: String(args.code ?? ''),
          enabled: args.enabled,
        });
        if (!res.ok) return { result: res.message };

        // Recarrega na hora: o agente precisa do resultado (ou do erro) na mesma volta, senão
        // ele reporta sucesso sem saber se o código sequer compila.
        const mod = this.modService.getMod(alvo.modId)!;
        const cargas = (await this.modRuntime?.loadMod(mod)) ?? [];
        const falhou = cargas.find((c) => !c.ok);
        if (falhou) {
          return { result: `${res.message}\nO script não carregou: ${falhou.error}\nCorrija e chame define_mod_script de novo.` };
        }

        const logs = this.modRuntime?.getLogs(alvo.modId, 10) ?? [];
        const resumo = logs.length > 0 ? `\nLog: ${logs.map((l) => `[${l.level}] ${l.message}`).join(' | ')}` : '';
        return { result: `${res.message}\nScript carregado e ativo.${resumo}` };
      }

      case 'set_mod_script_enabled': {
        const alvo = this.targetMod(args, 'alterar um script');
        if ('erro' in alvo) return { result: alvo.erro };
        const res = await this.modService.setScriptEnabled(alvo.modId, String(args.key || ''), !!args.enabled);
        const mod = this.modService.getMod(alvo.modId);
        if (res.ok && mod) await this.modRuntime?.loadMod(mod);
        return { result: res.message };
      }

      case 'get_mod_script_logs': {
        const alvo = this.targetMod(args, 'consultar logs');
        if ('erro' in alvo) return { result: alvo.erro };
        const logs = this.modRuntime?.getLogs(alvo.modId, 40) ?? [];
        if (logs.length === 0) return { result: 'Nenhum log — o script não imprimiu nada e não lançou erro.' };
        return { result: logs };
      }

      case 'get_mod_api_reference': {
        return { result: MOD_API_REFERENCE };
      }

      case 'attach_session_to_mod': {
        const res = await this.modService.attachActiveSession(args.mod_id ? String(args.mod_id) : undefined);
        this.syncModLookup();
        return { result: res.message };
      }

      case 'get_session_context': {
        const mod = this.modService.getModForActiveThread();
        if (!mod) {
          return {
            result: {
              sessao: 'livre',
              explicacao: this.modService.freeSessionHint('modificar o mundo'),
              modsDisponiveis: this.modService.list().map((m: any) => ({ id: m.id, name: m.name, blocos: m.blocks.length })),
            },
          };
        }
        return {
          result: {
            sessao: 'vinculada',
            mod: { id: mod.id, name: mod.name, revisao: mod.revision, habilitado: mod.enabled },
            conteudo: {
              blocos: (mod.blocks || []).map((b) => ({ key: b.key, name: b.name, blockId: b.blockId })),
              entidades: (mod.entities || []).map((e) => e.key),
              estruturas: (mod.structures || []).map((st) => st.key),
            },
            observacao: 'As ferramentas de escrita editam este mod por padrão; não é preciso repetir mod_id.',
          },
        };
      }

      case 'list_mod_revisions': {
        const alvo = this.targetMod(args, 'consultar o histórico');
        if ('erro' in alvo) return { result: alvo.erro };
        const revs = await this.modService.listRevisions(alvo.modId);
        if (revs.length === 0) return { result: `O mod "${alvo.modId}" ainda não tem revisões anteriores.` };
        return { result: revs };
      }

      case 'rollback_mod': {
        const alvo = this.targetMod(args, 'reverter uma versão');
        if ('erro' in alvo) return { result: alvo.erro };
        const res = await this.modService.rollbackMod(alvo.modId, Number(args.revision));
        this.syncModLookup();
        return { result: res.message };
      }

      case 'list_mods': {
        const list = this.modService.list();
        if (list.length === 0) {
          return { result: 'Nenhum mod instalado neste mundo ainda. Use create_mod para começar uma modificação nova.' };
        }
        return { result: list };
      }

      case 'set_mod_enabled': {
        const res = await this.modService.setEnabled(String(args.mod_id || ''), !!args.enabled);
        this.syncModLookup();
        return { result: res.message };
      }

      case 'delete_mod': {
        const res = await this.modService.deleteMod(String(args.mod_id || ''), args.purge_placed_blocks !== false);
        this.syncModLookup();
        return { result: res.message };
      }

      case 'export_mod': {
        const pkg = this.modService.exportMod(String(args.mod_id || ''));
        if (!pkg) return { result: `Mod "${args.mod_id}" não encontrado.` };
        return { result: JSON.stringify(pkg, null, 2) };
      }

      case 'import_mod': {
        let payload: any;
        try {
          payload = typeof args.mod_json === 'string' ? JSON.parse(args.mod_json) : args.mod_json;
        } catch (err: any) {
          return { result: `JSON de mod inválido: ${err?.message || err}` };
        }
        const res = await this.modService.importMod(payload);
        this.syncModLookup();
        return { result: res.message };
      }

      case 'undo_last_action': {
        if (!this.undoManager) return { result: 'Histórico de desfazer indisponível.' };

        // Persistir a reversão é parte do trabalho: desfazer só na memória deixaria o save
        // com a construção antiga, que reapareceria no próximo carregamento.
        let reverted: { x: number; y: number; z: number; blockType: number }[] = [];
        const previous = this.undoManager.onApplied;
        this.undoManager.onApplied = (changes) => { reverted = changes; };
        const ok = this.undoManager.undo();
        this.undoManager.onApplied = previous;

        if (!ok) return { result: 'Não há nenhuma ação recente para desfazer.' };

        await WorldRepository.saveBlockModBatch(this.currentWorldId, reverted);
        this.onBlocksChanged(reverted);
        return { result: `Última construção desfeita: ${reverted.length} bloco(s) voltaram ao estado anterior e o save foi atualizado.` };
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
