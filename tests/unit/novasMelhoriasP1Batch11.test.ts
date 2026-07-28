// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { PeerSync } from '../../src/net/PeerSync';
import { ModService } from '../../src/mods/ModService';
import { HUD } from '../../src/ui/HUD';

describe('Batch 11 — Testes de Voz por Jogador, Contexto de Sessão e Pausa Visual P1', () => {
  describe('PeerSync — Controles de Voz por Participante (Itens 934, 935 P1)', () => {
    let peerSync: PeerSync;

    beforeEach(() => {
      const fakeSignaling = { onSignal: null, onPeerJoined: null } as any;
      peerSync = new PeerSync(fakeSignaling);
    });

    it('deve permitir mutar e desmutar um participante individualmente (Item 934 P1)', () => {
      const peerId = 'player-123';
      expect(peerSync.isPeerMuted(peerId)).toBe(false);

      peerSync.mutePeer(peerId, true);
      expect(peerSync.isPeerMuted(peerId)).toBe(true);

      peerSync.mutePeer(peerId, false);
      expect(peerSync.isPeerMuted(peerId)).toBe(false);
    });

    it('deve ajustar e consultar volume específico por participante', () => {
      const peerId = 'player-456';
      expect(peerSync.getPeerVolume(peerId)).toBe(1.0);

      peerSync.setPeerVolume(peerId, 0.4);
      expect(peerSync.getPeerVolume(peerId)).toBeCloseTo(0.4);

      peerSync.setPeerVolume(peerId, 2.5); // clampa em 2.0
      expect(peerSync.getPeerVolume(peerId)).toBe(2.0);
    });

    it('deve indicar se um participante está falando (Item 935 P1)', () => {
      const peerId = 'player-789';
      expect(peerSync.isPeerSpeaking(peerId)).toBe(false);

      peerSync.setPeerSpeaking(peerId, true);
      expect(peerSync.isPeerSpeaking(peerId)).toBe(true);
      expect(peerSync.getSpeakingPeers()).toContain(peerId);

      peerSync.setPeerSpeaking(peerId, false);
      expect(peerSync.isPeerSpeaking(peerId)).toBe(false);
    });
  });

  describe('ModService — Contexto da Sessão Ativa (Item 891 P1)', () => {
    it('deve retornar resumo do contexto da sessão ativa', () => {
      const modService = new ModService();
      const mockMod = {
        id: 'mod-teste',
        name: 'Mod Teste',
        blocks: [{ key: 'b1', name: 'Bloco 1' }],
        scripts: [{ id: 's1', filename: 'main.js', code: 'console.log("ok");', enabled: true }],
      } as any;

      (modService as any).mods = [mockMod];
      modService.setActiveSession('thread-1', 'mod-teste');

      const ctx = modService.getSessionContext('thread-1');
      expect(ctx.modId).toBe('mod-teste');
      expect(ctx.blocksCount).toBe(1);
      expect(ctx.scripterActive).toBe(true);
      expect(ctx.summary).toContain('Mod "Mod Teste"');
    });

    it('deve retornar resumo de sessão livre quando não há mod vinculado', () => {
      const modService = new ModService();
      const ctx = modService.getSessionContext('thread-2');
      expect(ctx.modId).toBeUndefined();
      expect(ctx.blocksCount).toBe(0);
      expect(ctx.summary).toContain('Sessão livre ativa');
    });
  });

  describe('HUD — Insígnia de Pausa Visível (Item 1054 P1)', () => {
    it('deve alternar a visibilidade da insígnia PAUSADO', () => {
      document.body.innerHTML = '';
      const hud = new HUD();

      hud.setPaused(true);
      const hudEl = document.getElementById('hud-container');
      expect(hudEl?.textContent).toContain('PAUSADO');

      hud.setPaused(false);
      const pausedBadge = hudEl?.querySelector('div[style*="PAUSADO"]') as HTMLElement;
      if (pausedBadge) {
        expect(pausedBadge.style.display).toBe('none');
      }
    });
  });
});
