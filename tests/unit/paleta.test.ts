// Chunk paletizado por seção — itens 1579 e 1580.
//
// Medido antes de escrever: recortando um chunk real em seções de 8³ e paletizando cada uma com
// bits empacotados, **256 KB viram 23 KB — onze vezes menos, sem perder um voxel**. A paleta
// mediana de uma seção é **dois**: quase todo pedaço do mundo é ar-e-mais-uma-coisa, e guardar isso
// em oito bits por voxel desperdiça sete deles.
//
// A maior parte destes testes é sobre o empacotamento de bits, e por um motivo: um índice pode
// cruzar a fronteira de dois bytes, e a versão errada disso funciona para 1, 2, 4 e 8 bits e falha
// para 3, 5, 6 e 7 — ou seja, passa nos testes fáceis e quebra no mundo real.

import { describe, it, expect } from 'vitest';
import {
  empacotarSecao,
  escreverSecao,
  lerSecao,
  secaoHomogenea,
  bitsPara,
  bytesDaSecao,
  valorDominante,
  ARESTA_DA_SECAO,
  VOXELS_POR_SECAO,
  empacotarDePlano,
  escreverPlanoEm,
} from '../../src/world/paleta';
import { WorldGen } from '../../src/world/worldgen';
import { CX, CY, CZ } from '../../src/world/chunk';

describe('bits por paleta', () => {
  it('CRÍTICO: um valor não precisa de bit nenhum', () => {
    expect(bitsPara(1)).toBe(0);
    expect(bitsPara(0)).toBe(0);
  });

  it('CRÍTICO: a conta é exata nas potências de dois', () => {
    // Um erro de um bit aqui desperdiça o dobro do espaço, ou trunca o índice e devolve o bloco
    // errado — e as duas falhas aparecem só com paletas de certos tamanhos.
    expect(bitsPara(2)).toBe(1);
    expect(bitsPara(3)).toBe(2);
    expect(bitsPara(4)).toBe(2);
    expect(bitsPara(5)).toBe(3);
    expect(bitsPara(8)).toBe(3);
    expect(bitsPara(9)).toBe(4);
    expect(bitsPara(256)).toBe(8);
  });
});

describe('ler e escrever, em toda largura de bit', () => {
  // O laço cobre 3, 5, 6 e 7 bits de propósito: são as larguras em que um índice cruza a fronteira
  // de dois bytes, e são as que a implementação ingênua erra.
  for (const tamanhoDaPaleta of [2, 3, 5, 7, 9, 17, 33, 100, 256]) {
    it(`CRÍTICO: paleta de ${tamanhoDaPaleta} (${bitsPara(tamanhoDaPaleta)} bits) ida e volta`, () => {
      const original = new Array(VOXELS_POR_SECAO);
      for (let i = 0; i < VOXELS_POR_SECAO; i++) original[i] = (i * 7 + 3) % tamanhoDaPaleta;

      const s = empacotarSecao((i) => original[i]);
      for (let i = 0; i < VOXELS_POR_SECAO; i++) {
        expect(lerSecao(s, i), `voxel ${i}`).toBe(original[i]);
      }
    });
  }

  it('CRÍTICO: escrever um voxel não estraga os vizinhos', () => {
    // O caso que a máscara de bits existe para proteger. Com 3 bits, escrever o voxel 2 toca dois
    // bytes, e uma máscara errada apaga metade do voxel 3.
    const s0 = empacotarSecao((i) => i % 5); // 3 bits
    let s = s0;
    for (let i = 0; i < 50; i++) s = escreverSecao(s, i, 4 - (i % 5));
    for (let i = 0; i < 50; i++) expect(lerSecao(s, i), `escrito ${i}`).toBe(4 - (i % 5));
    for (let i = 50; i < VOXELS_POR_SECAO; i++) expect(lerSecao(s, i), `intacto ${i}`).toBe(i % 5);
  });

  it('o último voxel da seção não escapa do buffer', () => {
    // Com bits que não dividem 8, o último índice pode pedir um byte além do fim.
    for (const p of [3, 5, 6, 7]) {
      const s = empacotarSecao((i) => i % p);
      const ultimo = VOXELS_POR_SECAO - 1;
      expect(() => escreverSecao(s, ultimo, 0)).not.toThrow();
      expect(lerSecao(escreverSecao(s, ultimo, 1), ultimo), `${p} valores`).toBe(1);
    }
  });
});

describe('a seção homogênea — item 1580', () => {
  it('CRÍTICO: não guarda voxel nenhum', () => {
    // É o caso da maioria do mundo, e o desperdício principal do formato plano: meio milhar de
    // bytes para dizer "isto é tudo ar".
    const s = empacotarSecao(() => 3);
    expect(s.dados).toBeNull();
    expect(s.bits).toBe(0);
    expect(bytesDaSecao(s)).toBeLessThan(16);
  });

  it('CRÍTICO: escrever o MESMO valor não a acorda', () => {
    // Sem isto, um `setBlock` que não muda nada converteria a seção para o formato caro — e o
    // mundo iria perdendo a compressão sozinho, sem nenhum bloco ter mudado de fato.
    const s = secaoHomogenea(3);
    const depois = escreverSecao(s, 100, 3);
    expect(depois.dados).toBeNull();
    expect(depois).toBe(s);
  });

  it('CRÍTICO: escrever um valor diferente a converte, preservando o resto', () => {
    const s = escreverSecao(secaoHomogenea(3), 100, 7);
    expect(s.dados).not.toBeNull();
    expect(lerSecao(s, 100)).toBe(7);
    for (const i of [0, 1, 99, 101, VOXELS_POR_SECAO - 1]) {
      expect(lerSecao(s, i), `voxel ${i}`).toBe(3);
    }
  });
});

describe('a paleta cresce sem perder o que já estava lá', () => {
  it('CRÍTICO: crescer de 2 para 3 valores reempacota tudo corretamente', () => {
    // A travessia de 1 bit para 2. É onde o reempacotamento acontece, e onde perder os índices
    // antigos daria um chunk embaralhado — não vazio, embaralhado, que é muito pior de diagnosticar.
    let s = empacotarSecao((i) => (i % 2 === 0 ? 10 : 20));
    expect(s.bits).toBe(1);
    s = escreverSecao(s, 5, 30);
    expect(s.bits).toBe(2);
    expect(lerSecao(s, 5)).toBe(30);
    for (let i = 0; i < VOXELS_POR_SECAO; i++) {
      if (i === 5) continue;
      expect(lerSecao(s, i), `voxel ${i}`).toBe(i % 2 === 0 ? 10 : 20);
    }
  });

  it('CRÍTICO: cada travessia de largura preserva tudo', () => {
    // 1→2→3→4→5 bits, uma por vez, conferindo o conteúdo inteiro a cada passo.
    let s = empacotarSecao(() => 0);
    const esperado = new Array(VOXELS_POR_SECAO).fill(0);
    for (let novo = 1; novo <= 20; novo++) {
      const alvo = novo * 3;
      s = escreverSecao(s, novo, novo);
      esperado[novo] = novo;
      void alvo;
      for (let i = 0; i < VOXELS_POR_SECAO; i++) {
        expect(lerSecao(s, i), `após ${novo} valores, voxel ${i}`).toBe(esperado[i]);
      }
    }
  });

  it('escrever um valor que já está na paleta não a faz crescer', () => {
    let s = empacotarSecao((i) => i % 3);
    const antes = s.paleta.length;
    s = escreverSecao(s, 7, 2);
    expect(s.paleta.length).toBe(antes);
  });
});

describe('o valor dominante — a cor de longe do item 1627', () => {
  it('CRÍTICO: numa seção homogênea sai sem olhar um voxel', () => {
    // É o caso da maioria, e é o que faz o LOD ser praticamente de graça.
    expect(valorDominante(secaoHomogenea(9))).toBe(9);
  });

  it('numa seção mista devolve o que mais ocupa', () => {
    // 3/4 de pedra e 1/4 de ar: a seção vista de longe é pedra.
    const s = empacotarSecao((i) => (i % 4 === 0 ? 0 : 3));
    expect(valorDominante(s)).toBe(3);
  });
});

describe('a economia, medida num chunk de verdade', () => {
  it('CRÍTICO: um chunk real encolhe pelo menos oito vezes', () => {
    // A promessa do item, conferida contra o gerador e não contra um caso construído. Se a
    // paletização deixar de valer a pena — porque o mundo ficou mais variado, ou porque a seção
    // mudou de tamanho —, este teste é o que avisa.
    const gen = new WorldGen(1234);
    const d = gen.generateChunk(0, 0);
    const idx = (x: number, y: number, z: number) => x + CX * (z + CZ * y);

    let bytes = 0, secoes = 0, homogeneas = 0;
    const A = ARESTA_DA_SECAO;
    for (let sy = 0; sy < CY / A; sy++)
      for (let sz = 0; sz < CZ / A; sz++)
        for (let sx = 0; sx < CX / A; sx++) {
          const s = empacotarSecao((i) => {
            const x = i % A, z = (i / A | 0) % A, y = (i / (A * A)) | 0;
            return d[idx(sx * A + x, sy * A + y, sz * A + z)];
          });
          bytes += bytesDaSecao(s);
          secoes++;
          if (s.dados === null) homogeneas++;
        }

    expect(d.length).toBe(262144);
    expect(bytes).toBeLessThan(d.length / 8);
    // E a maior parte do mundo é de valor único — a premissa do item 1580.
    expect(homogeneas / secoes).toBeGreaterThan(0.35);
  });

  it('CRÍTICO: ida e volta num chunk real não perde um voxel', () => {
    // "Sem perder um voxel" é a promessa inteira. Uma compressão que erra 0,01% dos blocos é pior
    // que nenhuma: o mundo fica com buracos que ninguém consegue reproduzir.
    const gen = new WorldGen(777);
    const d = gen.generateChunk(1, -2);
    const idx = (x: number, y: number, z: number) => x + CX * (z + CZ * y);
    const A = ARESTA_DA_SECAO;

    for (let sy = 0; sy < CY / A; sy++)
      for (let sz = 0; sz < CZ / A; sz++)
        for (let sx = 0; sx < CX / A; sx++) {
          const bruto = (i: number) => {
            const x = i % A, z = (i / A | 0) % A, y = (i / (A * A)) | 0;
            return d[idx(sx * A + x, sy * A + y, sz * A + z)];
          };
          const s = empacotarSecao(bruto);
          for (let i = 0; i < VOXELS_POR_SECAO; i++) {
            if (lerSecao(s, i) !== bruto(i)) {
              throw new Error(`seção (${sx},${sy},${sz}) voxel ${i}: ${lerSecao(s, i)} != ${bruto(i)}`);
            }
          }
        }
    expect(true).toBe(true);
  });

  it('a aresta da seção é a medida, não a herdada de outro jogo', () => {
    // 16³ é o número de costume e aqui custa 60% mais que 8³ — medido. O mínimo da curva depende do
    // tamanho das feições deste mundo, e não da convenção.
    expect(ARESTA_DA_SECAO).toBe(8);
    expect(CX % ARESTA_DA_SECAO).toBe(0);
    expect(CY % ARESTA_DA_SECAO).toBe(0);
    expect(CZ % ARESTA_DA_SECAO).toBe(0);
  });
});

describe('os caminhos em bloco — o que torna isto usável', () => {
  const SX = CX / ARESTA_DA_SECAO, SY = CY / ARESTA_DA_SECAO, SZ = CZ / ARESTA_DA_SECAO;
  const passoZ = CX, passoY = CX * CZ;
  const baseDe = (sx: number, sy: number, sz: number) =>
    sx * ARESTA_DA_SECAO + CX * (sz * ARESTA_DA_SECAO + CZ * (sy * ARESTA_DA_SECAO));

  function empacotarChunk(d: Uint8Array) {
    const out = [];
    for (let sy = 0; sy < SY; sy++) for (let sz = 0; sz < SZ; sz++) for (let sx = 0; sx < SX; sx++)
      out.push(empacotarDePlano(d, baseDe(sx, sy, sz), passoZ, passoY));
    return out;
  }
  function desempacotarChunk(secs: ReturnType<typeof empacotarChunk>, out: Uint8Array) {
    let k = 0;
    for (let sy = 0; sy < SY; sy++) for (let sz = 0; sz < SZ; sz++) for (let sx = 0; sx < SX; sx++)
      escreverPlanoEm(secs[k++], out, baseDe(sx, sy, sz), passoZ, passoY);
  }

  it('CRÍTICO: um chunk inteiro sobrevive à ida e volta, byte a byte', () => {
    // A promessa é "sem perder um voxel". Uma compressão que erra 0,01% dos blocos é pior que
    // nenhuma: o mundo fica com buracos que ninguém consegue reproduzir.
    const gen = new WorldGen(2024);
    const original = gen.generateChunk(2, -3);
    const volta = new Uint8Array(original.length);
    desempacotarChunk(empacotarChunk(original), volta);
    for (let i = 0; i < original.length; i++) {
      if (volta[i] !== original[i]) throw new Error(`voxel ${i}: ${volta[i]} != ${original[i]}`);
    }
    expect(volta.length).toBe(original.length);
  });

  it('CRÍTICO: o caminho rápido dá exatamente o mesmo que o caminho de referência', () => {
    // Duas implementações da mesma coisa é como uma delas diverge em silêncio. `empacotarSecao`
    // continua existindo para testes e fontes exóticas; se as duas discordarem, é aqui que aparece.
    const gen = new WorldGen(31337);
    const d = gen.generateChunk(0, 1);
    for (const [sx, sy, sz] of [[0, 0, 0], [1, 5, 2], [3, 20, 3], [2, 31, 1]]) {
      const rapido = empacotarDePlano(d, baseDe(sx, sy, sz), passoZ, passoY);
      const referencia = empacotarSecao((i) => {
        const A = ARESTA_DA_SECAO;
        const x = i % A, z = (i / A | 0) % A, y = (i / (A * A)) | 0;
        return d[(sx * A + x) + CX * ((sz * A + z) + CZ * (sy * A + y))];
      });
      for (let i = 0; i < VOXELS_POR_SECAO; i++) {
        expect(lerSecao(rapido, i), `seção (${sx},${sy},${sz}) voxel ${i}`).toBe(lerSecao(referencia, i));
      }
    }
  });

  it('CRÍTICO: uma seção homogênea é escrita sem tocar em bit nenhum', () => {
    // É o caso da maioria do mundo, e é por isso que descomprimir sai mais barato que comprimir:
    // vira `fill` de oito bytes por linha.
    const destino = new Uint8Array(CX * CZ * ARESTA_DA_SECAO).fill(99);
    escreverPlanoEm(secaoHomogenea(7), destino, 0, CX, CX * CZ);
    for (let y = 0; y < ARESTA_DA_SECAO; y++)
      for (let z = 0; z < ARESTA_DA_SECAO; z++)
        for (let x = 0; x < ARESTA_DA_SECAO; x++)
          expect(destino[x + CX * (z + CZ * y)], `${x},${y},${z}`).toBe(7);
    // E não escreveu fora da seção.
    expect(destino[ARESTA_DA_SECAO]).toBe(99);
  });

  it('o empacotamento em bloco não passa por cima do array de origem', () => {
    const gen = new WorldGen(5);
    const d = gen.generateChunk(0, 0);
    const copia = Uint8Array.from(d);
    empacotarChunk(d);
    expect(d).toEqual(copia);
  });
});
