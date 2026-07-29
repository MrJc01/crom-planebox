// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  ModSessionMetadata,
  ModSessionArchiver,
  ModSessionDeletionDialog,
  ModMergerTool,
  ModSplitterTool,
  ModDependencyResolver,
  ModConflictDetector,
} from '../../src/mods/ModAPI';

describe('Batch 79 — Gestão de Sessões de Mod, Mesclagem, Divisão, Dependências e Conflitos P2', () => {
  describe('ModAPI — Metadados & Arquivamento de Sessão (Itens 650, 651, 652 P2)', () => {
    it('deve gerar título e descrição da sessão com base no mod', () => {
      const info = ModSessionMetadata.generateSessionInfo('Mod Magia', 'Feitiços');
      expect(info.title).toContain('Mod Magia');
      expect(info.description).toContain('Feitiços');
    });

    it('deve arquivar sessão mantendo o mod intacto', () => {
      const archiver = new ModSessionArchiver();
      expect(archiver.isArchived('sess_1')).toBe(false);

      archiver.archiveSession('sess_1');
      expect(archiver.isArchived('sess_1')).toBe(true);
    });

    it('deve processar opções de exclusão da sessão e do mod', () => {
      const res1 = ModSessionDeletionDialog.processDeletion('sess_1', false);
      expect(res1.sessionDeleted).toBe(true);
      expect(res1.modDeleted).toBe(false);

      const res2 = ModSessionDeletionDialog.processDeletion('sess_1', true);
      expect(res2.modDeleted).toBe(true);
    });
  });

  describe('ModAPI — Ferramentas de Mod (Mesclar, Dividir, Dependências, Conflitos) (Itens 653, 654, 655, 656 P2)', () => {
    it('deve mesclar dois mods num novo mod combinado', () => {
      const modA = { id: 'modA', code: 'let a = 1;' };
      const modB = { id: 'modB', code: 'let b = 2;' };

      const merged = ModMergerTool.mergeMods(modA, modB);
      expect(merged.newModId).toBe('modA_modB_merged');
      expect(merged.combinedCode).toContain('let a = 1;');
      expect(merged.combinedCode).toContain('let b = 2;');
    });

    it('deve dividir um mod em duas partes', () => {
      const parts = ModSplitterTool.splitMod('bigMod', '1234567890');
      expect(parts.length).toBe(2);
      expect(parts[0].id).toBe('bigMod_part1');
      expect(parts[1].id).toBe('bigMod_part2');
    });

    it('deve resolver ordem de carregamento por dependências declaradas', () => {
      const mods = [
        { id: 'modC', dependencies: ['modB'] },
        { id: 'modB', dependencies: ['modA'] },
        { id: 'modA', dependencies: [] },
      ];

      const order = ModDependencyResolver.resolveLoadOrder(mods);
      expect(order).toEqual(['modA', 'modB', 'modC']);
    });

    it('deve detectar conflitos de edições entre mods', () => {
      const modA = ['block_12', 'block_15', 'block_20'];
      const modB = ['block_15', 'block_99'];

      const conflicts = ModConflictDetector.detectConflicts(modA, modB);
      expect(conflicts).toEqual(['block_15']);
    });
  });
});
