// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { PermissionsModal } from '../../src/ui/PermissionsModal';
import { MCPExecutors } from '../../src/ai/MCPExecutors';

describe('Batch 18 — Testes de Permissões de Mods e Dry-Run MCP P1', () => {
  describe('PermissionsModal — Gestão e Revogação de Permissões (Item 1399 P1)', () => {
    it('deve revogar e conceder permissões de mods corretamente', () => {
      document.body.innerHTML = '';
      const mockModService = {
        getMods: () => [
          { id: 'mod-storage', name: 'Storage Mod', permissions: ['storage', 'net'] },
        ],
      } as any;

      const modal = new PermissionsModal(mockModService);
      expect(modal.isPermissionRevoked('mod-storage', 'net')).toBe(false);

      modal.revokePermission('mod-storage', 'net');
      expect(modal.isPermissionRevoked('mod-storage', 'net')).toBe(true);

      modal.grantPermission('mod-storage', 'net');
      expect(modal.isPermissionRevoked('mod-storage', 'net')).toBe(false);
    });
  });

  describe('MCPExecutors — Dry-Run de Modificação de Blocos (Item 709 P1)', () => {
    it('deve simular modificações de blocos sem alterar o mundo real', async () => {
      const mockWorld = {
        getBlock: () => 1,
        setBlock: () => {},
      } as any;

      const executors = new MCPExecutors(mockWorld, {} as any, {} as any, 'world-1');
      const res = await executors.executeTool('dry_run_simulation', {
        changes: [
          { x: 0, y: 10, z: 0, block: 'STONE' },
          { x: 0, y: 11, z: 0, block: 'AIR' },
        ],
      });

      expect(res.result).toContain('Dry-run executado com sucesso');
      expect(res.result).toContain('2 alterações simuladas');
    });
  });
});
