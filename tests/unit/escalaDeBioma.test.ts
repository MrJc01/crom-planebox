// Em que escala o clima muda — itens 1594 a 1596.
//
// Medi antes de mexer: o trecho contíguo de um mesmo bioma tinha mediana de 32 metros e média de
// 58. Um bioma de trinta e dois metros não é um bioma, é uma mancha — o jogador atravessa seis num
// minuto e nenhum tem tempo de significar nada.
//
// A causa não era a frequência do ruído de clima, que já era de 700 metros. Eram dois campos de
// alta frequência mandando nele: a temperatura modulada pela ALTURA (que carrega colinas de 50 m e
// cordilheiras com 17 m de amplitude) e a umidade empurrada por rio, que é estreito.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  climaEm,
  ESCALA_CONTINENTAL,
  ESCALA_REGIONAL,
  ESCALA_LOCAL,
  PESO_CONTINENTAL,
  PESO_REGIONAL,
  PESO_LOCAL,
  ALTITUDE_QUE_ESFRIA_M,
  FRIO_POR_METRO,
  UMIDADE_DE_RIO,
} from '../../src/world/escalaDeBioma';
import { Simplex2 } from '../../src/core/noise';
import { NIVEL_DO_MAR_M } from '../../src/world/worldgen';

const nT = new Simplex2(1234);
const nM = new Simplex2(5678);
const clima = (x: number, z: number, h = 50, rio = 0) => climaEm(nT, nM, x, z, h, rio);

describe('as três escalas', () => {
  it('CRÍTICO: o continental manda', () => {
    // Sozinho, o regional e o local dariam de novo o mundo em manchas. O peso é a regra inteira.
    expect(PESO_CONTINENTAL).toBeGreaterThan(PESO_REGIONAL + PESO_LOCAL);
    expect(PESO_REGIONAL).toBeGreaterThan(PESO_LOCAL);
  });

  it('CRÍTICO: as escalas estão em ordem e bem separadas', () => {
    // Duas escalas próximas somam ruído sem acrescentar hierarquia — seria o mesmo campo, duas
    // vezes, com o dobro do custo.
    expect(ESCALA_CONTINENTAL).toBeLessThan(ESCALA_REGIONAL);
    expect(ESCALA_REGIONAL).toBeLessThan(ESCALA_LOCAL);
    expect(ESCALA_REGIONAL / ESCALA_CONTINENTAL).toBeGreaterThan(3);
    expect(ESCALA_LOCAL / ESCALA_REGIONAL).toBeGreaterThan(3);
  });

  it('a faixa continental cobre quilômetros', () => {
    // Se a maior escala fosse de centenas de metros, o "enorme" do pedido não existiria.
    expect(1 / ESCALA_CONTINENTAL).toBeGreaterThan(2000);
  });

  it('CRÍTICO: o resultado fica na faixa que os limiares de bioma esperam', () => {
    // Os limiares em `biomes.ts` estão calibrados para -1..1. Sem normalizar pela soma dos pesos, o
    // campo sairia até 1,45 e os biomas extremos tomariam o mundo — sem nada apontando a causa.
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < 4000; i++) {
      const c = clima(i * 37, i * 53, NIVEL_DO_MAR_M);
      min = Math.min(min, c.temp, c.moist);
      max = Math.max(max, c.temp, c.moist);
    }
    expect(min).toBeGreaterThan(-1.05);
    expect(max).toBeLessThan(1.05);
  });
});

describe('a altitude não decide mais o bioma', () => {
  it('CRÍTICO: uma colina de dois metros quase não muda a temperatura', () => {
    // Era `max(0, h - 26) * 0.03` com o mar em 46: toda a terra firme estava acima do limiar, então
    // o termo valia sempre e trazia junto todo o ruído de relevo.
    const noVale = clima(500, 500, NIVEL_DO_MAR_M + 1).temp;
    const naColina = clima(500, 500, NIVEL_DO_MAR_M + 3).temp;
    expect(Math.abs(naColina - noVale)).toBeLessThan(0.01);
  });

  it('CRÍTICO: a montanha continua fria', () => {
    // Tirar o acoplamento inteiro resolveria o piscar e criaria outro problema: pico de montanha
    // com clima de planície.
    const naPlanicie = clima(500, 500, NIVEL_DO_MAR_M).temp;
    const noPico = clima(500, 500, ALTITUDE_QUE_ESFRIA_M + 25).temp;
    expect(noPico).toBeLessThan(naPlanicie - 0.2);
  });

  it('o limiar de altitude fica acima do nível do mar, não abaixo', () => {
    // Abaixo dele, o termo valeria para toda a terra firme — que é exatamente o defeito antigo.
    expect(ALTITUDE_QUE_ESFRIA_M).toBeGreaterThan(NIVEL_DO_MAR_M + 5);
    expect(FRIO_POR_METRO).toBeLessThan(0.02);
  });
});

describe('o rio molha a margem sem trocá-la de bioma', () => {
  it('CRÍTICO: o empurrão é pequeno o bastante para não virar outro bioma', () => {
    // Era 0,3, e o resultado era uma fita de pântano acompanhando cada rio do mundo.
    expect(UMIDADE_DE_RIO).toBeLessThan(0.2);
  });

  it('mas existe — a margem é mais úmida', () => {
    const seco = clima(800, 800, 50, 0).moist;
    const molhado = clima(800, 800, 50, 1).moist;
    expect(molhado).toBeGreaterThan(seco);
    expect(molhado - seco).toBeCloseTo(UMIDADE_DE_RIO, 6);
  });
});

describe('o campo é contínuo e determinístico', () => {
  it('CRÍTICO: dois pontos vizinhos têm climas vizinhos', () => {
    // Um salto no clima é um salto no bioma, e nenhuma quantidade de escalas conserta uma
    // descontinuidade.
    for (let i = 0; i < 200; i++) {
      const a = clima(i * 91, i * 37);
      const b = clima(i * 91 + 1, i * 37);
      expect(Math.abs(a.temp - b.temp), `x=${i * 91}`).toBeLessThan(0.02);
      expect(Math.abs(a.moist - b.moist), `x=${i * 91}`).toBeLessThan(0.02);
    }
  });

  it('a mesma semente dá o mesmo clima', () => {
    const a = climaEm(new Simplex2(99), new Simplex2(11), 400, 700, 50, 0);
    const b = climaEm(new Simplex2(99), new Simplex2(11), 400, 700, 50, 0);
    expect(a).toEqual(b);
  });

  it('temperatura e umidade não são o mesmo campo', () => {
    // Com o mesmo ruído nos dois, todo lugar quente seria seco e o mapa de biomas viraria uma
    // linha em vez de um plano.
    let iguais = 0;
    for (let i = 0; i < 500; i++) {
      const c = clima(i * 61, i * 89);
      if (Math.abs(c.temp - c.moist) < 0.01) iguais++;
    }
    expect(iguais).toBeLessThan(30);
  });
});

describe('a fiação existe — código presente não é código ativo', () => {
  const gen = readFileSync('src/world/worldgen.ts', 'utf8');

  it('CRÍTICO: o gerador usa `climaEm` e não a conta antiga', () => {
    expect(gen).toMatch(/const \{ temp, moist \} = climaEm\(this\.nTemp, this\.nMoist, x, z, h, river\)/);
  });

  it('CRÍTICO: a modulação por altura antiga não sobreviveu', () => {
    // Ela é o defeito principal. Deixá-la em qualquer forma faria o bioma voltar a piscar junto com
    // o relevo, e a explicação estaria a um arquivo de distância do sintoma.
    expect(gen).not.toMatch(/Math\.max\(0, h - 26\) \* 0\.03/);
    expect(gen).not.toMatch(/river \* 0\.3/);
  });

  it('a altura e o rio chegam ao clima', () => {
    // As duas correções são sobre eles. Se não entrassem, o módulo existiria e não corrigiria nada.
    expect(gen).toMatch(/climaEm\([^)]*h, river\)/);
  });
});
