// Tela inicial exibida antes de qualquer geração pesada de mundo (chunks/streaming).
// Cobre o pedido: "antes de começar quero que apareça um menu".
import { WorldRepository } from '../storage/WorldRepository';
import { WorldRecord } from '../storage/Database';

export interface OnlineWorldEntry {
  roomId: string;
  name: string;
  playerCount: number;
}

export interface MainMenuCallbacks {
  onContinue: (worldId: string) => void;
  onOpenWorld: (worldId: string) => void;
  onOpenWizard: () => void;
  onJoinLink: (joinCode: string) => void;
  onOpenGlobalSettings: () => void;
  /** Consulta o diretório público do relay "Crom" por salas abertas agora. Sem relay configurado, devolve []. */
  listOnlineWorlds: () => Promise<OnlineWorldEntry[]>;
}

export class MainMenu {
  private overlay: HTMLDivElement;
  public isOpen = true;

  constructor(private cb: MainMenuCallbacks) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'main-menu';
    this.overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 2000;
      background: radial-gradient(circle at 50% 20%, rgba(30,58,95,0.9), rgba(6,10,20,0.97));
      display: flex; align-items: center; justify-content: center;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #f8fafc;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      width: 520px; max-width: 92vw; max-height: 88vh; overflow-y: auto;
      background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 20px; padding: 28px; box-shadow: 0 30px 60px rgba(0,0,0,0.6);
      display: flex; flex-direction: column; gap: 16px;
    `;

    panel.innerHTML = `
      <div style="text-align:center; margin-bottom: 8px;">
        <h1 style="margin:0; font-size:26px; letter-spacing: 2px;">CROM PLANEBOX</h1>
        <p style="margin:4px 0 0; font-size:12px; color:#94a3b8;">sandbox voxel 3D · IA agentica · mundos online P2P</p>
      </div>
    `;

    const menuList = document.createElement('div');
    menuList.id = 'main-menu-list';
    menuList.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
    panel.appendChild(menuList);

    const detailArea = document.createElement('div');
    detailArea.id = 'main-menu-detail';
    detailArea.style.cssText = 'display: none; flex-direction: column; gap: 8px;';
    panel.appendChild(detailArea);

    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    this.renderRoot();
  }

  private button(label: string, sub: string, onClick: () => void): HTMLDivElement {
    const btn = document.createElement('div');
    btn.style.cssText = `
      background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px; padding: 14px 16px; cursor: pointer; transition: all 0.15s ease;
    `;
    btn.onmouseenter = () => { btn.style.borderColor = '#38bdf8'; btn.style.background = 'rgba(56,189,248,0.1)'; };
    btn.onmouseleave = () => { btn.style.borderColor = 'rgba(255,255,255,0.1)'; btn.style.background = 'rgba(30, 41, 59, 0.7)'; };
    btn.innerHTML = `<div style="font-weight:700; font-size:14px;">${label}</div><div style="font-size:11px; color:#94a3b8; margin-top:2px;">${sub}</div>`;
    btn.onclick = onClick;
    return btn;
  }

  private async renderRoot(): Promise<void> {
    const list = this.overlay.querySelector('#main-menu-list') as HTMLDivElement;
    const detail = this.overlay.querySelector('#main-menu-detail') as HTMLDivElement;
    detail.style.display = 'none';
    list.style.display = 'flex';
    list.innerHTML = '';

    const worlds = await WorldRepository.getAllWorlds();
    const lastWorld = worlds[0];

    if (lastWorld) {
      list.appendChild(this.button(`▶ Continuar: ${lastWorld.name}`, 'Carrega o último mundo jogado', () => {
        this.close();
        this.cb.onContinue(lastWorld.id);
      }));
    }

    list.appendChild(this.button('🗺️ Mundos Salvos', `${worlds.length} mundo(s) salvo(s) neste navegador`, () => this.renderSavedWorlds(worlds)));
    list.appendChild(this.button('✨ Criar Novo Mundo', 'Abre o assistente de criação (terreno, modo de jogo, online)', () => {
      this.close();
      this.cb.onOpenWizard();
    }));
    list.appendChild(this.button('🌐 Mundos Online da Crom', 'Ver salas abertas agora ou colar um link de convite', () => this.renderOnline()));
    list.appendChild(this.button('⚙️ Configurações Globais', 'Chave de API da IA e modelo padrão', () => this.cb.onOpenGlobalSettings()));
  }

  private renderSavedWorlds(worlds: WorldRecord[]): void {
    const list = this.overlay.querySelector('#main-menu-list') as HTMLDivElement;
    const detail = this.overlay.querySelector('#main-menu-detail') as HTMLDivElement;
    list.style.display = 'none';
    detail.style.display = 'flex';
    detail.innerHTML = '';

    const back = this.button('← Voltar', '', () => this.renderRoot());
    detail.appendChild(back);

    if (worlds.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText = 'color:#94a3b8; font-size:12px; text-align:center;';
      empty.textContent = 'Nenhum mundo salvo ainda. Crie um novo mundo para começar.';
      detail.appendChild(empty);
      return;
    }

    for (const w of worlds) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px 12px;';
      row.innerHTML = `<div><div style="font-size:13px; font-weight:600;">${w.name}</div><div style="font-size:10px; color:#94a3b8;">seed ${w.seed} · ${new Date(w.updatedAt).toLocaleDateString()}</div></div>`;
      const openBtn = document.createElement('button');
      openBtn.textContent = '▶ Abrir';
      openBtn.style.cssText = 'background:#0284c7; color:white; border:none; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer;';
      openBtn.onclick = () => { this.close(); this.cb.onOpenWorld(w.id); };
      row.appendChild(openBtn);
      detail.appendChild(row);
    }
  }

  private async renderOnline(): Promise<void> {
    const list = this.overlay.querySelector('#main-menu-list') as HTMLDivElement;
    const detail = this.overlay.querySelector('#main-menu-detail') as HTMLDivElement;
    list.style.display = 'none';
    detail.style.display = 'flex';
    detail.innerHTML = '';

    const back = this.button('← Voltar', '', () => this.renderRoot());
    detail.appendChild(back);

    const joinRow = document.createElement('div');
    joinRow.style.cssText = 'display:flex; gap:8px;';
    const joinInput = document.createElement('input');
    joinInput.placeholder = 'Colar link ou código de convite...';
    joinInput.style.cssText = 'flex:1; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:8px 10px; color:white; font-size:12px;';
    const joinBtn = document.createElement('button');
    joinBtn.textContent = 'Entrar';
    joinBtn.style.cssText = 'background:#10b981; color:white; border:none; border-radius:8px; padding:0 14px; font-weight:600; cursor:pointer;';
    joinBtn.onclick = () => {
      const val = joinInput.value.trim();
      if (val) { this.close(); this.cb.onJoinLink(val); }
    };
    joinRow.appendChild(joinInput);
    joinRow.appendChild(joinBtn);
    detail.appendChild(joinRow);

    const listTitle = document.createElement('div');
    listTitle.style.cssText = 'font-size:11px; color:#94a3b8; margin-top:6px;';
    listTitle.textContent = 'Salas abertas agora no diretório da Crom:';
    detail.appendChild(listTitle);

    const rooms = await this.cb.listOnlineWorlds();
    if (rooms.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText = 'color:#64748b; font-size:12px; text-align:center;';
      empty.textContent = 'Nenhuma sala online no momento (ou o relay de sinalização não está configurado).';
      detail.appendChild(empty);
    } else {
      for (const r of rooms) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px 12px;';
        row.innerHTML = `<div><div style="font-size:13px; font-weight:600;">${r.name}</div><div style="font-size:10px; color:#94a3b8;">${r.playerCount} jogador(es) conectado(s)</div></div>`;
        const joinBtn2 = document.createElement('button');
        joinBtn2.textContent = '▶ Entrar';
        joinBtn2.style.cssText = 'background:#0284c7; color:white; border:none; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer;';
        joinBtn2.onclick = () => { this.close(); this.cb.onJoinLink(r.roomId); };
        row.appendChild(joinBtn2);
        detail.appendChild(row);
      }
    }
  }

  public open(): void {
    this.isOpen = true;
    this.overlay.style.display = 'flex';
    this.renderRoot();
  }

  public close(): void {
    this.isOpen = false;
    this.overlay.style.display = 'none';
  }
}
