import { describe, it, expect } from 'vitest';
import {
  BIOMAS_CLIMA,
  ContextoBioma,
  biomaDominante,
  descreverBioma,
  fatorSazonal,
  misturarCor,
  misturarEscalar,
  pesosDeBioma,
} from '../../src/world/biomes';

function ctx(p: Partial<ContextoBioma>): ContextoBioma {
  return { temp: 0, moist: 0, montanha: 0, acimaDoMar: 20, ...p };
}

describe('pesosDeBioma — as invariantes que tudo o mais assume', () => {
  it('CRÍTICO: a soma é sempre 1, em todo o domínio', () => {
    // Cor, névoa e saturação usam o peso como fração direta. Se a soma não fosse 1, misturar
    // cor escureceria (soma < 1) ou estouraria (soma > 1) o mundo inteiro.
    for (let t = -1.2; t <= 1.2; t += 0.15) {
      for (let m = -1.2; m <= 1.2; m += 0.15) {
        for (const montanha of [0, 0.5, 0.7, 1]) {
          for (const acimaDoMar of [-20, -3, 0, 3, 40]) {
            const pesos = pesosDeBioma(ctx({ temp: t, moist: m, montanha, acimaDoMar }));
            let soma = 0;
            for (const p of pesos) soma += p.peso;
            expect(soma).toBeCloseTo(1, 6);
          }
        }
      }
    }
  });

  it('CRÍTICO: cobre o plano inteiro — nenhum ponto sem bioma de clima', () => {
    // Um vão entre os centros produziria peso total zero, e a normalização precisaria de um caso
    // especial — que é exatamente a fronteira dura que este módulo existe para eliminar.
    for (let t = -1; t <= 1; t += 0.05) {
      for (let m = -1; m <= 1; m += 0.05) {
        const pesos = pesosDeBioma(ctx({ temp: t, moist: m }));
        const climaticos = pesos.filter((p) => !['oceano', 'praia', 'montanha'].includes(p.id));
        expect(climaticos.length).toBeGreaterThan(0);
      }
    }
  });

  it('nenhum peso é negativo', () => {
    for (let t = -1.5; t <= 1.5; t += 0.1) {
      for (const p of pesosDeBioma(ctx({ temp: t, moist: t * 0.7 }))) {
        expect(p.peso).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('vem ordenado do maior para o menor — `pesos[0]` é o dominante', () => {
    const pesos = pesosDeBioma(ctx({ temp: 0.6, moist: 0.3 }));
    for (let i = 1; i < pesos.length; i++) {
      expect(pesos[i - 1].peso).toBeGreaterThanOrEqual(pesos[i].peso);
    }
  });
});

describe('pesosDeBioma — a transição é contínua', () => {
  it('CRÍTICO: passo pequeno no clima muda pouco o peso — é a razão de tudo isto existir', () => {
    // A fronteira dura de um `if` daria um salto de 1 aqui. O limiar de 0,015 por passo de 0,01
    // não é folgado: o máximo medido é 0,0104, e ele é UNIFORME ao longo do domínio — inclinação,
    // não degrau. Foi assim que este teste reprovou o truncamento nos 4 maiores pesos, que
    // produzia 0,084 isolado contra uma mediana de 0,0077.
    for (let t = -1; t < 1; t += 0.01) {
      const a = pesosDeBioma(ctx({ temp: t, moist: 0.2 }));
      const b = pesosDeBioma(ctx({ temp: t + 0.01, moist: 0.2 }));
      const mapa = new Map(a.map((p) => [p.id, p.peso]));
      for (const p of b) {
        const antes = mapa.get(p.id) ?? 0;
        expect(Math.abs(p.peso - antes)).toBeLessThan(0.015);
      }
      // Bioma que desaparece da lista precisa ter saído com peso já perto de zero.
      for (const p of a) {
        if (!b.some((q) => q.id === p.id)) expect(p.peso).toBeLessThan(0.015);
      }
    }
  });

  it('a cor misturada nunca dá salto entre pontos vizinhos', () => {
    let maiorSalto = 0;
    let anterior = misturarCor(pesosDeBioma(ctx({ temp: -1, moist: 0 })), 'grama');
    for (let t = -1; t <= 1; t += 0.01) {
      const c = misturarCor(pesosDeBioma(ctx({ temp: t, moist: 0 })), 'grama');
      for (let i = 0; i < 3; i++) maiorSalto = Math.max(maiorSalto, Math.abs(c[i] - anterior[i]));
      anterior = c;
    }
    expect(maiorSalto).toBeLessThan(0.006);
  });

  it('a transição para o oceano é gradual, não um degrau na linha d\'água', () => {
    let anterior = 0;
    let maiorSalto = 0;
    for (let h = 10; h >= -12; h -= 0.5) {
      const oceano = pesosDeBioma(ctx({ acimaDoMar: h })).find((p) => p.id === 'oceano')?.peso ?? 0;
      maiorSalto = Math.max(maiorSalto, Math.abs(oceano - anterior));
      anterior = oceano;
    }
    expect(maiorSalto).toBeLessThan(0.15);
  });
});

describe('pesosDeBioma — o clima decide o bioma certo', () => {
  it('cada bioma domina no próprio centro', () => {
    for (const b of BIOMAS_CLIMA) {
      const pesos = pesosDeBioma(ctx({ temp: b.temp, moist: b.moist }));
      expect(biomaDominante(pesos)).toBe(b.id);
    }
  });

  it('quente e seco é deserto; frio é tundra; quente e úmido é selva', () => {
    expect(biomaDominante(pesosDeBioma(ctx({ temp: 0.95, moist: -0.9 })))).toBe('deserto');
    expect(biomaDominante(pesosDeBioma(ctx({ temp: -0.9, moist: -0.2 })))).toBe('tundra');
    expect(biomaDominante(pesosDeBioma(ctx({ temp: 0.85, moist: 0.85 })))).toBe('selva');
  });

  it('submerso é oceano, seja qual for o clima', () => {
    for (const t of [-1, 0, 1]) {
      expect(biomaDominante(pesosDeBioma(ctx({ temp: t, acimaDoMar: -25 })))).toBe('oceano');
    }
  });

  it('montanha alta domina, mas não no fundo do mar', () => {
    expect(biomaDominante(pesosDeBioma(ctx({ montanha: 1, acimaDoMar: 60 })))).toBe('montanha');
    const fundo = pesosDeBioma(ctx({ montanha: 1, acimaDoMar: -30 }));
    expect(biomaDominante(fundo)).toBe('oceano');
  });

  it('o relevo toma peso do clima em vez de competir com ele — existe montanha temperada', () => {
    const pesos = pesosDeBioma(ctx({ temp: 0.1, moist: 0.55, montanha: 0.62, acimaDoMar: 40 }));
    const montanha = pesos.find((p) => p.id === 'montanha')!.peso;
    const floresta = pesos.find((p) => p.id === 'floresta')!.peso;
    expect(montanha).toBeGreaterThan(0);
    expect(floresta).toBeGreaterThan(0);
  });
});

describe('misturas derivadas', () => {
  it('a cor misturada fica dentro da faixa das cores de origem', () => {
    for (let t = -1; t <= 1; t += 0.1) {
      const c = misturarCor(pesosDeBioma(ctx({ temp: t, moist: 0.1 })), 'neblina');
      for (const canal of c) {
        expect(canal).toBeGreaterThanOrEqual(0);
        expect(canal).toBeLessThanOrEqual(1);
      }
    }
  });

  it('no centro de um bioma a mistura é praticamente a cor dele', () => {
    const deserto = BIOMAS_CLIMA.find((b) => b.id === 'deserto')!;
    const c = misturarCor(pesosDeBioma(ctx({ temp: 1.4, moist: -1.4 })), 'neblina');
    for (let i = 0; i < 3; i++) expect(c[i]).toBeCloseTo(deserto.neblina[i], 1);
  });

  it('o deserto abre o horizonte e o pântano fecha', () => {
    const aberto = misturarEscalar(pesosDeBioma(ctx({ temp: 0.9, moist: -0.85 })), 'alcanceNeblina');
    const fechado = misturarEscalar(pesosDeBioma(ctx({ temp: 0.3, moist: 0.9 })), 'alcanceNeblina');
    expect(aberto).toBeGreaterThan(fechado);
  });

  it('o fator sazonal vai de 1 na tundra a quase nada no deserto, sem degrau', () => {
    expect(fatorSazonal(pesosDeBioma(ctx({ temp: -0.75, moist: -0.2 })))).toBeGreaterThan(0.5);
    expect(fatorSazonal(pesosDeBioma(ctx({ temp: 0.9, moist: -0.85 })))).toBeLessThan(0.4);
    for (let t = -1; t <= 1; t += 0.1) {
      const f = fatorSazonal(pesosDeBioma(ctx({ temp: t, moist: 0 })));
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1 + 1e-9); // a normalização deixa resíduo de ponto flutuante
    }
  });

  it('a descrição nomeia a mistura quando há dois biomas relevantes', () => {
    expect(descreverBioma(pesosDeBioma(ctx({ temp: 1.4, moist: -1.4 })))).toBe('Deserto');
    const meio = descreverBioma(pesosDeBioma(ctx({ temp: 0.75, moist: -0.55 })));
    expect(meio).toContain('/');
  });
});
