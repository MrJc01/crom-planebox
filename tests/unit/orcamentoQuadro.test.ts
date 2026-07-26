// Orçamento de trabalho por quadro — item 402.
//
// Já existia um limite por CONTAGEM, derivado do alcance de visão. O que faltava é o que dá nome
// ao item: reagir ao custo real do quadro. Numa máquina lenta, ou num momento caro, gerar o mesmo
// número de malhas transforma um quadro pesado numa engasgada visível.
//
// A troca que este arquivo defende: **atraso se percebe menos que solavanco**.

import { describe, it, expect } from 'vitest';
import { ALVO_QUADRO, OrcamentoDeQuadro } from '../../src/render/orcamentoQuadro';

const RAPIDO = ALVO_QUADRO * 0.8;
const LENTO = ALVO_QUADRO * 3;

describe('OrcamentoDeQuadro', () => {
  it('com quadros rápidos, entrega o orçamento cheio', () => {
    const o = new OrcamentoDeQuadro();
    expect(o.paraEste(8, RAPIDO)).toBe(8);
  });

  it('CRÍTICO: quadro caro reduz o orçamento', () => {
    const o = new OrcamentoDeQuadro();
    o.paraEste(8, RAPIDO);
    expect(o.paraEste(8, LENTO)).toBeLessThan(8);
  });

  it('CRÍTICO: desce depressa e sobe devagar', () => {
    // Assimetria deliberada: um solavanco precisa de resposta imediata, recuperar o ritmo pode
    // levar alguns quadros. Simétrico produziria vaivém — um controle que corrige demais passa a
    // causar o problema que deveria resolver.
    const o = new OrcamentoDeQuadro();
    o.paraEste(100, LENTO);
    const quedaEmUm = 1 - o.fatorAtual;

    const p = new OrcamentoDeQuadro();
    p.paraEste(100, LENTO);
    const antes = p.fatorAtual;
    p.paraEste(100, RAPIDO);
    const subidaEmUm = p.fatorAtual - antes;

    expect(quedaEmUm).toBeGreaterThan(subidaEmUm * 3);
  });

  it('CRÍTICO: nunca chega a zero — o mundo não pode parar de carregar', () => {
    // Com zero, o mundo nunca sairia do quadro caro: o custo alto não vem só das malhas, então
    // parar de gerá-las não conserta o quadro e ainda congela o carregamento para sempre.
    const o = new OrcamentoDeQuadro();
    for (let i = 0; i < 100; i++) o.paraEste(8, LENTO * 10);
    expect(o.paraEste(8, LENTO * 10)).toBeGreaterThanOrEqual(1);
    expect(o.fatorAtual).toBeGreaterThan(0);
  });

  it('base pequena continua entregando ao menos uma malha', () => {
    const o = new OrcamentoDeQuadro();
    for (let i = 0; i < 20; i++) o.paraEste(1, LENTO);
    expect(o.paraEste(1, LENTO)).toBe(1);
  });

  it('recupera o orçamento cheio depois que o quadro normaliza', () => {
    const o = new OrcamentoDeQuadro();
    for (let i = 0; i < 10; i++) o.paraEste(8, LENTO);
    for (let i = 0; i < 100; i++) o.paraEste(8, RAPIDO);
    expect(o.fatorAtual).toBe(1);
    expect(o.paraEste(8, RAPIDO)).toBe(8);
  });

  it('a zona morta evita oscilar em torno do alvo', () => {
    // Entre 1,1× e 1,5× do alvo o fator não mexe. Sem essa faixa, um quadro que fica exatamente
    // no limite alternaria subir e descer para sempre.
    const o = new OrcamentoDeQuadro();
    o.paraEste(8, LENTO);
    const f = o.fatorAtual;
    o.paraEste(8, ALVO_QUADRO * 1.3);
    expect(o.fatorAtual).toBe(f);
  });
});
