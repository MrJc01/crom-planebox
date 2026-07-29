// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { EntitySystem } from '../../src/entities/EntitySystem';
import { CommandSystem } from '../../src/commands/CommandSystem';

describe('Batch 24 — Testes de Som de Entidades e Comandos Expandidos P1', () => {
  describe('EntitySystem — Som Posicional de Entidades (Item 1560 P1)', () => {
    it('deve disparar som posicional 3D para entidades ativas no mundo', () => {
      const mockWorld = { getBlock: () => 0 } as any;
      const mockScene = { add: () => {}, remove: () => {} } as any;
      const system = new EntitySystem(mockWorld, mockScene);

      const entity = system.spawnEntity('human', 'Guarda', 0, 10, 0);
      expect(system.playEntitySound(entity.id, 'pasos')).toBe(true);
      expect(system.playEntitySound('inexistente', 'pasos')).toBe(false);
    });
  });

  describe('CommandSystem — Novos Comandos de Barra (Item 1557 P1)', () => {
    it('deve autocompletar os novos comandos /time, /spawn e /clear', () => {
      expect(CommandSystem.autocomplete('/t')).toContain('/time');
      expect(CommandSystem.autocomplete('/sp')).toContain('/spawn');
      expect(CommandSystem.autocomplete('/cl')).toContain('/clear');
    });
  });
});
