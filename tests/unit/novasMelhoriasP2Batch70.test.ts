// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  ModPermissionSandbox,
  ModSignatureVerifier,
  ModReversionSystem,
} from '../../src/mods/ModAPI';
import {
  AIToolRateLimiter,
  AIAuditLogger,
  AIReadOnlyMode,
} from '../../src/player/interaction';

describe('Batch 70 — Testes de Sandbox de Permissões, Assinatura de Mods, Reversão em Massa, Rate Limit, Log de Auditoria e Somente Leitura P2', () => {
  describe('ModAPI — Sandbox de Permissões (Item 365 P2)', () => {
    it('deve verificar permissões concedidas a mods', () => {
      const sandbox = new ModPermissionSandbox();
      expect(sandbox.hasPermission('world_write')).toBe(false);

      sandbox.grant('world_write');
      expect(sandbox.hasPermission('world_write')).toBe(true);
    });
  });

  describe('ModAPI — Verificação de Assinatura de Mod (Item 366 P2)', () => {
    it('deve validar assinatura de mod', () => {
      const content = 'console.log("mod");';
      const sig = `sig_${content.length}`;
      expect(ModSignatureVerifier.verifySignature(content, sig, 'pub_key')).toBe(true);
      expect(ModSignatureVerifier.verifySignature(content, 'invalid_sig', 'pub_key')).toBe(false);
    });
  });

  describe('ModAPI — Reversão em Massa por Mod (Item 370 P2)', () => {
    it('deve desfazer todas as alterações de um mod específico', () => {
      const rev = new ModReversionSystem();
      rev.recordChange({ modId: 'modA', x: 0, y: 64, z: 0, previousBlock: 1, newBlock: 2 });
      rev.recordChange({ modId: 'modB', x: 1, y: 64, z: 0, previousBlock: 1, newBlock: 3 });

      const reverted = rev.revertModChanges('modA');
      expect(reverted.length).toBe(1);
      expect(reverted[0].modId).toBe('modA');
      expect(reverted[0].previousBlock).toBe(1);
    });
  });

  describe('interaction — Rate Limit da IA (Item 368 P2)', () => {
    it('deve limitar chamadas que excedam o limite por minuto', () => {
      const limiter = new AIToolRateLimiter(2);
      expect(limiter.allowCall(1000)).toBe(true);
      expect(limiter.allowCall(2000)).toBe(true);
      expect(limiter.allowCall(3000)).toBe(false); // Excedeu limite de 2
    });
  });

  describe('interaction — Log de Auditoria da IA (Item 369 P2)', () => {
    it('deve registrar histórico de ferramentas executadas pela IA', () => {
      const logger = new AIAuditLogger();
      logger.logAction('placeBlock', { x: 10, y: 64, z: 10, block: 2 });
      expect(logger.getLogs().length).toBe(1);
      expect(logger.getLogs()[0].tool).toBe('placeBlock');
    });
  });

  describe('interaction — Modo Somente Leitura da IA (Item 375 P2)', () => {
    it('deve bloquear ferramentas de escrita quando em somente leitura', () => {
      const ro = new AIReadOnlyMode();
      expect(ro.canExecuteTool('placeBlock')).toBe(true);

      ro.isReadOnly = true;
      expect(ro.canExecuteTool('placeBlock')).toBe(false);
      expect(ro.canExecuteTool('queryWorld')).toBe(true);
    });
  });
});
