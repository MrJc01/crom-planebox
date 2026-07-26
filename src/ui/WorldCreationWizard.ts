// Assistente de criação de mundo: configura tudo ANTES de gerar (nome, seed, terreno,
// modo de jogo padrão, se conecta à Crom) — em vez do antigo prompt() simplório de nome.
import { CAMADA } from './theme';
import { WorldRepository } from '../storage/WorldRepository';
import { WorldRecord, GameMode, CURRENT_SAVE_VERSION } from '../storage/Database';
import { BLOCKS, B } from '../world/blocks';
import { GAME_MODE_RULES, GameModeManager } from '../game/GameModeManager';

export class WorldCreationWizard {
  private overlay: HTMLDivElement;
  public isOpen = false;
  private onCreated: (world: WorldRecord) => void;

  constructor(onCreated: (world: WorldRecord) => void) {
    this.onCreated = onCreated;

    this.overlay = document.createElement('div');
    this.overlay.id = 'world-wizard';
    this.overlay.style.cssText = `
      position: fixed; inset: 0; z-index: ${CAMADA.assistente};
      background: rgba(6,10,20,0.9); backdrop-filter: blur(8px);
      display: none; align-items: center; justify-content: center;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #f8fafc;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      width: 480px; max-width: 92vw; max-height: 88vh; overflow-y: auto;
      background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 18px; padding: 24px; display: flex; flex-direction: column; gap: 16px;
    `;

    panel.innerHTML = `<h2 style="margin:0; font-size:18px;">Criar Novo Mundo</h2>`;

    const field = (labelText: string, inputHtml: string) => {
      const wrap = document.createElement('div');
      wrap.innerHTML = `<label style="display:block; font-size:11px; color:#94a3b8; margin-bottom:4px;">${labelText}</label>${inputHtml}`;
      return wrap;
    };

    const inputStyle = `width:100%; box-sizing:border-box; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:9px 11px; color:white; font-size:13px;`;

    panel.appendChild(field('Nome do Mundo', `<input id="wiz-name" style="${inputStyle}" value="Mundo ${Date.now().toString().slice(-4)}" />`));

    const seedRow = document.createElement('div');
    seedRow.style.cssText = 'display:flex; gap:8px; align-items:flex-end;';
    const seedField = field('Seed', `<input id="wiz-seed" type="number" style="${inputStyle}" value="${Math.floor(Math.random() * 1000000)}" />`);
    seedField.style.flex = '1';
    const diceBtn = document.createElement('button');
    diceBtn.textContent = '';
    diceBtn.style.cssText = 'background:rgba(56,189,248,0.15); border:1px solid #38bdf8; color:#38bdf8; border-radius:8px; padding:9px 12px; cursor:pointer;';
    diceBtn.onclick = () => { (this.overlay.querySelector('#wiz-seed') as HTMLInputElement).value = String(Math.floor(Math.random() * 1000000)); };
    seedRow.appendChild(seedField);
    seedRow.appendChild(diceBtn);
    panel.appendChild(seedRow);

    panel.appendChild(field('Altura do Solo', `<input id="wiz-ground" type="range" min="1" max="40" value="4" style="width:100%;" />`));

    const blockOptions = (defaultId: number) => BLOCKS.map((b, i) => b ? `<option value="${i}" ${i === defaultId ? 'selected' : ''}>${b.name}</option>` : '').join('');
    panel.appendChild(field('Bloco de Superfície', `<select id="wiz-surface" style="${inputStyle}">${blockOptions(B.GRASS)}</select>`));
    panel.appendChild(field('Bloco de Subsolo', `<select id="wiz-subsurface" style="${inputStyle}">${blockOptions(B.DIRT)}</select>`));

    const modeOptions = GameModeManager.allModes().map((m) => `<option value="${m}">${GAME_MODE_RULES[m].label}</option>`).join('');
    panel.appendChild(field('Modo de Jogo Padrão', `<select id="wiz-mode" style="${inputStyle}">${modeOptions}</select>`));

    const onlineWrap = document.createElement('div');
    onlineWrap.style.cssText = 'display:flex; align-items:center; gap:10px; background:rgba(15,23,42,0.5); padding:10px 12px; border-radius:8px;';
    onlineWrap.innerHTML = `
      <input id="wiz-online" type="checkbox" checked style="width:16px; height:16px; cursor:pointer;" />
      <label for="wiz-online" style="font-size:12px; cursor:pointer;">
        Conectar este mundo à Crom ao iniciar (gera um link compartilhável via P2P; nenhum dado do mundo é enviado ao relay — só sinalização)
      </label>
    `;
    panel.appendChild(onlineWrap);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex; justify-content:flex-end; gap:10px; margin-top:8px;';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.style.cssText = 'background:transparent; border:1px solid rgba(255,255,255,0.15); color:#94a3b8; border-radius:8px; padding:9px 16px; cursor:pointer;';
    cancelBtn.onclick = () => this.close();
    const createBtn = document.createElement('button');
    createBtn.textContent = 'Criar Mundo';
    createBtn.style.cssText = 'background:#10b981; color:white; border:none; border-radius:8px; padding:9px 20px; font-weight:700; cursor:pointer;';
    createBtn.onclick = () => this.createWorld();
    footer.appendChild(cancelBtn);
    footer.appendChild(createBtn);
    panel.appendChild(footer);

    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);
  }

  private async createWorld(): Promise<void> {
    const name = (this.overlay.querySelector('#wiz-name') as HTMLInputElement).value.trim() || 'Novo Mundo';
    const seed = Number((this.overlay.querySelector('#wiz-seed') as HTMLInputElement).value) || Math.floor(Math.random() * 1000000);
    const groundHeight = Number((this.overlay.querySelector('#wiz-ground') as HTMLInputElement).value) || 4;
    const defaultGameMode = (this.overlay.querySelector('#wiz-mode') as HTMLSelectElement).value as GameMode;
    const onlineEnabled = (this.overlay.querySelector('#wiz-online') as HTMLInputElement).checked;
    // Bloco de superfície/subsolo capturados na UI para uma futura geração customizada;
    // a geração procedural atual (worldgen.ts) usa sua própria lógica de bioma.

    const world: WorldRecord = {
      id: `world-${Date.now()}`,
      name,
      seed,
      groundHeight,
      fov: 75,
      cameraMode: GAME_MODE_RULES[defaultGameMode].cameraMode,
      defaultGameMode,
      onlineEnabled,
      saveVersion: CURRENT_SAVE_VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await WorldRepository.saveWorld(world);
    this.close();
    this.onCreated(world);
  }

  public open(): void {
    this.isOpen = true;
    this.overlay.style.display = 'flex';
  }

  public close(): void {
    this.isOpen = false;
    this.overlay.style.display = 'none';
  }
}
