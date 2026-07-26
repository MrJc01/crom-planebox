// Tela de criação do personagem: preview 3D girando + paleta por parte do corpo.
//
// É um `UIScreen` bloqueante (mesma família de Pause e Inventário), com cena Three.js própria
// e renderer próprio — assim o preview gira sozinho sem depender do loop do jogo nem competir
// com a câmera do mundo.
//
// O que é salvo aqui vale para todos os mundos e é o que os outros jogadores enxergam na
// sessão P2P, porque a aparência viaja no `player_state` (ver `src/net/protocol.ts`).

import { CAMADA } from './theme';
import * as THREE from 'three';
import { UIScreen } from './UIManager';
import {
  Appearance,
  COLOR_SLOTS,
  ColorSlot,
  DEFAULT_APPEARANCE,
  HAIR_STYLES,
  HairStyle,
  SUGGESTED_PALETTE,
  sanitizeAppearance,
} from '../player/Appearance';
import { PlayerModel } from '../player/PlayerModel';

export class CharacterCreator implements UIScreen {
  readonly id = 'character-creator';
  public isOpen = false;

  private root: HTMLDivElement;
  private previewHost: HTMLDivElement;
  private slotsHost: HTMLDivElement;

  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private renderer: THREE.WebGLRenderer | null = null;
  private model: PlayerModel;
  private raf = 0;
  private spin = 0;
  /** Rascunho editado na tela; só vira aparência oficial no "Salvar". */
  private draft: Appearance;

  /** Chamado ao salvar, com a aparência já higienizada. */
  public onSave: (appearance: Appearance) => void = () => {};

  constructor(initial: Appearance = DEFAULT_APPEARANCE) {
    this.draft = sanitizeAppearance(initial);
    this.model = new PlayerModel(this.draft);

    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 6, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x93c5fd, 0.5);
    rim.position.set(-4, 3, -5);
    this.scene.add(rim);
    this.scene.add(this.model.group);

    this.camera.position.set(0, 1.05, 3.1);
    this.camera.lookAt(0, 0.95, 0);

    const { root, previewHost, slotsHost } = this.buildDom();
    this.root = root;
    this.previewHost = previewHost;
    this.slotsHost = slotsHost;
    document.body.appendChild(this.root);

    this.renderSlots();
  }

  private buildDom(): { root: HTMLDivElement; previewHost: HTMLDivElement; slotsHost: HTMLDivElement } {
    const root = document.createElement('div');
    root.id = 'character-creator';
    root.style.cssText = `
      position: fixed; inset: 0; z-index: ${CAMADA.tela}; display: none;
      background: rgba(2, 6, 23, 0.92); backdrop-filter: blur(6px);
      color: #e2e8f0; font-family: system-ui, sans-serif;
      align-items: center; justify-content: center; padding: 24px; box-sizing: border-box;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      display: flex; gap: 24px; max-width: 900px; width: 100%; max-height: 100%;
      background: #0b1220; border: 1px solid #1e293b; border-radius: 16px; padding: 24px;
      box-sizing: border-box; overflow: hidden;
    `;

    const previewHost = document.createElement('div');
    previewHost.style.cssText = `
      width: 320px; min-width: 260px; border-radius: 12px; overflow: hidden;
      background: #0f172a; border: 1px solid #1e293b; position: relative;
    `;

    const hint = document.createElement('div');
    hint.textContent = 'arraste para girar';
    hint.style.cssText = `
      position: absolute; bottom: 8px; left: 0; right: 0; text-align: center;
      font-size: 11px; color: #64748b; pointer-events: none;
    `;
    previewHost.appendChild(hint);

    const side = document.createElement('div');
    side.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 14px; overflow-y: auto;';

    const title = document.createElement('h2');
    title.textContent = 'Seu personagem';
    title.style.cssText = 'margin: 0; font-size: 22px; font-weight: 700;';

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Este visual é salvo no navegador e é o que os outros jogadores veem quando você joga online.';
    subtitle.style.cssText = 'margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5;';

    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Nome';
    nameLabel.style.cssText = 'font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em;';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = 24;
    nameInput.value = this.draft.name;
    nameInput.style.cssText = `
      background: #111827; border: 1px solid #1f2937; border-radius: 8px;
      padding: 9px 12px; color: #e2e8f0; font-size: 14px; outline: none;
    `;
    nameInput.addEventListener('input', () => {
      this.draft.name = nameInput.value;
      this.refreshModel();
    });
    nameRow.append(nameLabel, nameInput);

    // Estilo de cabelo
    const hairRow = document.createElement('div');
    hairRow.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
    const hairLabel = document.createElement('label');
    hairLabel.textContent = 'Cabelo';
    hairLabel.style.cssText = nameLabel.style.cssText;
    const hairButtons = document.createElement('div');
    hairButtons.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
    for (const style of HAIR_STYLES) {
      const b = document.createElement('button');
      b.textContent = style;
      b.dataset.hair = style;
      b.style.cssText = this.chipStyle(this.draft.hairStyle === style);
      b.addEventListener('click', () => {
        this.draft.hairStyle = style as HairStyle;
        for (const other of Array.from(hairButtons.children) as HTMLButtonElement[]) {
          other.style.cssText = this.chipStyle(other.dataset.hair === style);
        }
        this.refreshModel();
      });
      hairButtons.appendChild(b);
    }
    hairRow.append(hairLabel, hairButtons);

    // Porte
    const buildRow = document.createElement('div');
    buildRow.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
    const buildLabel = document.createElement('label');
    buildLabel.textContent = 'Porte';
    buildLabel.style.cssText = nameLabel.style.cssText;
    const buildInput = document.createElement('input');
    buildInput.type = 'range';
    buildInput.min = '0.9';
    buildInput.max = '1.1';
    buildInput.step = '0.01';
    buildInput.value = String(this.draft.build);
    buildInput.addEventListener('input', () => {
      this.draft.build = Number(buildInput.value);
      this.refreshModel();
    });
    buildRow.append(buildLabel, buildInput);

    const slotsHost = document.createElement('div');
    slotsHost.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 10px; margin-top: 4px;';

    const save = document.createElement('button');
    save.textContent = 'Salvar personagem';
    save.style.cssText = `
      flex: 1; background: #2563eb; border: none; border-radius: 9px; color: white;
      padding: 11px 16px; font-size: 14px; font-weight: 600; cursor: pointer;
    `;
    save.addEventListener('click', () => {
      this.draft = sanitizeAppearance(this.draft);
      this.onSave(this.draft);
      this.close();
    });

    const randomize = document.createElement('button');
    randomize.textContent = 'Aleatório';
    randomize.style.cssText = `
      background: #1e293b; border: 1px solid #334155; border-radius: 9px; color: #e2e8f0;
      padding: 11px 16px; font-size: 14px; cursor: pointer;
    `;
    randomize.addEventListener('click', () => {
      this.draft = randomAppearance(this.draft.name);
      nameInput.value = this.draft.name;
      buildInput.value = String(this.draft.build);
      for (const b of Array.from(hairButtons.children) as HTMLButtonElement[]) {
        b.style.cssText = this.chipStyle(b.dataset.hair === this.draft.hairStyle);
      }
      this.renderSlots();
      this.refreshModel();
    });

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancelar';
    cancel.style.cssText = randomize.style.cssText;
    cancel.addEventListener('click', () => this.close());

    actions.append(save, randomize, cancel);
    side.append(title, subtitle, nameRow, hairRow, buildRow, slotsHost, actions);
    panel.append(previewHost, side);
    root.appendChild(panel);

    this.attachDragToSpin(previewHost);
    return { root, previewHost, slotsHost };
  }

  private chipStyle(active: boolean): string {
    return `
      background: ${active ? '#2563eb' : '#1e293b'};
      border: 1px solid ${active ? '#3b82f6' : '#334155'};
      border-radius: 999px; color: #e2e8f0; padding: 6px 14px;
      font-size: 13px; cursor: pointer; text-transform: capitalize;
    `;
  }

  /** Uma linha por parte do corpo: amostras sugeridas + seletor livre de cor. */
  private renderSlots(): void {
    this.slotsHost.innerHTML = '';

    for (const { slot, label } of COLOR_SLOTS) {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; gap: 10px;';

      const name = document.createElement('span');
      name.textContent = label;
      name.style.cssText = 'width: 64px; font-size: 13px; color: #cbd5e1;';

      const swatches = document.createElement('div');
      swatches.style.cssText = 'display: flex; gap: 6px; flex: 1; flex-wrap: wrap;';

      const picker = document.createElement('input');
      picker.type = 'color';
      picker.value = this.draft[slot];
      picker.title = `Cor livre para ${label.toLowerCase()}`;
      picker.style.cssText = 'width: 34px; height: 28px; border: 1px solid #334155; border-radius: 6px; background: none; cursor: pointer; padding: 0;';

      const applyColor = (hex: string) => {
        this.draft[slot] = hex;
        picker.value = hex;
        for (const s of Array.from(swatches.children) as HTMLElement[]) {
          s.style.outline = s.dataset.hex === hex ? '2px solid #e2e8f0' : 'none';
        }
        this.refreshModel();
      };

      for (const hex of SUGGESTED_PALETTE[slot as ColorSlot]) {
        const sw = document.createElement('button');
        sw.dataset.hex = hex;
        sw.style.cssText = `
          width: 26px; height: 26px; border-radius: 6px; border: 1px solid #0f172a;
          background: ${hex}; cursor: pointer; padding: 0;
          outline: ${this.draft[slot] === hex ? '2px solid #e2e8f0' : 'none'}; outline-offset: 1px;
        `;
        sw.addEventListener('click', () => applyColor(hex));
        swatches.appendChild(sw);
      }

      picker.addEventListener('input', () => applyColor(picker.value));
      row.append(name, swatches, picker);
      this.slotsHost.appendChild(row);
    }
  }

  private attachDragToSpin(host: HTMLElement): void {
    let dragging = false;
    let lastX = 0;
    host.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      this.spin += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    });
  }

  private refreshModel(): void {
    this.model.setAppearance(this.draft);
  }

  /**
   * O renderer só é criado na primeira abertura: montar um contexto WebGL extra no boot
   * custaria memória de GPU numa tela que o jogador pode nunca abrir.
   */
  private ensureRenderer(): void {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    this.renderer.domElement.style.cssText = 'width: 100%; height: 100%; display: block;';
    this.previewHost.insertBefore(this.renderer.domElement, this.previewHost.firstChild);
  }

  private resize(): void {
    if (!this.renderer) return;
    const w = this.previewHost.clientWidth || 320;
    const h = this.previewHost.clientHeight || 420;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = (): void => {
    if (!this.isOpen || !this.renderer) return;
    this.spin += 0.006;
    this.model.group.rotation.y = this.spin;
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  public open(): void {
    this.isOpen = true;
    this.root.style.display = 'flex';
    this.ensureRenderer();
    this.resize();
    this.refreshModel();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  public close(): void {
    this.isOpen = false;
    this.root.style.display = 'none';
    cancelAnimationFrame(this.raf);
  }

  /** Recarrega o rascunho a partir da aparência salva (ao reabrir depois de cancelar). */
  public setAppearance(appearance: Appearance): void {
    this.draft = sanitizeAppearance(appearance);
    this.renderSlots();
    this.refreshModel();
  }
}

/** Sorteia um visual coerente usando só cores da paleta sugerida. */
export function randomAppearance(keepName = DEFAULT_APPEARANCE.name): Appearance {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const draft: Appearance = { ...DEFAULT_APPEARANCE, name: keepName };
  for (const { slot } of COLOR_SLOTS) draft[slot] = pick(SUGGESTED_PALETTE[slot]);
  draft.hairStyle = pick(HAIR_STYLES);
  draft.build = 0.9 + Math.random() * 0.2;
  return sanitizeAppearance(draft);
}
