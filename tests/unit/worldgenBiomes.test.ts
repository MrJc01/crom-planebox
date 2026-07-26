import { describe, it, expect } from 'vitest';
import { B } from '../../src/world/blocks';
import { SCALE } from '../../src/world/chunk';
import { WorldGen, WATER_LEVEL } from '../../src/world/worldgen';

/**
 * O que este arquivo protege
 *
 * O módulo de biomas existia e alimentava só névoa e cor: o mundo tinha ATMOSFERA de bioma e
 * nenhum bioma — o gerador decidia superfície e vegetação por limiares paralelos. Estes testes
 * verificam que a mesma fonte decide as duas coisas, porque duas fontes divergindo é invisível
 * até alguém reparar que o horizonte não combina com o chão.
 */

/** Varre uma área grande o bastante para conter vários biomas. */
function amostrar(g: WorldGen, passo = 24, alcance = 2400) {
  const cols = [];
  for (let x = -alcance; x < alcance; x += passo) {
    for (let z = -alcance; z < alcance; z += passo) {
      cols.push(g.column(x, z));
    }
  }
  return cols;
}

describe('o mundo gerado tem biomas de verdade', () => {
  const g = new WorldGen(20260725);
  const cols = amostrar(g);

  it('CRÍTICO: toda coluna declara um bioma', () => {
    for (const c of cols) expect(typeof c.bioma).toBe('string');
  });

  it('CRÍTICO: vários biomas aparecem — um mundo de um bioma só não é um mundo com biomas', () => {
    const vistos = new Set(cols.map((c) => c.bioma));
    expect(vistos.size).toBeGreaterThan(3);
  });

  it('CRÍTICO: a superfície corresponde ao bioma, não a limiares paralelos', () => {
    for (const c of cols) {
      if (c.path > 0.42 || c.river > 0.55) continue; // estrada e leito de rio mandam mais
      if (c.bioma === 'deserto') expect(c.surface, 'deserto sem areia').toBe(B.SAND);
      if (c.bioma === 'tundra') expect(c.surface, 'tundra sem neve').toBe(B.SNOW);
      if (c.bioma === 'praia') expect(c.surface, 'praia sem areia').toBe(B.SAND);
      if (c.bioma === 'floresta') expect(c.surface, 'floresta sem grama').toBe(B.GRASS);
    }
  });

  it('CRÍTICO: não nasce árvore no deserto nem na tundra', () => {
    // Uma árvore isolada no meio da areia destrói o reconhecimento do bioma mais do que
    // qualquer outro detalhe.
    for (let x = -1500; x < 1500; x += 7) {
      for (let z = -1500; z < 1500; z += 7) {
        const c = g.column(x, z);
        if (c.bioma === 'deserto' || c.bioma === 'tundra' || c.bioma === 'oceano') {
          expect(g.treeAt(x, z, c), `árvore em ${c.bioma} (${x},${z})`).toBe(0);
        }
      }
    }
  });

  it('a floresta tem mais árvores que a savana', () => {
    let floresta = 0, savana = 0, colsF = 0, colsS = 0;
    for (let x = -2000; x < 2000; x += 5) {
      for (let z = -2000; z < 2000; z += 5) {
        const c = g.column(x, z);
        if (c.bioma === 'floresta') { colsF++; if (g.treeAt(x, z, c)) floresta++; }
        else if (c.bioma === 'savana') { colsS++; if (g.treeAt(x, z, c)) savana++; }
      }
    }
    // Só compara se houver amostra dos dois; senão o teste não diz nada.
    if (colsF > 200 && colsS > 200) {
      expect(floresta / colsF).toBeGreaterThan(savana / colsS);
    }
  });

  it('o frio dá pinheiro e o temperado dá carvalho', () => {
    let pinheirosFrios = 0, carvalhosQuentes = 0;
    for (let x = -2000; x < 2000; x += 6) {
      for (let z = -2000; z < 2000; z += 6) {
        const c = g.column(x, z);
        const t = g.treeAt(x, z, c);
        if (!t) continue;
        if (c.bioma === 'taiga' && t === 2) pinheirosFrios++;
        if (c.bioma === 'floresta' && t === 1) carvalhosQuentes++;
        // O que NÃO pode acontecer: pinheiro na floresta temperada ou carvalho na taiga.
        if (c.bioma === 'taiga') expect(t).toBe(2);
        if (c.bioma === 'floresta') expect(t).toBe(1);
      }
    }
    expect(pinheirosFrios + carvalhosQuentes).toBeGreaterThan(0);
  });

  it('submerso é oceano e a superfície é de fundo de mar', () => {
    for (const c of cols) {
      if (c.height < WATER_LEVEL - 6) {
        expect(c.bioma).toBe('oceano');
        expect([B.SAND, B.GRAVEL]).toContain(c.surface);
      }
    }
  });

  it('a geração continua determinística — mesma semente, mesmo bioma', () => {
    const a = new WorldGen(31337);
    const b = new WorldGen(31337);
    for (let x = -300; x < 300; x += 37) {
      for (let z = -300; z < 300; z += 41) {
        expect(a.column(x, z).bioma).toBe(b.column(x, z).bioma);
      }
    }
  });

  it('sementes diferentes dão distribuições de bioma diferentes', () => {
    const a = amostrar(new WorldGen(1), 60, 900).map((c) => c.bioma).join();
    const b = amostrar(new WorldGen(2), 60, 900).map((c) => c.bioma).join();
    expect(a).not.toBe(b);
  });

  it('a altura da coluna continua num intervalo válido', () => {
    for (const c of cols) {
      expect(c.height).toBeGreaterThan(0);
      expect(c.height).toBeLessThan(128);
      expect(Number.isFinite(c.height)).toBe(true);
    }
  });

  it('montanha tem pedra ou neve, nunca grama', () => {
    for (const c of cols) {
      if (c.bioma !== 'montanha') continue;
      // Rio e estrada mandam MAIS que o bioma, e é a precedência certa: um leito de rio é feito
      // de leito de rio, atravesse ele o bioma que atravessar. Este teste descobriu areia numa
      // coluna de montanha e a causa era exatamente essa.
      if (c.path > 0.42 || c.river > 0.55) continue;
      expect([B.STONE, B.SNOW]).toContain(c.surface);
    }
  });

  it('a precedência é explícita: leito de rio e estrada vencem o bioma', () => {
    let leitos = 0, estradas = 0;
    for (const c of cols) {
      if (c.river > 0.55 && c.height <= WATER_LEVEL) {
        expect([B.SAND, B.GRAVEL], 'leito de rio').toContain(c.surface);
        leitos++;
      }
      if (c.path > 0.42 && c.height > WATER_LEVEL + 1) {
        expect([B.PATH, B.GRAVEL, B.COBBLE], 'estrada').toContain(c.surface);
        estradas++;
      }
    }
    // Se a amostra não pegou nenhum dos dois, o teste não provou nada — melhor saber.
    expect(leitos + estradas).toBeGreaterThan(0);
  });
});
