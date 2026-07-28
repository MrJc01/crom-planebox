// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { detectCorsError } from '../../src/net/wire';
import { handleVisibilityChange, createEmptyPressedKeys, createInitialPauseState, pressKey } from '../../src/core/PauseManager';
import { InventoryModal } from '../../src/ui/InventoryModal';
import { Interaction } from '../../src/player/interaction';
import { ESCALA_MODELO } from '../../src/player/Appearance';
import * as THREE from 'three';
import { EntitySystem } from '../../src/entities/EntitySystem';

describe('Batch 6 — Testes de Bugs de Playtesting e Melhorias P1', () => {
  describe('DetectCorsError (Item 780 P1)', () => {
    it('deve identificar erro de Failed to fetch como CORS e formatar mensagem amigável', () => {
      const err = new TypeError('Failed to fetch');
      const res = detectCorsError(err, 'https://api.exemplo.com/v1/data');
      expect(res.isCors).toBe(true);
      expect(res.message).toContain('api.exemplo.com');
      expect(res.message).toContain('CORS');
    });

    it('deve identificar erro generico sem marcar como CORS', () => {
      const err = new Error('500 Internal Server Error');
      const res = detectCorsError(err, 'https://api.exemplo.com/v1/data');
      expect(res.isCors).toBe(false);
      expect(res.message).toBe('500 Internal Server Error');
    });
  });

  describe('PauseManager & Visibilidade (Itens 1056, 1057 P1)', () => {
    it('deve pausar o jogo e limpar teclas ao ocultar aba no modo singleplayer', () => {
      let keys = createEmptyPressedKeys();
      keys = pressKey(keys, 'KeyW');
      keys = pressKey(keys, 'Space');
      expect(keys.keys.size).toBe(2);

      const pauseState = createInitialPauseState();
      const res = handleVisibilityChange(true, pauseState, keys, false);

      expect(res.pause.paused).toBe(true);
      expect(res.pause.reason).toBe('visibility');
      expect(res.keys.keys.size).toBe(0);
    });

    it('em multiplayer deve apenas limpar teclas sem pausar a simulação', () => {
      let keys = createEmptyPressedKeys();
      keys = pressKey(keys, 'KeyW');

      const pauseState = createInitialPauseState();
      const res = handleVisibilityChange(true, pauseState, keys, true);

      expect(res.pause.paused).toBe(false);
      expect(res.keys.keys.size).toBe(0);
    });

    it('ao voltar a visibilidade deve despausar se foi pausado por visibilidade', () => {
      const pauseState = { paused: true, reason: 'visibility' as const };
      const keys = createEmptyPressedKeys();
      const res = handleVisibilityChange(false, pauseState, keys, false);

      expect(res.pause.paused).toBe(false);
    });
  });

  describe('InventoryModal & Sobrevivência (Itens 1661, 1667 P0)', () => {
    let mockInteraction: Interaction;

    beforeEach(() => {
      document.body.innerHTML = '';
      mockInteraction = {
        selected: 0,
        hotbar: Array.from({ length: 9 }, (_, i) => ({
          label: i === 0 ? 'Madeira' : 'Vazio',
          block: i === 0 ? 5 : -1,
          count: i === 0 ? 12 : 0,
          infinite: false,
        })),
        onChanged: () => {},
      } as any;
    });

    it('deve ocultar a aba Catálogo Criativo e manter Meu Estoque no modo sobrevivência', () => {
      const modal = new InventoryModal(mockInteraction);
      modal.gateCreativeCatalog = () => false; // modo sobrevivência

      modal.open();
      expect(modal.isOpen).toBe(true);

      const textContent = modal.raiz.textContent || '';
      expect(textContent).toContain('Meu Estoque');
      expect(textContent).not.toContain('Catálogo Criativo');
    });

    it('deve exibir a aba Catálogo Criativo no modo criativo', () => {
      const modal = new InventoryModal(mockInteraction);
      modal.gateCreativeCatalog = () => true; // modo criativo

      modal.open();
      expect(modal.isOpen).toBe(true);

      const textContent = modal.raiz.textContent || '';
      expect(textContent).toContain('Catálogo Criativo');
      expect(textContent).toContain('Meu Estoque');
    });
  });

  describe('Escala de Mobs & Entidades (Item 1662 P0, 1665 P1)', () => {
    it('ESCALA_MODELO deve ser aproximadamente 2.94', () => {
      expect(ESCALA_MODELO).toBeGreaterThan(2.9);
      expect(ESCALA_MODELO).toBeLessThan(3.0);
    });

    it('spawnEntity deve aplicar ESCALA_MODELO ao grupo da entidade 3D', () => {
      const scene = new THREE.Scene();
      const world = { getBlock: () => 0 } as any;
      const entitySystem = new EntitySystem(world, scene);

      const mob = entitySystem.spawnHostile('zumbi', 0, 10, 0);
      expect(mob.mesh.scale.x).toBeCloseTo(ESCALA_MODELO, 2);
      expect(mob.mesh.scale.y).toBeCloseTo(ESCALA_MODELO, 2);
      expect(mob.mesh.scale.z).toBeCloseTo(ESCALA_MODELO, 2);
    });
  });
});
