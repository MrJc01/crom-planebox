// Tela de Morte dedicada com causa do óbito e dica contextual — item 1506 P2.
import { icone } from './icons';
import { CAMADA } from './theme';

export interface DeathInfo {
  cause: string;
  location?: { x: number; y: number; z: number };
  tip?: string;
}

export class DeathScreen {
  public element: HTMLElement;

  constructor(public onRespawn: () => void) {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: fixed; inset: 0; background: rgba(185, 28, 28, 0.85);
      display: none; flex-direction: column; align-items: center; justify-content: center;
      color: white; font-family: sans-serif; z-index: ${CAMADA.aviso}; backdrop-filter: blur(4px);
    `;
  }

  public show(info: DeathInfo): void {
    const defaultTip = info.tip ?? 'Mantenha suprimentos de comida e armadura equipada para evitar fatalidades.';
    this.element.innerHTML = `
      <h1 style="font-size: 36px; font-weight: 800; margin-bottom: 12px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">Você Morreu!</h1>
      <div style="font-size: 16px; margin-bottom: 8px; color: #fecaca;">Causa: <strong>${info.cause}</strong></div>
      ${info.location ? `<div style="font-size: 12px; color: #fca5a5; margin-bottom: 16px;">Coordenadas da Morte: X: ${Math.floor(info.location.x)}, Y: ${Math.floor(info.location.y)}, Z: ${Math.floor(info.location.z)}</div>` : ''}
      <div style="background: rgba(0,0,0,0.3); padding: 12px 18px; border-radius: 8px; font-size: 13px; max-width: 400px; text-align: center; margin-bottom: 24px; color: #e2e8f0; display:flex; align-items:center; gap:8px;">
        ${icone('aviso', 16)} <em>${defaultTip}</em>
      </div>
      <button id="respawn-btn" style="
        background: #ef4444; border: 2px solid #ffffff; color: white;
        padding: 10px 24px; border-radius: 6px; font-weight: 700; font-size: 14px;
        cursor: pointer; transition: transform 0.1s ease;
      ">Renascer</button>
    `;
    this.element.style.display = 'flex';

    const btn = this.element.querySelector('#respawn-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        this.hide();
        this.onRespawn();
      });
    }
  }

  public hide(): void {
    this.element.style.display = 'none';
  }
}
