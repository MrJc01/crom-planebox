// Gerenciador central de estado de UI: garante que só um overlay "bloqueante"
// (Pause Menu, Inventário) fique aberto por vez, que o ESC sempre feche um nível
// por chamada (em vez de alternar de forma imprevisível), e que o pointer lock
// seja liberado/restaurado de um único lugar em vez de espalhado pelo main.ts.
//
// ## Por que a pilha não é a verdade
//
// A primeira versão guardava uma pilha de ids e confiava nela. Só que **toda tela tem o próprio
// botão de fechar**, e esses botões chamam `close()` direto, sem passar por aqui. A pilha ficava
// com um id fantasma, `blockingStack.length > 0` valia para sempre, e o clique no canvas desistia
// na primeira linha: a dica "clique para voltar ao jogo" aparecia e o clique não fazia nada.
//
// A correção não é obrigar cada tela a avisar — é parar de manter estado duplicado. A verdade é
// o `isOpen` de cada tela, que ela já mantém corretamente. A pilha existe só para a **ordem** do
// ESC, e é podada contra o `isOpen` antes de qualquer leitura.

export interface UIScreen {
  id: string;
  open(): void;
  close(): void;
  isOpen: boolean;
}

export class UIManager {
  private blocking = new Map<string, UIScreen>();
  private floating = new Map<string, UIScreen>();
  /** Só ordem, nunca presença: quem responde "está aberto?" é o `isOpen` da tela. */
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

  /**
   * Reconcilia a pilha com o estado real das telas.
   *
   * Tira quem já se fechou sozinho e adota quem se abriu sozinho — telas abertas por caminhos
   * que não passam pelo `openBlocking` continuam sendo fechadas na ordem certa pelo ESC.
   */
  private podarPilha(): void {
    const antes = this.blockingStack.length > 0;
    this.blockingStack = this.blockingStack.filter((id) => this.blocking.get(id)?.isOpen);
    for (const [id, tela] of this.blocking) {
      if (tela.isOpen && !this.blockingStack.includes(id)) this.blockingStack.push(id);
    }
    // A última tela se fechou por conta própria (botão dela, clique fora, atalho interno).
    // Ninguém avisou, mas o efeito é o mesmo de um `closeBlocking`: o jogo voltou, e o controle
    // da câmera precisa voltar junto. `setTimeout` para não reentrar no meio da poda.
    if (antes && this.blockingStack.length === 0) {
      setTimeout(() => {
        if (!document.pointerLockElement && !this.isAnyBlockingOpen() && this.shouldRelock()) {
          this.aguardarGesto();
        }
      }, 0);
    }
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
    // Sem early-return em `!isOpen`: a tela pode ter se fechado sozinha, e este é justamente o
    // momento em que precisamos podar a pilha e devolver o controle da câmera.
    const target = this.blocking.get(id);
    if (target?.isOpen) target.close();
    this.podarPilha();
    this.tryRelock();
  }

  public isAnyBlockingOpen(): boolean {
    this.podarPilha();
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
   * logo após o usuário sair com ESC (no Chrome, cerca de 1,25 s). A chamada automática era
   * recusada em silêncio, e como nada mais tentava de novo, o mouse ficava solto para sempre.
   *
   * A correção é aceitar isso e usar o clique como gesto: tenta na hora (funciona quando o
   * fechamento veio de um clique num botão) e, se falhar, arma o próximo gesto do usuário.
   */
  private tryRelock(): void {
    if (!this.isAnyBlockingOpen() && this.lockElement && this.shouldRelock()) {
      this.solicitarLock();
    }
  }

  /**
   * Pede o lock. Seguro de chamar em excesso: se o pedido falhar por qualquer motivo — recusa
   * por tempo, documento sem foco, aba em segundo plano — a dica volta e o próximo gesto tenta
   * de novo. Nenhum caminho de falha deixa o jogador sem saída.
   */
  private solicitarLock(): void {
    if (!this.lockElement) return;
    if (document.pointerLockElement) {
      this.pararDeAguardar();
      return;
    }
    try {
      const r = (this.lockElement as HTMLElement).requestPointerLock() as unknown as Promise<void> | undefined;
      // Navegadores novos devolvem Promise; a rejeição precisa ser tratada ou vira erro solto.
      if (r && typeof (r as any).catch === 'function') (r as any).catch(() => this.aguardarGesto());
    } catch {
      this.aguardarGesto();
    }
    // Mesmo sem erro, o lock pode não vir. Confere depois e arma o gesto.
    setTimeout(() => {
      if (!document.pointerLockElement && this.shouldRelock() && !this.isAnyBlockingOpen()) {
        this.aguardarGesto();
      }
    }, 80);
  }

  /**
   * Tentativa pública, chamada por um gesto do usuário (clique na dica, tecla de movimento).
   * É a saída de emergência: mesmo que todo o resto tenha falhado, isto sempre pode ser chamado.
   */
  public retomarControle(): void {
    if (this.isAnyBlockingOpen()) return;
    if (!this.shouldRelock()) return;
    this.solicitarLock();
  }

  /** Mostra a dica e espera um gesto — que é o que o navegador aceita como autorização. */
  private aguardarGesto(): void {
    if (this.aguardandoClique) return;
    this.aguardandoClique = true;
    this.onPointerLockPendente(true);
  }

  private pararDeAguardar(): void {
    if (!this.aguardandoClique) return;
    this.aguardandoClique = false;
    this.onPointerLockPendente(false);
  }

  private aguardandoClique = false;

  /** O jogo está esperando um gesto para retomar o controle da câmera? */
  public get aguardandoGesto(): boolean {
    return this.aguardandoClique;
  }

  /** Avisado quando o jogo está esperando um clique para retomar o controle da câmera. */
  public onPointerLockPendente: (pendente: boolean) => void = () => {};

  /**
   * Liga os gestos do usuário à retomada do lock. Chamado uma vez pelo `main`.
   * Sem isto, sair do menu com ESC deixaria o jogador sem controle de câmera até recarregar.
   */
  public configureRelockOnClick(canvas: HTMLElement): void {
    // No `document`, e não só no canvas: um overlay que ficou por cima — invisível ou não —
    // engoliria o clique se o ouvinte estivesse preso ao canvas. Na captura, pela mesma razão.
    document.addEventListener(
      'mousedown',
      (e) => {
        if (this.isAnyBlockingOpen() || !this.shouldRelock()) return;
        if (document.pointerLockElement) return;
        // Clique dentro de um painel flutuante (chat, hotbar) é para o painel, não para a câmera.
        const alvo = e.target as HTMLElement | null;
        if (alvo && alvo !== canvas && alvo.closest('input, textarea, button, select, [data-ui-panel]')) return;
        this.solicitarLock();
      },
      true,
    );

    // Depois de qualquer clique, reconcilia: se ele fechou a última tela por um caminho que não
    // passa por aqui, é neste momento que descobrimos e mostramos a dica.
    document.addEventListener('mouseup', () => setTimeout(() => this.isAnyBlockingOpen(), 0), true);

    // Teclado também é gesto válido. Cobre o caso de o clique estar sendo engolido por algo:
    // andar com WASD devolve a câmera sem o jogador precisar descobrir onde clicar.
    window.addEventListener('keydown', (e) => {
      if (!this.aguardandoClique) return;
      if (!/^(Key[WASD]|Space|Enter)$/.test(e.code)) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && /^(INPUT|TEXTAREA)$/.test(alvo.tagName)) return;
      this.retomarControle();
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) {
        this.pararDeAguardar();
      } else if (!this.isAnyBlockingOpen() && this.shouldRelock()) {
        // Perdeu o lock sem menu aberto: avisa, em vez de deixar o jogador sem saber o que fazer.
        this.aguardarGesto();
      }
    });

    // O navegador recusa o lock quando o documento perde o foco. Ao voltar, o estado precisa
    // ser reavaliado — senão a dica some (ou fica) sem corresponder à realidade.
    document.addEventListener('pointerlockerror', () => this.aguardarGesto());
    window.addEventListener('blur', () => {
      if (!document.pointerLockElement && !this.isAnyBlockingOpen() && this.shouldRelock()) this.aguardarGesto();
    });
  }

  /**
   * Contrato do ESC: fecha um nível por vez.
   * 1º: se há um overlay bloqueante aberto, fecha-o (e devolve o pointer lock se o modo pedir).
   * 2º: senão, se o chat/floating estiver aberto, fecha-o também.
   * 3º: senão, retorna false para o chamador decidir abrir o Pause Menu.
   */
  public handleEscape(): boolean {
    if (this.isAnyBlockingOpen()) {
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
