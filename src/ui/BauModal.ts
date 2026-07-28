// A tela de um baú — item 137.
//
// ## Por que uma tela própria, e não uma aba do inventário
//
// O inventário existente é o inventário **criativo**: uma paleta de tudo o que existe, com bancada
// e abas. Um baú é o oposto — um punhado de coisas que o jogador pôs ali. Encaixá-lo como aba
// misturaria "o que existe no jogo" com "o que é meu", e a primeira coisa que alguém faria seria
// tentar arrastar da paleta para o baú.
//
// ## Por que clicar move a pilha inteira
//
// Não há arrastar. Clicar num slot do baú tira a pilha para a hotbar; clicar num slot da hotbar
// guarda a pilha no baú. Arrastar exigiria estado de arraste, alvo de soltura e o caso de soltar
// fora — três fontes de bug para uma operação que, num jogo sem economia fina, sempre move tudo.
//
// ## Por que ela não conhece o banco
//
// Recebe os slots e avisa quando mudam. Quem grava é o `main`, que já sabe qual mundo está aberto.
// Uma tela que escreve no banco precisaria saber quando parar de escrever — ao trocar de mundo, ao
// fechar, ao perder o foco — e essa é exatamente a lista de casos que costuma faltar.

import { PilhaDeBau, SLOTS_DO_BAU, COLUNAS_DO_BAU, nomeDoBloco } from '../game/bau';
import { BLOCKS } from '../world/blocks';
import { CAMADA, CORES, RAIO } from './theme';
import { icone_svg } from './icons';

export class BauModal {
  public readonly id = 'bau';
  private overlay: HTMLDivElement;
  private grade: HTMLDivElement;
  private titulo: HTMLDivElement;
  private rodape: HTMLDivElement;

  public get raiz(): HTMLElement { return this.overlay; }
  public isOpen = false;

  private slots: (PilhaDeBau | null)[] = [];

  /** O jogador tirou esta pilha do baú. Quem decide se ela cabe na hotbar é o `main`. */
  public onRetirar: (indice: number) => void = () => {};
  /** Guardar o que está na mão. */
  public onGuardarSelecionado: () => void = () => {};
  /** O conteúdo mudou e precisa ser gravado. */
  public onMudou: () => void = () => {};
  public onFechar: () => void = () => {};

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; inset: 0; display: none;
      align-items: center; justify-content: center;
      background: rgba(2, 6, 23, 0.62); backdrop-filter: blur(6px);
      z-index: ${CAMADA.tela}; font-family: system-ui, sans-serif;
    `;

    const painel = document.createElement('div');
    painel.style.cssText = `
      background: ${CORES.painel}; border: 1px solid ${CORES.borda};
      border-radius: ${RAIO.lg}; padding: 20px 22px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.55); min-width: 520px;
    `;

    this.titulo = document.createElement('div');
    this.titulo.style.cssText = `
      display:flex; align-items:center; gap:8px; color:${CORES.texto};
      font-weight:700; font-size:15px; margin-bottom:14px;
    `;
    painel.appendChild(this.titulo);

    this.grade = document.createElement('div');
    this.grade.style.cssText = `
      display:grid; grid-template-columns: repeat(${COLUNAS_DO_BAU}, 46px); gap:6px;
    `;
    painel.appendChild(this.grade);

    this.rodape = document.createElement('div');
    this.rodape.style.cssText = `
      margin-top:14px; color:${CORES.textoFraco}; font-size:12px; line-height:1.6;
    `;
    painel.appendChild(this.rodape);

    this.overlay.appendChild(painel);
    document.body.appendChild(this.overlay);

    // Clicar fora fecha. O baú não tem confirmação nem estado pendente: tudo o que ele faz já
    // aconteceu no instante do clique, então não há nada que fechar possa perder.
    this.overlay.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) this.fechar();
    });
  }

  /**
   * `UIScreen` exige `open`/`close` sem argumento. `open` sozinho não faz sentido para um baú — ele
   * é sempre aberto *de alguma posição* —, então ele só reexibe o que já estava carregado. Quem
   * abre de verdade é `abrir`.
   */
  public open(): void {
    if (this.slots.length > 0) this.overlay.style.display = 'flex';
    this.isOpen = this.slots.length > 0;
  }

  public close(): void {
    this.fechar();
  }

  public abrir(slots: (PilhaDeBau | null)[], rotulo: string): void {
    this.slots = slots;
    this.titulo.innerHTML = `${icone_svg('inventario', 18)}<span>${rotulo}</span>`;
    this.isOpen = true;
    this.overlay.style.display = 'flex';
    this.desenhar();
  }

  public fechar(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.style.display = 'none';
    this.onFechar();
  }

  /** Redesenha depois de uma mudança vinda de fora (guardar da hotbar, por exemplo). */
  public atualizar(): void {
    if (this.isOpen) this.desenhar();
  }

  private desenhar(): void {
    this.grade.innerHTML = '';
    for (let i = 0; i < SLOTS_DO_BAU; i++) {
      const p = this.slots[i];
      const cel = document.createElement('button');
      cel.type = 'button';
      const cor = p ? this.corDoBloco(p.block) : 'transparent';
      cel.style.cssText = `
        width:46px; height:46px; border-radius:${RAIO.sm};
        border:1px solid ${CORES.borda}; background:${p ? cor : 'rgba(255,255,255,0.04)'};
        position:relative; cursor:${p ? 'pointer' : 'default'}; padding:0;
      `;
      if (p) {
        cel.title = `${nomeDoBloco(p.block)} × ${p.count}`;
        const n = document.createElement('span');
        n.textContent = String(p.count);
        n.style.cssText = `
          position:absolute; right:3px; bottom:2px; font-size:11px; font-weight:700;
          color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.9); font-family:monospace;
        `;
        cel.appendChild(n);
        cel.addEventListener('click', () => this.onRetirar(i));
      } else {
        cel.disabled = true;
      }
      this.grade.appendChild(cel);
    }

    this.rodape.innerHTML =
      'Clique numa pilha para <strong>pegar</strong>. '
      + '<strong>[G]</strong> guarda o que está na mão. <strong>[ESC]</strong> fecha.';
  }

  /** Cor do topo do bloco, como a paleta a define — sem inventar nada aqui. */
  private corDoBloco(block: number): string {
    const c = BLOCKS[block]?.colors?.[0];
    if (!c) return CORES.borda;
    const b = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
    return `rgb(${b(c[0])}, ${b(c[1])}, ${b(c[2])})`;
  }
}
