import { durabilityForTier } from '../entities/Combat';
import { BLOCKS } from '../world/blocks';
import { Interaction } from '../player/interaction';
import { CraftingSystem, CraftCell, CraftingRecipe } from '../crafting/CraftingSystem';
import { STRUCTURE_TEMPLATES } from '../crafting/StructureTemplates';
import { Tabs } from './Tabs';
import { CAMADA, CORES, RAIO } from './theme';
import { icone } from './icons';

type PaletteTab = 'blocks' | 'interactive' | 'items';

export class InventoryModal {
  public readonly id = 'inventory';
  private overlay: HTMLDivElement;

  /** Raiz no DOM, para a armadilha de foco do `UIManager` prender o Tab aqui dentro. */
  public get raiz(): HTMLElement { return this.overlay; }
  private hotbarContainer: HTMLDivElement;
  private modalHotbarContainer: HTMLDivElement;
  private statsPanelContainer: HTMLDivElement;
  public isOpen = false;
  private interaction: Interaction;
  private crafting = new CraftingSystem();
  private activePaletteTab: PaletteTab = 'blocks';
  private craftGrid: CraftCell[][] = CraftingSystem.emptyGrid(6);
  private tabsComponent: Tabs;

  /** true bloqueia totalmente o atalho [E] (ex.: Pause Menu aberto). */
  public blockOpen: () => boolean = () => false;
  /** false impede ABRIR o inventário criativo (ex.: modo de jogo sem inventário criativo). */
  public gateOpen: () => boolean = () => true;
  public onBlockedByMode: () => void = () => {};

  constructor(interaction: Interaction) {
    this.interaction = interaction;

    // Hotbar UI na parte inferior da tela
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
      z-index: ${CAMADA.hotbar};
      user-select: none;
    `;
    document.body.appendChild(this.hotbarContainer);

    // Overlay do modal de inventário — agora fullscreen
    this.overlay = document.createElement('div');
    this.overlay.id = 'inventory-modal';
    this.overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(6, 10, 20, 0.82);
      backdrop-filter: blur(10px);
      display: flex; flex-direction: column;
      z-index: ${CAMADA.tela};
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      user-select: none;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: white;
    `;

    /* Header full-width no topo */
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 40px; flex: 0 0 auto;
      background: rgba(15, 23, 42, 0.7);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    `;
    header.innerHTML = `
      <h2 style="margin:0; font-size:17px; font-weight:700; color:${CORES.aviso}; display:flex; align-items:center; gap:8px; letter-spacing:1px;">
        INVENTÁRIO E CRAFTING
      </h2>
    `;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Fechar [E]';
    closeBtn.style.cssText = `background:transparent; border:1px solid rgba(255,255,255,0.15); color:#94a3b8; border-radius:${RAIO.sm}; padding:6px 14px; font-size:12px; cursor:pointer; transition: background .12s;`;
    closeBtn.onmouseenter = () => { closeBtn.style.background = 'rgba(255,255,255,0.06)'; };
    closeBtn.onmouseleave = () => { closeBtn.style.background = 'transparent'; };
    closeBtn.onclick = () => this.close();
    header.appendChild(closeBtn);
    this.overlay.appendChild(header);

    // Hotbar na parte superior (abaixo do header)
    const hotbarSection = document.createElement('div');
    hotbarSection.style.cssText = 'display:flex; flex-direction:column; gap:6px; border-bottom:1px solid rgba(255,255,255,0.08); padding:10px 40px; flex: 0 0 auto;';
    const hotbarLabel = document.createElement('span');
    hotbarLabel.style.cssText = 'font-size:11px; color:#94a3b8;';
    hotbarLabel.textContent = 'Sua Hotbar — clique num slot para escolher onde equipar o item:';
    hotbarSection.appendChild(hotbarLabel);
    this.modalHotbarContainer = document.createElement('div');
    this.modalHotbarContainer.style.cssText = 'display:flex; gap:6px;';
    hotbarSection.appendChild(this.modalHotbarContainer);
    this.overlay.appendChild(hotbarSection);

    // Layout em 2 Colunas — ocupa todo o espaço restante
    const twoColBody = document.createElement('div');
    twoColBody.style.cssText = 'display:flex; gap:16px; flex:1; min-height:0; overflow:hidden; padding: 16px 40px;';

    const leftCol = document.createElement('div');
    leftCol.style.cssText = 'flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden;';

    // Instancia o componente Tabs padronizado
    this.tabsComponent = new Tabs();

    // Aba 1: Catálogo de Blocos e Itens
    this.tabsComponent.adicionar({
      id: 'catalog',
      titulo: 'Catálogo Criativo',
      icone: 'mundo',
      montar: (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:10px; height:100%; min-height:0;';
        
        const subTabs = document.createElement('div');
        subTabs.style.cssText = 'display:flex; gap:6px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;';
        
        const subDefs: { id: PaletteTab; label: string }[] = [
          { id: 'blocks', label: 'Blocos' },
          { id: 'interactive', label: 'Interativos' },
          { id: 'items', label: 'Ferramentas & Estruturas' },
        ];

        for (const sub of subDefs) {
          const btn = document.createElement('button');
          btn.textContent = sub.label;
          btn.dataset.subtab = sub.id;
          const active = this.activePaletteTab === sub.id;
          btn.style.cssText = `
            background:${active ? 'rgba(56,189,248,0.2)' : 'transparent'};
            border:1px solid ${active ? '#38bdf8' : 'rgba(255,255,255,0.1)'};
            color:${active ? '#38bdf8' : '#94a3b8'};
            border-radius:6px; padding:5px 10px; font-size:12px; font-weight:600; cursor:pointer;
          `;
          btn.onclick = () => {
            this.activePaletteTab = sub.id;
            subTabs.querySelectorAll('button').forEach((b) => {
              const isSub = b.dataset.subtab === sub.id;
              b.style.background = isSub ? 'rgba(56,189,248,0.2)' : 'transparent';
              b.style.borderColor = isSub ? '#38bdf8' : 'rgba(255,255,255,0.1)';
              b.style.color = isSub ? '#38bdf8' : '#94a3b8';
            });
            this.renderInventoryGrid(container);
          };
          subTabs.appendChild(btn);
        }
        container.appendChild(subTabs);

        const grid = document.createElement('div');
        grid.id = 'inventory-grid-container';
        grid.style.cssText = 'display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; overflow-y:auto; flex:1; padding-right:4px;';
        container.appendChild(grid);

        this.renderInventoryGrid(container);
      },
    });

    // Aba 2: Mesa de Crafting (6x6)
    this.tabsComponent.adicionar({
      id: 'crafting',
      titulo: 'Mesa de Crafting 6×6',
      icone: 'crafting',
      montar: (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:10px; height:100%; min-height:0; overflow-y:auto;';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:12px; color:#94a3b8;';
        title.textContent = 'Monte receitas 6×6 ou selecione da biblioteca de receitas:';
        container.appendChild(title);

        const craftGridEl = document.createElement('div');
        craftGridEl.id = 'modal-craft-grid';
        craftGridEl.style.cssText = 'display:grid; grid-template-columns:repeat(6, 1fr); gap:4px; width:260px; margin:0 auto;';
        container.appendChild(craftGridEl);

        const outputRow = document.createElement('div');
        outputRow.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:12px; margin-top:6px;';
        outputRow.innerHTML = `<span style="font-size:12px; color:#94a3b8;">Resultado:</span>`;

        const outputSlot = document.createElement('div');
        outputSlot.id = 'modal-craft-output';
        outputSlot.style.cssText = `
          width: 48px; height: 48px; border-radius: 8px;
          background: rgba(16, 185, 129, 0.15); border: 2px dashed #10b981;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        `;
        outputRow.appendChild(outputSlot);

        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Limpar Grade';
        clearBtn.style.cssText = 'background:rgba(239,68,68,0.15); border:1px solid #ef4444; color:#ef4444; border-radius:6px; padding:6px 10px; font-size:11px; font-weight:600; cursor:pointer;';
        clearBtn.onclick = () => { this.craftGrid = CraftingSystem.emptyGrid(6); this.renderCraftGrid(container); };
        outputRow.appendChild(clearBtn);

        container.appendChild(outputRow);
        this.renderCraftGrid(container);
      },
    });

    leftCol.appendChild(this.tabsComponent.raiz);
    twoColBody.appendChild(leftCol);

    // Coluna Direita: Stats & Equipamento do Personagem
    const rightCol = document.createElement('div');
    rightCol.style.cssText = `
      width: 260px;
      flex-shrink: 0;
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    const charTitle = document.createElement('div');
    charTitle.style.cssText = 'font-size:13px; font-weight:700; color:#38bdf8; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:6px; display:flex; align-items:center; gap:6px;';
    charTitle.append(icone('personagem', 16));
    const titleText = document.createElement('span');
    titleText.textContent = 'Status do Personagem';
    charTitle.append(titleText);
    rightCol.appendChild(charTitle);

    this.statsPanelContainer = document.createElement('div');
    this.statsPanelContainer.style.cssText = 'display:flex; flex-direction:column; gap:10px; font-size:12px; color:#cbd5e1;';
    rightCol.appendChild(this.statsPanelContainer);

    twoColBody.appendChild(rightCol);
    this.overlay.appendChild(twoColBody);
    document.body.appendChild(this.overlay);

    this.interaction.onChanged = () => {
      this.renderHotbar();
      this.renderStatsPanel();
    };

    this.renderHotbar();
    this.tabsComponent.iniciar();
  }

  public setHotbarVisible(visible: boolean): void {
    this.hotbarContainer.style.display = visible ? 'flex' : 'none';
  }

  private buildHotbarSlotEl(i: number): HTMLDivElement {
    const slot = this.interaction.hotbar[i];
    const isSelected = i === this.interaction.selected;

    const slotEl = document.createElement('div');
    slotEl.style.cssText = `
      width: 44px;
      height: 44px;
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
    num.style.cssText = 'position: absolute; top: 2px; left: 4px; font-size: 10px; color: #94a3b8; font-weight: 700;';
    num.textContent = String(i + 1);
    slotEl.appendChild(num);

    if (slot.structureId !== undefined) {
      const icon = document.createElement('div');
      icon.style.cssText = 'color: #4ade80; display:flex; align-items:center; justify-content:center;';
      icon.append(icone('mundo', 18));
      slotEl.appendChild(icon);
    } else if (slot.toolTier !== undefined) {
      const icon = document.createElement('div');
      icon.style.cssText = 'color: #38bdf8; display:flex; align-items:center; justify-content:center;';
      icon.append(icone('crafting', 18));
      slotEl.appendChild(icon);

      if (slot.durability !== undefined && slot.maxDurability) {
        const frac = Math.max(0, slot.durability / slot.maxDurability);
        const bar = document.createElement('div');
        bar.style.cssText = 'position: absolute; left: 4px; right: 4px; bottom: 3px; height: 3px; background: rgba(0,0,0,0.55); border-radius: 2px; overflow: hidden;';
        const fill = document.createElement('div');
        fill.style.cssText = `width: ${(frac * 100).toFixed(0)}%; height: 100%; background: ${frac > 0.5 ? '#4ade80' : frac > 0.2 ? '#fbbf24' : '#ef4444'};`;
        bar.appendChild(fill);
        slotEl.appendChild(bar);
      }
    } else {
      const blockDef = BLOCKS[slot.block];
      if (blockDef) {
        const icon = document.createElement('div');
        const color = blockDef.colors ? `rgb(${Math.round(blockDef.colors[0][0]*255)}, ${Math.round(blockDef.colors[0][1]*255)}, ${Math.round(blockDef.colors[0][2]*255)})` : '#38bdf8';
        icon.style.cssText = `width: 18px; height: 18px; border-radius: 4px; background: ${color}; border: 1px solid rgba(0,0,0,0.3); box-shadow: inset 0 0 4px rgba(255,255,255,0.4);`;
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
      this.renderStatsPanel();
    };

    return slotEl;
  }

  public renderHotbar(): void {
    this.hotbarContainer.innerHTML = '';
    this.modalHotbarContainer.innerHTML = '';
    for (let i = 0; i < this.interaction.hotbar.length; i++) {
      this.hotbarContainer.appendChild(this.buildHotbarSlotEl(i));
      this.modalHotbarContainer.appendChild(this.buildHotbarSlotEl(i));
    }
  }

  private renderStatsPanel(): void {
    if (!this.statsPanelContainer) return;
    this.statsPanelContainer.innerHTML = '';

    const selectedSlot = this.interaction.hotbar[this.interaction.selected];
    const equippedName = selectedSlot?.label || 'Mão vazia';

    const itemBox = document.createElement('div');
    itemBox.style.cssText = 'background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:4px;';
    itemBox.innerHTML = `
      <span style="font-size:10px; color:#94a3b8;">Item Selecionado:</span>
      <span style="font-size:12px; font-weight:700; color:#38bdf8;">${equippedName}</span>
      <span style="font-size:10px; color:#64748b;">Slot ${this.interaction.selected + 1} de 9</span>
    `;
    this.statsPanelContainer.appendChild(itemBox);

    const statsList = document.createElement('div');
    statsList.style.cssText = 'display:flex; flex-direction:column; gap:8px;';
    statsList.innerHTML = `
      <div style="display:flex; justify-content:space-between;">
        <span style="color:#94a3b8;">Construção:</span>
        <span style="color:#4ade80; font-weight:600;">Livre</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:#94a3b8;">Alcance:</span>
        <span style="color:#f8fafc; font-weight:600;">6 voxels</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:#94a3b8;">Inventário:</span>
        <span style="color:#f8fafc; font-weight:600;">Infinito</span>
      </div>
    `;
    this.statsPanelContainer.appendChild(statsList);
  }

  private makeCard(label: string, colorCss: string, onClick: () => void): HTMLDivElement {
    const itemCard = document.createElement('div');
    itemCard.style.cssText = `
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 8px;
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
    icon.style.cssText = `width: 28px; height: 28px; border-radius: 6px; background: ${colorCss}; border: 1px solid rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;`;

    const labelEl = document.createElement('span');
    labelEl.style.cssText = 'font-size: 11px; color: #f8fafc; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;';
    labelEl.textContent = label;

    itemCard.appendChild(icon);
    itemCard.appendChild(labelEl);
    itemCard.onclick = onClick;
    return itemCard;
  }

  public renderInventoryGrid(container?: HTMLElement): void {
    const grid = (container || this.overlay).querySelector('#inventory-grid-container') as HTMLDivElement;
    if (!grid) return;
    grid.innerHTML = '';

    if (this.activePaletteTab === 'items') {
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
          this.renderStatsPanel();
        });
        grid.appendChild(card);
      }

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
          this.renderStatsPanel();
        });
        grid.appendChild(card);
      }
      return;
    }

    for (let i = 1; i < BLOCKS.length; i++) {
      const def = BLOCKS[i];
      if (!def) continue;
      const wantInteractive = this.activePaletteTab === 'interactive';
      if (!!def.interactive !== wantInteractive) continue;

      const color = def.colors ? `rgb(${Math.round(def.colors[0][0]*255)}, ${Math.round(def.colors[0][1]*255)}, ${Math.round(def.colors[0][2]*255)})` : '#38bdf8';
      const card = this.makeCard(def.name, color, () => {
        const slotIdx = this.interaction.selected;
        this.interaction.hotbar[slotIdx] = { label: def.name, block: i, count: 9999, infinite: true };
        this.renderHotbar();
        this.renderStatsPanel();
      });
      grid.appendChild(card);
    }
  }

  private renderCraftGrid(container?: HTMLElement): void {
    const gridEl = (container || this.overlay).querySelector('#modal-craft-grid') as HTMLDivElement;
    const outputEl = (container || this.overlay).querySelector('#modal-craft-output') as HTMLDivElement;
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
          this.renderCraftGrid(container);
        };
        cell.oncontextmenu = (e) => {
          e.preventDefault();
          this.craftGrid[r][c] = null;
          this.renderCraftGrid(container);
        };
        gridEl.appendChild(cell);
      }
    }

    const match = this.crafting.match(this.craftGrid);
    outputEl.innerHTML = '';
    if (match) {
      const icon = document.createElement('div');
      if (match.outputTool) {
        icon.style.cssText = 'color: #38bdf8; display:flex; align-items:center; justify-content:center;';
        icon.append(icone('crafting', 20));
      } else if (match.outputBlock !== undefined && BLOCKS[match.outputBlock]) {
        const c = BLOCKS[match.outputBlock].colors[0];
        icon.style.cssText = `width: 28px; height: 28px; border-radius: 4px; background: rgb(${Math.round(c[0]*255)}, ${Math.round(c[1]*255)}, ${Math.round(c[2]*255)});`;
      }
      outputEl.appendChild(icon);
      outputEl.title = match.name;
      outputEl.onclick = () => this.collectCraft(match, container);
    } else {
      outputEl.onclick = null;
      outputEl.title = '';
    }
  }

  private collectCraft(recipe: CraftingRecipe, container?: HTMLElement): void {
    const slotIdx = this.interaction.selected;
    if (recipe.outputTool) {
      const usos = durabilityForTier(recipe.outputTool.tier);
      this.interaction.hotbar[slotIdx] = {
        label: recipe.outputTool.label,
        block: -1,
        count: 1,
        infinite: true,
        toolTier: recipe.outputTool.tier,
        durability: Number.isFinite(usos) ? usos : undefined,
        maxDurability: Number.isFinite(usos) ? usos : undefined,
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
    this.renderStatsPanel();
    this.renderCraftGrid(container);
  }

  public open(): void {
    if (!this.gateOpen()) {
      this.onBlockedByMode();
      return;
    }
    this.isOpen = true;
    this.renderHotbar();
    this.renderStatsPanel();
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
