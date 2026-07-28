// A geometria de uma caixa, num lugar só — item 044.
//
// O laço existia três vezes, escrito à mão em cada uma: `ModAPI.fillBox`, o caso `fill_box` do
// `MCPExecutors`, e de novo dentro de `execute_voxel_script`. As três fazem coisas diferentes com
// cada célula — contar, salvar em lote, registrar o desfazer —, e é por isso que a duplicação
// sobreviveu: não dava para extrair "preencher" sem escolher um dos três efeitos. O que dá para
// extrair é **quais células a caixa tem**.
//
// Duas das três já tinham divergido na forma de escrever a condição de vazado. Eram equivalentes.
// Nada garantia que continuassem.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  percorrerCaixa,
  limitesDaCaixa,
  volumeDaCaixa,
  naCascaDaCaixa,
  recusaDeCaixa,
  MAX_CELULAS_DA_CAIXA,
} from '../../src/world/caixa';

/** Coleta as células visitadas, como chaves ordenáveis. */
function celulas(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, vazada = false) {
  const vistas: string[] = [];
  const r = percorrerCaixa(x1, y1, z1, x2, y2, z2, vazada, (x, y, z) => { vistas.push(`${x},${y},${z}`); });
  return { vistas, ...r };
}

describe('a caixa cheia', () => {
  it('CRÍTICO: visita todas as células, uma vez cada', () => {
    const { vistas, visitadas } = celulas(0, 0, 0, 2, 3, 4);
    expect(visitadas).toBe(3 * 4 * 5);
    expect(new Set(vistas).size).toBe(visitadas);
  });

  it('CRÍTICO: os cantos podem vir em qualquer ordem', () => {
    // As três cópias normalizavam com `Math.min`/`Math.max` cada uma por conta própria. Um pedido
    // com os cantos trocados é o caso comum de quem clica de baixo para cima.
    const a = celulas(0, 0, 0, 3, 3, 3).vistas.sort();
    const b = celulas(3, 3, 3, 0, 0, 0).vistas.sort();
    expect(a).toEqual(b);
  });

  it('coordenadas fracionárias são truncadas para a grade', () => {
    // A IA manda números vindos de JSON, e um `10.5` sem `floor` produziria coordenadas de bloco
    // fracionárias que o `setBlock` trataria de um jeito não especificado.
    const { vistas } = celulas(0.7, 0.2, 0.9, 1.4, 1.1, 1.6);
    for (const c of vistas) expect(c).toMatch(/^[01],[01],[01]$/);
  });

  it('uma caixa de uma célula visita uma célula', () => {
    expect(celulas(5, 5, 5, 5, 5, 5).visitadas).toBe(1);
  });

  it('`visitar` pode interromper devolvendo false', () => {
    let n = 0;
    percorrerCaixa(0, 0, 0, 9, 9, 9, false, () => { n++; return n < 10; });
    expect(n).toBe(10);
  });
});

describe('a caixa vazada', () => {
  it('CRÍTICO: deixa o miolo de fora', () => {
    const { visitadas } = celulas(0, 0, 0, 4, 4, 4, true);
    expect(visitadas).toBe(5 ** 3 - 3 ** 3);
  });

  it('CRÍTICO: uma laje de um bloco de altura é TODA casca', () => {
    // O caso que não é óbvio e que some sem aviso: com `minY === maxY`, toda célula satisfaz
    // `y === minY`. Sem isso, pedir um chão de um bloco "oco" devolveria nada — um piso que não
    // aparece, com o argumento `hollow` como única pista, três chamadas acima.
    const cheia = celulas(0, 7, 0, 9, 7, 9, false).visitadas;
    const vazada = celulas(0, 7, 0, 9, 7, 9, true).visitadas;
    expect(vazada).toBe(cheia);
    expect(vazada).toBe(100);
  });

  it('uma linha e um ponto também são toda casca', () => {
    expect(celulas(0, 0, 0, 9, 0, 0, true).visitadas).toBe(10);
    expect(celulas(3, 3, 3, 3, 3, 3, true).visitadas).toBe(1);
  });

  it('CRÍTICO: a casca é exatamente a superfície, sem furo nem sobra', () => {
    // Confere célula a célula contra a definição, e não contra outra fórmula — duas fórmulas
    // erradas do mesmo jeito passariam.
    const l = limitesDaCaixa(-2, 1, 5, 3, 6, 9);
    const { vistas } = celulas(-2, 1, 5, 3, 6, 9, true);
    const esperadas: string[] = [];
    for (let x = l.minX; x <= l.maxX; x++) {
      for (let y = l.minY; y <= l.maxY; y++) {
        for (let z = l.minZ; z <= l.maxZ; z++) {
          const naBorda = x === l.minX || x === l.maxX || y === l.minY || y === l.maxY || z === l.minZ || z === l.maxZ;
          if (naBorda) esperadas.push(`${x},${y},${z}`);
        }
      }
    }
    expect(vistas.sort()).toEqual(esperadas.sort());
  });

  it('`naCascaDaCaixa` concorda com o percurso', () => {
    const l = limitesDaCaixa(0, 0, 0, 3, 3, 3);
    expect(naCascaDaCaixa(l, 0, 2, 2)).toBe(true);
    expect(naCascaDaCaixa(l, 1, 1, 1)).toBe(false);
  });
});

describe('o limite, que não existia em nenhuma das três cópias', () => {
  it('CRÍTICO: uma caixa absurda é recusada em vez de travar a aba', () => {
    // Oito milhões de células: a aba congela, sem erro e sem fim, e do lado de fora parece que o
    // jogo morreu. É um pedido que a IA faz sozinha, por um dígito a mais, e o jogador não tem
    // como cancelar.
    let tocou = 0;
    const r = percorrerCaixa(0, 0, 0, 199, 199, 199, false, () => { tocou++; });
    expect(r.truncada).toBe(true);
    expect(tocou).toBe(0);
    expect(r.volumePedido).toBe(200 ** 3);
  });

  it('CRÍTICO: a recusa é total, e não "faz o que couber"', () => {
    // Uma caixa cortada pela metade deixa uma construção incompleta que parece defeito de geração,
    // e quem pediu não tem como saber onde ela parou.
    const r = percorrerCaixa(0, 0, 0, 999, 0, 999, false, () => {});
    expect(r.visitadas).toBe(0);
  });

  it('CRÍTICO: o limite conta CÉLULAS, não aresta', () => {
    // Uma caixa de 400×400×1 é tão cara quanto uma de 58³, e passaria por qualquer limite de lado.
    const r = percorrerCaixa(0, 0, 0, 399, 0, 399, false, () => {});
    expect(r.volumePedido).toBe(160_000);
    expect(r.truncada).toBe(false);
  });

  it('uma caixa exatamente no limite passa', () => {
    const lado = Math.floor(Math.cbrt(MAX_CELULAS_DA_CAIXA));
    const r = percorrerCaixa(0, 0, 0, lado - 1, lado - 1, lado - 1, false, () => {});
    expect(r.truncada).toBe(false);
    expect(r.visitadas).toBe(lado ** 3);
  });

  it('o limite cabe uma casa grande, e não cabe um mundo', () => {
    // Se fosse pequeno demais, construções legítimas quebrariam e o limite viraria um estorvo.
    expect(volumeDaCaixa(limitesDaCaixa(0, 0, 0, 59, 59, 59))).toBeLessThan(MAX_CELULAS_DA_CAIXA);
    expect(MAX_CELULAS_DA_CAIXA).toBeLessThan(1_000_000);
  });

  it('a frase de recusa diz o número pedido e o limite', () => {
    const t = recusaDeCaixa(8_000_000);
    expect(t).toMatch(/8\D?000\D?000/);
    expect(t).toMatch(/250\D?000/);
  });
});

describe('as três cópias foram embora — item 044', () => {
  const modApi = readFileSync('src/mods/ModAPI.ts', 'utf8');
  const mcp = readFileSync('src/ai/MCPExecutors.ts', 'utf8');

  it('CRÍTICO: nenhum laço de casca escrito à mão sobrou', () => {
    // A condição existia em duas formas diferentes nos três lugares. Uma busca pelo que era comum
    // às duas é o que impede uma quarta cópia de nascer.
    for (const [nome, texto] of [['ModAPI', modApi], ['MCPExecutors', mcp]] as const) {
      expect(texto, nome).not.toMatch(/isEdge/);
      expect(texto, nome).not.toMatch(/x !== minX && x !== maxX/);
    }
  });

  it('CRÍTICO: os três chamadores usam `percorrerCaixa`', () => {
    expect(modApi).toMatch(/percorrerCaixa\(x1, y1, z1, x2, y2, z2, hollow,/);
    expect((mcp.match(/percorrerCaixa\(/g) ?? []).length).toBe(2);
  });

  it('CRÍTICO: o caminho da IA avisa quando recusa', () => {
    // Sem a mensagem, a IA pediria uma caixa enorme, receberia "caixa preenchida com 0 blocos" e
    // tentaria de novo — em laço, sem nunca entender o que houve.
    expect(mcp).toMatch(/if \(percurso\.truncada\) return \{ result: recusaDeCaixa\(/);
  });
});
