// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { ModService } from '../../src/mods/ModService';
import { UIManager } from '../../src/ui/UIManager';

describe('Batch 13 — Testes de Vínculo de Chat, Editor e Memória de Abas P1', () => {
  describe('Vínculo de Sessão de Chat ao Mod (Item 848 P1)', () => {
    let modService: ModService;

    beforeEach(() => {
      modService = new ModService();
      const mockMod = {
        id: 'mod-123',
        name: 'Mod Origem',
        blocks: [],
        scripts: [],
      } as any;
      (modService as any).mods = [mockMod];
    });

    it('setActiveSession deve definir originThreadId no ModPackage quando ainda ausente', () => {
      modService.setActiveSession('thread-abc-456', 'mod-123');
      const mod = modService.getMod('mod-123');

      expect(mod?.originThreadId).toBe('thread-abc-456');
    });

    it('setActiveSession não deve sobrescrever originThreadId já existente', () => {
      const mod = modService.getMod('mod-123');
      if (mod) mod.originThreadId = 'thread-original';

      modService.setActiveSession('thread-nova', 'mod-123');
      expect(mod?.originThreadId).toBe('thread-original');
    });
  });

  describe('UIManager — Memória da Última Aba por Tela (Item 1155 P1)', () => {
    it('deve salvar e consultar a última aba aberta por tela', () => {
      const ui = new UIManager();
      expect(ui.getLastActiveTab('inventory')).toBeUndefined();

      ui.saveActiveTab('inventory', 'crafting');
      expect(ui.getLastActiveTab('inventory')).toBe('crafting');

      ui.saveActiveTab('options', 'audio');
      expect(ui.getLastActiveTab('options')).toBe('audio');
      expect(ui.getLastActiveTab('inventory')).toBe('crafting');
    });
  });
});
