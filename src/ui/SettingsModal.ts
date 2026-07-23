import { WorldRepository } from '../storage/WorldRepository';
import { CameraManager, CameraMode } from '../engine/CameraManager';
import { ChunkManager } from '../voxel/ChunkManager';
import { PlayerController } from '../player/controller';
import { WorldRecord } from '../storage/Database';

export class SettingsModal {
  private overlay: HTMLDivElement;
  private cameraManager: CameraManager;
  private chunkManager: ChunkManager;
  private playerController: PlayerController;

  private providerSelect!: HTMLSelectElement;
  private apiKeyInput!: HTMLInputElement;
  private googleApiKeyInput!: HTMLInputElement;
  private modelSelect!: HTMLSelectElement;
  private cameraSelect!: HTMLSelectElement;
  private tangibleCheckbox!: HTMLInputElement;
  private fovInput!: HTMLInputElement;
  private fovValueLabel!: HTMLSpanElement;
  private renderDistInput!: HTMLInputElement;
  private renderDistValueLabel!: HTMLSpanElement;
  private worldSelect!: HTMLSelectElement;

  private onWorldChange?: (worldId: string) => void;
  public isOpen: boolean = false;

  constructor(
    cameraManager: CameraManager,
    chunkManager: ChunkManager,
    playerController: PlayerController,
    onWorldChange?: (worldId: string) => void
  ) {
    this.cameraManager = cameraManager;
    this.chunkManager = chunkManager;
    this.playerController = playerController;
    this.onWorldChange = onWorldChange;

    this.overlay = document.createElement('div');
    this.overlay.id = 'settings-modal-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(12px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    `;

    this.buildUI();
    document.body.appendChild(this.overlay);
  }

  private buildUI(): void {
    const modal = document.createElement('div');
    modal.style.cssText = `
      width: 580px;
      max-width: 92vw;
      max-height: 88vh;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      color: #f8fafc;
    `;

    // Modal Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 18px 24px;
      background: rgba(30, 41, 59, 0.7);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 20px;">⚙️</span>
        <h2 style="margin: 0; font-size: 18px; font-weight: 600;">Configurações & Gerenciador de Mundos</h2>
      </div>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
    `;
    closeBtn.onclick = () => this.close();
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Modal Body
    const body = document.createElement('div');
    body.style.cssText = `
      padding: 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
    `;

    // SECTION 1: AI Provider (OpenRouter & Google AI Studio)
    const secApi = this.createSection('🤖 Provedor de IA & MCP (OpenRouter / Google AI Studio)', `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div>
          <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px;">Provedor de IA:</label>
          <select id="cfg-provider" style="width: 100%; box-sizing: border-box; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 12px; color: white; font-size: 13px;">
            <option value="openrouter">OpenRouter API</option>
            <option value="google_aistudio">Google AI Studio (Gemini)</option>
          </select>
        </div>
        <div id="wrapper-openrouter-key">
          <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px;">OpenRouter API Key:</label>
          <input id="cfg-apikey" name="no_autofill_openrouter_key" type="password" autocomplete="new-password" data-lpignore="true" data-form-type="other" placeholder="sk-or-v1-..." style="width: 100%; box-sizing: border-box; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 12px; color: white; font-size: 13px;" />
        </div>
        <div id="wrapper-google-key" style="display: none;">
          <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px;">Google AI Studio API Key:</label>
          <input id="cfg-google-key" name="no_autofill_google_key" type="password" autocomplete="new-password" data-lpignore="true" data-form-type="other" placeholder="AIzaSy..." style="width: 100%; box-sizing: border-box; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 12px; color: white; font-size: 13px;" />
        </div>
        <div>
          <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px;">Modelo LLM:</label>
          <select id="cfg-model" style="width: 100%; box-sizing: border-box; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 12px; color: white; font-size: 13px;"></select>
        </div>
      </div>
    `);
    body.appendChild(secApi);

    // SECTION 2: Camera, Player Physics
    const secCam = this.createSection('🎥 Câmera & Personagem', `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div>
          <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px;">Modo de Câmera:</label>
          <select id="cfg-camera-mode" style="width: 100%; box-sizing: border-box; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 12px; color: white; font-size: 13px;">
            <option value="topdown">Top-Down (Visão aérea de cima)</option>
            <option value="fps">Primeira Pessoa (FPS estilo Minecraft)</option>
            <option value="ghost">Fantasma / Fly (Noclip livre)</option>
          </select>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; background: rgba(15, 23, 42, 0.4); padding: 10px 12px; border-radius: 8px;">
          <input id="cfg-tangible" type="checkbox" style="width: 16px; height: 16px; cursor: pointer;" />
          <label for="cfg-tangible" style="font-size: 13px; color: #f8fafc; cursor: pointer;">
            Ativar Físicas de Colisão (Se desmarcado, fica Intangível / Noclip atravessando blocos)
          </label>
        </div>
        <div>
          <button id="btn-reset-character" style="width: 100%; background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer;">
            🔄 Resetar Personagem / Posição (Spawn)
          </button>
        </div>
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-bottom: 6px;">
            <span>Campo de Visão (FOV):</span>
            <span id="fov-val">75°</span>
          </div>
          <input id="cfg-fov" type="range" min="45" max="110" value="75" style="width: 100%;" />
        </div>
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-bottom: 6px;">
            <span>Distância de Visão (Render Distance):</span>
            <span id="render-val">6 Chunks</span>
          </div>
          <input id="cfg-renderdist" type="range" min="2" max="32" value="8" style="width: 100%;" />
        </div>
      </div>
    `);
    body.appendChild(secCam);

    // SECTION 3: World & Persistence
    const secWorld = this.createSection('🌍 Gerenciador de Mundos & Exportação', `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div>
          <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px;">Mundo Ativo:</label>
          <div style="display: flex; gap: 8px;">
            <select id="cfg-world-select" style="flex: 1; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 12px; color: white; font-size: 13px;"></select>
            <button id="btn-new-world" style="background: #10b981; color: white; border: none; border-radius: 8px; padding: 0 14px; font-weight: 600; cursor: pointer;">+ Novo</button>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px;">
          <button id="btn-export-world" style="background: rgba(30, 41, 59, 0.8); border: 1px solid #38bdf8; color: #38bdf8; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer;">💾 Exportar Mundo (JSON)</button>
          <button id="btn-import-world" style="background: rgba(30, 41, 59, 0.8); border: 1px solid #a855f7; color: #a855f7; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer;">📂 Importar Mundo (JSON)</button>
          <input id="import-file-input" type="file" accept=".json" style="display: none;" />
        </div>
        <div style="margin-top: 4px;">
          <button id="btn-reset-world" style="width: 100%; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #ef4444; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer;">⚠️ Resetar Blocos do Mundo Atual</button>
        </div>
      </div>
    `);
    body.appendChild(secWorld);

    modal.appendChild(body);

    // Modal Footer
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 16px 24px;
      background: rgba(30, 41, 59, 0.7);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    `;

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Salvar e Aplicar';
    saveBtn.style.cssText = `
      background: #0284c7;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font-weight: 600;
      cursor: pointer;
    `;
    saveBtn.onclick = () => this.saveAndApply();

    footer.appendChild(saveBtn);
    modal.appendChild(footer);
    this.overlay.appendChild(modal);

    this.bindElementReferences();
  }

  private createSection(title: string, contentHtml: string): HTMLDivElement {
    const sec = document.createElement('div');
    sec.style.cssText = `
      background: rgba(30, 41, 59, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 16px;
    `;
    sec.innerHTML = `
      <h3 style="margin: 0 0 14px 0; font-size: 15px; font-weight: 600; color: #38bdf8;">${title}</h3>
      ${contentHtml}
    `;
    return sec;
  }

  private bindElementReferences(): void {
    this.providerSelect = this.overlay.querySelector('#cfg-provider') as HTMLSelectElement;
    this.apiKeyInput = this.overlay.querySelector('#cfg-apikey') as HTMLInputElement;
    this.googleApiKeyInput = this.overlay.querySelector('#cfg-google-key') as HTMLInputElement;
    this.modelSelect = this.overlay.querySelector('#cfg-model') as HTMLSelectElement;
    this.cameraSelect = this.overlay.querySelector('#cfg-camera-mode') as HTMLSelectElement;
    this.tangibleCheckbox = this.overlay.querySelector('#cfg-tangible') as HTMLInputElement;
    this.fovInput = this.overlay.querySelector('#cfg-fov') as HTMLInputElement;
    this.fovValueLabel = this.overlay.querySelector('#fov-val') as HTMLSpanElement;
    this.renderDistInput = this.overlay.querySelector('#cfg-renderdist') as HTMLInputElement;
    this.renderDistValueLabel = this.overlay.querySelector('#render-val') as HTMLSpanElement;
    this.worldSelect = this.overlay.querySelector('#cfg-world-select') as HTMLSelectElement;

    const wrapperOpenRouter = this.overlay.querySelector('#wrapper-openrouter-key') as HTMLDivElement;
    const wrapperGoogle = this.overlay.querySelector('#wrapper-google-key') as HTMLDivElement;

    this.providerSelect.onchange = () => {
      const isGoogle = this.providerSelect.value === 'google_aistudio';
      wrapperOpenRouter.style.display = isGoogle ? 'none' : 'block';
      wrapperGoogle.style.display = isGoogle ? 'block' : 'none';
      this.populateModelOptions(this.providerSelect.value);
    };

    this.fovInput.oninput = () => {
      this.fovValueLabel.textContent = `${this.fovInput.value}°`;
    };

    this.renderDistInput.oninput = () => {
      this.renderDistValueLabel.textContent = `${this.renderDistInput.value} Chunks`;
    };

    const resetCharBtn = this.overlay.querySelector('#btn-reset-character') as HTMLButtonElement;
    resetCharBtn.onclick = () => {
      this.playerController.pos.set(0, 40, 0);
      this.playerController.vel.set(0, 0, 0);
      this.playerController.flying = true;
      alert('Personagem resetado para a posição de origem!');
    };

    const newWorldBtn = this.overlay.querySelector('#btn-new-world') as HTMLButtonElement;
    newWorldBtn.onclick = async () => {
      const name = prompt('Nome do novo mundo:', `Mundo ${Date.now().toString().slice(-4)}`);
      if (!name) return;
      const worldId = `world-${Date.now()}`;
      await WorldRepository.saveWorld({
        id: worldId,
        name,
        seed: Math.floor(Math.random() * 1000000),
        groundHeight: 4,
        fov: 75,
        cameraMode: 'topdown',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      await this.refreshWorldsList();
      this.worldSelect.value = worldId;
    };

    const exportBtn = this.overlay.querySelector('#btn-export-world') as HTMLButtonElement;
    exportBtn.onclick = async () => {
      const worldId = this.worldSelect.value;
      if (!worldId) return;
      const json = await WorldRepository.exportWorldJson(worldId);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `world-${worldId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const importBtn = this.overlay.querySelector('#btn-import-world') as HTMLButtonElement;
    const importFileInput = this.overlay.querySelector('#import-file-input') as HTMLInputElement;

    importBtn.onclick = () => importFileInput.click();
    importFileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const content = ev.target?.result as string;
          const importedWorldId = await WorldRepository.importWorldJson(content);
          await this.refreshWorldsList();
          this.worldSelect.value = importedWorldId;
          alert('Mundo importado com sucesso!');
        } catch (err: any) {
          alert(`Erro ao importar mundo: ${err.message}`);
        }
      };
      reader.readAsText(file);
    };

    const resetWorldBtn = this.overlay.querySelector('#btn-reset-world') as HTMLButtonElement;
    resetWorldBtn.onclick = async () => {
      const worldId = this.worldSelect.value;
      if (!worldId) return;
      if (confirm('⚠️ Tem certeza que deseja resetar TUDO (blocos construídos e histórico de conversas) deste mundo para recomeçar do zero?')) {
        console.log(`🗑️ [SettingsModal] Resetando completamente o mundo ID: "${worldId}"`);
        await WorldRepository.clearWorldBlockMods(worldId);
        await WorldRepository.clearChatMessages(worldId);
        alert('Mundo resetado completamente do zero!');
        if (this.onWorldChange) this.onWorldChange(worldId);
      }
    };
  }

  private populateModelOptions(provider: string, currentModel?: string): void {
    this.modelSelect.innerHTML = '';
    const isGoogle = provider === 'google_aistudio';

    const options = isGoogle ? [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recomendado - Ultra Rápido & Visão)' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Raciocínio Avançado)' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
    ] : [
      { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (Recomendado - Excelente Raciocínio & Visão)' },
      { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Super Rápido & Visão Multimodal)' },
      { value: 'openai/gpt-4o', label: 'GPT-4o (Visão & Chamada de Ferramentas)' },
      { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct' }
    ];

    for (const opt of options) {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      this.modelSelect.appendChild(el);
    }

    if (currentModel) {
      this.modelSelect.value = currentModel;
    }
  }

  private async refreshWorldsList(): Promise<void> {
    const worlds = await WorldRepository.getAllWorlds();
    this.worldSelect.innerHTML = '';
    for (const w of worlds) {
      const opt = document.createElement('option');
      opt.value = w.id;
      opt.textContent = `${w.name} (${new Date(w.createdAt).toLocaleDateString()})`;
      this.worldSelect.appendChild(opt);
    }
  }

  public async open(): Promise<void> {
    this.isOpen = true;
    const settings = await WorldRepository.getSettings();
    await this.refreshWorldsList();

    this.providerSelect.value = settings.provider || 'openrouter';
    const isGoogle = this.providerSelect.value === 'google_aistudio';

    const wrapperOpenRouter = this.overlay.querySelector('#wrapper-openrouter-key') as HTMLDivElement;
    const wrapperGoogle = this.overlay.querySelector('#wrapper-google-key') as HTMLDivElement;
    wrapperOpenRouter.style.display = isGoogle ? 'none' : 'block';
    wrapperGoogle.style.display = isGoogle ? 'block' : 'none';

    this.apiKeyInput.value = settings.openRouterApiKey || '';
    this.googleApiKeyInput.value = settings.googleApiKey || '';
    this.populateModelOptions(this.providerSelect.value, settings.model);

    this.cameraSelect.value = this.cameraManager.mode;
    this.tangibleCheckbox.checked = !this.playerController.flying;
    this.fovInput.value = String(this.cameraManager.fov);
    this.fovValueLabel.textContent = `${this.cameraManager.fov}°`;
    this.renderDistInput.value = String(this.cameraManager.renderDistance);
    this.renderDistValueLabel.textContent = `${this.cameraManager.renderDistance} Chunks`;

    this.overlay.style.opacity = '1';
    this.overlay.style.pointerEvents = 'auto';
  }

  public close(): void {
    this.isOpen = false;
    this.overlay.style.opacity = '0';
    this.overlay.style.pointerEvents = 'none';
  }

  private async saveAndApply(): Promise<void> {
    const provider = this.providerSelect.value as 'openrouter' | 'google_aistudio';
    const openRouterApiKey = this.apiKeyInput.value.trim();
    const googleApiKey = this.googleApiKeyInput.value.trim();
    const model = this.modelSelect.value;

    const newCamMode = this.cameraSelect.value as CameraMode;
    this.cameraManager.setMode(newCamMode);

    this.playerController.flying = !this.tangibleCheckbox.checked;

    const fovVal = parseInt(this.fovInput.value, 10);
    this.cameraManager.setFOV(fovVal);

    const renderDistVal = parseInt(this.renderDistInput.value, 10);
    this.cameraManager.setRenderDistance(renderDistVal);

    await WorldRepository.saveSettings({
      provider,
      openRouterApiKey,
      googleApiKey,
      model,
      fov: fovVal,
      renderDistance: renderDistVal
    });

    console.log(`✅ [SettingsModal] Configurações salvas: Provedor="${provider}", Modelo="${model}"`);
    
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = '✅ Chaves de API e Configurações salvas com sucesso!';
      toast.style.opacity = '1';
      setTimeout(() => toast.style.opacity = '0', 3000);
    }

    const selectedWorldId = this.worldSelect.value;
    if (selectedWorldId && this.onWorldChange) {
      this.onWorldChange(selectedWorldId);
    }

    this.close();
  }
}
