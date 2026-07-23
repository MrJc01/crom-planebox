import { CameraManager, CameraMode } from '../engine/CameraManager';

export class HUD {
  private container: HTMLDivElement;
  private cameraBadge: HTMLDivElement;
  private coordsBadge: HTMLDivElement;
  private cameraManager: CameraManager | null = null;

  constructor(cameraManager?: CameraManager) {
    if (cameraManager) this.cameraManager = cameraManager;

    this.container = document.createElement('div');
    this.container.id = 'hud-container';
    this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      user-select: none;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      z-index: 10;
    `;

    // Crosshair in screen center
    const crosshair = document.createElement('div');
    crosshair.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 8px;
      height: 8px;
      margin-left: -4px;
      margin-top: -4px;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(0, 0, 0, 0.5);
      border-radius: 50%;
      pointer-events: none;
    `;
    this.container.appendChild(crosshair);

    // Top Right Badges
    const topRightPanel = document.createElement('div');
    topRightPanel.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-end;
    `;

    this.cameraBadge = document.createElement('div');
    this.cameraBadge.style.cssText = `
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: #38bdf8;
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: auto;
      cursor: pointer;
      transition: transform 0.15s ease, background 0.15s ease;
    `;
    this.cameraBadge.textContent = 'Modo: Top-Down';
    this.cameraBadge.title = 'Clique para alternar o modo de câmera';
    this.cameraBadge.onclick = (e) => {
      e.stopPropagation();
      this.cycleCameraMode();
    };
    topRightPanel.appendChild(this.cameraBadge);

    this.coordsBadge = document.createElement('div');
    this.coordsBadge.style.cssText = `
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
    `;
    this.coordsBadge.textContent = 'XYZ: 0, 0, 0';
    topRightPanel.appendChild(this.coordsBadge);

    this.container.appendChild(topRightPanel);

    // Controls hint bottom-right
    const hint = document.createElement('div');
    hint.style.cssText = `
      position: absolute;
      bottom: 16px;
      right: 16px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 12px;
      line-height: 1.6;
    `;
    hint.innerHTML = `
      <strong>[Ctrl+1/2/3]</strong> Câmeras &nbsp;|&nbsp; <strong>[1-9]</strong> Hotbar &nbsp;|&nbsp; <strong>[E]</strong> Inventário <br/>
      <strong>[T]</strong> Chat IA &nbsp;|&nbsp; <strong>[ESC]</strong> Menu / Pausa
    `;
    this.container.appendChild(hint);

    document.body.appendChild(this.container);
  }

  public setCameraManager(cameraManager: CameraManager): void {
    this.cameraManager = cameraManager;
  }

  private cycleCameraMode(): void {
    if (!this.cameraManager) return;
    const modes: CameraMode[] = ['topdown', 'fps', 'ghost'];
    const currentIdx = modes.indexOf(this.cameraManager.mode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    this.cameraManager.setMode(nextMode);
    this.updateCameraMode(nextMode);
  }

  public updateCameraMode(mode: string): void {
    const labels: Record<string, string> = {
      topdown: '🎥 Visão: Top-Down [Ctrl+1]',
      fps: '👤 Visão: Primeira Pessoa FPS [Ctrl+2]',
      ghost: '👻 Visão: Fantasma Fly [Ctrl+3]'
    };
    this.cameraBadge.textContent = labels[mode] || mode;
  }

  public updateCoords(x: number, y: number, z: number): void {
    this.coordsBadge.textContent = `XYZ: ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`;
  }

  public showToast(msg: string): void {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: absolute;
      top: 70px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #f8fafc;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      pointer-events: none;
      z-index: 100;
      transition: opacity 0.3s ease;
    `;
    toast.textContent = msg;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
}
