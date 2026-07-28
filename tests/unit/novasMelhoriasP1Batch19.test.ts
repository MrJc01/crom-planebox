// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/storage/WorldRepository', () => ({
  WorldRepository: class {
    static async getChatMessages() { return []; }
    static async listWorlds() { return []; }
    static async getAllWorlds() { return [{ id: 'w1', name: 'Mundo 1', createdAt: Date.now() }]; }
    static async getActiveWorldId() { return 'world-1'; }
    static async saveBlockModBatch() {}
  },
}));

import { PauseMenu } from '../../src/ui/PauseMenu';

describe('Batch 19 — Testes de Manifesto de Mods e Aba Sistema P1', () => {
  describe('PauseMenu — Aba Sistema/Sair com Confirmação (Item 1192 P1)', () => {
    it('deve solicitar confirmação ao acionar o botão de sair para a tela inicial', () => {
      document.body.innerHTML = '';
      const onSairMock = vi.fn();
      const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

      const mockDeps: any = {
        cameraManager: { mode: 'fps', fov: 75, renderDistance: 8, setMode: () => {}, setFOV: () => {}, setRenderDistance: () => {} },
        playerController: {},
        gameModeManager: { getMode: () => 'survival' },
        peerSync: { isHost: false },
        signaling: {},
        audio: { getVolume: () => 1, setVolume: () => {}, habilitado: true, setHabilitado: () => {} },
        onWorldChange: () => {},
        getCurrentWorldName: () => 'Mundo Teste',
        listPlayers: () => [],
        getGradacao: () => 'natural',
        setGradacao: () => {},
        getFadeChunks: () => true,
        setFadeChunks: () => {},
        setOp: () => true,
        onSairParaMenuInicial: onSairMock,
        atalhosRapidos: [],
        listarObjetivos: () => [],
        guiaAtivo: () => false,
      };

      const pause = new PauseMenu(mockDeps);
      pause.open();
      (pause as any).tabsComponent.ir('settings');

      const btnSair = Array.from(pause.raiz.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Sair para a tela inicial'),
      );

      expect(btnSair).toBeDefined();
      btnSair?.click();

      expect(confirmSpy).toHaveBeenCalled();
      expect(onSairMock).toHaveBeenCalled();

      confirmSpy.mockRestore();
    });
  });
});
