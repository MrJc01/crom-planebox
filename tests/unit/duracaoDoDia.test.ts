// A duração do dia claro muda com a estação — item 1120.
//
// `PerfilSazonal.duracaoDoDia` existia desde que as estações existem — 1,15 no verão, 0,78 no
// inverno — e nada o consultava. O inverno esfriava a cor, pesava a neve e mudava o crescimento, e
// o dia continuava com exatamente a mesma duração do dia de verão: a coisa mais imediata que uma
// estação faz era a única que não acontecia.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  horaAparente,
  fracaoDeSol,
  NASCER_APARENTE,
  POR_APARENTE,
  DURACAO_MINIMA,
  DURACAO_MAXIMA,
} from '../../src/world/duracaoDoDia';
import { PERFIS_PADRAO } from '../../src/world/seasons';

const INVERNO = PERFIS_PADRAO.inverno.duracaoDoDia;
const VERAO = PERFIS_PADRAO.verao.duracaoDoDia;

/** Mede, varrendo o relógio real, que fração do dia tem o sol acima do horizonte. */
function medirSol(duracao: number): number {
  const N = 20000;
  let comSol = 0;
  for (let i = 0; i < N; i++) {
    const t = horaAparente(i / N, duracao);
    // `scene.ts` calcula a elevação como `-cos(t * 2π)`, positiva entre 0,25 e 0,75.
    if (-Math.cos(t * Math.PI * 2) > 0) comSol++;
  }
  return comSol / N;
}

describe('o inverno tem noite mais longa', () => {
  it('CRÍTICO: o inverno tem menos sol que o verão, medido', () => {
    // Medido varrendo o relógio, e não conferindo a fórmula: é a promessa do item, e uma fórmula
    // pode estar certa e ligada ao lugar errado.
    expect(medirSol(INVERNO)).toBeLessThan(medirSol(VERAO));
  });

  it('CRÍTICO: a fração de sol bate com o multiplicador declarado', () => {
    for (const d of [INVERNO, 0.9, 1, 1.1, VERAO]) {
      expect(medirSol(d), `duração ${d}`).toBeCloseTo(fracaoDeSol(d), 2);
    }
  });

  it('CRÍTICO: `duracao = 1` devolve a entrada EXATAMENTE', () => {
    // O caminho neutro alimenta o relógio que todo o resto do jogo consome. Um erro de
    // arredondamento aqui apareceria como o sol tremendo, ou como a fase do dia oscilando na
    // fronteira — e nada apontaria para as estações.
    for (let i = 0; i <= 1000; i++) {
      const t = i / 1000;
      expect(horaAparente(t, 1), `t=${t}`).toBe(t);
    }
  });
});

describe('o relógio continua um relógio', () => {
  it('CRÍTICO: nunca anda para trás', () => {
    // Tempo que retrocede faria o contador de dias virar duas vezes, o sol pular e a fase do dia
    // disparar eventos repetidos nos mods.
    for (const d of [DURACAO_MINIMA, INVERNO, 1, VERAO, DURACAO_MAXIMA]) {
      let anterior = -Infinity;
      // `i < 5000`: o relógio real é `% 1` e nunca chega a 1,0. Incluir esse ponto testaria a volta
      // ao zero, que é o comportamento certo — a normalização — e não um retrocesso.
      for (let i = 0; i < 5000; i++) {
        const v = horaAparente(i / 5000, d);
        expect(v, `duração ${d} em ${i}`).toBeGreaterThanOrEqual(anterior - 1e-12);
        anterior = v;
      }
    }
  });

  it('CRÍTICO: meia-noite e meio-dia ficam parados', () => {
    // Uma curva suave pareceria mais elegante e moveria o meio-dia. Com o sol no ponto alto fora do
    // meio do dia, o relógio do jogo deixa de bater com o céu — o tipo de erro que ninguém
    // consegue nomear, só sente.
    for (const d of [DURACAO_MINIMA, INVERNO, VERAO, DURACAO_MAXIMA]) {
      expect(horaAparente(0, d), `meia-noite, ${d}`).toBeCloseTo(0, 9);
      expect(horaAparente(0.5, d), `meio-dia, ${d}`).toBeCloseTo(0.5, 9);
    }
  });

  it('CRÍTICO: o dia inteiro ainda é um dia inteiro', () => {
    // Se a imagem não cobrisse [0,1], o ano deixaria de bater com o calendário que define as
    // estações — e o inverno duraria mais que oito dias, de forma cumulativa.
    for (const d of [DURACAO_MINIMA, INVERNO, VERAO, DURACAO_MAXIMA]) {
      expect(horaAparente(0.9999, d)).toBeGreaterThan(0.999);
      expect(horaAparente(0.9999, d)).toBeLessThanOrEqual(1);
    }
  });

  it('o nascer e o pôr caem exatamente nos âncoras', () => {
    const d = INVERNO;
    const nascerReal = 0.5 - 0.25 * d;
    const porReal = 0.5 + 0.25 * d;
    expect(horaAparente(nascerReal, d)).toBeCloseTo(NASCER_APARENTE, 9);
    expect(horaAparente(porReal, d)).toBeCloseTo(POR_APARENTE, 9);
  });

  it('multiplicadores absurdos são contidos', () => {
    // `api.season.defineProfile` aceita qualquer número de qualquer mod. Um 0,05 daria um jogo
    // injogável e um 5 daria um mundo sem noite — e a noite é metade das mecânicas.
    expect(fracaoDeSol(0.01)).toBe(fracaoDeSol(DURACAO_MINIMA));
    expect(fracaoDeSol(99)).toBe(fracaoDeSol(DURACAO_MAXIMA));
    expect(medirSol(0.01)).toBeGreaterThan(0.2);
    expect(medirSol(99)).toBeLessThan(0.8);
  });

  it('hora fora de [0,1) é normalizada', () => {
    expect(horaAparente(1.25, INVERNO)).toBeCloseTo(horaAparente(0.25, INVERNO), 9);
    expect(horaAparente(-0.25, INVERNO)).toBeCloseTo(horaAparente(0.75, INVERNO), 9);
  });

  it('os perfis padrão declaram um inverno mais curto e um verão mais longo', () => {
    // Se alguém neutralizar os perfis, o sistema inteiro continua funcionando e não faz nada — e
    // nenhum outro teste reprovaria.
    expect(INVERNO).toBeLessThan(1);
    expect(VERAO).toBeGreaterThan(1);
    expect(PERFIS_PADRAO.outono.duracaoDoDia).toBeLessThan(1);
  });
});

describe('a fiação existe — código presente não é código ativo', () => {
  const main = readFileSync('src/main.ts', 'utf8');

  it('CRÍTICO: o céu recebe a hora aparente', () => {
    expect(main).toMatch(/const horaDoSol = horaAparente\(timeOfDay, estacao\.efeito\.duracaoDoDia\)/);
    expect(main).toMatch(/gs\.setTimeOfDay\(horaDoSol\)/);
  });

  it('CRÍTICO: a fase do dia também — senão a noite do inverno não vale como noite', () => {
    // Deixar as mecânicas no relógio real faria a noite de inverno começar visualmente e não
    // contar para abrigo, sono nem objetivo. O pior dos dois mundos: escuro lá fora, "dia" para o
    // jogo.
    expect(main).toMatch(/const faseAtual = fasesDoDia\(horaDoSol\)/);
    expect(main).not.toMatch(/fasesDoDia\(timeOfDay\)/);
  });

  it('CRÍTICO: o relógio real continua uniforme', () => {
    // O que atravessa a rede e conta os dias é `timeOfDay`. Distorcê-lo na fonte quebraria a
    // sincronização entre pares e o próprio calendário das estações.
    expect(main).toMatch(/timeOfDay = \(timeOfDay \+ \(dt \* ritmo\) \/ DAY_LENGTH\) % 1;/);
    expect(main).toMatch(/type: 'world_time',\s*\n\s*timeOfDay,/);
  });
});
