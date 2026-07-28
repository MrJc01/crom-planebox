// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { OptionsModal } from '../../src/ui/OptionsModal';
import { pauseWorldInSingleplayer, createInitialPauseState } from '../../src/core/PauseManager';

describe('Batch 16 — Testes de Opções Unificadas, Deslocamento Bedrock e Pausa Multiplayer P1', () => {
  describe('OptionsModal — Tela de Opções Unificada (Itens 985, 1191 P1)', () => {
    it('deve instanciar o modal de opções e abrir/fechar corretamente', () => {
      document.body.innerHTML = '';
      const options = new OptionsModal();
      expect(options.isOpen).toBe(false);

      options.open();
      expect(options.isOpen).toBe(true);
      expect(options.raiz.style.opacity).toBe('1');

      options.close();
      expect(options.isOpen).toBe(false);
      expect(options.raiz.style.opacity).toBe('0');
    });
  });

  describe('Pausa da Simulação no Singleplayer vs Isolamento no Multiplayer (Itens 1053, 1055 P1)', () => {
    it('deve pausar a simulação no singleplayer quando um modal é aberto (Item 1053 P1)', () => {
      const initial = createInitialPauseState();
      const pausedState = pauseWorldInSingleplayer(true, initial, false);

      expect(pausedState.paused).toBe(true);
      expect(pausedState.reason).toBe('menu');
    });

    it('não deve pausar a simulação em salas multiplayer P2P (Item 1055 P1)', () => {
      const initial = createInitialPauseState();
      const pausedState = pauseWorldInSingleplayer(true, initial, true); // isMultiplayer = true

      expect(pausedState.paused).toBe(false);
    });
  });
});
