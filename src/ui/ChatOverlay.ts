import { OpenRouterClient } from '../ai/OpenRouterClient';
import { WorldRepository } from '../storage/WorldRepository';
import { ChatMessageRecord, ChatThreadRecord } from '../storage/Database';
import { CommandSystem } from '../commands/CommandSystem';

type MainTab = 'ai' | 'world';

interface FloatingEntry {
  el: HTMLDivElement;
  expiresAt: number;
}

export class ChatOverlay {
  public readonly id = 'chat';
  private container: HTMLDivElement;
  private headerTitleSpan: HTMLSpanElement;
  private tabsRow: HTMLDivElement;
  private messageList: HTMLDivElement;
  private threadsListArea: HTMLDivElement;
  private inputArea: HTMLDivElement;
  private inputField: HTMLInputElement;
  private sendBtn: HTMLButtonElement;
  private openRouterClient: OpenRouterClient;
  private currentWorldId: string = 'default-world';
  private currentThreadId: string | null = null;
  private isShowingThreadsList: boolean = false;
  public isOpen: boolean = false;
  public getLocationContext?: () => string;

  // --- Chat do Mundo (estilo Minecraft) ---
  private activeTab: MainTab = 'ai';
  private worldChatList: HTMLDivElement;
  private worldChatInputArea: HTMLDivElement;
  private worldChatInputField: HTMLInputElement;
  private floatingLog: HTMLDivElement;
  private floatingEntries: FloatingEntry[] = [];
  public localPlayerName = 'Você';
  /** Envia para os outros peers (via PeerSync) — main.ts injeta a implementação real. */
  public onWorldChatSend: (text: string) => void = () => {};
  /** Executa um comando de barra (via CommandSystem) — main.ts injeta a implementação real. */
  public onCommand: (raw: string) => Promise<{ ok: boolean; message: string }> = async () => ({ ok: false, message: 'Sistema de comandos indisponível.' });

  constructor(openRouterClient: OpenRouterClient) {
    this.openRouterClient = openRouterClient;

    this.container = document.createElement('div');
    this.container.id = 'chat-overlay';
    this.container.style.cssText = `
      position: absolute;
      bottom: 24px;
      left: 24px;
      width: 440px;
      max-width: calc(100vw - 48px);
      height: 520px;
      max-height: calc(100vh - 120px);
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      z-index: 100;
      overflow: hidden;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      pointer-events: auto;
      transition: opacity 0.2s ease, transform 0.2s ease;
      opacity: 0.9;
    `;

    this.container.addEventListener('mousedown', (e) => e.stopPropagation());
    this.container.addEventListener('click', (e) => e.stopPropagation());

    // Header with Title and Action Buttons
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 16px;
      background: rgba(30, 41, 59, 0.7);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #f8fafc;
      font-size: 13px;
    `;

    const titleArea = document.createElement('div');
    titleArea.style.cssText = 'display: flex; align-items: center; gap: 8px; font-weight: 600;';
    
    this.headerTitleSpan = document.createElement('span');
    this.headerTitleSpan.textContent = 'Assistente Voxel IA';
    
    titleArea.innerHTML = `<span style="font-size: 16px;">🤖</span>`;
    titleArea.appendChild(this.headerTitleSpan);

    const actionsArea = document.createElement('div');
    actionsArea.style.cssText = 'display: flex; align-items: center; gap: 6px;';

    const threadsListBtn = this.createHeaderBtn('📜 Todos os Chats', '#38bdf8', () => this.toggleThreadsList());
    const newChatBtn = this.createHeaderBtn('✨ Novo Chat', '#10b981', () => this.handleNewChat());
    const clearChatBtn = this.createHeaderBtn('🗑️ Resetar', '#ef4444', () => this.handleClearChat());

    actionsArea.appendChild(threadsListBtn);
    actionsArea.appendChild(newChatBtn);
    actionsArea.appendChild(clearChatBtn);

    header.appendChild(titleArea);
    header.appendChild(actionsArea);
    this.container.appendChild(header);

    // Abas principais: Assistente IA vs. Chat do Mundo (estilo Minecraft)
    this.tabsRow = document.createElement('div');
    this.tabsRow.style.cssText = 'display:flex; gap:6px; padding:8px 16px 0; background: rgba(30,41,59,0.5);';
    this.container.appendChild(this.tabsRow);
    this.renderMainTabs();

    // View 1: Message List Area
    this.messageList = document.createElement('div');
    this.messageList.style.cssText = `
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;
    this.container.appendChild(this.messageList);

    // View 2: Threads History List Area
    this.threadsListArea = document.createElement('div');
    this.threadsListArea.style.cssText = `
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: none;
      flex-direction: column;
      gap: 10px;
    `;
    this.container.appendChild(this.threadsListArea);

    // View 3: Chat do Mundo (mensagens entre jogadores conectados via P2P + comandos)
    this.worldChatList = document.createElement('div');
    this.worldChatList.style.cssText = `
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: none;
      flex-direction: column;
      gap: 8px;
    `;
    this.container.appendChild(this.worldChatList);

    // Input Bar (Assistente IA)
    this.inputArea = document.createElement('div');
    this.inputArea.style.cssText = `
      padding: 12px 16px;
      background: rgba(30, 41, 59, 0.4);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      gap: 8px;
    `;

    this.inputField = document.createElement('input');
    this.inputField.type = 'text';
    this.inputField.autocomplete = 'off';
    this.inputField.name = 'chat_prompt_input_no_autofill';
    this.inputField.setAttribute('data-lpignore', 'true');
    this.inputField.placeholder = 'Digite seu pedido para a IA... (ex: crie uma casa aqui)';
    this.inputField.style.cssText = `
      flex: 1;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      padding: 10px 14px;
      color: #f8fafc;
      font-size: 13px;
      outline: none;
    `;

    this.sendBtn = document.createElement('button');
    this.sendBtn.textContent = 'Enviar';
    this.sendBtn.style.cssText = `
      background: #0284c7;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 0 16px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    `;
    this.sendBtn.onmouseover = () => this.sendBtn.style.background = '#0369a1';
    this.sendBtn.onmouseout = () => this.sendBtn.style.background = '#0284c7';

    this.inputArea.appendChild(this.inputField);
    this.inputArea.appendChild(this.sendBtn);
    this.container.appendChild(this.inputArea);

    // Input Bar (Chat do Mundo) — suporta comandos com "/"
    this.worldChatInputArea = document.createElement('div');
    this.worldChatInputArea.style.cssText = `
      padding: 12px 16px;
      background: rgba(30, 41, 59, 0.4);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: none;
      gap: 8px;
    `;
    this.worldChatInputField = document.createElement('input');
    this.worldChatInputField.type = 'text';
    this.worldChatInputField.autocomplete = 'off';
    this.worldChatInputField.placeholder = 'Mensagem para o mundo, ou /comando...';
    this.worldChatInputField.style.cssText = this.inputField.style.cssText;
    const worldSendBtn = document.createElement('button');
    worldSendBtn.textContent = 'Enviar';
    worldSendBtn.style.cssText = this.sendBtn.style.cssText;
    worldSendBtn.onclick = () => this.handleWorldChatSend();
    this.worldChatInputField.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.handleWorldChatSend();
    };
    this.worldChatInputArea.appendChild(this.worldChatInputField);
    this.worldChatInputArea.appendChild(worldSendBtn);
    this.container.appendChild(this.worldChatInputArea);

    document.body.appendChild(this.container);

    // Log flutuante estilo Minecraft: fica fora do container principal, então continua
    // visível (com mensagens sumindo sozinhas) mesmo com a janela de chat fechada.
    this.floatingLog = document.createElement('div');
    this.floatingLog.style.cssText = `
      position: absolute;
      bottom: 88px;
      left: 24px;
      width: 380px;
      max-width: calc(100vw - 48px);
      display: flex;
      flex-direction: column;
      gap: 4px;
      pointer-events: none;
      z-index: 90;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    `;
    document.body.appendChild(this.floatingLog);

    this.setupListeners();
  }

  private renderMainTabs(): void {
    this.tabsRow.innerHTML = '';
    const defs: { id: MainTab; label: string }[] = [
      { id: 'ai', label: '🤖 Assistente IA' },
      { id: 'world', label: '💬 Chat do Mundo' },
    ];
    for (const d of defs) {
      const btn = document.createElement('button');
      const active = this.activeTab === d.id;
      btn.textContent = d.label;
      btn.style.cssText = `
        background: ${active ? 'rgba(56,189,248,0.15)' : 'transparent'};
        border: 1px solid ${active ? '#38bdf8' : 'transparent'};
        color: ${active ? '#38bdf8' : '#94a3b8'};
        border-radius: 6px 6px 0 0; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
      `;
      btn.onclick = (e) => { e.stopPropagation(); this.setMainTab(d.id); };
      this.tabsRow.appendChild(btn);
    }
  }

  private setMainTab(tab: MainTab): void {
    this.activeTab = tab;
    this.renderMainTabs();
    const showAi = tab === 'ai';
    this.messageList.style.display = showAi && !this.isShowingThreadsList ? 'flex' : 'none';
    this.threadsListArea.style.display = showAi && this.isShowingThreadsList ? 'flex' : 'none';
    this.inputArea.style.display = showAi ? 'flex' : 'none';
    this.worldChatList.style.display = showAi ? 'none' : 'flex';
    this.worldChatInputArea.style.display = showAi ? 'none' : 'flex';
    if (!showAi) this.worldChatInputField.focus();
  }

  private addFloatingEntry(text: string, color = '#f8fafc'): void {
    const entry = document.createElement('div');
    entry.style.cssText = `
      background: rgba(15, 23, 42, 0.6);
      color: ${color};
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12.5px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.6);
      transition: opacity 0.6s ease;
    `;
    entry.textContent = text;
    this.floatingLog.appendChild(entry);
    const expiresAt = Date.now() + 6000;
    this.floatingEntries.push({ el: entry, expiresAt });
    while (this.floatingLog.children.length > 8) {
      this.floatingLog.removeChild(this.floatingLog.firstChild!);
    }
    this.pruneFloatingEntries();
  }

  private pruneFloatingEntries(): void {
    const now = Date.now();
    this.floatingEntries = this.floatingEntries.filter((entry) => {
      const remaining = entry.expiresAt - now;
      if (this.isOpen && this.activeTab === 'world') return true; // com o chat aberto na aba certa, não some
      if (remaining <= 0) {
        entry.el.style.opacity = '0';
        setTimeout(() => entry.el.remove(), 600);
        return false;
      }
      if (remaining < 1000) entry.el.style.opacity = '0.3';
      setTimeout(() => this.pruneFloatingEntries(), Math.min(remaining, 1000));
      return true;
    });
  }

  /** Chamado pelo main.ts quando uma mensagem chega de outro peer (ou é um aviso do sistema/comando). */
  public receiveWorldChatMessage(name: string, text: string, isSystem = false): void {
    const row = document.createElement('div');
    row.style.cssText = 'font-size: 13px; color: #f8fafc; line-height: 1.5; white-space: pre-line;';
    if (isSystem) {
      row.innerHTML = `<span style="color:#facc15;">⚙ ${text}</span>`;
    } else {
      row.innerHTML = `<strong style="color:#38bdf8;">${name}:</strong> ${text}`;
    }
    this.worldChatList.appendChild(row);
    this.worldChatList.scrollTop = this.worldChatList.scrollHeight;
    this.addFloatingEntry(isSystem ? `⚙ ${text}` : `${name}: ${text}`, isSystem ? '#facc15' : '#f8fafc');
  }

  private async handleWorldChatSend(): Promise<void> {
    const text = this.worldChatInputField.value.trim();
    if (!text) return;
    this.worldChatInputField.value = '';

    if (CommandSystem.isCommand(text)) {
      const result = await this.onCommand(text);
      this.receiveWorldChatMessage('', result.message, true);
      return;
    }

    this.receiveWorldChatMessage(this.localPlayerName, text);
    this.onWorldChatSend(text);
  }

  private createHeaderBtn(label: string, color: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: ${color};
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease;
    `;
    btn.onclick = (e) => {
      e.stopPropagation();
      onClick();
    };
    return btn;
  }

  private setupListeners(): void {
    this.sendBtn.onclick = () => this.handleSend();
    this.inputField.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        this.handleSend();
      }
    };
  }

  public async setWorldId(worldId: string): Promise<void> {
    console.log(`🌐 [ChatOverlay] Alternando para o mundo ID: "${worldId}"`);
    this.currentWorldId = worldId;
    await WorldRepository.repairOrphanedChatMessages(worldId);
    const threads = await WorldRepository.getChatThreads(this.currentWorldId);
    if (threads.length > 0) {
      this.currentThreadId = threads[0].id;
    } else {
      this.currentThreadId = null;
    }
    await this.refreshMessages();
  }

  private async toggleThreadsList(): Promise<void> {
    this.isShowingThreadsList = !this.isShowingThreadsList;
    if (this.isShowingThreadsList) {
      console.log(`📜 [ChatOverlay] Abrindo lista com todos os chats do mundo "${this.currentWorldId}"`);
      this.headerTitleSpan.textContent = 'Lista de Chats do Mundo';
      this.messageList.style.display = 'none';
      this.inputArea.style.display = 'none';
      this.threadsListArea.style.display = 'flex';
      await this.refreshThreadsList();
    } else {
      console.log(`💬 [ChatOverlay] Voltando para a janela de conversação ativa`);
      this.headerTitleSpan.textContent = 'Assistente Voxel IA';
      this.threadsListArea.style.display = 'none';
      this.messageList.style.display = 'flex';
      this.inputArea.style.display = 'flex';
      await this.refreshMessages();
    }
  }

  private async refreshThreadsList(): Promise<void> {
    this.threadsListArea.innerHTML = '';
    const threads = await WorldRepository.getChatThreads(this.currentWorldId);

    console.log(`📜 [ChatOverlay] Encontradas ${threads.length} conversas salvas.`);

    if (threads.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color: #94a3b8; font-size: 13px; text-align: center; margin-top: 20px;';
      empty.textContent = 'Nenhuma conversa anterior salva neste mundo.';
      this.threadsListArea.appendChild(empty);
      return;
    }

    for (const t of threads) {
      const item = document.createElement('div');
      item.style.cssText = `
        background: rgba(30, 41, 59, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 12px 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background 0.15s ease;
      `;

      const info = document.createElement('div');
      info.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
      info.innerHTML = `
        <div style="font-size: 13px; font-weight: 600; color: #f8fafc;">${t.title}</div>
        <div style="font-size: 11px; color: #94a3b8;">${new Date(t.createdAt).toLocaleString()}</div>
      `;

      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 6px;';

      const openBtn = document.createElement('button');
      openBtn.textContent = '▶ Abrir';
      openBtn.style.cssText = 'background: #0284c7; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;';
      openBtn.onclick = async () => {
        console.log(`💬 [ChatOverlay] Abrindo conversa ID: "${t.id}"`);
        this.currentThreadId = t.id;
        await this.toggleThreadsList();
      };

      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑️';
      delBtn.style.cssText = 'background: rgba(239,68,68,0.2); color: #ef4444; border: 1px solid #ef4444; padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer;';
      delBtn.onclick = async () => {
        if (confirm(`Deseja excluir a conversa '${t.title}'?`)) {
          console.log(`🗑️ [ChatOverlay] Excluindo conversa ID: "${t.id}"`);
          await WorldRepository.deleteChatThread(this.currentWorldId, t.id);
          await this.refreshThreadsList();
        }
      };

      actions.appendChild(openBtn);
      actions.appendChild(delBtn);
      item.appendChild(info);
      item.appendChild(actions);
      this.threadsListArea.appendChild(item);
    }
  }

  public async refreshMessages(): Promise<void> {
    this.messageList.innerHTML = '';
    const history = await WorldRepository.getChatMessages(this.currentWorldId, this.currentThreadId || undefined);
    
    if (history.length === 0) {
      const welcome = document.createElement('div');
      welcome.style.cssText = `
        color: #94a3b8;
        font-size: 12px;
        text-align: center;
        margin-top: 20px;
        line-height: 1.6;
      `;
      welcome.innerHTML = `
        ✨ <strong>Nova Conversa Ativa</strong><br/>
        Tente me pedir para criar construções, casas, torres ou tirar fotos!
      `;
      this.messageList.appendChild(welcome);
    } else {
      console.log(`💬 [ChatOverlay] ${history.length} mensagens carregadas.`);
      for (const msg of history) {
        this.renderMessageBubble(msg);
      }
    }
    this.scrollToBottom();
  }

  private renderMessageBubble(msg: ChatMessageRecord): void {
    if (msg.role === 'tool') return;

    const wrapper = document.createElement('div');
    const isUser = msg.role === 'user';

    wrapper.style.cssText = `
      align-self: ${isUser ? 'flex-end' : 'flex-start'};
      max-width: 88%;
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

    const item = document.createElement('div');
    item.style.cssText = `
      position: relative;
      background: ${isUser ? '#0284c7' : 'rgba(30, 41, 59, 0.85)'};
      color: #f8fafc;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.5;
      word-break: break-word;
      border: 1px solid ${isUser ? 'transparent' : 'rgba(255,255,255,0.08)'};
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    const textSpan = document.createElement('span');
    textSpan.textContent = msg.content;
    item.appendChild(textSpan);

    const copyBtn = document.createElement('button');
    copyBtn.innerHTML = '📋 Copiar';
    copyBtn.style.cssText = `
      margin-top: 6px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #cbd5e1;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      cursor: pointer;
      transition: background 0.15s;
    `;
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(msg.content);
      console.log('📋 [ChatOverlay] Texto da mensagem copiado:', msg.content);
      copyBtn.innerHTML = '✅ Copiado!';
      setTimeout(() => copyBtn.innerHTML = '📋 Copiar', 2000);
    };
    item.appendChild(document.createElement('br'));
    item.appendChild(copyBtn);

    if (msg.imageUrl) {
      const img = document.createElement('img');
      img.src = msg.imageUrl;
      img.style.cssText = `
        width: 100%;
        margin-top: 8px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
      `;
      item.appendChild(img);
    }

    wrapper.appendChild(item);
    this.messageList.appendChild(wrapper);
  }

  private async handleNewChat(): Promise<void> {
    const thread = await WorldRepository.createChatThread(this.currentWorldId);
    console.log(`✨ [ChatOverlay] Nova thread de conversa criada com ID: "${thread.id}"`);
    this.currentThreadId = thread.id;
    this.inputField.value = '';
    if (this.isShowingThreadsList) {
      await this.toggleThreadsList();
    } else {
      await this.refreshMessages();
    }
  }

  private async handleClearChat(): Promise<void> {
    if (confirm('Tem certeza que deseja resetar todo o histórico de chat deste mundo?')) {
      console.log(`🗑️ [ChatOverlay] Limpando histórico no IndexedDB para o mundo "${this.currentWorldId}"...`);
      await WorldRepository.clearChatMessages(this.currentWorldId);
      this.currentThreadId = null;
      console.log(`✅ [ChatOverlay] Histórico limpo com sucesso!`);
      await this.refreshMessages();
    }
  }

  private async handleSend(): Promise<void> {
    const text = this.inputField.value.trim();
    if (!text) return;

    if (!this.currentThreadId) {
      const newThread = await WorldRepository.createChatThread(this.currentWorldId, text.slice(0, 30));
      this.currentThreadId = newThread.id;
    }

    console.log(`💬 [ChatOverlay] Prompt enviado na conversa [${this.currentThreadId}]: "${text}"`);
    this.inputField.value = '';

    this.renderMessageBubble({
      worldId: this.currentWorldId,
      threadId: this.currentThreadId,
      role: 'user',
      content: text,
      timestamp: Date.now()
    });
    this.scrollToBottom();

    const loadingBubble = document.createElement('div');
    loadingBubble.style.cssText = `
      align-self: flex-start;
      background: rgba(30, 41, 59, 0.8);
      color: #38bdf8;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      font-style: italic;
    `;
    loadingBubble.textContent = 'Pensando e executando MCP...';
    this.messageList.appendChild(loadingBubble);
    this.scrollToBottom();

    const locationContext = this.getLocationContext ? this.getLocationContext() : '';
    const fullPrompt = locationContext ? `${text}\n\n[Contexto do Mundo em Tempo Real: ${locationContext}]` : text;

    const response = await this.openRouterClient.sendMessage(
      this.currentWorldId,
      fullPrompt,
      (partialText) => {
        loadingBubble.textContent = partialText;
        this.scrollToBottom();
      },
      this.currentThreadId || undefined
    );

    console.log(`🤖 [ChatOverlay] Resposta recebida:`, response);
    await this.refreshMessages();
    this.container.style.display = 'flex';
    this.container.style.opacity = '1';
    this.container.style.pointerEvents = 'auto';
  }

  public focus(): void {
    console.log(`💬 [ChatOverlay] Overlay de chat focado`);
    this.isOpen = true;
    this.container.style.display = 'flex';
    this.container.style.opacity = '1';
    this.container.style.pointerEvents = 'auto';
    if (this.activeTab === 'ai') this.inputField.focus();
    else this.worldChatInputField.focus();
  }

  /** Abre já na aba de Chat do Mundo — usado pelo atalho de abertura direta (ex.: tecla "/"). */
  public focusWorldChat(): void {
    this.setMainTab('world');
    this.focus();
  }

  public blur(): void {
    console.log(`💬 [ChatOverlay] Foco do campo desativado (mantendo janela visível)`);
    this.container.style.display = 'flex';
    this.container.style.opacity = '0.88';
    this.container.style.pointerEvents = 'auto';
  }

  public hide(): void {
    console.log(`💬 [ChatOverlay] Janela de chat oculta`);
    this.isOpen = false;
    this.container.style.opacity = '0';
    this.container.style.pointerEvents = 'none';
  }

  public toggle(): void {
    if (this.isOpen && this.container.style.opacity !== '0') {
      this.hide();
    } else {
      this.focus();
    }
  }

  /** Aliases open()/close() para satisfazer a interface UIScreen do UIManager. */
  public open(): void { this.focus(); }
  public close(): void { this.hide(); }

  private scrollToBottom(): void {
    this.messageList.scrollTop = this.messageList.scrollHeight;
  }
}
