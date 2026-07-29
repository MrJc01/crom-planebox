// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { MultiplayerChangeHistory } from '../../src/net/PeerSync';
import {
  ModStableRevisionMark,
  ModExportDiff,
  ModImportNewSession,
  SessionConversationExporter,
  LegacyModMigrator,
  RevisionRestorationVerifier,
  ModQuarantineSandbox,
  ModDestructiveOperationConfirm,
  SessionAuditExporter,
  AutoSplitModSuggestion,
  SessionTopicShiftDetector,
  LongSessionSummarizer,
  FreeSessionWriteBlock,
  ModAuthFailureNotifier,
  ModSecretIsolation,
  VaultReferenceSuggester,
  ModEnvExampleGenerator,
  SchemaDiffDetector,
  SchemaMigrationCheck,
  ExportSecretsSanitizer,
  SampleWeatherCityMod,
  SampleVoiceCommandMod,
  CustomLLMCapability,
} from '../../src/mods/ModAPI';
import {
  AgentMessageCitation,
  ReducedPrecisionGeolocation,
  WeatherIntegrationCapability,
} from '../../src/player/interaction';
import { AgentBiomeMapQuery } from '../../src/world/biomes';
import {
  StructureMapMarker,
  ProceduralStructureVariation,
  PreSpawneEntitiesStructure,
  LocateNearestStructure,
  StructureScatterDeterminismTest,
  StructureNoOverlapVerifier,
} from '../../src/world/scatter';
import {
  EnvironmentProfileManager,
  ProviderConnectionTester,
  VaultKeyRotation,
  VaultExportImport,
  EncryptedVault,
  VaultClearAll,
  EnvFallbackInheritance,
  EnvCommentPreserver,
  SecretResolutionTest,
} from '../../src/storage/Database';
import {
  MicrophoneCaptureIndicator,
  VoicePlaybackGenerator,
} from '../../src/audio/AudioSystem';

describe('Batch A — Rede & Multiplayer (Itens 617, 618, 619, 660 P2)', () => {
  it('deve registrar e recuperar histórico de alterações do multiplayer', () => {
    const history = new MultiplayerChangeHistory();
    history.logChange('peer_1', 'Steve', 'placeBlock');
    expect(history.getHistory().length).toBe(1);
    expect(history.getHistory()[0].peerName).toBe('Steve');
  });
});

describe('Batch B — Gestão de Mods, Revisões & Quarentena (Itens 657-664, 711-720 P2)', () => {
  it('deve marcar revisão como estável e verificar', () => {
    const marks = new ModStableRevisionMark();
    marks.markStable(5);
    expect(marks.isStable(5)).toBe(true);
    expect(marks.isStable(6)).toBe(false);
  });

  it('deve computar diff entre código atual e exportado', () => {
    const diff = ModExportDiff.computeDiff('a\nb\nc', 'a\nb');
    expect(diff.isDifferent).toBe(true);
    expect(diff.addedLines).toBe(1);
  });

  it('deve importar mod vinculando a sessão nova', () => {
    const result = ModImportNewSession.importAndLinkSession('modX');
    expect(result.modId).toBe('modX');
    expect(result.newSessionId).toContain('sess_modX');
  });

  it('deve exportar conversa da sessão como JSON', () => {
    const json = SessionConversationExporter.exportConversation([{ role: 'user', text: 'oi' }]);
    expect(json).toContain('oi');
  });

  it('deve migrar mod legado sem revision nem originThreadId', () => {
    const migrated = LegacyModMigrator.migrateLegacyMod({ id: 'old', code: 'x' });
    expect(migrated.revision).toBe(1);
    expect(migrated.originThreadId).toBe('legacy_thread');
  });

  it('deve verificar que revisão restaurada tem mesma seed', () => {
    expect(RevisionRestorationVerifier.verifyRestorationHash(42, 42)).toBe(true);
    expect(RevisionRestorationVerifier.verifyRestorationHash(42, 43)).toBe(false);
  });

  it('deve bloquear escrita em mod em quarentena', () => {
    const sandbox = new ModQuarantineSandbox();
    expect(sandbox.canWriteWorld()).toBe(true);
    sandbox.isQuarantined = true;
    expect(sandbox.canWriteWorld()).toBe(false);
  });

  it('deve processar confirmação de operação destrutiva', () => {
    expect(ModDestructiveOperationConfirm.requireConfirmation('delete', true)).toBe(true);
    expect(ModDestructiveOperationConfirm.requireConfirmation('delete', false)).toBe(false);
  });

  it('deve exportar log de auditoria', () => {
    const json = SessionAuditExporter.exportAuditLog([{ action: 'edit', timestamp: 123 }]);
    expect(json).toContain('edit');
  });

  it('deve sugerir divisão de sessão para mod grande', () => {
    expect(AutoSplitModSuggestion.shouldSuggestSplit(600)).toBe(true);
    expect(AutoSplitModSuggestion.shouldSuggestSplit(200)).toBe(false);
  });

  it('deve detectar mudança de assunto na conversa', () => {
    expect(SessionTopicShiftDetector.detectTopicShift(['bloco', 'terreno'], 'como funciona o áudio?')).toBe(true);
    expect(SessionTopicShiftDetector.detectTopicShift(['bloco', 'terreno'], 'coloque um bloco')).toBe(false);
  });

  it('deve resumir sessão longa preservando decisões', () => {
    const res = LongSessionSummarizer.summarizeSession(['msg1', 'msg2', 'msg3']);
    expect(res.preservedDecisions).toBe(3);
    expect(res.summary).toContain('3');
  });

  it('deve bloquear ferramentas de escrita em sessão livre', () => {
    expect(FreeSessionWriteBlock.canExecuteWriteTool(true, 'setBlock')).toBe(false);
    expect(FreeSessionWriteBlock.canExecuteWriteTool(false, 'setBlock')).toBe(true);
  });

  it('deve citar mensagem que originou alteração', () => {
    const citation = AgentMessageCitation.formatCitation('Adicionou bloco', 'msg_42');
    expect(citation).toContain('Ref: #msg_42');
  });
});

describe('Batch C — Estruturas Procedurais & Mapa de Biomas (Itens 680, 694-700 P2)', () => {
  it('deve consultar bioma pelo agente antes de construir', () => {
    const res = AgentBiomeMapQuery.queryBiomeAt(100, 200, () => 'floresta');
    expect(res.biome).toBe('floresta');
  });

  it('deve marcar estruturas encontradas no mapa', () => {
    const marker = new StructureMapMarker();
    marker.markFound({ id: 'dungeon_1', name: 'Masmorra', x: 50, z: 80 });
    expect(marker.getDiscovered().length).toBe(1);
  });

  it('deve gerar variação procedural única por seed', () => {
    const v1 = ProceduralStructureVariation.generateVariation('house', 1);
    const v2 = ProceduralStructureVariation.generateVariation('house', 2);
    expect(v1.width).toBeGreaterThanOrEqual(4);
    expect(v1.width === v2.width && v1.height === v2.height).toBe(false);
  });

  it('deve retornar entidades pré-posicionadas para dungeons', () => {
    const entities = PreSpawneEntitiesStructure.getEntitiesForStructure('dungeon');
    expect(entities.length).toBe(2);
    expect(entities[0].entityType).toBe('zombie');
  });

  it('deve localizar estrutura mais próxima do jogador', () => {
    const nearest = LocateNearestStructure.findNearest(0, 0, [
      { name: 'Torre', x: 100, z: 0 },
      { name: 'Vila', x: 10, z: 10 },
    ]);
    expect(nearest?.name).toBe('Vila');
  });

  it('deve verificar determinismo do espalhamento por semente', () => {
    expect(StructureScatterDeterminismTest.verifyDeterminism(42)).toBe(true);
  });

  it('deve verificar que nenhuma estrutura nasce dentro de outra', () => {
    const noOverlap = StructureNoOverlapVerifier.checkNoOverlap([
      { minX: 0, maxX: 5, minZ: 0, maxZ: 5 },
      { minX: 10, maxX: 15, minZ: 10, maxZ: 15 },
    ]);
    expect(noOverlap).toBe(true);

    const hasOverlap = StructureNoOverlapVerifier.checkNoOverlap([
      { minX: 0, maxX: 5, minZ: 0, maxZ: 5 },
      { minX: 3, maxX: 8, minZ: 3, maxZ: 8 },
    ]);
    expect(hasOverlap).toBe(false);
  });
});

describe('Batch D — Cofre de Segredos & Variáveis de Ambiente (Itens 742-760 P2)', () => {
  it('deve gerenciar perfis de ambiente dev/prod', () => {
    const env = new EnvironmentProfileManager();
    expect(env.profile).toBe('dev');
    env.setProfile('prod');
    expect(env.profile).toBe('prod');
  });

  it('deve testar conexão com provedor', async () => {
    expect(await ProviderConnectionTester.testConnection('sk-12345678')).toBe(true);
    expect(await ProviderConnectionTester.testConnection('abc')).toBe(false);
  });

  it('deve notificar falha de autenticação atribuída ao mod', () => {
    const n = ModAuthFailureNotifier.notifyAuthFailure('modX', 'token expirado');
    expect(n.message).toContain('modX');
  });

  it('deve isolar segredos entre mods por escopo declarado', () => {
    const iso = new ModSecretIsolation();
    iso.declareScope('modA', ['API_KEY']);
    expect(iso.canAccessSecret('modA', 'API_KEY')).toBe(true);
    expect(iso.canAccessSecret('modA', 'OTHER')).toBe(false);
    expect(iso.canAccessSecret('modB', 'API_KEY')).toBe(false);
  });

  it('deve rotacionar chaves do cofre sem reeditar mods', () => {
    const vault = new VaultKeyRotation();
    vault.setKey('API_KEY', 'old_value');
    vault.rotateKey('API_KEY', 'new_value');
    expect(vault.getKey('API_KEY')).toBe('new_value');
  });

  it('deve exportar e importar cofre separadamente', () => {
    const json = VaultExportImport.exportVault({ API_KEY: 'xxx' });
    const imported = VaultExportImport.importVault(json);
    expect(imported?.API_KEY).toBe('xxx');
  });

  it('deve cifrar e decifrar dados do cofre', () => {
    const enc = EncryptedVault.encrypt('meu_segredo', 'minha_senha');
    const dec = EncryptedVault.decrypt(enc, 'minha_senha');
    expect(dec).toBe('meu_segredo');
  });

  it('deve limpar todas as chaves de uma vez', () => {
    const vault = new VaultClearAll();
    vault.set('a', '1');
    vault.set('b', '2');
    expect(vault.size()).toBe(2);
    vault.clearAll();
    expect(vault.size()).toBe(0);
  });

  it('deve detectar literal hardcoded suspeito no código', () => {
    const matches = VaultReferenceSuggester.detectHardcodedSecret('"sk-abcdefghijklmnopqrstuvwxyz12345"');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('deve resolver herança com fallback', () => {
    expect(EnvFallbackInheritance.resolveVar({}, '$API_KEY:-default_key')).toBe('default_key');
    expect(EnvFallbackInheritance.resolveVar({ API_KEY: 'real' }, '$API_KEY:-default_key')).toBe('real');
  });

  it('deve preservar comentários ao parsear arquivo env', () => {
    const parsed = EnvCommentPreserver.parseWithComments('# Comentário\nAPI_KEY=xxx');
    expect(parsed[0].comment).toBe('# Comentário');
    expect(parsed[1].key).toBe('API_KEY');
  });

  it('deve gerar mod.env.example para export', () => {
    const example = ModEnvExampleGenerator.generateExampleFile(['API_KEY', 'SECRET']);
    expect(example).toContain('API_KEY=sua_chave_aqui');
  });

  it('deve detectar diff de esquema entre revisões', () => {
    const diff = SchemaDiffDetector.detectSchemaChanges(['KEY_A'], ['KEY_A', 'KEY_B']);
    expect(diff.added).toEqual(['KEY_B']);
    expect(diff.removed).toEqual([]);
  });

  it('deve verificar chaves obrigatórias faltantes na migração', () => {
    const missing = SchemaMigrationCheck.checkMissingRequiredKeys(['A', 'B'], { A: '1' });
    expect(missing).toEqual(['B']);
  });

  it('deve sanitizar payload removendo segredos no export', () => {
    const sanitized = ExportSecretsSanitizer.sanitizeExportData({ name: 'mod', apiKey: 'xxx', data: 1 });
    expect(sanitized.apiKey).toBeUndefined();
    expect(sanitized.name).toBe('mod');
  });

  it('deve resolver segredo com fallback', () => {
    expect(SecretResolutionTest.resolveSecret(undefined)).toBe('default_secret');
    expect(SecretResolutionTest.resolveSecret('real')).toBe('real');
  });
});

describe('Batch E — Áudio, Voz, Clima & Integrações AI (Itens 782-788 P2)', () => {
  it('deve controlar indicador de gravação de microfone', () => {
    const mic = new MicrophoneCaptureIndicator();
    expect(mic.isRecording).toBe(false);
    mic.startRecording();
    expect(mic.isRecording).toBe(true);
    mic.stopRecording();
    expect(mic.isRecording).toBe(false);
  });

  it('deve gerar buffer de fala com duração proporcional ao texto', () => {
    const buf = VoicePlaybackGenerator.generateSpeechBuffer('Olá mundo');
    expect(buf.durationSec).toBeGreaterThan(0);
    expect(buf.sampleRate).toBe(44100);
  });

  it('deve reduzir precisão de geolocalização para nível de cidade', () => {
    const loc = ReducedPrecisionGeolocation.reduceToCity(-23.5505, -46.6333);
    expect(loc.precision).toBe('city');
    expect(loc.lat).toBe(-23.6);
  });

  it('deve consultar clima baseado em coordenadas', () => {
    const w = WeatherIntegrationCapability.getWeatherForCoords(0, 0);
    expect(typeof w.condition).toBe('string');
    expect(typeof w.tempC).toBe('number');
  });

  it('deve reagir ao clima real no mod de exemplo de cidade', () => {
    const rain = SampleWeatherCityMod.updateCityWeatherEffect('Chuva');
    expect(rain.rainDensity).toBe(1.0);
    const sun = SampleWeatherCityMod.updateCityWeatherEffect('Sol');
    expect(sun.rainDensity).toBe(0);
  });

  it('deve parsear comandos de voz mapeados para ferramentas do jogo', () => {
    expect(SampleVoiceCommandMod.parseVoiceCommand('Quero minerar essa pedra')).toBe('breakBlock');
    expect(SampleVoiceCommandMod.parseVoiceCommand('Construir parede')).toBe('placeBlock');
    expect(SampleVoiceCommandMod.parseVoiceCommand('Olá')).toBeNull();
  });

  it('deve resolver endpoint de LLM customizado para o mod', () => {
    expect(CustomLLMCapability.resolveModelEndpoint('gpt-4o')).toBe('gpt-4o');
    expect(CustomLLMCapability.resolveModelEndpoint()).toBe('default_agent_model');
  });
});
