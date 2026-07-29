// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { SnapshotRenderCache } from '../../src/render/grading';
import {
  CSPPolicyManager,
  P2PPayloadValidator,
  ThreatModelDoc,
  SeparateChatSystem,
  PlayerLatencyList,
  PlayerKickBanManager,
  HostMigrationManager,
  GuestLimitManager,
  ExplicitOfflineMode,
} from '../../src/net/PeerSync';
import { SignalingPrivacyCheck } from '../../src/net/SignalingClient';

describe('Batch 71 — Testes de Security, Chat, Host Migration, Offline Mode e Snapshot Cache P2', () => {
  describe('grading — Snapshot Render Cache (Item 347 P2)', () => {
    it('deve armazenar e consultar resultado de renderização em cache', () => {
      const cache = new SnapshotRenderCache();
      cache.setCachedRender('hash123', '<canvas_data>');
      expect(cache.getCachedRender('hash123')).toBe('<canvas_data>');
      expect(cache.getCachedRender('outro_hash')).toBeUndefined();
    });
  });

  describe('net — CSP & Privacy (Itens 367, 373, 374, 376 P2)', () => {
    it('deve retornar header CSP seguro', () => {
      expect(CSPPolicyManager.getRecommendedHeader()).toContain("default-src 'self'");
    });

    it('deve validar payload P2P bloqueando injeções', () => {
      expect(P2PPayloadValidator.isPayloadSafe({ action: 'move', x: 10 })).toBe(true);
      expect(P2PPayloadValidator.isPayloadSafe({ payload: '<script>alert(1)</script>' })).toBe(false);
    });

    it('deve verificar que mensagens de sinalização contêm apenas chaves de handshake', () => {
      expect(SignalingPrivacyCheck.verifySignalOnlyPayload({ kind: 'offer', from: 'a', to: 'b' })).toBe(true);
      expect(SignalingPrivacyCheck.verifySignalOnlyPayload({ worldBlocks: [1, 2, 3] })).toBe(false);
    });

    it('deve retornar modelo de ameaça documentado', () => {
      expect(ThreatModelDoc.getSummary()).toContain('Modelo de Ameaça');
    });
  });

  describe('net — Chat Multiplayer Separado (Item 388 P2)', () => {
    it('deve separar mensagens do chat da IA e do multiplayer', () => {
      const chat = new SeparateChatSystem();
      chat.sendMessage('p1', 'Jogador 1', 'Olá!', 'multiplayer');
      chat.sendMessage('ai', 'Assistente IA', 'Instrução recebida', 'ai');

      expect(chat.getMessages('multiplayer').length).toBe(1);
      expect(chat.getMessages('ai').length).toBe(1);
    });
  });

  describe('net — Latência, Kick/Ban, Host Migration e Limite (Itens 389, 390, 391, 392, 396 P2)', () => {
    it('deve atualizar lista de jogadores com latência', () => {
      const list = new PlayerLatencyList();
      list.updateLatency('p1', 'Alice', 45);
      expect(list.getList()[0].pingMs).toBe(45);
    });

    it('deve gerenciar kick e ban de jogadores', () => {
      const kb = new PlayerKickBanManager();
      kb.banPlayer('p2');
      expect(kb.isBanned('p2')).toBe(true);
      expect(kb.kickPlayer('p2').kicked).toBe(true);
    });

    it('deve selecionar novo host de forma consistente', () => {
      const nextHost = HostMigrationManager.selectNextHost(['peerB', 'peerA', 'peerC']);
      expect(nextHost).toBe('peerA');
    });

    it('deve respeitar limite de convidados', () => {
      const limit = new GuestLimitManager();
      limit.maxGuests = 2;
      expect(limit.canGuestJoin(1)).toBe(true);
      expect(limit.canGuestJoin(2)).toBe(false);
    });

    it('deve controlar modo offline explícito', () => {
      const offline = new ExplicitOfflineMode();
      expect(offline.allowNetworkOperation()).toBe(true);

      offline.setOffline(true);
      expect(offline.allowNetworkOperation()).toBe(false);
    });
  });
});
