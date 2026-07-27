// As luzes da cena em função da profundidade — item 1437.
//
// `luzMinima` estava declarado nas camadas e ninguém lia. Ao ir ligá-lo apareceu um defeito maior:
// as três luzes da cena são globais e seguiam só o `sunScale`, então uma caverna a quarenta metros
// era **duas vezes mais clara ao meio-dia que à meia-noite**. A luz por voxel do `lighting.ts`
// estava certa — a caverna tem `sky = 0`. O que ela multiplicava é que não estava.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { luzesEm, AMBIENTE_POR_PISO } from '../../src/render/luzDeCamada';
import { CAMADAS } from '../../src/world/camadas';

const MEIO_DIA = 1;
const MEIA_NOITE = 0.12;

/** O piso da camada com este id, como `ambienteDaProfundidade` o entregaria bem dentro dela. */
function piso(id: string): number {
  return CAMADAS.find((c) => c.id === id)!.luzMinima;
}

describe('debaixo da terra o sol para de mandar', () => {
  it('CRÍTICO: no fundo, meio-dia e meia-noite dão a mesma luz ambiente', () => {
    // O defeito que este teste existe para pegar. Não é uma questão de gosto: nenhuma luz do sol
    // chega a quarenta metros de rocha, e o mundo pulsando com a hora denuncia que a profundidade
    // é decorativa.
    const dia = luzesEm(MEIO_DIA, piso('abismo'), 1, 0);
    const noite = luzesEm(MEIA_NOITE, piso('abismo'), 1, 0);
    expect(dia.ambiente).toBeCloseTo(noite.ambiente, 6);
  });

  it('CRÍTICO: na superfície nada muda — o sol continua mandando sozinho', () => {
    // O item não pode custar nada a quem está por cima, que é 100% do tempo de jogo no começo.
    for (const s of [MEIO_DIA, 0.5, MEIA_NOITE]) {
      const antes = 0.26 + 0.34 * s;
      expect(luzesEm(s, piso('superficie'), 0, 0).ambiente, `sunScale ${s}`).toBeCloseTo(antes, 6);
      expect(luzesEm(s, piso('superficie'), 0, 0).sol, `sol ${s}`).toBeCloseTo(1.75 * s, 6);
    }
  });

  it('CRÍTICO: descer à noite nunca ACENDE o mundo', () => {
    // O piso da superfície (0,12 → 0,60) fica acima do ambiente de uma noite fechada (0,30). Sem o
    // `min`, atravessar os primeiros seis metros à meia-noite clarearia a cena antes de escurecer —
    // um limite que nunca morde, que é o modo de falha preferido desta casa.
    let anterior = luzesEm(MEIA_NOITE, piso('superficie'), 0, 0).ambiente;
    for (const [p, t] of [[piso('superficie'), 0.5], [piso('subsolo'), 1], [piso('caverna'), 1], [piso('abismo'), 1]] as const) {
      const v = luzesEm(MEIA_NOITE, p, t, 0).ambiente;
      expect(v, `piso ${p}`).toBeLessThanOrEqual(anterior + 1e-9);
      anterior = v;
    }
  });

  it('CRÍTICO: descer escurece, camada após camada', () => {
    // É o sinal do item 495: a diferença entre o subsolo e o abismo tem de ser perceptível sem
    // tocha. Se as camadas dessem a mesma luz, a névoa mudaria de cor e mais nada.
    const a = luzesEm(MEIO_DIA, piso('subsolo'), 1, 0).ambiente;
    const b = luzesEm(MEIO_DIA, piso('caverna'), 1, 0).ambiente;
    const c = luzesEm(MEIO_DIA, piso('abismo'), 1, 0).ambiente;
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
    // E o espaçamento é grande o bastante para o olho: cada degrau tira pelo menos um terço.
    expect(c / a).toBeLessThan(0.7);
  });

  it('a transição da superfície para o subsolo é contínua', () => {
    // Um salto de luz ao cruzar seis metros seria visível como um estalo, e ensinaria a posição
    // exata da fronteira — o mesmo motivo pelo qual a névoa é interpolada.
    let anterior = luzesEm(MEIO_DIA, piso('superficie'), 0, 0).ambiente;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      // Acompanha o que `ambienteDaProfundidade` faz: o piso só sobe no terço final da faixa.
      const p = t < 0.667
        ? piso('superficie')
        : piso('superficie') + (piso('subsolo') - piso('superficie')) * ((t - 0.667) / 0.333);
      const v = luzesEm(MEIO_DIA, p, t, 0).ambiente;
      expect(Math.abs(v - anterior), `salto em t=${t.toFixed(2)}`).toBeLessThan(0.06);
      anterior = v;
    }
  });

  it('CRÍTICO: o sol e a hemisférica são atenuados, nunca zerados', () => {
    // Quem está a dez metros olhando pela boca de um túnel vê a superfície lá fora. Apagar o
    // direcional deixaria essa paisagem chapada e preta — um erro maior do que o que se corrige.
    const fundo = luzesEm(MEIO_DIA, piso('abismo'), 1, 0);
    expect(fundo.sol).toBeGreaterThan(0);
    expect(fundo.hemisferica).toBeGreaterThan(0);
    expect(fundo.sol).toBeLessThan(luzesEm(MEIO_DIA, piso('superficie'), 0, 0).sol);
  });

  it('o relâmpago atravessa a rocha', () => {
    // Não porque seja físico, mas porque o raio ilumina a boca da caverna, e quem está logo dentro
    // dela precisa ver isso acontecer.
    const sem = luzesEm(MEIA_NOITE, piso('caverna'), 1, 0);
    const com = luzesEm(MEIA_NOITE, piso('caverna'), 1, 1);
    expect(com.ambiente).toBeGreaterThan(sem.ambiente);
    expect(com.sol).toBeGreaterThan(sem.sol);
  });

  it('`dentroDaTerra` fora de 0..1 não estoura nem inverte', () => {
    // A profundidade vem de uma divisão feita no laço de quadro, e um jogador acima do terreno
    // (voando, ou num pico recém-gerado) produz negativo.
    const sup = piso('superficie');
    expect(luzesEm(MEIO_DIA, sup, -3, 0).ambiente).toBeCloseTo(luzesEm(MEIO_DIA, sup, 0, 0).ambiente, 6);
    expect(luzesEm(MEIO_DIA, piso('abismo'), 9, 0).ambiente)
      .toBeCloseTo(luzesEm(MEIO_DIA, piso('abismo'), 1, 0).ambiente, 6);
  });

  it('todas as intensidades são finitas e não-negativas em toda a faixa', () => {
    for (const s of [0, 0.12, 0.5, 1]) {
      for (const p of CAMADAS.map((c) => c.luzMinima)) {
        for (const d of [0, 0.5, 1]) {
          const l = luzesEm(s, p, d, 0);
          for (const [k, v] of Object.entries(l)) {
            expect(Number.isFinite(v), `${k} em (${s},${p},${d})`).toBe(true);
            expect(v, `${k} em (${s},${p},${d})`).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });
});

describe('a fiação existe — código presente não é código ativo', () => {
  const cena = readFileSync('src/render/scene.ts', 'utf8');
  const main = readFileSync('src/main.ts', 'utf8');

  it('CRÍTICO: `aplicarLuzes` usa `luzesEm` e não a conta antiga', () => {
    // O modo de falha desta casa: a função nova existe, é testada, e a cena continua chamando a
    // fórmula velha. Nada reprova, e a caverna segue pulsando com o sol.
    expect(cena).toMatch(/luzesEm\(sunScale/);
    expect(cena).not.toMatch(/ambiente\.intensity\s*=\s*0\.26/);
  });

  it('CRÍTICO: o laço de quadro chama `setLayerLight` com o piso da camada', () => {
    expect(main).toMatch(/gs\.setLayerLight\(camada\.luzMinima,/);
  });

  it('`setLayerLight` está no contrato de `GameScene`', () => {
    // Sem isto, um segundo renderizador (ou um teste com cena falsa) compilaria sem o método e a
    // profundidade sumiria só naquele caminho.
    expect(cena).toMatch(/setLayerLight\(piso: number, dentro: number\): void;/);
  });

  it('o fator de conversão está documentado onde os números moram', () => {
    expect(AMBIENTE_POR_PISO).toBeGreaterThan(1);
    // Subsolo pouco acima de uma noite a céu aberto (0,26) é a calibração pretendida.
    expect(piso('subsolo') * AMBIENTE_POR_PISO).toBeGreaterThan(0.26);
    expect(piso('abismo') * AMBIENTE_POR_PISO).toBeLessThan(0.26);
  });
});
