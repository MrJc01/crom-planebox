import * as THREE from 'three';
import { PlayerController } from '../player/controller';

export type CameraMode = 'topdown' | 'fps' | 'thirdperson' | 'ghost';

export class CameraManager {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private player: PlayerController;
  public activeCamera: THREE.PerspectiveCamera;

  public topDownCam: THREE.PerspectiveCamera;
  public fpsCam: THREE.PerspectiveCamera;
  public thirdPersonCam: THREE.PerspectiveCamera;
  public ghostCam: THREE.PerspectiveCamera;

  /** Distância da câmera de terceira pessoa até o personagem, ajustável na roda do mouse. */
  public thirdPersonDistance = 4.2;
  /** Altura do ponto que a câmera de terceira pessoa orbita (ombro do personagem). */
  public thirdPersonHeight = 1.5;
  /**
   * Consulta de colisão opcional: devolve true se a posição está dentro de bloco sólido.
   * Ligada pelo `main.ts`; sem ela a câmera simplesmente não faz aproximação anti-parede.
   */
  public isSolidAt: ((x: number, y: number, z: number) => boolean) | null = null;

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
    this.thirdPersonCam = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);
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
      } else if (this.mode === 'thirdperson') {
        this.thirdPersonDistance = Math.max(1.8, Math.min(9, this.thirdPersonDistance + (e.deltaY > 0 ? 0.5 : -0.5)));
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
    console.log(`[CameraManager] Alternando modo de câmera para: "${mode.toUpperCase()}"`);
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
    } else if (mode === 'thirdperson') {
      // Mesmas regras de física da primeira pessoa: muda só de onde se olha.
      this.activeCamera = this.thirdPersonCam;
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
    } else if (this.mode === 'thirdperson') {
      this.updateThirdPerson();
    } else if (this.mode === 'ghost') {
      this.ghostCam.position.copy(this.fpsCam.position);
      this.ghostCam.rotation.copy(this.fpsCam.rotation);
    }
  }

  /**
   * Câmera orbital atrás do personagem, seguindo yaw/pitch da mira.
   *
   * A câmera é puxada para perto quando há bloco no caminho: sem isso, encostar numa parede
   * põe a câmera dentro dela e o jogador passa a ver o interior do terreno.
   */
  private updateThirdPerson(): void {
    const p = this.player.pos;
    const yaw = this.player.yaw;
    const pitch = this.player.pitch;

    const targetX = p.x;
    const targetY = p.y + this.thirdPersonHeight;
    const targetZ = p.z;

    // Direção para onde o jogador olha (mesma convenção do `fpsCam`).
    const dirX = -Math.sin(yaw) * Math.cos(pitch);
    const dirY = Math.sin(pitch);
    const dirZ = -Math.cos(yaw) * Math.cos(pitch);

    let dist = this.thirdPersonDistance;
    if (this.isSolidAt) {
      // Marcha à ré a partir do alvo: para no primeiro ponto livre antes do obstáculo.
      const STEP = 0.2;
      for (let d = STEP; d <= this.thirdPersonDistance; d += STEP) {
        if (this.isSolidAt(targetX - dirX * d, targetY - dirY * d, targetZ - dirZ * d)) {
          dist = Math.max(0.6, d - STEP);
          break;
        }
      }
    }

    this.thirdPersonCam.position.set(targetX - dirX * dist, targetY - dirY * dist, targetZ - dirZ * dist);
    this.thirdPersonCam.lookAt(targetX + dirX, targetY + dirY, targetZ + dirZ);
  }

  public setFOV(degrees: number): void {
    console.log(`[CameraManager] Atualizando FOV para ${degrees}°`);
    this.fov = degrees;
    this.topDownCam.fov = degrees;
    this.fpsCam.fov = degrees;
    this.thirdPersonCam.fov = degrees;
    this.ghostCam.fov = degrees;
    this.topDownCam.updateProjectionMatrix();
    this.fpsCam.updateProjectionMatrix();
    this.thirdPersonCam.updateProjectionMatrix();
    this.ghostCam.updateProjectionMatrix();
  }

  /** Avisado quando a distância muda, para a névoa acompanhar. */
  public onRenderDistanceChanged: (chunks: number) => void = () => {};

  public setRenderDistance(distanceInChunks: number): void {
    console.log(`[CameraManager] Distância de Renderização alterada para ${distanceInChunks} chunks`);
    this.renderDistance = distanceInChunks;
    this.onRenderDistanceChanged(distanceInChunks);
  }

  public headBobbingEnabled = true;

  /** Distância de render adaptativa ao FPS medido (item 975 P1). */
  public adjustRenderDistanceForFps(currentFps: number): void {
    if (currentFps < 30 && this.renderDistance > 4) {
      this.setRenderDistance(Math.max(4, this.renderDistance - 1));
    } else if (currentFps > 58 && this.renderDistance < 12) {
      this.setRenderDistance(Math.min(12, this.renderDistance + 1));
    }
  }

  public getActiveCameraPosition(): THREE.Vector3 {
    return this.activeCamera.position;
  }

  private entityCameraTarget: THREE.Vector3 | null = null;

  /**
   * Define o ponto de vista de câmera focado em uma entidade (para cinemáticas ou vigilância) — item 1559 P1.
   */
  public setEntityCameraTarget(targetPos?: THREE.Vector3): void {
    this.entityCameraTarget = targetPos ? targetPos.clone() : null;
    if (this.entityCameraTarget) {
      this.activeCamera.position.copy(this.entityCameraTarget).add(new THREE.Vector3(0, 1.6, 0));
      this.activeCamera.lookAt(this.entityCameraTarget);
    }
  }

  public getEntityCameraTarget(): THREE.Vector3 | null {
    return this.entityCameraTarget;
  }
}

/** Ombro esquerdo/direito na câmera de 3ª pessoa — item 599 P2. */
export class OverTheShoulderCamera {
  public shoulder: 'left' | 'right' = 'right';

  public toggleShoulder(): 'left' | 'right' {
    this.shoulder = this.shoulder === 'right' ? 'left' : 'right';
    return this.shoulder;
  }

  public getShoulderOffset(): number {
    return this.shoulder === 'right' ? 0.75 : -0.75;
  }
}

/** Modo construção 2D lateral opcional — item 510 P3. */
export class SideConstructionMode2D {
  public is2DMode = false;

  public toggle2DMode(): boolean {
    this.is2DMode = !this.is2DMode;
    return this.is2DMode;
  }
}
