// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { CodeEditorPage } from '../../src/ui/CodeEditorPage';
import { PeerSync } from '../../src/net/PeerSync';

describe('Batch 21 — Testes de Pausa do Editor e Broadcast de Skin P2P P1', () => {
  describe('CodeEditorPage — Pausa Opcional do Jogo (Item 863 P1)', () => {
    it('deve ter a propriedade pauseOnEditorOpen como true por padrão', () => {
      const mockModService = { getMods: () => [] } as any;
      const editor = new CodeEditorPage(mockModService, {} as any);

      expect(editor.pauseOnEditorOpen).toBe(true);
      editor.pauseOnEditorOpen = false;
      expect(editor.pauseOnEditorOpen).toBe(false);
    });
  });

  describe('PeerSync — Transmissão de Aparência/Skin em Tempo Real (Item 1552 P1)', () => {
    it('deve transmitir mensagem player_state com aparência para a rede', () => {
      const mockSignaling = {} as any;
      const sync = new PeerSync(mockSignaling);
      const broadcastSpy = vi.spyOn(sync, 'broadcast').mockImplementation(() => {});

      (sync as any).role = 'host';
      (sync as any).localId = 'player-1';

      sync.broadcastAppearance({ color: '#ff0000', hat: 'crown' } as any);

      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'player_state',
          playerId: 'local',
          appearance: { color: '#ff0000', hat: 'crown' },
        }),
      );
    });
  });
});
