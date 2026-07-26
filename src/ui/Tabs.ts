// Abas: componente central de navegação por abas com transições fluidas e atalhos.
import { CORES, FONTE } from './theme';
import { NomeIcone, icone } from './icons';

export interface DefinicaoAba {
  id: string;
  titulo: string;
  icone: NomeIcone;
  /** Construído na primeira abertura. Recebe o container onde deve desenhar. */
  montar: (destino: HTMLElement) => void;
  /** Chamado a cada vez que a aba passa a ser a ativa, inclusive na primeira. */
  aoAtivar?: (destino: HTMLElement) => void;
  /** Emblema numérico (ex.: quantidade de mods). Ausente = sem emblema. */
  emblema?: () => number;
}

// Injeta estilos CSS para animação de slide + fade suave
const styleId = 'tabs-animation-styles';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes tabFadeInSlide {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .tab-panel-active {
      animation: tabFadeInSlide 160ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @media (prefers-reduced-motion: reduce) {
      .tab-panel-active {
        animation: none !important;
      }
    }
  `;
  document.head?.appendChild(style);
}

export class Tabs {
  readonly raiz = document.createElement('div');
  private barra = document.createElement('div');
  private corpo = document.createElement('div');
  private rodape = document.createElement('div');

  private abas: DefinicaoAba[] = [];
  private botoes = new Map<string, HTMLButtonElement>();
  private paineis = new Map<string, HTMLElement>();
  private montadas = new Set<string>();

  /** **A única fonte da verdade** sobre o que está visível. */
  private ativa: string | null = null;

  /** Avisado quando a aba muda, para a tela persistir a escolha. */
  public onTrocou: (id: string) => void = () => {};

  constructor() {
    this.raiz.style.cssText = `
      display: flex; flex-direction: column; min-height: 0; height: 100%;
      font-family: ${FONTE};
    `;

    // A barra rola na horizontal com estilo de Top Bar de abas
    this.barra.setAttribute('role', 'tablist');
    this.barra.style.cssText = `
      display: flex; gap: 4px; padding: 0 40px;
      overflow-x: auto; overflow-y: hidden; scrollbar-width: none;
      border-bottom: 1px solid rgba(255,255,255,0.08); flex: 0 0 auto;
      background: rgba(15, 23, 42, 0.5); min-height: 48px; align-items: stretch;
    `;

    this.corpo.style.cssText = 'flex: 1 1 auto; min-height: 0; overflow: auto; padding: 20px 40px;';

    this.rodape.style.cssText = `
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 10px 40px; border-top: 1px solid rgba(255,255,255,0.08); flex: 0 0 auto;
      font-size: 11px; color: ${CORES.textoFraco}; background: rgba(15, 23, 42, 0.6);
    `;
    this.rodape.innerHTML = `
      <div style="display:flex; gap:14px; align-items:center;">
        <span><kbd style="background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:4px; font-family:monospace;">Q / E</kbd> Alternar Aba</span>
        <span><kbd style="background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:4px; font-family:monospace;">Esc</kbd> Voltar / Fechar</span>
      </div>
      <div style="font-size:10px; opacity:0.7;">Crom Engine Hub</div>
    `;

    this.raiz.append(this.barra, this.corpo, this.rodape);
    this.ligarTeclado();
  }

  public adicionar(aba: DefinicaoAba): this {
    this.abas.push(aba);

    const b = document.createElement('button');
    b.setAttribute('role', 'tab');
    b.dataset.aba = aba.id;
    b.style.cssText = `
      display: inline-flex; align-items: center; gap: 8px;
      background: none; border: none; border-bottom: 3px solid transparent;
      color: ${CORES.textoFraco}; font-family: ${FONTE}; font-size: 14px; font-weight: 600;
      padding: 12px 20px; cursor: pointer; white-space: nowrap;
      transition: color .15s, border-color .15s, background .15s;
      border-radius: 0;
    `;
    b.append(icone(aba.icone, 17));

    const rotulo = document.createElement('span');
    rotulo.textContent = aba.titulo;
    b.append(rotulo);

    if (aba.emblema) {
      const em = document.createElement('span');
      em.dataset.emblema = '1';
      em.style.cssText = `
        background: ${CORES.borda}; color: ${CORES.textoFraco};
        border-radius: 999px; padding: 1px 7px; font-size: 11px; font-weight: 700;
      `;
      b.append(em);
    }

    b.onmouseenter = () => { if (this.ativa !== aba.id) b.style.color = CORES.texto; };
    b.onmouseleave = () => { if (this.ativa !== aba.id) b.style.color = CORES.textoFraco; };
    b.onclick = () => this.ir(aba.id);

    const painel = document.createElement('div');
    painel.setAttribute('role', 'tabpanel');
    painel.style.cssText = 'display: none; height: 100%; min-height: 0;';

    this.botoes.set(aba.id, b);
    this.paineis.set(aba.id, painel);
    this.barra.append(b);
    this.corpo.append(painel);
    return this;
  }

  public proxima(): void {
    if (this.abas.length === 0) return;
    const idx = this.abas.findIndex((a) => a.id === this.ativa);
    const proxIdx = (idx + 1) % this.abas.length;
    this.ir(this.abas[proxIdx].id);
  }

  public anterior(): void {
    if (this.abas.length === 0) return;
    const idx = this.abas.findIndex((a) => a.id === this.ativa);
    const antIdx = (idx - 1 + this.abas.length) % this.abas.length;
    this.ir(this.abas[antIdx].id);
  }

  public ir(id: string): void {
    const alvo = this.paineis.has(id) ? id : this.abas[0]?.id;
    if (!alvo || alvo === this.ativa) {
      if (alvo && alvo === this.ativa) this.reativar(alvo);
      return;
    }
    this.ativa = alvo;
    this.aplicar();
    this.reativar(alvo);
    this.onTrocou(alvo);
  }

  private reativar(id: string): void {
    const aba = this.abas.find((a) => a.id === id);
    const painel = this.paineis.get(id);
    if (!aba || !painel) return;
    if (!this.montadas.has(id)) {
      this.montadas.add(id);
      aba.montar(painel);
    }
    aba.aoAtivar?.(painel);
  }

  private aplicar(): void {
    for (const aba of this.abas) {
      const ativo = aba.id === this.ativa;
      const b = this.botoes.get(aba.id)!;
      const p = this.paineis.get(aba.id)!;

      p.style.display = ativo ? 'block' : 'none';
      if (ativo) {
        p.classList.remove('tab-panel-active');
        // Força reflow para reiniciar animação suave
        void p.offsetWidth;
        p.classList.add('tab-panel-active');
      } else {
        p.classList.remove('tab-panel-active');
      }

      b.setAttribute('aria-selected', String(ativo));
      b.tabIndex = ativo ? 0 : -1;
      b.style.color = ativo ? CORES.aviso : CORES.textoFraco;
      b.style.borderBottomColor = ativo ? CORES.aviso : 'transparent';
      b.style.background = ativo ? 'rgba(251,191,36,0.07)' : 'transparent';

      const em = b.querySelector<HTMLElement>('[data-emblema]');
      if (em && aba.emblema) {
        const n = aba.emblema();
        em.textContent = String(n);
        em.style.display = n > 0 ? '' : 'none';
      }
    }

    const botao = this.ativa ? this.botoes.get(this.ativa) : undefined;
    botao?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  private ligarTeclado(): void {
    const handler = (e: KeyboardEvent) => {
      // Ignora atalhos de digitação se estiver escrevendo num input ou textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const i = this.abas.findIndex((a) => a.id === this.ativa);
      if (i < 0) return;

      if (e.key === 'ArrowRight' || e.code === 'KeyE') {
        e.preventDefault();
        this.proxima();
        this.botoes.get(this.ativa || '')?.focus();
      } else if (e.key === 'ArrowLeft' || e.code === 'KeyQ') {
        e.preventDefault();
        this.anterior();
        this.botoes.get(this.ativa || '')?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        this.ir(this.abas[0]?.id);
      } else if (e.key === 'End') {
        e.preventDefault();
        this.ir(this.abas[this.abas.length - 1]?.id);
      }
    };

    this.raiz.addEventListener('keydown', handler);
  }

  public iniciar(id?: string): void {
    this.ir(id ?? this.ativa ?? this.abas[0]?.id ?? '');
  }

  public get ativaId(): string | null {
    return this.ativa;
  }

  public atualizarEmblemas(): void {
    if (this.ativa) this.aplicar();
  }

  public painelDe(id: string): HTMLElement | undefined {
    return this.paineis.get(id);
  }

  public invalidar(id: string): void {
    this.montadas.delete(id);
    const p = this.paineis.get(id);
    if (p) p.innerHTML = '';
  }
}
