// A vegetação cresce, e a estação decide quanto — item 1119.
//
// `PerfilSazonal.crescimento` existe desde as estações e estava exposto aos mods por
// `api.season.growth()`. Só que **não havia crescimento nenhum para modular**: o capim era
// espalhado na geração do chunk e ficava ali, imutável, para sempre. Um mod podia perguntar a
// velocidade de uma coisa que não acontecia.
//
// O sintoma no jogo: cavar um buraco e tapar com terra deixava uma cicatriz marrom permanente.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  Vegetacao,
  brotarEm,
  CHANCE_DE_GRAMA,
  CHANCE_DE_CAPIM,
  RAIO_DA_VARREDURA,
  MundoDaVegetacao,
} from '../../src/world/vegetacao';
import { B } from '../../src/world/blocks';
import { PERFIS_PADRAO } from '../../src/world/seasons';

/** Um mundo de teste com topo em y=10, e blocos que se pode plantar à mão. */
function mundo(topoPadrao: number = B.GRASS) {
  const posto = new Map<string, number>();
  const m: MundoDaVegetacao & { escritas: number; por: (x: number, y: number, z: number, t: number) => void } = {
    escritas: 0,
    getBlock(x, y, z) {
      const k = `${x},${y},${z}`;
      if (posto.has(k)) return posto.get(k)!;
      if (y === 10) return topoPadrao;
      return y < 10 ? B.STONE : B.AIR;
    },
    setBlock(x, y, z, t) { posto.set(`${x},${y},${z}`, t); m.escritas++; },
    por(x, y, z, t) { posto.set(`${x},${y},${z}`, t); },
  };
  return m;
}

const ALTURA = () => 10;
const SEMPRE = () => 0;   // sorteio que sempre passa
const NUNCA = () => 0.999; // sorteio que nunca passa

describe('o que cresce', () => {
  it('CRÍTICO: terra exposta com grama ao lado vira grama', () => {
    // O item: a cicatriz marrom fecha.
    const m = mundo(B.DIRT);
    m.por(1, 10, 0, B.GRASS);
    expect(brotarEm(m, 0, 10, 0, 1, 1, SEMPRE)).toBe(B.GRASS);
  });

  it('CRÍTICO: terra SEM grama ao lado não vira nada', () => {
    // Sem o vizinho, terra no meio de um descampado viraria grama sozinha — o que lê como magia e
    // não como natureza. O espalhamento é o que faz a recuperação parecer recuperação.
    const m = mundo(B.DIRT);
    expect(brotarEm(m, 0, 10, 0, 1, 1, SEMPRE)).toBe(0);
  });

  it('grama exposta cria capim ou flor', () => {
    const m = mundo(B.GRASS);
    const saiu = new Set<number>();
    for (let i = 0; i < 60; i++) {
      let n = 0;
      const r = () => [0, 0, i % 2 === 0 ? 0 : 0.9][n++ % 3];
      const b = brotarEm(m, 0, 10, 0, 1, 1, r);
      if (b) saiu.add(b);
    }
    expect(saiu.size).toBeGreaterThan(1);
    for (const b of saiu) {
      expect([B.TALL_GRASS, B.FLOWER_RED, B.FLOWER_YELLOW]).toContain(b);
    }
  });
});

describe('o que NÃO cresce', () => {
  it('CRÍTICO: nada nasce debaixo de um bloco', () => {
    // Mesma regra da invernada e pelo mesmo motivo: o que está sob um bloco costuma ser o interior
    // de uma construção. Sem isto, o chão de terra dentro de uma casa fechada virava grama.
    const m = mundo(B.DIRT);
    m.por(1, 10, 0, B.GRASS);
    for (const acima of [B.PLANK, B.STONE, B.GLASS, B.WATER, B.LEAVES]) {
      m.por(0, 11, 0, acima);
      expect(brotarEm(m, 0, 10, 0, 1, 1, SEMPRE), `sob ${acima}`).toBe(0);
    }
  });

  it('CRÍTICO: o caminho de terra batida do jogador não é reconquistado', () => {
    // `PATH` é uma escolha deliberada de quem construiu. Convertê-lo desfaria trabalho, devagar e
    // em toda parte, sem nada avisando.
    const m = mundo(B.PATH);
    m.por(1, 10, 0, B.GRASS);
    expect(brotarEm(m, 0, 10, 0, 1, 1, SEMPRE)).toBe(0);
  });

  it('CRÍTICO: nenhum bloco de construção brota coisa alguma', () => {
    const m = mundo(B.GRASS);
    for (const b of [B.PLANK, B.STONE, B.COBBLE, B.SAND, B.GRAVEL, B.BRICK, B.GLASS, B.SNOW, B.ICE, B.LOG]) {
      m.por(0, 10, 0, b);
      expect(brotarEm(m, 0, 10, 0, 1, 1, SEMPRE), `${b}`).toBe(0);
    }
  });

  it('CRÍTICO: no inverno não cresce absolutamente nada', () => {
    // `crescimento: 0` é a promessa do item, e é o caminho mais chamado do ano — precisa sair cedo
    // e não tocar em nada.
    const m = mundo(B.GRASS);
    const v = new Vegetacao();
    for (let i = 0; i < 200; i++) {
      expect(v.passada(m, { x: 0, z: 0 }, PERFIS_PADRAO.inverno.crescimento, ALTURA, SEMPRE)).toHaveLength(0);
    }
    expect(m.escritas).toBe(0);
  });
});

describe('a estação decide a velocidade', () => {
  function contar(velocidade: number): number {
    const m = mundo(B.GRASS);
    const v = new Vegetacao();
    // Sorteio determinístico e uniforme, para a diferença vir só da chance.
    let n = 0;
    const r = () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
    let total = 0;
    for (let i = 0; i < 120; i++) total += v.passada(m, { x: 0, z: 0 }, velocidade, ALTURA, r).length;
    return total;
  }

  it('CRÍTICO: a primavera cresce mais que o outono', () => {
    expect(contar(PERFIS_PADRAO.primavera.crescimento)).toBeGreaterThan(contar(PERFIS_PADRAO.outono.crescimento));
  });

  it('os perfis padrão declaram uma primavera rápida e um inverno parado', () => {
    // Se alguém neutralizar os perfis, o sistema roda e não faz nada — e nenhum outro teste
    // reprovaria, porque todos passam a velocidade explicitamente.
    expect(PERFIS_PADRAO.primavera.crescimento).toBeGreaterThan(1);
    expect(PERFIS_PADRAO.inverno.crescimento).toBe(0);
    expect(PERFIS_PADRAO.outono.crescimento).toBeLessThan(1);
  });

  it('as chances-base são baixas — o jogador nota que cresceu, não vê crescendo', () => {
    // Grama brotando na frente dos olhos lê como cintilação de textura, não como vida.
    expect(CHANCE_DE_GRAMA).toBeLessThan(0.15);
    expect(CHANCE_DE_CAPIM).toBeLessThan(CHANCE_DE_GRAMA);
  });
});

describe('a varredura', () => {
  it('CRÍTICO: o capim nasce ACIMA, e a grama no lugar da terra', () => {
    // Escrever os dois no mesmo y apagaria o chão debaixo do capim e deixaria um buraco no terreno
    // — um buraco por planta, espalhado por todo lugar onde o jogador passou.
    // O cursor começa no canto do quadrado, que está FORA do círculo — as primeiras dezenas de
    // células do varrimento são rejeitadas antes de virarem candidatas. Um orçamento pequeno se
    // gasta todo aí e devolve zero, que é o que fez a primeira versão deste teste passar por não
    // ter encontrado nada.
    const m = mundo(B.GRASS);
    const v = new Vegetacao();
    const brotos: { y: number; t: number }[] = [];
    for (let i = 0; i < 20; i++) brotos.push(...v.passada(m, { x: 0, z: 0 }, 1, ALTURA, SEMPRE));
    expect(brotos.length).toBeGreaterThan(0);
    for (const b of brotos) {
      if (b.t === B.GRASS) expect(b.y).toBe(10);
      else expect(b.y).toBe(11);
    }
  });

  it('CRÍTICO: respeita o orçamento e o raio', () => {
    const m = mundo(B.GRASS);
    const v = new Vegetacao();
    // Com teto de 25, nenhuma passada pode devolver mais que 25 — e ao menos uma tem de devolver
    // algo, senão a asserção de teto passaria por não ter encontrado nada.
    let maior = 0;
    for (let i = 0; i < 60; i++) {
      const n = v.passada(m, { x: 0, z: 0 }, 1, ALTURA, SEMPRE, 25).length;
      expect(n).toBeLessThanOrEqual(25);
      maior = Math.max(maior, n);
    }
    expect(maior).toBeGreaterThan(0);
    for (let i = 0; i < 400; i++) v.passada(m, { x: 0, z: 0 }, 1, ALTURA, SEMPRE);
    expect(m.getBlock(RAIO_DA_VARREDURA + 6, 11, 0)).toBe(B.AIR);
  });

  it('cobre o círculo inteiro, e não só perto do jogador', () => {
    const m = mundo(B.GRASS);
    const v = new Vegetacao();
    for (let i = 0; i < 400; i++) v.passada(m, { x: 0, z: 0 }, 1, ALTURA, SEMPRE);
    expect(m.getBlock(RAIO_DA_VARREDURA - 3, 11, 0)).not.toBe(B.AIR);
  });

  it('um sorteio que nunca passa não escreve nada', () => {
    const m = mundo(B.GRASS);
    const v = new Vegetacao();
    for (let i = 0; i < 100; i++) v.passada(m, { x: 0, z: 0 }, 1, ALTURA, NUNCA);
    expect(m.escritas).toBe(0);
  });

  it('coluna sem superfície é ignorada', () => {
    const m = mundo(B.GRASS);
    const v = new Vegetacao();
    expect(v.passada(m, { x: 0, z: 0 }, 1, () => 0, SEMPRE)).toHaveLength(0);
  });
});

describe('a fiação existe — código presente não é código ativo', () => {
  const main = readFileSync('src/main.ts', 'utf8');

  it('CRÍTICO: o laço chama a passada com a velocidade da estação', () => {
    // O módulo poderia existir, ter vinte testes verdes, e o mundo continuar imutável.
    expect(main).toMatch(/vegetacao\.passada\(/);
    expect(main).toMatch(/estacao\.efeito\.crescimento,/);
  });

  it('CRÍTICO: os brotos reacendem a luz e vão para os convidados', () => {
    const i = main.indexOf('vegetacao.passada');
    const trecho = main.slice(i, i + 700);
    expect(trecho).toMatch(/relightBatch\(alteracoes\)/);
    expect(trecho).toMatch(/enfileirarBlocos\(alteracoes\)/);
  });

  it('o crescimento é mais espaçado que a invernada', () => {
    // A invernada tem fim; esta não. Rodá-la no mesmo ritmo escreveria blocos para sempre, e o
    // custo seria constante e invisível na lógica.
    expect(main).toMatch(/relogioDeVegetacao = 1\.5/);
    expect(main).toMatch(/relogioDeInvernada = 0\.4/);
  });
});
