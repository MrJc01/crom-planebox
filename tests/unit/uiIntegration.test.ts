// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { UIManager, UIScreen } from '../../src/ui/UIManager';

class FakeScreen implements UIScreen {
  public isOpen = false;
  constructor(public readonly id: string) {}
  open() { this.isOpen = true; }
  close() { this.isOpen = false; }
}

describe('UIManager — Integração de Telas & Exclusividade de Modais (Item 1160)', () => {
  let uiManager: UIManager;
  let pauseScreen: FakeScreen;
  let inventoryScreen: FakeScreen;
  let modsScreen: FakeScreen;

  beforeEach(() => {
    uiManager = new UIManager();
    pauseScreen = new FakeScreen('pause');
    inventoryScreen = new FakeScreen('inventory');
    modsScreen = new FakeScreen('mods');

    uiManager.registerBlocking(pauseScreen);
    uiManager.registerBlocking(inventoryScreen);
    uiManager.registerBlocking(modsScreen);

    uiManager.registrarAtalho('Escape', 'pause');
    uiManager.registrarAtalho('KeyE', 'inventory');
    uiManager.registrarAtalho('F6', 'mods');
  });

  it('deve permitir abrir uma tela blocking quando nenhuma está aberta', () => {
    uiManager.openBlocking('inventory');
    expect(inventoryScreen.isOpen).toBe(true);
    expect(pauseScreen.isOpen).toBe(false);
    expect(modsScreen.isOpen).toBe(false);
  });

  it('CRÍTICO: abrir uma tela blocking DEVE fechar qualquer outra tela blocking aberta', () => {
    uiManager.openBlocking('inventory');
    expect(inventoryScreen.isOpen).toBe(true);

    // Abrir pause menu deve fechar o inventário
    uiManager.openBlocking('pause');
    expect(pauseScreen.isOpen).toBe(true);
    expect(inventoryScreen.isOpen).toBe(false);

    // Abrir mods de novo deve fechar o pause menu
    uiManager.openBlocking('mods');
    expect(modsScreen.isOpen).toBe(true);
    expect(pauseScreen.isOpen).toBe(false);
  });

  it('tecla de atalho registrada no UIManager alterna a mesma tela ou troca para ela exclusivamente', () => {
    // Pressionar KeyE abre inventário
    uiManager.tratarAtalho('KeyE');
    expect(inventoryScreen.isOpen).toBe(true);

    // Pressionar F6 fecha inventário e abre mods
    uiManager.tratarAtalho('F6');
    expect(modsScreen.isOpen).toBe(true);
    expect(inventoryScreen.isOpen).toBe(false);

    // Pressionar F6 novamente fecha mods
    uiManager.tratarAtalho('F6');
    expect(modsScreen.isOpen).toBe(false);
  });
});
