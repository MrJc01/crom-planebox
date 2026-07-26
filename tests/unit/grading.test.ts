import { describe, it, expect } from 'vitest';
import {
  ContextoGradacao,
  NEUTRA,
  PREDEFINICOES,
  PredefinicaoId,
  exposicaoDaHora,
  gradacaoEm,
} from '../../src/render/grading';

function ctx(p: Partial<ContextoGradacao> = {}): ContextoGradacao {
  return { predefinicao: 'natural', elevacaoSolar: 0.5, saturacaoBioma: 1, molhado: 0, ...p };
}

const IDS = Object.keys(PREDEFINICOES) as PredefinicaoId[];

describe('exposicaoDaHora', () => {
  it('abre à noite e fecha no meio-dia — é adaptação do olho, não intensidade de luz', () => {
    expect(exposicaoDaHora(-1)).toBeGreaterThan(exposicaoDaHora(1));
  });

  it('é monotônica e fica numa faixa estreita', () => {
    // Exagerar aqui produz o efeito de câmera automática mal ajustada, pior que não ter nenhum.
    let ant = Infinity;
    for (let e = -1; e <= 1; e += 0.05) {
      const v = exposicaoDaHora(e);
      expect(v).toBeLessThanOrEqual(ant + 1e-9);
      expect(v).toBeGreaterThan(0.8);
      expect(v).toBeLessThan(1.3);
      ant = v;
    }
  });

  it('elevação fora da faixa não estoura a exposição', () => {
    for (const e of [-99, 99, NaN === NaN ? -1.5 : 0, 1.5]) {
      const v = exposicaoDaHora(e);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0.8);
      expect(v).toBeLessThan(1.3);
    }
  });
});

describe('predefinições', () => {
  it('CRÍTICO: "nenhuma" é de fato neutra — desligar tem de desligar', () => {
    const g = gradacaoEm(ctx({ predefinicao: 'nenhuma' }));
    expect(g.forca).toBe(0);
    expect(g.saturacao).toBe(1);
    expect(g.contraste).toBe(1);
    expect(g.sombra).toEqual([1, 1, 1]);
    expect(g.luz).toEqual([1, 1, 1]);
  });

  it('mesmo desligada, a exposição continua acompanhando a hora', () => {
    // Exposição é resposta tonal, não estilo: desligá-la deixaria a noite chapada.
    const noite = gradacaoEm(ctx({ predefinicao: 'nenhuma', elevacaoSolar: -1 }));
    const dia = gradacaoEm(ctx({ predefinicao: 'nenhuma', elevacaoSolar: 1 }));
    expect(noite.exposicao).toBeGreaterThan(dia.exposicao);
  });

  it('CRÍTICO: a sombra é fria e a luz é quente — a assinatura da referência', () => {
    for (const id of IDS) {
      if (id === 'nenhuma') continue;
      const p = PREDEFINICOES[id];
      expect(p.sombra[2], `${id}: azul da sombra`).toBeGreaterThan(p.sombra[0]);
      expect(p.luz[0], `${id}: vermelho da luz`).toBeGreaterThan(p.luz[2]);
    }
  });

  it('"vívido" satura mais que "natural", que satura mais que "cinema"', () => {
    expect(PREDEFINICOES.vivido.saturacao).toBeGreaterThan(PREDEFINICOES.natural.saturacao);
    expect(PREDEFINICOES.natural.saturacao).toBeGreaterThan(PREDEFINICOES.cinema.saturacao);
  });

  it('nenhuma predefinição é extrema — a gradação certa não se anuncia', () => {
    for (const id of IDS) {
      const p = PREDEFINICOES[id];
      expect(p.saturacao).toBeGreaterThan(0.5);
      expect(p.saturacao).toBeLessThan(1.6);
      expect(p.contraste).toBeGreaterThan(0.9);
      expect(p.contraste).toBeLessThan(1.4);
      for (const c of [...p.sombra, ...p.luz]) {
        expect(Math.abs(c - 1)).toBeLessThan(0.25);
      }
    }
  });

  it('predefinição desconhecida cai no neutro em vez de quebrar', () => {
    const g = gradacaoEm(ctx({ predefinicao: 'inventada' as PredefinicaoId }));
    expect(g.forca).toBe(0);
    expect(Number.isFinite(g.exposicao)).toBe(true);
  });
});

describe('gradacaoEm — bioma e clima entram como modificadores', () => {
  it('CRÍTICO: a saturação do bioma MULTIPLICA a da predefinição', () => {
    // Substituir faria a escolha do jogador valer só onde o bioma não tivesse opinião: quem
    // escolheu "cinema" quer o mundo inteiro contido, com o deserto ainda mais lavado que a selva.
    const cinemaDeserto = gradacaoEm(ctx({ predefinicao: 'cinema', saturacaoBioma: 0.6 }));
    const cinemaSelva = gradacaoEm(ctx({ predefinicao: 'cinema', saturacaoBioma: 1.15 }));
    const vividoDeserto = gradacaoEm(ctx({ predefinicao: 'vivido', saturacaoBioma: 0.6 }));

    expect(cinemaDeserto.saturacao).toBeLessThan(cinemaSelva.saturacao);
    expect(cinemaDeserto.saturacao).toBeLessThan(vividoDeserto.saturacao);
  });

  it('a chuva lava a cor', () => {
    const seco = gradacaoEm(ctx({ molhado: 0 }));
    const molhado = gradacaoEm(ctx({ molhado: 1 }));
    expect(molhado.saturacao).toBeLessThan(seco.saturacao);
  });

  it('CRÍTICO: a saturação nunca fica negativa nem estoura', () => {
    // Negativa inverte as cores no shader (`mix` extrapolando); alta demais estoura os canais.
    for (const id of IDS) {
      for (const bioma of [0, 0.1, 0.6, 1, 1.15, 3, 99]) {
        for (const molhado of [0, 0.5, 1, 2, -1]) {
          for (const elev of [-1, 0, 1]) {
            const g = gradacaoEm(ctx({ predefinicao: id, saturacaoBioma: bioma, molhado, elevacaoSolar: elev }));
            expect(g.saturacao).toBeGreaterThanOrEqual(0);
            expect(g.saturacao).toBeLessThanOrEqual(2);
            expect(Number.isFinite(g.exposicao)).toBe(true);
            expect(g.exposicao).toBeGreaterThan(0.5);
            expect(g.exposicao).toBeLessThan(2);
          }
        }
      }
    }
  });

  it('a gradação varia continuamente ao longo do dia', () => {
    let ant = gradacaoEm(ctx({ elevacaoSolar: -1 }));
    let maior = 0;
    for (let e = -1; e <= 1; e += 0.01) {
      const g = gradacaoEm(ctx({ elevacaoSolar: e }));
      maior = Math.max(maior, Math.abs(g.exposicao - ant.exposicao));
      ant = g;
    }
    expect(maior).toBeLessThan(0.01);
  });

  it('a força nunca passa de 1 — `mix` além disso extrapola e satura os canais', () => {
    for (const id of IDS) {
      expect(gradacaoEm(ctx({ predefinicao: id })).forca).toBeLessThanOrEqual(1);
      expect(gradacaoEm(ctx({ predefinicao: id })).forca).toBeGreaterThanOrEqual(0);
    }
  });

  it('NEUTRA é realmente o elemento neutro de todas as operações', () => {
    expect(NEUTRA.saturacao).toBe(1);
    expect(NEUTRA.contraste).toBe(1);
    expect(NEUTRA.forca).toBe(0);
    expect(NEUTRA.sombra).toEqual([1, 1, 1]);
    expect(NEUTRA.luz).toEqual([1, 1, 1]);
  });
});
