// O inverno cobre de neve e congela a água — item 1118.
//
// O inverno mudava a cor da folhagem e pesava a neve no sorteio de clima. A neve caía **através**
// do mundo sem nunca tocá-lo — era uma partícula, não um estado do terreno — e o chão continuava
// verde debaixo dela.
//
// Este é o sistema mais perigoso do repositório: ele reescreve blocos perto do jogador. A maior
// parte destes testes existe para provar o que ele **não** toca.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  Invernada,
  conversaoDeSuperficie,
  faseDaInvernada,
  CONGELA_ACIMA_DE,
  DEGELA_ABAIXO_DE,
  RAIO_DA_VARREDURA,
  MundoDaInvernada,
} from '../../src/world/invernada';
import { B, BLOCKS } from '../../src/world/blocks';
import { PERFIS_PADRAO } from '../../src/world/seasons';

/** Mundo de teste: uma coluna por (x,z), com o topo em y=10. */
function mundoPlano(topo: number, acima: number = B.AIR): MundoDaInvernada & { escritas: number } {
  const blocos = new Map<string, number>();
  return {
    escritas: 0,
    getBlock(x, y, z) {
      const k = `${x},${y},${z}`;
      if (blocos.has(k)) return blocos.get(k)!;
      if (y === 10) return topo;
      if (y === 11) return acima;
      return y < 10 ? B.STONE : B.AIR;
    },
    setBlock(x, y, z, t) {
      blocos.set(`${x},${y},${z}`, t);
      this.escritas++;
    },
  };
}

const ALTURA = () => 10;
const CENTRO = { x: 0, z: 0 };

/** Roda passadas até nada mais mudar, ou desistir. */
function ateEstabilizar(inv: Invernada, mundo: MundoDaInvernada, neve: number, max = 200) {
  let total = 0;
  for (let i = 0; i < max; i++) {
    const n = inv.passada(mundo, CENTRO, neve, ALTURA).length;
    total += n;
    if (n === 0 && i > 40) break;
  }
  return total;
}

describe('o que o inverno faz', () => {
  it('CRÍTICO: a grama exposta vira neve e a água vira gelo', () => {
    expect(conversaoDeSuperficie(B.GRASS, B.AIR, 'congelando')).toBe(B.SNOW);
    expect(conversaoDeSuperficie(B.WATER, B.AIR, 'congelando')).toBe(B.ICE);
  });

  it('CRÍTICO: o degelo desfaz exatamente isso', () => {
    expect(conversaoDeSuperficie(B.SNOW, B.AIR, 'degelando')).toBe(B.GRASS);
    expect(conversaoDeSuperficie(B.ICE, B.AIR, 'degelando')).toBe(B.WATER);
  });

  it('o gelo existe, é sólido e NÃO é opaco', () => {
    // Uma placa opaca esconderia a água embaixo e o lago viraria uma laje branca.
    expect(BLOCKS[B.ICE]).toBeDefined();
    expect(BLOCKS[B.ICE].solid).toBe(true);
    expect(BLOCKS[B.ICE].opaque).toBe(false);
  });

  it('CRÍTICO: o gelo não dropa nada', () => {
    // Recolher gelo daria uma fonte de água infinita que se colhe uma vez por ano, e o item
    // nasceria com uma economia inteira pendurada nele sem ninguém ter decidido isso.
    expect(BLOCKS[B.ICE].drops).toBe(-1);
  });
});

describe('o que o inverno NUNCA toca', () => {
  it('CRÍTICO: nenhum bloco de construção é convertido, em nenhuma fase', () => {
    // O erro que apagaria construção. A lista de entrada é fechada: só grama e água entram.
    const construcao = [
      B.PLANK, B.STONE, B.COBBLE, B.STONE_BRICK, B.BRICK, B.GLASS, B.LOG, B.LEAVES,
      B.SAND, B.DIRT, B.PATH, B.OBSIDIAN, B.GLOWSTONE, B.TORCH, B.BED, B.IRON_BLOCK,
      B.DIAMOND_BLOCK, B.GOLD_BLOCK, B.LAVA, B.GRAVEL, B.DARK_STONE,
    ];
    for (const b of construcao) {
      for (const fase of ['congelando', 'degelando'] as const) {
        expect(conversaoDeSuperficie(b, B.AIR, fase), `${BLOCKS[b]?.name} em ${fase}`).toBe(0);
      }
    }
  });

  it('CRÍTICO: nada acontece sob um bloco — só a face exposta ao céu', () => {
    // Um bloco com qualquer coisa em cima não é superfície: é o interior de algo, e o interior de
    // algo costuma ser uma construção. Grama debaixo de um piso de tábua tem de continuar grama.
    for (const acima of [B.PLANK, B.STONE, B.GLASS, B.WATER, B.LEAVES, B.SNOW]) {
      expect(conversaoDeSuperficie(B.GRASS, acima, 'congelando'), `sob ${acima}`).toBe(0);
      expect(conversaoDeSuperficie(B.SNOW, acima, 'degelando'), `sob ${acima}`).toBe(0);
    }
  });

  it('CRÍTICO: a conversão é reversível por identidade e converge', () => {
    // Congelar e degelar mil vezes tem de devolver o mundo ao ponto de partida. Se o par não
    // fechasse, cada ano deixaria um resíduo, e o mundo derivaria devagar para um estado que
    // ninguém escolheu.
    let b: number = B.GRASS;
    for (let i = 0; i < 500; i++) {
      b = conversaoDeSuperficie(b, B.AIR, 'congelando') || b;
      b = conversaoDeSuperficie(b, B.AIR, 'degelando') || b;
    }
    expect(b).toBe(B.GRASS);
  });

  it('a fase "parado" não converte nada', () => {
    expect(conversaoDeSuperficie(B.GRASS, B.AIR, 'parado')).toBe(0);
    expect(conversaoDeSuperficie(B.WATER, B.AIR, 'parado')).toBe(0);
  });
});

describe('a histerese — sem ela o lago pisca', () => {
  it('CRÍTICO: um valor entre as duas soleiras MANTÉM o estado', () => {
    // Com uma soleira só, um ponto oscilando em torno dela congelaria e degelaria a cada passada,
    // para sempre: o lago inteiro piscando entre azul e branco a cada segundo.
    const meio = (CONGELA_ACIMA_DE + DEGELA_ABAIXO_DE) / 2;
    expect(faseDaInvernada(meio, 'congelando')).toBe('congelando');
    expect(faseDaInvernada(meio, 'degelando')).toBe('degelando');
  });

  it('as soleiras estão na ordem certa e separadas', () => {
    // Iguais, a histerese não existe e o teste acima passaria por acaso.
    expect(CONGELA_ACIMA_DE).toBeGreaterThan(DEGELA_ABAIXO_DE);
    expect(CONGELA_ACIMA_DE - DEGELA_ABAIXO_DE).toBeGreaterThan(0.2);
  });

  it('CRÍTICO: as soleiras caem entre a neve do inverno e a das outras estações', () => {
    // Se `CONGELA_ACIMA_DE` ficasse acima do valor do inverno, o sistema inteiro rodaria e nunca
    // congelaria nada — e nenhum outro teste reprovaria. É o modo de falha do item 029.
    expect(PERFIS_PADRAO.inverno.neve).toBeGreaterThan(CONGELA_ACIMA_DE);
    expect(PERFIS_PADRAO.outono.neve).toBeLessThan(DEGELA_ABAIXO_DE);
    expect(PERFIS_PADRAO.primavera.neve).toBeLessThan(DEGELA_ABAIXO_DE);
    expect(PERFIS_PADRAO.verao.neve).toBeLessThan(DEGELA_ABAIXO_DE);
  });
});

describe('a varredura', () => {
  it('CRÍTICO: cobre o círculo inteiro, e não só perto do jogador', () => {
    // Recomeçar do centro a cada passada faria as colunas próximas serem visitadas mil vezes e as
    // distantes nunca — a neve formaria um disco pequeno e perfeito, que é o artefato que denuncia
    // um sistema.
    const m = mundoPlano(B.GRASS);
    const inv = new Invernada();
    ateEstabilizar(inv, m, PERFIS_PADRAO.inverno.neve);
    const borda = RAIO_DA_VARREDURA - 2;
    expect(m.getBlock(borda, 10, 0)).toBe(B.SNOW);
    expect(m.getBlock(0, 10, borda)).toBe(B.SNOW);
    expect(m.getBlock(-borda, 10, 0)).toBe(B.SNOW);
  });

  it('CRÍTICO: não toca fora do raio', () => {
    const m = mundoPlano(B.GRASS);
    const inv = new Invernada();
    ateEstabilizar(inv, m, PERFIS_PADRAO.inverno.neve);
    expect(m.getBlock(RAIO_DA_VARREDURA + 5, 10, 0)).toBe(B.GRASS);
  });

  it('CRÍTICO: o recorte é circular, não quadrado', () => {
    // Uma linha reta de neve no chão não existe na natureza nem em nenhum outro lugar deste mundo.
    const m = mundoPlano(B.GRASS);
    const inv = new Invernada();
    ateEstabilizar(inv, m, PERFIS_PADRAO.inverno.neve);
    const q = RAIO_DA_VARREDURA - 1;
    expect(m.getBlock(q, 10, q)).toBe(B.GRASS); // canto do quadrado, fora do círculo
  });

  it('CRÍTICO: respeita o orçamento por passada', () => {
    const m = mundoPlano(B.GRASS);
    const inv = new Invernada();
    expect(inv.passada(m, CENTRO, PERFIS_PADRAO.inverno.neve, ALTURA, 50).length).toBeLessThanOrEqual(50);
  });

  it('CRÍTICO: estabiliza — não reescreve o que já converteu', () => {
    // Sem isto a varredura escreveria os mesmos blocos para sempre, marcando chunks como sujos e
    // remontando malha continuamente. O custo seria constante e invisível na lógica.
    const m = mundoPlano(B.GRASS);
    const inv = new Invernada();
    ateEstabilizar(inv, m, PERFIS_PADRAO.inverno.neve);
    const antes = m.escritas;
    for (let i = 0; i < 60; i++) inv.passada(m, CENTRO, PERFIS_PADRAO.inverno.neve, ALTURA);
    expect(m.escritas).toBe(antes);
  });

  it('CRÍTICO: o degelo devolve o mundo ao que era', () => {
    const m = mundoPlano(B.GRASS);
    const inv = new Invernada();
    ateEstabilizar(inv, m, PERFIS_PADRAO.inverno.neve);
    expect(m.getBlock(3, 10, 3)).toBe(B.SNOW);
    ateEstabilizar(inv, m, PERFIS_PADRAO.verao.neve);
    expect(m.getBlock(3, 10, 3)).toBe(B.GRASS);
    expect(m.getBlock(20, 10, 10)).toBe(B.GRASS);
  });

  it('a água vira gelo e volta', () => {
    const m = mundoPlano(B.WATER);
    const inv = new Invernada();
    ateEstabilizar(inv, m, PERFIS_PADRAO.inverno.neve);
    expect(m.getBlock(2, 10, 2)).toBe(B.ICE);
    ateEstabilizar(inv, m, PERFIS_PADRAO.verao.neve);
    expect(m.getBlock(2, 10, 2)).toBe(B.WATER);
  });

  it('CRÍTICO: um telhado de tábua atravessa o inverno intacto', () => {
    // O teste que representa "o jogador construiu aqui". A coluna tem tábua no topo.
    const m = mundoPlano(B.PLANK);
    const inv = new Invernada();
    ateEstabilizar(inv, m, PERFIS_PADRAO.inverno.neve);
    expect(m.escritas).toBe(0);
    expect(m.getBlock(0, 10, 0)).toBe(B.PLANK);
  });

  it('coluna sem superfície (y = 0) é ignorada', () => {
    const m = mundoPlano(B.GRASS);
    const inv = new Invernada();
    const n = inv.passada(m, CENTRO, PERFIS_PADRAO.inverno.neve, () => 0);
    expect(n).toHaveLength(0);
  });

  it('o raio é menor que a distância de render — a neve tem de ser vista chegando', () => {
    // Cobrir o horizonte faria a transição acontecer fora de vista, e o mundo simplesmente já
    // estaria branco na próxima vez que o jogador olhasse. Isso apaga a passagem, que é a única
    // coisa que uma estação tem para dar.
    expect(RAIO_DA_VARREDURA).toBeLessThan(192);
  });
});

describe('a fiação existe — código presente não é código ativo', () => {
  const main = readFileSync('src/main.ts', 'utf8');

  it('CRÍTICO: o laço chama a passada com a força de neve da estação', () => {
    expect(main).toMatch(/invernada\.passada\(\s*\n?\s*world,/);
    expect(main).toMatch(/estacao\.efeito\.neve,/);
  });

  it('CRÍTICO: as mudanças reacendem a luz e vão para os convidados', () => {
    // Sem `relightBatch` o gelo fica com a luz da água que substituiu, e o lago congelado aparece
    // com a iluminação errada até alguém quebrar um bloco ao lado.
    const trecho = main.slice(main.indexOf('invernada.passada'), main.indexOf('invernada.passada') + 700);
    expect(trecho).toMatch(/relightBatch\(alteracoes\)/);
    expect(trecho).toMatch(/enfileirarBlocos\(alteracoes\)/);
  });

  it('CRÍTICO: só o anfitrião converte', () => {
    // No convidado os blocos chegam pelo `block_update`; converter dos dois lados faria os dois
    // disputarem os mesmos voxels, com o mundo oscilando entre as duas versões.
    const trecho = main.slice(main.indexOf('invernada.passada') - 700, main.indexOf('invernada.passada'));
    expect(trecho).toMatch(/entitySystem\.autoridade/);
  });
});
