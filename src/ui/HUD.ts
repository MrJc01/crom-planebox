import { CAMADA } from './theme';
import { CameraManager, CameraMode } from '../engine/CameraManager';
import { icone_svg } from './icons';

export class HUD {
  private container: HTMLDivElement;
  private cameraBadge: HTMLDivElement;
  private coordsBadge: HTMLDivElement;
  private networkBadge: HTMLDivElement;
  private cameraManager: CameraManager | null = null;
  private survivalBar: HTMLDivElement;
  private healthEl: HTMLDivElement;
  private hungerEl: HTMLDivElement;

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
      z-index: ${CAMADA.hud};
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

    this.networkBadge = document.createElement('div');
    this.networkBadge.style.cssText = `
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
    `;
    this.networkBadge.textContent = 'Offline (local)';
    topRightPanel.appendChild(this.networkBadge);

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

    // Barra de vida/fome (Modo Sobrevivência), estilo Minecraft — oculta nos outros modos.
    this.survivalBar = document.createElement('div');
    this.survivalBar.style.cssText = `
      position: absolute;
      bottom: 84px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    `;
    this.healthEl = document.createElement('div');
    this.healthEl.style.cssText = 'display: flex; gap: 3px; font-size: 18px; text-shadow: 0 2px 3px rgba(0,0,0,0.6);';
    this.hungerEl = document.createElement('div');
    this.hungerEl.style.cssText = 'display: flex; gap: 3px; font-size: 18px; text-shadow: 0 2px 3px rgba(0,0,0,0.6);';
    this.survivalBar.appendChild(this.healthEl);
    this.survivalBar.appendChild(this.hungerEl);
    this.container.appendChild(this.survivalBar);

    document.body.appendChild(this.container);
  }

  public setSurvivalVisible(visible: boolean): void {
    this.survivalBar.style.display = visible ? 'flex' : 'none';
  }

  /** Oculta o HUD inteiro enquanto o MainMenu/Wizard ainda estão na tela (antes do jogo começar). */
  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'block' : 'none';
  }

  public updateSurvival(health: number, maxHealth: number, hunger: number, maxHunger: number): void {
    const totalHearts = 10;
    const healthPerHeart = maxHealth / totalHearts;
    // Ícones em vez de emoji: o coração de emoji muda de desenho por sistema operacional, tem
    // cor fixa e não aceita o estado "meio cheio" — que aqui é justamente a informação principal.
    // Com SVG, cheio/meio/vazio são preenchimento e opacidade, não três caracteres diferentes.
    let heartsHtml = '';
    for (let i = 0; i < totalHearts; i++) {
      const remaining = health - i * healthPerHeart;
      const estado = remaining >= healthPerHeart * 0.999 ? 'cheio' : remaining > 0 ? 'meio' : 'vazio';
      heartsHtml += this.iconeVital('coracao', estado, '#ef4444');
    }
    heartsHtml += `<span style="font-size:12px; font-weight:700; color:#ef4444; margin-left:6px; font-family:monospace;">${Math.max(0, Math.ceil(health))}/${maxHealth}</span>`;
    this.healthEl.innerHTML = heartsHtml;

    const totalDrumsticks = 10;
    const hungerPerIcon = maxHunger / totalDrumsticks;
    let hungerHtml = '';
    for (let i = 0; i < totalDrumsticks; i++) {
      const remaining = hunger - i * hungerPerIcon;
      const estado = remaining >= hungerPerIcon * 0.999 ? 'cheio' : remaining > 0 ? 'meio' : 'vazio';
      hungerHtml += this.iconeVital('gota', estado, '#f59e0b');
    }
    hungerHtml += `<span style="font-size:12px; font-weight:700; color:#f59e0b; margin-left:6px; font-family:monospace;">${Math.max(0, Math.ceil(hunger))}/${maxHunger}</span>`;
    this.hungerEl.innerHTML = hungerHtml;
  }

  /**
   * Um ícone de barra vital.
   *
   * O estado "meio" é o motivo de isto não ser emoji: com caractere, meio coração exige um
   * glifo próprio que nem toda fonte tem. Com traçado, é preenchimento parcial e opacidade — a
   * mesma forma em três estados, sempre alinhada.
   */
  private iconeVital(nome: 'coracao' | 'gota', estado: 'cheio' | 'meio' | 'vazio', cor: string): string {
    const preenchimento = estado === 'cheio' ? cor : estado === 'meio' ? `${cor}80` : 'none';
    const opacidade = estado === 'vazio' ? 0.28 : 1;
    return (
      `<span style="display:inline-flex; color:${cor}; opacity:${opacidade}; margin-right:1px;">` +
      icone_svg(nome, 16).replace('fill="none"', `fill="${preenchimento}"`) +
      '</span>'
    );
  }

  public setCameraManager(cameraManager: CameraManager): void {
    this.cameraManager = cameraManager;
  }

  /** Câmera Top-Down é uma visão de construção — só liberada quando este callback devolve true (Modo Criativo). */
  public canUseTopdown: () => boolean = () => true;

  private cycleCameraMode(): void {
    if (!this.cameraManager) return;
    const allModes: CameraMode[] = ['topdown', 'fps', 'ghost'];
    const modes = this.canUseTopdown() ? allModes : allModes.filter((m) => m !== 'topdown');
    const currentIdx = modes.indexOf(this.cameraManager.mode);
    const nextMode = modes[(currentIdx + 1 + modes.length) % modes.length];
    this.cameraManager.setMode(nextMode);
    this.updateCameraMode(nextMode);
  }

  public updateCameraMode(mode: string): void {
    const labels: Record<string, string> = {
      topdown: 'Visão: Top-Down [Ctrl+1]',
      fps: 'Visão: Primeira Pessoa FPS [Ctrl+2]',
      ghost: 'Visão: Fantasma Fly [Ctrl+3]'
    };
    this.cameraBadge.textContent = labels[mode] || mode;
  }

  public updateCoords(x: number, y: number, z: number): void {
    this.coordsBadge.textContent = `XYZ: ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`;
  }

  /** Indicador persistente de rede (Host/Peer/Offline) — pedido explícito, antes só existia em toasts pontuais. */
  public updateNetworkStatus(role: 'offline' | 'host' | 'guest', peerCount: number): void {
    if (role === 'host') {
      this.networkBadge.textContent = `Anfitrião · ${peerCount} jogador(es)`;
      this.networkBadge.style.color = '#4ade80';
    } else if (role === 'guest') {
      this.networkBadge.textContent = 'Conectado como visitante';
      this.networkBadge.style.color = '#facc15';
    } else {
      this.networkBadge.textContent = 'Offline (local)';
      this.networkBadge.style.color = '#94a3b8';
    }
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
      z-index: ${CAMADA.aviso};
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
