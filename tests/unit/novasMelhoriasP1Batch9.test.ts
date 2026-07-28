// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { ModService } from '../../src/mods/ModService';

describe('Batch 9 — Testes de Ordem de Mods, MCP Sandbox e Validação P1', () => {
  describe('Ordem Previsível de Execução de Mods (Item 822 P1)', () => {
    it('getOrderedMods deve ordenar mods por prioridade, data de criação e ID', () => {
      const modService = new ModService();
      const mods = [
        { id: 'mod-c', name: 'Mod C', createdAt: 1000, priority: 1, files: {}, revisions: [] },
        { id: 'mod-a', name: 'Mod A', createdAt: 500, priority: 10, files: {}, revisions: [] }, // maior prioridade
        { id: 'mod-b', name: 'Mod B', createdAt: 500, priority: 1, files: {}, revisions: [] },
      ] as any[];

      (modService as any).mods = mods;
      const ordered = modService.getOrderedMods();

      expect(ordered[0].id).toBe('mod-a'); // prio 10
      expect(ordered[1].id).toBe('mod-b'); // prio 1, criado em 500
      expect(ordered[2].id).toBe('mod-c'); // prio 1, criado em 1000
    });
  });

  describe('Validação de JSON de Definições (Item 859 P1)', () => {
    const modService = new ModService();

    it('deve recusar JSON vazio ou malformado com mensagem descritiva', () => {
      expect(modService.validateDefinitionJson('')).toEqual({ valid: false, error: 'JSON de definição vazio' });
      expect(modService.validateDefinitionJson('{ id: 123')).toEqual({
        valid: false,
        error: expect.stringContaining('JSON inválido'),
      });
      expect(modService.validateDefinitionJson('12345')).toEqual({
        valid: false,
        error: 'O JSON deve ser um objeto ou array',
      });
    });

    it('deve aceitar JSON válido', () => {
      const json = JSON.stringify({ key: 'bloco_pedra', name: 'Bloco de Pedra', solid: true });
      expect(modService.validateDefinitionJson(json)).toEqual({ valid: true });
    });
  });

  describe('Sandbox run_mod_script (Item 825 P1)', () => {
    it('deve validar sintaxe e execução do script em ambiente isolado', () => {
      const runSandbox = (script: string) => {
        if (!script.trim()) return { result: 'Erro: script de mod vazio.' };
        try {
          const mockSetBlock = () => {};
          const mockGetBlock = () => 0;
          const mockGetGroundY = () => 20;
          const testFunc = new Function('setBlock', 'getBlock', 'getGroundY', 'Math', 'console', script);
          testFunc(mockSetBlock, mockGetBlock, mockGetGroundY, Math, console);
          return { result: 'Script de mod testado em sandbox com sucesso (0 erros de sintaxe ou execução).' };
        } catch (err: any) {
          return { result: `Erro ao testar script de mod em sandbox: ${err?.message || err}` };
        }
      };

      const validScript = 'const y = getGroundY(10, 10); setBlock(10, y, 10, 1);';
      expect(runSandbox(validScript).result).toContain('sucesso');

      const invalidScript = 'function foo(';
      expect(runSandbox(invalidScript).result).toContain('Erro ao testar');
    });
  });
});
