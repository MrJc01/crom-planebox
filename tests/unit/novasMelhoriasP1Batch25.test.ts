// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { visualPostOptions } from '../../src/render/scene';
import { CameraManager } from '../../src/engine/CameraManager';

describe('Batch 25 — Testes de Vinheta, Sombras de Nuvens e Câmera de Entidade P1', () => {
  describe('scene — Opções Visuais de Renderização (Itens 1081, 1205 P1)', () => {
    it('deve ter vinheta ativada por padrão e sombra de nuvens configurada', () => {
      expect(visualPostOptions.vignetteEnabled).toBe(true);
      expect(visualPostOptions.cloudShadowOpacity).toBeGreaterThan(0);
    });
  });

  describe('CameraManager — Foco de Câmera em Entidade (Item 1559 P1)', () => {
    it('deve permitir focar a câmera no ponto de vista de uma entidade', () => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera();
      const renderer = { domElement: document.createElement('canvas') } as any;
      const mockPlayer = { position: new THREE.Vector3() } as any;

      const mgr = new CameraManager(scene, camera, renderer, mockPlayer);
      const target = new THREE.Vector3(10, 20, 30);

      mgr.setEntityCameraTarget(target);
      expect(mgr.getEntityCameraTarget()).toEqual(target);

      mgr.setEntityCameraTarget(undefined);
      expect(mgr.getEntityCameraTarget()).toBeNull();
    });
  });
});
