import { describe, it, expect } from 'vitest';
import { readModPackageReadOnly, inspectProjectStructure } from '../../src/mods/ModRegistry';
import {
  unquarantineMod,
  formatQuarantineDiagnosis,
  checkSessionEditBudget,
  recordSessionHistoryEntry,
  checkModRateLimit,
} from '../../src/mods/ModService';
import { emptyModPackage } from '../../src/mods/ModTypes';
import {
  executeWithTimeoutAndBackoff,
  sanitizeExternalApiResponse,
  CachedApiResponseManager,
} from '../../src/net/wire';
import {
  setWorldScatterDensity,
  getWorldScatterDensity,
  convertScatterToSavedBlocks,
} from '../../src/world/scatter';

describe('Suíte de Testes Batch 4 P1 — Inspeção de Mods, Segurança, Resiliência e Espalhamento', () => {

  // ── 706 read_mod modo somente leitura ──
  it('706 — retorna objeto congelado do pacote do mod', () => {
    const mod = emptyModPackage('mod-1', 'Mod Teste', 'Descrição');
    const readOnlyMod = readModPackageReadOnly(mod);
    expect(readOnlyMod.id).toBe('mod-1');
    expect(Object.isFrozen(readOnlyMod)).toBe(true);
  });

  // ── 707 Ferramenta de inspeção da estrutura do projeto ──
  it('707 — resume a estrutura do projeto e mods para o agente', () => {
    const mods = [
      { ...emptyModPackage('m1', 'Mod 1', ''), enabled: true },
      { ...emptyModPackage('m2', 'Mod 2', ''), enabled: false },
    ];
    const info = inspectProjectStructure(mods);
    expect(info.totalMods).toBe(2);
    expect(info.activeModIds).toContain('m1');
    expect(info.activeModIds).not.toContain('m2');
  });

  // ── 648 Tirar da quarentena manualmente ──
  it('648 — retira mod da quarentena limpando o motivo', () => {
    const quarantined = {
      ...emptyModPackage('m1', 'Mod', ''),
      quarantined: true,
      quarantineReason: 'Erro de sintaxe',
    };

    const res = unquarantineMod(quarantined);
    expect(res.unquarantined).toBe(true);
    expect(res.mod.quarantined).toBe(false);
    expect(res.mod.quarantineReason).toBeUndefined();
  });

  // ── 649 Diagnóstico legível de quarentena ──
  it('649 — fornece diagnóstico amigável para motivo de quarentena', () => {
    const diagSyntax = formatQuarantineDiagnosis('SyntaxError: unexpected token');
    expect(diagSyntax.title).toContain('Sintaxe');

    const diagColor = formatQuarantineDiagnosis('Contrast conflict with block');
    expect(diagColor.title).toContain('Cores');
  });

  // ── 708 Orçamento de edições por sessão ──
  it('708 — alerta quando orçamento de edições da sessão é excedido', () => {
    const ok = checkSessionEditBudget(100, 500);
    expect(ok.exceeded).toBe(false);
    expect(ok.remaining).toBe(400);

    const exceeded = checkSessionEditBudget(550, 500);
    expect(exceeded.exceeded).toBe(true);
    expect(exceeded.warning).toContain('estourado');
  });

  // ── 710 Entrada no histórico de sessão ──
  it('710 — registra ferramentas de escrita no histórico da sessão', () => {
    const history = recordSessionHistoryEntry([], 'set_block', 'b1', 'Bloco colocado em (1,2,3)');
    expect(history.length).toBe(1);
    expect(history[0].toolName).toBe('set_block');
  });

  // ── 771 Rate limit por mod ──
  it('771 — bloqueia chamadas que excedem limite por minuto', () => {
    const now = Date.now();
    const calls = Array.from({ length: 60 }, (_, i) => now - i * 500); // 60 chamadas recentes
    const res = checkModRateLimit(calls, 60, now);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterMs).toBeGreaterThan(0);
  });

  // ── 772 Timeout e retry com backoff ──
  it('772 — executa tarefa assíncrona com sucesso e retry em falhas temporárias', async () => {
    let attempts = 0;
    const task = async () => {
      attempts++;
      if (attempts < 2) throw new Error('Falha temporária');
      return 'sucesso';
    };

    const res = await executeWithTimeoutAndBackoff(task, 3, 2000);
    expect(res).toBe('sucesso');
    expect(attempts).toBe(2);
  });

  // ── 777 Sanitização de resposta externa ──
  it('777 — remove tags de script e HTML de respostas de APIs externas', () => {
    const dirty = '<script>alert(1)</script><h1>Olá</h1> Mundo<a href="javascript:void(0)">link</a>';
    const clean = sanitizeExternalApiResponse(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('<h1>');
    expect(clean).toContain('Olá Mundo');
  });

  // ── 781 Cache de resposta por mod ──
  it('781 — armazena e expira respostas em cache por mod', () => {
    const cache = new CachedApiResponseManager();
    cache.set('mod1', 'data', { foo: 'bar' }, 5000);

    expect(cache.get('mod1', 'data')).toEqual({ foo: 'bar' });
    expect(cache.get('mod2', 'data')).toBeNull();

    cache.clearModCache('mod1');
    expect(cache.get('mod1', 'data')).toBeNull();
  });

  // ── 692 Densidade de espalhamento configurável ──
  it('692 — permite ajustar a densidade global de espalhamento', () => {
    setWorldScatterDensity(2.5);
    expect(getWorldScatterDensity()).toBe(2.5);
    setWorldScatterDensity(1.0); // restaura
  });

  // ── 693 Conversão de espalhamento em blocos salvos ──
  it('693 — converte posicionamentos de espalhamento em registros salváveis', () => {
    const placements = [{ x: 10.4, y: 12.8, z: 15.1, blockType: 5 }];
    const saved = convertScatterToSavedBlocks(placements);
    expect(saved[0].x).toBe(10);
    expect(saved[0].y).toBe(12);
    expect(saved[0].blockType).toBe(5);
  });
});
