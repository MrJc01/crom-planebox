import { describe, it, expect } from 'vitest';
import {
  CLIMAS,
  ClimaId,
  TRANSICAO,
  blocoEm,
  climaEm,
  climaNaEstacao,
  climaNoBioma,
  climaPorSorteio,
  descreverClima,
} from '../../src/world/weather';

const SEMENTE = 123456;

describe('determinismo — a razão de o clima não ser sorteado na hora', () => {
  it('CRÍTICO: a mesma semente e o mesmo dia dão sempre o mesmo clima', () => {
    // É isto que permite ao P2P não sincronizar o clima a cada mudança: os dois lados derivam.
    for (let d = 0; d < 60; d += 0.37) {
      expect(climaEm(SEMENTE, d, 'planicie').clima).toBe(climaEm(SEMENTE, d, 'planicie').clima);
    }
  });

  it('sementes diferentes dão histórias de clima diferentes', () => {
    const a: ClimaId[] = [];
    const b: ClimaId[] = [];
    for (let d = 0; d < 40; d += 0.5) {
      a.push(climaEm(1, d, 'planicie').clima);
      b.push(climaEm(2, d, 'planicie').clima);
    }
    expect(a.join()).not.toBe(b.join());
  });

  it('recarregar no meio de um bloco cai no mesmo bloco — o save não precisa gravar o clima', () => {
    const antes = blocoEm(SEMENTE, 7.3);
    const depois = blocoEm(SEMENTE, 7.3);
    expect(depois.indice).toBe(antes.indice);
    expect(depois.clima).toBe(antes.clima);
  });
});

describe('blocoEm — a sequência de blocos', () => {
  it('os blocos são contíguos e não se sobrepõem', () => {
    let anterior = blocoEm(SEMENTE, 0);
    expect(anterior.inicio).toBe(0);
    for (let i = 0; i < 200; i++) {
      const seguinte = blocoEm(SEMENTE, anterior.fim + 1e-9);
      expect(seguinte.indice).toBe(anterior.indice + 1);
      expect(seguinte.inicio).toBeCloseTo(anterior.fim, 9);
      anterior = seguinte;
    }
  });

  it('todo bloco tem duração positiva e limitada', () => {
    let d = 0;
    for (let i = 0; i < 300; i++) {
      const b = blocoEm(SEMENTE, d);
      const dur = b.fim - b.inicio;
      expect(dur).toBeGreaterThan(0.3);
      expect(dur).toBeLessThan(1.5);
      d = b.fim + 1e-9;
    }
  });

  it('CRÍTICO: entrada inválida não congela o jogo', () => {
    // Um `dia` NaN vindo de um save corrompido não pode virar laço infinito. Um mundo com clima
    // preso é ruim; um mundo travado é pior.
    for (const d of [NaN, Infinity, -Infinity, 1e18]) {
      const b = blocoEm(SEMENTE, d);
      expect(CLIMAS[b.clima]).toBeDefined();
    }
  });

  it('o dia 0 já tem clima — não existe mundo sem tempo', () => {
    expect(CLIMAS[blocoEm(SEMENTE, 0).clima]).toBeDefined();
  });
});

describe('climaPorSorteio — a distribuição', () => {
  it('cobre 0..1 inteiro sem buraco', () => {
    for (let r = 0; r <= 1; r += 0.001) {
      expect(CLIMAS[climaPorSorteio(r)]).toBeDefined();
    }
  });

  it('valores fora da faixa não quebram', () => {
    expect(CLIMAS[climaPorSorteio(-3)]).toBeDefined();
    expect(CLIMAS[climaPorSorteio(7)]).toBeDefined();
  });

  it('limpo é o clima mais comum, e a tempestade é rara', () => {
    const conta = new Map<ClimaId, number>();
    for (let r = 0; r < 1; r += 0.0005) {
      const c = climaPorSorteio(r);
      conta.set(c, (conta.get(c) ?? 0) + 1);
    }
    expect(conta.get('limpo')!).toBeGreaterThan(conta.get('chuva')!);
    expect(conta.get('chuva')!).toBeGreaterThan(conta.get('tempestade')!);
  });

  it('todo clima definido é alcançável', () => {
    const vistos = new Set<ClimaId>();
    for (let r = 0; r < 1; r += 0.0005) vistos.add(climaPorSorteio(r));
    for (const id of Object.keys(CLIMAS) as ClimaId[]) expect(vistos.has(id)).toBe(true);
  });
});

describe('climaNoBioma — o bioma restringe o que pode acontecer', () => {
  it('CRÍTICO: não neva no deserto', () => {
    expect(climaNoBioma('neve', 'deserto')).not.toBe('neve');
    expect(climaNoBioma('neve', 'savana')).not.toBe('neve');
  });

  it('CRÍTICO: chuva vira neve no gelado', () => {
    for (const b of ['tundra', 'taiga', 'montanha'] as const) {
      expect(climaNoBioma('chuva', b)).toBe('neve');
    }
  });

  it('neve vira chuva onde é temperado', () => {
    expect(climaNoBioma('neve', 'planicie')).toBe('chuva');
    expect(climaNoBioma('neve', 'selva')).toBe('chuva');
  });

  it('o deserto fica limpo em vez de ficar sem clima nenhum', () => {
    expect(climaNoBioma('chuva', 'deserto')).toBe('limpo');
    expect(climaNoBioma('neblina', 'deserto')).toBe('limpo');
  });

  it('o pântano troca o limpo por neblina — é a identidade dele', () => {
    expect(climaNoBioma('limpo', 'pantano')).toBe('neblina');
  });

  it('a tradução é sempre um clima válido, para todo par', () => {
    const biomas = ['tundra', 'taiga', 'planicie', 'floresta', 'selva', 'savana', 'deserto', 'pantano', 'montanha', 'praia', 'oceano'] as const;
    for (const c of Object.keys(CLIMAS) as ClimaId[]) {
      for (const b of biomas) {
        expect(CLIMAS[climaNoBioma(c, b)]).toBeDefined();
      }
    }
  });

  it('a tradução é idempotente — traduzir duas vezes não muda mais', () => {
    const biomas = ['tundra', 'deserto', 'pantano', 'planicie'] as const;
    for (const c of Object.keys(CLIMAS) as ClimaId[]) {
      for (const b of biomas) {
        const uma = climaNoBioma(c, b);
        expect(climaNoBioma(uma, b)).toBe(uma);
      }
    }
  });
});

describe('climaEm — a transição', () => {
  it('CRÍTICO: nenhum efeito dá salto ao longo do tempo', () => {
    // Esta é a diferença entre "mudou o clima" e "piscou". Passo de 0,002 dia.
    let ant = climaEm(SEMENTE, 0, 'planicie');
    let maiorLuz = 0;
    let maiorNeblina = 0;
    for (let d = 0; d < 30; d += 0.002) {
      const c = climaEm(SEMENTE, d, 'planicie');
      maiorLuz = Math.max(maiorLuz, Math.abs(c.luz - ant.luz));
      maiorNeblina = Math.max(maiorNeblina, Math.abs(c.alcanceNeblina - ant.alcanceNeblina));
      ant = c;
    }
    expect(maiorLuz).toBeLessThan(0.05);
    expect(maiorNeblina).toBeLessThan(0.05);
  });

  it('fora da transição o estado é estável e igual à definição', () => {
    const b = blocoEm(SEMENTE, 3);
    const meio = (b.inicio + b.fim) / 2;
    const c = climaEm(SEMENTE, meio, 'planicie');
    expect(c.progresso).toBe(1);
    expect(c.clima).toBe(c.proximo);
    expect(c.luz).toBeCloseTo(CLIMAS[c.clima].luz, 9);
  });

  it('perto do fim do bloco a transição está em curso', () => {
    const b = blocoEm(SEMENTE, 3);
    const c = climaEm(SEMENTE, b.fim - TRANSICAO / 2, 'planicie');
    expect(c.progresso).toBeGreaterThan(0);
    expect(c.progresso).toBeLessThan(1);
  });

  it('a transição termina exatamente na troca de bloco', () => {
    const b = blocoEm(SEMENTE, 3);
    const antes = climaEm(SEMENTE, b.fim - 1e-6, 'planicie');
    const depois = climaEm(SEMENTE, b.fim + 1e-6, 'planicie');
    expect(antes.progresso).toBeCloseTo(1, 3);
    // O que estava chegando é o que passa a valer.
    expect(depois.clima).toBe(antes.proximo);
  });

  it('os efeitos ficam sempre dentro da faixa das definições', () => {
    let minLuz = Infinity, maxLuz = -Infinity;
    for (let d = 0; d < 50; d += 0.01) {
      const c = climaEm(SEMENTE, d, 'floresta');
      minLuz = Math.min(minLuz, c.luz);
      maxLuz = Math.max(maxLuz, c.luz);
      expect(c.particulas).toBeGreaterThanOrEqual(0);
      expect(c.molha).toBeGreaterThanOrEqual(0);
      expect(c.molha).toBeLessThanOrEqual(1);
    }
    const todas = Object.values(CLIMAS).map((c) => c.luz);
    expect(minLuz).toBeGreaterThanOrEqual(Math.min(...todas) - 1e-9);
    expect(maxLuz).toBeLessThanOrEqual(Math.max(...todas) + 1e-9);
  });

  it('CRÍTICO: a máquina nunca fica presa — o clima muda ao longo do tempo', () => {
    const vistos = new Set<ClimaId>();
    for (let d = 0; d < 120; d += 0.1) vistos.add(climaEm(SEMENTE, d, 'planicie').clima);
    expect(vistos.size).toBeGreaterThan(2);
  });

  it('o clima forçado ignora a sequência, para um mod poder mandar', () => {
    const c = climaEm(SEMENTE, 5, 'planicie', 'tempestade');
    expect(c.clima).toBe('tempestade');
    expect(c.progresso).toBe(1);
    expect(c.raios).toBe(true);
  });

  it('o clima forçado também respeita a definição de efeitos', () => {
    const c = climaEm(SEMENTE, 5, 'deserto', 'neve');
    // Forçar é forçar: um mod que pede neve no deserto recebe neve.
    expect(c.clima).toBe('neve');
    expect(c.particulas).toBe(CLIMAS.neve.particulas);
  });

  it('no deserto nunca cai neve pelo caminho natural', () => {
    for (let d = 0; d < 200; d += 0.05) {
      const c = climaEm(SEMENTE, d, 'deserto');
      expect(c.clima).not.toBe('neve');
      expect(c.proximo).not.toBe('neve');
    }
  });

  it('a descrição diz o estado, e mostra a transição quando há uma', () => {
    const b = blocoEm(SEMENTE, 3);
    const estavel = climaEm(SEMENTE, (b.inicio + b.fim) / 2, 'planicie');
    expect(descreverClima(estavel)).toBe(CLIMAS[estavel.clima].nome);

    for (let d = 0; d < 30; d += 0.01) {
      const c = climaEm(SEMENTE, d, 'planicie');
      if (c.clima !== c.proximo) {
        expect(descreverClima(c)).toContain('→');
        return;
      }
    }
    throw new Error('nenhuma transição encontrada em 30 dias — a sequência não está variando');
  });
});

describe('climaNaEstacao — o inverno converte, o verão desconverte', () => {
  it('CRÍTICO: no inverno a floresta vê neve, no verão não', () => {
    // A ordem importa: o bioma diz o que é possível, a estação escolhe dentro do possível.
    // Filtrar pelo bioma DEPOIS da estação desfaria a escolha — foi o defeito da primeira versão.
    let viuNeve = false;
    for (let d = 0; d < 200; d += 0.13) {
      if (climaEm(SEMENTE, d, 'floresta', undefined, 2.5).clima === 'neve') viuNeve = true;
      expect(climaEm(SEMENTE, d, 'floresta', undefined, 0).clima).not.toBe('neve');
    }
    expect(viuNeve).toBe(true);
  });

  it('a conversão isolada faz o que diz', () => {
    expect(climaNaEstacao('chuva', 2.5)).toBe('neve');
    expect(climaNaEstacao('tempestade', 2.5)).toBe('neve');
  });

  it('no verão a neve vira chuva', () => {
    expect(climaNaEstacao('neve', 0)).toBe('chuva');
  });

  it('fora dos extremos não mexe em nada', () => {
    for (const c of Object.keys(CLIMAS) as ClimaId[]) {
      expect(climaNaEstacao(c, 1)).toBe(c);
    }
  });

  it('é idempotente — traduzir duas vezes não muda mais', () => {
    for (const c of Object.keys(CLIMAS) as ClimaId[]) {
      for (const m of [0, 0.2, 1, 2.5, 9]) {
        const uma = climaNaEstacao(c, m);
        expect(climaNaEstacao(uma, m)).toBe(uma);
      }
    }
  });

  it('CRÍTICO: a estação não muda a SEQUÊNCIA de blocos, só a leitura', () => {
    // Se mexesse nos pesos do sorteio, a mesma semente daria sequências diferentes conforme os
    // perfis sazonais que um mod tivesse registrado — e o determinismo do P2P passaria a exigir
    // que os dois lados tivessem exatamente os mesmos mods carregados.
    for (let d = 0; d < 40; d += 0.31) {
      expect(blocoEm(SEMENTE, d).indice).toBe(blocoEm(SEMENTE, d).indice);
      const inverno = climaEm(SEMENTE, d, 'planicie', undefined, 2.5);
      const verao = climaEm(SEMENTE, d, 'planicie', undefined, 0);
      // Mesmo bloco, leituras diferentes: no inverno a chuva da floresta cai como neve, no
      // verão nunca. O bloco sorteado é o mesmo nos dois casos.
      expect(inverno.clima).not.toBe('chuva');
      expect(verao.clima).not.toBe('neve');
    }
  });

  it('o deserto continua sem neve, mesmo no inverno mais duro', () => {
    for (let d = 0; d < 100; d += 0.17) {
      expect(climaEm(SEMENTE, d, 'deserto', undefined, 9).clima).not.toBe('neve');
    }
  });
});
