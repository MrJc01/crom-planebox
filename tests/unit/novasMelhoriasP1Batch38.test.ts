// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { formatModError, getModAPIAutocompleteDefs } from '../../src/mods/ModAPI';
import { getEndgameObjectives } from '../../src/crafting/StructureTemplates';
import { B } from '../../src/world/blocks';

describe('Batch 38 — Testes de Relatório de Erro em Mods, Autocomplete e Segunda Volta de Progressão P1', () => {
  describe('ModAPI — Relatório de Erros e Autocomplete (Itens 855, 856 P1)', () => {
    it('deve extrair linha e coluna de stack de erros de mods', () => {
      const dummyErr = new Error('Erro de teste');
      dummyErr.stack = 'Error: Erro de teste\n at eval (eval at executeScript (script.js:42:15), <anonymous>:10:25)';

      const formatted = formatModError(dummyErr);
      expect(formatted.message).toBe('Erro de teste');
      expect(formatted.line).toBe(42);
      expect(formatted.column).toBe(15);
    });

    it('deve retornar definições em TypeScript para autocomplete da API do mod', () => {
      const defs = getModAPIAutocompleteDefs();
      expect(defs).toContain('declare namespace voxels');
      expect(defs).toContain('setBlock');
      expect(defs).toContain('getBlock');
    });
  });

  describe('StructureTemplates — Segunda Volta no Loop de Progressão (Item 1307 P1)', () => {
    it('deve retornar objetivos de endgame pós-obsidiana', () => {
      const objectives = getEndgameObjectives();
      expect(objectives.length).toBeGreaterThan(0);
      expect(objectives.some((o) => o.requiredMaterial === B.OBSIDIAN)).toBe(true);
      expect(objectives.some((o) => o.requiredMaterial === B.ENERGY_ORE)).toBe(true);
    });
  });
});
