// @vitest-environment jsdom
//
// Armadilha de foco e navegação por abas.
//
// ## Por que a armadilha importa neste jogo
//
// Sem ela o Tab sai da tela aberta e cai no que está por baixo: o foco vai parar num botão da
// hotbar ou num campo do chat que o jogador **não consegue ver**, porque a tela bloqueante está
// na frente. Ele aperta Enter e alguma coisa acontece em outro lugar.
//
// É a mesma família do relato "clico numa coisa e abre outra" — só que pelo teclado, e pior:
// no clique ao menos existe um alvo visível para culpar.

import { describe, it, expect, beforeEach } from 'vitest';
import { UIManager, UIScreen } from '../../src/ui/UIManager';
import { Tabs } from '../../src/ui/Tabs';

/** Tela de mentira com raiz real no DOM — a armadilha lê `offsetParent` e `contains`. */
function telaComBotoes(id: string, quantos: number): UIScreen & { raiz: HTMLElement } {
  const raiz = document.createElement('div');
  raiz.dataset.tela = id;
  for (let i = 0; i < quantos; i++) {
    const b = document.createElement('button');
    b.textContent = `${id}-${i}`;
    raiz.appendChild(b);
  }
  document.body.appendChild(raiz);
  return {
    id,
    raiz,
    isOpen: false,
    open() { this.isOpen = true; raiz.style.display = 'block'; },
    close() { this.isOpen = false; raiz.style.display = 'none'; },
  };
}

function tab(shift = false): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, cancelable: true });
}

function botoesDe(tela: { raiz: HTMLElement }): HTMLButtonElement[] {
  return Array.from(tela.raiz.querySelectorAll('button'));
}

// jsdom não faz layout, então `offsetParent` é sempre nulo e a armadilha descartaria tudo como
// invisível. Ensinar `offsetParent` a responder pelo `display` é o mínimo para o teste medir a
// regra que interessa — que painéis de aba escondidos ficam fora da ordem do Tab.
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      for (let n: HTMLElement | null = this; n; n = n.parentElement) {
        if (n.style.display === 'none') return null;
      }
      return this.parentElement;
    },
  });
  document.body.innerHTML = '';
});

describe('armadilha de foco — o Tab não escapa da tela aberta', () => {
  it('CRÍTICO: do último elemento, o Tab volta para o primeiro', () => {
    const ui = new UIManager();
    const tela = telaComBotoes('inv', 3);
    ui.registerBlocking(tela);
    ui.openBlocking('inv');

    const bs = botoesDe(tela);
    bs[2].focus();
    ui.tratarTab(tab());
    expect(document.activeElement).toBe(bs[0]);
  });

  it('CRÍTICO: do primeiro, Shift+Tab vai para o último', () => {
    const ui = new UIManager();
    const tela = telaComBotoes('inv', 3);
    ui.registerBlocking(tela);
    ui.openBlocking('inv');

    const bs = botoesDe(tela);
    bs[0].focus();
    ui.tratarTab(tab(true));
    expect(document.activeElement).toBe(bs[2]);
  });

  it('CRÍTICO: foco que está FORA da tela é trazido para dentro', () => {
    // O caso real: o jogador clicou no canvas e depois abriu o inventário pelo atalho. O foco
    // ficou no corpo do documento, e o primeiro Tab não pode levá-lo para a hotbar por baixo.
    const ui = new UIManager();
    const fora = document.createElement('button');
    document.body.appendChild(fora);
    const tela = telaComBotoes('inv', 2);
    ui.registerBlocking(tela);
    ui.openBlocking('inv');

    fora.focus();
    expect(document.activeElement).toBe(fora);

    ui.tratarTab(tab());
    expect(tela.raiz.contains(document.activeElement)).toBe(true);
  });

  it('o Tab no meio da tela segue o caminho normal do navegador', () => {
    // A armadilha só age nas pontas. Interceptar sempre significaria reimplementar a ordem de
    // tabulação inteira, incluindo `tabindex` positivo — e errar isso é pior que não ter.
    const ui = new UIManager();
    const tela = telaComBotoes('inv', 3);
    ui.registerBlocking(tela);
    ui.openBlocking('inv');

    const bs = botoesDe(tela);
    bs[1].focus();
    const e = tab();
    ui.tratarTab(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('sem tela aberta, o Tab é do jogo — a armadilha não interfere', () => {
    const ui = new UIManager();
    const tela = telaComBotoes('inv', 2);
    ui.registerBlocking(tela);

    const e = tab();
    ui.tratarTab(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('tela sem nada focável engole o Tab em vez de soltá-lo por baixo', () => {
    const ui = new UIManager();
    const tela = telaComBotoes('vazia', 0);
    ui.registerBlocking(tela);
    ui.openBlocking('vazia');

    const e = tab();
    ui.tratarTab(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it('a armadilha segue a tela do TOPO quando uma substitui a outra', () => {
    const ui = new UIManager();
    const a = telaComBotoes('a', 2);
    const b = telaComBotoes('b', 2);
    ui.registerBlocking(a);
    ui.registerBlocking(b);

    ui.openBlocking('a');
    ui.openBlocking('b'); // fecha `a` — só uma bloqueante por vez

    botoesDe(b)[1].focus();
    ui.tratarTab(tab());
    expect(b.raiz.contains(document.activeElement)).toBe(true);
    expect(a.raiz.contains(document.activeElement)).toBe(false);
  });

  it('tecla que não é Tab passa direto', () => {
    const ui = new UIManager();
    const tela = telaComBotoes('inv', 2);
    ui.registerBlocking(tela);
    ui.openBlocking('inv');

    const e = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    ui.tratarTab(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('tela que não fornece raiz continua funcionando, só não prende o foco', () => {
    // O `raiz` é opcional de propósito: torná-lo obrigatório exigiria mexer em todas as telas de
    // uma vez para ganhar o benefício em uma, e os dublês dos testes também o implementam.
    const ui = new UIManager();
    const semRaiz: UIScreen = {
      id: 'x', isOpen: false,
      open() { this.isOpen = true; }, close() { this.isOpen = false; },
    };
    ui.registerBlocking(semRaiz);
    ui.openBlocking('x');

    const e = tab();
    expect(() => ui.tratarTab(e)).not.toThrow();
    expect(e.defaultPrevented).toBe(false);
  });
});

describe('foco devolvido ao fechar', () => {
  it('CRÍTICO: fechar a tela devolve o foco para onde ele estava', () => {
    const ui = new UIManager();
    const gatilho = document.createElement('button');
    document.body.appendChild(gatilho);
    const tela = telaComBotoes('inv', 2);
    ui.registerBlocking(tela);

    gatilho.focus();
    ui.openBlocking('inv');
    expect(tela.raiz.contains(document.activeElement)).toBe(true);

    ui.closeBlocking('inv');
    expect(document.activeElement).toBe(gatilho);
  });

  it('elemento que saiu do DOM não é focado de volta', () => {
    // A tela que tinha o foco pode ser removida enquanto a outra está aberta. Focar um nó órfão
    // não faz nada e esconde o motivo de o foco ter sumido.
    const ui = new UIManager();
    const gatilho = document.createElement('button');
    document.body.appendChild(gatilho);
    const tela = telaComBotoes('inv', 2);
    ui.registerBlocking(tela);

    gatilho.focus();
    ui.openBlocking('inv');
    gatilho.remove();

    expect(() => ui.closeBlocking('inv')).not.toThrow();
  });
});

describe('navegação por abas — isolamento do conteúdo', () => {
  it('CRÍTICO: os controles da aba escondida ficam FORA da ordem do Tab', () => {
    // Sem isto a armadilha funcionaria e ainda assim o jogador tabularia por botões invisíveis:
    // o painel inativo continua no DOM, só com `display: none`.
    const ui = new UIManager();
    const raiz = document.createElement('div');
    document.body.appendChild(raiz);

    const t = new Tabs();
    t.adicionar({ id: 'um', titulo: 'Um', icone: 'mundo', montar: (d) => { d.appendChild(document.createElement('button')); } });
    t.adicionar({ id: 'dois', titulo: 'Dois', icone: 'mods', montar: (d) => { d.appendChild(document.createElement('button')); } });
    raiz.appendChild(t.raiz);
    t.iniciar();
    t.ir('dois'); // monta os dois painéis; só um fica visível

    const tela: UIScreen = { id: 'tela', raiz, isOpen: false, open() { this.isOpen = true; }, close() { this.isOpen = false; } };
    ui.registerBlocking(tela);
    ui.openBlocking('tela');

    const escondido = t.painelDe('um')!.querySelector('button')!;
    const visivel = t.painelDe('dois')!.querySelector('button')!;

    visivel.focus();
    ui.tratarTab(tab());
    expect(document.activeElement).not.toBe(escondido);
  });

  it('as setas trocam de aba e o Tab continua preso na tela', () => {
    const t = new Tabs();
    for (const id of ['a', 'b']) {
      t.adicionar({ id, titulo: id, icone: 'mundo', montar: (d) => { d.textContent = id; } });
    }
    t.iniciar();
    const barra = t.raiz.querySelector('[role="tablist"]')!;
    barra.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(t.ativaId).toBe('b');
  });
});
