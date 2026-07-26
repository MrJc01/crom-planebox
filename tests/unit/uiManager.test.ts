import { describe, it, expect, beforeEach } from 'vitest';
import { UIManager, UIScreen } from '../../src/ui/UIManager';

// O UIManager só toca em `document.pointerLockElement` e `exitPointerLock` no caminho testado
// aqui — os ouvintes de evento ficam em `configureRelockOnClick`, que não é chamado. Um stub
// mínimo evita arrastar jsdom para a suíte inteira por causa de duas propriedades.
beforeEach(() => {
  (globalThis as any).document = {
    pointerLockElement: null,
    exitPointerLock() { this.pointerLockElement = null; },
  };
});

function tela(id: string): UIScreen {
  return {
    id,
    isOpen: false,
    open() { this.isOpen = true; },
    close() { this.isOpen = false; },
  };
}

describe('UIManager — a pilha não pode divergir das telas', () => {
  it('REGRESSÃO: tela que se fecha sozinha não trava o jogo em "bloqueado"', () => {
    // Este era o bug relatado: a dica "clique para voltar ao jogo" aparecia e o clique não fazia
    // nada. Causa: todo botão de fechar chama `close()` direto, sem passar pelo UIManager, e a
    // pilha ficava com um id fantasma para sempre. Com `isAnyBlockingOpen()` eternamente
    // verdadeiro, o ouvinte de clique desistia antes de pedir o pointer lock.
    const ui = new UIManager();
    const inventario = tela('inventory');
    ui.registerBlocking(inventario);

    ui.openBlocking('inventory');
    expect(ui.isAnyBlockingOpen()).toBe(true);

    inventario.close(); // como faz o botão "X" da própria tela

    expect(ui.isAnyBlockingOpen()).toBe(false);
  });

  it('adota tela aberta por fora, para o ESC ainda fechá-la', () => {
    const ui = new UIManager();
    const mods = tela('mods');
    ui.registerBlocking(mods);

    mods.open(); // aberta sem passar pelo openBlocking

    expect(ui.isAnyBlockingOpen()).toBe(true);
    expect(ui.handleEscape()).toBe(true);
    expect(mods.isOpen).toBe(false);
    expect(ui.isAnyBlockingOpen()).toBe(false);
  });

  it('closeBlocking de uma tela já fechada limpa a pilha em vez de desistir', () => {
    const ui = new UIManager();
    const menu = tela('game-menu');
    ui.registerBlocking(menu);

    ui.openBlocking('game-menu');
    menu.close();
    ui.closeBlocking('game-menu'); // chegou tarde: a tela já se fechou

    expect(ui.isAnyBlockingOpen()).toBe(false);
  });

  it('abrir uma bloqueante fecha a outra — só uma por vez', () => {
    const ui = new UIManager();
    const a = tela('a');
    const b = tela('b');
    ui.registerBlocking(a);
    ui.registerBlocking(b);

    ui.openBlocking('a');
    ui.openBlocking('b');

    expect(a.isOpen).toBe(false);
    expect(b.isOpen).toBe(true);
  });

  it('ESC fecha uma camada por vez, da mais recente para a mais antiga', () => {
    const ui = new UIManager();
    const menu = tela('game-menu');
    const chat = tela('chat');
    ui.registerBlocking(menu);
    ui.registerFloating(chat);

    chat.open();
    ui.openBlocking('game-menu');

    expect(ui.handleEscape()).toBe(true);
    expect(menu.isOpen).toBe(false);
    expect(chat.isOpen).toBe(true); // o flutuante sobrevive à primeira camada

    expect(ui.handleEscape()).toBe(true);
    expect(chat.isOpen).toBe(false);

    // Nada mais aberto: o chamador decide (abrir o menu de pausa).
    expect(ui.handleEscape()).toBe(false);
  });

  it('sequência longa de abre/fecha por caminhos misturados nunca deixa resíduo', () => {
    const ui = new UIManager();
    const telas = ['inventory', 'mods', 'code', 'pause'].map(tela);
    for (const t of telas) ui.registerBlocking(t);

    for (let i = 0; i < 40; i++) {
      const t = telas[i % telas.length];
      if (i % 3 === 0) ui.openBlocking(t.id);
      else if (i % 3 === 1) t.open();
      else t.close();
    }
    for (const t of telas) t.close();

    expect(ui.isAnyBlockingOpen()).toBe(false);
  });

  it('retomarControle não pede o lock com uma tela aberta', () => {
    const ui = new UIManager();
    const menu = tela('game-menu');
    ui.registerBlocking(menu);
    let pedidos = 0;
    ui.configureLock({ requestPointerLock: () => { pedidos++; } } as any, () => true);

    ui.openBlocking('game-menu');
    ui.retomarControle();
    expect(pedidos).toBe(0);

    ui.closeBlocking('game-menu');
    ui.retomarControle();
    expect(pedidos).toBeGreaterThan(0);
  });

  it('não pede o lock quando o modo de câmera não usa pointer lock (top-down)', () => {
    const ui = new UIManager();
    const menu = tela('game-menu');
    ui.registerBlocking(menu);
    let pedidos = 0;
    ui.configureLock({ requestPointerLock: () => { pedidos++; } } as any, () => false);

    ui.openBlocking('game-menu');
    ui.closeBlocking('game-menu');
    ui.retomarControle();

    expect(pedidos).toBe(0);
  });
});

describe('UIManager — atalhos de tela num registro só', () => {
  function comTelas(): { ui: UIManager; inv: UIScreen; mods: UIScreen; chat: UIScreen } {
    const ui = new UIManager();
    const inv = tela('inventory');
    const mods = tela('mods-page');
    const chat = tela('chat');
    ui.registerBlocking(inv);
    ui.registerBlocking(mods);
    ui.registerFloating(chat);
    ui.registrarAtalho('KeyE', 'inventory');
    ui.registrarAtalho('F6', 'mods-page');
    ui.registrarAtalho('KeyT', 'chat', 'floating');
    return { ui, inv, mods, chat };
  }

  it('CRÍTICO: o atalho de uma tela FECHA a outra — nunca as duas abertas', () => {
    // Este é o bug relatado: "clico numa coisa e abre outra". A causa era o InventoryModal ter o
    // próprio `keydown`, que não consultava o gerenciador — E abria o inventário POR CIMA da
    // página de mods, e as duas ficavam desenhadas.
    const { ui, inv, mods } = comTelas();

    ui.tratarAtalho('F6');
    expect([inv.isOpen, mods.isOpen]).toEqual([false, true]);

    ui.tratarAtalho('KeyE');
    expect([inv.isOpen, mods.isOpen]).toEqual([true, false]);

    ui.tratarAtalho('F6');
    expect([inv.isOpen, mods.isOpen]).toEqual([false, true]);
  });

  it('CRÍTICO: nunca há duas bloqueantes abertas, em nenhuma sequência de atalhos', () => {
    const { ui, inv, mods } = comTelas();
    const seq = ['F6', 'KeyE', 'KeyE', 'F6', 'F6', 'KeyE', 'F6', 'KeyE', 'KeyE'];
    for (const t of seq) {
      ui.tratarAtalho(t);
      expect([inv.isOpen, mods.isOpen].filter(Boolean).length).toBeLessThanOrEqual(1);
    }
  });

  it('a mesma tecla de novo fecha a tela', () => {
    const { ui, inv } = comTelas();
    ui.tratarAtalho('KeyE');
    expect(inv.isOpen).toBe(true);
    ui.tratarAtalho('KeyE');
    expect(inv.isOpen).toBe(false);
  });

  it('tecla sem atalho registrado não é consumida', () => {
    const { ui } = comTelas();
    expect(ui.tratarAtalho('KeyZ')).toBe(false);
    expect(ui.tratarAtalho('KeyE')).toBe(true);
  });

  it('atalho apontando para tela inexistente não quebra nem consome', () => {
    const ui = new UIManager();
    ui.registrarAtalho('F9', 'nao-existe');
    expect(ui.tratarAtalho('F9')).toBe(false);
  });

  it('flutuante alterna sem fechar a bloqueante — chat convive com o jogo', () => {
    const { ui, inv, chat } = comTelas();
    ui.tratarAtalho('KeyE');
    ui.tratarAtalho('KeyT');
    expect(chat.isOpen).toBe(true);
    expect(inv.isOpen).toBe(true); // o chat é flutuante: não expulsa a tela bloqueante
    ui.tratarAtalho('KeyT');
    expect(chat.isOpen).toBe(false);
  });

  it('a tela recusa abrir se ela mesma tiver uma regra — o atalho não força', () => {
    // O inventário não abre em modos que o proíbem. Antes essa regra vivia dentro do ouvinte da
    // tecla E; movê-la para a tela é o que impede que um caminho novo a contorne.
    const ui = new UIManager();
    const recusa: UIScreen = {
      id: 'inventory',
      isOpen: false,
      open() { /* modo proíbe: não abre */ },
      close() { this.isOpen = false; },
    };
    ui.registerBlocking(recusa);
    ui.registrarAtalho('KeyE', 'inventory');
    ui.tratarAtalho('KeyE');
    expect(recusa.isOpen).toBe(false);
    expect(ui.isAnyBlockingOpen()).toBe(false);
  });

  it('lista os atalhos registrados, para o menu mostrar a tecla certa', () => {
    const { ui } = comTelas();
    const l = ui.listarAtalhos();
    expect(l).toContainEqual({ codigo: 'KeyE', id: 'inventory' });
    expect(l).toContainEqual({ codigo: 'F6', id: 'mods-page' });
  });

  it('registrar o mesmo código duas vezes substitui, em vez de acumular donos', () => {
    // Dois donos da mesma tecla é como se volta ao problema que este registro corrige.
    const { ui, inv, mods } = comTelas();
    ui.registrarAtalho('KeyE', 'mods-page');
    ui.tratarAtalho('KeyE');
    expect(mods.isOpen).toBe(true);
    expect(inv.isOpen).toBe(false);
  });
});
