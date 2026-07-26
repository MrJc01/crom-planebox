import { describe, it, expect } from 'vitest';
import { Relampago } from '../../src/render/precipitation';

/** Sorteio previsível: devolve os valores na ordem dada, repetindo o último. */
function rngFixo(...valores: number[]): () => number {
  let i = 0;
  return () => valores[Math.min(i++, valores.length - 1)];
}

describe('Relampago — o clarão', () => {
  it('sem intensidade, nunca cai raio', () => {
    const r = new Relampago();
    for (let i = 0; i < 1000; i++) {
      expect(r.update(0.016, 0, () => 0)).toBe(0);
    }
    expect(r.trovoesProntos()).toEqual([]);
  });

  it('CRÍTICO: o clarão é breve — não é um holofote', () => {
    const r = new Relampago();
    r.update(0.016, 1, rngFixo(0)); // sorteio 0 sempre dispara
    let quadros = 0;
    while (r.update(0.016, 0, () => 1) > 0) {
      quadros++;
      if (quadros > 1000) break;
    }
    expect(quadros).toBeLessThan(20); // menos de ~0,3 s
  });

  it('o brilho decai, nunca cresce, depois do disparo', () => {
    const r = new Relampago();
    let ant = r.update(0.016, 1, rngFixo(0));
    expect(ant).toBeGreaterThan(0);
    for (let i = 0; i < 12; i++) {
      const b = r.update(0.016, 0, () => 1);
      expect(b).toBeLessThanOrEqual(ant + 1e-9);
      ant = b;
    }
  });

  it('o brilho fica sempre em 0..1', () => {
    const r = new Relampago();
    for (let i = 0; i < 3000; i++) {
      const b = r.update(0.016, 0.9, rngFixo(0));
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
  });
});

describe('Relampago — o trovão vem depois', () => {
  it('CRÍTICO: o trovão não toca no mesmo instante do clarão', () => {
    // Se tocasse junto, todo raio pareceria estar caindo em cima do jogador.
    const r = new Relampago();
    r.update(0.016, 1, rngFixo(0));
    expect(r.trovoesProntos()).toEqual([]);
  });

  it('o trovão chega depois de um atraso compatível com a distância', () => {
    const r = new Relampago();
    r.update(0.016, 1, rngFixo(0)); // rnd()=0 → distância mínima (40 voxels)
    const atrasoEsperado = 40 / Relampago.VELOCIDADE_SOM;

    let t = 0;
    let ouviu = -1;
    for (let i = 0; i < 500; i++) {
      r.update(0.016, 0, () => 1);
      t += 0.016;
      if (r.trovoesProntos().length > 0) { ouviu = t; break; }
    }
    expect(ouviu).toBeGreaterThan(0);
    expect(ouviu).toBeCloseTo(atrasoEsperado, 1);
  });

  it('CRÍTICO: raio longe soa mais baixo que raio perto', () => {
    const perto = new Relampago();
    perto.update(0.016, 1, rngFixo(0)); // distância mínima
    const longe = new Relampago();
    longe.update(0.016, 1, rngFixo(0, 1)); // sorteio 1 na distância → máxima

    const ganhoDe = (r: Relampago): number => {
      for (let i = 0; i < 1000; i++) {
        r.update(0.016, 0, () => 1);
        const g = r.trovoesProntos();
        if (g.length > 0) return g[0];
      }
      return -1;
    };
    expect(ganhoDe(perto)).toBeGreaterThan(ganhoDe(longe));
  });

  it('o ganho do trovão nunca é zero nem passa de 1', () => {
    for (const d of [0, 0.25, 0.5, 0.75, 1]) {
      const r = new Relampago();
      r.update(0.016, 1, rngFixo(0, d));
      for (let i = 0; i < 1000; i++) {
        r.update(0.016, 0, () => 1);
        const g = r.trovoesProntos();
        if (g.length > 0) {
          expect(g[0]).toBeGreaterThan(0);
          expect(g[0]).toBeLessThanOrEqual(1);
          break;
        }
      }
    }
  });

  it('a lista de pendentes é consumida — o mesmo trovão não toca duas vezes', () => {
    const r = new Relampago();
    r.update(0.016, 1, rngFixo(0));
    let total = 0;
    for (let i = 0; i < 1000; i++) {
      r.update(0.016, 0, () => 1);
      total += r.trovoesProntos().length;
    }
    expect(total).toBe(1);
  });

  it('reset limpa os trovões agendados — trocar de mundo não herda o temporal anterior', () => {
    const r = new Relampago();
    r.update(0.016, 1, rngFixo(0));
    r.reset();
    let total = 0;
    for (let i = 0; i < 1000; i++) {
      r.update(0.016, 0, () => 1);
      total += r.trovoesProntos().length;
    }
    expect(total).toBe(0);
  });

  it('uma tempestade longa não acumula trovões sem fim na memória', () => {
    const r = new Relampago();
    for (let i = 0; i < 20000; i++) {
      r.update(0.016, 0.5, Math.random);
      r.trovoesProntos();
    }
    // Se a lista vazasse, este consumo final teria centenas de itens.
    expect(r.trovoesProntos().length).toBeLessThan(20);
  });
});
