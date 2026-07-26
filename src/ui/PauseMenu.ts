// Hub Unificado — o Esc abre esta tela, que concentra TUDO.
// Antes havia um GameMenu separado; agora as funções dele (áudio, atalhos, navegação rápida)
// vivem aqui como abas e botões no header.
import { WorldRepository } from '../storage/WorldRepository';
import { CameraManager, CameraMode } from '../engine/CameraManager';
import { PlayerController } from '../player/controller';
import { GameModeManager, GAME_MODE_RULES } from '../game/GameModeManager';
import { PeerSync } from '../net/PeerSync';
import { SignalingClient } from '../net/SignalingClient';
import type { GameMode } from '../storage/Database';
import { CORES, RAIO, botao, cartao, deslizante, rotulo } from './theme';
import { NomeIcone, icone } from './icons';
import type { KnownPlayer } from '../commands/CommandSystem';
import { Tabs } from './Tabs';
import { AudioChannel, AudioSystem } from '../audio/AudioSystem';

type TabId = 'world' | 'gamemode' | 'multiplayer' | 'player' | 'ai' | 'help' | 'settings';

/** Atalho de navegação rápida — abre outra tela (Personagem, Mods, etc.) direto do hub. */
export interface AtalhoRapido {
  icone: NomeIcone;
  titulo: string;
  tecla: string;
  acao: () => void;
}

export interface PauseMenuDeps {
  cameraManager: CameraManager;
  playerController: PlayerController;
  gameModeManager: GameModeManager;
  peerSync: PeerSync;
  signaling: SignalingClient;
  audio: AudioSystem;
  onWorldChange: (worldId: string) => void;
  getCurrentWorldName: () => string;
  listPlayers: () => KnownPlayer[];
  getGradacao: () => string;
  setGradacao: (id: string) => void;
  getFadeChunks: () => boolean;
  setFadeChunks: (v: boolean) => void;
  setOp: (playerIdOrName: string, isOp: boolean) => boolean;
  onSairParaMenuInicial: () => void;
  atalhosRapidos: AtalhoRapido[];
}

export class PauseMenu {
  public readonly id = 'pause';
  private overlay: HTMLDivElement;
  private tabsComponent: Tabs;
  public isOpen = false;
  private lastRelayUrl = '';

  constructor(private deps: PauseMenuDeps) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'pause-menu';
    this.overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(6,10,20,0.82); backdrop-filter: blur(10px);
      z-index: 1000; display: flex; flex-direction: column;
      opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #f8fafc;
    `;

    /* Header full-width no topo */
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 40px; background: rgba(15,23,42,0.7);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex; justify-content: space-between; align-items: center; flex: 0 0 auto;
    `;

    /* Lado esquerdo: logo + atalhos rápidos */
    const headerLeft = document.createElement('div');
    headerLeft.style.cssText = 'display:flex; align-items:center; gap:20px;';
    headerLeft.innerHTML = `<div style="font-weight:700; color:${CORES.aviso}; font-size:17px; letter-spacing:1px;">CROM PLANEBOX</div>`;

    /* Botões de navegação rápida (Personagem, Mods, Editor, Inventário) */
    const quickNav = document.createElement('div');
    quickNav.style.cssText = 'display:flex; gap:6px; align-items:center;';
    for (const ar of deps.atalhosRapidos) {
      const qb = document.createElement('button');
      qb.style.cssText = `
        display:inline-flex; align-items:center; gap:5px;
        background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.10);
        color:${CORES.textoFraco}; border-radius:6px; padding:4px 10px;
        font-size:11px; font-family:inherit; cursor:pointer; transition: background .12s, color .12s, border-color .12s;
      `;
      qb.append(icone(ar.icone, 14));
      const ql = document.createElement('span');
      ql.textContent = ar.titulo;
      qb.append(ql);
      if (ar.tecla) {
        const kt = document.createElement('span');
        kt.textContent = ar.tecla;
        kt.style.cssText = `font-size:10px; color:${CORES.textoApagado}; border:1px solid ${CORES.borda}; border-radius:3px; padding:0 4px; margin-left:4px;`;
        qb.append(kt);
      }
      qb.onmouseenter = () => { qb.style.borderColor = CORES.aviso; qb.style.color = CORES.aviso; qb.style.background = 'rgba(251,191,36,0.08)'; };
      qb.onmouseleave = () => { qb.style.borderColor = 'rgba(255,255,255,0.10)'; qb.style.color = CORES.textoFraco; qb.style.background = 'rgba(255,255,255,0.04)'; };
      qb.onclick = () => ar.acao();
      quickNav.appendChild(qb);
    }
    headerLeft.appendChild(quickNav);
    header.appendChild(headerLeft);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Voltar ao Jogo [Esc]';
    closeBtn.style.cssText = `background:transparent; border:1px solid rgba(255,255,255,0.15); color:#94a3b8; border-radius:${RAIO.sm}; padding:6px 14px; font-size:12px; cursor:pointer; transition: background .12s;`;
    closeBtn.onmouseenter = () => { closeBtn.style.background = 'rgba(255,255,255,0.06)'; };
    closeBtn.onmouseleave = () => { closeBtn.style.background = 'transparent'; };
    closeBtn.onclick = () => this.close();
    header.appendChild(closeBtn);
    this.overlay.appendChild(header);

    // Instancia o componente central Tabs (Top Tabs Bar + Dynamic Content + Bottom Bar)
    this.tabsComponent = new Tabs();
    this.setupTabs();

    /* Tabs ocupa todo o espaço restante */
    this.tabsComponent.raiz.style.flex = '1 1 auto';
    this.tabsComponent.raiz.style.minHeight = '0';
    this.overlay.appendChild(this.tabsComponent.raiz);
    document.body.appendChild(this.overlay);
  }

  private setupTabs(): void {
    // Aba Mundo
    this.tabsComponent.adicionar({
      id: 'world',
      titulo: 'Mundo',
      icone: 'mundo',
      montar: async (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:16px; height:100%; overflow-y:auto;';
        await this.renderWorldTab(container);
      },
    });

    // Aba Modo de Jogo
    this.tabsComponent.adicionar({
      id: 'gamemode',
      titulo: 'Modo de Jogo',
      icone: 'jogar',
      montar: (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:16px; height:100%; overflow-y:auto;';
        this.renderGameModeTab(container);
      },
    });

    // Aba Multiplayer
    this.tabsComponent.adicionar({
      id: 'multiplayer',
      titulo: 'Multiplayer',
      icone: 'rede',
      montar: (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:16px; height:100%; overflow-y:auto;';
        this.renderMultiplayerTab(container);
      },
    });

    // Aba Jogador
    this.tabsComponent.adicionar({
      id: 'player',
      titulo: 'Jogador & Câmera',
      icone: 'personagem',
      montar: (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:16px; height:100%; overflow-y:auto;';
        this.renderPlayerTab(container);
      },
    });

    // Aba IA & MCP
    this.tabsComponent.adicionar({
      id: 'ai',
      titulo: 'IA & MCP',
      icone: 'chat',
      montar: async (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:16px; height:100%; overflow-y:auto;';
        await this.renderAiTab(container);
      },
    });

    // Aba Atalhos
    this.tabsComponent.adicionar({
      id: 'help',
      titulo: 'Atalhos',
      icone: 'engrenagem',
      montar: (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:16px; height:100%; overflow-y:auto;';
        this.renderHelpTab(container);
      },
    });

    // Aba Configurações (áudio + sair) — vindo do antigo GameMenu
    this.tabsComponent.adicionar({
      id: 'settings',
      titulo: 'Configurações',
      icone: 'engrenagem',
      montar: (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:16px; height:100%; overflow-y:auto;';
        this.renderSettingsTab(container);
      },
    });
  }

  private section(title: string, ic?: NomeIcone): HTMLDivElement {
    const sec = document.createElement('div');
    sec.style.cssText = 'display:flex; flex-direction:column; gap:12px;';
    const h = document.createElement('h3');
    h.style.cssText = `margin:0 0 4px; font-size:14px; color:${CORES.aviso}; display:flex; align-items:center; gap:9px;`;
    if (ic) h.append(icone(ic, 18));
    const t = document.createElement('span');
    t.textContent = title;
    h.append(t);
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

  private async renderWorldTab(container: HTMLElement): Promise<void> {
    const sec = this.section('Mundo e Persistência', 'mundo');
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
    exportBtn.textContent = 'Exportar (JSON)';
    exportBtn.style.cssText = 'background:rgba(30,41,59,0.8); border:1px solid #38bdf8; color:#38bdf8; padding:10px; border-radius:8px; font-weight:600; cursor:pointer;';
    exportBtn.onclick = async () => {
      const json = await WorldRepository.exportWorldJson(select.value);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `world-${select.value}.json`; a.click();
      URL.revokeObjectURL(url);
    };
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Resetar Blocos';
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

    container.appendChild(sec);
  }

  private renderGameModeTab(container: HTMLElement): void {
    const sec = this.section('Modo de Jogo', 'jogar');
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

    container.appendChild(sec);
  }

  private renderMultiplayerTab(container: HTMLElement): void {
    const sec = this.section('Multiplayer e Crom', 'rede');
    const inputStyle = 'width:100%; box-sizing:border-box; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:9px 11px; color:white; font-size:13px;';

    if (!this.lastRelayUrl) {
      this.lastRelayUrl = 'ws://localhost:8787';
    }

    const modeSelect = document.createElement('select');
    modeSelect.style.cssText = inputStyle;
    modeSelect.innerHTML = `
      <option value="ws">Servidor Relay (WebSocket)</option>
      <option value="local">Modo Local (Abas do mesmo navegador)</option>
      <option value="manual">Sinalização Manual (Copiar/Colar Token)</option>
    `;
    sec.appendChild(this.inputRow('Modo de Conexão', modeSelect));

    const relayContainer = document.createElement('div');
    relayContainer.style.cssText = 'display:flex; flex-direction:column; gap:10px;';

    const relayInput = document.createElement('input');
    relayInput.placeholder = 'ws://localhost:8787';
    relayInput.style.cssText = inputStyle;
    relayInput.value = this.lastRelayUrl;
    relayContainer.appendChild(this.inputRow('URL do Relay da Crom', relayInput));

    sec.appendChild(relayContainer);

    const manualContainer = document.createElement('div');
    manualContainer.style.cssText = 'display:none; flex-direction:column; gap:10px; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:12px; background:rgba(15,23,42,0.4);';

    const tokenInput = document.createElement('textarea');
    tokenInput.placeholder = 'Cole o token recebido aqui...';
    tokenInput.style.cssText = 'width:100%; height:60px; box-sizing:border-box; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:8px; color:white; font-size:11px; font-family:monospace; resize:none;';
    manualContainer.appendChild(this.inputRow('Token de Sinalização Manual', tokenInput));

    const manualBtnRow = document.createElement('div');
    manualBtnRow.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:10px;';

    const hostTokenBtn = document.createElement('button');
    hostTokenBtn.textContent = 'Gerar Token de Host';
    hostTokenBtn.style.cssText = 'background:#0284c7; color:white; border:none; border-radius:6px; padding:8px; font-size:12px; font-weight:700; cursor:pointer;';
    hostTokenBtn.onclick = async () => {
      const token = await this.deps.peerSync.createManualOfferToken();
      tokenInput.value = token;
      await navigator.clipboard?.writeText(token);
      alert('Token de host gerado e copiado para a área de transferência! Envie para o seu amigo.');
    };

    const joinTokenBtn = document.createElement('button');
    joinTokenBtn.textContent = 'Aceitar Token (Guest/Host)';
    joinTokenBtn.style.cssText = 'background:#10b981; color:white; border:none; border-radius:6px; padding:8px; font-size:12px; font-weight:700; cursor:pointer;';
    joinTokenBtn.onclick = async () => {
      const val = tokenInput.value.trim();
      if (!val) { alert('Cole o token no campo acima primeiro.'); return; }
      try {
        if (this.deps.peerSync.role === 'host') {
          const ok = await this.deps.peerSync.acceptManualAnswerToken(val);
          alert(ok ? 'Conexão concluída com sucesso!' : 'Falha ao processar token de resposta.');
        } else {
          const answerToken = await this.deps.peerSync.acceptManualOfferToken(val);
          tokenInput.value = answerToken;
          await navigator.clipboard?.writeText(answerToken);
          alert('Token de resposta gerado e copiado! Envie de volta para o Host para finalizar a conexão.');
        }
        this.renderMultiplayerTab(container);
      } catch {
        alert('Token inválido ou corrompido.');
      }
    };

    manualBtnRow.appendChild(hostTokenBtn);
    manualBtnRow.appendChild(joinTokenBtn);
    manualContainer.appendChild(manualBtnRow);
    sec.appendChild(manualContainer);

    modeSelect.onchange = () => {
      if (modeSelect.value === 'manual') {
        relayContainer.style.display = 'none';
        manualContainer.style.display = 'flex';
      } else if (modeSelect.value === 'local') {
        relayContainer.style.display = 'none';
        manualContainer.style.display = 'none';
      } else {
        relayContainer.style.display = 'flex';
        manualContainer.style.display = 'none';
      }
    };

    const statusEl = document.createElement('div');
    statusEl.style.cssText = 'font-size:12px; color:#94a3b8; padding:8px; background:rgba(30,41,59,0.4); border-radius:6px; line-height:1.4;';
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
    connectBtn.textContent = 'Conectar à Crom';
    connectBtn.style.cssText = 'background:rgba(16,185,129,0.15); border:1px solid #10b981; color:#10b981; padding:10px; border-radius:8px; font-weight:700; cursor:pointer;';
    connectBtn.onclick = async () => {
      const mode = modeSelect.value;
      if (mode === 'local') {
        this.deps.signaling.configure('local');
      } else {
        this.lastRelayUrl = relayInput.value.trim() || 'ws://localhost:8787';
        this.deps.signaling.configure(this.lastRelayUrl);
      }

      const roomId = await this.deps.peerSync.hostRoom(this.deps.getCurrentWorldName());
      this.renderMultiplayerTab(container);

      if (!roomId) {
        const erroMsg = this.deps.signaling.lastError || 'Não foi possível conectar. Verifique a URL do relay ou escolha o Modo Local.';
        alert(`Erro na conexão:\n\n${erroMsg}`);
      }
    };
    const disconnectBtn = document.createElement('button');
    disconnectBtn.textContent = 'Desconectar';
    disconnectBtn.style.cssText = 'background:rgba(239,68,68,0.15); border:1px solid #ef4444; color:#ef4444; padding:10px; border-radius:8px; font-weight:700; cursor:pointer;';
    disconnectBtn.onclick = () => { this.deps.peerSync.stop(); this.renderMultiplayerTab(container); };
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
      label.textContent = `${p.isOp ? '[OP] ' : ''}${p.name}`;
      row.appendChild(label);

      const opBtn = document.createElement('button');
      opBtn.textContent = p.isOp ? 'Revogar OP' : 'Conceder OP';
      opBtn.style.cssText = `background:${p.isOp ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}; border:1px solid ${p.isOp ? '#ef4444' : '#10b981'}; color:${p.isOp ? '#ef4444' : '#10b981'}; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer;`;
      opBtn.onclick = () => { this.deps.setOp(p.id, !p.isOp); this.renderMultiplayerTab(container); };
      row.appendChild(opBtn);
      roster.appendChild(row);
    }
    sec.appendChild(roster);

    container.appendChild(sec);
  }

  private renderPlayerTab(container: HTMLElement): void {
    const sec = this.section('Câmera e Personagem', 'personagem');
    const inputStyle = 'width:100%; box-sizing:border-box; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:9px 11px; color:white; font-size:13px;';

    const camSelect = document.createElement('select');
    camSelect.style.cssText = inputStyle;
    const isCreative = this.deps.gameModeManager.mode === 'creative';
    const camModes: CameraMode[] = isCreative
      ? ['topdown', 'fps', 'thirdperson', 'ghost']
      : ['fps', 'thirdperson', 'ghost'];
    const camLabels: Record<CameraMode, string> = {
      topdown: 'Top-Down (só no Criativo)',
      fps: 'Primeira Pessoa',
      thirdperson: 'Terceira Pessoa',
      ghost: 'Fantasma/Fly',
    };
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

    const gradSelect = document.createElement('select');
    gradSelect.style.cssText = inputStyle;
    const gradLabels: Record<string, string> = {
      natural: 'Natural (padrão)',
      cinema: 'Cinema — mais contido e frio',
      vivido: 'Vívido — cores mais fortes',
      nenhuma: 'Nenhuma — cor crua',
    };
    for (const [id, rotulo] of Object.entries(gradLabels)) {
      const opt = document.createElement('option');
      opt.value = id; opt.textContent = rotulo;
      if (id === this.deps.getGradacao()) opt.selected = true;
      gradSelect.appendChild(opt);
    }
    gradSelect.onchange = () => this.deps.setGradacao(gradSelect.value as any);
    sec.appendChild(this.inputRow('Gradação de Cor', gradSelect));

    const fadeCheck = document.createElement('input');
    fadeCheck.type = 'checkbox';
    fadeCheck.checked = this.deps.getFadeChunks();
    fadeCheck.onchange = () => this.deps.setFadeChunks(fadeCheck.checked);
    sec.appendChild(this.inputRow('Chunks aparecem gradualmente', fadeCheck));

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Resetar Personagem (Spawn)';
    resetBtn.style.cssText = 'background:rgba(56,189,248,0.15); border:1px solid #38bdf8; color:#38bdf8; padding:10px; border-radius:8px; font-weight:700; cursor:pointer;';
    resetBtn.onclick = () => {
      this.deps.playerController.pos.set(0, 40, 0);
      this.deps.playerController.vel.set(0, 0, 0);
    };
    sec.appendChild(resetBtn);

    container.appendChild(sec);
  }

  private async renderAiTab(container: HTMLElement): Promise<void> {
    const sec = this.section('Provedor de IA e MCP', 'chat');
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

    container.appendChild(sec);
  }

  private renderHelpTab(container: HTMLElement): void {
    const sec = this.section('Atalhos', 'engrenagem');

    const grade = document.createElement('div');
    grade.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:6px 18px;';

    const atalhos: [string, string][] = [
      ['Esc', 'Abrir este menu / voltar'],
      ['WASD', 'Mover'],
      ['Espaço', 'Pular / voar'],
      ['Shift', 'Correr / descer'],
      ['F5', 'Primeira ↔ terceira pessoa'],
      ['F4', 'Customizar personagem'],
      ['F6', 'Mods do mundo'],
      ['F7', 'Editor de código'],
      ['F', 'Comer o item selecionado'],
      ['T', 'Conversar com a IA'],
      ['E', 'Inventário'],
      ['F3', 'Diagnóstico: onde o frame está indo'],
      ['Clique Esq/Dir', 'Quebrar / colocar bloco'],
      ['Roda', 'Trocar bloco da hotbar'],
      ['1-9', 'Selecionar slot da hotbar'],
      ['Q / E', 'Alternar abas superiores'],
      ['Ctrl+Z/Y', 'Desfazer / Refazer'],
      ['Clique', 'Retomar o controle da câmera'],
    ];
    for (const [tecla, oque] of atalhos) {
      const linha = document.createElement('div');
      linha.style.cssText = 'display:flex; gap:9px; align-items:baseline; font-size:12.5px;';
      linha.innerHTML =
        `<span style="min-width:60px; color:${CORES.textoApagado}; border:1px solid ${CORES.borda};` +
        `border-radius:5px; padding:1px 6px; text-align:center; font-size:11px;">${tecla}</span>` +
        `<span style="color:${CORES.textoFraco};">${oque}</span>`;
      grade.appendChild(linha);
    }

    sec.appendChild(grade);
    container.appendChild(sec);
  }

  /** Aba Configurações — absorveu o conteúdo do antigo GameMenu. */
  private renderSettingsTab(container: HTMLElement): void {
    // --- Áudio ---
    const audioSec = this.section('Áudio', 'engrenagem');
    const c = cartao();
    const canais: { canal: AudioChannel; nome: string }[] = [
      { canal: 'master', nome: 'Geral' },
      { canal: 'sfx', nome: 'Efeitos' },
      { canal: 'ambient', nome: 'Ambiente' },
      { canal: 'music', nome: 'Música' },
      { canal: 'ui', nome: 'Interface' },
    ];
    for (const { canal, nome } of canais) {
      c.appendChild(deslizante(nome, this.deps.audio.getVolume(canal), (v) => this.deps.audio.setVolume(canal, v)));
    }
    const silenciar = botao(this.deps.audio.habilitado ? 'Silenciar tudo' : 'Reativar som', 'secundario');
    silenciar.onclick = () => {
      this.deps.audio.setHabilitado(!this.deps.audio.habilitado);
      silenciar.textContent = this.deps.audio.habilitado ? 'Silenciar tudo' : 'Reativar som';
    };
    c.appendChild(silenciar);
    audioSec.appendChild(c);
    container.appendChild(audioSec);

    // --- Sair ---
    const sairSec = this.section('Sessão', 'fechar');
    const sair = botao('Sair para a tela inicial', 'perigo');
    sair.onclick = () => {
      if (confirm('Sair para a tela inicial? O mundo já está salvo.')) this.deps.onSairParaMenuInicial();
    };
    sairSec.appendChild(sair);
    container.appendChild(sairSec);
  }

  public open(): void {
    this.isOpen = true;
    this.overlay.style.opacity = '1';
    this.overlay.style.pointerEvents = 'auto';
    this.tabsComponent.iniciar();
  }

  public close(): void {
    this.isOpen = false;
    this.overlay.style.opacity = '0';
    this.overlay.style.pointerEvents = 'none';
  }
}
