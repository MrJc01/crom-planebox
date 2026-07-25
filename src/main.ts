import * as THREE from 'three';
import { createScene } from './render/scene';
import { World } from './world/world';
import { Chunk, chunkKey, CX, CZ } from './world/chunk';
import { WorldGen } from './world/worldgen';
import { meshChunk } from './world/mesher';
import { VoxelPhysics } from './world/physics';
import { isSolid } from './world/blocks';
import { PlayerController } from './player/controller';
import { Interaction } from './player/interaction';
import { WorldRepository } from './storage/WorldRepository';
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

  const cameraManager = new CameraManager(gs.scene, gs.camera, gs.renderer, player);
  const gameModeManager = new GameModeManager(cameraManager, player);
  const survivalSystem = new SurvivalSystem(player);
  const itemDropSystem = new ItemDropSystem(gs.scene, player);

  itemDropSystem.onCollect = (blockType, count) => inter.grant(blockType, count);
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
      remeshChunk(c);
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

  function remeshChunk(c: Chunk): void {
    const key = chunkKey(c.cx, c.cz);
    disposeChunkMesh(key);
    const padded = world.padChunk(c.cx, c.cz);
    const geo = meshChunk(padded, c.cx, c.cz);
    const entry: ChunkMeshes = { solid: null, water: null, glass: null };
    if (geo.solid) {
      const mesh = new THREE.Mesh(geo.solid, gs.solidMaterial);
      mesh.position.set(c.cx * CX, 0, c.cz * CZ);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      gs.scene.add(mesh);
      entry.solid = mesh;
    }
    if (geo.water) {
      const mesh = new THREE.Mesh(geo.water, gs.waterMaterial);
      mesh.position.set(c.cx * CX, 0, c.cz * CZ);
      mesh.receiveShadow = true;
      gs.scene.add(mesh);
      entry.water = mesh;
    }
    if (geo.glass) {
      const mesh = new THREE.Mesh(geo.glass, gs.glassMaterial);
      mesh.position.set(c.cx * CX, 0, c.cz * CZ);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      gs.scene.add(mesh);
      entry.glass = mesh;
    }
    meshes.set(key, entry);
    c.dirty = false;
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

  // HUD & UI Overlays (ficam ocultos até o jogo realmente começar, para o MainMenu não competir com eles)
  const hud = new HUD(cameraManager);
  hud.canUseTopdown = () => gameModeManager.mode === 'creative';
  undoManager.onToast = (msg) => hud.showToast(msg);
  const chatOverlay = new ChatOverlay(openRouterClient);
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
    if (peerSync.role !== 'host') return;
    for (const m of mods) peerSync.broadcast({ type: 'block_update', x: m.x, y: m.y, z: m.z, blockType: m.blockType });
  };
  inter.onBlockChange = (x, y, z, blockType) => {
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
    if (peerSync.role === 'guest') return;
    if (currentWorld.id) WorldRepository.saveBlockModBatch(currentWorld.id, changes);
    for (const c of changes) {
      peerSync.broadcast({ type: 'block_update', x: c.x, y: c.y, z: c.z, blockType: c.blockType });
    }
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
    const modSummary = await mcpExecutors.loadModsForWorld(worldId);
    if (modSummary.mods > 0) {
      hud.showToast(`🧩 ${modSummary.mods} mod(s) carregados: ${modSummary.blocks} bloco(s), ${modSummary.entities} entidade(s)`);
    }

    const mods = await WorldRepository.getBlockModsForWorld(worldId);
    console.log(`🧱 [main.ts] Carregadas ${mods.size} modificações de blocos salvas para "${wRecord.name}"`);
    for (const [key, blockType] of mods.entries()) {
      const [x, y, z] = key.split(',').map(Number);
      world.setBlock(x, y, z, blockType);
    }

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
  uiManager.registerBlocking(inventoryModal);
  uiManager.registerBlocking(characterCreator);
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
        if (!uiManager.handleEscape()) uiManager.openBlocking('pause');
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
      if (e.code === 'F5') {
        e.preventDefault();
        cameraManager.setMode(cameraManager.mode === 'thirdperson' ? 'fps' : 'thirdperson');
        hud.showToast(cameraManager.mode === 'thirdperson' ? 'Terceira pessoa' : 'Primeira pessoa');
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

  function tick(): void {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.08);

    streamAccum += dt;
    if (streamAccum > 0.05) { streamAccum = 0; streamChunks(); }

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

    cameraManager.update();
    physics.update(dt);
    entitySystem.update(dt);
    gs.updateSun(player.pos.x, player.pos.z);

    hud.updateCoords(player.pos.x, player.pos.y, player.pos.z);
    hud.updateCameraMode(cameraManager.mode);
    hud.updateNetworkStatus(peerSync.role, peerSync.peerCount);
    if (rules.hasSurvival) hud.updateSurvival(survivalSystem.health, survivalSystem.maxHealth, survivalSystem.hunger, survivalSystem.maxHunger);

    saveAccum += dt;
    if (saveAccum > 5) { saveAccum = 0; savePlayerNow(); }

    // Estado do jogador para os outros: ~10 Hz é suficiente porque o AvatarManager interpola.
    netAccum += dt;
    if (netAccum > 0.1) {
      netAccum = 0;
      if (peerSync.role !== 'offline') {
        const stateMsg: NetMessage = {
          type: 'player_state',
          playerId: localPlayerId,
          name: localAppearance.name || localPlayerName,
          x: player.pos.x, y: player.pos.y, z: player.pos.z,
          yaw: player.yaw, pitch: player.pitch,
          gameMode: gameModeManager.mode,
          health: survivalSystem.health,
          hunger: survivalSystem.hunger,
          appearance: localAppearance,
        };
        if (peerSync.role === 'host') peerSync.broadcast(stateMsg);
        else peerSync.sendToHost(stateMsg);
      }
    }

    gs.renderer.render(gs.scene, cameraManager.activeCamera);
  }

  console.log('✅ Crom Planebox (Base Crom Quadrado) pronto — aguardando seleção no Menu Principal.');
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch(err => console.error('Erro na inicialização:', err));
});
