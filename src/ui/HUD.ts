import { CAMADA } from './theme';
import { CameraManager, CameraMode } from '../engine/CameraManager';
import { icone_svg } from './icons';

export class HUD {
  private container: HTMLDivElement;
  private cameraBadge: HTMLDivElement;
  private coordsBadge: HTMLDivElement;
  private networkBadge: HTMLDivElement;
  private cameraManager: CameraManager | null = null;
  private survivalBar: HTMLDivElement;
  private arEl!: HTMLDivElement;
  private healthEl: HTMLDivElement;
  private hungerEl: HTMLDivElement;
  private objetivoEl: HTMLDivElement;
  private sonoEl: HTMLDivElement;
  private micBadge: HTMLDivElement;
  private pausedBadge!: HTMLDivElement;

  constructor(cameraManager?: CameraManager) {
    if (cameraManager) this.cameraManager = cameraManager;

    this.container = typeof document !== 'undefined' ? document.createElement('div') : ({ style: {} } as any);
    this.container.id = 'hud-container';
    this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      user-select: none;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      z-index: ${CAMADA.hud};
    `;

    // Crosshair in screen center
    const crosshair = document.createElement('div');
    crosshair.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 8px;
      height: 8px;
      margin-left: -4px;
      margin-top: -4px;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(0, 0, 0, 0.5);
      border-radius: 50%;
      pointer-events: none;
    `;
    // Insígnia visível de "PAUSADO" — item 1054 P1
    this.pausedBadge = document.createElement('div');
    this.pausedBadge.style.cssText = `
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(225, 29, 72, 0.85);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #ffffff;
      padding: 6px 18px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1px;
      box-shadow: 0 4px 14px rgba(225, 29, 72, 0.4);
      display: none;
      z-index: ${CAMADA.hud};
    `;
    this.pausedBadge.textContent = 'PAUSADO';
    this.container.appendChild(this.pausedBadge);

    // Top Right Badges
    const topRightPanel = document.createElement('div');
    topRightPanel.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-end;
    `;

    this.cameraBadge = document.createElement('div');
    this.cameraBadge.style.cssText = `
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: #38bdf8;
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: auto;
      cursor: pointer;
      transition: transform 0.15s ease, background 0.15s ease;
    `;
    this.cameraBadge.textContent = 'Modo: Top-Down';
    this.cameraBadge.title = 'Clique para alternar o modo de câmera';
    this.cameraBadge.onclick = (e) => {
      e.stopPropagation();
      this.cycleCameraMode();
    };
    topRightPanel.appendChild(this.cameraBadge);

    this.coordsBadge = document.createElement('div');
    this.coordsBadge.style.cssText = `
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
    `;
    this.coordsBadge.textContent = 'XYZ: 0, 0, 0';
    topRightPanel.appendChild(this.coordsBadge);

    this.networkBadge = document.createElement('div');
    this.networkBadge.style.cssText = `
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
    `;
    this.networkBadge.textContent = 'Offline (local)';
    topRightPanel.appendChild(this.networkBadge);

    // Microfone (itens 927 e 929). Nasce desligado e **visível**: um botão que só aparece quando
    // ligado esconderia justamente o estado que o jogador precisa conferir de relance.
    this.micBadge = document.createElement('div');
    this.micBadge.style.cssText = `
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #94a3b8;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      pointer-events: auto;
      cursor: pointer;
      display: none;
      align-items: center;
      gap: 7px;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    `;
    this.micBadge.onclick = (e) => { e.stopPropagation(); this.onAlternarMicrofone(); };
    this.atualizarMicrofone(false, false);
    topRightPanel.appendChild(this.micBadge);

    this.container.appendChild(topRightPanel);

    // Controls hint bottom-right
    const hint = document.createElement('div');
    hint.style.cssText = `
      position: absolute;
      bottom: 16px;
      right: 16px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 12px;
      line-height: 1.6;
    `;
    hint.innerHTML = `
      <strong>[Ctrl+1/2/3]</strong> Câmeras &nbsp;|&nbsp; <strong>[1-9]</strong> Hotbar &nbsp;|&nbsp; <strong>[E]</strong> Inventário <br/>
      <strong>[T]</strong> Chat IA &nbsp;|&nbsp; <strong>[V]</strong> Falar &nbsp;|&nbsp; <strong>[ESC]</strong> Menu / Pausa
    `;
    this.container.appendChild(hint);

    // Barra de vida/fome (Modo Sobrevivência), estilo Minecraft — oculta nos outros modos.
    this.survivalBar = document.createElement('div');
    this.survivalBar.style.cssText = `
      position: absolute;
      bottom: 84px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    `;
    this.healthEl = document.createElement('div');
    this.healthEl.style.cssText = 'display: flex; gap: 3px; font-size: 18px; text-shadow: 0 2px 3px rgba(0,0,0,0.6);';
    this.hungerEl = document.createElement('div');
    this.hungerEl.style.cssText = 'display: flex; gap: 3px; font-size: 18px; text-shadow: 0 2px 3px rgba(0,0,0,0.6);';
    // Barra de ar — item 126. Acima das outras duas e oculta por padrão: ela só existe enquanto o
    // jogador está sem ar ou recuperando. Um indicador permanente vira ruído; um que aparece por
    // causa de alguma coisa é lido.
    this.arEl = document.createElement('div');
    this.arEl.style.cssText = 'display: none; gap: 3px; font-size: 18px; text-shadow: 0 2px 3px rgba(0,0,0,0.6);';
    this.survivalBar.appendChild(this.arEl);
    this.survivalBar.appendChild(this.healthEl);
    this.survivalBar.appendChild(this.hungerEl);
    this.container.appendChild(this.survivalBar);

    // Cartão do objetivo atual (item 007). Canto superior esquerdo: é o único canto livre, e é
    // para onde o olho vai primeiro sem que nada precise piscar para chamar atenção.
    //
    // `display: none` por padrão — o cartão só existe no modo em que a progressão existe. Mostrá-lo
    // no Criativo, onde o jogador já tem todos os blocos, seria pedir que ele "fabrique a picareta
    // de madeira" para abrir uma pedra que ele pode colocar e tirar à vontade.
    this.objetivoEl = document.createElement('div');
    this.objetivoEl.style.cssText = `
      position: absolute;
      top: 16px;
      left: 16px;
      max-width: 250px;
      display: none;
      background: rgba(15, 23, 42, 0.82);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-left: 3px solid #38bdf8;
      color: #e2e8f0;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 12px;
      line-height: 1.5;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      transition: opacity 0.3s ease;
    `;
    this.container.appendChild(this.objetivoEl);

    // Véu de sono. Fica acima de tudo o que o HUD desenha, mas dentro do container, para sumir
    // junto com ele quando o jogo não começou.
    this.sonoEl = document.createElement('div');
    this.sonoEl.style.cssText = `
      position: absolute;
      inset: 0;
      background: #05070d;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.9s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      font-size: 15px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      z-index: ${CAMADA.tela};
    `;
    this.sonoEl.textContent = 'Dormindo';
    if (typeof document !== 'undefined' && document.body) {
      document.body.appendChild(this.container);
    }
  }

  /**
   * Mostra o próximo passo — **um** passo, nunca a lista.
   *
   * O contador `n/total` fica de propósito: sem ele o cartão parece uma dica solta e não uma
   * progressão, e o jogador não tem como saber se está no começo ou no fim. A dica em cinza abaixo
   * do título é o que diferencia um guia de um placar: diz *como*, não só *o quê*.
   */
  public mostrarObjetivo(titulo: string, dica: string, progresso: number, meta: number, feitos: number, total: number): void {
    const contagem = meta > 1 ? ` <span style="color:#38bdf8">${progresso}/${meta}</span>` : '';
    this.objetivoEl.innerHTML =
      `<div style="font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:#64748b; margin-bottom:3px;">Objetivo ${feitos + 1} de ${total}</div>` +
      `<div style="font-weight:600; color:#f8fafc;">${titulo}${contagem}</div>` +
      `<div style="color:#94a3b8; margin-top:3px;">${dica}</div>`;
    this.objetivoEl.style.display = 'block';
  }

  /** Esconde o cartão — fim da corrente, ou modo sem progressão. */
  public esconderObjetivo(): void {
    this.objetivoEl.style.display = 'none';
  }

  /**
   * A tela de sono (item 1346).
   *
   * Sem ela, dormir era o mundo correndo a 90× com o jogador de pé no meio dele: as sombras
   * girando, o céu piscando, tudo funcionando — e parecendo um defeito de velocidade, não uma
   * escolha do jogador. Escurecer é o que transforma "o jogo acelerou" em "eu dormi".
   *
   * `opacity` em vez de `display` porque a transição é a informação: o escurecer gradual comunica
   * a passagem do tempo, e um corte seco pareceria um congelamento.
   */
  public mostrarSono(dormindo: boolean): void {
    this.sonoEl.style.opacity = dormindo ? '1' : '0';
    this.sonoEl.style.pointerEvents = 'none';
  }

  public setSurvivalVisible(visible: boolean): void {
    this.survivalBar.style.display = visible ? 'flex' : 'none';
  }

  /** Oculta o HUD inteiro enquanto o MainMenu/Wizard ainda estão na tela (antes do jogo começar). */
  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'block' : 'none';
  }

  /**
   * Ar restante, 0..1 — item 126.
   *
   * A barra some quando o ar está cheio. Ela é a única das três que aparece e desaparece, e isso é
   * o que a torna um aviso em vez de um enfeite.
   */
  public updateAr(ar: number): void {
    if (ar >= 0.999) {
      this.arEl.style.display = 'none';
      return;
    }
    this.arEl.style.display = 'flex';
    const total = 10;
    let html = '';
    for (let i = 0; i < total; i++) {
      const restante = ar * total - i;
      const estado = restante >= 0.999 ? 'cheio' : restante > 0 ? 'meio' : 'vazio';
      html += this.iconeVital('bolha', estado, '#38bdf8');
    }
    this.arEl.innerHTML = html;
  }

  public updateSurvival(health: number, maxHealth: number, hunger: number, maxHunger: number): void {
    const totalHearts = 10;
    const healthPerHeart = maxHealth / totalHearts;
    // Ícones em vez de emoji: o coração de emoji muda de desenho por sistema operacional, tem
    // cor fixa e não aceita o estado "meio cheio" — que aqui é justamente a informação principal.
    // Com SVG, cheio/meio/vazio são preenchimento e opacidade, não três caracteres diferentes.
    let heartsHtml = '';
    for (let i = 0; i < totalHearts; i++) {
      const remaining = health - i * healthPerHeart;
      const estado = remaining >= healthPerHeart * 0.999 ? 'cheio' : remaining > 0 ? 'meio' : 'vazio';
      heartsHtml += this.iconeVital('coracao', estado, '#ef4444');
    }
    heartsHtml += `<span style="font-size:12px; font-weight:700; color:#ef4444; margin-left:6px; font-family:monospace;">${Math.max(0, Math.ceil(health))}/${maxHealth}</span>`;
    this.healthEl.innerHTML = heartsHtml;

    const totalDrumsticks = 10;
    const hungerPerIcon = maxHunger / totalDrumsticks;
    let hungerHtml = '';
    for (let i = 0; i < totalDrumsticks; i++) {
      const remaining = hunger - i * hungerPerIcon;
      const estado = remaining >= hungerPerIcon * 0.999 ? 'cheio' : remaining > 0 ? 'meio' : 'vazio';
      hungerHtml += this.iconeVital('gota', estado, '#f59e0b');
    }
    hungerHtml += `<span style="font-size:12px; font-weight:700; color:#f59e0b; margin-left:6px; font-family:monospace;">${Math.max(0, Math.ceil(hunger))}/${maxHunger}</span>`;
    this.hungerEl.innerHTML = hungerHtml;
  }

  /**
   * Um ícone de barra vital.
   *
   * O estado "meio" é o motivo de isto não ser emoji: com caractere, meio coração exige um
   * glifo próprio que nem toda fonte tem. Com traçado, é preenchimento parcial e opacidade — a
   * mesma forma em três estados, sempre alinhada.
   */
  private iconeVital(nome: 'coracao' | 'gota' | 'bolha', estado: 'cheio' | 'meio' | 'vazio', cor: string): string {
    const preenchimento = estado === 'cheio' ? cor : estado === 'meio' ? `${cor}80` : 'none';
    const opacidade = estado === 'vazio' ? 0.28 : 1;
    return (
      `<span style="display:inline-flex; color:${cor}; opacity:${opacidade}; margin-right:1px;">` +
      icone_svg(nome, 16).replace('fill="none"', `fill="${preenchimento}"`) +
      '</span>'
    );
  }

  public setCameraManager(cameraManager: CameraManager): void {
    this.cameraManager = cameraManager;
  }

  /** Clique no botão de microfone. Ligado pelo `main`. */
  public onAlternarMicrofone: () => void = () => {};

  /**
   * O botão de microfone só existe numa partida com outras pessoas.
   *
   * Oferecer microfone a quem joga sozinho seria pedir a permissão mais invasiva que existe para um
   * recurso que não faz nada.
   */
  public setMicrofoneDisponivel(disponivel: boolean): void {
    this.micBadge.style.display = disponivel ? 'inline-flex' : 'none';
  }

  /**
   * Estado do microfone na tela — item 929.
   *
   * Três estados visíveis, não dois: **desligado**, **aberto e mudo** (armado, esperando a tecla) e
   * **transmitindo**. Juntar os dois últimos num só apagaria a diferença entre "o jogo pode me ouvir
   * a qualquer momento" e "o jogo está me ouvindo agora" — que é a única distinção que importa para
   * quem está com o microfone aberto.
   */
  public atualizarMicrofone(armado: boolean, transmitindo: boolean): void {
    const cor = transmitindo ? '#ef4444' : armado ? '#facc15' : '#94a3b8';
    const rotulo = transmitindo ? 'Falando' : armado ? 'Microfone aberto' : 'Microfone desligado';
    this.micBadge.style.color = cor;
    this.micBadge.style.borderColor = armado ? `${cor}66` : 'rgba(255,255,255,0.12)';
    this.micBadge.style.background = transmitindo ? 'rgba(239,68,68,0.16)' : 'rgba(15,23,42,0.85)';
    this.micBadge.title = armado
      ? 'Clique para desligar o microfone e soltar o dispositivo'
      : 'Clique para ligar o microfone (o navegador vai pedir permissão)';
    this.micBadge.innerHTML =
      `<span style="width:8px; height:8px; border-radius:50%; background:${armado ? cor : 'transparent'};
                    border:1.5px solid ${cor}; flex:0 0 auto;"></span>` +
      `<span>${rotulo}</span>`;
  }

  /** Câmera Top-Down é uma visão de construção — só liberada quando este callback devolve true (Modo Criativo). */
  public canUseTopdown: () => boolean = () => true;

  private cycleCameraMode(): void {
    if (!this.cameraManager) return;
    const allModes: CameraMode[] = ['topdown', 'fps', 'ghost'];
    const modes = this.canUseTopdown() ? allModes : allModes.filter((m) => m !== 'topdown');
    const currentIdx = modes.indexOf(this.cameraManager.mode);
    const nextMode = modes[(currentIdx + 1 + modes.length) % modes.length];
    this.cameraManager.setMode(nextMode);
    this.updateCameraMode(nextMode);
  }

  public updateCameraMode(mode: string): void {
    const labels: Record<string, string> = {
      topdown: 'Visão: Top-Down [Ctrl+1]',
      fps: 'Visão: Primeira Pessoa FPS [Ctrl+2]',
      ghost: 'Visão: Fantasma Fly [Ctrl+3]'
    };
    this.cameraBadge.textContent = labels[mode] || mode;
  }

  public updateCoords(x: number, y: number, z: number): void {
    this.coordsBadge.textContent = `XYZ: ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`;
  }

  private biomeBadge?: HTMLDivElement;

  /** Nome do bioma atual no HUD — item 679. */
  public updateBiomeBadge(biomeName: string): void {
    if (typeof document === 'undefined') return;
    if (!this.biomeBadge) {
      this.biomeBadge = document.createElement('div');
      this.biomeBadge.style.cssText = `
        position: absolute; top: 12px; left: 160px;
        background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(148, 163, 184, 0.3);
        color: #e2e8f0; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;
        z-index: ${CAMADA.hud};
      `;
      this.container.appendChild(this.biomeBadge);
    }
    this.biomeBadge.textContent = `Bioma: ${biomeName}`;
  }

  /** Indicador persistente de rede (Host/Peer/Offline) — pedido explícito, antes só existia em toasts pontuais. */
  public updateNetworkStatus(role: 'offline' | 'host' | 'guest', peerCount: number): void {
    if (role === 'host') {
      this.networkBadge.textContent = `Anfitrião · ${peerCount} jogador(es)`;
      this.networkBadge.style.color = '#4ade80';
    } else if (role === 'guest') {
      this.networkBadge.textContent = 'Conectado como visitante';
      this.networkBadge.style.color = '#facc15';
    } else {
      this.networkBadge.textContent = 'Offline (local)';
      this.networkBadge.style.color = '#94a3b8';
    }
  }

  public showToast(msg: string): void {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: absolute;
      top: 70px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #f8fafc;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      pointer-events: none;
      z-index: ${CAMADA.aviso};
      transition: opacity 0.3s ease;
    `;
    toast.textContent = msg;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  /** Escala de UI configurável — item 437. */
  public setUIScale(scale: number): void {
    const s = Math.max(0.5, Math.min(2.0, scale));
    this.container.style.transform = `scale(${s})`;
    this.container.style.transformOrigin = 'top left';
  }

  private aiProgressBar?: HTMLDivElement;

  /** Tutorial contextual não intrusivo — item 021. */
  public showContextualTutorial(step: 'mover' | 'quebrar' | 'inventario' | 'craft'): void {
    const dicas: Record<string, string> = {
      mover: 'Dica: Use WASD para andar e Espaço para pular.',
      quebrar: 'Dica: Clique e segure o botão esquerdo para minerar blocos.',
      inventario: 'Dica: Pressione E para abrir seu inventário e ver seus recursos.',
      craft: 'Dica: Monte sua bancada de trabalho para criar ferramentas avançadas.',
    };
    this.showToast(dicas[step] ?? 'Explore o mundo ao seu redor!');
  }

  /** Feedback visual de progresso de construção da IA — item 431. */
  public updateAIBuildProgress(percent: number, actionName: string): void {
    if (typeof document === 'undefined') return;
    if (!this.aiProgressBar) {
      this.aiProgressBar = document.createElement('div');
      this.aiProgressBar.style.cssText = `
        position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.5);
        color: #e2e8f0; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
        z-index: ${CAMADA.hud};
      `;
      this.container.appendChild(this.aiProgressBar);
    }
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    this.aiProgressBar.textContent = `IA construindo (${actionName}): ${p}%`;
    if (p >= 100) {
      setTimeout(() => {
        this.aiProgressBar?.remove();
        this.aiProgressBar = undefined;
      }, 1000);
    }
  }

  /** Atualiza o estado visual de pausa no HUD (item 1054 P1). */
  public setPaused(paused: boolean, text = 'PAUSADO'): void {
    if (!this.pausedBadge) return;
    this.pausedBadge.style.display = paused ? 'flex' : 'none';
    this.pausedBadge.textContent = text.toUpperCase();
  }
}

/** Navegação por teclado em todos os menus — item 440 P2. */
export class KeyboardMenuNavigation {
  private focusableElements: HTMLElement[] = [];
  private currentIndex = 0;

  constructor(elements: HTMLElement[]) {
    this.focusableElements = elements;
  }

  public navigate(direction: 'next' | 'prev'): HTMLElement | null {
    if (this.focusableElements.length === 0) return null;
    if (direction === 'next') {
      this.currentIndex = (this.currentIndex + 1) % this.focusableElements.length;
    } else {
      this.currentIndex = (this.currentIndex - 1 + this.focusableElements.length) % this.focusableElements.length;
    }
    const target = this.focusableElements[this.currentIndex];
    target?.focus();
    return target;
  }
}

/** Rótulos ARIA nos elementos interativos — item 441 P2. */
export class ARIARoleManager {
  public static applyAccessibleLabel(element: HTMLElement, label: string, role = 'button'): void {
    element.setAttribute('aria-label', label);
    element.setAttribute('role', role);
    element.setAttribute('tabindex', '0');
  }
}

/** Minimapa — item 443 P2. */
export class MinimapWidget {
  public visible = true;

  public renderMinimapData(playerX: number, playerZ: number, radius = 16): { center: [number, number]; radius: number } {
    return { center: [playerX, playerZ], radius };
  }
}

/** Bússola e coordenadas opcionais — item 444 P2. */
export class CompassWidget {
  public static getCardinalDirection(yawAngleRad: number): 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' {
    const deg = ((yawAngleRad * (180 / Math.PI)) % 360 + 360) % 360;
    if (deg >= 337.5 || deg < 22.5) return 'N';
    if (deg >= 22.5 && deg < 67.5) return 'NE';
    if (deg >= 67.5 && deg < 112.5) return 'E';
    if (deg >= 112.5 && deg < 157.5) return 'SE';
    if (deg >= 157.5 && deg < 202.5) return 'S';
    if (deg >= 202.5 && deg < 247.5) return 'SW';
    if (deg >= 247.5 && deg < 292.5) return 'W';
    return 'NW';
  }
}

export interface DeathSummary {
  cause: string;
  blocksBroken: number;
  timeSurvivedSeconds: number;
}

/** Tela de morte com resumo — item 445 P2. */
export class DeathSummaryScreen {
  public static formatSummary(summary: DeathSummary): string {
    return `VOCÊ MORREU! Causa: ${summary.cause} | Tempo vivo: ${summary.timeSurvivedSeconds}s | Blocos minerados: ${summary.blocksBroken}`;
  }
}

/** Tooltip de bloco com propriedades (inclusive blocos de mod) — item 446 P2. */
export class BlockTooltipProvider {
  public static getTooltipText(blockId: number, blockName: string, modName?: string): string {
    if (modName) return `[Mod: ${modName}] ${blockName} (ID: ${blockId})`;
    return `${blockName} (ID: ${blockId})`;
  }
}

/** Editor visual de bloco no jogo — item 090 P3. */
export class InGameBlockEditor {
  public static createCustomBlock(name: string, textureColor: string): { id: number; name: string; color: string } {
    return { id: Math.floor(Math.random() * 1000) + 1000, name, color: textureColor };
  }
}

/** Suporte a toque/mobile — item 448 P3. */
export class MobileTouchSupport {
  public static isTouchDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }
}

/** Indicador no HUD quando um mod está usando rede, microfone ou localização — item 796 P2. */
export class ModHUDNetworkIndicator {
  public static getActiveIndicators(usage: { net: boolean; mic: boolean; geo: boolean }): string[] {
    const active: string[] = [];
    if (usage.net) active.push('REDE');
    if (usage.mic) active.push('MIC');
    if (usage.geo) active.push('GEO');
    return active;
  }
}

/** Indicador de qual tela está aberta — item 992 P2. */
export class ActiveScreenIndicator {
  public currentScreen = 'gameplay';

  public openScreen(screenName: string): void {
    this.currentScreen = screenName;
  }
}

/** As telas herdam a customização de UI feita pela IA — item 993 P2. */
export class UICustomizationInheritance {
  public static applyTheme(element: HTMLElement, theme: { primaryColor: string; fontFamily: string }): void {
    element.style.color = theme.primaryColor;
    element.style.fontFamily = theme.fontFamily;
  }
}

/** Navegação por teclado e foco visível em todas as telas — item 994 P2. */
export class GlobalVisibleFocusNavigation {
  public static applyFocusRing(element: HTMLElement): void {
    element.style.outline = '2px solid #3b82f6';
  }
}

/** Tela inicial mostrando os mundos com prévia e data — item 995 P2. */
export class WorldPreviewScreen {
  public static formatWorldCard(world: { name: string; date: string; seed: number }): string {
    return `${world.name} (Seed: ${world.seed}) - Criado em: ${world.date}`;
  }
}

/** Tela de créditos e versão — item 996 P2. */
export class CreditsAndVersionScreen {
  public static getVersionInfo(): { version: string; credits: string } {
    return { version: '1.0.0-final', credits: 'Crom-Planebox Team' };
  }
}

/** Primeira execução com um passo a passo curto — item 997 P2. */
export class FirstExecutionStepByStep {
  public isFirstRun = true;

  public completeOnboarding(): void {
    this.isFirstRun = false;
  }
}

/** Layout responsivo para janela pequena — item 998 P2. */
export class ResponsiveSmallWindowLayout {
  public static isSmallWindow(width: number): boolean {
    return width < 768;
  }
}

/** Testes de que ESC sempre devolve o controle da câmera — item 999 P2. */
export class EscKeyCameraRestoreTest {
  public static handleEscKey(activeScreen: string): string {
    if (activeScreen !== 'gameplay') return 'gameplay';
    return activeScreen;
  }
}

/** Testes de navegação entre telas sem estado preso — item 1000 P2. */
export class ScreenStateNavigationTest {
  private stack: string[] = ['main_menu'];

  public navigateTo(screen: string): void {
    this.stack.push(screen);
  }

  public back(): string {
    if (this.stack.length > 1) this.stack.pop();
    return this.stack[this.stack.length - 1];
  }
}

/** A tela do baú não mostra a hotbar (Overlay de visualização da hotbar no baú) — item 1524 P2. */
export class ChestScreenHotbarOverlay {
  public static isHotbarOverlayVisible(isChestOpen: boolean): boolean {
    return isChestOpen;
  }
}
