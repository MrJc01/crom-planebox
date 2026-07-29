// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { PeerSync } from '../../src/net/PeerSync';

describe('Batch 23 — Testes de Sincronização de Entidades e Comando /ai P1', () => {
  describe('PeerSync — Sincronização de Estado de Entidades (Item 609 P1)', () => {
    it('deve transmitir mensagem entity_update com id e coordenadas da entidade', () => {
      const mockSignaling = {} as any;
      const sync = new PeerSync(mockSignaling);
      const broadcastSpy = vi.spyOn(sync, 'broadcast').mockImplementation(() => {});

      (sync as any).role = 'host';

      sync.syncEntityState('pig-102', 10, 64, -5);

      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'entity_update',
          id: 'pig-102',
          x: 10,
          y: 64,
          z: -5,
        }),
      );
    });
  });
});
