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
