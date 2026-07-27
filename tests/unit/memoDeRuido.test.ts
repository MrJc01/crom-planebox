// O memo do reticulado de ruído — item 1450.
//
// Gerar um chunk custava 131 ms, e 87% disso era `isCave`. A causa não era a frequência do campo:
// era que a célula do reticulado tem 22 metros em x/z — 67 mini-voxels, mais larga que o chunk
// inteiro, que tem 32 — e cada voxel recalculava os mesmos oito cantos do zero.
//
// O cache derrubou para 45 ms. O que estes testes protegem é a única coisa que torna essa troca
// legítima: ele é **exato**. Um cache de ruído que aproxima muda o mundo em silêncio, e um mundo
// diferente não erra em lugar nenhum — só deixa de ser o mundo que o jogador conhecia.

import { describe, it, expect } from 'vitest';
import { Value3 } from '../../src/core/noise';

/** fBm calculado sem nenhum cache, direto do `noise` público. É a referência. */
function fbmDeReferencia(n: Value3, x: number, y: number, z: number, oitavas: number): number {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < oitavas; i++) {
    sum += n.noise(x * freq, y * freq, z * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function ridgedDeReferencia(n: Value3, x: number, y: number, z: number, oitavas: number): number {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < oitavas; i++) {
    sum += (1 - Math.abs(n.noise(x * freq, y * freq, z * freq))) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

describe('o memo é exato, não aproximado', () => {
  it('CRÍTICO: fbm com cache dá o mesmo número que sem cache', () => {
    // `toBe` e não `toBeCloseTo`: o valor é comparado contra um limiar para decidir se o voxel é
    // rocha ou vazio, e uma diferença no último bit vira uma parede que existe ou não existe.
    const n = new Value3(4242);
    for (let i = 0; i < 400; i++) {
      const x = i * 0.0137 - 2, y = i * 0.031, z = i * 0.0091 + 5;
      expect(n.fbm(x, y, z, 2), `ponto ${i}`).toBe(fbmDeReferencia(new Value3(4242), x, y, z, 2));
    }
  });

  it('CRÍTICO: ridged com cache dá o mesmo número que sem cache', () => {
    const n = new Value3(99);
    for (let i = 0; i < 400; i++) {
      const x = i * 0.0137 - 2, y = i * 0.031, z = i * 0.0091 + 5;
      expect(n.ridged(x, y, z, 2), `ponto ${i}`).toBe(ridgedDeReferencia(new Value3(99), x, y, z, 2));
    }
  });

  it('CRÍTICO: o cache não contamina a chamada seguinte — mesma entrada, mesma saída', () => {
    // Um memo com a chave errada só aparece na SEGUNDA chamada: a primeira preenche e acerta, a
    // seguinte lê um valor que não é dela. Este teste pergunta duas vezes de propósito.
    const n = new Value3(7);
    const primeira = n.fbm(1.25, 3.75, 0.5, 3);
    n.fbm(90.1, 41.9, 17.3, 3); // desloca o cache para longe
    expect(n.fbm(1.25, 3.75, 0.5, 3)).toBe(primeira);
  });

  it('CRÍTICO: dois pontos na MESMA célula do reticulado não colapsam no mesmo valor', () => {
    // O bug que a chave em ponto flutuante existe para impedir. Chavear o memo pelos índices
    // inteiros da célula pareceria certo — mas dois pontos dentro da mesma célula têm pesos de
    // interpolação diferentes, e o segundo receberia o valor do primeiro. Como a célula do campo
    // de cavernas cobre 67 mini-voxels, a coluna inteira viria constante: paredes lisas, sem uma
    // única exceção que denunciasse o erro.
    const n = new Value3(1234);
    const a = n.fbm(10.1, 5.5, 3.3, 2);
    const b = n.fbm(10.9, 5.5, 3.3, 2); // mesmo floor em x, fração bem diferente
    expect(Math.floor(10.1)).toBe(Math.floor(10.9));
    expect(a).not.toBe(b);
  });

  it('CRÍTICO: oitavas diferentes não disputam o mesmo slot', () => {
    // `fbm` alterna frequências dentro de uma chamada só. Com um slot único, cada oitava expulsaria
    // a anterior: o cache erraria 100% das vezes e ficaria mais lento que não ter cache — sem que
    // nada reprovasse, porque o resultado continuaria certo.
    const n = new Value3(31337);
    for (const oitavas of [1, 2, 3, 4, 5]) {
      expect(n.fbm(2.3, 7.1, 4.9, oitavas), `${oitavas} oitavas`)
        .toBe(fbmDeReferencia(new Value3(31337), 2.3, 7.1, 4.9, oitavas));
    }
  });

  it('mais oitavas do que o memo cobre continua correto', () => {
    // Além do limite de slots a amostra é calculada sem cache. O caminho existe e ninguém o usa
    // hoje, que é exatamente a condição em que ele apodrece sem aviso.
    const n = new Value3(5);
    expect(n.ridged(1.1, 2.2, 3.3, 12)).toBe(ridgedDeReferencia(new Value3(5), 1.1, 2.2, 3.3, 12));
  });

  it('duas instâncias com a mesma semente concordam, independente da ordem de uso', () => {
    const a = new Value3(88);
    const b = new Value3(88);
    b.fbm(500.5, 300.25, 100.75, 3); // aquece o cache de `b` num lugar irrelevante
    expect(a.fbm(1.5, 2.5, 3.5, 3)).toBe(b.fbm(1.5, 2.5, 3.5, 3));
  });
});

describe('o cache de fato acerta — senão não serviu para nada', () => {
  it('CRÍTICO: varrer por coluna é sensivelmente mais rápido que varrer por camada', () => {
    // A economia inteira depende de x e z ficarem parados enquanto y anda, que é como
    // `generateChunk` percorre o mundo. Trocar os laços para y externo faria o cache errar em toda
    // amostra e os 45 ms voltarem a ser 131 — e nenhum teste de mundo reprovaria, porque o
    // resultado continua idêntico. Só o relógio percebe.
    //
    // Este é um teste de tempo, então a margem é folgada de propósito: a diferença medida é de mais
    // de 2× e a exigência é 1,3×. Ele existe para pegar o desastre, não para vigiar milissegundos.
    const n = new Value3(2024);
    const amostra = (x: number, y: number, z: number) => n.ridged(x * 0.045, y * 0.09, z * 0.045, 2);

    const porColuna = () => {
      let s = 0;
      for (let z = 0; z < 24; z++) for (let x = 0; x < 24; x++) for (let y = 0; y < 46; y++) s += amostra(x, y, z);
      return s;
    };
    const porCamada = () => {
      let s = 0;
      for (let y = 0; y < 46; y++) for (let z = 0; z < 24; z++) for (let x = 0; x < 24; x++) s += amostra(x, y, z);
      return s;
    };

    porColuna(); porCamada(); // aquece o JIT antes de medir

    const t0 = performance.now();
    const a = porColuna();
    const t1 = performance.now();
    const b = porCamada();
    const t2 = performance.now();

    expect(a).toBeCloseTo(b, 6); // e as duas ordens dão o mesmo resultado
    expect((t2 - t1) / Math.max(t1 - t0, 0.001)).toBeGreaterThan(1.3);
  });
});
