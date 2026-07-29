// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { DeathScreen } from '../../src/ui/DeathScreen';
import { VoiceChatUI } from '../../src/ui/VoiceChatUI';
import { CommandRegistry } from '../../src/core/CommandRegistry';

describe('Batch 43 — Testes de Tela de Morte, VOIP Speaker e Registro de Comandos P2', () => {
  describe('DeathScreen — Tela de Morte Dedicada (Item 1506 P2)', () => {
    it('deve exibir causa da morte e coordenadas com botão de renascer', () => {
      let respawned = false;
      const screen = new DeathScreen(() => { respawned = true; });

      screen.show({
        cause: 'Ataque de Zumbi',
        location: { x: 10, y: 64, z: 20 },
      });

      expect(screen.element.style.display).toBe('flex');
      expect(screen.element.innerHTML).toContain('Ataque de Zumbi');
      expect(screen.element.innerHTML).toContain('X: 10, Y: 64, Z: 20');

      const btn = screen.element.querySelector('#respawn-btn') as HTMLButtonElement;
      btn.click();

      expect(respawned).toBe(true);
      expect(screen.element.style.display).toBe('none');
    });
  });

  describe('VoiceChatUI — Indicador Visual de Fala VOIP (Itens 1548 P2, 1500 P3)', () => {
    it('deve gerenciar estado de participantes e gerar selo de voz ativa', () => {
      const voiceUI = new VoiceChatUI();
      voiceUI.setSpeakerState('player1', 'Jogador 1', true);
      voiceUI.setSpeakerState('player2', 'Jogador 2', false);

      const active = voiceUI.getActiveSpeakers();
      expect(active.length).toBe(1);
      expect(active[0].id).toBe('player1');

      const badge = voiceUI.renderSpeakerBadge(active[0]);
      expect(badge).toContain('falando...');
    });
  });

  describe('CommandRegistry — /ajuda Dinâmico (Item 1558 P2)', () => {
    it('deve registrar comandos e gerar a listagem dinâmica de /ajuda', () => {
      const registry = new CommandRegistry();
      registry.register({
        name: 'tp',
        description: 'Teleporta o jogador para coordenadas.',
        handler: () => 'Teleportado',
      });

      const helpMsg = registry.execute('/ajuda');
      expect(helpMsg).toContain('/ajuda');
      expect(helpMsg).toContain('/tp');

      const tpRes = registry.execute('/tp 0 64 0');
      expect(tpRes).toBe('Teleportado');
    });
  });
});
