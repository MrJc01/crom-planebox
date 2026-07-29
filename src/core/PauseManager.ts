// PauseManager — gerencia pausa automática por troca de aba e limpeza de teclas presas.
//
// Dois problemas que este módulo resolve:
//
//  1. O jogador troca de aba (Alt+Tab, clique no navegador) e o personagem continua andando
//     porque a tecla W estava presa quando o foco saiu. — Item 1057 P1
//
//  2. Trocar de aba com pointer lock ativo deveria pausar o jogo, mas hoje o mundo continua
//     rodando e o jogador volta para encontrar o personagem morto de fome. — Item 1056 P1
//
// O módulo é puro: não depende de DOM nem de requestAnimationFrame. As funções recebem o
// estado e devolvem o estado novo, e o integrador (Game.ts) é que conecta aos eventos reais.

export interface PressedKeysState {
  /** Conjunto de teclas atualmente pressionadas (ex: 'KeyW', 'Space'). */
  keys: Set<string>;
  /** Botões do mouse atualmente pressionados (0 = esquerdo, 2 = direito). */
  mouseButtons: Set<number>;
}

export interface PauseState {
  /** O jogo está pausado? */
  paused: boolean;
  /** Motivo da pausa atual. */
  reason?: 'visibility' | 'menu' | 'manual';
  /** Timestamp de quando a pausa começou. */
  pausedAt?: number;
}

/**
 * Cria um estado de teclas vazio.
 */
export function createEmptyPressedKeys(): PressedKeysState {
  return { keys: new Set(), mouseButtons: new Set() };
}

/**
 * Cria um estado de pausa inicial (não pausado).
 */
export function createInitialPauseState(): PauseState {
  return { paused: false };
}

/**
 * Limpa todas as teclas e botões pressionados — item 1057 P1.
 *
 * Chamada quando o documento perde o foco (`visibilitychange` para `hidden`, `blur`, ou
 * `pointerlockchange` sem lock). Sem isso uma tecla presa na troca de aba continua valendo
 * e o personagem anda sozinho — um defeito que parece bug de física mas é só estado sujo.
 */
export function clearPressedKeys(state: PressedKeysState): PressedKeysState {
  return { keys: new Set(), mouseButtons: new Set() };
}

/**
 * Trata mudança de visibilidade da aba — item 1056 P1.
 *
 * Quando `document.visibilityState` passa para `'hidden'`, o jogo pausa e as teclas são
 * limpas. Quando volta para `'visible'`, o jogo retoma *apenas* se a pausa foi causada por
 * visibilidade (não por menu, por exemplo).
 *
 * @param hidden - `true` se a aba ficou oculta, `false` se voltou.
 * @param currentPause - estado de pausa atual.
 * @param currentKeys - estado de teclas atual.
 * @param isMultiplayer - em multiplayer o mundo do anfitrião continua; a pausa local só
 *   congela a câmera e os inputs, não a simulação remota.
 */
export function handleVisibilityChange(
  hidden: boolean,
  currentPause: PauseState,
  currentKeys: PressedKeysState,
  isMultiplayer = false,
): { pause: PauseState; keys: PressedKeysState } {
  if (hidden) {
    // Aba escondida: limpar teclas sempre, pausar se não for multiplayer
    const keys = clearPressedKeys(currentKeys);
    if (isMultiplayer) {
      // Em multiplayer só limpa teclas, não pausa a simulação
      return { pause: currentPause, keys };
    }
    return {
      pause: { paused: true, reason: 'visibility', pausedAt: Date.now() },
      keys,
    };
  }

  // Aba voltou: retomar somente se a pausa foi por visibilidade
  if (currentPause.paused && currentPause.reason === 'visibility') {
    return {
      pause: { paused: false },
      keys: currentKeys,
    };
  }

  // Pausa por menu ou manual: não retoma automaticamente
  return { pause: currentPause, keys: currentKeys };
}

/**
 * Registra uma tecla como pressionada.
 */
export function pressKey(state: PressedKeysState, code: string): PressedKeysState {
  const keys = new Set(state.keys);
  keys.add(code);
  return { ...state, keys };
}

/**
 * Registra uma tecla como solta.
 */
export function releaseKey(state: PressedKeysState, code: string): PressedKeysState {
  const keys = new Set(state.keys);
  keys.delete(code);
  return { ...state, keys };
}

/**
 * Pausa de fato a simulação no singleplayer quando qualquer modal bloqueante abre — item 1053 P1.
 * Em multiplayer, o mundo continua rodando sem congelar os demais jogadores — item 1055 P1.
 */
export function pauseWorldInSingleplayer(
  openModal: boolean,
  currentPause: PauseState,
  isMultiplayer = false,
): PauseState {
  if (isMultiplayer) {
    return currentPause;
  }
  if (openModal) {
    return { paused: true, reason: 'menu', pausedAt: Date.now() };
  }
  if (currentPause.reason === 'menu') {
    return { paused: false };
  }
  return currentPause;
}

/**
 * Alerta de confirmação no fechamento da página para prevenir perda de progresso — item 1591 P1.
 */
export function setupBeforeUnloadHandler(isSessionActive: () => boolean): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: BeforeUnloadEvent) => {
    if (!isSessionActive()) return;
    e.preventDefault();
    e.returnValue = 'Tem certeza de que deseja sair? O progresso não salvo pode ser perdido.';
    return e.returnValue;
  };

  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}
