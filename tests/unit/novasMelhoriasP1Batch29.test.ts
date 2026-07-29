// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { Interaction } from '../../src/player/interaction';
import { saveStructureAsTemplate } from '../../src/crafting/StructureTemplates';
import { setupBeforeUnloadHandler } from '../../src/core/PauseManager';
import { fatorDeVelocidade } from '../../src/player/velocidadeDeQuebra';
import { B } from '../../src/world/blocks';

describe('Batch 29 — Testes de Ferramentas Voxel, Save Templates, beforeunload e Quebra sem Ferramenta P1', () => {
  describe('Interaction — Ferramentas de Voxel (Item 1566 P1)', () => {
    it('deve executar ações de ferramentas de voxel quando em modo de edição', () => {
      const mockWorld = {} as any;
      const mockPhysics = {} as any;
      const mockPlayer = { yaw: 0, pitch: 0, position: { x: 0, y: 0, z: 0 } } as any;
      const mockScene = { add: () => {}, remove: () => {} } as any;

      const interaction = new Interaction(mockWorld, mockPhysics, mockPlayer, mockScene);

      expect(interaction.voxelToolAction('place')).toBe(false);

      interaction.enterVoxelEditingMode();
      expect(interaction.voxelToolAction('place')).toBe(true);
      expect(interaction.voxelToolAction('erase')).toBe(true);
    });
  });

  describe('StructureTemplates — Salvar Estrutura como Template (Item 1567 P1)', () => {
    it('deve criar um template reutilizável a partir de blocos definidos', () => {
      const blocks = [{ dx: 0, dy: 0, dz: 0, block: B.STONE }];
      const tpl = saveStructureAsTemplate('Minha Casa', blocks);

      expect(tpl.name).toBe('Minha Casa');
      expect(tpl.blocks).toEqual(blocks);
      expect(tpl.id).toMatch(/^custom_/);
    });
  });

  describe('PauseManager — Handlers de Evento beforeunload (Item 1591 P1)', () => {
    it('deve registrar e remover o listener do evento beforeunload', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const cleanup = setupBeforeUnloadHandler(() => true);
      expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

      cleanup();
      expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  describe('velocidadeDeQuebra — Viabilidade de Quebra de Tronco com a Mão Nua (Item 1593 P1)', () => {
    it('deve retornar multiplicador de tempo 1 (100% viável) ao socar tronco sem ferramenta', () => {
      const fator = fatorDeVelocidade(0, B.LOG);
      expect(fator).toBe(1);
    });
  });
});
