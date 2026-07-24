// Pause Menu unificado em abas (substitui o SettingsModal). Cobre o pedido de que
// "o pause pode já mostrar tudo": mundo, modo de jogo, multiplayer/OP, jogador, IA e atalhos —
// tudo num só lugar, em vez de modais espalhados brigando por pointer lock/foco.
import { WorldRepository } from '../storage/WorldRepository';
import { CameraManager, CameraMode } from '../engine/CameraManager';
import { PlayerController } from '../player/controller';
import { GameModeManager, GAME_MODE_RULES } from '../game/GameModeManager';
import { PeerSync } from '../net/PeerSync';
import { SignalingClient } from '../net/SignalingClient';
import type { GameMode } from '../storage/Database';
import type { KnownPlayer } from '../commands/CommandSystem';

type TabId = 'world' | 'gamemode' | 'multiplayer' | 'player' | 'ai' | 'help';

export interface PauseMenuDeps {
  cameraManager: CameraManager;
  playerController: PlayerController;
  gameModeManager: GameModeManager;
  peerSync: PeerSync;
  signaling: SignalingClient;
  onWorldChange: (worldId: string) => void;
  getCurrentWorldName: () => string;
  /** Roster de jogadores (local + remotos) para a aba Multiplayer listar e gerenciar OP. */
  listPlayers: () => KnownPlayer[];
  setOp: (playerIdOrName: string, isOp: boolean) => boolean;
}

export class PauseMenu {
  public readonly id = 'pause';
  private overlay: HTMLDivElement;
  private body: HTMLDivElement;
  private tabsEl: HTMLDivElement;
  public isOpen = false;
  private activeTab: TabId = 'world';
  private lastRelayUrl = '';

  constructor(private deps: PauseMenuDeps) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'pause-menu';
    this.overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(12px);
      z-index: 1000; display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      width: 760px; max-width: 94vw; max-height: 88vh;
      background: rgba(15,23,42,0.96); border: 1px solid rgba(255,255,255,0.15);
      border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);
      display: flex; flex-direction: column; overflow: hidden; color: #f8fafc;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'padding: 16px 20px; background: rgba(30,41,59,0.7); border-bottom: 1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center;';
    header.innerHTML = `<div style="font-weight:700;">⏸️ Pausa &amp; Configurações</div>`;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background:transparent; border:none; color:#94a3b8; font-size:20px; cursor:pointer;';
    closeBtn.onclick = () => this.close();
    header.appendChild(closeBtn);
    modal.appendChild(header);

    const main = document.createElement('div');
    main.style.cssText = 'display:flex; flex:1; overflow:hidden;';

    this.tabsEl = document.createElement('div');
    this.tabsEl.style.cssText = 'width:180px; flex-shrink:0; background:rgba(30,41,59,0.4); border-right:1px solid rgba(255,255,255,0.08); padding:12px; display:flex; flex-direction:column; gap:4px;';
    main.appendChild(this.tabsEl);

    this.body = document.createElement('div');
    this.body.style.cssText = 'flex:1; padding:20px; overflow-y:auto;';
    main.appendChild(this.body);

    modal.appendChild(main);
    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);

    this.renderTabs();
    this.renderBody();
  }

  private tabDefs: { id: TabId; label: string }[] = [
    { id: 'world', label: '🌍 Mundo' },
    { id: 'gamemode', label: '🎮 Modo de Jogo' },
    { id: 'multiplayer', label: '🌐 Multiplayer' },
    { id: 'player', label: '🧍 Jogador' },
    { id: 'ai', label: '🤖 IA & MCP' },
    { id: 'help', label: '⌨️ Atalhos' },
  ];

  private renderTabs(): void {
    this.tabsEl.innerHTML = '';
    for (const t of this.tabDefs) {
      const btn = document.createElement('button');
      const active = this.activeTab === t.id;
      btn.textContent = t.label;
      btn.style.cssText = `
        text-align:left; background:${active ? 'rgba(56,189,248,0.15)' : 'transparent'};
        border:1px solid ${active ? '#38bdf8' : 'transparent'}; color:${active ? '#38bdf8' : '#cbd5e1'};
        border-radius:8px; padding:9px 12px; font-size:13px; font-weight:600; cursor:pointer;
      `;
      btn.onclick = () => { this.activeTab = t.id; this.renderTabs(); this.renderBody(); };
      this.tabsEl.appendChild(btn);
    }
  }

  private section(title: string): HTMLDivElement {
    const sec = document.createElement('div');
    sec.style.cssText = 'display:flex; flex-direction:column; gap:12px;';
    const h = document.createElement('h3');
    h.textContent = title;
    h.style.cssText = 'margin:0 0 4px; font-size:14px; color:#38bdf8;';
    sec.appendChild(h);
    return sec;
  }

  private inputRow(labelText: string, inputEl: HTMLElement): HTMLDivElement {
    const row = document.createElement('div');
    const label = document.createElement('label');
    label.textContent = labelText;
    label.style.cssText = 'display:block; font-size:11px; color:#94a3b8; margin-bottom:6px;';
    row.appendChild(label);
    row.appendChild(inputEl);
    return row;
  }

  private async renderBody(): Promise<void> {
    this.body.innerHTML = '';
    if (this.activeTab === 'world') await this.renderWorldTab();
    else if (this.activeTab === 'gamemode') this.renderGameModeTab();
    else if (this.activeTab === 'multiplayer') this.renderMultiplayerTab();
    else if (this.activeTab === 'player') this.renderPlayerTab();
    else if (this.activeTab === 'ai') await this.renderAiTab();
    else if (this.activeTab === 'help') this.renderHelpTab();
  }

  private async renderWorldTab(): Promise<void> {
    const sec = this.section('🌍 Mundo & Persistência');
    const inputStyle = 'width:100%; box-sizing:border-box; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:9px 11px; color:white; font-size:13px;';

    const worlds = await WorldRepository.getAllWorlds();
    const select = document.createElement('select');
    select.style.cssText = inputStyle;
    for (const w of worlds) {
      const opt = document.createElement('option');
      opt.value = w.id; opt.textContent = `${w.name} (${new Date(w.createdAt).toLocaleDateString()})`;
      select.appendChild(opt);
    }
    sec.appendChild(this.inputRow('Mundo Ativo', select));

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:10px;';
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '💾 Exportar (JSON)';
    exportBtn.style.cssText = 'background:rgba(30,41,59,0.8); border:1px solid #38bdf8; color:#38bdf8; padding:10px; border-radius:8px; font-weight:600; cursor:pointer;';
    exportBtn.onclick = async () => {
      const json = await WorldRepository.exportWorldJson(select.value);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `world-${select.value}.json`; a.click();
      URL.revokeObjectURL(url);
    };
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '⚠️ Resetar Blocos';
    resetBtn.style.cssText = 'background:rgba(239,68,68,0.15); border:1px solid #ef4444; color:#ef4444; padding:10px; border-radius:8px; font-weight:600; cursor:pointer;';
    resetBtn.onclick = async () => {
      if (confirm('Resetar todos os blocos deste mundo?')) {
        await WorldRepository.clearWorldBlockMods(select.value);
        this.deps.onWorldChange(select.value);
      }
    };
    btnRow.appendChild(exportBtn); btnRow.appendChild(resetBtn);
    sec.appendChild(btnRow);

    const switchBtn = document.createElement('button');
    switchBtn.textContent = '▶ Trocar para este Mundo';
    switchBtn.style.cssText = 'background:#0284c7; color:white; border:none; border-radius:8px; padding:10px; font-weight:700; cursor:pointer;';
    switchBtn.onclick = () => this.deps.onWorldChange(select.value);
    sec.appendChild(switchBtn);

    this.body.appendChild(sec);
  }

  private renderGameModeTab(): void {
    const sec = this.section('🎮 Modo de Jogo');
    const select = document.createElement('select');
    select.style.cssText = 'width:100%; box-sizing:border-box; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:9px 11px; color:white; font-size:13px;';
    for (const mode of GameModeManager.allModes()) {
      const opt = document.createElement('option');
      opt.value = mode; opt.textContent = GAME_MODE_RULES[mode].label;
      if (mode === this.deps.gameModeManager.mode) opt.selected = true;
      select.appendChild(opt);
    }
    sec.appendChild(this.inputRow('Modo Atual', select));

    const desc = document.createElement('p');
    desc.style.cssText = 'font-size:11px; color:#94a3b8; line-height:1.5;';
    desc.textContent = 'Clássico: modo atual (topo, construção livre). Sobrevivência: vida/fome, drops exigem ferramenta. Fantasma: voo livre sem colisão. Criativo: voo + inventário infinito + crafting 6x6. Aventura: só andar (usado por visitantes conectados via P2P).';
    sec.appendChild(desc);

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Aplicar Modo';
    applyBtn.style.cssText = 'background:#10b981; color:white; border:none; border-radius:8px; padding:10px; font-weight:700; cursor:pointer;';
    applyBtn.onclick = () => {
      this.deps.gameModeManager.setMode(select.value as GameMode);
      this.close();
    };
    sec.appendChild(applyBtn);

    this.body.appendChild(sec);
  }

  private renderMultiplayerTab(): void {
    const sec = this.section('🌐 Multiplayer & Crom');
    const inputStyle = 'width:100%; box-sizing:border-box; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:9px 11px; color:white; font-size:13px;';

    const relayInput = document.createElement('input');
    relayInput.placeholder = 'ws://seu-relay:8787 (opcional)';
    relayInput.style.cssText = inputStyle;
    relayInput.value = this.lastRelayUrl;
    sec.appendChild(this.inputRow('URL do Relay da Crom', relayInput));

    const statusEl = document.createElement('div');
    statusEl.style.cssText = 'font-size:12px; color:#94a3b8;';
    const role = this.deps.peerSync.role;
    statusEl.textContent = role === 'host'
      ? `Hospedando · sala ${this.deps.peerSync.roomId} · ${this.deps.peerSync.peerCount} jogador(es) conectado(s)`
      : role === 'guest' ? 'Conectado como visitante' : 'Offline (100% local)';
    sec.appendChild(statusEl);

    const linkRow = document.createElement('div');
    linkRow.style.cssText = 'display:flex; gap:8px;';
    const linkInput = document.createElement('input');
    linkInput.readOnly = true;
    linkInput.style.cssText = inputStyle;
    linkInput.value = this.deps.peerSync.roomId
      ? `${location.origin}${location.pathname}?join=${this.deps.peerSync.roomId}&relay=${encodeURIComponent(this.lastRelayUrl)}`
      : '';
    linkInput.placeholder = 'Conecte-se para gerar o link de convite';
    linkRow.appendChild(linkInput);
    sec.appendChild(this.inputRow('Link de Convite (P2P)', linkRow));

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:10px;';
    const connectBtn = document.createElement('button');
    connectBtn.textContent = '🔌 Conectar à Crom';
    connectBtn.style.cssText = 'background:rgba(16,185,129,0.15); border:1px solid #10b981; color:#10b981; padding:10px; border-radius:8px; font-weight:700; cursor:pointer;';
    connectBtn.onclick = async () => {
      this.lastRelayUrl = relayInput.value.trim();
      this.deps.signaling.configure(this.lastRelayUrl || null);
      const roomId = await this.deps.peerSync.hostRoom(this.deps.getCurrentWorldName());
      this.renderMultiplayerTab();
      if (!roomId) alert('Não foi possível conectar. Verifique a URL do relay.');
    };
    const disconnectBtn = document.createElement('button');
    disconnectBtn.textContent = '🔴 Desconectar';
    disconnectBtn.style.cssText = 'background:rgba(239,68,68,0.15); border:1px solid #ef4444; color:#ef4444; padding:10px; border-radius:8px; font-weight:700; cursor:pointer;';
    disconnectBtn.onclick = () => { this.deps.peerSync.stop(); this.renderMultiplayerTab(); };
    btnRow.appendChild(connectBtn); btnRow.appendChild(disconnectBtn);
    sec.appendChild(btnRow);

    const rosterTitle = document.createElement('div');
    rosterTitle.style.cssText = 'font-size:12px; color:#94a3b8; margin-top:8px;';
    rosterTitle.textContent = 'Jogadores conectados:';
    sec.appendChild(rosterTitle);

    const roster = document.createElement('div');
    roster.style.cssText = 'display:flex; flex-direction:column; gap:6px;';
    for (const p of this.deps.listPlayers()) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:8px 10px;';
      const label = document.createElement('span');
      label.style.cssText = 'font-size:12px;';
      label.textContent = `${p.isOp ? '⭐' : '👤'} ${p.name}`;
      row.appendChild(label);

      const opBtn = document.createElement('button');
      opBtn.textContent = p.isOp ? 'Revogar OP' : 'Conceder OP';
      opBtn.style.cssText = `background:${p.isOp ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}; border:1px solid ${p.isOp ? '#ef4444' : '#10b981'}; color:${p.isOp ? '#ef4444' : '#10b981'}; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer;`;
      opBtn.onclick = () => { this.deps.setOp(p.id, !p.isOp); this.renderMultiplayerTab(); };
      row.appendChild(opBtn);
      roster.appendChild(row);
    }
    sec.appendChild(roster);

    const note = document.createElement('p');
    note.style.cssText = 'font-size:11px; color:#64748b; line-height:1.5;';
    note.textContent = 'O relay só faz sinalização + diretório de salas (nome e nº de jogadores). Nenhum bloco, inventário ou chat passa por ele — tudo é P2P direto entre os clientes depois da conexão.';
    sec.appendChild(note);

    this.body.appendChild(sec);
  }

  private renderPlayerTab(): void {
    const sec = this.section('🧍 Câmera & Personagem');
    const inputStyle = 'width:100%; box-sizing:border-box; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:9px 11px; color:white; font-size:13px;';

    const camSelect = document.createElement('select');
    camSelect.style.cssText = inputStyle;
    const isCreative = this.deps.gameModeManager.mode === 'creative';
    const camModes: CameraMode[] = isCreative ? ['topdown', 'fps', 'ghost'] : ['fps', 'ghost'];
    const camLabels: Record<CameraMode, string> = { topdown: 'Top-Down (só no Criativo)', fps: 'Primeira Pessoa', ghost: 'Fantasma/Fly' };
    for (const m of camModes) {
      const opt = document.createElement('option'); opt.value = m; opt.textContent = camLabels[m];
      if (m === this.deps.cameraManager.mode) opt.selected = true;
      camSelect.appendChild(opt);
    }
    camSelect.onchange = () => this.deps.cameraManager.setMode(camSelect.value as CameraMode);
    sec.appendChild(this.inputRow('Modo de Câmera (manual)', camSelect));

    const fovInput = document.createElement('input');
    fovInput.type = 'range'; fovInput.min = '45'; fovInput.max = '110'; fovInput.value = String(this.deps.cameraManager.fov);
    fovInput.style.cssText = 'width:100%;';
    fovInput.oninput = () => this.deps.cameraManager.setFOV(Number(fovInput.value));
    sec.appendChild(this.inputRow(`Campo de Visão (FOV): ${this.deps.cameraManager.fov}°`, fovInput));

    const renderInput = document.createElement('input');
    renderInput.type = 'range'; renderInput.min = '2'; renderInput.max = '32'; renderInput.value = String(this.deps.cameraManager.renderDistance);
    renderInput.style.cssText = 'width:100%;';
    renderInput.oninput = () => this.deps.cameraManager.setRenderDistance(Number(renderInput.value));
    sec.appendChild(this.inputRow(`Distância de Renderização: ${this.deps.cameraManager.renderDistance} chunks`, renderInput));

    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🔄 Resetar Personagem (Spawn)';
    resetBtn.style.cssText = 'background:rgba(56,189,248,0.15); border:1px solid #38bdf8; color:#38bdf8; padding:10px; border-radius:8px; font-weight:700; cursor:pointer;';
    resetBtn.onclick = () => {
      this.deps.playerController.pos.set(0, 40, 0);
      this.deps.playerController.vel.set(0, 0, 0);
    };
    sec.appendChild(resetBtn);

    this.body.appendChild(sec);
  }

  private async renderAiTab(): Promise<void> {
    const sec = this.section('🤖 Provedor de IA & MCP');
    const inputStyle = 'width:100%; box-sizing:border-box; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:9px 11px; color:white; font-size:13px;';
    const settings = await WorldRepository.getSettings();

    const providerSelect = document.createElement('select');
    providerSelect.style.cssText = inputStyle;
    providerSelect.innerHTML = `<option value="openrouter">OpenRouter API</option><option value="google_aistudio">Google AI Studio (Gemini)</option>`;
    providerSelect.value = settings.provider;
    sec.appendChild(this.inputRow('Provedor de IA', providerSelect));

    const apiKeyInput = document.createElement('input');
    apiKeyInput.type = 'password'; apiKeyInput.style.cssText = inputStyle;
    apiKeyInput.value = settings.openRouterApiKey || '';
    apiKeyInput.placeholder = 'sk-or-v1-...';
    sec.appendChild(this.inputRow('Chave de API', apiKeyInput));

    const modelInput = document.createElement('input');
    modelInput.style.cssText = inputStyle;
    modelInput.value = settings.model || '';
    sec.appendChild(this.inputRow('Modelo LLM', modelInput));

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Salvar';
    saveBtn.style.cssText = 'background:#0284c7; color:white; border:none; border-radius:8px; padding:10px; font-weight:700; cursor:pointer;';
    saveBtn.onclick = async () => {
      await WorldRepository.saveSettings({
        provider: providerSelect.value as 'openrouter' | 'google_aistudio',
        openRouterApiKey: apiKeyInput.value.trim(),
        model: modelInput.value.trim(),
      });
      this.close();
    };
    sec.appendChild(saveBtn);

    this.body.appendChild(sec);
  }

  private renderHelpTab(): void {
    const sec = this.section('⌨️ Atalhos');
    const pre = document.createElement('div');
    pre.style.cssText = 'font-size:12px; line-height:2; color:#cbd5e1;';
    pre.innerHTML = `
      <strong>WASD</strong> mover · <strong>Espaço</strong> pular/voar · <strong>Shift</strong> correr/descer · <strong>F</strong> voo<br/>
      <strong>Clique Esq/Dir</strong> quebrar/colocar · <strong>Roda</strong> troca bloco · <strong>1-9</strong> hotbar<br/>
      <strong>E</strong> inventário criativo · <strong>T</strong> chat · <strong>ESC</strong> este menu<br/>
      <strong>Ctrl+1/2/3</strong> câmeras · <strong>Ctrl+Z/Y</strong> desfazer/refazer
    `;
    sec.appendChild(pre);
    this.body.appendChild(sec);
  }

  public open(): void {
    this.isOpen = true;
    this.overlay.style.opacity = '1';
    this.overlay.style.pointerEvents = 'auto';
    this.renderBody();
  }

  public close(): void {
    this.isOpen = false;
    this.overlay.style.opacity = '0';
    this.overlay.style.pointerEvents = 'none';
  }
}
