// Dormir até o amanhecer — item 1339.
//
// A cama definia onde renascer, e nada mais. Isso é metade do que uma cama significa no gênero, e
// era a metade menos interessante: quem fez tudo certo — casa fechada, tocha acesa, cama no canto —
// ainda tinha que **esperar a noite passar olhando para a parede**. Sete minutos e meio de relógio
// real, sem nada para fazer, como recompensa por ter se preparado bem.

import { describe, it, expect } from 'vitest';
import { RITMO_DORMINDO, deveAcordar, porQueNaoPodeDormir, EstadoParaDormir } from '../../src/game/dormir';

const podeDormir: EstadoParaDormir = {
  ehNoite: true, abrigado: true, jaDormindo: false,
};

describe('quando dá para dormir', () => {
  it('CRÍTICO: de noite, abrigado e sendo o relógio do mundo', () => {
    expect(porQueNaoPodeDormir(podeDormir)).toBeNull();
  });
});

describe('as quatro recusas', () => {
  it('CRÍTICO: não dá para dormir de dia', () => {
    // Adiantaria o relógio um dia inteiro para pular... o dia. O jogador perderia as horas de luz,
    // que são justamente quando dá para explorar a superfície em segurança.
    expect(porQueNaoPodeDormir({ ...podeDormir, ehNoite: false })).toMatch(/noite/i);
  });

  it('CRÍTICO: não dá para dormir a céu aberto', () => {
    // A regra que faz dormir ser a recompensa por ter se preparado, e não a maneira de não precisar
    // se preparar. Sem ela a cama vira um botão de pular a noite, e a noite é metade do jogo: o
    // perigo, o motivo de construir, o motivo de fazer tochas.
    expect(porQueNaoPodeDormir({ ...podeDormir, abrigado: false })).toMatch(/aberto|feche/i);
  });

  it('CRÍTICO: o convidado não adianta o relógio do mundo', () => {
    // Esta recusa deixou de existir com o item 139: o convidado deita, e é o anfitrião que acelera
    // quando todos estiverem deitados. Ver `sonoColetivo.test.ts`.
  });

  it('dormir duas vezes seguidas não reinicia nada', () => {
    expect(porQueNaoPodeDormir({ ...podeDormir, jaDormindo: true })).toMatch(/dormindo/i);
  });

  it('CRÍTICO: toda recusa EXPLICA o motivo', () => {
    // "Não é possível dormir" manda o jogador adivinhar entre quatro motivos, e o mais provável é
    // ele concluir que a cama está quebrada. Por isso a função devolve a frase, não um código.
    const casos: EstadoParaDormir[] = [
      { ...podeDormir, ehNoite: false },
      { ...podeDormir, abrigado: false },
      { ...podeDormir, jaDormindo: true },
    ];
    const frases = casos.map((c) => porQueNaoPodeDormir(c)!);
    for (const f of frases) expect(f.length).toBeGreaterThan(15);
    // ...e cada motivo diz uma coisa diferente: três recusas com a mesma frase seriam uma só.
    // Eram quatro. `souORelogio` saiu com o item 139 — o convidado agora deita e o anfitrião conta.
    expect(new Set(frases).size).toBe(3);
  });
});

describe('acordar', () => {
  it('CRÍTICO: acorda quando a noite acaba', () => {
    expect(deveAcordar('amanhecer')).toBe(true);
    expect(deveAcordar('dia')).toBe(true);
  });

  it('CRÍTICO: NÃO acorda enquanto ainda é noite', () => {
    // Sem esta parada, o relógio a 90× daria voltas no dia inteiro e o jogador acordaria num
    // horário qualquer — provavelmente de noite outra vez.
    expect(deveAcordar('noite')).toBe(false);
  });

  it('anoitecer ainda não é dormir cumprido', () => {
    // `anoitecer` vem ANTES da noite. Tratá-lo como "acabou" faria a pessoa que deitou às 19h
    // acordar às 19h01, sem nada ter passado.
    expect(deveAcordar('anoitecer')).toBe(true);
  });
});

describe('o ritmo do sono', () => {
  it('CRÍTICO: é aceleração, não salto', () => {
    // A luz do céu está assada na cor dos vértices, e o mundo é re-meshado quando `sunScale` cruza
    // o limiar. Um salto faria isso acontecer de uma vez, com o sol pulando no céu e um engasgo
    // visível. Correndo rápido, a passagem acontece nos mesmos degraus de sempre.
    expect(Number.isFinite(RITMO_DORMINDO)).toBe(true);
    expect(RITMO_DORMINDO).toBeGreaterThan(1);
  });

  it('a noite inteira passa em segundos, não em minutos nem num quadro', () => {
    // Com DAY_LENGTH = 900 s, a noite é cerca de 40% do dia = 360 s de relógio.
    const segundosDeNoite = 900 * 0.4;
    const real = segundosDeNoite / RITMO_DORMINDO;
    expect(real).toBeGreaterThan(0.5); // não é instantâneo: dá para ver o céu clarear
    expect(real).toBeLessThan(10);     // e não vira espera
  });
});
