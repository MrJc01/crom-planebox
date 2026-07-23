import { BLOCKS } from '../world/blocks';
import { Interaction } from '../player/interaction';

export class InventoryModal {
  private overlay: HTMLDivElement;
  private hotbarContainer: HTMLDivElement;
  public isOpen = false;
  private interaction: Interaction;

  constructor(interaction: Interaction) {
    this.interaction = interaction;

    // Hotbar UI at bottom of screen
    this.hotbarContainer = document.createElement('div');
    this.hotbarContainer.id = 'hud-hotbar';
    this.hotbarContainer.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 6px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 6px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      z-index: 20;
      user-select: none;
    `;
    document.body.appendChild(this.hotbarContainer);
    this.renderHotbar();

    // Creative Inventory Modal Overlay (Key 'E')
    this.overlay = document.createElement('div');
    this.overlay.id = 'inventory-modal';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(12px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 100;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      user-select: none;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      width: 580px;
      max-height: 80vh;
      background: rgba(30, 41, 59, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      gap: 16px;
      color: white;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 12px;
    `;
    header.innerHTML = `
      <h2 style="margin:0; font-size:18px; font-weight:700; color:#38bdf8;">🎒 Inventário Criativo</h2>
      <span style="font-size:12px; color:#94a3b8;">Pressione [E] para fechar | Clique para equipar na Hotbar</span>
    `;

    const grid = document.createElement('div');
    grid.id = 'inventory-grid';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      max-height: 50vh;
      overflow-y: auto;
      padding-right: 4px;
    `;

    panel.appendChild(header);
    panel.appendChild(grid);
    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    // Listen for 'E' key toggle
    window.addEventListener('keydown', (e) => {
      if (e.key === 'e' || e.key === 'E') {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
        if (!isTyping) {
          this.toggle();
        }
      }
    });

    this.interaction.onChanged = () => this.renderHotbar();
  }

  public renderHotbar(): void {
    this.hotbarContainer.innerHTML = '';
    for (let i = 0; i < this.interaction.hotbar.length; i++) {
      const slot = this.interaction.hotbar[i];
      const isSelected = i === this.interaction.selected;

      const slotEl = document.createElement('div');
      slotEl.style.cssText = `
        width: 48px;
        height: 48px;
        border-radius: 8px;
        background: ${isSelected ? 'rgba(56, 189, 248, 0.3)' : 'rgba(30, 41, 59, 0.6)'};
        border: 2px solid ${isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'};
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
        cursor: pointer;
        transition: all 0.15s ease;
      `;

      const num = document.createElement('span');
      num.style.cssText = `
        position: absolute;
        top: 2px;
        left: 4px;
        font-size: 10px;
        color: #94a3b8;
        font-weight: 700;
      `;
      num.textContent = String(i + 1);
      slotEl.appendChild(num);

      const blockDef = BLOCKS[slot.block];
      if (blockDef) {
        const icon = document.createElement('div');
        const color = blockDef.colors ? `rgb(${Math.round(blockDef.colors[0][0]*255)}, ${Math.round(blockDef.colors[0][1]*255)}, ${Math.round(blockDef.colors[0][2]*255)})` : '#38bdf8';
        icon.style.cssText = `
          width: 20px;
          height: 20px;
          border-radius: 4px;
          background: ${color};
          border: 1px solid rgba(0,0,0,0.3);
          box-shadow: inset 0 0 4px rgba(255,255,255,0.4);
        `;
        slotEl.appendChild(icon);
      }

      slotEl.onclick = () => {
        this.interaction.selected = i;
        this.renderHotbar();
      };

      this.hotbarContainer.appendChild(slotEl);
    }
  }

  public renderInventoryGrid(): void {
    const grid = this.overlay.querySelector('#inventory-grid') as HTMLDivElement;
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 1; i < BLOCKS.length; i++) {
      const def = BLOCKS[i];
      if (!def) continue;

      const itemCard = document.createElement('div');
      itemCard.style.cssText = `
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
      `;
      itemCard.onmouseenter = () => itemCard.style.borderColor = '#38bdf8';
      itemCard.onmouseleave = () => itemCard.style.borderColor = 'rgba(255, 255, 255, 0.1)';

      const color = def.colors ? `rgb(${Math.round(def.colors[0][0]*255)}, ${Math.round(def.colors[0][1]*255)}, ${Math.round(def.colors[0][2]*255)})` : '#38bdf8';

      const icon = document.createElement('div');
      icon.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 6px;
        background: ${color};
        border: 1px solid rgba(0,0,0,0.4);
      `;

      const label = document.createElement('span');
      label.style.cssText = `
        font-size: 11px;
        color: #f8fafc;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      `;
      label.textContent = def.name;

      itemCard.appendChild(icon);
      itemCard.appendChild(label);

      itemCard.onclick = () => {
        const slotIdx = this.interaction.selected;
        this.interaction.hotbar[slotIdx] = {
          label: def.name,
          block: i,
          count: 9999,
          infinite: true
        };
        this.renderHotbar();
        this.close();
      };

      grid.appendChild(itemCard);
    }
  }

  public open(): void {
    this.isOpen = true;
    this.renderInventoryGrid();
    this.overlay.style.opacity = '1';
    this.overlay.style.pointerEvents = 'auto';
    try { document.exitPointerLock(); } catch {}
  }

  public close(): void {
    this.isOpen = false;
    this.overlay.style.opacity = '0';
    this.overlay.style.pointerEvents = 'none';
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}
