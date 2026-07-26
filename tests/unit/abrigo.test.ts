// "Você está abrigado?" — item 1306.
//
// O objetivo "levante um abrigo antes do escuro" contava **blocos colocados**: doze quaisquer, e
// pronto. Doze blocos de terra enfileirados no chão cumpriam. O jogador recebia a confirmação de
// ter feito algo que não fez, e a primeira noite o pegava do lado de fora — com o jogo tendo dito
// que estava tudo certo.
//
// Um objetivo que mede a ação errada é pior que objetivo nenhum: ensina que o guia não sabe do que
// está falando, e a partir daí nada que ele disser é levado a sério.

import { describe, it, expect } from 'vitest';
import { ORCAMENTO_DE_BUSCA, estaAbrigado } from '../../src/game/abrigo';
import { B } from '../../src/world/blocks';
import { SCALE } from '../../src/world/chunk';

/**
 * Mundo de teste em mini-voxels.
 *
 * `chao` é a altura (em metros) do terreno maciço; acima disso é ar, salvo o que for escrito à
 * mão. As coordenadas das APIs abaixo são em **metros**, para os testes descreverem construções e
 * não aritmética de `SCALE`.
 */
function mundo(chao = 4) {
  const escrito = new Map<string, number>();
  const k = (x: number, y: number, z: number) => `${x},${y},${z}`;
  return {
    getBlock(x: number, y: number, z: number): number {
      const w = escrito.get(k(x, y, z));
      if (w !== undefined) return w;
      return y < chao * SCALE ? B.STONE : B.AIR;
    },
    /** Escreve um único mini-voxel, em coordenadas de mini-voxel. */
    voxel(x: number, y: number, z: number, tipo: number) {
      escrito.set(k(x, y, z), tipo);
    },
    /** Preenche uma caixa em metros [x1..x2] × [y1..y2] × [z1..z2] com um bloco. */
    caixa(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, tipo: number) {
      for (let x = x1 * SCALE; x < (x2 + 1) * SCALE; x++) {
        for (let y = y1 * SCALE; y < (y2 + 1) * SCALE; y++) {
          for (let z = z1 * SCALE; z < (z2 + 1) * SCALE; z++) escrito.set(k(x, y, z), tipo);
        }
      }
    },
  };
}

/** Uma cabana oca de paredes maciças, em metros, com o interior vazio. */
function cabana(m: ReturnType<typeof mundo>, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
  m.caixa(x1, y1, z1, x2, y2, z2, B.COBBLE);
  m.caixa(x1 + 1, y1 + 1, z1 + 1, x2 - 1, y2 - 1, z2 - 1, B.AIR);
}

const dentro = (x: number, y: number, z: number): [number, number, number] =>
  [x * SCALE + 1, y * SCALE + 1, z * SCALE + 1];

describe('a céu aberto NÃO é abrigo', () => {
  it('CRÍTICO: em pé num campo aberto, não está abrigado', () => {
    // O caso que a contagem de blocos aprovava.
    const m = mundo();
    expect(estaAbrigado(m, ...dentro(0, 5, 0))).toBe(false);
  });

  it('CRÍTICO: doze blocos em fila no chão não abrigam ninguém', () => {
    // Literalmente o defeito antigo, reproduzido: uma parede reta de doze blocos, e o jogador do
    // lado dela. A meta antiga estava cumprida aqui.
    const m = mundo();
    m.caixa(0, 4, 0, 11, 4, 0, B.COBBLE);
    expect(estaAbrigado(m, ...dentro(3, 5, 1))).toBe(false);
  });

  it('quatro paredes SEM teto não abrigam — o ar sai por cima', () => {
    // Nenhuma regra trata do teto: ele cai fora sozinho, porque o ar de fora entra pela busca.
    const m = mundo();
    m.caixa(0, 5, 0, 4, 7, 4, B.COBBLE);
    m.caixa(1, 5, 1, 3, 8, 3, B.AIR); // interior aberto para o céu
    expect(estaAbrigado(m, ...dentro(2, 6, 2))).toBe(false);
  });
});

describe('espaço fechado É abrigo', () => {
  it('CRÍTICO: uma cabana fechada abriga', () => {
    const m = mundo();
    cabana(m, 0, 4, 0, 6, 8, 6);
    expect(estaAbrigado(m, ...dentro(3, 5, 3))).toBe(true);
  });

  it('CRÍTICO: um buraco na parede derruba o abrigo', () => {
    // O que separa esta verificação de uma contagem de paredes: a porta esquecida aberta importa,
    // e nenhuma regra precisou ser escrita para isso.
    const m = mundo();
    cabana(m, 0, 4, 0, 6, 8, 6);
    m.caixa(0, 5, 3, 0, 5, 3, B.AIR); // um metro de parede a menos
    expect(estaAbrigado(m, ...dentro(3, 5, 3))).toBe(false);
  });

  it('um buraco no TETO também derruba', () => {
    const m = mundo();
    cabana(m, 0, 4, 0, 6, 8, 6);
    m.caixa(3, 8, 3, 3, 8, 3, B.AIR);
    expect(estaAbrigado(m, ...dentro(3, 5, 3))).toBe(false);
  });

  it('uma caverna tapada conta como abrigo — e deve mesmo', () => {
    // Exigir construção seria exigir um estilo de jogo em vez de um resultado. Quem passa a noite
    // numa caverna fechada está tão abrigado quanto quem levantou paredes.
    const m = mundo(20);
    m.caixa(5, 8, 5, 9, 10, 9, B.AIR); // câmara escavada dentro da rocha
    expect(estaAbrigado(m, ...dentro(7, 9, 7))).toBe(true);
  });

  it('vidro fecha o abrigo — ele barra passagem mesmo sendo transparente', () => {
    // A verificação é de passagem, não de luz. Uma casa de vidro é uma casa.
    const m = mundo();
    cabana(m, 0, 4, 0, 6, 8, 6);
    m.caixa(0, 5, 0, 0, 7, 6, B.GLASS);
    expect(estaAbrigado(m, ...dentro(3, 5, 3))).toBe(true);
  });

  it('decoração NÃO fecha nada — capim e tocha não são parede', () => {
    const m = mundo();
    cabana(m, 0, 4, 0, 6, 8, 6);
    m.caixa(0, 5, 3, 0, 5, 3, B.TALL_GRASS); // "tapando" o buraco com capim
    expect(estaAbrigado(m, ...dentro(3, 5, 3))).toBe(false);
  });
});

describe('as bordas', () => {
  it('CRÍTICO: soterrado na rocha não é abrigado — é preso', () => {
    // Dar o objetivo por cumprido aqui premiaria um acidente, e ainda por cima um ruim.
    const m = mundo(20);
    expect(estaAbrigado(m, 5 * SCALE, 5 * SCALE, 5 * SCALE)).toBe(false);
  });

  it('CRÍTICO: a busca é limitada — nunca varre o mundo inteiro', () => {
    // A garantia de custo. Sem o orçamento, um jogador a céu aberto dispararia uma busca por todo o
    // ar do mundo, a cada verificação.
    const m = mundo();
    let leituras = 0;
    const contado = { getBlock: (x: number, y: number, z: number) => { leituras++; return m.getBlock(x, y, z); } };
    estaAbrigado(contado, ...dentro(0, 5, 0));
    expect(leituras).toBeLessThan(ORCAMENTO_DE_BUSCA * 6 * SCALE + 64);
  });

  it('um salão grande demais conta como "lá fora"', () => {
    // Consequência assumida do orçamento, e não um defeito: um recinto acima de ~10×10×10 metros é
    // grande o bastante para as criaturas nascerem dentro dele, e chamá-lo de abrigo seria mentir.
    const m = mundo(40);
    m.caixa(0, 10, 0, 25, 20, 25, B.AIR);
    expect(estaAbrigado(m, ...dentro(12, 11, 12))).toBe(false);
  });

  it('CRÍTICO: parede de UM mini-voxel de espessura ainda fecha', () => {
    // A busca anda de metro em metro, mas o Modo Detalhe constrói em mini-voxels. Testar só o ponto
    // de chegada atravessaria esta rolha em dois de cada três casos — sem erro nenhum em lugar
    // nenhum, só um abrigo que às vezes não conta e ninguém saberia por quê.
    const m = mundo(20);
    m.caixa(5, 8, 5, 9, 10, 9, B.AIR);          // câmara na rocha
    m.caixa(7, 11, 7, 7, 25, 7, B.AIR);         // poço da câmara até o céu aberto

    // Sem a rolha, o poço abre a câmara para fora.
    expect(estaAbrigado(m, ...dentro(7, 9, 7))).toBe(false);

    // A rolha: uma única camada de mini-voxels atravessando o poço.
    const yRolha = 15 * SCALE;
    for (let x = 7 * SCALE; x < 8 * SCALE; x++) {
      for (let z = 7 * SCALE; z < 8 * SCALE; z++) m.voxel(x, yRolha, z, B.COBBLE);
    }
    expect(estaAbrigado(m, ...dentro(7, 9, 7))).toBe(true);
  });
});
