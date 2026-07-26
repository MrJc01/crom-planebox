import { describe, it, expect } from 'vitest';
import { B } from '../../src/world/blocks';
import { CX, CZ, SCALE } from '../../src/world/chunk';
import { estruturasNaRegiao } from '../../src/world/scatter';
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

describe('as construções espalhadas existem no mundo gerado', () => {
  const SEMENTE = 555777;
  const g = new WorldGen(SEMENTE);

  const sonda = {
    altura: (x: number, z: number) => g.column(x, z).height,
    bioma: (x: number, z: number) => g.column(x, z).bioma,
    rio: (x: number, z: number) => g.column(x, z).river,
    estrada: (x: number, z: number) => g.column(x, z).path,
  };

  /** Acha um sítio real neste mundo, para o teste não depender de sorte. */
  function acharSitio() {
    const sitios = estruturasNaRegiao(SEMENTE, -6000, -6000, 6000, 6000, sonda);
    if (sitios.length === 0) throw new Error('nenhuma construção em 12.000 voxels — algo está errado');
    return sitios;
  }

  it('CRÍTICO: o mundo tem construções espalhadas', () => {
    expect(acharSitio().length).toBeGreaterThan(3);
  });

  it('CRÍTICO: os blocos da construção aparecem no chunk gerado', () => {
    // É o teste de que o sistema está LIGADO. Sem ele, `scatter.ts` seria mais um módulo
    // completo, testado e inerte — o padrão que já custou três funcionalidades a este projeto.
    const sitio = acharSitio()[0];
    const cx = Math.floor(sitio.x / CX);
    const cz = Math.floor(sitio.z / CZ);
    const data = g.generateChunk(cx, cz);

    const lx = sitio.x - cx * CX;
    const lz = sitio.z - cz * CZ;
    let encontrados = 0;
    for (let dy = 0; dy < 12; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        for (let dz = -4; dz <= 4; dz++) {
          const bx = lx + dx, bz = lz + dz, by = sitio.y + dy;
          if (bx < 0 || bx >= CX || bz < 0 || bz >= CZ || by < 0 || by >= 128) continue;
          const b = data[(by * CZ + bz) * CX + bx];
          if (b === B.PLANK || b === B.COBBLE || b === B.STONE_BRICK || b === B.LOG) encontrados++;
        }
      }
    }
    expect(encontrados, `nada construído em ${sitio.template}@${sitio.x},${sitio.z}`).toBeGreaterThan(10);
  });

  it('CRÍTICO: a construção não flutua — há chão sólido logo abaixo da base', () => {
    for (const sitio of acharSitio().slice(0, 6)) {
      const cx = Math.floor(sitio.x / CX);
      const cz = Math.floor(sitio.z / CZ);
      const data = g.generateChunk(cx, cz);
      const lx = sitio.x - cx * CX;
      const lz = sitio.z - cz * CZ;
      if (lx < 1 || lx >= CX - 1 || lz < 1 || lz >= CZ - 1) continue; // corta na borda: pula
      const abaixo = data[((sitio.y - 1) * CZ + lz) * CX + lx];
      expect(abaixo, `vão sob ${sitio.template}@${sitio.x},${sitio.z}`).not.toBe(B.AIR);
    }
  });

  it('a geração continua determinística com construções', () => {
    const a = new WorldGen(SEMENTE).generateChunk(3, 7);
    const b = new WorldGen(SEMENTE).generateChunk(3, 7);
    expect(a).toEqual(b);
  });

  it('gerar um chunk sem construção continua funcionando', () => {
    // O caminho comum é o de sempre: a esmagadora maioria dos chunks não tem construção nenhuma.
    const data = g.generateChunk(999, 999);
    expect(data.length).toBeGreaterThan(0);
    expect(data.some((b) => b !== B.AIR)).toBe(true);
  });
});
