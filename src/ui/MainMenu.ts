// MainMenu unificado com navegacao por abas superiores (Top Tabs Bar) e suporte a Live Preview 3D.
import { WorldRepository } from '../storage/WorldRepository';
import { WorldRecord } from '../storage/Database';
import { CAMADA, CORES, FONTE } from './theme';
import { Tabs } from './Tabs';
import { icone } from './icons';

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
  private tabsComponent: Tabs;
  public isOpen = true;

  constructor(private cb: MainMenuCallbacks) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'main-menu';
    // Fullscreen overlay — mundo 3D visível atrás com blur
    this.overlay.style.cssText = `
      position: fixed; inset: 0; z-index: ${CAMADA.menuInicial};
      background: rgba(6, 10, 20, 0.82); backdrop-filter: blur(10px);
      display: flex; flex-direction: column;
      font-family: ${FONTE}; color: ${CORES.texto};
    `;

    /* Header full-width no topo com logo do jogo */
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px 40px 12px; background: rgba(15,23,42,0.7);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex; flex-direction: column; gap: 4px; flex: 0 0 auto;
    `;
    header.innerHTML = `
      <h1 style="margin:0; font-size:26px; letter-spacing: 3px; color:${CORES.aviso}; font-weight:800;">CROM PLANEBOX</h1>
      <p style="margin:0; font-size:11px; color:${CORES.textoFraco};">sandbox voxel 3D · IA agêntica · mundos online P2P</p>
    `;
    this.overlay.appendChild(header);

    // Componente Tabs com Top Bar + Dynamic Center Content + Bottom Bar
    this.tabsComponent = new Tabs();
    this.setupTabs();

    /* Tabs ocupa todo o espaço restante */
    this.tabsComponent.raiz.style.flex = '1 1 auto';
    this.tabsComponent.raiz.style.minHeight = '0';
    this.overlay.appendChild(this.tabsComponent.raiz);
    document.body.appendChild(this.overlay);

    this.tabsComponent.iniciar();
  }

  private setupTabs(): void {
    // Aba 1: Jogar
    this.tabsComponent.adicionar({
      id: 'play',
      titulo: 'Jogar',
      icone: 'jogar',
      montar: async (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:12px; overflow-y:auto; height:100%;';
        await this.renderPlayTab(container);
      },
    });

    // Aba 2: Mundos Salvos
    this.tabsComponent.adicionar({
      id: 'saved',
      titulo: 'Mundos Salvos',
      icone: 'mundo',
      // Papéis separados de propósito: `montar` só prepara a estrutura, `aoAtivar` traz o
      // conteúdo. Se os dois desenhassem, na PRIMEIRA ativação os dois rodariam — e como
      // `renderSavedWorldsTab` limpa e depois espera o banco, duas execuções concorrentes se
      // interpolariam e a lista sairia duplicada. É a mesma corrida do `renderBody` do PauseMenu.
      montar: (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:12px; overflow-y:auto; height:100%;';
      },
      // Um mundo criado no assistente, ou apagado, precisa aparecer (ou sumir) ao voltar para
      // esta aba sem recarregar a página. `montar` roda uma vez só; isto roda sempre.
      aoAtivar: (container) => { void this.renderSavedWorldsTab(container); },
    });

    // Aba 3: Mundos Online
    this.tabsComponent.adicionar({
      id: 'online',
      titulo: 'Mundos Online',
      icone: 'rede',
      montar: async (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:12px; overflow-y:auto; height:100%;';
        await this.renderOnlineTab(container);
      },
    });

    // Aba 4: Configurações Globais
    this.tabsComponent.adicionar({
      id: 'settings',
      titulo: 'Configurações',
      icone: 'engrenagem',
      montar: (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:12px; overflow-y:auto; height:100%;';
        this.renderSettingsTab(container);
      },
    });
  }

  private buttonCard(title: string, subtitle: string, iconName: string, onClick: () => void): HTMLDivElement {
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px; padding: 14px 18px; cursor: pointer; transition: all 0.15s ease;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
    `;
    card.onmouseenter = () => {
      card.style.borderColor = '#38bdf8';
      card.style.background = 'rgba(56,189,248,0.12)';
    };
    card.onmouseleave = () => {
      card.style.borderColor = 'rgba(255,255,255,0.12)';
      card.style.background = 'rgba(30, 41, 59, 0.7)';
    };
    card.innerHTML = `
      <div>
        <div style="font-weight:700; font-size:15px; color:#f8fafc;">${title}</div>
        <div style="font-size:11px; color:#94a3b8; margin-top:2px;">${subtitle}</div>
      </div>
      <div style="background:#0284c7; color:white; border-radius:8px; padding:8px 14px; font-size:12px; font-weight:700; white-space:nowrap;">
        Entrar
      </div>
    `;
    card.onclick = onClick;
    return card;
  }

  private async renderPlayTab(container: HTMLElement): Promise<void> {
    const worlds = await WorldRepository.getAllWorlds();
    const lastWorld = worlds[0];

    if (lastWorld) {
      container.appendChild(this.buttonCard(
        `▶ Continuar: ${lastWorld.name}`,
        `Carrega o último mundo jogado (${new Date(lastWorld.updatedAt).toLocaleDateString()})`,
        'jogar',
        () => {
          this.close();
          this.cb.onContinue(lastWorld.id);
        }
      ));
    }

    container.appendChild(this.buttonCard(
      'Criar Novo Mundo',
      'Abre o assistente para personalizar terreno, biomas, modo de jogo e multiplayer',
      'mais',
      () => {
        this.close();
        this.cb.onOpenWizard();
      }
    ));
  }

  /**
   * Lista de mundos salvos, com carregar e apagar.
   *
   * Limpa o container no começo porque é **rechamada**: depois de apagar um mundo, e toda vez que
   * a aba volta a ficar ativa (um mundo criado no assistente precisa aparecer aqui sem recarregar
   * a página). Sem a limpeza, cada visita duplicaria a lista.
   */
  private async renderSavedWorldsTab(container: HTMLElement): Promise<void> {
    container.innerHTML = '';
    const worlds = await WorldRepository.getAllWorlds();
    if (worlds.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText = 'color:#94a3b8; font-size:13px; text-align:center; padding:20px;';
      empty.textContent = 'Nenhum mundo salvo ainda no navegador. Clique na aba Jogar para criar um novo mundo.';
      container.appendChild(empty);
      return;
    }

    for (const w of worlds) {
      const row = document.createElement('div');
      row.style.cssText = `
        display:flex; align-items:center; justify-content:space-between;
        background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.1);
        border-radius:12px; padding:12px 16px;
      `;
      row.innerHTML = `
        <div>
          <div style="font-size:14px; font-weight:700; color:#e2e8f0;">${w.name}</div>
          <div style="font-size:11px; color:#94a3b8; margin-top:2px;">Seed ${w.seed} · Salvo em ${new Date(w.updatedAt).toLocaleDateString()}</div>
        </div>
      `;
      const acoes = document.createElement('div');
      acoes.style.cssText = 'display:flex; gap:8px; align-items:center; flex:0 0 auto;';

      const openBtn = document.createElement('button');
      openBtn.textContent = '▶ Carregar Mundo';
      openBtn.style.cssText = 'background:#0284c7; color:white; border:none; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;';
      openBtn.onclick = () => {
        this.close();
        this.cb.onOpenWorld(w.id);
      };

      // Apagar mundo.
      //
      // `WorldRepository.deleteWorld` já existia, completa e transacional em nove tabelas — e
      // **nada a chamava**. Não havia como apagar um mundo dentro do jogo. É o oitavo caso deste
      // repositório de funcionalidade pronta e nunca invocada, e o mais direto de todos: a função
      // faz exatamente o que o botão precisa, e o botão não existia.
      const apagarBtn = document.createElement('button');
      apagarBtn.title = `Apagar "${w.name}" definitivamente`;
      apagarBtn.setAttribute('aria-label', `Apagar o mundo ${w.name}`);
      apagarBtn.style.cssText = `
        background: transparent; border: 1px solid #7f1d1d; color: #fca5a5;
        padding: 7px 9px; border-radius: 8px; cursor: pointer; display: inline-flex;
        align-items: center; line-height: 0;
      `;
      apagarBtn.appendChild(icone('lixeira', 16));

      // Confirmação em DOIS estados no próprio botão, e não um `confirm()` do navegador.
      //
      // Apagar um mundo é irreversível e leva junto blocos, chat, jogadores e mods. Um `confirm()`
      // é fácil de despachar no automático — e, pior, o navegador o bloqueia em algumas
      // configurações, o que faria o mundo sumir sem pergunta nenhuma. Aqui o segundo clique é
      // deliberado, e o estado é visível.
      let armado = false;
      let expirar: ReturnType<typeof setTimeout> | undefined;
      apagarBtn.onclick = async () => {
        if (!armado) {
          armado = true;
          apagarBtn.textContent = 'Confirmar?';
          apagarBtn.style.background = '#7f1d1d';
          apagarBtn.style.color = '#fee2e2';
          apagarBtn.style.lineHeight = '';
          // Desarma sozinho: um botão que fica "armado" para sempre vira uma armadilha para o
          // próximo clique distraído.
          expirar = setTimeout(() => {
            armado = false;
            apagarBtn.textContent = '';
            apagarBtn.appendChild(icone('lixeira', 16));
            apagarBtn.style.background = 'transparent';
            apagarBtn.style.color = '#fca5a5';
            apagarBtn.style.lineHeight = '0';
          }, 4000);
          return;
        }
        clearTimeout(expirar);
        apagarBtn.disabled = true;
        apagarBtn.textContent = 'Apagando…';
        await WorldRepository.deleteWorld(w.id);
        await this.renderSavedWorldsTab(container);
      };

      acoes.append(openBtn, apagarBtn);
      row.appendChild(acoes);
      container.appendChild(row);
    }
  }

  /** Parágrafo de erro da aba Online, e o botão que precisa voltar ao normal depois da falha. */
  private erroEntrada: HTMLElement | null = null;
  private botaoEntrar: HTMLButtonElement | null = null;

  /**
   * Mostra por que a entrada na sala falhou, sem fechar o menu.
   *
   * Chamar com string vazia limpa. O botão volta a "Conectar" nos dois casos: deixá-lo em
   * "Conectando…" para sempre depois de uma falha é o tipo de detalhe que faz o jogador achar
   * que o jogo travou e recarregar a página.
   */
  public mostrarErroEntrada(mensagem: string): void {
    if (this.botaoEntrar) {
      this.botaoEntrar.disabled = false;
      this.botaoEntrar.textContent = 'Conectar';
    }
    if (!this.erroEntrada) return;
    this.erroEntrada.textContent = mensagem;
    this.erroEntrada.style.display = mensagem ? 'block' : 'none';
  }

  private async renderOnlineTab(container: HTMLElement): Promise<void> {
    const joinRow = document.createElement('div');
    joinRow.style.cssText = 'display:flex; gap:10px; margin-bottom:8px;';
    const joinInput = document.createElement('input');
    joinInput.placeholder = 'Cole o link de convite ou código da sala...';
    joinInput.style.cssText = 'flex:1; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:10px 12px; color:white; font-size:13px;';

    const joinBtn = document.createElement('button');
    joinBtn.textContent = 'Conectar';
    joinBtn.style.cssText = 'background:#10b981; color:white; border:none; border-radius:8px; padding:0 18px; font-weight:700; cursor:pointer;';
    joinBtn.onclick = () => {
      const val = joinInput.value.trim();
      if (!val) return;
      // **Não fecha o menu aqui.** Fechava antes de tentar conectar, e quando a conexão falhava
      // o jogador ficava olhando para o jogo sem nenhuma explicação do que deu errado — a tela
      // que deveria contar já não existia mais. Quem fecha agora é o `handleJoinLink`, e só
      // depois que a conexão abriu de fato.
      this.mostrarErroEntrada('');
      joinBtn.disabled = true;
      joinBtn.textContent = 'Conectando…';
      this.cb.onJoinLink(val);
    };
    joinRow.appendChild(joinInput);
    joinRow.appendChild(joinBtn);
    container.appendChild(joinRow);

    // Onde a falha aparece. Fica logo abaixo do campo porque é ali que o jogador está olhando —
    // um toast sobre o jogo não serve, já que o menu continua aberto quando a tentativa falha.
    const erro = document.createElement('p');
    erro.style.cssText = 'display:none; margin:0; font-size:12px; line-height:1.5; color:#fca5a5;';
    container.appendChild(erro);
    this.erroEntrada = erro;
    this.botaoEntrar = joinBtn;

    const listTitle = document.createElement('div');
    listTitle.style.cssText = 'font-size:12px; font-weight:700; color:#94a3b8; margin-top:4px;';
    listTitle.textContent = 'Salas Públicas Abertas no Servidor Relay da Crom:';
    container.appendChild(listTitle);

    const rooms = await this.cb.listOnlineWorlds();
    if (rooms.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText = 'color:#64748b; font-size:12px; text-align:center; padding:12px;';
      empty.textContent = 'Nenhuma sala pública encontrada no momento (ou relay offline). Você também pode usar conexões locais por abas.';
      container.appendChild(empty);
    } else {
      for (const r of rooms) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:10px 14px;';
        row.innerHTML = `<div><div style="font-size:13px; font-weight:700; color:#38bdf8;">${r.name}</div><div style="font-size:11px; color:#94a3b8;">${r.playerCount} jogador(es) online</div></div>`;
        const joinBtn2 = document.createElement('button');
        joinBtn2.textContent = '▶ Entrar na Sala';
        joinBtn2.style.cssText = 'background:#0284c7; color:white; border:none; padding:7px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;';
        joinBtn2.onclick = () => {
          // Mesma regra do botão de cima: quem fecha o menu é o `handleJoinLink`, e só depois
          // que a conexão abriu. A sala listada pode ter acabado de fechar.
          this.mostrarErroEntrada('');
          this.cb.onJoinLink(r.roomId);
        };
        row.appendChild(joinBtn2);
        container.appendChild(row);
      }
    }
  }

  private renderSettingsTab(container: HTMLElement): void {
    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px;';
    card.innerHTML = `
      <div style="font-size:14px; font-weight:700; color:${CORES.aviso};">Configurações Globais de IA & Sistema</div>
      <p style="font-size:12px; color:#94a3b8; margin:0; line-height:1.5;">Configure as chaves de API para geração de mundos com IA, modelos LLM e preferências de rendering global.</p>
    `;
    const openBtn = document.createElement('button');
    openBtn.textContent = 'Abrir Painel de Configurações da IA';
    openBtn.style.cssText = 'background:#0284c7; color:white; border:none; padding:10px 16px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; align-self:flex-start;';
    openBtn.onclick = () => this.cb.onOpenGlobalSettings();
    card.appendChild(openBtn);
    container.appendChild(card);
  }

  public onVisibilidade: (aberto: boolean) => void = () => {};

  public open(): void {
    this.isOpen = true;
    this.overlay.style.display = 'flex';
    this.tabsComponent.iniciar();
    this.onVisibilidade(true);
  }

  public close(): void {
    this.isOpen = false;
    this.overlay.style.display = 'none';
    this.onVisibilidade(false);
  }
}
