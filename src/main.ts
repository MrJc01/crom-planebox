import * as THREE from 'three';
import { createScene } from './render/scene';
import { World } from './world/world';
import { Chunk, chunkKey, CX, CY, CZ } from './world/chunk';
import { WorldGen } from './world/worldgen';
import { ChunkGeometryRaw } from './world/mesher';
import { geometryFromRaw } from './world/meshGeometry';
import { VoxelPhysics } from './world/physics';
import { isSolid } from './world/blocks';
import { AudioSystem } from './audio/AudioSystem';
import { SOUNDS, soundForBreak, soundForFootstep, soundForPlace } from './audio/synth';
import { LightEngine } from './world/lighting';
import { invalidatePathCache } from './entities/Pathfinding';
import { ModRuntime } from './mods/ModRuntime';
import { ModHostBridge } from './mods/ModAPI';
import { MobSpawner } from './entities/MobSpawner';
import { CombatTimers, damageForTier, isInMeleeReach } from './entities/Combat';
import { foodValueOf, isEdible } from './game/SurvivalSystem';
import { PlayerController } from './player/controller';
import { Interaction } from './player/interaction';
import { WorldRepository } from './storage/WorldRepository';
import { prepareWorld } from './storage/SaveMigration';
import { MCPExecutors } from './ai/MCPExecutors';
import { OpenRouterClient } from './ai/OpenRouterClient';
import { CameraManager } from './engine/CameraManager';
import { HUD } from './ui/HUD';
import { ChatOverlay } from './ui/ChatOverlay';
import { PauseMenu } from './ui/PauseMenu';
import { MainMenu } from './ui/MainMenu';
import { WorldCreationWizard } from './ui/WorldCreationWizard';
import { UIManager } from './ui/UIManager';
import { CharacterCreator } from './ui/CharacterCreator';
import { ModsPage } from './ui/ModsPage';
import { GameMenu } from './ui/GameMenu';
import { DebugPanel } from './ui/DebugPanel';
import { profiler } from './core/profiler';
import { getPathCacheStats } from './entities/Pathfinding';
import { CodeEditorPage } from './ui/CodeEditorPage';
import { PlayerModel } from './player/PlayerModel';
import { AvatarManager } from './player/AvatarManager';
import { Appearance, DEFAULT_APPEARANCE } from './player/Appearance';
import { InventoryModal } from './ui/InventoryModal';
import { EntitySystem } from './entities/EntitySystem';
import { EventSystem } from './events/EventSystem';
import { UndoManager } from './storage/UndoManager';
import { GameModeManager } from './game/GameModeManager';
import { SurvivalSystem } from './game/SurvivalSystem';
import { ItemDropSystem } from './game/ItemDropSystem';
import { SignalingClient } from './net/SignalingClient';
import { PeerSync } from './net/PeerSync';
import { CommandSystem, CommandContext, KnownPlayer } from './commands/CommandSystem';
import { NetMessage } from './net/protocol';
import { hashAppearance } from './net/codec';
import { WorldRecord, CURRENT_SAVE_VERSION } from './storage/Database';

const MAX_INFLIGHT = 6;     // simultaneous generations in worker
const LAST_WORLD_KEY = 'crom:lastWorldId';

let seed = (Math.random() * 0xffffffff) >>> 0;

async function bootstrap() {
  console.log('🎮 Inicializando Crom Planebox 3D Engine (Base Crom Quadrado)...');

  const app = document.getElementById('app') || document.body;
  const menuEl = document.getElementById('menu');
  if (menuEl) menuEl.style.display = 'none'; // substituído pelo MainMenu real

  const gs = createScene(app);
  const world = new World();
  const gen = new WorldGen(seed);
  const player = new PlayerController(world, gs.camera);
  const physics = new VoxelPhysics(world, gs.scene);
  const inter = new Interaction(world, physics, player, gs.scene);
  const inventoryModal = new InventoryModal(inter);

  // Motor de luz: o `World` implementa `LightGrid`, então a propagação atravessa a fronteira
  // de chunks naturalmente (uma caverna iluminada por uma abertura no chunk vizinho funciona).
  const lightEngine = new LightEngine(world, CY);

  /** Hora do mundo em fração de dia (0 = meia-noite, 0.5 = meio-dia). */
  let timeOfDay = 0.35;
  /** Um dia completo em segundos reais. */
  const DAY_LENGTH = 900;
  // A luz de céu é assada na cor dos vértices, então mudar `sunScale` exige re-meshar. Refazer
  // a cada frame seria inviável; refazemos em degraus perceptíveis — poucas vezes por dia.
  let lastBakedSun = -1;

  function computeChunkLight(c: Chunk): void {
    const sun: any[] = [];
    const blocks: any[] = [];
    const baseX = c.cx * CX, baseZ = c.cz * CZ;

    c.light.fill(0);
    for (let z = 0; z < CZ; z++) {
      for (let x = 0; x < CX; x++) lightEngine.seedSunColumn(baseX + x, baseZ + z, sun);
    }
    for (let y = 0; y < CY; y++) {
      for (let z = 0; z < CZ; z++) {
        for (let x = 0; x < CX; x++) lightEngine.seedBlockLight(baseX + x, y, baseZ + z, blocks);
      }
    }

    lightEngine.propagateSun(sun);
    lightEngine.propagateBlockLight(blocks);
    c.lightDirty = false;

    // A luz vaza para os vizinhos; eles precisam re-meshar para a emenda não ficar escura.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = world.getChunk(c.cx + dx, c.cz + dz);
      if (n && !n.lightDirty) n.dirty = true;
    }
  }

  const cameraManager = new CameraManager(gs.scene, gs.camera, gs.renderer, player);
  const gameModeManager = new GameModeManager(cameraManager, player);
  const survivalSystem = new SurvivalSystem(player);
  const itemDropSystem = new ItemDropSystem(gs.scene, player);

  itemDropSystem.onCollect = (blockType, count) => {
    inter.grant(blockType, count);
    audio.play(SOUNDS.pegarItem, { channel: 'ui', dedupeKey: 'pegarItem' });
  };
  inter.onItemDrop = (blockType, count, x, y, z) => itemDropSystem.spawn(blockType, count, x, y, z);

  function findSpawn(): THREE.Vector3 {
    for (let r = 0; r < 64; r++) {
      for (let a = 0; a < 8; a++) {
        const x = Math.round(Math.cos(a * 0.785) * r * 8);
        const z = Math.round(Math.sin(a * 0.785) * r * 8);
        const col = gen.column(x, z);
        if (col.height > 10) {
          return new THREE.Vector3(x + 0.5, col.height + 8, z + 0.5);
        }
      }
    }
    return new THREE.Vector3(0.5, 120, 0.5);
  }

  player.pos.copy(findSpawn());

  // Mesh map per chunk
  interface ChunkMeshes { solid: THREE.Mesh | null; water: THREE.Mesh | null; glass: THREE.Mesh | null }
  const meshes = new Map<string, ChunkMeshes>();

  // Worker for chunk terrain generation
  let worker = new Worker(new URL('./world/genWorker.ts', import.meta.url), { type: 'module' });
  let inflight = 0;
  let savedChunks = new Map<string, Uint8Array>();

  function initWorker(): void {
    worker.postMessage({ type: 'init', seed });
    worker.onmessage = (ev) => {
      const msg = ev.data;
      if (msg.type !== 'chunk') return;
      inflight--;
      const key = chunkKey(msg.cx, msg.cz);
      world.pending.delete(key);
      const saved = savedChunks.get(key);
      const data = saved ?? new Uint8Array(msg.buffer);
      const chunk = new Chunk(msg.cx, msg.cz, data);
      if (saved) chunk.edited = true;
      world.addChunk(chunk);
    };
  }
  initWorker();

  function disposeChunkMesh(key: string): void {
    const m = meshes.get(key);
    if (!m) return;
    for (const mesh of [m.solid, m.water, m.glass]) {
      if (!mesh) continue;
      gs.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    meshes.delete(key);
  }

  function streamChunks(): void {
    const pcx = Math.floor(player.pos.x / CX);
    const pcz = Math.floor(player.pos.z / CZ);

    const viewRadius = cameraManager.renderDistance;
    const unloadRadius = viewRadius + 3;
    const meshBudget = Math.max(2, Math.floor(viewRadius / 2));

    if (inflight < MAX_INFLIGHT) {
      const wanted: [number, number, number][] = [];
      for (let dz = -viewRadius; dz <= viewRadius; dz++) {
        for (let dx = -viewRadius; dx <= viewRadius; dx++) {
          const d2 = dx * dx + dz * dz;
          if (d2 > viewRadius * viewRadius + 2) continue;
          const cx = pcx + dx, cz = pcz + dz;
          const key = chunkKey(cx, cz);
          if (world.chunks.has(key) || world.pending.has(key)) continue;
          wanted.push([d2, cx, cz]);
        }
      }
      wanted.sort((a, b) => a[0] - b[0]);
      for (const [, cx, cz] of wanted) {
        if (inflight >= MAX_INFLIGHT) break;
        world.pending.add(chunkKey(cx, cz));
        worker.postMessage({ type: 'gen', cx, cz });
        inflight++;
      }
    }

    const dirty: [number, number, Chunk][] = [];
    for (const c of world.chunks.values()) {
      if (!c.dirty) continue;
      const dx = c.cx - pcx, dz = c.cz - pcz;
      const d2 = dx * dx + dz * dz;
      if (d2 > viewRadius * viewRadius + 2) continue;
      if (!world.neighborsReady(c.cx, c.cz)) continue;
      dirty.push([d2, 0, c]);
    }
    dirty.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < Math.min(meshBudget, dirty.length); i++) {
      const c = dirty[i][2];
      // A luz é calculada aqui, e não quando o chunk chega do worker, porque precisa dos
      // vizinhos prontos — o mesmo pré-requisito que o mesh já espera.
      if (c.lightDirty) computeChunkLight(c);
      pedirMesh(c);
    }

    for (const [key, c] of world.chunks) {
      const dx = c.cx - pcx, dz = c.cz - pcz;
      if (dx * dx + dz * dz > unloadRadius * unloadRadius) {
        disposeChunkMesh(key);
        if (c.edited) {
          savedChunks.set(key, c.data);
        }
        world.chunks.delete(key);
      }
    }
  }

  // --- Malha em Web Worker -------------------------------------------------------------------
  //
  // Depois da luz corrigida, gerar a malha era o maior custo de frame restante: percorrer 131 mil
  // voxels e montar dezenas de milhares de faces, na mesma thread que desenha.
  //
  // Os buffers são TRANSFERIDOS nos dois sentidos, então o custo de atravessar a fronteira é
  // zero — o que sobra na thread principal é só montar a `BufferGeometry`.
  const meshWorker = new Worker(new URL('./world/meshWorker.ts', import.meta.url), { type: 'module' });
  let proximoJob = 1;
  /** Job em voo por chunk. Se o chunk mudar de novo, o resultado antigo é descartado. */
  const jobsEmVoo = new Map<string, number>();
  const MAX_MESH_EM_VOO = 3;

  /**
   * Pool dos buffers enviados ao worker.
   *
   * `padChunk` e `padLight` alocam ~150 KB cada, e todo re-mesh gerava 300 KB para o coletor
   * recolher depois — o suficiente para produzir pausas de GC ao voar pelo mundo. Como os
   * buffers são transferidos (a thread principal perde a posse), o worker os devolve e eles
   * voltam para cá em vez de virar lixo.
   */
  const poolBuffers: ArrayBuffer[] = [];
  const TAM_PAD = (CX + 2) * (CY + 2) * (CZ + 2);

  function bufferDoPool(): ArrayBuffer {
    return poolBuffers.pop() ?? new ArrayBuffer(TAM_PAD);
  }

  function pedirMesh(c: Chunk): void {
    const key = chunkKey(c.cx, c.cz);
    if (jobsEmVoo.size >= MAX_MESH_EM_VOO && !jobsEmVoo.has(key)) return;

    const jobId = proximoJob++;
    jobsEmVoo.set(key, jobId);
    c.dirty = false; // marcado agora: se mudar durante a geração, vira dirty de novo e refaz

    const padded = world.padChunkInto(c.cx, c.cz, new Uint8Array(bufferDoPool()));
    const light = world.padLightInto(c.cx, c.cz, new Uint8Array(bufferDoPool()));
    meshWorker.postMessage(
      { type: 'mesh', jobId, cx: c.cx, cz: c.cz, padded: padded.buffer, light: light.buffer, sunScale: gs.getSunScale() },
      [padded.buffer, light.buffer],
    );
  }

  meshWorker.onmessage = (ev: MessageEvent) => {
    const { type, jobId, cx, cz, geo, padded, light } = ev.data as
      { type: string; jobId: number; cx: number; cz: number; geo: ChunkGeometryRaw; padded: ArrayBuffer; light: ArrayBuffer };
    if (type !== 'meshed') return;

    // Devolve os buffers ao pool antes de qualquer saída antecipada — inclusive quando o
    // resultado é descartado, senão a reciclagem só funcionaria no caminho feliz.
    if (padded?.byteLength === TAM_PAD) poolBuffers.push(padded);
    if (light?.byteLength === TAM_PAD) poolBuffers.push(light);
    if (poolBuffers.length > 8) poolBuffers.length = 8; // teto: não vira cache infinito

    const key = chunkKey(cx, cz);
    // Resultado obsoleto: o chunk foi alterado e um job mais novo já está a caminho.
    if (jobsEmVoo.get(key) !== jobId) return;
    jobsEmVoo.delete(key);

    // O chunk pode ter sido descarregado enquanto a malha era gerada.
    if (!world.chunks.has(key)) return;

    aplicarMesh(cx, cz, geo);
  };

  function aplicarMesh(cx: number, cz: number, geo: ChunkGeometryRaw): void {
    const key = chunkKey(cx, cz);
    disposeChunkMesh(key);

    const entry: ChunkMeshes = { solid: null, water: null, glass: null };
    const partes: [keyof ChunkMeshes, typeof geo.solid, THREE.Material, boolean][] = [
      ['solid', geo.solid, gs.solidMaterial, true],
      ['water', geo.water, gs.waterMaterial, false],
      ['glass', geo.glass, gs.glassMaterial, true],
    ];

    for (const [nome, bruto, material, projetaSombra] of partes) {
      if (!bruto) continue;
      const mesh = new THREE.Mesh(geometryFromRaw(bruto), material);
      mesh.position.set(cx * CX, 0, cz * CZ);
      mesh.castShadow = projetaSombra;
      mesh.receiveShadow = true;
      gs.scene.add(mesh);
      entry[nome] = mesh;
    }

    meshes.set(key, entry);
  }


  // Nenhum mundo é criado/carregado automaticamente — o MainMenu decide isso (seção 2 do checklist).
  let currentWorld: WorldRecord = {
    id: '', name: 'Nenhum Mundo', seed, groundHeight: 4, fov: 75, cameraMode: 'topdown',
    defaultGameMode: 'classic', onlineEnabled: false, createdAt: 0, updatedAt: 0,
  };

  // World simulation systems
  const undoManager = new UndoManager(world);
  const entitySystem = new EntitySystem(world, gs.scene);

  // --- Personagem do jogador ---------------------------------------------------------------
  // O boneco existe sempre na cena, mas só fica visível em terceira pessoa: em primeira pessoa
  // a câmera está dentro da cabeça e o modelo apareceria como uma parede de textura.
  let localAppearance: Appearance = DEFAULT_APPEARANCE;
  const playerModel = new PlayerModel(localAppearance);
  playerModel.setVisible(false);
  gs.scene.add(playerModel.group);

  const avatars = new AvatarManager(gs.scene);

  // --- Áudio ----------------------------------------------------------------------------------
  // Tudo sintetizado: o projeto não tem asset de som, e trazê-los custaria megabytes num jogo
  // que entrega 900 KB. O contexto nasce suspenso — navegador não deixa tocar antes de um gesto
  // do usuário —, então é despertado no primeiro clique ou tecla.
  const audio = new AudioSystem();
  const despertarAudio = () => audio.despertar();
  addEventListener('pointerdown', despertarAudio, { once: false });
  addEventListener('keydown', despertarAudio, { once: false });

  // --- Combate --------------------------------------------------------------------------
  const mobSpawner = new MobSpawner();
  const playerCombat = new CombatTimers();

  const characterCreator = new CharacterCreator(localAppearance);
  characterCreator.onSave = (appearance) => {
    localAppearance = appearance;
    playerModel.setAppearance(appearance);
    WorldRepository.saveAppearance(appearance);
    hud.showToast(`Personagem "${appearance.name}" salvo — os outros jogadores já veem este visual.`);
  };

  // Aparência é global ao jogador: carregada uma vez no boot, não por mundo.
  WorldRepository.getAppearance().then((saved) => {
    localAppearance = saved;
    playerModel.setAppearance(saved);
    characterCreator.setAppearance(saved);
  });
  const eventSystem = new EventSystem(world, currentWorld.id);

  // MCP AI Integration
  const mcpExecutors = new MCPExecutors(world, player, gs.scene, gs.renderer, currentWorld.id, entitySystem, eventSystem, undoManager);
  const openRouterClient = new OpenRouterClient(mcpExecutors);

  // --- Runtime de mods ----------------------------------------------------------------------
  // A ponte é a única porta entre o código de um mod e o jogo: o que não estiver aqui, ele não
  // alcança. Nada de `window`, `fetch` ou `document` chega até o script.
  const modBridge: ModHostBridge = {
    getBlock: (x, y, z) => world.getBlock(x, y, z),
    setBlock: (x, y, z, t) => world.setBlock(x, y, z, t),
    getGroundY: (x, z) => {
      for (let y = CY - 1; y >= 0; y--) {
        const b = world.getBlock(x, y, z);
        if (b !== 0 && b !== 6) return y;
      }
      return 0;
    },
    spawnEntity: (modId, entityKey, x, y, z) => {
      const mod = mcpExecutors.modService.getMod(modId);
      const especie = (mod?.entities ?? []).find((e) => e.key === entityKey);
      if (!especie) return null;
      const rec = entitySystem.createCustomEntity({
        name: especie.name, faction: especie.faction, role: especie.role,
        x, y, z, parts: especie.parts as any, behaviorScript: especie.behaviorScript,
      });
      return rec.id;
    },
    listEntities: () => entitySystem.listEntities().map((e: any) => ({
      id: e.id, name: e.name, x: e.position.x, y: e.position.y, z: e.position.z,
    })),
    damageEntity: (id, amount) => entitySystem.damageEntity(id, amount),
    playerPosition: () => ({ x: player.pos.x, y: player.pos.y, z: player.pos.z }),
    teleportPlayer: (x, y, z) => { player.pos.set(x, y, z); player.vel.set(0, 0, 0); },
    playerHealth: () => survivalSystem.health,
    giveItem: (block, count) => inter.grant(block, count),
    toast: (msg) => hud.showToast(msg),
    timeOfDay: () => timeOfDay,
    playSound: (nome, posicao, volume) => {
      const spec = SOUNDS[nome];
      if (!spec) return; // nome inválido é ignorado, não quebra o script
      audio.play(spec, { position: posicao, volume, dedupeKey: `mod:${nome}` });
    },
  };

  const modRuntime = new ModRuntime(modBridge);

  /** Fase do dia em texto, para os mods reagirem sem interpretar a fração. */
  const fasesDoDia = (t: number): string =>
    t < 0.2 ? 'noite' : t < 0.3 ? 'amanhecer' : t < 0.7 ? 'dia' : t < 0.8 ? 'anoitecer' : 'noite';

  // Bloco escrito por script é salvo COM a autoria do mod, para poder ser desfeito com precisão.
  modRuntime.onBlocksChanged = (modId, changes) => {
    if (currentWorld.id) WorldRepository.saveBlockModBatch(currentWorld.id, changes, modId);
    relightBatch(changes);
    if (peerSync.role === 'host') enfileirarBlocos(changes);
  };
  modRuntime.onScriptDisabled = (modId, scriptKey, reason) => {
    hud.showToast(`⚠️ Script "${scriptKey}" do mod "${modId}" foi desligado: ${reason}`);
  };
  mcpExecutors.modRuntime = modRuntime;

  // --- Telas de manutenção -----------------------------------------------------------------
  // Versionamento, rollback e quarentena existiam mas só a IA os alcançava. Estas duas telas
  // põem na mão do usuário o que já estava construído.
  const modsPage = new ModsPage(mcpExecutors.modService, modRuntime);
  const codeEditor = new CodeEditorPage(mcpExecutors.modService, modRuntime);

  modsPage.onOpenEditor = (modId, scriptKey) => {
    uiManager.openBlocking('code-editor');
    void codeEditor.abrir(modId, scriptKey);
  };
  const recarregarTelas = () => {
    if (modsPage.isOpen) modsPage.render();
    chatOverlay.listMods = () => mcpExecutors.modService.getMods().map((m) => ({ id: m.id, name: m.name }));
  };
  modsPage.onChanged = recarregarTelas;
  codeEditor.onChanged = recarregarTelas;

  // --- Hub de navegação ---------------------------------------------------------------------
  // Antes, cada tela só era alcançável por um atalho de tecla próprio — quem não leu a
  // documentação não descobria nenhuma. O hub dá uma porta única e mostra os atalhos.
  const debugPanel = new DebugPanel({
    chunksCarregados: () => world.chunks.size,
    chunksSujos: () => { let n = 0; for (const c of world.chunks.values()) if (c.dirty) n++; return n; },
    malhasEmVoo: () => jobsEmVoo.size,
    filaLuz: () => filaRelight.size,
    entidades: () => entitySystem.listEntities().length,
    hostis: () => entitySystem.hostileCount,
    vozesAudio: () => audio.vozes,
    modsCarregados: () => modRuntime.loadedCount,
    rede: () => ({ ...peerSync.getTrafficStats(), papel: peerSync.role, peers: peerSync.peerCount }),
    posicao: () => ({ x: player.pos.x, y: player.pos.y, z: player.pos.z }),
    cacheRotas: () => getPathCacheStats(),
  });

  const gameMenu = new GameMenu(audio);
  gameMenu.onRetomar = () => uiManager.closeBlocking('game-menu');
  gameMenu.registrar({
    id: 'personagem', icone: '🧍', titulo: 'Personagem', atalho: 'F4',
    descricao: 'Aparência, cores e porte. É o visual que os outros veem online.',
    acao: () => uiManager.openBlocking('character-creator'),
  });
  gameMenu.registrar({
    id: 'mods', icone: '🧩', titulo: 'Mods', atalho: 'F6',
    descricao: 'O que cada modificação adicionou, histórico de versões e exportar.',
    acao: () => uiManager.openBlocking('mods-page'),
  });
  gameMenu.registrar({
    id: 'editor', icone: '📝', titulo: 'Editor de código', atalho: 'F7',
    descricao: 'Editar o comportamento dos mods com o mundo aberto.',
    acao: () => uiManager.openBlocking('code-editor'),
  });
  gameMenu.registrar({
    id: 'inventario', icone: '🎒', titulo: 'Inventário', atalho: 'E',
    descricao: 'Blocos, ferramentas e bancada de criação.',
    acao: () => uiManager.openBlocking('inventory'),
  });
  gameMenu.registrar({
    id: 'mundo', icone: '⚙️', titulo: 'Mundo e rede', atalho: '',
    descricao: 'Câmera, modo de jogo, multiplayer e jogadores conectados.',
    acao: () => uiManager.openBlocking('pause'),
  });
  gameMenu.registrar({
    id: 'ia', icone: '💬', titulo: 'Conversar com a IA', atalho: 'T',
    descricao: 'Criar mods, construir e modificar o jogo pela conversa.',
    acao: () => { uiManager.closeBlocking('game-menu'); uiManager.openFloating('chat'); },
  });

  // HUD & UI Overlays (ficam ocultos até o jogo realmente começar, para o MainMenu não competir com eles)
  const hud = new HUD(cameraManager);
  hud.canUseTopdown = () => gameModeManager.mode === 'creative';
  undoManager.onToast = (msg) => hud.showToast(msg);
  const chatOverlay = new ChatOverlay(openRouterClient);
  // A sessão de chat aberta define qual mod as ferramentas da IA editam. Sem este vínculo,
  // toda conversa escreveria no mod errado — ou em nenhum.
  chatOverlay.listMods = () => mcpExecutors.modService.getMods().map((m) => ({ id: m.id, name: m.name }));
  chatOverlay.onSessionChanged = (threadId, modId) => {
    mcpExecutors.modService.setActiveSession(threadId ?? undefined, modId);
  };
  mcpExecutors.modService.onModQuarantined = (mod, reason) => {
    hud.showToast(`⚠️ Mod "${mod.name}" foi isolado: ${reason}`);
  };
  hud.setVisible(false);
  inventoryModal.setHotbarVisible(false);
  chatOverlay.hide();

  // --- Identidade local & Rede P2P (host-autoritativo; ver docs/NETWORK_PROTOCOL.md) ---
  const localPlayerId = `local-${Math.random().toString(36).slice(2, 9)}`;
  const localPlayerName = 'Você';
  let localIsOp = true; // dono do mundo (host/single-player) é sempre OP por padrão
  const remotePlayers = new Map<string, { name: string; isOp: boolean }>();

  const signaling = new SignalingClient();
  const peerSync = new PeerSync(signaling);
  const commandSystem = new CommandSystem();

  chatOverlay.localPlayerName = localPlayerName;

  function listAllPlayers(): KnownPlayer[] {
    return [
      { id: localPlayerId, name: localPlayerName, isOp: localIsOp },
      ...Array.from(remotePlayers.entries()).map(([id, p]) => ({ id, name: p.name, isOp: p.isOp })),
    ];
  }

  function setPlayerOp(target: string, isOp: boolean): boolean {
    if (target === localPlayerName || target === localPlayerId) { localIsOp = isOp; return true; }
    for (const [id, p] of remotePlayers) {
      if (p.name === target || id === target) {
        p.isOp = isOp;
        peerSync.sendTo(id, { type: 'op_changed', playerId: id, isOp });
        return true;
      }
    }
    return false;
  }

  function buildCommandContext(callerId: string, callerIsOp: boolean): CommandContext {
    return {
      callerId,
      callerIsOp,
      isHost: peerSync.role !== 'guest',
      gameModeManager,
      player,
      listPlayers: listAllPlayers,
      setOp: setPlayerOp,
      setGameMode: (target, mode) => {
        if (!target || target === localPlayerName || target === localPlayerId) {
          gameModeManager.setMode(mode);
          return true;
        }
        for (const [id] of remotePlayers) {
          if (id === target) return true; // promoção remota efetiva fica para uma próxima iteração (roster completo)
        }
        return false;
      },
      kick: (target) => {
        for (const [id, p] of remotePlayers) {
          if (p.name === target || id === target) {
            peerSync.sendTo(id, { type: 'kick', playerId: id });
            remotePlayers.delete(id);
            return true;
          }
        }
        return false;
      },
      connectCrom: async () => await peerSync.hostRoom(currentWorld.name || 'Mundo Crom'),
      disconnectCrom: () => peerSync.stop(),
    };
  }

  chatOverlay.onCommand = async (raw) => {
    if (peerSync.role === 'guest') {
      peerSync.sendToHost({ type: 'command', playerId: localPlayerId, raw });
      return { ok: true, message: 'Comando enviado ao anfitrião...' };
    }
    return commandSystem.execute(raw, buildCommandContext(localPlayerId, localIsOp));
  };

  chatOverlay.onWorldChatSend = (text) => {
    const msg: NetMessage = { type: 'chat_message', playerId: localPlayerId, name: localPlayerName, text, timestamp: Date.now() };
    if (peerSync.role === 'host') peerSync.broadcast(msg);
    else if (peerSync.role === 'guest') peerSync.sendToHost(msg);
  };

  peerSync.onMessage = (msg, fromPeerId) => {
    switch (msg.type) {
      case 'chat_message':
        chatOverlay.receiveWorldChatMessage(msg.name, msg.text);
        if (peerSync.role === 'host') peerSync.broadcast(msg, fromPeerId);
        break;
      case 'command': {
        if (peerSync.role !== 'host') break;
        const remote = remotePlayers.get(fromPeerId);
        commandSystem.execute(msg.raw, buildCommandContext(fromPeerId, remote?.isOp ?? false)).then((result) => {
          peerSync.sendTo(fromPeerId, { type: 'chat_message', playerId: 'system', name: 'Sistema', text: result.message, timestamp: Date.now() });
        });
        break;
      }
      case 'block_update':
        world.setBlock(msg.x, msg.y, msg.z, msg.blockType);
        break;
      case 'block_batch':
        for (const b of msg.blocks) world.setBlock(b.x, b.y, b.z, b.blockType);
        break;
      case 'full_sync': {
        // Ordem obrigatória: registrar os mods primeiro, aplicar os blocos depois.
        const applyBlocks = () => {
          for (const m of msg.blockMods) world.setBlock(m.x, m.y, m.z, m.blockType);
          chatOverlay.receiveWorldChatMessage('', 'Sincronizado com o mundo do anfitrião.', true);
        };
        if (msg.mods?.length) {
          mcpExecutors.modService.applyRemoteMods(msg.mods).then((n) => {
            if (n > 0) hud.showToast(`🧩 ${n} mod(s) recebidos do anfitrião`);
            applyBlocks();
          });
        } else {
          applyBlocks();
        }
        break;
      }
      case 'mod_sync':
        // Mod criado pela IA do anfitrião durante a partida.
        mcpExecutors.modService.applyRemoteMods([msg.mod]).then((n) => {
          if (n > 0) hud.showToast(`🧩 Mod "${msg.mod.name}" recebido do anfitrião`);
        });
        if (peerSync.role === 'host') peerSync.broadcast(msg, fromPeerId);
        break;
      case 'player_joined':
        remotePlayers.set(msg.playerId, { name: msg.name, isOp: false });
        chatOverlay.receiveWorldChatMessage('', `${msg.name} entrou no mundo.`, true);
        break;
      case 'player_left':
        remotePlayers.delete(msg.playerId);
        avatars.remove(msg.playerId);
        chatOverlay.receiveWorldChatMessage('', 'Um jogador saiu do mundo.', true);
        break;
      case 'player_state': {
        if (msg.playerId === localPlayerId) break;
        // `appearance` vem de outro cliente: o AvatarManager higieniza antes de virar cor/escala.
        avatars.updateFromState(msg.playerId, msg.name, msg.x, msg.y, msg.z, msg.yaw, msg.pitch, msg.appearance);
        const known = remotePlayers.get(msg.playerId);
        if (known) known.name = msg.name;
        // Topologia estrela: os convidados só falam com o anfitrião, então é ele quem repassa
        // o estado de cada um para todos os outros.
        if (peerSync.role === 'host') peerSync.broadcast(msg, fromPeerId);
        break;
      }
      case 'op_changed':
        if (msg.playerId === localPlayerId) localIsOp = msg.isOp;
        break;
      case 'kick':
        if (msg.playerId === localPlayerId) {
          chatOverlay.receiveWorldChatMessage('', 'Você foi removido do mundo pelo anfitrião.', true);
          peerSync.stop();
        }
        break;
    }
  };

  peerSync.onPeerConnected = (peerId) => {
    if (peerSync.role !== 'host') return;
    const name = `Jogador-${peerId.slice(-4)}`;
    remotePlayers.set(peerId, { name, isOp: false });
    WorldRepository.getBlockModsForWorld(currentWorld.id).then((mods) => {
      const blockMods = Array.from(mods.entries()).map(([key, blockType]) => {
        const [x, y, z] = key.split(',').map(Number);
        return { x, y, z, blockType };
      });
      // Os mods vão junto: sem eles o convidado aplicaria ids de bloco que não existem no
      // registro local e veria "bloco ausente" onde o anfitrião vê o bloco de verdade.
      peerSync.sendTo(peerId, {
        type: 'full_sync',
        blockMods,
        players: [],
        mods: mcpExecutors.modService.getMods(),
      });
    });
    peerSync.broadcast({ type: 'player_joined', playerId: peerId, name }, peerId);
    hud.showToast(`${name} entrou no mundo!`);
  };
  peerSync.onPeerDisconnected = (peerId) => {
    const p = remotePlayers.get(peerId);
    remotePlayers.delete(peerId);
    if (peerSync.role === 'host' && p) peerSync.broadcast({ type: 'player_left', playerId: peerId });
  };
  peerSync.onHostClosed = () => {
    chatOverlay.receiveWorldChatMessage('', 'O anfitrião encerrou a sessão. Você voltou a jogar localmente.', true);
  };
  peerSync.onReconnecting = (attempt, max) => {
    hud.showToast(`Conexão caiu — tentando reconectar (${attempt}/${max})...`);
  };

  mcpExecutors.onBlocksChanged = (mods) => {
    // Uma construção grande da IA pode mudar milhares de blocos: relumina uma vez por região
    // aproximada, em vez de uma vez por bloco, senão o custo explode.
    relightBatch(mods);
    if (peerSync.role !== 'host') return;
    enfileirarBlocos(mods);
  };
  /**
   * Recalcula a luz numa vizinhança e marca os chunks tocados para re-mesh. Colocar uma tocha
   * ou abrir um buraco no teto precisa acender/apagar a área na hora — refazer o chunk inteiro
   * a cada bloco custaria dezenas de milissegundos por clique.
   */
  /**
   * Fila de regiões a reluminar, processada com orçamento no loop.
   *
   * Antes o recálculo era **síncrono a cada bloco**: `recalcRegion` com raio 10 zera 9 mil
   * células e re-semeia 441 colunas inteiras de 128 blocos — mais de 100 mil operações por
   * clique, e ainda marcava 9 chunks para re-mesh. Era a causa principal do travamento.
   *
   * Agora o custo é o mesmo, mas espalhado: no máximo uma região por frame, e regiões próximas
   * se fundem numa só antes de serem processadas.
   */
  const RELIGHT_CELL = 12;
  const filaRelight = new Map<string, { x: number; y: number; z: number; radius: number }>();

  function queueRelight(x: number, y: number, z: number, radius = 8): void {
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    // Agrupa por célula grossa: colocar 30 blocos vizinhos vira UMA região, não 30.
    const chave = `${Math.floor(fx / RELIGHT_CELL)},${Math.floor(fy / RELIGHT_CELL)},${Math.floor(fz / RELIGHT_CELL)}`;
    const atual = filaRelight.get(chave);
    if (atual) {
      if (radius > atual.radius) atual.radius = radius;
      return;
    }
    filaRelight.set(chave, { x: fx, y: fy, z: fz, radius });
  }

  /** Processa uma região por frame. O resto espera — luz atrasada é melhor que frame perdido. */
  function processarRelight(): void {
    const primeiro = filaRelight.entries().next();
    if (primeiro.done) return;
    const [chave, r] = primeiro.value;
    filaRelight.delete(chave);

    lightEngine.recalcRegion(r.x, r.y, r.z, r.radius);

    // Marca só os chunks que a região realmente toca, em vez dos 9 vizinhos sempre.
    const cx0 = Math.floor((r.x - r.radius) / CX), cx1 = Math.floor((r.x + r.radius) / CX);
    const cz0 = Math.floor((r.z - r.radius) / CZ), cz1 = Math.floor((r.z + r.radius) / CZ);
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = world.getChunk(cx, cz);
        if (c) c.dirty = true;
      }
    }
  }

  function relight(x: number, y: number, z: number, radius = 8): void {
    // Alterar o mundo pode abrir ou fechar passagem: a rota memoizada precisa cair, senão os
    // mobs contornariam uma parede que não existe mais.
    invalidatePathCache();
    queueRelight(x, y, z, radius);
  }

  /**
   * Fila de blocos alterados no frame (item 924).
   *
   * Uma construção da IA ou um desmoronamento altera centenas de blocos de uma vez. Enviar uma
   * mensagem por bloco paga o cabeçalho centenas de vezes; agrupar paga uma só.
   */
  let filaBlocos: { x: number; y: number; z: number; blockType: number }[] = [];
  function enfileirarBlocos(changes: { x: number; y: number; z: number; blockType: number }[]): void {
    if (changes.length > 0) filaBlocos.push(...changes);
  }
  function despacharBlocos(): void {
    if (filaBlocos.length === 0 || peerSync.role !== 'host') { filaBlocos.length = 0; return; }
    // Um bloco só não justifica o cabeçalho do lote.
    if (filaBlocos.length === 1) {
      const b = filaBlocos[0];
      peerSync.broadcast({ type: 'block_update', x: b.x, y: b.y, z: b.z, blockType: b.blockType });
    } else {
      peerSync.broadcast({ type: 'block_batch', blocks: filaBlocos.slice(0, 65535) });
    }
    filaBlocos = [];
  }

  /**
   * Versão em lote: agrupa as alterações por célula grossa e relumina uma vez por célula.
   * Sem isto, um `fill_box` de 5.000 blocos dispararia 5.000 flood fills sobrepostos.
   */
  function relightBatch(changes: { x: number; y: number; z: number }[]): void {
    if (changes.length === 0) return;
    const CELL = 16;
    const seen = new Set<string>();
    for (const c of changes) {
      const key = `${Math.floor(c.x / CELL)},${Math.floor(c.y / CELL)},${Math.floor(c.z / CELL)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      relight(c.x, c.y, c.z, CELL);
      if (seen.size > 64) break; // teto de segurança para construções enormes
    }
  }

  /**
   * Golpe do jogador: escolhe o hostil mais próximo dentro do alcance E do cone de mira.
   * Priorizar o mais próximo evita o caso frustrante de acertar o mob de trás quando dois
   * estão alinhados na tela.
   */
  inter.onAttack = (origin, forward, tier) => {
    if (!gameModeManager.rules.hasSurvival) return false;
    if (!playerCombat.canAttack()) return false;

    let melhor: { id: string; dist: number } | null = null;
    for (const mob of entitySystem.listHostiles()) {
      const alvo = { x: mob.pos.x, y: mob.pos.y + 0.9, z: mob.pos.z };
      if (!isInMeleeReach(origin, forward, alvo)) continue;
      const d = Math.hypot(alvo.x - origin.x, alvo.y - origin.y, alvo.z - origin.z);
      if (!melhor || d < melhor.dist) melhor = { id: mob.id, dist: d };
    }
    if (!melhor) return false;

    playerCombat.markAttacked();
    entitySystem.damageEntity(melhor.id, damageForTier(tier), origin);
    audio.play(SOUNDS.acerto, { volume: 0.9 });
    return true;
  };

  inter.onToolWear = (slot, broke) => {
    if (broke) { hud.showToast('⛏️ Sua ferramenta quebrou!'); audio.play(SOUNDS.ferramentaQuebrou); }
    else if (slot.durability !== undefined && slot.durability <= 5) {
      hud.showToast(`Ferramenta quase quebrando (${slot.durability} usos)`);
    }
  };

  survivalSystem.onDamage = (amount, cause) => {
    modRuntime.dispatch('playerDamaged', { amount, cause, health: survivalSystem.health });
    // Dano contínuo (fome, queimadura) chega a cada frame: sem deduplicar, viraria um zumbido.
    audio.play(cause === 'queimadura' ? SOUNDS.queimadura : SOUNDS.dano, { dedupeKey: `dano:${cause}`, volume: 0.9 });
  };
  survivalSystem.onDeath = () => audio.play(SOUNDS.morte, { volume: 1 });

  entitySystem.onEntityDeath = (mob) => {
    modRuntime.dispatch('entityDeath', { id: mob.id, name: mob.name, x: mob.pos.x, y: mob.pos.y, z: mob.pos.z });
    audio.play(SOUNDS.mobMorte, { position: { x: mob.pos.x, y: mob.pos.y, z: mob.pos.z } });
    hud.showToast(`${mob.name} derrotado!`);
    const drop = mob.profile?.drop ?? -1;
    if (drop >= 0 && (mob.profile?.dropCount ?? 0) > 0) {
      itemDropSystem.spawn(drop, mob.profile!.dropCount, mob.pos.x, mob.pos.y + 0.5, mob.pos.z);
    }
  };

  inter.onBlockChange = (x, y, z, blockType, blocoAnterior) => {
    relight(x, y, z);
    modRuntime.dispatch(blockType === 0 ? 'blockBroken' : 'blockPlaced', { x, y, z, block: blockType });

    // Quebrar soa como o bloco que SAIU; colocar, como o que entrou.
    const semente = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
    const material = blockType === 0 ? (blocoAnterior ?? 3) : blockType;
    audio.play(
      blockType === 0 ? soundForBreak(material, semente) : soundForPlace(material, semente),
      { position: { x, y, z }, dedupeKey: `bloco:${material}` },
    );
    if (peerSync.role === 'host') peerSync.broadcast({ type: 'block_update', x, y, z, blockType });
  };

  // Fluido escoando e areia desmoronando alteram o mundo sozinhos. O host é a autoridade:
  // ele salva o resultado e replica para os convidados, para a poça não escoar de um jeito
  // na tela de cada um. Tudo continua rodando no cliente — o relay só faz sinalização.
  // Mod criado/alterado durante a partida vai imediatamente para os convidados, senão os
  // `block_update` seguintes chegariam com ids que eles ainda não conhecem.
  mcpExecutors.modService.onModChanged = (mod) => {
    if (peerSync.role === 'host') peerSync.broadcast({ type: 'mod_sync', mod });
  };

  physics.onSimulatedBlocks = (changes) => {
    relightBatch(changes);
    if (peerSync.role === 'guest') return;
    if (currentWorld.id) WorldRepository.saveBlockModBatch(currentWorld.id, changes);
    enfileirarBlocos(changes);
  };

  // --- Modos de Jogo ---
  gameModeManager.onModeChanged = (mode) => {
    inter.survivalMode = mode === 'survival';
    hud.setSurvivalVisible(mode === 'survival');
    if (mode === 'survival') survivalSystem.reset();
    hud.showToast(`Modo de jogo: ${mode}`);
    schedulePlayerSave();
  };
  inventoryModal.gateOpen = () => gameModeManager.rules.hasCreativeInventory;
  inventoryModal.onBlockedByMode = () => hud.showToast('Inventário criativo indisponível neste modo de jogo.');

  survivalSystem.onDeath = () => {
    hud.showToast('💀 Você morreu! Renascendo no spawn...');
    player.pos.copy(findSpawn());
    player.vel.set(0, 0, 0);
    survivalSystem.reset();
  };
  survivalSystem.onDamage = (amount, cause) => {
    if (amount > 1) hud.showToast(`-${amount.toFixed(0)} de vida (${cause})`);
  };

  chatOverlay.getLocationContext = () => {
    const p = player.pos;
    const px = Math.round(p.x);
    const pz = Math.round(p.z);

    let groundY = 4;
    for (let y = 120; y >= 0; y--) {
      const b = world.getBlock(px, y, pz);
      if (b !== 0 && b !== 6) {
        groundY = y + 1;
        break;
      }
    }

    const dir = new THREE.Vector3();
    cameraManager.activeCamera.getWorldDirection(dir);
    const hit = inter.raycast(new THREE.Vector3().copy(cameraManager.activeCamera.position), dir);

    let str = `Superfície do Solo ("chão para construir") = (X: ${px}, Y: ${groundY}, Z: ${pz}), Câmera = (X: ${px}, Y: ${Math.round(p.y)}, Z: ${pz})`;
    if (hit) {
      str += `, Bloco Apontado ("aqui") = (X: ${hit.x}, Y: ${hit.y}, Z: ${hit.z})`;
    } else {
      const frontX = Math.round(p.x + dir.x * 5);
      const frontZ = Math.round(p.z + dir.z * 5);
      str += `, Posição em Frente no Solo ("aqui") = (X: ${frontX}, Y: ${groundY}, Z: ${frontZ})`;
    }
    str += `. Modo de jogo atual: ${gameModeManager.mode}. Rede: ${peerSync.role === 'offline' ? 'local (sem multiplayer)' : peerSync.role === 'host' ? `anfitrião com ${peerSync.peerCount} jogador(es) conectado(s)` : 'conectado como visitante'}. Você é OP: ${localIsOp ? 'sim' : 'não'}.`;
    const nearbyEntities = entitySystem.listEntities().filter((e) => Math.hypot(e.position.x - p.x, e.position.z - p.z) <= 32);
    if (nearbyEntities.length > 0) {
      str += ` Entidades próximas (raio 32): ${nearbyEntities.map((e) => `${e.name}(id:${e.id}, tipo:${e.type})`).join(', ')}.`;
    }
    return str;
  };

  // --- Autosave do jogador (posição, vida, fome, modo, inventário) ---
  function savePlayerNow(): void {
    if (!currentWorld.id) return;
    currentWorld.timeOfDay = timeOfDay;
    WorldRepository.saveWorld(currentWorld);
    WorldRepository.savePlayer({
      worldId: currentWorld.id,
      playerId: localPlayerId,
      name: localPlayerName,
      x: player.pos.x, y: player.pos.y, z: player.pos.z,
      yaw: player.yaw, pitch: player.pitch,
      health: survivalSystem.health,
      hunger: survivalSystem.hunger,
      gameMode: gameModeManager.mode,
      inventory: inter.hotbar.map((s) => ({ label: s.label, block: s.block, count: s.count, infinite: s.infinite, toolTier: s.toolTier })),
      isOp: localIsOp,
      updatedAt: Date.now(),
    }).catch(() => {});
  }
  let saveDebounce: number | null = null;
  function schedulePlayerSave(): void {
    if (saveDebounce) clearTimeout(saveDebounce);
    saveDebounce = window.setTimeout(savePlayerNow, 600);
  }
  inter.onChanged = () => { inventoryModal.renderHotbar(); schedulePlayerSave(); };

  const loadWorldById = async (worldId: string) => {
    console.log(`🌍 [main.ts] Carregando e inicializando mundo ID: "${worldId}"`);
    // Migração antes de qualquer leitura: os passos normalizam mods e campos do mundo, e o
    // resto do carregamento assume esse formato. Rodar depois seria ler dados meio migrados.
    const migracao = await prepareWorld(worldId);
    if (migracao) {
      hud.showToast(`💾 Mundo atualizado (v${migracao.from} → v${migracao.to})`);
      if (migracao.failures.length > 0) {
        hud.showToast(`⚠️ Migração incompleta: ${migracao.failures[0]}`);
      }
    }

    const wRecord = await WorldRepository.getWorld(worldId);
    if (!wRecord) return;

    currentWorld = wRecord;
    mcpExecutors.setWorldId(worldId);
    eventSystem.setWorldId(worldId);
    entitySystem.clearAll();
    itemDropSystem.clearAll();
    avatars.clear();
    await chatOverlay.setWorldId(worldId);

    for (const key of Array.from(meshes.keys())) disposeChunkMesh(key);
    meshes.clear();

    world.chunks.clear();
    world.pending.clear();
    savedChunks.clear();

    seed = wRecord.seed || (Math.random() * 0xffffffff) >>> 0;
    worker.postMessage({ type: 'init', seed });

    // Os mods vêm ANTES dos blocos salvos: eles registram os blocos customizados nos ids que o
    // save referencia. Na ordem inversa, o mundo aplicaria ids sem definição e o mesher
    // renderizaria "bloco ausente" até o registro chegar.
    modRuntime.unloadAll();
    const modSummary = await mcpExecutors.loadModsForWorld(worldId);
    // Só os mods saudáveis rodam script: um mod em quarentena já falhou ao ser aplicado, e
    // executar o código dele seria insistir no erro.
    for (const mod of mcpExecutors.modService.getMods()) {
      if (mod.enabled && !mod.quarantined && (mod.scripts?.length ?? 0) > 0) modRuntime.loadMod(mod);
    }
    if (modSummary.mods > 0) {
      hud.showToast(`🧩 ${modSummary.mods} mod(s) carregados: ${modSummary.blocks} bloco(s), ${modSummary.entities} entidade(s)`);
    }

    const mods = await WorldRepository.getBlockModsForWorld(worldId);
    console.log(`🧱 [main.ts] Carregadas ${mods.size} modificações de blocos salvas para "${wRecord.name}"`);
    for (const [key, blockType] of mods.entries()) {
      const [x, y, z] = key.split(',').map(Number);
      world.setBlock(x, y, z, blockType);
    }

    // A hora do mundo faz parte do save: voltar sempre às 8h apagaria o progresso da noite.
    timeOfDay = typeof wRecord.timeOfDay === 'number' ? wRecord.timeOfDay : 0.35;
    gs.setTimeOfDay(timeOfDay);
    lastBakedSun = -1;

    gameModeManager.setMode(wRecord.defaultGameMode || 'classic');
    survivalSystem.reset();
    await mcpExecutors.uiExecutors.reapplyPersisted();

    const savedPlayer = await WorldRepository.getPlayer(worldId, localPlayerId);
    if (savedPlayer) {
      player.pos.set(savedPlayer.x, savedPlayer.y, savedPlayer.z);
      player.vel.set(0, 0, 0);
      player.yaw = savedPlayer.yaw;
      player.pitch = savedPlayer.pitch;
      survivalSystem.health = savedPlayer.health;
      survivalSystem.hunger = savedPlayer.hunger;
      if (savedPlayer.inventory?.length) {
        for (let i = 0; i < inter.hotbar.length && i < savedPlayer.inventory.length; i++) {
          inter.hotbar[i] = { ...savedPlayer.inventory[i] };
        }
      }
      localIsOp = peerSync.role === 'guest' ? savedPlayer.isOp : true;
      inventoryModal.renderHotbar();
    } else {
      player.pos.copy(findSpawn());
      player.vel.set(0, 0, 0);
    }

    localStorage.setItem(LAST_WORLD_KEY, worldId);

    console.log(`✅ [main.ts] Mundo "${wRecord.name}" carregado do zero com sucesso!`);
  };

  // --- Gerenciador central de UI (Pause / Inventário bloqueantes; Chat flutuante) ---
  const uiManager = new UIManager();
  uiManager.configureLock(
    gs.renderer.domElement,
    () => cameraManager.mode === 'fps' || cameraManager.mode === 'thirdperson' || cameraManager.mode === 'ghost',
  );
  cameraManager.isSolidAt = (x, y, z) => isSolid(world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));

  // Retomar o controle da câmera depois do ESC exige um gesto do usuário — o navegador recusa
  // o pedido automático. O clique no canvas é esse gesto.
  uiManager.configureRelockOnClick(gs.renderer.domElement);

  const dicaClique = document.createElement('div');
  dicaClique.textContent = 'Clique para voltar ao jogo';
  dicaClique.style.cssText = `
    position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
    background: rgba(2,6,23,0.82); color: #e2e8f0; font-family: system-ui, sans-serif;
    font-size: 15px; padding: 12px 22px; border-radius: 10px; border: 1px solid #334155;
    pointer-events: none; z-index: 40; display: none;
  `;
  document.body.appendChild(dicaClique);
  uiManager.onPointerLockPendente = (pendente) => {
    dicaClique.style.display = pendente && gameStarted ? 'block' : 'none';
  };
  uiManager.registerBlocking(inventoryModal);
  uiManager.registerBlocking(characterCreator);
  uiManager.registerBlocking(modsPage);
  uiManager.registerBlocking(codeEditor);
  uiManager.registerBlocking(gameMenu);
  uiManager.registerFloating(chatOverlay);

  const pauseMenu = new PauseMenu({
    cameraManager,
    playerController: player,
    gameModeManager,
    peerSync,
    signaling,
    onWorldChange: (worldId) => loadWorldById(worldId),
    getCurrentWorldName: () => currentWorld.name,
    listPlayers: listAllPlayers,
    setOp: setPlayerOp,
  });
  uiManager.registerBlocking(pauseMenu);
  inventoryModal.blockOpen = () => pauseMenu.isOpen;

  // --- Menu Principal & Wizard de Criação de Mundo ---
  let gameStarted = false;
  /** Enquanto a tela inicial está aberta, o jogo não simula nem desenha. */
  let noMenuInicial = true;
  async function startGame(worldId: string): Promise<void> {
    await loadWorldById(worldId);

    // O jogo começa sempre em primeira pessoa — é a visão padrão do gênero e a que dá o senso
    // de escala do mundo. F5 alterna para a terceira pessoa a qualquer momento.
    cameraManager.setMode('fps');

    if (!gameStarted) {
      gameStarted = true;
      hud.setVisible(true);
      inventoryModal.setHotbarVisible(true);
      player.attachInput(gs.renderer.domElement);
      tick();
    }
  }

  function extractRoomId(link: string): string {
    try {
      const url = new URL(link, location.href);
      return url.searchParams.get('join') || link;
    } catch {
      return link;
    }
  }
  function extractRelayFromLink(link: string): string | null {
    try {
      const url = new URL(link, location.href);
      const relay = url.searchParams.get('relay');
      return relay ? decodeURIComponent(relay) : null;
    } catch {
      return null;
    }
  }

  async function handleJoinLink(link: string): Promise<void> {
    const roomId = extractRoomId(link);
    const relayUrl = extractRelayFromLink(link);
    const guestWorld: WorldRecord = {
      id: `guest-${roomId}`,
      name: `Visitante de ${roomId}`,
      seed: Math.floor(Math.random() * 1000000),
      groundHeight: 4, fov: 75, cameraMode: 'fps',
      defaultGameMode: 'adventure', onlineEnabled: false,
      saveVersion: CURRENT_SAVE_VERSION,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    await WorldRepository.saveWorld(guestWorld);
    await startGame(guestWorld.id);

    if (relayUrl) signaling.configure(relayUrl);
    if (!signaling.isConfigured()) {
      hud.showToast('Link sem relay configurado — não é possível conectar automaticamente.');
      return;
    }
    const ok = await peerSync.joinRoom(roomId);
    hud.showToast(ok ? 'Conectando ao anfitrião...' : 'Não foi possível conectar ao relay.');
  }

  const wizard = new WorldCreationWizard((worldRecord) => startGame(worldRecord.id));

  const mainMenu = new MainMenu({
    onContinue: (worldId) => startGame(worldId),
    onOpenWorld: (worldId) => startGame(worldId),
    onOpenWizard: () => wizard.open(),
    onJoinLink: (link) => { void handleJoinLink(link); },
    onOpenGlobalSettings: () => { mainMenu.close(); uiManager.openBlocking('pause'); },
    listOnlineWorlds: () => signaling.listRooms(),
  });

  // Sair da partida pelo hub: fecha tudo, solta o ponteiro e volta à tela inicial. O mundo é
  // salvo continuamente, então não há nada a descartar aqui.
  gameMenu.onSairParaMenuInicial = () => {
    uiManager.closeBlocking('game-menu');
    if (document.pointerLockElement) document.exitPointerLock();
    savePlayerNow();
    chatOverlay.hide();
    mainMenu.open();
  };

  // A tela inicial é uma PÁGINA, não uma camada sobre o jogo: enquanto ela está aberta, o
  // canvas some e a simulação não roda. Antes, voltar ao menu deixava física, criaturas e
  // render trabalhando atrás dele.
  mainMenu.onVisibilidade = (aberto) => {
    noMenuInicial = aberto;
    gs.renderer.domElement.style.display = aberto ? 'none' : 'block';
    if (aberto) {
      hud.setVisible(false);
      inventoryModal.setHotbarVisible(false);
      if (document.pointerLockElement) document.exitPointerLock();
    } else if (gameStarted) {
      hud.setVisible(true);
      inventoryModal.setHotbarVisible(true);
    }
  };

  // Entrada direta via link de convite (?join=roomId&relay=...)
  const joinParam = new URLSearchParams(location.search).get('join');
  if (joinParam) {
    mainMenu.close();
    void handleJoinLink(location.href);
  }

  // Pointer & Keyboard Event Handling
  let breaking = false, placing = false;
  const isLocked = () => document.pointerLockElement === gs.renderer.domElement;

  gs.renderer.domElement.addEventListener('click', () => {
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

    if (!isTyping && !uiManager.isAnyBlockingOpen() && gameStarted) {
      if (cameraManager.mode === 'fps' || cameraManager.mode === 'ghost') {
        if (!isLocked()) {
          try { gs.renderer.domElement.requestPointerLock(); } catch {}
        }
      }
    }
  });

  window.addEventListener('mousedown', (e) => {
    if (!isLocked()) return;
    if (e.button === 0) breaking = true;
    if (e.button === 2) placing = true;
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) breaking = false;
    if (e.button === 2) placing = false;
  });

  window.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('wheel', (e) => {
    if (!isLocked()) return;
    inter.scrollSelect(e.deltaY > 0 ? 1 : -1);
  });

  window.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

    if (!isTyping) {
      if (e.code === 'KeyT') {
        e.preventDefault();
        if (document.pointerLockElement) document.exitPointerLock();
        uiManager.toggleFloating('chat');
        return;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        if (document.pointerLockElement) document.exitPointerLock();
        // O hub é o destino do ESC. O menu de pausa continua existindo, agora como uma das
        // entradas dele ("Mundo e rede"), em vez de ser a única porta.
        if (!uiManager.handleEscape()) uiManager.openBlocking('game-menu');
        return;
      }
      if (e.ctrlKey && (e.code === 'KeyZ' || e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) { e.preventDefault(); undoManager.redo(); }
        else { e.preventDefault(); undoManager.undo(); }
        return;
      }
      if (e.ctrlKey && (e.code === 'KeyY' || e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        undoManager.redo();
        return;
      }

      if (e.ctrlKey && e.code === 'Digit1') {
        e.preventDefault();
        if (gameModeManager.mode === 'creative') cameraManager.setMode('topdown');
        else hud.showToast('Visão Top-Down só é acessível no Modo Criativo.');
        return;
      }
      if (e.code === 'F3') {
        e.preventDefault();
        debugPanel.alternar();
        hud.showToast(debugPanel.aberto ? 'Diagnóstico ligado (F3)' : 'Diagnóstico desligado');
        return;
      }
      if (e.code === 'F5') {
        e.preventDefault();
        cameraManager.setMode(cameraManager.mode === 'thirdperson' ? 'fps' : 'thirdperson');
        hud.showToast(cameraManager.mode === 'thirdperson' ? 'Terceira pessoa' : 'Primeira pessoa');
        return;
      }
      if (e.code === 'KeyF') {
        e.preventDefault();
        const slot = inter.hotbar[inter.selected];
        if (!gameModeManager.rules.hasSurvival) {
          hud.showToast('Comer só faz sentido no Modo Sobrevivência.');
        } else if (!slot || !isEdible(slot.block)) {
          hud.showToast('Nada comestível selecionado (tente folhagem, junco ou flores).');
        } else if (survivalSystem.hunger >= survivalSystem.maxHunger) {
          hud.showToast('Você já está saciado.');
        } else if (!slot.infinite && slot.count <= 0) {
          hud.showToast('Acabou.');
        } else {
          survivalSystem.eat(foodValueOf(slot.block));
          if (!slot.infinite) slot.count--;
          inventoryModal.renderHotbar();
          hud.showToast(`Comeu ${slot.label}. Fome: ${Math.round(survivalSystem.hunger)}%`);
        }
        return;
      }
      if (e.code === 'F6') {
        e.preventDefault();
        uiManager.openBlocking('mods-page');
        return;
      }
      if (e.code === 'F7') {
        e.preventDefault();
        uiManager.openBlocking('code-editor');
        return;
      }
      if (e.code === 'F4') {
        e.preventDefault();
        uiManager.openBlocking('character-creator');
        return;
      }
      if (e.ctrlKey && e.code === 'Digit2') { e.preventDefault(); cameraManager.setMode('fps'); return; }
      if (e.ctrlKey && e.code === 'Digit4') { e.preventDefault(); cameraManager.setMode('thirdperson'); return; }
      if (e.ctrlKey && e.code === 'Digit3') { e.preventDefault(); cameraManager.setMode('ghost'); return; }

      if (!e.ctrlKey && e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 9) {
          inter.selected = num - 1;
          inter.onChanged();
          return;
        }
      }

      if (isLocked()) {
        if (e.code === 'KeyX') inter.cycleBoxH();
        if (e.code === 'KeyV') inter.cycleBoxW();
        if (e.code === 'KeyC') inter.toggleDetail();
        if (e.code === 'KeyB' && gameModeManager.rules.canBreak && gameModeManager.rules.canPlace) inter.cycleBuildMode();
      }
    }
  });

  // Main Render Loop (só inicia depois que o jogador escolhe algo no MainMenu/Wizard)
  const clock = new THREE.Clock();
  let streamAccum = 0;
  let saveAccum = 0;
  let netAccum = 0;
  /** Hash da última aparência enviada, para reenviá-la só quando muda (item 923). */
  let ultimoHashAparencia = -1;
  /** Última posição em que um passo soou, para a cadência seguir a distância andada. */
  let ultimoPassoX = 0, ultimoPassoZ = 0;

  function tick(): void {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.08);

    // Na tela inicial o quadro é devolvido imediatamente. O `requestAnimationFrame` continua
    // agendado para a volta ser instantânea, mas nada é simulado nem desenhado.
    if (noMenuInicial) return;
    profiler.beginFrame();

    streamAccum += dt;
    if (streamAccum > 0.05) {
      streamAccum = 0;
      profiler.begin('chunks'); streamChunks(); profiler.end('chunks');
    }

    const rules = gameModeManager.rules;
    if (cameraManager.mode === 'fps') {
      player.update(dt);
      inter.update(dt, gs.camera);
      if (breaking && rules.canBreak) inter.tryBreak(gs.camera);
      if (placing && rules.canPlace) inter.tryPlace(gs.camera);
    } else {
      player.update(dt);
    }

    if (rules.hasSurvival) survivalSystem.update(dt);
    itemDropSystem.update(dt);

    // O boneco só aparece em terceira pessoa; nos outros modos fica na cena, porém oculto.
    const showModel = cameraManager.mode === 'thirdperson';
    playerModel.setVisible(showModel);
    if (showModel) {
      playerModel.group.position.set(player.pos.x, player.pos.y, player.pos.z);
      const speed = Math.hypot(player.vel.x, player.vel.z);
      playerModel.update(dt, speed, player.onGround ?? true, player.yaw, player.pitch);
    }
    avatars.update(dt);

    // Ciclo dia/noite. A luz de céu está assada na cor dos vértices, então o mundo só é
    // re-meshado quando `sunScale` muda o suficiente para ser perceptível — algumas vezes por
    // dia de jogo, e não a cada frame.
    const faseAnterior = fasesDoDia(timeOfDay);
    timeOfDay = (timeOfDay + dt / DAY_LENGTH) % 1;
    gs.setTimeOfDay(timeOfDay);
    const faseAtual = fasesDoDia(timeOfDay);
    if (faseAtual !== faseAnterior) modRuntime.dispatch('dayPhase', { phase: faseAtual, timeOfDay });

    profiler.begin('mods'); modRuntime.tickAll(dt); profiler.end('mods');
    const sunScale = gs.getSunScale();
    if (Math.abs(sunScale - lastBakedSun) > 0.06) {
      lastBakedSun = sunScale;
      for (const c of world.chunks.values()) c.dirty = true;
    }

    cameraManager.update();
    profiler.begin('física'); physics.update(dt); profiler.end('física');

    // Hostis só existem onde a sobrevivência está ligada; no criativo o mundo é seguro.
    mobSpawner.enabled = rules.hasSurvival;
    const ponto = mobSpawner.update(dt, world, player.pos, {
      timeOfDay,
      sunScale,
      hostileCount: entitySystem.hostileCount,
      maxY: CY,
    });
    if (ponto) entitySystem.spawnHostile(ponto.kind, ponto.x, ponto.y, ponto.z);

    playerCombat.tick(dt);
    profiler.begin('entidades');
    const danoRecebido = entitySystem.update(dt, player.pos);
    profiler.end('entidades');
    if (danoRecebido > 0 && rules.hasSurvival && playerCombat.canBeHurt()) {
      playerCombat.markHurt();
      survivalSystem.applyDamage(danoRecebido, 'ataque inimigo');
    }
    gs.updateSun(player.pos.x, player.pos.z);

    hud.updateCoords(player.pos.x, player.pos.y, player.pos.z);
    hud.updateCameraMode(cameraManager.mode);
    hud.updateNetworkStatus(peerSync.role, peerSync.peerCount);
    if (rules.hasSurvival) hud.updateSurvival(survivalSystem.health, survivalSystem.maxHealth, survivalSystem.hunger, survivalSystem.maxHunger);

    saveAccum += dt;
    if (saveAccum > 5) { saveAccum = 0; savePlayerNow(); }

    // Estado do jogador para os outros: ~10 Hz é suficiente porque o AvatarManager interpola.
    // A escuta acompanha a câmera, não a posição do corpo: é de onde o jogador "ouve".
    audio.setListener(player.pos.x, player.pos.y, player.pos.z, player.yaw);

    // Passos: disparados por distância percorrida, não por tempo — assim a cadência acompanha
    // a velocidade real em vez de ficar dessincronizada ao correr.
    if (player.onGround) {
      const dist = Math.hypot(player.pos.x - ultimoPassoX, player.pos.z - ultimoPassoZ);
      if (dist > 1.9) {
        ultimoPassoX = player.pos.x;
        ultimoPassoZ = player.pos.z;
        const chao = world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y) - 1, Math.floor(player.pos.z));
        if (chao !== 0) audio.play(soundForFootstep(chao, Math.floor(player.pos.x) * 31 + Math.floor(player.pos.z)));
      }
    } else {
      ultimoPassoX = player.pos.x;
      ultimoPassoZ = player.pos.z;
    }

    // Uma região de luz por frame. O custo total é o mesmo, mas deixa de ser um pico no clique.
    profiler.begin('luz'); processarRelight(); profiler.end('luz');
    despacharBlocos();

    netAccum += dt;
    if (netAccum > 0.1) {
      netAccum = 0;
      if (peerSync.role !== 'offline') {
        // A aparência tem ~200 bytes e muda quase nunca — mandá-la 10x por segundo era o maior
        // desperdício do pacote. Agora só viaja quando o hash muda; nos demais, o pacote
        // binário leva apenas o hash, e o receptor reaproveita o que já tem.
        const hashAtual = hashAppearance(localAppearance);
        const mudou = hashAtual !== ultimoHashAparencia;

        const stateMsg: NetMessage = {
          type: 'player_state',
          playerId: localPlayerId,
          name: localAppearance.name || localPlayerName,
          x: player.pos.x, y: player.pos.y, z: player.pos.z,
          yaw: player.yaw, pitch: player.pitch,
          gameMode: gameModeManager.mode,
          health: survivalSystem.health,
          hunger: survivalSystem.hunger,
          // Com aparência = vai em JSON (o codec binário não a transporta). Sem = vai binário.
          ...(mudou ? { appearance: localAppearance } : {}),
        };
        if (mudou) ultimoHashAparencia = hashAtual;

        if (peerSync.role === 'host') peerSync.broadcast(stateMsg);
        else peerSync.sendToHost(stateMsg);
      }
    }

    profiler.begin('render');
    gs.renderer.render(gs.scene, cameraManager.activeCamera);
    profiler.end('render');

    profiler.endFrame();
  }

  console.log('✅ Crom Planebox (Base Crom Quadrado) pronto — aguardando seleção no Menu Principal.');
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch(err => console.error('Erro na inicialização:', err));
});
