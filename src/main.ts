import * as THREE from 'three';
import { createScene } from './render/scene';
import { World } from './world/world';
import { Chunk, chunkKey, CX, CZ } from './world/chunk';
import { WorldGen } from './world/worldgen';
import { meshChunk } from './world/mesher';
import { VoxelPhysics } from './world/physics';
import { PlayerController } from './player/controller';
import { Interaction } from './player/interaction';
import { WorldRepository } from './storage/WorldRepository';
import { MCPExecutors } from './ai/MCPExecutors';
import { OpenRouterClient } from './ai/OpenRouterClient';
import { CameraManager } from './engine/CameraManager';
import { HUD } from './ui/HUD';
import { ChatOverlay } from './ui/ChatOverlay';
import { SettingsModal } from './ui/SettingsModal';
import { InventoryModal } from './ui/InventoryModal';
import { EntitySystem } from './entities/EntitySystem';
import { EventSystem } from './events/EventSystem';

import { UndoManager } from './storage/UndoManager';

const VIEW_RADIUS = 5;      // chunks (~53 m view radius)
const UNLOAD_RADIUS = 7;
const MESH_BUDGET = 2;      // remesh count per frame
const MAX_INFLIGHT = 6;     // simultaneous generations in worker

let seed = (Math.random() * 0xffffffff) >>> 0;

async function bootstrap() {
  console.log('🎮 Inicializando Crom Planebox 3D Engine (Base Crom Quadrado)...');

  const app = document.getElementById('app') || document.body;

  const gs = createScene(app);
  const world = new World();
  const gen = new WorldGen(seed);
  const player = new PlayerController(world, gs.camera);
  const physics = new VoxelPhysics(world, gs.scene);
  const inter = new Interaction(world, physics, player, gs.scene);
  const inventoryModal = new InventoryModal(inter);

  const cameraManager = new CameraManager(gs.scene, gs.camera, gs.renderer, player);

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

  // Initial spawn safely above ground surface
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

  // Ensure world record in IndexedDB
  const worlds = await WorldRepository.getAllWorlds();
  let currentWorld = worlds.length > 0 ? worlds[0] : {
    id: 'world-default',
    name: 'Mundo Voxel Quadrado',
    seed,
    groundHeight: 4,
    fov: 75,
    cameraMode: 'topdown' as const,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  if (worlds.length === 0) {
    await WorldRepository.saveWorld(currentWorld);
  }

  // World simulation systems
  const undoManager = new UndoManager(world);
  const entitySystem = new EntitySystem(world, gs.scene);
  const eventSystem = new EventSystem(world, currentWorld.id);

  // MCP AI Integration
  const mcpExecutors = new MCPExecutors(world, player, gs.scene, gs.renderer, currentWorld.id, entitySystem, eventSystem, undoManager);
  const openRouterClient = new OpenRouterClient(mcpExecutors);

  // HUD & UI Overlays
  const hud = new HUD(cameraManager);
  undoManager.onToast = (msg) => hud.showToast(msg);
  const chatOverlay = new ChatOverlay(openRouterClient);

  chatOverlay.getLocationContext = () => {
    const p = player.pos;
    const px = Math.round(p.x);
    const pz = Math.round(p.z);

    // Encontrar a altitude real da superfície do solo no ponto (px, pz)
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
    return str;
  };

  const loadWorldById = async (worldId: string) => {
    console.log(`🌍 [main.ts] Carregando e inicializando mundo ID: "${worldId}"`);
    const wRecord = await WorldRepository.getWorld(worldId);
    if (!wRecord) return;

    currentWorld = wRecord;
    mcpExecutors.setWorldId(worldId);
    eventSystem.setWorldId(worldId);
    entitySystem.clearAll();
    await chatOverlay.setWorldId(worldId);

    // 1. Descartar todas as malhas 3D de chunks anteriores da cena
    for (const key of Array.from(meshes.keys())) {
      disposeChunkMesh(key);
    }
    meshes.clear();

    // 2. Limpar estruturas de dados dos chunks
    world.chunks.clear();
    world.pending.clear();
    savedChunks.clear();

    // 3. Reinicializar o Web Worker de terreno com a semente (seed) do novo mundo
    seed = wRecord.seed || (Math.random() * 0xffffffff) >>> 0;
    worker.postMessage({ type: 'init', seed });

    // 4. Carregar e aplicar modificações de blocos salvas especificamente para este mundo
    const mods = await WorldRepository.getBlockModsForWorld(worldId);
    console.log(`🧱 [main.ts] Carregadas ${mods.size} modificações de blocos salvas para "${wRecord.name}"`);
    for (const [key, blockType] of mods.entries()) {
      const [x, y, z] = key.split(',').map(Number);
      world.setBlock(x, y, z, blockType);
    }

    // 5. Reposicionar jogador em spawn seguro no novo mundo
    player.pos.copy(findSpawn());
    player.vel.set(0, 0, 0);

    cameraManager.setMode(wRecord.cameraMode || 'topdown');
    hud.updateCameraMode(wRecord.cameraMode || 'topdown');

    console.log(`✅ [main.ts] Mundo "${wRecord.name}" carregado do zero com sucesso!`);
  };

  const settingsModal = new SettingsModal(
    cameraManager,
    null as any,
    player,
    (newWorldId) => loadWorldById(newWorldId)
  );

  player.attachInput(gs.renderer.domElement);

  let breaking = false, placing = false;
  const isLocked = () => document.pointerLockElement === gs.renderer.domElement;

  const menu = document.getElementById('menu');
  if (menu) {
    menu.addEventListener('click', () => {
      menu.style.display = 'none';
      if (cameraManager.mode === 'fps' || cameraManager.mode === 'ghost') {
        try { gs.renderer.domElement.requestPointerLock(); } catch {}
      }
    });
  }

  // Pointer & Keyboard Event Handling
  gs.renderer.domElement.addEventListener('click', () => {
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

    if (!isTyping && !settingsModal.isOpen) {
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
        console.log('⌨️ [Atalho] Tecla T: Alternando Chatbot IA');
        e.preventDefault();
        if (document.pointerLockElement) document.exitPointerLock();
        chatOverlay.toggle();
        return;
      }
      if (e.code === 'Escape') {
        console.log('⌨️ [Atalho] Tecla ESC: Alternando Menu de Configurações');
        e.preventDefault();
        if (document.pointerLockElement) document.exitPointerLock();
        if (settingsModal.isOpen) settingsModal.close();
        else settingsModal.open();
        return;
      }
      if (e.ctrlKey && (e.code === 'KeyZ' || e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          console.log('⌨️ [Atalho] Ctrl+Shift+Z: Refazer');
          e.preventDefault();
          undoManager.redo();
        } else {
          console.log('⌨️ [Atalho] Ctrl+Z: Desfazer');
          e.preventDefault();
          undoManager.undo();
        }
        return;
      }
      if (e.ctrlKey && (e.code === 'KeyY' || e.key === 'y' || e.key === 'Y')) {
        console.log('⌨️ [Atalho] Ctrl+Y: Refazer');
        e.preventDefault();
        undoManager.redo();
        return;
      }

      if (e.ctrlKey && e.code === 'Digit1') { console.log('⌨️ [Atalho] Ctrl+1: Câmera Top-Down'); e.preventDefault(); cameraManager.setMode('topdown'); return; }
      if (e.ctrlKey && e.code === 'Digit2') { console.log('⌨️ [Atalho] Ctrl+2: Câmera FPS (Minecraft)'); e.preventDefault(); cameraManager.setMode('fps'); return; }
      if (e.ctrlKey && e.code === 'Digit3') { console.log('⌨️ [Atalho] Ctrl+3: Câmera Ghost (Fly)'); e.preventDefault(); cameraManager.setMode('ghost'); return; }

      if (!e.ctrlKey && e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 9) {
          inter.selected = num - 1;
          inter.onChanged();
          return;
        }
      }

      if (isLocked()) {
        if (e.code === 'KeyE') inter.cycleBuildMode();
        if (e.code === 'KeyX') inter.cycleBoxH();
        if (e.code === 'KeyV') inter.cycleBoxW();
        if (e.code === 'KeyC') inter.toggleDetail();
      }
    }
  });

  await loadWorldById(currentWorld.id);

  // Main Render Loop
  const clock = new THREE.Clock();
  let streamAccum = 0;

  function tick(): void {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.08);

    streamAccum += dt;
    if (streamAccum > 0.05) { streamAccum = 0; streamChunks(); }

    if (cameraManager.mode === 'fps') {
      player.update(dt);
      inter.update(dt, gs.camera);
      if (breaking) inter.tryBreak(gs.camera);
      if (placing) inter.tryPlace(gs.camera);
    } else {
      player.update(dt);
    }

    cameraManager.update();
    physics.update(dt);
    entitySystem.update(dt);
    gs.updateSun(player.pos.x, player.pos.z);
    
    hud.updateCoords(player.pos.x, player.pos.y, player.pos.z);
    hud.updateCameraMode(cameraManager.mode);

    gs.renderer.render(gs.scene, cameraManager.activeCamera);
  }

  tick();
  console.log('✅ Crom Planebox (Base Crom Quadrado) iniciado com sucesso!');
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch(err => console.error('Erro na inicialização:', err));
});
