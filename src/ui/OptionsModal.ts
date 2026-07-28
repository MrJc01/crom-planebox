// Tela de opções unificada: Vídeo, Áudio, Controles, Acessibilidade e IA — itens 985 & 1191 P1.
import { CAMADA, CORES, FONTE } from './theme';
import { UIScreen } from './UIManager';
import { Tabs } from './Tabs';

export class OptionsModal implements UIScreen {
  readonly id = 'options-modal';
  public isOpen = false;

  private root: HTMLDivElement;
  private tabsComponent: Tabs;

  public get raiz(): HTMLElement { return this.root; }

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'options-modal-overlay';
    this.root.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(11, 18, 32, 0.85); backdrop-filter: blur(12px);
      z-index: ${CAMADA.tela}; display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
      width: 720px; height: 520px; max-width: 90vw; max-height: 90vh;
      background: ${CORES.fundoElevado}; border: 1px solid ${CORES.bordaForte};
      border-radius: 16px; display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    `;
    this.root.appendChild(container);

    this.tabsComponent = new Tabs();
    this.setupTabs();
    container.appendChild(this.tabsComponent.raiz);
  }

  private setupTabs(): void {
    // Aba "Vídeo"
    this.tabsComponent.adicionar({
      id: 'video',
      titulo: 'Vídeo',
      icone: 'mundo',
      montar: (c) => {
        c.style.cssText = 'display:flex; flex-direction:column; gap:12px; font-family:' + FONTE + '; font-size:13px; color:' + CORES.texto + ';';
        c.innerHTML = `
          <div style="font-weight:700; color:${CORES.primariaClara}; font-size:14px;">Configurações de Vídeo</div>
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span>Distância de Renderização (Chunks):</span>
            <input type="range" min="4" max="16" value="8" style="cursor:pointer;" />
          </label>
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span>Campo de Visão (FOV):</span>
            <input type="range" min="60" max="110" value="75" style="cursor:pointer;" />
          </label>
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span>Tipo de Névoa:</span>
            <select style="background:${CORES.painel}; color:${CORES.texto}; border:1px solid ${CORES.borda}; padding:4px 8px; border-radius:6px;">
              <option value="linear">Linear</option>
              <option value="exp2">Exponencial (FogExp2)</option>
            </select>
          </label>
        `;
      },
    });

    // Aba "Áudio"
    this.tabsComponent.adicionar({
      id: 'audio',
      titulo: 'Áudio',
      icone: 'rede',
      montar: (c) => {
        c.style.cssText = 'display:flex; flex-direction:column; gap:12px; font-family:' + FONTE + '; font-size:13px; color:' + CORES.texto + ';';
        c.innerHTML = `
          <div style="font-weight:700; color:${CORES.primariaClara}; font-size:14px;">Canais de Áudio</div>
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span>Volume Principal (Master):</span>
            <input type="range" min="0" max="100" value="70" />
          </label>
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span>Efeitos Sonoros (SFX):</span>
            <input type="range" min="0" max="100" value="100" />
          </label>
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span>Voz de Jogadores:</span>
            <input type="range" min="0" max="100" value="90" />
          </label>
        `;
      },
    });

    // Aba "Controles"
    this.tabsComponent.adicionar({
      id: 'controles',
      titulo: 'Controles',
      icone: 'engrenagem',
      montar: (c) => {
        c.style.cssText = 'display:flex; flex-direction:column; gap:12px; font-family:' + FONTE + '; font-size:13px; color:' + CORES.texto + ';';
        c.innerHTML = `
          <div style="font-weight:700; color:${CORES.primariaClara}; font-size:14px;">Controles & Câmera</div>
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span>Sensibilidade do Mouse:</span>
            <input type="range" min="1" max="10" value="5" />
          </label>
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span>Deslocamento Vertical Ao Colocar Bloco (Bedrock style):</span>
            <input type="checkbox" style="cursor:pointer;" />
          </label>
        `;
      },
    });

    this.tabsComponent.iniciar();
  }

  public open(): void {
    this.isOpen = true;
    this.root.style.opacity = '1';
    this.root.style.pointerEvents = 'auto';
  }

  public close(): void {
    this.isOpen = false;
    this.root.style.opacity = '0';
    this.root.style.pointerEvents = 'none';
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }
}
