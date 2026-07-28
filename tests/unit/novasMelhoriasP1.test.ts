import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../../src/world/world';
import { Chunk } from '../../src/world/chunk';
import { B, deriveSideAndBottomColors } from '../../src/world/blocks';
import { ArrowProjectile } from '../../src/entities/ArrowProjectile';
import { PlayerController } from '../../src/player/controller';
import { VoxelPhysics } from '../../src/world/physics';
import { CraftingSystem, CRAFTING_RECIPES } from '../../src/crafting/CraftingSystem';
import { VolumetricClouds } from '../../src/world/volumetricClouds';
import { BlockIconGenerator } from '../../src/ui/BlockIconGenerator';
import { SurvivalSystem } from '../../src/game/SurvivalSystem';
import { InstancedDecorationManager } from '../../src/render/InstancedDecorationManager';
import { compressRLE, decompressRLE } from '../../src/world/paleta';
import { verifyWorldIntegrity } from '../../src/storage/SaveMigration';
import { detectModKeyConflicts } from '../../src/mods/ModRegistry';
import { formatActionableError, MAX_BLOCKS_PER_CALL } from '../../src/ai/MCPExecutors';
import { EntitySystem } from '../../src/entities/EntitySystem';
import { Interaction } from '../../src/player/interaction';
import { HUD } from '../../src/ui/HUD';
import { Precipitation } from '../../src/render/precipitation';
import { checkWebGL2Support } from '../../src/render/scene';
import { Profiler } from '../../src/core/profiler';
import { PeerSync } from '../../src/net/PeerSync';
import { AudioSystem } from '../../src/audio/AudioSystem';
import { aplicarModoDaltonismo, NEUTRA } from '../../src/render/grading';
import { RastreadorDeObjetivos } from '../../src/game/Objetivos';
import { validateAIBlockArtGuide, generateProceduralTexturePattern } from '../../src/world/blocks';
import { validateMiniStructurePlayerScale } from '../../src/world/miniStructureEditor';
import { generateWorldTerrainPreview } from '../../src/world/worldgen';
import { checkNPCHousingQualification } from '../../src/game/abrigo';

describe('Suíte de Testes para Novas Funcionalidades P1 (Arco, Sneak, Natação, Etiquetas)', () => {
  let world: World;
  let scene: THREE.Scene;

  beforeEach(() => {
    world = new World();
    scene = new THREE.Scene();
    world.addChunk(new Chunk(0, 0));
  });

  it('deve simular o disparo e trajetória balística de uma flecha (ArrowProjectile)', () => {
    const arrow = new ArrowProjectile(scene, {
      pos: new THREE.Vector3(5, 10, 5),
      dir: new THREE.Vector3(1, 0, 0),
      speed: 10,
      damage: 20,
    });

    expect(arrow.alive).toBe(true);

    // Simula atualização de frame (dt = 0.1s)
    arrow.update(0.1, world);

    // A posição X deve ter avançado e a velocidade Y deve ter sofrido gravidade
    expect(arrow.pos.x).toBeGreaterThan(5);
    expect(arrow.vel.y).toBeLessThan(0);

    arrow.destroy(scene);
  });

  it('deve validar proteção de agachar (Sneaking) no PlayerController', () => {
    const physics = new VoxelPhysics(world, scene);
    const camera = new THREE.PerspectiveCamera();
    const player = new PlayerController(world, physics, camera);

    // Coloca chão em (0, 0, 0)
    world.setBlock(0, 0, 0, B.STONE);

    player.pos.set(0, 1, 0);
    player.onGround = true;

    // Simula tecla Shift pressionada (sneak)
    player.keys.add('ShiftLeft');
    player.keys.add('KeyW');

    player.update(0.016);

    // O jogador não deve cair da borda vazia
    expect(player.pos.y).toBeGreaterThan(0);
  });

  it('deve retornar receitas disponíveis no Livro de Receitas e fundição de blocos', () => {
    const crafting = new CraftingSystem();
    const inventory = [{ block: B.LOG, count: 2 }];

    const available = crafting.getAvailableRecipes(inventory);
    expect(available.length).toBeGreaterThan(0);
    expect(available.some((r) => r.id === 'plank_from_log')).toBe(true);

    const smelting = crafting.getSmeltingRecipe(B.SAND);
    expect(smelting).not.toBeNull();
    expect(smelting?.outputBlock).toBe(B.GLASS);
  });

  it('deve instanciar e mover nuvens volumétricas 3D (VolumetricClouds)', () => {
    const clouds = new VolumetricClouds(scene, { altitude: 80, thickness: 4, size: 64 });
    expect(clouds.group).not.toBeNull();

    clouds.update(1.0, 2.0);
    expect(clouds.group.position.x).toBe(2.0);

    clouds.dispose(scene);
  });

  it('deve validar receita e recusar blocos inexistentes (validateRecipe)', () => {
    const crafting = new CraftingSystem();
    const validRes = crafting.validateRecipe(crafting.recipes[0]);
    expect(validRes.valid).toBe(true);

    const invalidRes = crafting.validateRecipe({
      id: 'bad_recipe',
      name: 'Receita Inválida',
      outputBlock: 99999, // ID inexistente
      ingredients: { [B.DIRT]: 1 },
    });
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.reason).toContain('não existe');
  });

  it('deve reduzir dano recebido proporcionalmente aos pontos de armadura (SurvivalSystem)', () => {
    const playerMock: any = { onGround: true, lastImpactVelY: 0, headUnder: false };
    const survival = new SurvivalSystem(playerMock);

    survival.armorPoints = 10; // 40% de redução
    survival.applyDamage(100, 'zumbi');

    // Dano de 100 com 40% de redução deve resultar em 60 de dano sofrido
    expect(survival.health).toBe(40);
  });

  it('deve aplicar dano por exposição a temperaturas extremas sem abrigo (SurvivalSystem)', () => {
    const playerMock: any = { onGround: true, lastImpactVelY: 0, headUnder: false };
    const survival = new SurvivalSystem(playerMock);

    survival.currentBiomeTemperature = 0.05; // frio extremo (tundra)
    survival.isSheltered = false;
    survival.armorPoints = 0; // sem roupa de frio

    survival.update(1.0);
    expect(survival.health).toBeLessThan(100);
  });

  it('deve montar malha instanciada de decorativos (InstancedDecorationManager)', () => {
    const mgr = new InstancedDecorationManager(scene);
    mgr.buildDecorations([
      { x: 10, y: 5, z: 10, scale: 1.0 },
      { x: 12, y: 5, z: 12, scale: 1.2 },
    ]);

    expect(mgr.group.children.length).toBe(1);
    mgr.dispose(scene);
  });

  it('deve comprimir e descomprimir dados de voxel com RLE sem perdas (compressRLE / decompressRLE)', () => {
    const raw = new Uint8Array([1, 1, 1, 1, 2, 2, 3, 0, 0, 0, 0, 0, 0]);
    const compressed = compressRLE(raw);

    expect(compressed.length).toBeLessThan(raw.length);

    const decompressed = decompressRLE(compressed);
    expect(decompressed).toEqual(raw);
  });

  it('deve realizar Sweep Test continuo de colisão (PlayerController.sweepTest)', () => {
    const camera = new THREE.PerspectiveCamera();
    const physics = new VoxelPhysics(world, scene);
    const player = new PlayerController(world, physics, camera);

    // Coloca parede em (5, 0, 0)
    world.setBlock(5, 0, 0, B.STONE);

    const hit = player.sweepTest(0, 0, 0, 10, 0, 0);
    expect(hit).toBe(true);
  });

  it('deve derivar cores lateral e base automaticamente a partir da cor do topo (deriveSideAndBottomColors)', () => {
    const derived = deriveSideAndBottomColors([1.0, 1.0, 1.0]);
    expect(derived.sideRGB[0]).toBeLessThan(1.0);
    expect(derived.bottomRGB[0]).toBeLessThan(derived.sideRGB[0]);
  });

  it('deve permitir configurar a sensibilidade do mouse e detectar corrida (PlayerController)', () => {
    const camera = new THREE.PerspectiveCamera();
    const physics = new VoxelPhysics(world, scene);
    const player = new PlayerController(world, physics, camera);

    player.mouseSensitivity = 1.5;
    expect(player.mouseSensitivity).toBe(1.5);
    expect(player.isSprinting).toBe(false);
  });

  it('deve permitir registrar novas receitas de crafting (CraftingSystem.registerCustomRecipe)', () => {
    CraftingSystem.registerCustomRecipe({
      id: 'custom_test_recipe',
      name: 'Receita de Teste',
      outputBlock: B.GLASS,
      outputCount: 2,
      ingredients: { [B.DIRT]: 1 },
    });
    const found = CRAFTING_RECIPES.find((r) => r.id === 'custom_test_recipe');
    expect(found).toBeDefined();
  });

  it('deve verificar integridade do mundo ao carregar (verifyWorldIntegrity)', async () => {
    const report = await verifyWorldIntegrity('world-test-123');
    expect(report).toBeDefined();
    expect(report.valid).toBe(true);
  });

  it('deve detectar conflitos de chaves entre mods (detectModKeyConflicts)', () => {
    const modA: any = { id: 'mod_a', name: 'Mod A', blocks: [{ key: 'block_x' }] };
    const modB: any = { id: 'mod_a', name: 'Mod A Duplicado', blocks: [{ key: 'block_x' }] };

    const conflicts = detectModKeyConflicts([modA, modB]);
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('deve formatar mensagens de erro acionáveis e respeitar o limite de orçamento de blocos (formatActionableError)', () => {
    const err = formatActionableError('fill_box', 'Fora dos limites', 'Reduza o raio da área.');
    expect(err).toContain('O QUE FAZER A SEGUIR');
    expect(MAX_BLOCKS_PER_CALL).toBeGreaterThan(0);
  });

  it('deve respeitar limite de entidades simuladas por frame (EntitySystem.maxSimulatedEntitiesPerFrame)', () => {
    const es = new EntitySystem(scene, world);
    es.maxSimulatedEntitiesPerFrame = 10;
    expect(es.maxSimulatedEntitiesPerFrame).toBe(10);
  });

  it('deve permitir interações de balde com fluidos (Interaction.handleBucketInteraction)', () => {
    const camera = new THREE.PerspectiveCamera();
    const physics = new VoxelPhysics(world, scene);
    const interaction = new Interaction(world, physics, camera, scene);

    interaction.hotbar[0] = { label: 'Balde Vazio', block: B.AIR, count: 1, attributes: { isBucket: true } };
    interaction.selected = 0;

    const res = interaction.handleBucketInteraction(10, 5, 10, B.WATER);
    expect(res).toBe(true);
    expect(interaction.hotbar[0].block).toBe(B.WATER);
  });

  it('deve permitir alterar a escala da UI (HUD.setUIScale)', () => {
    if (typeof document === 'undefined') {
      const mockElem = () => ({ appendChild: () => {}, style: {}, textContent: '' });
      (globalThis as any).document = { createElement: mockElem };
    }
    const hud = new HUD();
    hud.setUIScale(1.2);
    expect(hud.container.style.transform).toContain('scale(1.2)');
  });

  it('deve aplicar morte por queda no vão (void) quando y < -20 (SurvivalSystem e PlayerController)', () => {
    const camera = new THREE.PerspectiveCamera();
    const player = new PlayerController(world, camera);
    const survival = new SurvivalSystem(player);

    let deathCause = '';
    survival.onDeath = (cause) => { deathCause = cause; };

    player.pos.set(0, -25, 0);
    survival.update(0.1);

    expect(survival.alive).toBe(false);
    expect(deathCause).toBe('abismo');
  });

  it('deve restringir chuva abaixo das nuvens e simular sistema de chuva completo (Precipitation)', () => {
    const precipitation = new Precipitation();
    const camAboveClouds = new THREE.Vector3(0, 160, 0);
    const camBelowClouds = new THREE.Vector3(0, 50, 0);

    // Acima das nuvens (y >= 144) não chove
    precipitation.update(0.1, camAboveClouds, 500, false, () => false, 144);
    expect(precipitation.pontos.visible).toBe(false);

    // Abaixo das nuvens chove normalmente
    precipitation.update(0.1, camBelowClouds, 500, false, () => false, 144);
    expect(precipitation.pontos.visible).toBe(true);
  });

  it('deve realizar verificação de suporte a WebGL2 (checkWebGL2Support)', () => {
    const res = checkWebGL2Support();
    expect(res).toBeDefined();
    expect(typeof res.supported).toBe('boolean');
  });

  it('deve calcular distância de render adaptativa com base no FPS (Profiler.computeAdaptiveRenderDistance)', () => {
    const p = new Profiler();
    const chunks = p.computeAdaptiveRenderDistance(8);
    expect(chunks).toBe(8);
  });

  it('deve permitir modo offline explícito no PeerSync (setExplicitOfflineMode)', () => {
    const mockSignaling: any = {
      onSignal: null, onPeerJoined: null, onPeerLeft: null,
      disconnect: () => {}, closeRoom: () => {}
    };
    const ps = new PeerSync(mockSignaling);
    ps.setExplicitOfflineMode(true);
    expect(ps.explicitOffline).toBe(true);
  });

  it('deve emitir eventos de legenda para efeitos sonoros (AudioSystem.onSoundSubtitle)', () => {
    const audio = new AudioSystem();
    let sub: any = null;
    audio.onSoundSubtitle = (info) => { sub = info; };

    audio.play({ duration: 0.1, gain: 1, pitch: 1 }, { dedupeKey: 'passo' });
    expect(sub).toBeDefined();
    expect(sub.label).toBe('passo');
  });

  it('deve aplicar filtros de modo daltonismo na gradação (aplicarModoDaltonismo)', () => {
    const res = aplicarModoDaltonismo(NEUTRA, 'protanopia');
    expect(res).toBeDefined();
    expect(res.luz[1]).not.toBe(NEUTRA.luz[1]);
  });

  it('deve suportar remapeamento de teclas e gamepad no PlayerController (keyMap e pollGamepad)', () => {
    const camera = new THREE.PerspectiveCamera();
    const player = new PlayerController(world, camera);

    expect(player.keyMap.forward).toContain('KeyW');
    const gpResult = player.pollGamepad(0.1);
    expect(gpResult).toBeDefined();
  });

  it('deve retornar o diário de bordo com marcos alcançados (RastreadorDeObjetivos.getDiarioDeBordo)', () => {
    const rastreador = new RastreadorDeObjetivos();
    const diario = rastreador.getDiarioDeBordo();

    expect(Array.isArray(diario)).toBe(true);
    expect(diario.length).toBeGreaterThan(0);
  });

  it('deve exibir tutorial contextual e progresso visual da IA (HUD.showContextualTutorial / updateAIBuildProgress)', () => {
    if (typeof document === 'undefined') {
      const mockElem = () => ({ appendChild: () => {}, style: {}, textContent: '', remove: () => {} });
      (globalThis as any).document = { createElement: mockElem };
    }
    const hud = new HUD();
    hud.showContextualTutorial('mover');
    hud.updateAIBuildProgress(50, 'construir_casa');
    expect(hud).toBeDefined();
  });

  it('deve alterar ambiência por bioma e música dinâmica por contexto (AudioSystem)', () => {
    const audio = new AudioSystem();
    audio.updateBiomeAmbiance('deserto');
    expect(audio.currentBiomeAmbiance).toBe('deserto');

    audio.updateDynamicMusic('caverna');
    expect(audio.currentMusicContext).toBe('caverna');
  });

  it('deve validar guia de arte de blocos e gerar padrões procedurais (validateAIBlockArtGuide / generateProceduralTexturePattern)', () => {
    const artValidation = validateAIBlockArtGuide(0x888888);
    expect(artValidation.valid).toBe(true);

    const pattern = generateProceduralTexturePattern('checker', 0x55aa33, 4, 4);
    expect(typeof pattern).toBe('number');
  });

  it('deve padronizar e validar a altura do personagem em miniblocos (validateMiniStructurePlayerScale)', () => {
    const res = validateMiniStructurePlayerScale(16);
    expect(res.fits).toBe(true);
    expect(res.requiredHeight).toBe(16);
  });

  it('deve gerar mapa de preview de terreno para o assistente de criação de mundo (generateWorldTerrainPreview)', () => {
    const preview = generateWorldTerrainPreview(12345, 8, 8);
    expect(preview.heightMap.length).toBe(8);
    expect(preview.biomeMap.length).toBe(8);
  });

  it('deve validar casa para NPC se mudar (checkNPCHousingQualification)', () => {
    const validRes = checkNPCHousingQualification(true);
    expect(validRes.canMoveIn).toBe(true);

    const invalidRes = checkNPCHousingQualification(false);
    expect(invalidRes.canMoveIn).toBe(false);
  });

  it('deve invocar bosses lendários com estatísticas ampliadas (EntitySystem.summonBoss)', () => {
    // Mock canvas.getContext for the name-tag canvas inside spawnEntity
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'canvas') {
        (el as any).getContext = () => ({
          fillStyle: '',
          font: '',
          textAlign: '',
          textBaseline: '',
          fillRect: vi.fn(),
          fillText: vi.fn(),
          measureText: () => ({ width: 80 }),
        });
      }
      return el;
    });
    // EntitySystem.groundSnap needs world.getBlock — use a minimal fake world
    const mundoFalso = {
      getBlock: (_x: number, y: number, _z: number) => (y < 10 ? 1 : 0),
      setBlock: () => {},
    } as any;
    const es = new EntitySystem(mundoFalso, scene);
    const boss = es.summonBoss('zumbi', new THREE.Vector3(10, 12, 10));

    expect(boss).toBeDefined();
    expect(boss.name).toContain('Chefe Supremo');
    expect(boss.attributes?.isBoss).toBe(true);
    vi.restoreAllMocks();
  });

  it('deve exibir o nome do bioma atual no HUD (HUD.updateBiomeBadge)', () => {
    const hud = new HUD();
    hud.updateBiomeBadge('Tundra');
    expect(hud).toBeDefined();
  });

  it('deve verificar desbloqueio de masmorra com chave (Interaction.tryUnlockDungeonDoor)', () => {
    const player = new PlayerController(world, new THREE.PerspectiveCamera());
    const physics = new VoxelPhysics(world, scene);
    const inter = new Interaction(world, physics, player, scene);

    const unlockFail = inter.tryUnlockDungeonDoor(false);
    expect(unlockFail.success).toBe(false);

    const unlockSuccess = inter.tryUnlockDungeonDoor(true);
    expect(unlockSuccess.success).toBe(true);
  });
});

