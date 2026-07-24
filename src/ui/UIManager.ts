// Gerenciador central de estado de UI: garante que só um overlay "bloqueante"
// (Pause Menu, Inventário) fique aberto por vez, que o ESC sempre feche um nível
// por chamada (em vez de alternar de forma imprevisível), e que o pointer lock
// seja liberado/restaurado de um único lugar em vez de espalhado pelo main.ts.

export interface UIScreen {
  id: string;
  open(): void;
  close(): void;
  isOpen: boolean;
}

export class UIManager {
  private blocking = new Map<string, UIScreen>();
  private floating = new Map<string, UIScreen>();
  private blockingStack: string[] = [];
  private lockElement: Element | null = null;
  private shouldRelock: () => boolean = () => false;

  /** Elemento do canvas que recebe pointer lock, e uma função que diz se o modo atual usa pointer lock. */
  public configureLock(lockElement: Element, shouldRelock: () => boolean): void {
    this.lockElement = lockElement;
    this.shouldRelock = shouldRelock;
  }

  /** Overlays exclusivos entre si (Pause Menu, Inventário): abrir um fecha o outro. */
  public registerBlocking(screen: UIScreen): void {
    this.blocking.set(screen.id, screen);
  }

  /** Overlays não-exclusivos (ex.: Chat) — podem conviver com o jogo rodando. */
  public registerFloating(screen: UIScreen): void {
    this.floating.set(screen.id, screen);
  }

  public openBlocking(id: string): void {
    const target = this.blocking.get(id);
    if (!target) return;
    if (document.pointerLockElement) document.exitPointerLock();
    for (const [otherId, screen] of this.blocking) {
      if (otherId !== id && screen.isOpen) screen.close();
    }
    this.blockingStack = this.blockingStack.filter((x) => x !== id);
    this.blockingStack.push(id);
    target.open();
  }

  public closeBlocking(id: string): void {
    const target = this.blocking.get(id);
    if (!target || !target.isOpen) return;
    target.close();
    this.blockingStack = this.blockingStack.filter((x) => x !== id);
    this.tryRelock();
  }

  public isAnyBlockingOpen(): boolean {
    return this.blockingStack.length > 0;
  }

  public openFloating(id: string): void {
    this.floating.get(id)?.open();
  }

  public closeFloating(id: string): void {
    this.floating.get(id)?.close();
  }

  public toggleFloating(id: string): void {
    const s = this.floating.get(id);
    if (!s) return;
    if (s.isOpen) s.close();
    else s.open();
  }

  private tryRelock(): void {
    if (this.blockingStack.length === 0 && this.lockElement && this.shouldRelock()) {
      try { (this.lockElement as HTMLElement).requestPointerLock(); } catch { /* ignora: precisa de gesto do usuário em alguns navegadores */ }
    }
  }

  /**
   * Contrato do ESC: fecha um nível por vez.
   * 1º: se há um overlay bloqueante aberto, fecha-o (e devolve o pointer lock se o modo pedir).
   * 2º: senão, se o chat/floating estiver aberto, fecha-o também.
   * 3º: senão, retorna false para o chamador decidir abrir o Pause Menu.
   */
  public handleEscape(): boolean {
    if (this.blockingStack.length > 0) {
      const topId = this.blockingStack[this.blockingStack.length - 1];
      this.closeBlocking(topId);
      return true;
    }
    for (const [, screen] of this.floating) {
      if (screen.isOpen) {
        screen.close();
        return true;
      }
    }
    return false;
  }
}
