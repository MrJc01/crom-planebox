import { describe, it, expect } from 'vitest';
import {
  FASES_LUNARES,
  NOITE_MAIS_CLARA,
  NOITE_MAIS_ESCURA,
  claridadeNoturna,
  faseDoDia,
  iluminacaoDaFase,
  noiteEscura,
  nomeDaFase,
} from '../../src/world/moon';

describe('faseDoDia — o ciclo', () => {
  it('avança uma fase por dia e recomeça após oito', () => {
    for (let d = 0; d < FASES_LUNARES; d++) expect(faseDoDia(d)).toBe(d);
    expect(faseDoDia(FASES_LUNARES)).toBe(0);
    expect(faseDoDia(FASES_LUNARES + 3)).toBe(3);
  });

  it('dia negativo devolve fase válida — o relógio do mundo pode voltar', () => {
    for (const d of [-1, -7, -8, -100]) {
      const f = faseDoDia(d);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(FASES_LUNARES);
    }
    expect(faseDoDia(-1)).toBe(7);
  });

  it('dia fracionário é truncado, não arredondado — a fase muda no amanhecer', () => {
    expect(faseDoDia(3.9)).toBe(3);
  });

  it('toda fase tem nome', () => {
    for (let f = 0; f < FASES_LUNARES; f++) expect(nomeDaFase(f)).toBeTruthy();
    expect(nomeDaFase(0)).toBe('nova');
    expect(nomeDaFase(4)).toBe('cheia');
  });
});

describe('iluminacaoDaFase — o disco', () => {
  it('nova é escuridão total, cheia é disco inteiro', () => {
    expect(iluminacaoDaFase(0)).toBe(0);
    expect(iluminacaoDaFase(4)).toBe(1);
  });

  it('cresce até a cheia e decresce depois — é um ciclo, não uma rampa', () => {
    for (let f = 1; f <= 4; f++) {
      expect(iluminacaoDaFase(f)).toBeGreaterThan(iluminacaoDaFase(f - 1));
    }
    for (let f = 5; f < FASES_LUNARES; f++) {
      expect(iluminacaoDaFase(f)).toBeLessThan(iluminacaoDaFase(f - 1));
    }
  });

  it('é simétrica: crescente e minguante iluminam igual', () => {
    expect(iluminacaoDaFase(2)).toBeCloseTo(iluminacaoDaFase(6), 6);
    expect(iluminacaoDaFase(1)).toBeCloseTo(iluminacaoDaFase(7), 6);
  });

  it('fica sempre entre 0 e 1', () => {
    for (let f = -20; f < 40; f++) {
      const i = iluminacaoDaFase(f);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThanOrEqual(1);
    }
  });
});

describe('claridadeNoturna — o que o jogador sente', () => {
  it('CRÍTICO: lua nova é bem mais escura que lua cheia — é o pedido inteiro', () => {
    expect(claridadeNoturna(0)).toBeLessThan(claridadeNoturna(4));
    expect(claridadeNoturna(4) / claridadeNoturna(0)).toBeGreaterThan(3);
  });

  it('nunca é preto absoluto: a silhueta precisa continuar legível', () => {
    for (let f = 0; f < FASES_LUNARES; f++) {
      expect(claridadeNoturna(f)).toBeGreaterThan(0);
      expect(claridadeNoturna(f)).toBeGreaterThanOrEqual(NOITE_MAIS_ESCURA);
    }
  });

  it('nunca chega perto da claridade do dia', () => {
    for (let f = 0; f < FASES_LUNARES; f++) {
      expect(claridadeNoturna(f)).toBeLessThanOrEqual(NOITE_MAIS_CLARA);
      expect(claridadeNoturna(f)).toBeLessThan(0.3);
    }
  });

  it('a variação é perceptível em TODA fase, não só perto da cheia', () => {
    // Com resposta linear, metade das fases pareceriam igualmente escuras. A raiz existe
    // justamente para espalhar a variação pelo ciclo inteiro.
    const meio = claridadeNoturna(2);
    const escura = claridadeNoturna(0);
    const clara = claridadeNoturna(4);
    expect(meio - escura).toBeGreaterThan((clara - escura) * 0.3);
  });

  it('é monotônica com a iluminação', () => {
    for (let f = 1; f <= 4; f++) {
      expect(claridadeNoturna(f)).toBeGreaterThan(claridadeNoturna(f - 1));
    }
  });
});

describe('noiteEscura — o atalho para mods e interface', () => {
  it('lua nova é noite escura; lua cheia não é', () => {
    expect(noiteEscura(0)).toBe(true);
    expect(noiteEscura(4)).toBe(false);
  });

  it('classifica todas as fases sem lançar', () => {
    for (let f = -8; f < 16; f++) expect(typeof noiteEscura(f)).toBe('boolean');
  });

  it('metade do ciclo é escura, metade não — senão a variação não teria graça', () => {
    let escuras = 0;
    for (let f = 0; f < FASES_LUNARES; f++) if (noiteEscura(f)) escuras++;
    expect(escuras).toBeGreaterThan(1);
    expect(escuras).toBeLessThan(FASES_LUNARES - 1);
  });
});
