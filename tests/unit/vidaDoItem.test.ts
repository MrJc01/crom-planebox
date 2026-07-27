// Quanto tempo um item largado dura no chão — item 1330.
//
// `DroppedItem` já contava `age` e ninguém lia. Os itens ficavam no chão para sempre: minerar uma
// veia e não recolher tudo deixava cubos girando ali pelo resto da partida — cada um com uma malha,
// um material e um teste de distância por quadro.
//
// E quem morria duas vezes no mesmo lugar ficava com duas pilhas indistinguíveis, sem saber qual
// era a de agora, sem saber se alguma sumiria, e sem nada no jogo que respondesse.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  estadoDoItem,
  vidaDe,
  VIDA_COMUM_S,
  VIDA_DE_MORTE_S,
  AVISO_S,
} from '../../src/game/vidaDoItem';

describe('o item some, e avisa antes', () => {
  it('CRÍTICO: um item comum expira', () => {
    // O item inteiro. Sem isto o mundo acumula centenas de cubos que ninguém pode limpar.
    expect(estadoDoItem(VIDA_COMUM_S).expirado).toBe(true);
    expect(estadoDoItem(VIDA_COMUM_S + 1).expirado).toBe(true);
    expect(estadoDoItem(VIDA_COMUM_S - 1).expirado).toBe(false);
  });

  it('CRÍTICO: o que caiu na morte dura muito mais — mas dura', () => {
    // Perder o inventário é a punição; perdê-lo por não ter voltado a tempo é outra punição em
    // cima, que o jogador não escolheu. Mas nunca sumir transformaria cada morte num marco
    // permanente, e o jogador acabaria com um cemitério que não pode limpar.
    expect(VIDA_DE_MORTE_S).toBeGreaterThan(VIDA_COMUM_S * 3);
    expect(estadoDoItem(VIDA_COMUM_S + 10, 'morte').expirado).toBe(false);
    expect(estadoDoItem(VIDA_DE_MORTE_S, 'morte').expirado).toBe(true);
  });

  it('CRÍTICO: pisca antes de sumir', () => {
    // Sumir sem aviso é indistinguível de um bug: o jogador larga algo, se afasta, volta e não
    // está lá. A piscada transforma "sumiu" em "estava acabando e eu vi".
    expect(estadoDoItem(VIDA_COMUM_S - AVISO_S + 1).avisando).toBe(true);
    expect(estadoDoItem(VIDA_COMUM_S - AVISO_S - 1).avisando).toBe(false);
  });

  it('CRÍTICO: fora do aviso a opacidade é exatamente 1', () => {
    // Um item levemente translúcido a vida toda leria como um defeito de material, e ninguém
    // ligaria isso ao tempo.
    for (const t of [0, 1, 60, VIDA_COMUM_S - AVISO_S - 5]) {
      expect(estadoDoItem(t).opacidade, `${t}s`).toBe(1);
    }
  });

  it('CRÍTICO: a piscada nunca chega a invisível', () => {
    // Um item invisível por meio quadro é indistinguível de um que já sumiu, e o jogador pararia
    // de procurá-lo cedo demais — justamente nos últimos segundos em que ainda dava.
    let minimo = 1;
    for (let t = VIDA_COMUM_S - AVISO_S; t < VIDA_COMUM_S; t += 0.02) {
      minimo = Math.min(minimo, estadoDoItem(t).opacidade);
    }
    expect(minimo).toBeGreaterThan(0.3);
  });

  it('a piscada acelera conforme o fim se aproxima', () => {
    // Ritmo constante diz "isto vai sumir". Ritmo que acelera diz *quando*.
    const cruzamentos = (de: number, ate: number) => {
      let n = 0, anterior = estadoDoItem(de).opacidade;
      for (let t = de; t < ate; t += 0.01) {
        const v = estadoDoItem(t).opacidade;
        if ((anterior - 0.675) * (v - 0.675) < 0) n++;
        anterior = v;
      }
      return n;
    };
    const cedo = cruzamentos(VIDA_COMUM_S - AVISO_S, VIDA_COMUM_S - AVISO_S + 5);
    const tarde = cruzamentos(VIDA_COMUM_S - 5, VIDA_COMUM_S);
    expect(tarde).toBeGreaterThan(cedo);
  });

  it('CRÍTICO: dois itens da mesma idade piscam em fase', () => {
    // Cada um por conta própria vira cintilação aleatória, que lê como falha de renderização e não
    // como aviso. A função é pura do tempo justamente para isso.
    const t = VIDA_COMUM_S - 10;
    expect(estadoDoItem(t).opacidade).toBe(estadoDoItem(t).opacidade);
  });

  it('o aviso é longo o bastante para dar tempo de correr até lá', () => {
    // Dois segundos avisariam e não serviriam para nada — a pior combinação possível.
    expect(AVISO_S).toBeGreaterThanOrEqual(15);
    expect(AVISO_S).toBeLessThan(VIDA_COMUM_S / 4);
  });

  it('`vidaDe` e o padrão concordam', () => {
    expect(vidaDe('comum')).toBe(VIDA_COMUM_S);
    expect(vidaDe('morte')).toBe(VIDA_DE_MORTE_S);
    expect(estadoDoItem(VIDA_COMUM_S).expirado).toBe(estadoDoItem(VIDA_COMUM_S, 'comum').expirado);
  });

  it('idade absurda não estoura', () => {
    const e = estadoDoItem(1e9, 'morte');
    expect(e.expirado).toBe(true);
    expect(Number.isFinite(e.opacidade)).toBe(true);
  });
});

describe('a fiação existe — código presente não é código ativo', () => {
  const sistema = readFileSync('src/game/ItemDropSystem.ts', 'utf8');
  const main = readFileSync('src/main.ts', 'utf8');

  it('CRÍTICO: o `update` consulta o estado e remove o expirado', () => {
    expect(sistema).toMatch(/const estado = estadoDoItem\(item\.age, item\.origem\)/);
    expect(sistema).toMatch(/if \(estado\.expirado\)/);
  });

  it('CRÍTICO: a opacidade chega ao material', () => {
    // O estado poderia ser calculado, testado e nunca aplicado — o modo de falha desta casa.
    expect(sistema).toMatch(/\.opacity = estado\.opacidade/);
  });

  it('CRÍTICO: o material nasce transparente, e não é trocado no meio', () => {
    // Ligar `transparent` só quando a piscada chega força o three.js a recompilar o programa, e
    // isso aconteceria com dezenas de itens ao mesmo tempo — exatamente no instante em que o
    // jogador está correndo para pegá-los.
    expect(sistema).toMatch(/transparent: true, opacity: 1/);
  });

  it('CRÍTICO: o que cai na morte é marcado como tal', () => {
    expect(main).toMatch(/itemDropSystem\.spawn\(item\.block, item\.count, ondeMorreu\.x, ondeMorreu\.y \+ 0\.5, ondeMorreu\.z, 'morte'\)/);
  });

  it('a pilha da morte é visualmente distinta', () => {
    // É o que responde "qual destas pilhas é a minha?" depois de duas mortes no mesmo lugar, sem
    // nenhum texto e sem precisar de UI.
    expect(sistema).toMatch(/origem === 'morte'/);
  });

  it('CRÍTICO: todo caminho de saída descarta o material', () => {
    // Um material por item. Sem `dispose`, cada bloco quebrado numa sessão deixa um programa de
    // GPU vivo até a página fechar — e o sintoma é o jogo ficando lento sem nada crescendo na tela.
    const saidas = sistema.match(/this\.scene\.remove\(item\.mesh\)/g) ?? [];
    const descartes = sistema.match(/material as THREE\.Material\)\.dispose\(\)/g) ?? [];
    expect(saidas.length).toBeGreaterThanOrEqual(3);
    expect(descartes.length).toBe(saidas.length);
  });
});
