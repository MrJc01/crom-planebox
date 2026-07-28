import { describe, it, expect } from 'vitest';
import {
  validateFormatByKey,
  setModEnvPublicKey,
  redactSecrets,
  looksLikeSecret,
  esquemaPadrao,
} from '../../src/mods/ModEnv';
import {
  versionModEnvSchema,
  rollbackModEnvSchema,
} from '../../src/mods/ModService';
import {
  handleVisibilityChange,
  clearPressedKeys,
  createEmptyPressedKeys,
  createInitialPauseState,
  pressKey,
} from '../../src/core/PauseManager';
import { StructuredLogger } from '../../src/core/StructuredLog';

describe('Batch 5 P1 — Mod Env, Segurança, Pausa, Log Estruturado', () => {
  // ── 731 Validação de formato por chave ──
  it('731 — valida URL, token e enum com mensagens claras', () => {
    // URL válida
    expect(validateFormatByKey('https://api.openai.com', { tipo: 'url' }).valid).toBe(true);
    // URL inválida
    const urlFail = validateFormatByKey('not-a-url', { tipo: 'url' });
    expect(urlFail.valid).toBe(false);
    expect(urlFail.reason).toContain('URL');

    // Token válido
    expect(validateFormatByKey('abcdefgh', { tipo: 'token' }).valid).toBe(true);
    // Token curto
    expect(validateFormatByKey('abc', { tipo: 'token' }).valid).toBe(false);
    // Token com espaço
    expect(validateFormatByKey('abc defgh', { tipo: 'token' }).valid).toBe(false);

    // Enum válido
    const enumFormat = { tipo: 'enum' as const, valoresAceitos: ['claude', 'gpt4'] };
    expect(validateFormatByKey('claude', enumFormat).valid).toBe(true);
    expect(validateFormatByKey('gemini', enumFormat).valid).toBe(false);

    // Livre aceita tudo
    expect(validateFormatByKey('qualquer coisa', { tipo: 'livre' }).valid).toBe(true);

    // Vazio rejeita sempre
    expect(validateFormatByKey('', { tipo: 'livre' }).valid).toBe(false);
  });

  // ── 734 set_mod_env para chaves não sensíveis ──
  it('734 — permite definir chave pública e recusa chave sensível', () => {
    const esquema = esquemaPadrao();
    const valores = {};

    // AI_MOD_ROUTER não é sensível — deve funcionar
    const ok = setModEnvPublicKey(esquema, valores, 'AI_MOD_ROUTER', 'gemini-pro');
    expect(ok.refused).toBe(false);
    expect(ok.updated['AI_MOD_ROUTER']).toBe('gemini-pro');

    // AI_API_MOD_KEY é sensível — deve recusar
    const refused = setModEnvPublicKey(esquema, valores, 'AI_API_MOD_KEY', 'sk-secret');
    expect(refused.refused).toBe(true);
    expect(refused.reason).toContain('sensível');

    // Chave inexistente
    const missing = setModEnvPublicKey(esquema, valores, 'NAO_EXISTE', 'val');
    expect(missing.refused).toBe(true);
    expect(missing.reason).toContain('não existe');
  });

  // ── 737 Redação automática de segredos ──
  it('737 — mascara tokens conhecidos em texto arbitrário', () => {
    const texto = 'Erro ao chamar API com token sk-abc123456789 e header Bearer eyJhbGciOiJIUzI1NiJ9';
    const result = redactSecrets(texto);
    expect(result).not.toContain('sk-abc');
    expect(result).toContain('[REDACTED]');
    // Texto sem segredo permanece intacto
    expect(redactSecrets('tudo normal aqui')).toBe('tudo normal aqui');
  });

  // ── 752 Bloquear salvar literal com cara de segredo ──
  it('752 — detecta valores que parecem segredos e bloqueia', () => {
    expect(looksLikeSecret('sk-abcdef123456').isSecret).toBe(true);
    expect(looksLikeSecret('ghp_ABCDEFGHIJKLMNOPQrstuvwxyz1234567890').isSecret).toBe(true);
    expect(looksLikeSecret('claude-sonnet-4').isSecret).toBe(false);
    expect(looksLikeSecret('').isSecret).toBe(false);
    // String longa base64-like
    expect(looksLikeSecret('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq').isSecret).toBe(true);
  });

  // ── 738 mod.env versionado junto do mod ──
  it('738 — embute esquema de mod.env numa revisão versionada', () => {
    const esquema = esquemaPadrao();
    const versioned = versionModEnvSchema(3, esquema);
    expect(versioned.revision).toBe(3);
    expect(versioned.schema.chaves.length).toBe(esquema.chaves.length);
    expect(versioned.snapshotAt).toBeGreaterThan(0);
    // Cópia defensiva — alterar o original não afeta o versionado
    esquema.chaves.push({ nome: 'NOVA', descricao: 'test', obrigatoria: false, sensivel: false });
    expect(versioned.schema.chaves.length).toBe(2); // ainda 2, não 3
  });

  // ── 739 Rollback restaura esquema, não valores ──
  it('739 — restaura esquema de revisão e indica chaves descartadas', () => {
    const schemaAntigo = { chaves: [
      { nome: 'AI_MOD_ROUTER', descricao: 'Router', obrigatoria: false, sensivel: false },
    ]};
    const versioned = versionModEnvSchema(1, schemaAntigo);
    const valoresAtuais = { AI_MOD_ROUTER: 'claude', NOVA_CHAVE: 'valor' };

    const result = rollbackModEnvSchema(versioned, valoresAtuais);
    expect(result.restoredSchema.chaves.length).toBe(1);
    expect(result.droppedKeys).toContain('NOVA_CHAVE');
    expect(result.keptKeys).toContain('AI_MOD_ROUTER');
  });

  // ── 1056 Sair do lock por troca de aba deve pausar ──
  it('1056 — troca de aba pausa o jogo e retorna ao voltar', () => {
    const pause = createInitialPauseState();
    let keys = createEmptyPressedKeys();
    keys = pressKey(keys, 'KeyW');

    // Aba ficou oculta: deve pausar e limpar teclas
    const hidden = handleVisibilityChange(true, pause, keys);
    expect(hidden.pause.paused).toBe(true);
    expect(hidden.pause.reason).toBe('visibility');
    expect(hidden.keys.keys.size).toBe(0);

    // Aba voltou: deve retomar
    const visible = handleVisibilityChange(false, hidden.pause, hidden.keys);
    expect(visible.pause.paused).toBe(false);
  });

  // ── 1057 Zerar teclas pressionadas ao perder foco ──
  it('1057 — limpa todas as teclas e botões ao perder foco', () => {
    let state = createEmptyPressedKeys();
    state = pressKey(state, 'KeyW');
    state = pressKey(state, 'Space');
    expect(state.keys.size).toBe(2);

    const cleared = clearPressedKeys(state);
    expect(cleared.keys.size).toBe(0);
    expect(cleared.mouseButtons.size).toBe(0);
  });

  // ── 1056 (complemento) Em multiplayer, não pausa simulação ──
  it('1056 — em multiplayer limpa teclas mas não pausa', () => {
    const pause = createInitialPauseState();
    const keys = pressKey(createEmptyPressedKeys(), 'KeyW');

    const result = handleVisibilityChange(true, pause, keys, true);
    expect(result.pause.paused).toBe(false); // não pausou
    expect(result.keys.keys.size).toBe(0);   // mas limpou teclas
  });

  // ── 1576 Log estruturado ──
  it('1576 — logger estruturado registra entradas com nível e subsistema', () => {
    let tick = 1000000;
    const log = new StructuredLogger('UndoManager', 5, () => tick++);

    log.debug('iniciando');
    log.info('Desfeito lote', { count: 5 });
    log.warn('Orçamento baixo', { remaining: 10 });
    log.error('Falha ao salvar');

    expect(log.count).toBe(4);

    const infos = log.getByLevel('info');
    expect(infos.length).toBe(1);
    expect(infos[0].subsystem).toBe('UndoManager');
    expect(infos[0].message).toBe('Desfeito lote');
    expect(infos[0].data).toEqual({ count: 5 });
    expect(infos[0].timestamp).toBeDefined();

    // Respeita maxEntries
    log.info('extra1');
    log.info('extra2');
    expect(log.count).toBe(5); // cap em 5

    // Clear funciona
    log.clear();
    expect(log.count).toBe(0);
  });
});
