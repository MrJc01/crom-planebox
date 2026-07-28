// Os dois P0 da rodada de pedidos — itens 1550 e 1551.
//
// Um tira o controle do jogador sem avisar; o outro anula a progressão inteira antes do primeiro
// clique. Nenhum dos dois é sutil, e é por isso que os dois passaram tanto tempo em pé: ninguém
// escreve um teste para "a barra começa cheia" quando a barra sempre começou cheia.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deveRoubar, listarRoubadas, FORA_DO_ALCANCE, COMO_ABRIR_DEVTOOLS } from '../../src/ui/atalhosDoNavegador';
import { B } from '../../src/world/blocks';

const tecla = (code: string, mods: { ctrl?: boolean; shift?: boolean; meta?: boolean } = {}) => ({
  code, ctrlKey: !!mods.ctrl, metaKey: !!mods.meta, shiftKey: !!mods.shift,
});

describe('atalhos do navegador — item 1550', () => {
  it('CRÍTICO: as teclas que perdem a partida são tomadas enquanto se joga', () => {
    // Ctrl+S abre "salvar página" por cima do mundo, F5 recarrega e perde tudo, Ctrl+D favorita.
    // Nenhum avisa e nenhum é recuperável.
    for (const t of [tecla('KeyS', { ctrl: true }), tecla('F5'), tecla('KeyD', { ctrl: true }), tecla('KeyP', { ctrl: true })]) {
      expect(deveRoubar(t, true), t.code).toBe(true);
    }
  });

  it('CRÍTICO: FORA do jogo o navegador manda de novo', () => {
    // Num menu ou digitando no chat, Ctrl+F deve procurar e Ctrl+C deve copiar. Bloquear sempre
    // faria a página inteira virar um lugar onde os reflexos de todo mundo param de funcionar —
    // pior que o problema original.
    for (const t of [tecla('KeyS', { ctrl: true }), tecla('F5'), tecla('KeyF', { ctrl: true })]) {
      expect(deveRoubar(t, false), t.code).toBe(false);
    }
  });

  it('CRÍTICO: Ctrl+C e Ctrl+V nunca são tomados', () => {
    // Copiar e colar não abrem janela nenhuma por cima do jogo, e tomá-los quebraria o chat sem
    // ganhar nada.
    expect(deveRoubar(tecla('KeyC', { ctrl: true }), true)).toBe(false);
    expect(deveRoubar(tecla('KeyV', { ctrl: true }), true)).toBe(false);
  });

  it('CRÍTICO: F12 continua livre — é a porta do DevTools', () => {
    // Com o resto tomado, tirar o F12 também deixaria o desenvolvedor sem caminho nenhum. Ver o
    // item 1553.
    expect(deveRoubar(tecla('F12'), true)).toBe(false);
    expect(COMO_ABRIR_DEVTOOLS).toMatch(/F12/);
  });

  it('a tecla sem modificador não é confundida com a versão com Ctrl', () => {
    // `KeyF` sozinho é uma tecla do jogo. Tomá-la junto com Ctrl+F quebraria o voo.
    expect(deveRoubar(tecla('KeyF'), true)).toBe(false);
    expect(deveRoubar(tecla('KeyF', { ctrl: true }), true)).toBe(true);
    expect(deveRoubar(tecla('KeyS'), true)).toBe(false);
  });

  it('Cmd do macOS conta como Ctrl', () => {
    // Quem usa Mac aperta Cmd+S com a mesma naturalidade, e perderia a partida do mesmo jeito.
    expect(deveRoubar(tecla('KeyS', { meta: true }), true)).toBe(true);
  });

  it('CRÍTICO: o que NÃO dá para impedir está listado, e não escondido', () => {
    // Ctrl+W é do navegador e nenhuma página o intercepta — e é bom que seja assim. Dizer ao
    // jogador quais são é mais útil que fingir que o problema não existe.
    expect(FORA_DO_ALCANCE.length).toBeGreaterThan(2);
    expect(FORA_DO_ALCANCE.join(' ')).toMatch(/Ctrl\+W/);
    expect(deveRoubar(tecla('KeyW', { ctrl: true }), true)).toBe(false);
  });

  it('a lista de tomadas é legível para a tela de configurações', () => {
    const l = listarRoubadas();
    expect(l).toContain('Ctrl+S');
    expect(l).toContain('F5');
    for (const t of l) expect(t).not.toMatch(/Key|Digit/);
  });
});

describe('a barra começa vazia — item 1551', () => {
  const inter = readFileSync('src/player/interaction.ts', 'utf8');
  const modal = readFileSync('src/ui/InventoryModal.ts', 'utf8');

  it('CRÍTICO: nenhum bloco vem de graça', () => {
    // Ela começava com 37 mil blocos. Com isso, minerar não dá o que já se tem, fabricar tábua a
    // partir de tronco é absurdo com seis mil tábuas, o baú não guarda nada e os objetivos de
    // "quebre um tronco" nasciam metade cumpridos. Cada sistema desta sessão pressupõe escassez, e
    // a escassez era desmentida na primeira tela.
    const bloco = inter.slice(inter.indexOf('hotbar: HotbarSlot[] = ['), inter.indexOf('  selected = 0;'));
    expect(bloco).not.toMatch(/B\.DIRT/);
    expect(bloco).not.toMatch(/B\.COBBLE/);
    expect(bloco).not.toMatch(/count: [1-9]/);
  });

  it('CRÍTICO: a mão continua lá', () => {
    // `B.AIR` com `infinite` é o slot de "não estou segurando nada", e é ele que permite quebrar
    // sem colocar. Removê-lo deixaria o jogador sem como interagir.
    const bloco = inter.slice(inter.indexOf('hotbar: HotbarSlot[] = ['), inter.indexOf('  selected = 0;'));
    expect(bloco).toMatch(/block: B\.AIR, count: 0, infinite: true/);
  });

  it('os slots vazios usam a mesma forma que a penalidade de morte deixa', () => {
    // `block: -1` é o que `guardarNaHotbar` procura para abrir slot novo. Uma forma diferente aqui
    // faria a barra começar com oito slots que nada consegue preencher.
    const bloco = inter.slice(inter.indexOf('hotbar: HotbarSlot[] = ['), inter.indexOf('  selected = 0;'));
    expect((bloco.match(/block: -1, count: 0/g) ?? []).length).toBe(8);
    expect(inter).toMatch(/s\.block === -1/);
  });

  it('CRÍTICO: um slot vazio não mostra "0"', () => {
    // Com a barra começando vazia, a contagem apareceria em oito quadrados de uma vez, e oito
    // zeros lêem como um defeito, não como espaço livre.
    expect(modal).toMatch(/if \(!slot\.infinite && slot\.block >= 0 && slot\.count > 0\)/);
  });

  it('o Criativo continua entregando tudo', () => {
    // A barra cheia era o Criativo vazando para dentro do Sobrevivência. A paleta sobrescreve o
    // slot inteiro, então slot vazio não atrapalha.
    expect(modal).toMatch(/hotbar\[slotIdx\] = \{ label: def\.name, block: i, count: 9999, infinite: true \}/);
    expect(B.AIR).toBe(0);
  });
});

describe('a fiação existe — código presente não é código ativo', () => {
  const main = readFileSync('src/main.ts', 'utf8');

  it('CRÍTICO: o `keydown` consulta `deveRoubar` antes de qualquer outra coisa', () => {
    // Depois do primeiro `return` de outro tratador, a tecla já escapou para o navegador.
    const i = main.indexOf("window.addEventListener('keydown'");
    const trecho = main.slice(i, i + 900);
    expect(trecho).toMatch(/deveRoubar\(e, !!document\.pointerLockElement\)/);
    expect(trecho.indexOf('deveRoubar')).toBeLessThan(trecho.indexOf('const activeEl'));
  });

  it('CRÍTICO: o critério de "está jogando" é o ponteiro travado', () => {
    // É o mesmo critério que o resto do jogo usa. Um segundo critério divergiria do primeiro no
    // dia em que alguém mexesse num deles.
    expect(main).toMatch(/deveRoubar\(e, !!document\.pointerLockElement\)/);
  });
});
