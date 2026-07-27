// Camadas verticais com identidade — itens 495 e 496.
//
// (Nome com "Verticais" porque `camadas.test.ts` já é o empilhamento de telas. São duas noções de
// camada sem nenhuma relação, e deixá-las com o mesmo nome de arquivo garantiria que alguém abrisse
// a errada procurando a outra.)
//
// A profundidade já mudava **o que se acha**: carvão perto da superfície, diamante no fundo. O que
// faltava era a profundidade mudar **onde se está** — descer trinta metros era mecanicamente
// diferente e sensorialmente idêntico: mesma névoa, mesmo silêncio, mesma pedra.

import { describe, it, expect } from 'vitest';
import {
  CAMADAS,
  ambienteDaProfundidade,
  camadaEm,
  camadaNaProfundidade,
  mineriroPermitidoNaProfundidade,
  progressoNaCamada,
} from '../../src/world/camadas';
import { ORE_TIERS } from '../../src/world/underground';
import { SCALE } from '../../src/world/chunk';

describe('em que camada estou', () => {
  it('a superfície é a camada de quem está por cima', () => {
    expect(camadaNaProfundidade(0).id).toBe('superficie');
    expect(camadaNaProfundidade(-5).id).toBe('superficie');
  });

  it('descer atravessa as camadas na ordem', () => {
    const ids = [0, 8, 16, 25, 60].map((m) => camadaNaProfundidade(m).id);
    expect(ids).toEqual(['superficie', 'subsolo', 'caverna', 'abismo', 'abismo']);
  });

  it('CRÍTICO: a camada é medida da SUPERFÍCIE, não do y absoluto', () => {
    // Um y fixo tornaria o subsolo de uma montanha e o de um vale a mesma coisa: quem cava dez
    // metros a partir do pico estaria "no fundo" com o céu à vista.
    const noPicoDaMontanha = camadaEm(200 * SCALE, 210 * SCALE);
    const noValeRaso = camadaEm(30 * SCALE, 40 * SCALE);
    expect(noPicoDaMontanha.id).toBe(noValeRaso.id);
  });

  it('as camadas estão em ordem crescente de profundidade', () => {
    // `camadaNaProfundidade` percorre a lista e para na primeira que não alcançou. Fora de ordem,
    // ela devolveria a camada errada sem nenhum erro.
    for (let i = 1; i < CAMADAS.length; i++) {
      expect(CAMADAS[i].inicio, CAMADAS[i].id).toBeGreaterThan(CAMADAS[i - 1].inicio);
    }
  });
});

describe('recursos exclusivos — item 496', () => {
  it('CRÍTICO: o diamante só existe na camada dele', () => {
    const dono = CAMADAS.find((c) => c.exclusivos.includes('diamante'))!;
    expect(mineriroPermitidoNaProfundidade('diamante', dono.inicio + 1)).toBe(true);
    expect(mineriroPermitidoNaProfundidade('diamante', dono.inicio - 1)).toBe(false);
  });

  it('CRÍTICO: TODO minério exclusivo tem profundidade onde de fato aparece', () => {
    // O erro que este teste existe para pegar, e que eu cometi: pus o abismo em 30 metros com o
    // diamante indo até 26. Ele ficava exclusivo de uma camada onde nunca aparece — nada errava, o
    // diamante simplesmente deixou de existir no mundo. A forma mais silenciosa possível de quebrar
    // a progressão inteira.
    for (const camada of CAMADAS) {
      for (const chave of camada.exclusivos) {
        const tier = ORE_TIERS.find((t) => t.chave === chave)!;
        const inicio = Math.max(camada.inicio, tier.minDepth);
        expect(inicio, `${chave}: a camada "${camada.id}" começa depois da faixa dele acabar`)
          .toBeLessThan(tier.maxDepth);

        // E o intervalo comum precisa mesmo cair na camada certa.
        const meio = (inicio + tier.maxDepth) / 2;
        expect(mineriroPermitidoNaProfundidade(chave, meio), `${chave} em ${meio}m`).toBe(true);
      }
    }
  });

  it('CRÍTICO: carvão e ferro atravessam camadas — a exclusividade é a exceção', () => {
    // São eles que dão continuidade à descida. Se tudo fosse exclusivo, cada camada seria um jogo
    // separado e a passagem entre elas deixaria de ser progressão.
    for (const m of [8, 16, 25]) {
      expect(mineriroPermitidoNaProfundidade('carvao', m), `carvão em ${m}m`).toBe(true);
      expect(mineriroPermitidoNaProfundidade('ferro', m), `ferro em ${m}m`).toBe(true);
    }
  });

  it('nenhum minério é exclusivo de duas camadas', () => {
    // `mineriroPermitidoNaProfundidade` usa o PRIMEIRO dono que encontra. Com dois, o segundo seria
    // ignorado em silêncio.
    const vistos = new Set<string>();
    for (const c of CAMADAS) {
      for (const e of c.exclusivos) {
        expect(vistos.has(e), `${e} é exclusivo de mais de uma camada`).toBe(false);
        vistos.add(e);
      }
    }
  });
});

describe('a transição não é um estalo', () => {
  it('CRÍTICO: a névoa muda gradualmente ao cruzar a fronteira', () => {
    // Uma troca instantânea de cor é visível como um estalo, e o jogador aprende a posição exata da
    // fronteira — o que destrói a ilusão de estar num lugar e revela uma tabela.
    const antes = ambienteDaProfundidade(13.4);
    const depois = ambienteDaProfundidade(14.0);
    expect(Math.abs(antes.alcance - depois.alcance)).toBeLessThan(0.1);
  });

  it('CRÍTICO: no começo da camada a cor é a dela, não uma média', () => {
    // Interpolar a faixa inteira faria o jogador nunca ver a cor pura de nenhuma camada — ele
    // estaria sempre no meio de duas, e o esforço de dar identidade a cada uma se perderia.
    const caverna = CAMADAS.find((c) => c.id === 'caverna')!;
    expect(ambienteDaProfundidade(caverna.inicio + 1).alcance).toBeCloseTo(caverna.alcanceNeblina, 5);
  });

  it('a última camada não tenta interpolar para uma que não existe', () => {
    const fundo = CAMADAS[CAMADAS.length - 1];
    expect(ambienteDaProfundidade(1000).alcance).toBeCloseTo(fundo.alcanceNeblina, 5);
    expect(progressoNaCamada(1000)).toBe(1);
  });

  it('o alcance da névoa encolhe monotonicamente ao descer', () => {
    // Se uma camada mais funda abrisse o horizonte, descer pareceria voltar para cima.
    let anterior = Infinity;
    for (let m = 0; m <= 40; m += 2) {
      const a = ambienteDaProfundidade(m).alcance;
      expect(a, `${m}m`).toBeLessThanOrEqual(anterior + 1e-9);
      anterior = a;
    }
  });

  it('há um piso de luz — o fundo não é preto absoluto', () => {
    // Preto absoluto torna a tocha obrigatória de um jeito que não é tenso, é cego.
    for (const c of CAMADAS.slice(1)) {
      expect(c.luzMinima, c.id).toBeGreaterThan(0);
    }
  });
});
