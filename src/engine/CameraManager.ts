import * as THREE from 'three';
import { PlayerController } from '../player/controller';

export type CameraMode = 'topdown' | 'fps' | 'ghost';

export class CameraManager {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private player: PlayerController;
  public activeCamera: THREE.PerspectiveCamera;

  public topDownCam: THREE.PerspectiveCamera;
  public fpsCam: THREE.PerspectiveCamera;
  public ghostCam: THREE.PerspectiveCamera;

  public mode: CameraMode = 'topdown';
  public fov: number = 75;
  public renderDistance: number = 6;

  // Strict Top-Down Overhead Orbit controls (RTS / Isometric style)
  public topDownRadius: number = 40;       // Distance from target
  public topDownPitch: number = 0.60;      // High angle tilt (0.2 = almost straight down, 0.95 = max 54° isometric)
  private isMouseDown: boolean = false;
  private prevMouseX: number = 0;
  private prevMouseY: number = 0;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, player: PlayerController) {
    this.scene = scene;
    this.renderer = renderer;
    this.player = player;

    this.fpsCam = camera;

    this.topDownCam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 2000);
    this.ghostCam = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);

    this.activeCamera = this.topDownCam;

    this.setupListeners();
  }

  private setupListeners(): void {
    const canvas = this.renderer.domElement;

    // Zoom top-down with mouse wheel
    canvas.addEventListener('wheel', (e) => {
      if (this.mode === 'topdown') {
        this.topDownRadius = Math.max(10, Math.min(160, this.topDownRadius + (e.deltaY > 0 ? 4 : -4)));
      }
    });

    // Mouse drag to orbit top-down view (RTS / Isometric style)
    canvas.addEventListener('mousedown', (e) => {
      if (this.mode === 'topdown') {
        this.isMouseDown = true;
        this.prevMouseX = e.clientX;
        this.prevMouseY = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.mode === 'topdown' && this.isMouseDown) {
        const dx = e.clientX - this.prevMouseX;
        const dy = e.clientY - this.prevMouseY;
        this.prevMouseX = e.clientX;
        this.prevMouseY = e.clientY;

        // Horizontal orbit rotation (yaw)
        this.player.yaw -= dx * 0.005;

        // Vertical tilt strictly clamped to high overhead angles (11.5° to 54°)
        this.topDownPitch = Math.max(0.2, Math.min(0.95, this.topDownPitch + dy * 0.003));
      }
    });
  }

  public setMode(mode: CameraMode): void {
    console.log(`🎥 [CameraManager] Alternando modo de câmera para: "${mode.toUpperCase()}"`);
    this.mode = mode;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    if (mode === 'topdown') {
      this.activeCamera = this.topDownCam;
      this.player.flying = true;
      this.player.noclip = true;
    } else if (mode === 'fps') {
      this.activeCamera = this.fpsCam;
      this.player.flying = false;
      this.player.noclip = false;
    } else if (mode === 'ghost') {
      this.activeCamera = this.ghostCam;
      this.player.flying = true;
      this.player.noclip = true;
    }
  }

  public update(): void {
    const p = this.player.pos;

    if (this.mode === 'topdown') {
      // True Top-Down Overhead Orbit Spherical Coordinates
      const r = this.topDownRadius;
      const phi = this.topDownPitch;       // Angle from top Y-axis
      const theta = this.player.yaw;       // Angle around Y-axis

      const camX = p.x + r * Math.sin(phi) * Math.sin(theta);
      const camY = p.y + r * Math.cos(phi);
      const camZ = p.z + r * Math.sin(phi) * Math.cos(theta);

      this.topDownCam.position.set(camX, camY, camZ);
      this.topDownCam.lookAt(p.x, p.y + 0.5, p.z);
    } else if (this.mode === 'ghost') {
      this.ghostCam.position.copy(this.fpsCam.position);
      this.ghostCam.rotation.copy(this.fpsCam.rotation);
    }
  }

  public setFOV(degrees: number): void {
    console.log(`📐 [CameraManager] Atualizando FOV para ${degrees}°`);
    this.fov = degrees;
    this.topDownCam.fov = degrees;
    this.fpsCam.fov = degrees;
    this.ghostCam.fov = degrees;
    this.topDownCam.updateProjectionMatrix();
    this.fpsCam.updateProjectionMatrix();
    this.ghostCam.updateProjectionMatrix();
  }

  public setRenderDistance(distanceInChunks: number): void {
    console.log(`🏔️ [CameraManager] Distância de Renderização alterada para ${distanceInChunks} chunks`);
    this.renderDistance = distanceInChunks;
  }

  public getActiveCameraPosition(): THREE.Vector3 {
    return this.activeCamera.position;
  }
}
