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

  /**
   * Retomar o pointer lock **não** funciona automaticamente depois do ESC.
   *
   * O navegador exige um gesto do usuário para conceder o lock, e impõe um período de recusa
   * logo após o usuário sair com ESC. A chamada automática era recusada em silêncio (o `catch`
   * engolia), e como nada mais tentava de novo, o mouse ficava solto para sempre — sem jeito de
   * voltar a girar a câmera.
   *
   * A correção é aceitar isso e usar o clique como gesto: tenta na hora (funciona quando o
   * fechamento veio de um clique num botão) e, se falhar, arma o próximo clique no canvas.
   */
  private tryRelock(): void {
    if (this.blockingStack.length === 0 && this.lockElement && this.shouldRelock()) {
      this.solicitarLock();
    }
  }

  private solicitarLock(): void {
    if (!this.lockElement || document.pointerLockElement) return;
    try {
      const r = (this.lockElement as HTMLElement).requestPointerLock() as unknown as Promise<void> | undefined;
      // Navegadores novos devolvem Promise; a rejeição precisa ser tratada ou vira erro solto.
      if (r && typeof (r as any).catch === 'function') (r as any).catch(() => this.aguardarClique());
    } catch {
      this.aguardarClique();
    }
    // Mesmo sem erro, o lock pode não vir. Confere no frame seguinte e arma o clique.
    setTimeout(() => {
      if (!document.pointerLockElement && this.shouldRelock() && this.blockingStack.length === 0) {
        this.aguardarClique();
      }
    }, 60);
  }

  /** Mostra a dica e espera um clique — que é o gesto que o navegador aceita. */
  private aguardarClique(): void {
    if (this.aguardandoClique) return;
    this.aguardandoClique = true;
    this.onPointerLockPendente(true);
  }

  private aguardandoClique = false;

  /** Avisado quando o jogo está esperando um clique para retomar o controle da câmera. */
  public onPointerLockPendente: (pendente: boolean) => void = () => {};

  /**
   * Liga o clique no canvas à retomada do lock. Chamado uma vez pelo `main`.
   * Sem isto, sair do menu com ESC deixaria o jogador sem controle de câmera até recarregar.
   */
  public configureRelockOnClick(canvas: HTMLElement): void {
    canvas.addEventListener('mousedown', () => {
      if (this.blockingStack.length > 0 || !this.shouldRelock()) return;
      if (document.pointerLockElement) return;
      try { (canvas as HTMLElement).requestPointerLock(); } catch { /* o próximo clique tenta de novo */ }
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) {
        this.aguardandoClique = false;
        this.onPointerLockPendente(false);
      } else if (this.blockingStack.length === 0 && this.shouldRelock()) {
        // Perdeu o lock sem menu aberto: avisa, em vez de deixar o jogador sem saber o que fazer.
        this.aguardarClique();
      }
    });
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
