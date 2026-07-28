import { CAMADA } from './ui/theme';
import { OrcamentoDeQuadro } from './render/orcamentoQuadro';
import * as THREE from 'three';
import { createScene } from './render/scene';
import { World } from './world/world';
import { Chunk, chunkKey, CX, CY, CZ, SCALE, TOPO_VARREDURA } from './world/chunk';
import { WorldGen, WATER_LEVEL } from './world/worldgen';
import { PesoBioma, biomaDominante, descreverBioma, misturarCor, misturarEscalar, pesosDeBioma } from './world/biomes';
import { CLIMAS, ClimaAtual, climaEm, descreverClima } from './world/weather';
import { horaAparente } from './world/duracaoDoDia';
import { Invernada } from './world/invernada';
import { Vegetacao } from './world/vegetacao';
import { EstadoSazonal, corDaFolhagem, corDaGrama, definirPerfil, descreverEstacao, estadoSazonal, limparPerfis } from './world/seasons';
import { Precipitation, Relampago } from './render/precipitation';
import { FadeAgenda } from './render/chunkFade';
import { resolverEnv } from './mods/ModEnv';
import { PredefinicaoId, gradacaoEm } from './render/grading';
import { ChunkGeometryRaw } from './world/mesher';
import { geometryFromRaw } from './world/meshGeometry';
import { VoxelPhysics } from './world/physics';
import { B, isSolid } from './world/blocks';
import { AudioSystem } from './audio/AudioSystem';
import { SOUNDS, soundForBreak, soundForFootstep, soundForPlace } from './audio/synth';
import { LightEngine } from './world/lighting';
import { diferencaCircular, faseDoDia, iluminacaoDaFase, nomeDaFase, noiteEscura } from './world/moon';
import { invalidatePathCache } from './entities/Pathfinding';
import { ModRuntime } from './mods/ModRuntime';
import { ModHostBridge } from './mods/ModAPI';
import { MobSpawner } from './entities/MobSpawner';
import { CombatTimers, damageForTier, isInMeleeReach } from './entities/Combat';
import { foodValueOf, isEdible } from './game/SurvivalSystem';
import { PlayerController } from './player/controller';
import { Interaction } from './player/interaction';
import { WorldRepository } from './storage/WorldRepository';
import { biomasDeModRegistrados, definicaoDeBioma, limparBiomasDeMod, registrarBiomaDeMod } from './world/biomes';
import { limparRegrasDeMod, regrasDeModRegistradas } from './world/scatter';
import { CAMADAS, ambienteDaProfundidade, camadaNaProfundidade } from './world/camadas';
import { avancarAmbiente, criarEstadoDoAmbiente } from './audio/ambienteDeCamada';
import { neblinaDeAltitude } from './render/neblina';
import { RelogioDeDespawn } from './entities/despawn';
import { limparTemplatesDeMod, templatesDeModRegistrados } from './crafting/StructureTemplates';
import { RedeDeMods } from './mods/RedeDeMods';
import { pedirCapacidade } from './ui/PedidoDeCapacidade';
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
import { DebugPanel } from './ui/DebugPanel';
import { profiler } from './core/profiler';
import { getPathCacheStats } from './entities/Pathfinding';
import { CodeEditorPage } from './ui/CodeEditorPage';
import { handleVisibilityChange } from './core/PauseManager';
import { PlayerModel } from './player/PlayerModel';
import { AvatarManager } from './player/AvatarManager';
import { Appearance, DEFAULT_APPEARANCE } from './player/Appearance';
import { InventoryModal } from './ui/InventoryModal';
import { EntitySystem } from './entities/EntitySystem';
import { EventSystem } from './events/EventSystem';
import { UndoManager } from './storage/UndoManager';
import { GameModeManager } from './game/GameModeManager';
import { EventoDeProgresso, RastreadorDeObjetivos } from './game/Objetivos';
import { chaveDeCelula, mapearAbrigo } from './game/abrigo';
import { aplicarPenalidade, penalidadeDoMundo } from './game/penalidadeDeMorte';
import { RITMO_DORMINDO, deveAcordar, porQueNaoPodeDormir } from './game/dormir';
import { RegistroDeSono, estadoDoSonoColetivo } from './game/sonoColetivo';
import { PainelDeJogadores } from './ui/PainelDeJogadores';
import { montarListaDeJogadores } from './net/listaDeJogadores';
import { deveRoubar } from './ui/atalhosDoNavegador';
import { SurvivalSystem } from './game/SurvivalSystem';
import { ItemDropSystem } from './game/ItemDropSystem';
import { SignalingClient } from './net/SignalingClient';
import { idDeSala, relayDeLink } from './net/convite';
import { PeerSync } from './net/PeerSync';
import { VozP2P } from './net/VozP2P';
import { MixerDeVoz } from './net/MixerDeVoz';
import { SilenciadosDeVoz, misturaDaVoz } from './net/vozEspacial';
import { interpretarComandoDeSilencio } from './net/comandoDeSilencio';
import { textoDaMorte } from './game/causaDaMorte';
import { BauModal } from './ui/BauModal';
import { PilhaDeBau, bauVazio, chaveDoBau, depositar, esvaziar, retirar, sanearBau } from './game/bau';
import { CommandSystem, CommandContext, KnownPlayer } from './commands/CommandSystem';
import { NetMessage } from './net/protocol';
import { hashAppearance } from './net/codec';
import { ModConsentRecord, WorldRecord, CURRENT_SAVE_VERSION } from './storage/Database';

const MAX_INFLIGHT = 6;     // simultaneous generations in worker
const LAST_WORLD_KEY = 'crom:lastWorldId';

let seed = (Math.random() * 0xffffffff) >>> 0;

async function bootstrap() {
  console.log('Inicializando Crom Planebox 3D Engine (Base Crom Quadrado)...');

  const app = document.getElementById('app') || document.body;
  const menuEl = document.getElementById('menu');
  if (menuEl) menuEl.style.display = 'none'; // substituído pelo MainMenu real

  const gs = createScene(app);
  const world = new World();
  const gen = new WorldGen(seed);
  /** Mistura de biomas sob o jogador. Reamostrada a cada poucos quadros; ver o laço principal. */
  let pesosBioma: PesoBioma[] = [{ id: 'planicie', peso: 1 }];
  let quadrosAteBioma = 0;
  /**
   * Clima vigente. Derivado de (semente, dia) e do bioma dominante — não é sorteado nem gravado.
   * Ver `src/world/weather.ts` para por que isso importa no P2P e no save.
   */
  let clima: ClimaAtual = climaEm(seed, 0, 'planicie');
  /** Estação vigente sob o jogador, já atenuada pelos pesos de bioma. */
  let estacao: EstadoSazonal = estadoSazonal(0, [{ id: 'planicie', peso: 1 }]);
  const precipitacao = new Precipitation();
  gs.scene.add(precipitacao.pontos);
  const relampago = new Relampago();
  /** Saturação vinda da mistura de biomas; reamostrada junto com o bioma. */
  let saturacaoBioma = 1;
  /** Estilo de gradação de cor. Ajustável nas opções (item 1082). */
  let predefinicaoGradacao: PredefinicaoId = 'natural';
  /** Clima imposto por um mod ou pelo anfitrião. `undefined` = segue a sequência do mundo. */
  let climaForcado: import('./world/weather').ClimaId | undefined;
  /**
   * Hora que o convidado está perseguindo, vinda do anfitrião. `null` = relógio livre.
   * Ver `WorldTimeMsg`: alcançar correndo, em vez de saltar, evita o sol pular no céu.
   */
  let relogioAlvo: number | null = null;
  /** Segundos até o anfitrião reenviar o relógio. */
  let proximoEnvioDeHora = 0;
  const player = new PlayerController(world, gs.camera);
  const physics = new VoxelPhysics(world, gs.scene);
  const inter = new Interaction(world, physics, player, gs.scene);
  const inventoryModal = new InventoryModal(inter);

  // Motor de luz: o `World` implementa `LightGrid`, então a propagação atravessa a fronteira
  // de chunks naturalmente (uma caverna iluminada por uma abertura no chunk vizinho funciona).
  const lightEngine = new LightEngine(world, CY);

  /** Hora do mundo em fração de dia (0 = meia-noite, 0.5 = meio-dia). */
  let timeOfDay = 0.35;
  /** Dias completos desde a criação do mundo. É o que faz a lua mudar de fase. */
  let worldDay = 0;
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
  const objetivos = new RastreadorDeObjetivos();
  const survivalSystem = new SurvivalSystem(player);
  player.onVoidFall = () => survivalSystem.applyDamage(1000, 'abismo');
  const itemDropSystem = new ItemDropSystem(gs.scene, player);

  itemDropSystem.onCollect = (blockType, count) => {
    inter.grant(blockType, count);
    audio.play(SOUNDS.pegarItem, { channel: 'ui', dedupeKey: 'pegarItem' });
  };
  inter.onItemDrop = (blockType, count, x, y, z) => itemDropSystem.spawn(blockType, count, x, y, z);

  // Lista de jogadores — item 1497. Segurar [Tab] mostra quem está na sessão, a que distância, quem
  // está dormindo e quem foi silenciado. Sem ela, `/mudo` e o sono coletivo existem e são
  // invisíveis: quem não sabe que o comando existe não tem porta nenhuma.
  const painelDeJogadores = new PainelDeJogadores();

  // Baús — item 137. O conteúdo mora no banco por posição; isto é só o que está aberto agora.
  const bauModal = new BauModal();
  let bauAberto: { key: string; slots: (PilhaDeBau | null)[] } | null = null;

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
    return new THREE.Vector3(0.5, TOPO_VARREDURA, 0.5);
  }

  /**
   * Onde o jogador renasce: a cama que ele usou, ou o spawn procedural do mundo.
   *
   * Guardado como ponto, e não como "as coordenadas da cama": se a cama for quebrada depois, o
   * jogador ainda renasce ali. O alternativo — validar que o bloco continua sendo uma cama —
   * mandaria de volta ao outro lado do mundo quem tivesse a casa desmanchada por um amigo, num
   * momento em que ele já está morto e sem nada para reagir.
   */
  let pontoDeRenascimento: THREE.Vector3 | null = null;

  /**
   * Onde colocar o jogador ao renascer.
   *
   * O ponto é conferido **na hora de usar**, e não na hora de gravar: entre uma coisa e outra o
   * mundo muda. Quem tapar o próprio quarto com pedra — ou tiver a casa preenchida por um amigo,
   * por um fluido escoando ou por um script de mod — renasceria dentro de rocha maciça, preso, num
   * momento em que acabou de morrer e ainda está entendendo o que houve. O spawn do mundo é uma
   * volta longa, mas é uma volta; ficar entalado não é.
   */
  const ondeRenascer = (): THREE.Vector3 => {
    if (!pontoDeRenascimento) return findSpawn();
    const p = pontoDeRenascimento;
    const livre = (dy: number) => {
      const t = world.getBlock(Math.floor(p.x), Math.floor(p.y + dy), Math.floor(p.z));
      return t === B.AIR || !isSolid(t);
    };
    // O corpo inteiro, e não só os pés: com o pé livre e a cabeça na pedra, o jogador nasce com a
    // câmera dentro do bloco e vê o mundo de dentro para fora.
    if (livre(0) && livre(SCALE)) return p.clone();
    hud.showToast('Seu ponto de renascimento ficou soterrado — voltando ao spawn do mundo.');
    pontoDeRenascimento = null;
    return findSpawn();
  };

  player.pos.copy(findSpawn());

  // Mesh map per chunk
  interface ChunkMeshes { solid: THREE.Mesh | null; water: THREE.Mesh | null; glass: THREE.Mesh | null }
  const meshes = new Map<string, ChunkMeshes>();

  // Worker for chunk terrain generation
  let worker = new Worker(new URL('./world/genWorker.ts', import.meta.url), { type: 'module' });
  let inflight = 0;
  let savedChunks = new Map<string, Uint8Array>();

  /**
   * Normaliza um bioma vindo de mod para o formato interno.
   *
   * O id ganha o prefixo do mod (`meumod:cristal`) por um motivo de convivência: dois mods podem
   * querer um bioma chamado `cristal`, e sem prefixo o segundo seria recusado por colisão com o
   * primeiro — punindo quem instalou os dois por uma escolha de nome que nenhum dos autores fez em
   * conjunto.
   *
   * Os campos ausentes caem em valores da planície, e não em zeros: um bioma com névoa preta e
   * saturação zero seria aceito e apareceria como um buraco visual no mundo, sem erro nenhum.
   */
  function normalizarBiomaDeMod(modId: string, def: any): any {
    const base = definicaoDeBioma('planicie');
    const cor = (v: any, padrao: [number, number, number]): [number, number, number] =>
      Array.isArray(v) && v.length === 3 && v.every((n: any) => typeof n === 'number')
        ? [v[0], v[1], v[2]] : padrao;
    return {
      id: `${modId}:${String(def?.id ?? 'bioma')}`,
      nome: String(def?.nome ?? def?.id ?? 'Bioma de mod'),
      temp: Number(def?.temp ?? 0),
      moist: Number(def?.moist ?? 0),
      grama: cor(def?.grama, base.grama),
      folhagem: cor(def?.folhagem, base.folhagem),
      neblina: cor(def?.neblina, base.neblina),
      alcanceNeblina: Number(def?.alcanceNeblina ?? base.alcanceNeblina),
      saturacao: Number(def?.saturacao ?? base.saturacao),
      sazonal: def?.sazonal ?? true,
      minerios: def?.minerios,
    };
  }

  /**
   * Refaz a geração com a lista de biomas atual.
   *
   * Os chunks já gerados **não** são refeitos: reconstruir o mundo inteiro na hora em que um mod
   * carrega travaria o jogo por segundos, e o terreno já visitado mudaria debaixo do jogador. O
   * bioma novo aparece no que ainda não foi gerado, que é a única forma de isto não ser destrutivo.
   */
  function reiniciarGeracao(): void {
    worker.postMessage({
      type: 'init', seed,
      biomasDeMod: biomasDeModRegistrados(),
      regrasDeMod: regrasDeModRegistradas(),
      templatesDeMod: templatesDeModRegistrados(),
    });
  }

  function initWorker(): void {
    worker.postMessage({
      type: 'init', seed,
      biomasDeMod: biomasDeModRegistrados(),
      regrasDeMod: regrasDeModRegistradas(),
      templatesDeMod: templatesDeModRegistrados(),
    });
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
    // Materiais da animação em curso vão junto: a malha que os usava está sendo destruída, e
    // deixá-los vivos vazaria um material por chunk que for re-meshado durante a aparição.
    const mats = materiaisFade.get(key);
    if (mats) {
      materiaisFade.delete(key);
      for (const mat of mats) mat.dispose();
    }
    for (const mesh of [m.solid, m.water, m.glass]) {
      if (!mesh) continue;
      gs.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    meshes.delete(key);
  }

  /** `dt` é o tempo do último quadro, em segundos — entra só no orçamento de malhas. */
  const orcamentoQuadro = new OrcamentoDeQuadro();

  function streamChunks(dt = 0.016): void {
    const pcx = Math.floor(player.pos.x / CX);
    const pcz = Math.floor(player.pos.z / CZ);

    const viewRadius = cameraManager.renderDistance;
    const unloadRadius = viewRadius + 3;
    // Orçamento de malhas por quadro — item 402.
    //
    // A base vem do alcance de visão: quanto mais longe se enxerga, mais chunks precisam ficar
    // prontos para o mundo não aparecer aos pedaços. Mas base fixa é só metade do problema, e a
    // metade fácil.
    //
    // O que faltava é reagir ao custo REAL. Numa máquina lenta, ou num momento caro (tempestade
    // com partículas, muitas criaturas), gerar o mesmo número de malhas transforma um quadro
    // pesado numa engasgada visível. `orcamentoDeMalhas` encolhe quando o quadro passa do alvo e
    // volta a crescer quando sobra tempo — o mundo carrega um pouco mais devagar em vez de
    // travar, que é a troca certa: atraso se percebe menos que solavanco.
    const meshBudget = orcamentoQuadro.paraEste(Math.max(2, Math.floor(viewRadius / 2)), dt);

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
        // Fora do alcance: esquece também o registro de "já apareceu", para o chunk aparecer de
        // novo quando o jogador voltar — é a mesma experiência da primeira vez.
        fadeAgenda.esquecer(key);
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

    // Chunk novo aparece gradualmente; re-mesh por alteração do jogador, não — senão o chunk
    // pisca a cada bloco colocado. Quem decide é a agenda, que já viu esta chave antes.
    const aparecendo = fadeAgenda.registrar(key);
    if (aparecendo) materiaisFade.set(key, []);

    const entry: ChunkMeshes = { solid: null, water: null, glass: null };
    const partes: [keyof ChunkMeshes, typeof geo.solid, THREE.Material, boolean][] = [
      ['solid', geo.solid, gs.solidMaterial, true],
      ['water', geo.water, gs.waterMaterial, false],
      ['glass', geo.glass, gs.glassMaterial, true],
    ];

    for (const [nome, bruto, compartilhado, projetaSombra] of partes) {
      if (!bruto) continue;
      let material = compartilhado;
      if (aparecendo) {
        material = gs.criarMaterialFade(nome);
        gs.setMaterialFade(material, 0);
        materiaisFade.get(key)!.push(material);
      }
      const mesh = new THREE.Mesh(geometryFromRaw(bruto), material);
      mesh.position.set(cx * CX, 0, cz * CZ);
      mesh.castShadow = projetaSombra;
      mesh.receiveShadow = true;
      gs.scene.add(mesh);
      entry[nome] = mesh;
    }

    meshes.set(key, entry);
  }


  /**
   * Aparição gradual dos chunks. A agenda é pura (`src/render/chunkFade.ts`); aqui fica só a
   * troca de material: enquanto aparece, o chunk usa um material próprio com o progresso; ao
   * terminar, volta ao compartilhado e o próprio é descartado.
   */
  const fadeAgenda = new FadeAgenda();
  const materiaisFade = new Map<string, THREE.Material[]>();

  /** Devolve o chunk ao material compartilhado e libera o material da animação. */
  function encerrarFade(key: string): void {
    const mats = materiaisFade.get(key);
    if (!mats) return;
    materiaisFade.delete(key);
    const entry = meshes.get(key);
    if (entry) {
      if (entry.solid) entry.solid.material = gs.solidMaterial;
      if (entry.water) entry.water.material = gs.waterMaterial;
      if (entry.glass) entry.glass.material = gs.glassMaterial;
    }
    for (const m of mats) m.dispose();
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
  /** Relógio do som de ambiente da camada — item 1438. */
  const estadoDoAmbiente = criarEstadoDoAmbiente();
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
    moonPhase: () => faseDoDia(worldDay),
    weather: () => ({
      current: clima.clima,
      next: clima.proximo,
      progress: clima.progresso,
      lightning: clima.raios,
      wet: clima.molha,
    }),
    modEnv: (modId) => {
      const mod = mcpExecutors.modService.getMod(modId);
      if (!mod?.env) return { valores: {}, faltando: [] };
      return resolverEnv(
        mod.env,
        mcpExecutors.modService.vault.valoresDe(modId),
        mcpExecutors.modService.vault.globaisComDerivadas(),
      );
    },
    season: () => ({
      current: estacao.estacao,
      next: estacao.proxima,
      transition: estacao.travessia,
      strength: estacao.forca,
      effect: { ...estacao.efeito },
    }),
    defineSeasonProfile: (bioma, perfis) => {
      // Validação antes de aceitar: um perfil com campo inventado ou valor não numérico viraria
      // NaN propagado por todo o sistema de cor e clima, e o sintoma apareceria longe da causa.
      const CAMPOS = ['folhagem', 'grama', 'temperatura', 'umidade', 'crescimento', 'duracaoDoDia', 'neve'];
      const ESTS = ['primavera', 'verao', 'outono', 'inverno'];
      const limpo: any = {};
      for (const [est, campos] of Object.entries(perfis ?? {})) {
        if (!ESTS.includes(est) || !campos || typeof campos !== 'object') return false;
        const p: any = {};
        for (const [k, v] of Object.entries(campos)) {
          if (!CAMPOS.includes(k) || typeof v !== 'number' || !Number.isFinite(v)) return false;
          p[k] = v;
        }
        limpo[est] = p;
      }
      definirPerfil(bioma as any, limpo);
      return true;
    },
    setWeather: (nome) => {
      if (nome === null) { climaForcado = undefined; return true; }
      if (!(nome in CLIMAS)) return false;
      climaForcado = nome as import('./world/weather').ClimaId;
      return true;
    },
    playSound: (nome, posicao, volume) => {
      const spec = SOUNDS[nome];
      if (!spec) return; // nome inválido é ignorado, não quebra o script
      audio.play(spec, { position: posicao, volume, dedupeKey: `mod:${nome}` });
    },
    modFetch: (modId, endereco, opcoes) => redeDeMods.chamar(modId, endereco, opcoes ?? {}),
    registrarBioma: (modId, def) => {
      const erro = registrarBiomaDeMod(normalizarBiomaDeMod(modId, def));
      if (erro) return erro;
      // O worldgen roda noutro reino e já tem uma cópia da lista. Sem reiniciá-lo, o bioma existiria
      // na cor da névoa e **não** no terreno — o jogador veria o horizonte mudar e o chão não.
      reiniciarGeracao();
      return null;
    },
  };

  /**
   * Consentimentos já concedidos, em memória.
   *
   * Um espelho da tabela, carregado ao abrir o mundo. A verificação acontece dentro de uma chamada
   * de mod, que pode ser sessenta vezes por segundo — consultar o IndexedDB ali tornaria cada
   * chamada assíncrona por um dado que muda uma vez por sessão.
   */
  let consentimentos: ModConsentRecord[] = [];

  const redeDeMods = new RedeDeMods({
    manifestoDe: (modId) => mcpExecutors.modService.getMod(modId)?.capacidades,
    hostsConsentidos: (modId) => consentimentos.filter((c) => c.modId === modId).map((c) => c.host),
    pedirConsentimento: async (modId, host, motivo, envia) => {
      const mod = mcpExecutors.modService.getMod(modId);
      const permitido = await pedirCapacidade({
        nomeDoMod: mod?.name ?? modId, host, motivo, envia,
      });
      if (!permitido || !currentWorld.id) return false;
      await WorldRepository.grantConsent(currentWorld.id, modId, host, envia);
      consentimentos = await WorldRepository.getConsents(currentWorld.id);
      return true;
    },
    registrar: (linha) => {
      if (!currentWorld.id) return;
      // Sem `await`: a auditoria não pode atrasar a resposta ao mod. Uma linha perdida numa falha
      // de escrita é melhor que uma chamada de rede que espera o disco.
      void WorldRepository.logModNetCall({ worldId: currentWorld.id, ...linha });
    },
  });

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
    hud.showToast(`Script "${scriptKey}" do mod "${modId}" foi desligado: ${reason}`);
  };
  // O reino de execução dos mods caiu. Sem este aviso, todos os mods param de responder de uma vez
  // e o jogo continua rodando normal — o jogador não teria como distinguir "o mod não faz nada" de
  // "o mod parou de existir".
  modRuntime.onReinoCaiu = (motivo, vaiTentarDeNovo) => {
    hud.showToast(vaiTentarDeNovo
      ? `Os mods travaram (${motivo}) e estão sendo recarregados.`
      : `Os mods travaram repetidamente (${motivo}) e foram desligados nesta sessão.`);
  };
  mcpExecutors.modRuntime = modRuntime;

  // --- Telas de manutenção -----------------------------------------------------------------
  // Versionamento, rollback e quarentena existiam mas só a IA os alcançava. Estas duas telas
  // põem na mão do usuário o que já estava construído.
  const modsPage = new ModsPage(mcpExecutors.modService, modRuntime);
  const codeEditor = new CodeEditorPage(mcpExecutors.modService, modRuntime);

  modsPage.worldIdAtual = () => currentWorld.id || null;
  // Sem isto, revogar só valeria na próxima vez que o mundo abrisse — o jogador teria clicado em
  // "revogar" e o mod continuaria com acesso pelo resto da sessão, sem nada indicando.
  modsPage.onConsentimentosMudaram = () => {
    if (currentWorld.id) void WorldRepository.getConsents(currentWorld.id).then((c) => { consentimentos = c; });
  };

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
    ambiente: () => ({
      // A camada entra junto do bioma, e não numa linha própria: as duas respondem "onde estou",
      // e separá-las faria o jogador ler duas linhas para montar uma resposta só.
      bioma: `${descreverBioma(pesosBioma)} · ${camadaNaProfundidade(
        (gen.column(Math.floor(player.pos.x), Math.floor(player.pos.z)).height - player.pos.y) / SCALE,
      ).nome}`,
      clima: descreverClima(clima),
      estacao: descreverEstacao(estacao),
      fase: nomeDaFase(gs.getMoonPhase()),
      noiteEscura: noiteEscura(gs.getMoonPhase()),
    }),
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
    hud.showToast(`Mod "${mod.name}" foi isolado: ${reason}`);
  };
  hud.setVisible(false);
  inventoryModal.setHotbarVisible(false);
  chatOverlay.hide();

  // --- Objetivos (item 007) ---------------------------------------------------
  //
  // Só no Modo Sobrevivência. Nos outros o jogador já tem todos os blocos e não gasta ferramenta,
  // então "fabrique a picareta de madeira para abrir a pedra" seria um passo sem obstáculo — um
  // guia que manda fazer o que já está feito ensina a ignorar o guia.
  const guiaAtivo = () => gameModeManager.rules.hasSurvival;

  function atualizarCartaoDeObjetivo(): void {
    if (!guiaAtivo()) { hud.esconderObjetivo(); return; }
    const atual = objetivos.atual();
    if (!atual) { hud.esconderObjetivo(); return; }
    hud.mostrarObjetivo(
      atual.def.titulo, atual.def.dica, atual.progresso, atual.def.meta,
      objetivos.totalConcluidos, objetivos.total,
    );
  }

  function registrarProgresso(e: EventoDeProgresso): void {
    if (!guiaAtivo()) return;
    const concluidos = objetivos.registrar(e);
    for (const def of concluidos) {
      hud.showToast(`Objetivo cumprido: ${def.titulo}`);
      audio.play(SOUNDS.objetivo, { channel: 'ui', dedupeKey: 'objetivo' });
    }
    // O cartão é redesenhado a cada evento que interessa, e não a cada quadro: o conteúdo só muda
    // quando o progresso muda, e reescrever `innerHTML` 60 vezes por segundo faria o navegador
    // recalcular o layout do cartão sem nenhuma mudança visível.
    if (concluidos.length > 0 || e.tipo !== 'profundidade') atualizarCartaoDeObjetivo();
    if (concluidos.length > 0) schedulePlayerSave();
  }

  inventoryModal.onCrafted = (recipe) => {
    registrarProgresso({ tipo: 'fabricou', bloco: recipe.outputBlock, tier: recipe.outputTool?.tier });
  };

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
    // `/mudo` e `/ouvir` são resolvidos AQUI, antes de qualquer despacho — item 1415.
    //
    // Emudecer alguém é uma decisão sobre os meus ouvidos, não sobre a sessão. Mandá-la ao
    // anfitrião a tornaria uma coisa que ele sabe, que ele pode negar, e que para de funcionar
    // quando ele cai — as três inaceitáveis para o recurso cuja função é dar autonomia a quem está
    // num mundo público.
    const silencio = interpretarComandoDeSilencio(raw, avatars.presentes(), silenciados);
    if (silencio.tratado) return { ok: true, message: silencio.mensagem ?? '' };

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

  /**
   * Promessa aguardando a identidade do terreno do anfitrião.
   *
   * `handleJoinLink` a instala antes de entrar na sala e espera por ela antes de criar o mundo
   * local — é o que garante que o convidado gere o terreno com a semente CERTA, em vez de gerar
   * o errado e tentar corrigir depois.
   */
  let resolverInfoDoMundo: ((info: { seed: number; groundHeight: number; name: string }) => void) | null = null;

  peerSync.onMessage = (msg, fromPeerId) => {
    // Tratado fora do `switch` porque chega ANTES do jogo existir: neste instante não há `world`,
    // nem HUD, nem chat, e qualquer outro ramo do tratador tocaria em algo ainda não construído.
    if (msg.type === 'world_info') {
      if (peerSync.role !== 'guest') return;
      resolverInfoDoMundo?.({ seed: msg.seed, groundHeight: msg.groundHeight, name: msg.name });
      resolverInfoDoMundo = null;
      return;
    }

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
      // --- Baús no mundo compartilhado — item 1522 ---------------------------------------------
      //
      // O anfitrião é o dono do conteúdo, pela mesma razão que é dono do mundo e das criaturas: sem
      // autoridade, dois jogadores no mesmo baú escrevem por cima um do outro e cada um vê um
      // conteúdo diferente do mesmo bloco. É a forma mais confusa possível de perder itens, porque
      // os dois juram que guardaram.
      case 'sleep_state': {
        if (peerSync.role !== 'host') break;
        registroDeSono.marcar(msg.playerId, msg.dormindo);
        avaliarSonoColetivo();
        break;
      }
      case 'chest_open': {
        if (peerSync.role !== 'host' || !currentWorld.id) break;
        void WorldRepository.carregarBau(currentWorld.id, msg.key).then((r) => {
          peerSync.sendTo(fromPeerId, { type: 'chest_state', key: msg.key, slots: sanearBau(r?.slots) });
        });
        break;
      }
      case 'chest_move': {
        if (peerSync.role !== 'host' || !currentWorld.id) break;
        const mundoId = currentWorld.id;
        void (async () => {
          // Lê do estado aberto quando é o mesmo baú: o anfitrião pode estar com ele na tela, e ler
          // do banco descartaria o que ele acabou de mexer.
          const slots = bauAberto?.key === msg.key
            ? bauAberto.slots
            : sanearBau((await WorldRepository.carregarBau(mundoId, msg.key))?.slots);

          if (msg.acao === 'retirar' && typeof msg.indice === 'number') {
            const p = retirar(slots, msg.indice);
            // O item vai para o convidado como um drop no mundo, e não por uma mensagem de
            // inventário: o inventário dele é local e o anfitrião não o conhece. Cair aos pés de
            // quem pediu é a única entrega que funciona sem inventar um segundo canal.
            if (p) {
              const [cx, cy, cz] = msg.key.split(',').map(Number);
              itemDropSystem.spawn(p.block, p.count, cx + 0.5, cy + 0.6, cz + 0.5);
            }
          } else if (msg.acao === 'guardar' && typeof msg.block === 'number' && typeof msg.count === 'number') {
            const r = depositar(slots, msg.block, msg.count);
            if (r.sobra > 0) {
              const [cx, cy, cz] = msg.key.split(',').map(Number);
              itemDropSystem.spawn(msg.block, r.sobra, cx + 0.5, cy + 0.6, cz + 0.5);
            }
          }

          await WorldRepository.salvarBau(mundoId, msg.key, slots);
          if (bauAberto?.key === msg.key) bauModal.atualizar();
          // Para TODOS, e não só para quem pediu: outro convidado com o mesmo baú aberto precisa
          // ver a mudança, senão ele clica numa pilha que já não existe.
          peerSync.broadcast({ type: 'chest_state', key: msg.key, slots });
        })();
        break;
      }
      case 'chest_state': {
        if (peerSync.role !== 'guest' || bauAberto?.key !== msg.key) break;
        // Substitui o conteúdo em bloco. O convidado não tem opinião sobre o que há dentro.
        bauAberto.slots.length = 0;
        bauAberto.slots.push(...sanearBau(msg.slots));
        bauModal.atualizar();
        break;
      }
      case 'block_update':
        conferirBauQuebrado(msg.x, msg.y, msg.z, msg.blockType);
        world.setBlock(msg.x, msg.y, msg.z, msg.blockType);
        break;
      case 'block_batch':
        for (const b of msg.blocks) {
          conferirBauQuebrado(b.x, b.y, b.z, b.blockType);
          world.setBlock(b.x, b.y, b.z, b.blockType);
        }
        break;
      case 'full_sync': {
        // Ordem obrigatória: registrar os mods primeiro, aplicar os blocos depois.
        const applyBlocks = () => {
          for (const m of msg.blockMods) world.setBlock(m.x, m.y, m.z, m.blockType);
          chatOverlay.receiveWorldChatMessage('', 'Sincronizado com o mundo do anfitrião.', true);
        };
        if (msg.mods?.length) {
          mcpExecutors.modService.applyRemoteMods(msg.mods).then((n) => {
            if (n > 0) hud.showToast(`${n} mod(s) recebidos do anfitrião`);
            applyBlocks();
          });
        } else {
          applyBlocks();
        }
        break;
      }
      case 'mob_sync': {
        // Só o convidado obedece; o anfitrião é a autoridade sobre as criaturas.
        if (peerSync.role !== 'guest') break;
        entitySystem.aplicarRetratoDeHostis(msg.mobs);
        break;
      }
      case 'world_time': {
        // Só o convidado obedece; o anfitrião é o relógio.
        if (peerSync.role !== 'guest') break;
        worldDay = msg.worldDay;
        gs.setMoonPhase(faseDoDia(worldDay));
        climaForcado = (msg.forcedWeather ?? undefined) as typeof climaForcado;
        // Diferença grande (troca de mundo, entrada na partida): acerta de uma vez. Diferença
        // pequena: deixa o laço principal alcançar correndo, para o sol não pular no céu.
        const alvo = ((msg.timeOfDay % 1) + 1) % 1;
        const erro = diferencaCircular(alvo, timeOfDay);
        if (Math.abs(erro) > 0.08) timeOfDay = alvo;
        else relogioAlvo = alvo;
        break;
      }
      case 'mod_sync':
        // Mod criado pela IA do anfitrião durante a partida.
        mcpExecutors.modService.applyRemoteMods([msg.mod]).then((n) => {
          if (n > 0) hud.showToast(`Mod "${msg.mod.name}" recebido do anfitrião`);
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
        // Quem sai deixa de contar — item 139. Esquecer isto é o modo de falha que trava a noite
        // para sempre: alguém que desconecta DORMINDO ficaria no conjunto, e o "todos dormiram"
        // nunca mais aconteceria. Só acontece quando alguém sai enquanto dorme, que é raro o
        // bastante para não aparecer em teste manual nenhum.
        avaliarSonoColetivo();
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

    // PRIMEIRA mensagem, antes do `full_sync` e do relógio: a identidade do terreno.
    //
    // O `full_sync` só carrega o que foi EDITADO à mão. Sobre um terreno gerado de outra semente
    // essas edições caem no vazio — uma casa construída num morro do anfitrião aparece flutuando,
    // ou enterrada, no mundo do convidado. Sem esta mensagem os dois jogam mundos diferentes.
    peerSync.sendTo(peerId, {
      type: 'world_info',
      seed: currentWorld.seed,
      groundHeight: currentWorld.groundHeight,
      name: currentWorld.name,
    });
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
    // O relógio do mundo vai na entrada, não daqui a dez segundos: sem isto o convidado passaria
    // o primeiro intervalo com a hora, a lua e o clima do próprio contador.
    peerSync.sendTo(peerId, {
      type: 'world_time',
      timeOfDay,
      worldDay,
      forcedWeather: climaForcado ?? null,
    });
    peerSync.broadcast({ type: 'player_joined', playerId: peerId, name }, peerId);
    hud.showToast(`${name} entrou no mundo!`);
  };
  peerSync.onPeerDisconnected = (peerId) => {
    const p = remotePlayers.get(peerId);
    remotePlayers.delete(peerId);
    if (peerSync.role === 'host' && p) {
      peerSync.broadcast({ type: 'player_left', playerId: peerId });
      avaliarSonoColetivo();
    }
    // O elemento de áudio daquele par vira lixo preso ao DOM se ninguém o remover — e um
    // `srcObject` apontando para um stream morto segura o stream junto.
    mixerDeVoz?.desconectar(peerId);
    trilhasPendentes.delete(peerId);
  };
  // --- Voz P2P (itens 927 a 932) -----------------------------------------------------------
  //
  // A trilha de áudio entra na `RTCPeerConnection` que já carrega os blocos. Sem servidor de voz,
  // sem upload: o áudio vai de um navegador para o outro, como o resto do mundo compartilhado.
  const voz = new VozP2P({
    pedirMicrofone: () => navigator.mediaDevices.getUserMedia({
      // `video: false` explícito, e não omitido: pedir só o que se usa é o que faz o navegador
      // mostrar "quer usar seu microfone" em vez de "seu microfone e sua câmera".
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    }),
    publicar: (trilha, stream) => peerSync.adicionarTrilhaDeAudio(trilha, stream),
    despublicar: () => peerSync.removerTrilhaDeAudio(),
    temPares: () => peerSync.peerCount > 0,
  });

  voz.aoMudar = (estado) => hud.atualizarMicrofone(estado.armado, estado.transmitindo);
  voz.aoFalhar = (motivo) => hud.showToast(`Microfone: ${motivo}`);
  hud.onAlternarMicrofone = () => { void voz.alternarMicrofone(); };

  /**
   * Elementos de áudio dos outros jogadores, um por par.
   *
   * Precisam estar no DOM e ter `autoplay`: um `MediaStream` que chega e não é ligado a um elemento
   * simplesmente não toca, sem erro nenhum — o áudio chega pela rede e morre em silêncio.
   */
  /**
   * Vozes remotas, posicionadas no mundo — itens 1414 e 1415.
   *
   * Antes era um `<audio autoplay>` por par e mais nada: todo mundo se ouvia no mesmo volume, de
   * qualquer distância e de qualquer direção. Num mundo aberto isso apaga a única informação que a
   * voz carrega além das palavras, que é *onde a pessoa está*.
   *
   * O mixer só nasce depois do primeiro gesto do usuário, que é quando o `AudioContext` existe. Até
   * lá as trilhas ficam guardadas e são ligadas assim que ele aparecer — perder a voz de quem entrou
   * antes do primeiro clique seria um silêncio impossível de diagnosticar.
   */
  let mixerDeVoz: MixerDeVoz | null = null;
  const trilhasPendentes = new Map<string, MediaStream>();
  const silenciados = new SilenciadosDeVoz(typeof localStorage !== 'undefined' ? localStorage : undefined);

  function garantirMixerDeVoz(): MixerDeVoz | null {
    if (mixerDeVoz) return mixerDeVoz;
    const ctx = audio.contexto;
    if (!ctx) return null;
    mixerDeVoz = new MixerDeVoz(ctx as any, document.body);
    for (const [id, s] of trilhasPendentes) mixerDeVoz.conectar(id, s);
    trilhasPendentes.clear();
    return mixerDeVoz;
  }

  peerSync.onTrilhaRemota = (peerId, stream) => {
    const mixer = garantirMixerDeVoz();
    if (mixer) mixer.conectar(peerId, stream);
    else trilhasPendentes.set(peerId, stream);
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
    if (broke) { hud.showToast('Sua ferramenta quebrou!'); audio.play(SOUNDS.ferramentaQuebrou); }
    else if (slot.durability !== undefined && slot.durability <= 5) {
      hud.showToast(`Ferramenta quase quebrando (${slot.durability} usos)`);
    }
  };

  // `onDamage`/`onDeath` são propriedades de um callback só, e não uma lista de assinantes: a
  // segunda atribuição APAGA a primeira. Havia duas de cada, umas 60 linhas adiante — o som de
  // dano, o som de morte e o evento `playerDamaged` dos mods estavam escritos, corretos e
  // **nunca executados**. Nada falhava; o jogo só era silencioso ao apanhar e ao morrer.
  //
  // Por isso os dois handlers vivem aqui, inteiros, e não há mais nenhuma atribuição a eles.
  survivalSystem.onDamage = (amount, cause) => {
    modRuntime.dispatch('playerDamaged', { amount, cause, health: survivalSystem.health });
    // Dano contínuo (fome, queimadura) chega a cada frame: sem deduplicar, viraria um zumbido.
    audio.play(cause === 'queimadura' ? SOUNDS.queimadura : SOUNDS.dano, { dedupeKey: `dano:${cause}`, volume: 0.9 });
    if (amount > 1) hud.showToast(`-${amount.toFixed(0)} de vida (${cause})`);
  };

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
    // Baú quebrado devolve o conteúdo — item 137. É a única regra que `bau.ts` não consegue impor
    // sozinho: o conteúdo está amarrado à POSIÇÃO, e quando o bloco some não sobra ninguém para
    // lembrar dele. Sem isto, quebrar um baú apaga tudo o que estava dentro, em silêncio.
    // No convidado, quem tem o conteúdo é o anfitrião — item 1532. Rodar aqui leria o banco local
    // (vazio), não devolveria nada, e ainda deixaria o conteúdo real órfão do outro lado. O
    // anfitrião detecta a quebra pelo `block_update` que já lhe chega.
    if (blockType === 0 && blocoAnterior === B.CHEST && peerSync.role !== 'guest') {
      void devolverConteudoDoBau(x, y, z);
    }
    relight(x, y, z);
    modRuntime.dispatch(blockType === 0 ? 'blockBroken' : 'blockPlaced', { x, y, z, block: blockType });

    // Progresso dos objetivos. Quebrar reporta o bloco que SAIU (`blocoAnterior`); o que entrou no
    // lugar é ar, e "quebre um tronco" nunca casaria.
    if (blockType === 0 && blocoAnterior !== undefined) {
      registrarProgresso({ tipo: 'quebrou', bloco: blocoAnterior });
    }

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
    // O cartão de objetivo aparece e some com o modo — sem isto ele ficaria na tela depois de
    // trocar para o Criativo, mandando fabricar o que o jogador já tem infinito.
    atualizarCartaoDeObjetivo();
    schedulePlayerSave();
  };
  inventoryModal.gateCreativeCatalog = () => gameModeManager.rules.hasCreativeInventory;

  survivalSystem.onDeath = (causa) => {
    audio.play(SOUNDS.morte, { volume: 1 });

    const modo = penalidadeDoMundo(currentWorld.penalidadeDeMorte);
    const efeito = aplicarPenalidade(modo, inter.hotbar);

    if (efeito.encerraMundo) {
      // Hardcore. O mundo é marcado ANTES de qualquer outra coisa: se o jogador fechar a aba nesta
      // fração de segundo, a partida não pode ressuscitar por não ter sido gravada.
      currentWorld.encerradoEm = Date.now();
      WorldRepository.saveWorld(currentWorld);
      hud.showToast(`${textoDaMorte(causa)} Mundo encerrado — era uma vida só.`);
      uiManager.closeBlocking('pause');
      if (document.pointerLockElement) document.exitPointerLock();
      chatOverlay.hide();
      mainMenu.open();
      return;
    }

    // Os itens caem no lugar da morte, e não no spawn: a caminhada de volta é a penalidade, e
    // largá-los no destino a anularia.
    const ondeMorreu = player.pos.clone();
    for (const item of efeito.largar) {
      // `'morte'` dá a estes uma vida cinco vezes maior e um tamanho maior — item 1330. É o que
      // responde "qual destas pilhas é a minha?" depois de duas mortes no mesmo lugar, sem texto.
      itemDropSystem.spawn(item.block, item.count, ondeMorreu.x, ondeMorreu.y + 0.5, ondeMorreu.z, 'morte');
    }
    for (const i of efeito.esvaziar) {
      inter.hotbar[i] = { label: '', block: -1, count: 0 };
    }
    if (efeito.largar.length > 0) {
      inter.onChanged();
      // A causa vem primeiro, e o resto depois — item 143. Ela sempre foi entregue por
      // `onDeath(cause)` e era descartada na assinatura: sete causas calculadas com cuidado
      // viravam a mesma frase. Morrer sem saber do quê é a diferença entre "eu errei" e "o jogo me
      // matou", e há causas invisíveis — a queimadura mata longe da lava.
      hud.showToast(`${textoDaMorte(causa)} Seus itens ficaram onde você caiu (${efeito.largar.length} pilha(s)).`);
    } else {
      hud.showToast(`${textoDaMorte(causa)} Renascendo no spawn...`);
    }

    player.pos.copy(ondeRenascer());
    player.vel.set(0, 0, 0);
    survivalSystem.reset();
  };

  // Cama: define onde renascer. Guardar a posição do jogador, e não a do bloco, evita renascer
  // dentro da própria cama — que é um bloco `decor` e não empurraria ninguém para fora, mas deixa a
  // câmera enfiada no colchão no instante em que ela mais precisa mostrar o que houve.
  // --- Baús — item 137 -------------------------------------------------------------------------
  //
  // O conteúdo é indexado pela POSIÇÃO do bloco, e não por um id de objeto: um baú não é uma
  // entidade, é um bloco. Sem id não há registro órfão quando o bloco some por um caminho que não
  // passa por aqui — `fill_box`, script de mod, um mundo recarregado.

  /**
   * O anfitrião devolve o conteúdo de um baú que um CONVIDADO quebrou — item 1532.
   *
   * Chamado **antes** do `setBlock`, e essa ordem é a função inteira: depois dele o bloco já é ar e
   * não há mais como saber que ali havia um baú. O convidado não pode fazer isso sozinho porque o
   * conteúdo é do anfitrião, e sem este caminho quebrar um baú do outro lado apagava tudo o que
   * estava dentro — em silêncio, com o registro ficando órfão no banco do anfitrião.
   */
  function conferirBauQuebrado(x: number, y: number, z: number, novoTipo: number): void {
    if (peerSync.role !== 'host') return;
    if (novoTipo !== 0) return;
    if (world.getBlock(x, y, z) !== B.CHEST) return;
    void devolverConteudoDoBau(x, y, z);
  }

  async function abrirBau(x: number, y: number, z: number): Promise<void> {
    const key = chaveDoBau(x, y, z);

    // No mundo compartilhado o baú é do anfitrião — item 1522. O convidado abre a tela vazia e
    // espera o `chest_state`; escrever no banco local dele criaria um segundo conteúdo para o mesmo
    // bloco, e cada lado juraria ter guardado.
    if (peerSync.role === 'guest') {
      bauAberto = { key, slots: bauVazio() };
      audio.play(SOUNDS.uiAbrir, { channel: 'ui' });
      bauModal.abrir(bauAberto.slots, `Baú (${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)})`);
      uiManager.openBlocking('bau');
      peerSync.sendToHost({ type: 'chest_open', key });
      return;
    }

    if (!currentWorld.id) return;
    const gravado = await WorldRepository.carregarBau(currentWorld.id, key);
    // `sanearBau` sempre, inclusive num baú novo: o caminho de dado inválido tem de ser o mesmo do
    // caminho normal, senão ele é exercitado uma vez a cada mil sessões e apodrece.
    bauAberto = { key, slots: sanearBau(gravado?.slots) };
    audio.play(SOUNDS.uiAbrir, { channel: 'ui' });
    bauModal.abrir(bauAberto.slots, `Baú (${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)})`);
    uiManager.openBlocking('bau');
  }

  async function gravarBauAberto(): Promise<void> {
    // O convidado nunca grava: o dono do conteúdo é o anfitrião.
    if (peerSync.role === 'guest') return;
    if (!bauAberto || !currentWorld.id) return;
    await WorldRepository.salvarBau(currentWorld.id, bauAberto.key, bauAberto.slots);
  }

  async function devolverConteudoDoBau(x: number, y: number, z: number): Promise<void> {
    if (!currentWorld.id) return;
    const key = chaveDoBau(x, y, z);

    // Se for o baú que está aberto, o estado da memória é o que vale — ele pode ter mudado sem ter
    // sido gravado ainda. Quebrar o bloco com a tela aberta é raro e é exatamente o caso que
    // perderia itens se lêssemos do banco.
    const slots = bauAberto?.key === key
      ? bauAberto.slots
      : sanearBau((await WorldRepository.carregarBau(currentWorld.id, key))?.slots);

    const fora = esvaziar(slots);
    await WorldRepository.apagarBau(currentWorld.id, key);
    if (bauAberto?.key === key) {
      bauAberto = null;
      bauModal.fechar();
    }

    for (const p of fora) {
      itemDropSystem.spawn(p.block, p.count, x + 0.5, y + 0.6, z + 0.5);
    }
    if (fora.length > 0) hud.showToast(`O baú se abriu: ${fora.length} pilha(s) caíram no chão.`);
  }

  bauModal.onRetirar = (indice) => {
    if (!bauAberto) return;
    if (peerSync.role === 'guest') {
      peerSync.sendToHost({ type: 'chest_move', key: bauAberto.key, acao: 'retirar', indice });
      return;
    }
    const p = retirar(bauAberto.slots, indice);
    if (!p) return;
    const guardou = inter.guardarNaHotbar(p.block, p.count);
    if (guardou < p.count) {
      // O que não coube volta para o baú. Largar no chão seria pior: o jogador clicou para PEGAR,
      // e ver a pilha cair aos pés dele parece um erro do jogo, não um inventário cheio.
      depositar(bauAberto.slots, p.block, p.count - guardou);
      hud.showToast('Sua barra está cheia — parte voltou para o baú.');
    }
    bauModal.atualizar();
    void gravarBauAberto();
  };

  bauModal.onGuardarSelecionado = () => {
    if (!bauAberto) return;
    const slot = inter.hotbar[inter.selected];
    if (!slot || slot.block === B.AIR || slot.infinite || slot.count <= 0) return;
    if (peerSync.role === 'guest') {
      // O convidado tira da própria barra na hora e manda o pedido. Esperar a confirmação faria a
      // pilha "piscar" de volta a cada clique numa conexão de 80 ms — e se o anfitrião recusar por
      // baú cheio, ele devolve pelo `chest_state`.
      peerSync.sendToHost({ type: 'chest_move', key: bauAberto.key, acao: 'guardar', block: slot.block, count: slot.count });
      slot.count = 0;
      inter.hotbar[inter.selected] = { label: '', block: -1, count: 0 };
      inter.onChanged();
      return;
    }
    const r = depositar(bauAberto.slots, slot.block, slot.count);
    if (r.guardados === 0) {
      hud.showToast('O baú está cheio.');
      return;
    }
    slot.count -= r.guardados;
    if (slot.count <= 0) inter.hotbar[inter.selected] = { label: '', block: -1, count: 0 };
    inter.onChanged();
    bauModal.atualizar();
    void gravarBauAberto();
  };

  bauModal.onFechar = () => {
    void gravarBauAberto().then(() => { bauAberto = null; });
    uiManager.closeBlocking('bau');
  };

  inter.onUseBlock = (blockType, bx, by, bz) => {
    if (blockType === B.CHEST) {
      void abrirBau(bx, by, bz);
      return;
    }
    if (blockType !== B.BED) return;

    // Definir o ponto acontece SEMPRE, e antes de qualquer recusa de dormir. É a metade da cama que
    // nunca pode falhar: quem tentar dormir de dia, ou sem estar abrigado, ainda assim quer ter
    // marcado ali o lugar para onde volta.
    pontoDeRenascimento = player.pos.clone();
    schedulePlayerSave();
    audio.play(SOUNDS.uiAbrir, { channel: 'ui' });

    const motivo = porQueNaoPodeDormir({
      ehNoite: fasesDoDia(horaAparente(timeOfDay, estacao.efeito.duracaoDoDia)) === 'noite',
      abrigado: abrigoAtual !== null,
      jaDormindo: dormindo,
    });
    if (motivo) {
      hud.showToast(`Ponto de renascimento definido. ${motivo}`);
      return;
    }

    dormindo = true;
    horaAoDeitar = timeOfDay;
    hud.mostrarSono(true);
    anunciarSono(true);
  };

  /**
   * Avisa a sessão que este jogador deitou ou levantou — item 139.
   *
   * O convidado manda ao anfitrião; o anfitrião marca a si mesmo e recalcula. Ninguém acelera
   * relógio nenhum aqui: quem faz isso é o laço de quadro, e só no anfitrião.
   */
  function anunciarSono(estaDormindo: boolean): void {
    if (peerSync.role === 'guest') {
      peerSync.sendToHost({ type: 'sleep_state', playerId: localPlayerId, dormindo: estaDormindo });
      return;
    }
    registroDeSono.marcar(localPlayerId, estaDormindo);
    avaliarSonoColetivo();
  }

  /** As linhas da lista de jogadores, montadas do que já existe — item 1497. */
  function linhasDeJogadores() {
    return montarListaDeJogadores({
      localId: localPlayerId,
      localNome: localPlayerName,
      localDormindo: dormindo,
      olhando: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
      remotos: Array.from(remotePlayers, ([id, p]) => ({ id, nome: p.name, pos: avatars.posicaoDe(id) })),
      silenciado: (id) => silenciados.estaSilenciado(id),
      // O registro de sono só existe no anfitrião; no convidado ninguém aparece dormindo além dele
      // mesmo, e isso é honesto — ele não tem essa informação.
      dormindo: (id) => registroDeSono.estaDormindo(id),
    });
  }

  painelDeJogadores.onAlternarSilencio = (id) => {
    const agora = silenciados.alternar(id);
    const nome = remotePlayers.get(id)?.name ?? id;
    hud.showToast(agora ? `${nome} silenciado.` : `Você voltou a ouvir ${nome}.`);
    painelDeJogadores.atualizar(linhasDeJogadores());
  };

  /** Ids de todo mundo na sessão, incluindo este cliente. */
  function presentesNaSessao(): string[] {
    return [localPlayerId, ...remotePlayers.keys()];
  }

  /**
   * Só o anfitrião. Conta quem está deitado e avisa a todos o que falta.
   *
   * A mensagem sai para **todos** e não só para quem deitou: quem está acordado precisa saber que
   * os outros estão esperando por ele, senão o recurso vira uma espera silenciosa em que ninguém
   * entende o que está acontecendo.
   */
  function avaliarSonoColetivo(): void {
    if (peerSync.role === 'guest') return;
    const presentes = presentesNaSessao();
    registroDeSono.sairam(presentes);

    const estado = estadoDoSonoColetivo({
      presentes,
      dormindo: registroDeSono.conjunto,
      nomes: new Map([[localPlayerId, localPlayerName], ...Array.from(remotePlayers, ([id, p]) => [id, p.name] as [string, string])]),
    });

    if (estado.mensagem && presentes.length > 1) {
      hud.showToast(estado.mensagem);
      peerSync.broadcast({ type: 'chat_message', playerId: 'system', name: 'Sistema', text: estado.mensagem, timestamp: Date.now() });
    }
  }

  chatOverlay.getLocationContext = () => {
    const p = player.pos;
    const px = Math.round(p.x);
    const pz = Math.round(p.z);

    let groundY = 4;
    for (let y = TOPO_VARREDURA; y >= 0; y--) {
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
    currentWorld.worldDay = worldDay;
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
      objetivos: objetivos.serializar(),
      pontoDeRenascimento: pontoDeRenascimento
        ? { x: pontoDeRenascimento.x, y: pontoDeRenascimento.y, z: pontoDeRenascimento.z }
        : undefined,
      updatedAt: Date.now(),
    }).catch(() => {});
  }
  let saveDebounce: number | null = null;
  function schedulePlayerSave(): void {
    if (saveDebounce) clearTimeout(saveDebounce);
    saveDebounce = window.setTimeout(savePlayerNow, 600);
  }
  inter.onChanged = () => { inventoryModal.renderHotbar(); schedulePlayerSave(); };

  /**
   * Espelha a configuração de IA do jogo nas globais derivadas do cofre.
   *
   * É o que faz `AI_MOD_ROUTER=$AI_ROUTER` funcionar sem o jogador colar a mesma chave duas
   * vezes — o pedido original. Derivadas e não gravadas: copiá-las criaria uma segunda cópia da
   * chave, que envelheceria em silêncio quando ele trocasse a das configurações.
   */
  async function sincronizarGlobaisDeIA(): Promise<void> {
    try {
      const cfg = await WorldRepository.getSettings();
      mcpExecutors.modService.vault.derivadas = {
        AI_ROUTER: cfg.provider,
        AI_API_KEY: cfg.provider === 'google_aistudio' ? cfg.googleApiKey : cfg.openRouterApiKey,
        AI_MODEL: cfg.model,
      };
    } catch {
      // Sem configuração ainda: os mods que herdam simplesmente não têm a chave, e quem exigir
      // uma vai para quarentena dizendo qual é — que é o comportamento certo.
    }
  }

  const loadWorldById = async (worldId: string) => {
    console.log(`[main.ts] Carregando e inicializando mundo ID: "${worldId}"`);
    // Migração antes de qualquer leitura: os passos normalizam mods e campos do mundo, e o
    // resto do carregamento assume esse formato. Rodar depois seria ler dados meio migrados.
    const migracao = await prepareWorld(worldId);
    if (migracao) {
      hud.showToast(`Mundo atualizado (v${migracao.from} → v${migracao.to})`);
      if (migracao.failures.length > 0) {
        hud.showToast(`Migração incompleta: ${migracao.failures[0]}`);
      }
    }

    const wRecord = await WorldRepository.getWorld(worldId);
    if (!wRecord) return;

    // Hardcore encerrado. A recusa vive aqui, na porta de entrada, e não na tela que lista os
    // mundos: há mais de um caminho até `loadWorldById` — o menu, o último mundo aberto ao iniciar,
    // e a troca de mundo pelo hub — e proteger cada um deles seria uma corrida que se perde na
    // primeira vez que alguém acrescentar um caminho novo.
    if (wRecord.encerradoEm) {
      const quando = new Date(wRecord.encerradoEm).toLocaleDateString();
      hud.showToast(`"${wRecord.name}" era um mundo de uma vida só, e acabou em ${quando}.`);
      mainMenu.open();
      return;
    }

    currentWorld = wRecord;
    // Perfis sazonais são registrados por mods e valem por mundo. Sem limpar, um mundo com o mod
    // "inverno eterno" contaminaria o próximo mundo aberto na mesma sessão — e o sintoma
    // (estações erradas) apareceria longe de qualquer coisa que o jogador tenha feito ali.
    limparPerfis();
    // Biomas de mod são por mundo: sem limpar, um mod de "bioma de cristal" instalado num mundo
    // contaminaria o próximo aberto na mesma sessão, e o sintoma seria terreno errado num mundo
    // que nunca teve aquele mod.
    limparBiomasDeMod();
    limparRegrasDeMod();
    limparTemplatesDeMod();
    relampago.reset();
    void sincronizarGlobaisDeIA();
    for (const key of Array.from(materiaisFade.keys())) encerrarFade(key);
    fadeAgenda.limpar();
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
    worker.postMessage({
      type: 'init', seed,
      biomasDeMod: biomasDeModRegistrados(),
      regrasDeMod: regrasDeModRegistradas(),
      templatesDeMod: templatesDeModRegistrados(),
    });

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
      hud.showToast(`${modSummary.mods} mod(s) carregados: ${modSummary.blocks} bloco(s), ${modSummary.entities} entidade(s)`);
    }

    const mods = await WorldRepository.getBlockModsForWorld(worldId);
    console.log(`[main.ts] Carregadas ${mods.size} modificações de blocos salvas para "${wRecord.name}"`);
    for (const [key, blockType] of mods.entries()) {
      const [x, y, z] = key.split(',').map(Number);
      world.setBlock(x, y, z, blockType);
    }

    // A hora do mundo faz parte do save: voltar sempre às 8h apagaria o progresso da noite.
    timeOfDay = typeof wRecord.timeOfDay === 'number' ? wRecord.timeOfDay : 0.35;
    worldDay = typeof wRecord.worldDay === 'number' ? wRecord.worldDay : 0;
    gs.setMoonPhase(faseDoDia(worldDay));
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
    // Objetivos são do jogador, não do mundo: quem volta a um mundo antigo continua de onde parou,
    // e quem entra num mundo novo começa a corrente do zero. `restaurar(undefined)` zera — sem essa
    // chamada no ramo do `else`, o progresso do mundo anterior vazaria para o mundo recém-criado.
    objetivos.restaurar(savedPlayer?.objetivos);
    atualizarCartaoDeObjetivo();

    // Idem ao progresso dos objetivos: zerar no ramo sem save é o que impede a cama do mundo
    // anterior de puxar o jogador para dentro de um mundo novo, em coordenadas que ali não
    // significam nada.
    const pr = savedPlayer?.pontoDeRenascimento;
    pontoDeRenascimento = pr ? new THREE.Vector3(pr.x, pr.y, pr.z) : null;

    // Consentimentos de rede deste mundo. Sem esta linha, todo mod pediria permissão de novo a cada
    // vez que o mundo fosse aberto — e uma permissão que se repete é uma permissão que se clica sem
    // ler, que é o hábito que ela existe para evitar.
    consentimentos = await WorldRepository.getConsents(worldId);

    localStorage.setItem(LAST_WORLD_KEY, worldId);

    console.log(`[main.ts] Mundo "${wRecord.name}" carregado do zero com sucesso!`);
  };

  // --- Gerenciador central de UI (Pause / Inventário bloqueantes; Chat flutuante) ---
  const uiManager = new UIManager();
  // Quando o pointer lock faz sentido: modo de câmera em primeira/terceira pessoa **e** a partida
  // em curso. Sem a checagem do menu inicial, a dica "clique para voltar ao jogo" aparecia por
  // cima da tela inicial — onde não há jogo para voltar.
  uiManager.configureLock(
    gs.renderer.domElement,
    () =>
      gameStarted &&
      !noMenuInicial &&
      (cameraManager.mode === 'fps' || cameraManager.mode === 'thirdperson' || cameraManager.mode === 'ghost'),
  );
  cameraManager.isSolidAt = (x, y, z) => isSolid(world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));

  // A névoa acompanha a distância de render. `setViewRange` existia mas nunca era chamado —
  // e, antes desta rodada, também não teria efeito, porque a cena não tinha névoa nenhuma.
  // Névoa e curvatura acompanham a distância de render. Ambas existiam no código e não eram
  // aplicadas: `setViewRange` mexia numa névoa nula, e a curvatura tinha intensidade 0 com
  // início além do alcance desenhado.
  cameraManager.onRenderDistanceChanged = (chunks) => {
    gs.setViewRange(chunks * CX);
    gs.setCurvature(chunks * CX);
  };
  gs.setViewRange(cameraManager.renderDistance * CX);
  gs.setCurvature(cameraManager.renderDistance * CX);

  // Retomar o controle da câmera depois do ESC exige um gesto do usuário — o navegador recusa
  // o pedido automático. O clique no canvas é esse gesto.
  uiManager.configureRelockOnClick(gs.renderer.domElement);

  // Prende o Tab dentro da tela aberta. Sem isto o foco sai por baixo: vai parar num botão da
  // hotbar ou num campo do chat que o jogador não vê, ele aperta Enter e algo acontece em outro
  // lugar. É a mesma família do "clico numa coisa e abre outra", só que pelo teclado — e pior,
  // porque não há nem para onde olhar.
  uiManager.configurarArmadilhaDeFoco();

  // A dica é o **botão** de retomada, não um aviso.
  //
  // Antes ela era um `div` com `pointer-events: none` e z-index baixo: dizia "clique para voltar"
  // sem ser clicável, e qualquer overlay que tivesse sobrado ficava por cima dela engolindo o
  // clique no canvas. O jogador via a instrução e nada acontecia. Agora ela recebe o clique
  // diretamente, com o maior z-index da interface — é o caminho que não pode falhar.
  const dicaClique = document.createElement('button');
  dicaClique.innerHTML = 'Clique para voltar ao jogo<br><span style="opacity:.6;font-size:12px">ou pressione W / espaço</span>';
  dicaClique.style.cssText = `
    position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
    background: rgba(2,6,23,0.9); color: #e2e8f0; font-family: system-ui, sans-serif;
    font-size: 15px; line-height: 1.5; padding: 14px 26px; border-radius: 10px;
    border: 1px solid #334155; cursor: pointer; z-index: ${CAMADA.retomada}; display: none;
  `;
  dicaClique.onclick = (e) => {
    e.stopPropagation();
    uiManager.retomarControle();
  };
  document.body.appendChild(dicaClique);
  // A visibilidade do botão agora é avaliada de forma reativa a cada frame no tick(),
  // o que impede que ele fique preso na tela se o pointerLock for perdido por outro
  // motivo (como a abertura de um menu).
  // Registro único de atalhos de tela. Antes cada tela instalava o próprio `keydown`, e o do
  // inventário nem consultava o gerenciador — daí abrir por cima de qualquer outra.
  uiManager.registrarAtalho('KeyE', 'inventory');
  uiManager.registrarAtalho('F4', 'character-creator');
  uiManager.registrarAtalho('F6', 'mods-page');
  uiManager.registrarAtalho('F7', 'code-editor');
  uiManager.registrarAtalho('KeyT', 'chat', 'floating');

  uiManager.registerBlocking(inventoryModal);
  uiManager.registerBlocking(bauModal);
  uiManager.registerBlocking(characterCreator);
  uiManager.registerBlocking(modsPage);
  uiManager.registerBlocking(codeEditor);
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
    getGradacao: () => predefinicaoGradacao,
    setGradacao: (id) => { predefinicaoGradacao = id as PredefinicaoId; },
    getFadeChunks: () => fadeAgenda.ligado,
    setFadeChunks: (v) => { fadeAgenda.ligado = v; },
    setOp: setPlayerOp,
    audio,
    onSairParaMenuInicial: () => {
      uiManager.closeBlocking('pause');
      if (document.pointerLockElement) document.exitPointerLock();
      savePlayerNow();
      chatOverlay.hide();
      mainMenu.open();
    },
    atalhosRapidos: [
      { icone: 'personagem', titulo: 'Personagem', tecla: 'F4', acao: () => uiManager.openBlocking('character-creator') },
      { icone: 'mods', titulo: 'Mods', tecla: 'F6', acao: () => uiManager.openBlocking('mods-page') },
      { icone: 'codigo', titulo: 'Editor', tecla: 'F7', acao: () => uiManager.openBlocking('code-editor') },
      { icone: 'inventario', titulo: 'Inventário', tecla: 'E', acao: () => uiManager.openBlocking('inventory') },
      { icone: 'chat', titulo: 'Chat / IA', tecla: 'T', acao: () => uiManager.toggleFloating('chat') },
    ],
    guiaAtivo,
    listarObjetivos: () => objetivos.listar().map((o) => ({
      titulo: o.def.titulo, dica: o.def.dica, progresso: o.progresso, meta: o.def.meta, concluido: o.concluido,
    })),
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

  /**
   * Entra numa sala a partir de um link ou id colado.
   *
   * ## A ordem importa, e estava invertida
   *
   * Antes: criava o mundo de visitante, **salvava no banco**, iniciava o jogo, e só então tentava
   * conectar. Quando a conexão falhava — relay fora do ar, id errado — o jogador já estava dentro
   * de um mundo vazio, e ficava com um registro permanente na lista de mundos para cada tentativa
   * frustrada. Foi assim que nasceu o "Visitante de ws://localhost:8787" do relato.
   *
   * Agora: valida, conecta, e **só cria o mundo depois que a conexão de fato abriu**. Uma
   * tentativa que falha não deixa rastro nenhum — que é o comportamento certo, porque um mundo de
   * visitante não tem conteúdo próprio: ele só existe para receber o que o anfitrião manda.
   */
  async function handleJoinLink(link: string): Promise<void> {
    const roomId = idDeSala(link, location.href);
    if (!roomId) {
      mainMenu.mostrarErroEntrada?.(
        'Isso não parece um convite. Cole o link inteiro que o anfitrião gerou (contém "?join="), ' +
        'ou apenas o código da sala.',
      );
      return;
    }

    const relayUrl = relayDeLink(link, location.href);
    if (relayUrl) signaling.configure(relayUrl);

    const ok = await peerSync.joinRoom(roomId);
    if (!ok) {
      mainMenu.mostrarErroEntrada?.(
        signaling.lastError ??
        'Não foi possível entrar na sala. Confira se o anfitrião ainda está com o mundo aberto.',
      );
      return;
    }

    // Conectado. Falta a peça que faltava: a identidade do TERRENO.
    //
    // Sem ela o mundo do convidado era criado com `Math.random()` como semente, e cada jogador
    // via um mundo inteiramente diferente — o relato "o mundo não é o mesmo no multiplayer". O
    // `full_sync` não resolvia porque só carrega o que foi editado à mão, e chega depois de o
    // convidado já ter gerado terreno.
    //
    // Esperar aqui, e não corrigir depois, é o que evita gerar o mundo errado e ter de descartá-lo.
    const info = await new Promise<{ seed: number; groundHeight: number; name: string } | null>((resolve) => {
      resolverInfoDoMundo = resolve;
      // Um anfitrião de versão antiga não conhece `world_info` e nunca responderia. Desistir com
      // uma mensagem clara é melhor que entrar num mundo que não é o dele.
      setTimeout(() => { if (resolverInfoDoMundo) { resolverInfoDoMundo = null; resolve(null); } }, 8000);
    });

    if (!info) {
      peerSync.stop();
      mainMenu.mostrarErroEntrada(
        'Conectado, mas o anfitrião não enviou os dados do mundo. Ele pode estar numa versão ' +
        'antiga do jogo — peça para atualizar a página e tentar de novo.',
      );
      return;
    }

    const guestWorld: WorldRecord = {
      // O id inclui a semente: entrar em dois mundos diferentes do mesmo anfitrião não pode
      // reaproveitar o cache de blocos de um no outro.
      id: `guest-${roomId}-${info.seed}`,
      name: `${info.name} (visitante)`,
      seed: info.seed,
      groundHeight: info.groundHeight, fov: 75, cameraMode: 'fps',
      defaultGameMode: 'adventure', onlineEnabled: false,
      saveVersion: CURRENT_SAVE_VERSION,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    await WorldRepository.saveWorld(guestWorld);
    mainMenu.close();
    await startGame(guestWorld.id);
    hud.showToast('Conectando ao anfitrião...');
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

  // O clique que retoma o pointer lock é do `UIManager` (`configureRelockOnClick`), e só dele.
  // Havia aqui um segundo ouvinte fazendo a mesma coisa com uma lista de modos DESATUALIZADA —
  // sem `thirdperson` —, então em terceira pessoa o clique não devolvia a câmera. Dois donos do
  // mesmo comportamento é como um deles fica para trás; agora existe um só.

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

  /**
   * Tecla de push-to-talk.
   *
   * `KeyV` porque está livre e fica perto do polegar esquerdo em quem joga com WASD — falar não
   * pode exigir tirar a mão do movimento.
   */
  const TECLA_DE_VOZ = 'KeyV';

  // Soltar a tecla **sempre** emudece, mesmo com um campo de texto focado. Um `keyup` filtrado pelo
  // mesmo `isTyping` do `keydown` deixaria o microfone aberto para sempre se o jogador clicasse
  // numa caixa de texto enquanto falava.
  window.addEventListener('keyup', (e) => {
    if (e.code === TECLA_DE_VOZ) voz.definirTecla(false);
    if (e.code === 'Tab') painelDeJogadores.esconder();
  });

  // A janela perdendo o foco também emudece: alt-tab com a tecla apertada nunca gera o `keyup`, e o
  // jogador continuaria transmitindo enquanto conversa com outra pessoa na frente do computador.
  //
  // Pelo mesmo motivo a lista de jogadores fecha: alt-tab com o Tab apertado é literalmente o gesto
  // que o navegador rouba, e o painel ficaria preso na tela até a próxima vez que alguém o
  // apertasse — parecendo um painel que não fecha.
  window.addEventListener('blur', () => {
    voz.definirTecla(false);
    painelDeJogadores.esconder();
  });

  // Pausa automática e limpeza de teclas presas ao trocar de aba (item 1056, 1057 P1)
  document.addEventListener('visibilitychange', () => {
    const hidden = document.visibilityState === 'hidden';
    const isMultiplayer = peerSync.role === 'guest' || (peerSync.role === 'host' && peerSync.peerCount > 0);
    if (hidden && gameStarted && !noMenuInicial) {
      if (!isMultiplayer && !uiManager.isAnyBlockingOpen()) {
        uiManager.openBlocking('pause');
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    // Os atalhos do navegador só são tomados enquanto o jogo está sendo JOGADO — item 1550.
    //
    // Ctrl+S abria "salvar página" por cima do mundo, Ctrl+D favoritava, F5 recarregava e perdia a
    // partida. Nenhum avisava e nenhum era recuperável. Fora do jogo — num menu, digitando no chat —
    // eles voltam a ser do navegador, senão a página inteira vira um lugar onde os reflexos de todo
    // mundo param de funcionar, que é pior que o problema.
    if (deveRoubar(e, !!document.pointerLockElement)) {
      e.preventDefault();
      return;
    }
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

    if (!isTyping) {

      // Push-to-talk (item 928). `repeat` é ignorado: segurar a tecla dispara `keydown` dezenas de
      // vezes por segundo, e cada uma reavaliaria o estado da trilha por nada.
      if (e.code === TECLA_DE_VOZ && !e.repeat) {
        voz.definirTecla(true);
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (document.pointerLockElement) document.exitPointerLock();
        // O hub é o destino do ESC. Ele concentra áudio, atalhos, saída da partida e mods de configuração.
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
      // Atalhos de tela: um caminho só, pelo registro do `UIManager`. Cada `if` aqui era um dono
      // a mais do teclado, e donos independentes é como se chega a "apertei F6 e abriu o
      // inventário" — cada um só conhece a própria tela e nenhum fecha a do outro.
      // [G] guarda o que está na mão, e só faz sentido com um baú aberto — item 137. Vem antes do
      // registro de atalhos porque não abre nem fecha tela nenhuma: é uma ação dentro da que já
      // está aberta, e o `UIManager` só sabe falar de telas.
      // [Tab] segurado mostra quem está na sessão — item 1497. É uma consulta e não uma tela:
      // segurar torna impossível esquecer aberto, e não bloquear evita soltar o ponteiro e pausar a
      // entrada para uma olhada de dois segundos.
      //
      // `preventDefault` sempre, inclusive na repetição: sem ele o Tab move o foco do navegador
      // para fora do canvas e o jogador perde o controle sem entender por quê.
      if (e.code === 'Tab') {
        e.preventDefault();
        if (!painelDeJogadores.visivel) painelDeJogadores.mostrar(linhasDeJogadores());
        return;
      }
      if (e.code === 'KeyG' && bauModal.isOpen) {
        e.preventDefault();
        bauModal.onGuardarSelecionado();
        return;
      }
      if (uiManager.tratarAtalho(e.code)) {
        e.preventDefault();
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
  // `THREE.Clock` foi depreciado em favor de `THREE.Timer`. A diferença de uso é que o Timer
  // precisa de um `update()` explícito por quadro antes de ler o delta — em troca, o delta é o
  // mesmo para todos que o consultarem dentro do quadro, em vez de zerar no primeiro leitor.
  const clock = new THREE.Timer();
  let streamAccum = 0;
  let saveAccum = 0;
  let relogioDeProfundidade = 0;
  let relogioDeAbrigo = 0;
  /** Células do espaço fechado onde o jogador está, ou `null` se ele está a céu aberto. */
  let abrigoAtual: Set<string> | null = null;
  /** Conta há quanto tempo cada criatura está presa no abrigo ou longe demais — item 1321. */
  const relogioDeDespawn = new RelogioDeDespawn();
  /** Verniz de inverno: converte a superfície perto do jogador — item 1118. */
  const invernada = new Invernada();
  let relogioDeInvernada = 0;
  /** Crescimento rasteiro, na velocidade da estação — item 1119. */
  const vegetacao = new Vegetacao();
  let relogioDeVegetacao = 0;
  /** Já avisamos nesta noite que o jogador está descoberto? Zera ao amanhecer. */
  let avisouDescoberto = false;
  /** O jogador está dormindo: o relógio do mundo corre acelerado até o amanhecer. */
  let dormindo = false;
  /** Quem está deitado na sessão — item 139. Só o anfitrião mantém. */
  const registroDeSono = new RegistroDeSono();
  /** Hora do mundo no momento de deitar, para cobrar do corpo o tempo que o mundo pulou. */
  let horaAoDeitar = 0;
  let netAccum = 0;
  /** Acumulador do retrato de criaturas enviado aos convidados. */
  let mobSyncAccum = 0;
  /** Hash da última aparência enviada, para reenviá-la só quando muda (item 923). */
  let ultimoHashAparencia = -1;
  /** Última posição em que um passo soou, para a cadência seguir a distância andada. */
  let ultimoPassoX = 0, ultimoPassoZ = 0;

  function tick(): void {
    requestAnimationFrame(tick);
    clock.update();
    const dt = Math.min(clock.getDelta(), 0.08);

    // Na tela inicial o quadro é devolvido imediatamente. O `requestAnimationFrame` continua
    // agendado para a volta ser instantânea, mas nada é simulado nem desenhado.
    if (noMenuInicial) return;
    profiler.beginFrame();

    streamAccum += dt;
    if (streamAccum > 0.05) {
      streamAccum = 0;
      profiler.begin('chunks'); streamChunks(dt); profiler.end('chunks');
    }

    // A dica do cursor precisa sumir na mesma hora em que um menu abre, senão fica por cima
    // do Hub com o maior z-index do jogo e bloqueia a navegação central.
    const wantDica = uiManager.aguardandoGesto && gameStarted && !uiManager.isAnyBlockingOpen();
    if (wantDica && dicaClique.style.display === 'none') dicaClique.style.display = 'block';
    else if (!wantDica && dicaClique.style.display === 'block') dicaClique.style.display = 'none';

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

    // O boneco aparece em terceira pessoa E em primeira — nesta, sem a cabeça.
    //
    // Antes ele sumia inteiro em primeira pessoa, e olhar para baixo mostrava o chão através do
    // próprio corpo. Um jogo em primeira pessoa sem corpo parece uma câmera flutuante; com
    // corpo, o jogador tem onde se localizar. A cabeça continua oculta porque a câmera está
    // dentro dela e o modelo apareceria como uma parede de textura.
    //
    // No modo fantasma o corpo some por inteiro, de propósito: ali o jogador atravessa parede, e
    // ver o próprio corpo passando por dentro de blocos entregaria a ilusão.
    const primeiraPessoa = cameraManager.mode === 'fps';
    const showModel = cameraManager.mode === 'thirdperson' || primeiraPessoa;
    playerModel.setPrimeiraPessoa(primeiraPessoa);
    playerModel.setVisible(showModel);
    if (showModel) {
      playerModel.group.position.set(player.pos.x, player.pos.y, player.pos.z);
      const speed = Math.hypot(player.vel.x, player.vel.z);
      // Em primeira pessoa o corpo NÃO gira com o olhar vertical: só a cabeça faria isso, e ela
      // está oculta. Passar o pitch giraria o tronco inteiro e o jogador veria o próprio peito
      // ao olhar para cima.
      playerModel.update(dt, speed, player.onGround ?? true, player.yaw, primeiraPessoa ? 0 : player.pitch);
    }
    avatars.update(dt);
    // A lista, se estiver aberta: as distâncias mudam a cada passo, e uma lista congelada mentiria
    // sobre quem está perto — que é exatamente a informação que alguém abre a lista para ver.
    painelDeJogadores.atualizar(linhasDeJogadores());

    // A voz acompanha o corpo — itens 1414 e 1415.
    //
    // Depois do `avatars.update`, e isso importa: a posição usada é a **exibida**, a mesma que o
    // jogador está vendo. Com a posição-alvo recebida da rede, a voz chegaria de um ponto adiante
    // do avatar, e a diferença é audível quando alguém corre.
    if (mixerDeVoz) {
      const ouvinte = { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw };
      for (const peerId of mixerDeVoz.pares) {
        mixerDeVoz.aplicar(
          peerId,
          misturaDaVoz(ouvinte, avatars.posicaoDe(peerId), silenciados.estaSilenciado(peerId)),
        );
      }
    }

    // Ciclo dia/noite. A luz de céu está assada na cor dos vértices, então o mundo só é
    // re-meshado quando `sunScale` muda o suficiente para ser perceptível — algumas vezes por
    // dia de jogo, e não a cada frame.
    const faseAnterior = fasesDoDia(horaAparente(timeOfDay, estacao.efeito.duracaoDoDia));
    const anterior = timeOfDay;

    // Ritmo do relógio. O convidado que está atrás do anfitrião corre até 30% mais rápido (ou
    // mais devagar) até alcançar — nunca salta, porque saltar faz o sol pular no céu e o mundo
    // inteiro ser re-meshado de uma vez quando `sunScale` cruza o limiar.
    let ritmo = 1;
    if (relogioAlvo !== null) {
      const erro = diferencaCircular(relogioAlvo, timeOfDay);
      if (Math.abs(erro) < 0.0008) relogioAlvo = null;
      else ritmo = 1 + Math.sign(erro) * 0.3;
    }
    // Dormir corre o relógio em vez de saltá-lo. Um salto faria `sunScale` cruzar o limiar de uma
    // vez, com o mundo inteiro re-meshado num quadro e o sol pulando no céu.
    // Acelera só quando TODOS estão deitados — item 139. Maioria significaria ter a noite pulada
    // contra a própria vontade, e quem estava minerando no fundo de uma caverna acabou de perder a
    // noite inteira de trabalho seguro. Numa sessão de dois, "maioria" nem quer dizer nada.
    if (dormindo && peerSync.role !== 'guest') {
      const presentes = presentesNaSessao();
      registroDeSono.sairam(presentes);
      if (estadoDoSonoColetivo({ presentes, dormindo: registroDeSono.conjunto }).todosDormem) {
        ritmo = RITMO_DORMINDO;
      }
    }
    timeOfDay = (timeOfDay + (dt * ritmo) / DAY_LENGTH) % 1;

    // O anfitrião é o relógio do mundo: sem isto, cada par contava o tempo desde que entrou, e
    // dois jogadores no mesmo lugar viam horas, fases da lua e climas diferentes.
    if (peerSync.role === 'host') {
      proximoEnvioDeHora -= dt;
      if (proximoEnvioDeHora <= 0) {
        proximoEnvioDeHora = 10;
        peerSync.broadcast({
          type: 'world_time',
          timeOfDay,
          worldDay,
          forcedWeather: climaForcado ?? null,
        });
      }
    }
    // Virou o dia: a lua avança uma fase, como no Minecraft (uma por amanhecer).
    if (timeOfDay < anterior) {
      worldDay++;
      gs.setMoonPhase(faseDoDia(worldDay));
      hud.showToast(`Noite de lua ${nomeDaFase(worldDay)}`);
    }
    // Hora APARENTE — item 1120. O relógio real continua uniforme (é o que a sincronização entre
    // pares, o contador de dias e o sono dependem); o que a estação move é onde o sol está para uma
    // dada hora. No inverno o nascer atrasa e o pôr adianta, e a noite fica mais longa sem que o
    // dia deixe de durar `DAY_LENGTH` segundos.
    //
    // Tudo o que lê "que horas são" passa a ler daqui: fase do dia, abrigo, sono e o céu. Deixar
    // qualquer um deles no relógio real faria a noite do inverno começar visualmente e não valer
    // como noite para as mecânicas — o pior dos dois mundos.
    const horaDoSol = horaAparente(timeOfDay, estacao.efeito.duracaoDoDia);
    gs.setTimeOfDay(horaDoSol);
    const faseAtual = fasesDoDia(horaDoSol);
    if (faseAtual !== faseAnterior) modRuntime.dispatch('dayPhase', { phase: faseAtual, timeOfDay });
    // "Sobreviva até o amanhecer" precisa do AMANHECER, e não da virada do contador de dias: o
    // relógio dá a volta em `timeOfDay = 0`, que é **meia-noite** — o objetivo fecharia no meio da
    // noite, antes da parte perigosa, e o jogador ganharia por ter sobrevivido a metade dela.
    if (faseAtual === 'amanhecer' && faseAnterior !== 'amanhecer') {
      registrarProgresso({ tipo: 'amanheceu' });
    }
    // Acordar é decidido pela FASE, e não por um valor de `timeOfDay`: é a mesma noção que o resto
    // do jogo usa para dizer o que é noite, e um número solto aqui poderia sair de sincronia com
    // ela sem nada apontar a discordância. Sem esta parada, o relógio a 90× daria voltas no dia.
    if (dormindo && deveAcordar(faseAtual)) {
      dormindo = false;
      hud.mostrarSono(false);
      anunciarSono(false);

      // O corpo atravessa o mesmo período que o mundo. Sem isto, uma noite inteira passava para o
      // mundo (uns seis minutos) e quatro segundos para o jogador — metade da barra de fome deixava
      // de ser cobrada, e dormir virava a maneira mais eficiente de não comer.
      const pulado = ((timeOfDay - horaAoDeitar) % 1 + 1) % 1;
      survivalSystem.descansar(pulado * DAY_LENGTH);

      hud.showToast('Bom dia.');
      // O relógio saltou horas: os convidados precisam saber agora, e não no envio periódico de
      // 10 em 10 segundos — nesse intervalo eles ainda estariam de noite, com o céu de outro
      // horário e criaturas que o anfitrião já não simula.
      if (peerSync.role === 'host') {
        peerSync.broadcast({ type: 'world_time', timeOfDay, worldDay, forcedWeather: climaForcado ?? null });
      }
    }

    profiler.begin('mods'); modRuntime.tickAll(dt); profiler.end('mods');
    const sunScale = gs.getSunScale();
    if (Math.abs(sunScale - lastBakedSun) > 0.06) {
      lastBakedSun = sunScale;
      for (const c of world.chunks.values()) c.dirty = true;
    }

    cameraManager.update();
    profiler.begin('física'); physics.update(dt); profiler.end('física');

    // Hostis só existem onde a sobrevivência está ligada; no criativo o mundo é seguro.
    // O CONVIDADO não gera criaturas nem simula a IA delas.
    //
    // Antes rodava o próprio `MobSpawner` sem checar o papel: cada lado criava as suas, em
    // lugares diferentes, e simulava as mesmas de forma independente. Duas simulações autônomas
    // do mesmo objeto nunca convergem. É a segunda metade do relato "o mundo não é o mesmo no
    // multiplayer" — a primeira era a semente.
    const souAutoridade = peerSync.role !== 'guest';
    entitySystem.autoridade = souAutoridade;
    mobSpawner.enabled = rules.hasSurvival && souAutoridade;

    // O abrigo do jogador, mapeado uma vez e usado por dois: o objetivo "esteja abrigado ao
    // escurecer" e a regra que impede um hostil de nascer dentro de casa.
    //
    // É uma busca em largura, cara demais para rodar por quadro — daí o relógio de 2 s. E só de
    // noite: de dia nada nasce por luz mesmo, e estar abrigado não quer dizer nada.
    // A condição é `hasSurvival`, e não `mobSpawner.enabled`: o convidado não gera criaturas — quem
    // as gera é o anfitrião — mas tem objetivos próprios, e prendê-lo à autoridade deixaria "esteja
    // abrigado" impossível para todo mundo que entra num mundo dos outros.
    if (rules.hasSurvival && fasesDoDia(horaAparente(timeOfDay, estacao.efeito.duracaoDoDia)) === 'noite') {
      relogioDeAbrigo -= dt;
      if (relogioDeAbrigo <= 0) {
        relogioDeAbrigo = 2;
        abrigoAtual = mapearAbrigo(
          world, Math.floor(player.pos.x), Math.floor(player.pos.y), Math.floor(player.pos.z),
        );
        if (abrigoAtual) {
          registrarProgresso({ tipo: 'abrigado' });
        } else if (!avisouDescoberto && !objetivos.concluido('abrigo')) {
          // Uma vez por noite, e só enquanto o objetivo está pendente. A verificação já sabe a
          // resposta, e o silêncio é o que faz o objetivo parecer quebrado para quem levantou as
          // quatro paredes e esqueceu o teto: ele fez tudo, nada acontece, e nada diz o que falta.
          //
          // Depois de cumprido o objetivo, o aviso vira sermão — quem sai à noite de propósito já
          // sabe o que está fazendo.
          avisouDescoberto = true;
          hud.showToast('Você está a céu aberto — feche um espaço antes que as criaturas apareçam.');
        }
      }
    } else {
      // Amanheceu (ou o modo mudou): o mapa antigo deixaria uma bolha permanente sem spawn onde a
      // casa esteve, mesmo depois de o jogador atravessar o mundo.
      abrigoAtual = null;
      avisouDescoberto = false;
    }
    // O mundo que o spawner vê ganha a altura da superfície, para a espécie sair da camada do
    // ponto sorteado. Sem isso, todo hostil nasceria com a mistura da superfície, mesmo no abismo.
    const mundoDeSpawn = Object.assign(Object.create(world) as typeof world, {
      superficieY: (x: number, z: number) => gen.column(x, z).height,
    });
    const ponto = mobSpawner.update(dt, mundoDeSpawn, player.pos, {
      timeOfDay,
      sunScale,
      // Lua nova gera hostis quase no dobro do ritmo. É o que dá consequência de jogo à fase:
      // sem isto, olhar para o céu não mudaria nenhuma decisão do jogador.
      moonIllumination: iluminacaoDaFase(gs.getMoonPhase()),
      hostileCount: entitySystem.hostileCount,
      maxY: CY,
      // Perigo da camada onde o jogador está — item 497. Descer é trocar segurança por recurso, e
      // sem isto a única diferença entre a caverna e o abismo seria o tempo de caminhada.
      perigo: camadaNaProfundidade(
        (gen.column(Math.floor(player.pos.x), Math.floor(player.pos.z)).height - player.pos.y) / SCALE,
      ).perigo,
      // A casa protege. Sem isto ela não protegia de nada: o interior fechado é o lugar mais
      // escuro do mundo à noite, e `MIN_SPAWN_DISTANCE` são menos de cinco metros — ou seja, o
      // melhor berço que o sorteio poderia encontrar era exatamente dentro do abrigo.
      dentroDoAbrigo: abrigoAtual
        ? (x, y, z) => abrigoAtual!.has(chaveDeCelula(x, y, z))
        : undefined,
    });
    if (ponto) entitySystem.spawnHostile(ponto.kind, ponto.x, ponto.y, ponto.z);

    // O outro lado da regra de abrigo — item 1321.
    //
    // A casa recusava o BERÇO e mais nada: quem fechasse a porta com um zumbi dentro ficava com ele
    // lá para sempre. E não havia despawn de espécie alguma, então o teto de hostis acabava tomado
    // por criaturas a centenas de metros, que nunca mais seriam vistas — com o efeito de o mundo
    // perto do jogador ir ficando inexplicavelmente vazio.
    //
    // Só o anfitrião decide: no convidado as criaturas vêm pelo `mob_sync`, e removê-las aqui as
    // faria piscar de volta na sincronização seguinte.
    if (entitySystem.autoridade) {
      const observadas = entitySystem.listHostiles().map((m) => ({
        id: m.id,
        kind: m.mobKind,
        x: m.pos.x, y: m.pos.y, z: m.pos.z,
        desdeOCombate: entitySystem.desdeOCombate(m.id),
      }));
      for (const { id } of relogioDeDespawn.avancar(observadas, {
        jogador: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
        dentroDoAbrigo: abrigoAtual
          ? (x, y, z) => abrigoAtual!.has(chaveDeCelula(x, y, z))
          : undefined,
      }, dt)) {
        entitySystem.despawnEntity(id);
      }
    }

    // Retrato das criaturas para os convidados, a 6 Hz.
    //
    // Não a cada quadro: criatura anda devagar e o convidado interpola visualmente de qualquer
    // forma. A 60 Hz seria dez vezes a banda para nenhum ganho perceptível.
    if (peerSync.role === 'host' && peerSync.peerCount > 0) {
      mobSyncAccum += dt;
      if (mobSyncAccum >= 1 / 6) {
        mobSyncAccum = 0;
        peerSync.broadcast({ type: 'mob_sync', mobs: entitySystem.retratoDeHostis() });
      }
    }

    playerCombat.tick(dt);
    profiler.begin('entidades');
    const danoRecebido = entitySystem.update(dt, player.pos);
    profiler.end('entidades');
    if (danoRecebido > 0 && rules.hasSurvival && playerCombat.canBeHurt()) {
      playerCombat.markHurt();
      // `'criatura'` e não `'ataque inimigo'`: é a chave que `causaDaMorte.ts` conhece — item 143.
      // Dois nomes para a mesma coisa é o que faz a tela de morte cair no texto genérico sem que
      // nada reprove.
      survivalSystem.applyDamage(danoRecebido, 'criatura');
    }
    gs.updateSun(player.pos.x, player.pos.z);

    // Ambiência do bioma: a névoa ganha a cor e o alcance da MISTURA de biomas do ponto onde o
    // jogador está. Como `temp` e `moist` são campos contínuos, atravessar a fronteira do deserto
    // para a savana muda a cor do horizonte gradualmente, sem linha visível.
    //
    // Amostrado a cada 6 quadros, e não a cada um: `column()` refaz várias oitavas de ruído, e o
    // resultado muda devagar demais para justificar o custo — a interpolação temporal dentro de
    // `setBiomeAmbience` cobre o intervalo.
    quadrosAteBioma--;
    if (quadrosAteBioma <= 0) {
      quadrosAteBioma = 6;
      const col = gen.column(Math.floor(player.pos.x), Math.floor(player.pos.z));
      pesosBioma = pesosDeBioma({
        temp: col.temp,
        moist: col.moist,
        montanha: col.mountain,
        acimaDoMar: col.height - WATER_LEVEL,
      });
      // O dia fracionário é o relógio do clima. O bioma dominante traduz: a mesma chuva do mundo
      // cai como neve na tundra e não cai no deserto.
      // A estação vem antes do clima: é ela que decide se a chuva possível ali cai como neve.
      estacao = estadoSazonal(worldDay + timeOfDay, pesosBioma);

      // O inverno chega ao CHÃO — item 1118. Antes ele mudava a cor da folhagem e pesava a neve no
      // sorteio de clima; a neve caía atravessando o mundo sem nunca tocá-lo, e o chão continuava
      // verde debaixo dela. É uma varredura por perto porque a geração de chunk é determinística e
      // roda uma vez: a estação muda sobre chunks já salvos e já construídos pelo jogador.
      //
      // Só o anfitrião converte. No convidado os blocos chegam pelo `block_update`, e converter dos
      // dois lados faria os dois disputarem os mesmos voxels.
      if (rules.hasSurvival && entitySystem.autoridade) {
        relogioDeInvernada -= dt * 6; // este ramo roda a cada 6 quadros
        if (relogioDeInvernada <= 0) {
          relogioDeInvernada = 0.4;
          const mudou = invernada.passada(
            world,
            { x: player.pos.x, z: player.pos.z },
            estacao.efeito.neve,
            (x, z) => gen.column(x, z).height,
          );
          if (mudou.length > 0) {
            const alteracoes = mudou.map((m) => ({ x: m.x, y: m.y, z: m.z, blockType: m.t }));
            relightBatch(alteracoes);
            if (peerSync.role === 'host') enfileirarBlocos(alteracoes);
          }
        }

        // E o crescimento — item 1119. `crescimento` estava exposto aos mods por
        // `api.season.growth()` e não havia crescimento nenhum para modular: cavar um buraco e
        // tapar com terra deixava uma cicatriz marrom permanente na paisagem.
        //
        // Mais espaçado que a invernada porque é probabilístico: ele nunca termina, e a intenção é
        // o jogador NOTAR que algo cresceu ao voltar a um lugar, não vê-lo crescendo.
        relogioDeVegetacao -= dt * 6;
        if (relogioDeVegetacao <= 0) {
          relogioDeVegetacao = 1.5;
          const brotou = vegetacao.passada(
            world,
            { x: player.pos.x, z: player.pos.z },
            estacao.efeito.crescimento,
            (x, z) => gen.column(x, z).height,
          );
          if (brotou.length > 0) {
            const alteracoes = brotou.map((m) => ({ x: m.x, y: m.y, z: m.z, blockType: m.t }));
            relightBatch(alteracoes);
            if (peerSync.role === 'host') enfileirarBlocos(alteracoes);
          }
        }
      }

      const climaAnterior = clima.clima;
      clima = climaEm(
        seed,
        worldDay + timeOfDay,
        biomaDominante(pesosBioma),
        climaForcado,
        estacao.efeito.neve,
      );
      if (clima.clima !== climaAnterior) {
        hud.showToast(`${descreverClima(clima)}`);
        modRuntime.dispatch('weatherChange', { weather: clima.clima, previous: climaAnterior });
      }
      gs.setWeather(clima.luz, clima.alcanceNeblina);
      // O outono pinta o mundo trocando três números num uniform. Nenhum chunk é remontado —
      // o canal `aTint` do mesher já disse quais vértices respondem.
      gs.setSeasonTint(corDaFolhagem(estacao), corDaGrama(estacao), clima.molha);
      // Gradação: a saturação do bioma multiplica a da predefinição, então o deserto continua
      // mais lavado que a selva *dentro* do estilo que o jogador escolheu.
      saturacaoBioma = misturarEscalar(pesosBioma, 'saturacao');
    }
    // Névoa: o bioma manda em cima, a camada manda embaixo — itens 495 e 496.
    //
    // A mistura é pela profundidade e não uma escolha entre as duas: sob dois metros de terra o
    // jogador ainda vê o clarão do bioma pela boca do buraco, e trocar de vez ali seria um estalo
    // de cor no instante em que ele desce um degrau.
    //
    // A superfície tem `alcanceNeblina: 1` e mistura zero, então nada disso altera o comportamento
    // de quem está por cima — que é onde o sistema de biomas precisa continuar mandando sozinho.
    const superficieAqui = gen.column(Math.floor(player.pos.x), Math.floor(player.pos.z)).height;
    const profundidade = (superficieAqui - player.pos.y) / SCALE;
    const camada = ambienteDaProfundidade(profundidade);
    const camadaAqui = camadaNaProfundidade(profundidade);
    const dentroDaTerra = Math.max(0, Math.min(1, profundidade / CAMADAS[1].inicio));

    const corBioma = misturarCor(pesosBioma, 'neblina');
    const misturar = (a: number, b: number) => a + (b - a) * dentroDaTerra;
    gs.setBiomeAmbience(
      [
        misturar(corBioma[0], camada.neblina[0]),
        misturar(corBioma[1], camada.neblina[1]),
        misturar(corBioma[2], camada.neblina[2]),
      ],
      // Altitude — item 1092. O multiplicador entra **só no lado do bioma** da mistura, e essa é a
      // decisão inteira: o vale fecha a névoa de quem está lá em cima, e o subsolo continua sendo
      // governado só pela camada. Aplicá-lo depois da mistura faria a caverna de um vale ser mais
      // fechada que a caverna de um pico, na mesma profundidade e pelo motivo errado.
      misturar(
        misturarEscalar(pesosBioma, 'alcanceNeblina') * neblinaDeAltitude(player.pos.y / SCALE),
        camada.alcance,
      ),
      dt,
    );

    // E a luz junto com a névoa — item 1437.
    //
    // A névoa sozinha mudava de cor e o mundo continuava tão claro ao meio-dia quanto era em cima:
    // as três luzes da cena são globais e seguiam só o `sunScale`, então uma caverna a quarenta
    // metros era duas vezes mais clara ao meio-dia que à meia-noite. A luz por voxel já estava
    // certa; o que ela multiplicava é que não estava.
    gs.setLayerLight(camada.luzMinima, dentroDaTerra);

    // E o som — item 1438. A névoa mudou, a luz mudou, e o silêncio era o mesmo em toda
    // profundidade. Metade do "onde estou" é sonora: uma caverna silenciosa não é uma caverna, é um
    // corredor com a luz apagada. Sons esporádicos e sorteados, no canal `ambient`, sem posição:
    // a rocha assentando não vem de um ponto, vem de todo lado.
    const somDaCamada = avancarAmbiente(estadoDoAmbiente, camadaAqui.id, dt);
    if (somDaCamada) audio.play(somDaCamada, { channel: 'ambient', dedupeKey: 'camada' });

    // Precipitação. `clima.particulas` já vem interpolado entre o clima que sai e o que entra,
    // então a chuva engrossa e afina junto com a transição, sem nenhum tratamento aqui.
    // Aparição dos chunks recém-carregados.
    fadeAgenda.update(dt);
    if (fadeAgenda.aparecendo > 0) {
      for (const [key, mats] of materiaisFade) {
        const p = fadeAgenda.progresso(key);
        for (const m of mats) gs.setMaterialFade(m, p);
      }
    }
    for (const key of fadeAgenda.terminados()) encerrarFade(key);

    // A gradação acompanha a hora todo quadro (a exposição muda continuamente), mas a parte que
    // vem do bioma só é reamostrada junto com o bioma, acima.
    gs.setGrading(
      gradacaoEm({
        predefinicao: predefinicaoGradacao,
        elevacaoSolar: gs.getSunElevation(),
        saturacaoBioma,
        molhado: clima.molha,
      }),
    );

    profiler.begin('clima');
    const camPos = cameraManager.getActiveCameraPosition();
    precipitacao.update(dt, camPos, clima.particulas, clima.clima === 'neve', (x, y, z) =>
      isSolid(world.getBlock(x, y, z)),
    );

    // Raios. O clarão soma na luz do sol por alguns quadros; o trovão vem depois, atrasado pela
    // distância — é o atraso que faz o raio parecer longe em vez de em cima do jogador.
    const clarao = relampago.update(dt, clima.raios ? 0.35 : 0);
    gs.setLightningFlash(clarao);
    for (const ganho of relampago.trovoesProntos()) {
      audio.play(SOUNDS.trovao, { channel: 'ambient', volume: ganho });
    }

    // Som ambiente: uma fonte em laço, com o ganho seguindo a intensidade. Chuva fina é aguda e
    // chiada; temporal é grave e cheio — daí o brilho cair quando a intensidade sobe.
    const forcaChuva = Math.min(1, clima.particulas / 1400);
    audio.setAmbiente(forcaChuva, 1 - forcaChuva * 0.75);
    profiler.end('clima');

    hud.updateCoords(player.pos.x, player.pos.y, player.pos.z);

    // Profundidade, para o objetivo de descer. Medida contra a superfície DAQUI, não contra a
    // altura do spawn: quem anda até um vale estaria "15 metros abaixo" sem ter cavado nada, e o
    // objetivo seria cumprido por caminhar.
    //
    // `gen.column` é ruído puro e barato, mas não de graça — a cada meio segundo basta, porque
    // ninguém desce 15 metros nesse intervalo.
    if (rules.hasSurvival && !objetivos.concluido('desceu')) {
      relogioDeProfundidade -= dt;
      if (relogioDeProfundidade <= 0) {
        relogioDeProfundidade = 0.5;
        const superficie = gen.column(Math.floor(player.pos.x), Math.floor(player.pos.z)).height;
        registrarProgresso({ tipo: 'profundidade', metros: (superficie - player.pos.y) / SCALE });
      }
    }

    hud.updateCameraMode(cameraManager.mode);
    hud.updateNetworkStatus(peerSync.role, peerSync.peerCount);
    // O botão de microfone só existe numa partida com outras pessoas: oferecer a permissão mais
    // invasiva que existe para um recurso que não faz nada seria pedir por pedir.
    hud.setMicrofoneDisponivel(peerSync.peerCount > 0);
    if (rules.hasSurvival) {
      hud.updateSurvival(survivalSystem.health, survivalSystem.maxHealth, survivalSystem.hunger, survivalSystem.maxHunger);
      // Barra de ar — item 126. O afogamento já causava dano; o que não havia era aviso nenhum de
      // quanto tempo restava, e a única forma de aprender o limite era morrer nele.
      hud.updateAr(survivalSystem.ar);
    }

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

  console.log('Crom Planebox (Base Crom Quadrado) pronto — aguardando seleção no Menu Principal.');
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch(err => console.error('Erro na inicialização:', err));
});
