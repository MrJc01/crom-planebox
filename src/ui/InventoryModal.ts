import { BLOCKS } from '../world/blocks';
import { Interaction } from '../player/interaction';
import { CraftingSystem, CraftCell, CraftingRecipe } from '../crafting/CraftingSystem';
import { STRUCTURE_TEMPLATES } from '../crafting/StructureTemplates';

type PaletteTab = 'blocks' | 'interactive' | 'items';

export class InventoryModal {
  public readonly id = 'inventory';
  private overlay: HTMLDivElement;
  private hotbarContainer: HTMLDivElement;
  private modalHotbarContainer: HTMLDivElement;
  public isOpen = false;
  private interaction: Interaction;
  private crafting = new CraftingSystem();
  private activeTab: PaletteTab = 'blocks';
  private craftGrid: CraftCell[][] = CraftingSystem.emptyGrid(6);
  /** true bloqueia totalmente o atalho [E] (ex.: Pause Menu aberto). */
  public blockOpen: () => boolean = () => false;
  /** false impede ABRIR o inventário criativo (ex.: modo de jogo sem inventário criativo). */
  public gateOpen: () => boolean = () => true;
  public onBlockedByMode: () => void = () => {};

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
      width: 860px;
      max-width: 94vw;
      max-height: 88vh;
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
      <h2 style="margin:0; font-size:18px; font-weight:700; color:#38bdf8;">🎒 Inventário Criativo & Crafting</h2>
    `;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Fechar [E]';
    closeBtn.style.cssText = 'background:transparent; border:1px solid rgba(255,255,255,0.15); color:#94a3b8; border-radius:8px; padding:6px 12px; font-size:12px; cursor:pointer;';
    closeBtn.onclick = () => this.close();
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Clone da hotbar dentro do próprio inventário: mostra os 9 slots disponíveis e deixa
    // escolher em qual deles o próximo item clicado vai ser equipado, sem precisar fechar
    // a janela pra ver a hotbar real (que fica atrás do backdrop, praticamente inacessível).
    const hotbarSection = document.createElement('div');
    hotbarSection.style.cssText = 'display:flex; flex-direction:column; gap:6px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:14px;';
    const hotbarLabel = document.createElement('span');
    hotbarLabel.style.cssText = 'font-size:11px; color:#94a3b8;';
    hotbarLabel.textContent = 'Sua Hotbar — clique num slot para escolher onde equipar o próximo item:';
    hotbarSection.appendChild(hotbarLabel);
    this.modalHotbarContainer = document.createElement('div');
    this.modalHotbarContainer.style.cssText = 'display:flex; gap:6px;';
    hotbarSection.appendChild(this.modalHotbarContainer);
    panel.appendChild(hotbarSection);

    // Corpo: crafting 6x6 à esquerda, paleta com abas à direita
    const body = document.createElement('div');
    body.style.cssText = 'display: flex; gap: 20px; overflow: hidden; flex: 1;';

    const craftCol = document.createElement('div');
    craftCol.style.cssText = 'display: flex; flex-direction: column; gap: 10px; width: 300px; flex-shrink: 0;';
    craftCol.innerHTML = `<h3 style="margin:0; font-size:13px; color:#94a3b8;">🔨 Mesa de Crafting (6×6)</h3>`;

    const craftGridEl = document.createElement('div');
    craftGridEl.id = 'craft-grid';
    craftGridEl.style.cssText = 'display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px;';
    craftCol.appendChild(craftGridEl);

    const craftFooter = document.createElement('div');
    craftFooter.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-top: 8px;';
    craftFooter.innerHTML = `
      <span style="font-size:11px; color:#94a3b8;">Clique com o bloco selecionado na hotbar para preencher; clique direito limpa uma célula.</span>
    `;
    craftCol.appendChild(craftFooter);

    const outputRow = document.createElement('div');
    outputRow.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-top: 4px;';
    outputRow.innerHTML = `<span style="font-size:12px; color:#94a3b8;">Resultado:</span>`;
    const outputSlot = document.createElement('div');
    outputSlot.id = 'craft-output';
    outputSlot.style.cssText = `
      width: 48px; height: 48px; border-radius: 8px;
      background: rgba(16, 185, 129, 0.15); border: 2px dashed #10b981;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
    `;
    outputRow.appendChild(outputSlot);
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '🗑️ Limpar Grade';
    clearBtn.style.cssText = 'background: rgba(239,68,68,0.15); border: 1px solid #ef4444; color:#ef4444; border-radius:8px; padding:6px 10px; font-size:11px; cursor:pointer;';
    clearBtn.onclick = () => { this.craftGrid = CraftingSystem.emptyGrid(6); this.renderCraftGrid(); };
    outputRow.appendChild(clearBtn);
    craftCol.appendChild(outputRow);

    body.appendChild(craftCol);

    const paletteCol = document.createElement('div');
    paletteCol.style.cssText = 'display: flex; flex-direction: column; gap: 10px; flex: 1; overflow: hidden;';

    const tabs = document.createElement('div');
    tabs.id = 'palette-tabs';
    tabs.style.cssText = 'display: flex; gap: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;';
    paletteCol.appendChild(tabs);

    const grid = document.createElement('div');
    grid.id = 'inventory-grid';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      overflow-y: auto;
      padding-right: 4px;
      flex: 1;
    `;
    paletteCol.appendChild(grid);

    body.appendChild(paletteCol);
    panel.appendChild(body);
    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    // Clicar no backdrop (fora do painel) fecha o inventário — clicar dentro do painel nunca
    // propaga até aqui porque cada card/slot tem seu próprio onclick, então isso só pega
    // cliques genuinamente fora do conteúdo.
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Listen for 'E' key toggle
    window.addEventListener('keydown', (e) => {
      if (e.key === 'e' || e.key === 'E') {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
        if (!isTyping && !this.blockOpen()) {
          if (!this.isOpen && !this.gateOpen()) {
            this.onBlockedByMode();
            return;
          }
          this.toggle();
        }
      }
    });

    this.interaction.onChanged = () => this.renderHotbar();
    this.renderHotbar();
  }

  /** Oculta a hotbar enquanto o MainMenu/Wizard ainda estão na tela (antes do jogo começar). */
  public setHotbarVisible(visible: boolean): void {
    this.hotbarContainer.style.display = visible ? 'flex' : 'none';
  }

  private buildHotbarSlotEl(i: number): HTMLDivElement {
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

    if (slot.structureId !== undefined) {
      const icon = document.createElement('div');
      icon.textContent = '🏗️';
      icon.style.cssText = 'font-size: 20px;';
      slotEl.appendChild(icon);
    } else if (slot.toolTier !== undefined) {
      const icon = document.createElement('div');
      icon.textContent = '⛏️';
      icon.style.cssText = 'font-size: 20px;';
      slotEl.appendChild(icon);
    } else {
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
    }

    if (!slot.infinite) {
      const countEl = document.createElement('span');
      countEl.style.cssText = 'position: absolute; bottom: 1px; right: 3px; font-size: 10px; color: #f8fafc; font-weight: 700; text-shadow: 0 1px 2px black;';
      countEl.textContent = String(slot.count);
      slotEl.appendChild(countEl);
    }

    slotEl.onclick = () => {
      this.interaction.selected = i;
      this.renderHotbar();
    };

    return slotEl;
  }

  /** Redesenha a hotbar real (HUD) e o clone dentro do inventário — sempre em sincronia. */
  public renderHotbar(): void {
    this.hotbarContainer.innerHTML = '';
    this.modalHotbarContainer.innerHTML = '';
    for (let i = 0; i < this.interaction.hotbar.length; i++) {
      this.hotbarContainer.appendChild(this.buildHotbarSlotEl(i));
      this.modalHotbarContainer.appendChild(this.buildHotbarSlotEl(i));
    }
  }

  private setTab(tab: PaletteTab): void {
    this.activeTab = tab;
    this.renderTabs();
    this.renderInventoryGrid();
  }

  private renderTabs(): void {
    const tabs = this.overlay.querySelector('#palette-tabs') as HTMLDivElement;
    if (!tabs) return;
    tabs.innerHTML = '';
    const defs: { id: PaletteTab; label: string }[] = [
      { id: 'blocks', label: '🧱 Blocos' },
      { id: 'interactive', label: '✨ Blocos Interativos' },
      { id: 'items', label: '⛏️ Itens' },
    ];
    for (const d of defs) {
      const btn = document.createElement('button');
      btn.textContent = d.label;
      const active = this.activeTab === d.id;
      btn.style.cssText = `
        background: ${active ? 'rgba(56,189,248,0.2)' : 'transparent'};
        border: 1px solid ${active ? '#38bdf8' : 'rgba(255,255,255,0.1)'};
        color: ${active ? '#38bdf8' : '#94a3b8'};
        border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
      `;
      btn.onclick = () => this.setTab(d.id);
      tabs.appendChild(btn);
    }
  }

  private makeCard(label: string, colorCss: string, onClick: () => void): HTMLDivElement {
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

    const icon = document.createElement('div');
    icon.style.cssText = `width: 32px; height: 32px; border-radius: 6px; background: ${colorCss}; border: 1px solid rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;`;

    const labelEl = document.createElement('span');
    labelEl.style.cssText = 'font-size: 11px; color: #f8fafc; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;';
    labelEl.textContent = label;

    itemCard.appendChild(icon);
    itemCard.appendChild(labelEl);
    itemCard.onclick = onClick;
    return itemCard;
  }

  public renderInventoryGrid(): void {
    const grid = this.overlay.querySelector('#inventory-grid') as HTMLDivElement;
    if (!grid) return;
    grid.innerHTML = '';

    if (this.activeTab === 'items') {
      const toolRecipes = this.crafting.recipes.filter((r) => r.outputTool);
      for (const r of toolRecipes) {
        const card = this.makeCard(r.outputTool!.label, '#94a3b8', () => {
          const slotIdx = this.interaction.selected;
          this.interaction.hotbar[slotIdx] = {
            label: r.outputTool!.label,
            block: -1,
            count: 1,
            infinite: true,
            toolTier: r.outputTool!.tier,
          };
          this.renderHotbar();
        });
        const icon = card.querySelector('div') as HTMLDivElement;
        icon.textContent = '⛏️';
        grid.appendChild(card);
      }

      // Estruturas prontas (árvore, casa, torre, muro) — "edifícios" como item, com preview
      // transparente ao mirar (Interaction.updateStructurePreview) e carimbagem ao colocar.
      for (const tpl of STRUCTURE_TEMPLATES) {
        const card = this.makeCard(tpl.name, '#22c55e', () => {
          const slotIdx = this.interaction.selected;
          this.interaction.hotbar[slotIdx] = {
            label: tpl.name,
            block: -1,
            count: 9999,
            infinite: true,
            structureId: tpl.id,
          };
          this.renderHotbar();
        });
        const icon = card.querySelector('div') as HTMLDivElement;
        icon.textContent = '🏗️';
        grid.appendChild(card);
      }
      return;
    }

    for (let i = 1; i < BLOCKS.length; i++) {
      const def = BLOCKS[i];
      if (!def) continue;
      const wantInteractive = this.activeTab === 'interactive';
      if (!!def.interactive !== wantInteractive) continue;

      const color = def.colors ? `rgb(${Math.round(def.colors[0][0]*255)}, ${Math.round(def.colors[0][1]*255)}, ${Math.round(def.colors[0][2]*255)})` : '#38bdf8';
      const card = this.makeCard(def.name, color, () => {
        const slotIdx = this.interaction.selected;
        this.interaction.hotbar[slotIdx] = { label: def.name, block: i, count: 9999, infinite: true };
        this.renderHotbar();
      });
      grid.appendChild(card);
    }
  }

  private renderCraftGrid(): void {
    const gridEl = this.overlay.querySelector('#craft-grid') as HTMLDivElement;
    const outputEl = this.overlay.querySelector('#craft-output') as HTMLDivElement;
    if (!gridEl || !outputEl) return;
    gridEl.innerHTML = '';

    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const cellVal = this.craftGrid[r][c];
        const cell = document.createElement('div');
        const bg = cellVal !== null && BLOCKS[cellVal]
          ? `rgb(${Math.round(BLOCKS[cellVal].colors[0][0]*255)}, ${Math.round(BLOCKS[cellVal].colors[0][1]*255)}, ${Math.round(BLOCKS[cellVal].colors[0][2]*255)})`
          : 'rgba(15,23,42,0.5)';
        cell.style.cssText = `width: 100%; aspect-ratio: 1; border-radius: 4px; background: ${bg}; border: 1px solid rgba(255,255,255,0.15); cursor: pointer;`;
        cell.onclick = () => {
          const selectedBlock = this.interaction.hotbar[this.interaction.selected]?.block;
          if (selectedBlock === undefined || selectedBlock < 0) return;
          this.craftGrid[r][c] = selectedBlock;
          this.renderCraftGrid();
        };
        cell.oncontextmenu = (e) => {
          e.preventDefault();
          this.craftGrid[r][c] = null;
          this.renderCraftGrid();
        };
        gridEl.appendChild(cell);
      }
    }

    const match = this.crafting.match(this.craftGrid);
    outputEl.innerHTML = '';
    if (match) {
      const icon = document.createElement('div');
      if (match.outputTool) {
        icon.textContent = '⛏️';
      } else if (match.outputBlock !== undefined && BLOCKS[match.outputBlock]) {
        const c = BLOCKS[match.outputBlock].colors[0];
        icon.style.cssText = `width: 28px; height: 28px; border-radius: 4px; background: rgb(${Math.round(c[0]*255)}, ${Math.round(c[1]*255)}, ${Math.round(c[2]*255)});`;
      }
      outputEl.appendChild(icon);
      outputEl.title = match.name;
      outputEl.onclick = () => this.collectCraft(match);
    } else {
      outputEl.onclick = null;
      outputEl.title = '';
    }
  }

  private collectCraft(recipe: CraftingRecipe): void {
    const slotIdx = this.interaction.selected;
    if (recipe.outputTool) {
      this.interaction.hotbar[slotIdx] = {
        label: recipe.outputTool.label,
        block: -1,
        count: 1,
        infinite: true,
        toolTier: recipe.outputTool.tier,
      };
    } else if (recipe.outputBlock !== undefined) {
      this.interaction.hotbar[slotIdx] = {
        label: BLOCKS[recipe.outputBlock]?.name || recipe.name,
        block: recipe.outputBlock,
        count: 9999,
        infinite: true,
      };
    }
    this.craftGrid = CraftingSystem.emptyGrid(6);
    this.renderHotbar();
    this.renderCraftGrid();
  }

  public open(): void {
    this.isOpen = true;
    this.renderHotbar();
    this.renderTabs();
    this.renderInventoryGrid();
    this.renderCraftGrid();
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
