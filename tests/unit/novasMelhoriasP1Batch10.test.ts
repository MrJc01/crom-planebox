// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { CameraManager } from '../../src/engine/CameraManager';
import { InventoryModal } from '../../src/ui/InventoryModal';
import { Interaction } from '../../src/player/interaction';

describe('Batch 10 — Testes de Câmera, Mochila de Sobrevivência e Render Adaptativo P1', () => {
  describe('CameraManager & Render Adaptativo (Items 952, 975 P1)', () => {
    let cameraManager: CameraManager;

    beforeEach(() => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera();
      const renderer = { domElement: document.createElement('canvas') } as any;
      const player = {} as any;
      cameraManager = new CameraManager(scene, camera, renderer, player);
    });

    it('headBobbingEnabled deve vir ativo por padrão', () => {
      expect(cameraManager.headBobbingEnabled).toBe(true);
    });

    it('adjustRenderDistanceForFps deve reduzir a distância de renderização se o FPS cair abaixo de 30', () => {
      cameraManager.setRenderDistance(8);
      cameraManager.adjustRenderDistanceForFps(25);
      expect(cameraManager.renderDistance).toBe(7);
    });

    it('adjustRenderDistanceForFps deve aumentar a distância de renderização se o FPS subir acima de 58', () => {
      cameraManager.setRenderDistance(6);
      cameraManager.adjustRenderDistanceForFps(60);
      expect(cameraManager.renderDistance).toBe(7);
    });
  });

  describe('Mochila de Sobrevivência & Indicadores Visuais (Items 1668, 1669 P1)', () => {
    let mockInteraction: Interaction;

    beforeEach(() => {
      document.body.innerHTML = '';
      mockInteraction = {
        selected: 0,
        hotbar: Array.from({ length: 9 }, (_, i) => ({
          label: i === 0 ? 'Espada de Ferro' : 'Vazio',
          block: i === 0 ? -1 : -1,
          toolTier: i === 0 ? 3 : undefined,
          count: i === 0 ? 1 : 0,
          infinite: false,
        })),
        onChanged: () => {},
      } as any;
    });

    it('deve renderizar a grade de 27 slots no estoque (hotbar + mochila)', () => {
      const modal = new InventoryModal(mockInteraction);
      modal.gateCreativeCatalog = () => false;
      modal.open();

      const grid = modal.raiz.querySelector('#estoque-grid');
      expect(grid).not.toBeNull();
      // O header de status + 27 cards
      expect(grid!.children.length).toBe(28);
    });

    it('deve exibir o indicador visual de item equipado', () => {
      const modal = new InventoryModal(mockInteraction);
      modal.gateCreativeCatalog = () => false;
      modal.open();

      const text = modal.raiz.textContent || '';
      expect(text).toContain('Equipado:');
      expect(text).toContain('Espada de Ferro');
      expect(text).toContain('27 slots');
    });
  });
});
