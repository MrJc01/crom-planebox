// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

// --- Batch 1: Compressão, Protocolo & Docs ---
import {
  PublicAPIDocumentationVerifier,
  SavedBlocksCompressor,
  WorldAndModExportCompressor,
  ModRevisionDeltaCompressor,
  DeflateSharedDictionary,
  CRIMEBreachDataIsolator,
  CromPackCodebookEvaluator,
  P2PSessionCompressionGainMeasure,
  SharedCodebookScenarioMeasure,
  CromPackWASMAPIExposer,
  CodebookPeerDistributor,
  CrompressorModGalleryEvaluator,
  FullSyncSeedRedundancyDocumenter,
  ModSmallDecorationScatter,
} from '../../src/mods/ModAPI';

// --- Batch 2: Voz P2P, Despawn, Mute ---
import {
  HostMigrationVoicePreserver,
  SingleShortcutMute,
  MicrophoneInputLevelIndicator,
  P2PVoiceHUDNotice,
  MaxSimultaneousVoiceLimit,
  VoiceRenegotiationCycleTest,
  SynchronizedEntityDespawn,
  DespawnNoticeAlert,
  OfflinePlayerMuteManager,
  WallAttenuatedVoiceFilter,
} from '../../src/net/PeerSync';

// --- Batch 2: Personagem & Câmera ---
import {
  CharacterSelfShadow,
  TranslucentGhostBodyMode,
  DistinctLeftRightArms,
  FirstPersonDamageReaction,
  UnderwaterBodyDistortion,
  HideCharacterBodyOption,
  FirstPersonHeadHidingVerifier,
} from '../../src/player/interaction';

// --- Batch 3: UI ---
import {
  ActiveScreenIndicator,
  WorldPreviewScreen,
  CreditsAndVersionScreen,
  FirstExecutionStepByStep,
  ResponsiveSmallWindowLayout,
  EscKeyCameraRestoreTest,
  ScreenStateNavigationTest,
  ChestScreenHotbarOverlay,
} from '../../src/ui/HUD';

// --- Batch 3: Céu & Rendering ---
import {
  NightSkyGradientEffect,
  MilkyWayStarBand,
  DarkenedNightClouds,
  RareEclipseWorldEvent,
  MoonPhaseMCPTool,
  EntityTerrainCurvatureAdapter,
  CloudShadowOnGround,
  ChunkPaletteCompression90MB,
  GlobalLayerLightAdapter,
  FrozenEntityDrawCallUnloader,
  CustomChest3DMesh,
} from '../../src/render/scene';

// --- Batch 4: Audio ---
import {
  WebAudioSynthVerificationTest,
  ShelterAmbientAudioFilter,
} from '../../src/audio/AudioSystem';

// --- Batch 5: Worldgen & Física ---
import {
  CIPerformanceBudgetTest,
  AggressiveChunkUnloader,
  PlayerBiomeApparentTime,
  SeasonTransitionNotice,
  SurfaceVisibleCaveEntrances,
  LayerConstrainedCaveGen,
} from '../../src/world/worldgen';
import {
  PlayerSnowIceSaveExclusion,
  SlipperyAndBreakableIce,
} from '../../src/world/physics';
import { DroppedItemsPersistence } from '../../src/entities/EntitySystem';

// =================================================================
// TESTES
// =================================================================

describe('Batch 1 — Compressão, Protocolo & Docs (Itens 900-926 P2/P3)', () => {
  it('deve verificar se método público aparece na documentação (900)', () => {
    expect(PublicAPIDocumentationVerifier.isMethodDocumented('setBlock', 'api.setBlock(x,y,z)')).toBe(true);
    expect(PublicAPIDocumentationVerifier.isMethodDocumented('foo', 'api.setBlock')).toBe(false);
  });

  it('deve comprimir e descomprimir save de blocos (908)', () => {
    const blocks = [1, 2, 3, 4];
    const compressed = SavedBlocksCompressor.compressBlockSave(blocks);
    const decompressed = SavedBlocksCompressor.decompressBlockSave(compressed);
    expect(decompressed).toEqual(blocks);
  });

  it('deve comprimir export de mundo e mod (909)', () => {
    const payload = WorldAndModExportCompressor.compressExportPayload({ name: 'test' });
    expect(payload.length).toBeGreaterThan(0);
  });

  it('deve computar delta entre revisões de mod (910)', () => {
    const delta = ModRevisionDeltaCompressor.computeRevisionDelta('abc', 'abcdef');
    expect(delta.diffPatch).toContain('3');
  });

  it('deve avaliar suporte a codebook no cromPack (911)', () => {
    expect(CromPackCodebookEvaluator.evaluateCodebookSupport('2.0.0').supportsCodebook).toBe(true);
    expect(CromPackCodebookEvaluator.evaluateCodebookSupport('1.5.0').supportsCodebook).toBe(false);
  });

  it('deve separar fluxos de segredo e dado público (912)', () => {
    const streams = CRIMEBreachDataIsolator.separateStreams('secret', 'public');
    expect(streams.secretStream.length).toBeGreaterThan(0);
    expect(streams.publicStream.length).toBeGreaterThan(0);
  });

  it('deve comparar tráfego codebook vs gzip (915)', () => {
    const r = SharedCodebookScenarioMeasure.compareTraffic(100, 200);
    expect(r.winner).toBe('codebook_index');
  });

  it('deve verificar se WASM está disponível (916)', () => {
    expect(typeof CromPackWASMAPIExposer.isWASMReady()).toBe('boolean');
  });

  it('deve decidir se deve enviar codebook ao peer (917)', () => {
    expect(CodebookPeerDistributor.shouldSendCodebook(false)).toBe(true);
    expect(CodebookPeerDistributor.shouldSendCodebook(true)).toBe(false);
  });

  it('deve avaliar necessidade de crompressor para galeria (920)', () => {
    expect(CrompressorModGalleryEvaluator.evaluateForGallery(15)).toBe(true);
    expect(CrompressorModGalleryEvaluator.evaluateForGallery(3)).toBe(false);
  });

  it('deve gerar string de documentação do full_sync (921)', () => {
    expect(FullSyncSeedRedundancyDocumenter.generateDocString()).toContain('semente');
  });

  it('deve comprimir com dicionário compartilhado (925)', () => {
    const result = DeflateSharedDictionary.compressWithDictionary('hello', 'dict');
    expect(new TextDecoder().decode(result)).toContain('dict');
  });

  it('deve medir ganho de compressão em sessão P2P (926)', () => {
    const gain = P2PSessionCompressionGainMeasure.measureGain(1000, 300);
    expect(gain.savingPct).toBe(70);
  });
});

describe('Batch 2 — Voz P2P, Personagem & Câmera (Itens 940-960 P2)', () => {
  it('deve preservar estado de voz na migração de host (940)', () => {
    expect(HostMigrationVoicePreserver.preserveVoiceState(true, true)).toBe(true);
    expect(HostMigrationVoicePreserver.preserveVoiceState(true, false)).toBe(false);
  });

  it('deve alternar mudo com atalho único (941)', () => {
    const mute = new SingleShortcutMute();
    expect(mute.toggleMute()).toBe(true);
    expect(mute.toggleMute()).toBe(false);
  });

  it('deve calcular nível de entrada do microfone (942)', () => {
    const data = new Float32Array([0.5, 0.3, 0.1, 0.4]);
    expect(MicrophoneInputLevelIndicator.calculateInputLevel(data)).toBeGreaterThan(0);
  });

  it('deve retornar aviso P2P de voz no HUD (943)', () => {
    expect(P2PVoiceHUDNotice.getNoticeMessage()).toContain('P2P');
  });

  it('deve verificar limite de voz simultânea (944)', () => {
    expect(MaxSimultaneousVoiceLimit.isSlotAvailable(5)).toBe(true);
    expect(MaxSimultaneousVoiceLimit.isSlotAvailable(8)).toBe(false);
  });

  it('deve simular renegociação de voz (945)', () => {
    expect(VoiceRenegotiationCycleTest.simulateRenegotiation(true)).toBe(true);
  });

  it('deve calcular escala de sombra do personagem (954)', () => {
    expect(CharacterSelfShadow.calculateShadowScale(0)).toBe(1.0);
    expect(CharacterSelfShadow.calculateShadowScale(5)).toBeLessThan(1.0);
  });

  it('deve retornar opacidade de corpo fantasma (955)', () => {
    expect(TranslucentGhostBodyMode.getBodyOpacity(true)).toBe(0.35);
    expect(TranslucentGhostBodyMode.getBodyOpacity(false)).toBe(1.0);
  });

  it('deve determinar braço ativo conforme item na mão (956)', () => {
    expect(DistinctLeftRightArms.getActiveArm('espada')).toBe('right');
    expect(DistinctLeftRightArms.getActiveArm(null)).toBe('left');
  });

  it('deve calcular intensidade de vinheta de dano (957)', () => {
    expect(FirstPersonDamageReaction.getDamageVignetteIntensity(0.3)).toBeCloseTo(0.7);
  });

  it('deve aplicar distorção subaquática ao corpo (958)', () => {
    expect(UnderwaterBodyDistortion.getDistortionFactor(true)).toBe(1.25);
  });

  it('deve respeitar opção de esconder corpo em 1ª pessoa (959)', () => {
    const opt = new HideCharacterBodyOption();
    opt.hideBodyInFirstPerson = true;
    expect(opt.shouldRenderBody('fps')).toBe(false);
    expect(opt.shouldRenderBody('thirdperson')).toBe(true);
  });

  it('deve ocultar cabeça em 1ª pessoa e mostrar em 3ª (960)', () => {
    expect(FirstPersonHeadHidingVerifier.isHeadVisible('fps')).toBe(false);
    expect(FirstPersonHeadHidingVerifier.isHeadVisible('thirdperson')).toBe(true);
  });
});

describe('Batch 3 — UI, Telas & Renderização Celestial (Itens 977-1039 P2)', () => {
  it('deve rastrear tela ativa (992)', () => {
    const ind = new ActiveScreenIndicator();
    ind.openScreen('inventory');
    expect(ind.currentScreen).toBe('inventory');
  });

  it('deve formatar card de mundo na prévia (995)', () => {
    const card = WorldPreviewScreen.formatWorldCard({ name: 'Mundo1', date: '2026-01', seed: 42 });
    expect(card).toContain('Mundo1');
  });

  it('deve retornar info de versão e créditos (996)', () => {
    expect(CreditsAndVersionScreen.getVersionInfo().version).toContain('1.0.0');
  });

  it('deve gerenciar estado de primeira execução (997)', () => {
    const step = new FirstExecutionStepByStep();
    expect(step.isFirstRun).toBe(true);
    step.completeOnboarding();
    expect(step.isFirstRun).toBe(false);
  });

  it('deve detectar janela pequena para layout responsivo (998)', () => {
    expect(ResponsiveSmallWindowLayout.isSmallWindow(500)).toBe(true);
    expect(ResponsiveSmallWindowLayout.isSmallWindow(1024)).toBe(false);
  });

  it('deve retornar gameplay ao pressionar ESC (999)', () => {
    expect(EscKeyCameraRestoreTest.handleEscKey('inventory')).toBe('gameplay');
  });

  it('deve navegar entre telas sem estado preso (1000)', () => {
    const nav = new ScreenStateNavigationTest();
    nav.navigateTo('settings');
    nav.navigateTo('controls');
    expect(nav.back()).toBe('settings');
  });

  it('deve retornar cor do céu noturno (1025)', () => {
    expect(NightSkyGradientEffect.getNightSkyColor(0.9)).toBe('#020617');
  });

  it('deve retornar densidade de estrelas à noite (1026)', () => {
    expect(MilkyWayStarBand.getStarDensity(0.1)).toBe(1.0);
    expect(MilkyWayStarBand.getStarDensity(0.5)).toBe(0.0);
  });

  it('deve escurecer nuvens à noite (1027)', () => {
    expect(DarkenedNightClouds.getCloudColor(true)).toBe('#1e293b');
  });

  it('deve disparar eclipse raro a cada 30 dias (1028)', () => {
    const eclipse = new RareEclipseWorldEvent();
    expect(eclipse.checkEclipseEvent(30)).toBe(true);
    expect(eclipse.checkEclipseEvent(15)).toBe(false);
  });

  it('deve retornar nome da fase lunar (1029)', () => {
    expect(MoonPhaseMCPTool.getMoonPhaseName(0)).toBe('Nova');
    expect(MoonPhaseMCPTool.getMoonPhaseName(4)).toBe('Cheia');
  });

  it('deve aplicar curvatura ao offset da entidade (1039)', () => {
    const y = EntityTerrainCurvatureAdapter.applyCurvatureOffset(10, 1000);
    expect(y).toBeLessThan(10);
  });

  it('deve verificar orçamento de performance no CI (977)', () => {
    expect(CIPerformanceBudgetTest.checkBudget('meshChunk', 15, 20)).toBe(true);
    expect(CIPerformanceBudgetTest.checkBudget('meshChunk', 25, 20)).toBe(false);
  });

  it('deve determinar se chunk deve ser descarregado (978)', () => {
    expect(AggressiveChunkUnloader.shouldUnloadChunk(100)).toBe(true);
    expect(AggressiveChunkUnloader.shouldUnloadChunk(10)).toBe(false);
  });
});

describe('Batch 4 — Decorações, Paletização, Sombras & Validações (Itens 1177-1482 P2/P3)', () => {
  it('deve calcular sombra de nuvens no chão (1177)', () => {
    const shadow = CloudShadowOnGround.calculateCloudShadow(0, 0, 0);
    expect(typeof shadow).toBe('number');
  });

  it('deve registrar e consultar decorações pequenas por mod (1431)', () => {
    const deco = new ModSmallDecorationScatter();
    deco.registerDecoration('modX', 10, 20, 'arbusto');
    expect(deco.getDecorationsForMod('modX').length).toBe(1);
  });

  it('deve comprimir chunk por paletização (1451)', () => {
    const blocks = new Uint16Array([1, 1, 2, 3, 1, 2]);
    const { palette, indices } = ChunkPaletteCompression90MB.paletteCompressChunk(blocks);
    expect(palette.length).toBe(3);
    expect(indices[0]).toBe(indices[1]);
  });

  it('deve calcular luz por profundidade de camada (1465)', () => {
    expect(GlobalLayerLightAdapter.getLightForDepth(50, 60)).toBeLessThan(1.0);
    expect(GlobalLayerLightAdapter.getLightForDepth(60, 60)).toBe(1.0);
  });

  it('deve verificar parâmetros de som na faixa audível (1466)', () => {
    expect(WebAudioSynthVerificationTest.verifySoundParametersInRange(440, 0.5)).toBe(true);
    expect(WebAudioSynthVerificationTest.verifySoundParametersInRange(10, 0.5)).toBe(false);
  });

  it('deve atenuar áudio ambiente em abrigo (1467)', () => {
    expect(ShelterAmbientAudioFilter.getAmbientGain(true, false)).toBe(0.2);
    expect(ShelterAmbientAudioFilter.getAmbientGain(false, false)).toBe(1.0);
  });

  it('deve sincronizar despawn de entidades (1480)', () => {
    const despawn = SynchronizedEntityDespawn.broadcastDespawn('zombie_1');
    expect(despawn.entityId).toBe('zombie_1');
  });

  it('deve formatar aviso de despawn (1481)', () => {
    expect(DespawnNoticeAlert.formatDespawnNotice('Zumbi')).toContain('desapareceu');
  });

  it('deve persistir itens largados entre saves (1482)', () => {
    const drop = new DroppedItemsPersistence();
    drop.addDroppedItem(5, 10, 20, 30);
    expect(drop.getDroppedCount()).toBe(1);
    expect(drop.getSaveableItems()[0].itemId).toBe(5);
  });

  it('deve determinar se draw call de entidade congelada deve ser descarregada (1514)', () => {
    expect(FrozenEntityDrawCallUnloader.shouldUnloadDrawCall(true, true)).toBe(true);
    expect(FrozenEntityDrawCallUnloader.shouldUnloadDrawCall(true, false)).toBe(false);
  });
});

describe('Batch 5 — Clima, Gelo, Baú, Voz Subterrânea & Cavernas (Itens 1488-1612 P2/P3)', () => {
  it('deve identificar blocos de neve/gelo como meteorológicos (1488)', () => {
    expect(PlayerSnowIceSaveExclusion.isWeatherBlock(78)).toBe(true);
    expect(PlayerSnowIceSaveExclusion.isWeatherBlock(1)).toBe(false);
  });

  it('deve retornar fator de escorregamento do gelo (1489)', () => {
    expect(SlipperyAndBreakableIce.getSlipFactor()).toBe(0.98);
    expect(SlipperyAndBreakableIce.shouldBreakUnderWeight(600)).toBe(true);
    expect(SlipperyAndBreakableIce.shouldBreakUnderWeight(300)).toBe(false);
  });

  it('deve unificar hora aparente do mundo (1490)', () => {
    expect(PlayerBiomeApparentTime.getUnifiedWorldTime(25000)).toBe(1000);
  });

  it('deve formatar aviso de transição de estação (1491)', () => {
    expect(SeasonTransitionNotice.formatSeasonNotice('Inverno')).toContain('Inverno');
  });

  it('deve silenciar jogadores offline preventivamente (1498)', () => {
    const m = new OfflinePlayerMuteManager();
    m.mutePlayer('player_off');
    expect(m.isMuted('player_off')).toBe(true);
    expect(m.isMuted('player_on')).toBe(false);
  });

  it('deve atenuar voz por parede (1499)', () => {
    const gainWall = WallAttenuatedVoiceFilter.getVoiceGain(true, 5);
    const gainOpen = WallAttenuatedVoiceFilter.getVoiceGain(false, 5);
    expect(gainWall).toBeLessThan(gainOpen);
  });

  it('deve mostrar overlay da hotbar no baú (1524)', () => {
    expect(ChestScreenHotbarOverlay.isHotbarOverlayVisible(true)).toBe(true);
  });

  it('deve gerar geometria de baú 3D customizado (1525)', () => {
    const mesh = CustomChest3DMesh.generateChestMeshGeometry();
    expect(mesh.lidHeight).toBe(0.8);
  });

  it('deve gerar entrada de caverna visível da superfície (1610)', () => {
    const entrance = SurfaceVisibleCaveEntrances.generateEntranceAt(100, 200, 60);
    expect(entrance.y).toBe(59);
    expect(entrance.width).toBe(3);
  });

  it('deve limitar caverna pela camada (1612)', () => {
    expect(LayerConstrainedCaveGen.getCaveMaxY('surface')).toBe(55);
    expect(LayerConstrainedCaveGen.getCaveMaxY('deep')).toBe(15);
  });
});
