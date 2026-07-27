// Névoa: altitude, horizonte e caverna — itens 1091, 1092 e 1093.
//
// Os três dizem a mesma coisa por ângulos diferentes: **onde o mundo termina, e se dá para ver que
// ele termina**. O 1093 já estava entregue pelas camadas verticais e é auditado aqui, porque um
// item resolvido de lado continua parecendo pendente até alguém provar que não está.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  neblinaDeAltitude,
  misturaDoHorizonte,
  NEBLINA_DE_VALE,
  NEBLINA_DE_PICO,
  ALTITUDE_MAIS_LIMPA_M,
  ALCANCE_DO_HORIZONTE,
} from '../../src/render/neblina';
import { NIVEL_DO_MAR_M } from '../../src/world/worldgen';
import { CAMADAS, ambienteDaProfundidade } from '../../src/world/camadas';

describe('o vale tem neblina e o pico não — item 1092', () => {
  it('CRÍTICO: subir abre o horizonte, monotonicamente', () => {
    // Se uma cota mais alta fechasse a névoa, subir pareceria descer — e a escalada, que já custa
    // tempo e comida, deixaria de pagar a única coisa que ela tem para dar.
    let anterior = -Infinity;
    for (let m = 20; m <= 110; m += 2) {
      const v = neblinaDeAltitude(m);
      expect(v, `${m} m`).toBeGreaterThanOrEqual(anterior - 1e-9);
      anterior = v;
    }
  });

  it('CRÍTICO: o pico enxerga sensivelmente mais longe que o fundo do vale', () => {
    // Uma diferença pequena demais é indistinguível de ruído, e o sistema inteiro não faria nada
    // além de custar uma multiplicação por quadro.
    const vale = neblinaDeAltitude(NIVEL_DO_MAR_M);
    const pico = neblinaDeAltitude(ALTITUDE_MAIS_LIMPA_M + 20);
    expect(pico / vale).toBeGreaterThan(1.4);
  });

  it('CRÍTICO: afundar abaixo do mar não continua fechando', () => {
    // Sem o piso, quem nada numa fossa perderia a visão inteira — e nada avisaria, porque o
    // multiplicador continuaria sendo um número válido.
    expect(neblinaDeAltitude(NIVEL_DO_MAR_M - 40)).toBe(NEBLINA_DE_VALE);
    expect(neblinaDeAltitude(-500)).toBe(NEBLINA_DE_VALE);
  });

  it('acima do teto de altitude não continua abrindo', () => {
    expect(neblinaDeAltitude(ALTITUDE_MAIS_LIMPA_M)).toBeCloseTo(NEBLINA_DE_PICO, 6);
    expect(neblinaDeAltitude(10000)).toBe(NEBLINA_DE_PICO);
  });

  it('a rampa é suave nas duas pontas — subir uma escada não denuncia o efeito', () => {
    // Uma rampa linear tem um vinco no começo e outro no fim, e o olho pega vincos.
    const d = (m: number) => neblinaDeAltitude(m + 0.5) - neblinaDeAltitude(m - 0.5);
    expect(Math.abs(d(NIVEL_DO_MAR_M + 0.6))).toBeLessThan(Math.abs(d(NIVEL_DO_MAR_M + 13)));
    expect(Math.abs(d(ALTITUDE_MAIS_LIMPA_M - 0.6))).toBeLessThan(Math.abs(d(NIVEL_DO_MAR_M + 13)));
  });

  it('a faixa útil cobre o relevo que o mundo de fato gera', () => {
    // O terreno vai de ~41 a ~64 m. Se a faixa começasse acima disso, o efeito existiria e nunca
    // seria visto — o modo de falha do item 029, que apontava para um teto que ninguém tocava.
    expect(NIVEL_DO_MAR_M).toBeLessThan(50);
    expect(ALTITUDE_MAIS_LIMPA_M).toBeLessThan(80);
    expect(neblinaDeAltitude(64)).toBeGreaterThan(neblinaDeAltitude(45) * 1.15);
  });
});

describe('o mundo não termina numa linha — item 1091', () => {
  it('CRÍTICO: no horizonte a cor do céu é INTEIRAMENTE a da névoa', () => {
    // Qualquer valor abaixo de 1 deixa uma diferença residual entre duas superfícies grandes e
    // lisas, que é justamente o que o olho detecta melhor. A borda tem de sumir, não ficar sutil.
    expect(misturaDoHorizonte(0)).toBe(1);
  });

  it('CRÍTICO: o zênite não é tingido — o deserto não ganha um céu cor de areia', () => {
    // Trocar uma borda visível por um céu da cor errada seria um erro maior que o original.
    expect(misturaDoHorizonte(1)).toBe(0);
    expect(misturaDoHorizonte(0.5)).toBe(0);
  });

  it('a mistura cai a zero suavemente, sem um segundo degrau onde ela acaba', () => {
    // Um corte abrupto no fim da rampa só move a borda visível para outra altura do céu.
    let anterior = 1;
    for (let t = 0; t <= 0.3; t += 0.01) {
      const v = misturaDoHorizonte(t);
      expect(v).toBeLessThanOrEqual(anterior + 1e-9);
      anterior = v;
    }
    // Perto do fim da rampa a derivada já é pequena.
    expect(misturaDoHorizonte(0.20) - misturaDoHorizonte(0.21)).toBeLessThan(0.02);
  });

  it('entradas fora de faixa não estouram', () => {
    expect(misturaDoHorizonte(-1)).toBe(1);
    expect(misturaDoHorizonte(50)).toBe(0);
  });
});

describe('a caverna fecha independente do bioma lá de cima — item 1093', () => {
  it('CRÍTICO: no fundo, a névoa é a da camada e nada do bioma sobrevive', () => {
    // A mistura de `main.ts` é `bioma + (camada - bioma) * dentroDaTerra`. Com `dentroDaTerra = 1`
    // o termo do bioma cancela por completo — é o que faz uma caverna sob o deserto ser tão fechada
    // quanto uma caverna sob o pântano.
    const misturar = (a: number, b: number, t: number) => a + (b - a) * t;
    const fundo = ambienteDaProfundidade(30);
    for (const alcanceDoBioma of [0.5, 1, 1.6]) {
      expect(misturar(alcanceDoBioma, fundo.alcance, 1)).toBeCloseTo(fundo.alcance, 9);
    }
  });

  it('CRÍTICO: a caverna fecha mais que qualquer bioma de superfície', () => {
    // Se o bioma mais fechado do mundo já fosse mais denso que a caverna, descer abriria o
    // horizonte — e a camada perderia o principal sinal que ela tem.
    const caverna = CAMADAS.find((c) => c.id === 'caverna')!;
    expect(caverna.alcanceNeblina).toBeLessThan(NEBLINA_DE_VALE);
  });
});

describe('a fiação existe — código presente não é código ativo', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  const cena = readFileSync('src/render/scene.ts', 'utf8');
  const ceu = readFileSync('src/render/sky.ts', 'utf8');

  it('CRÍTICO: a altitude entra SÓ no lado do bioma da mistura', () => {
    // Aplicá-la depois da mistura faria a caverna de um vale ser mais fechada que a caverna de um
    // pico, na mesma profundidade e pelo motivo errado. O parêntese é a regra inteira.
    expect(main).toMatch(/misturarEscalar\(pesosBioma, 'alcanceNeblina'\) \* neblinaDeAltitude\(/);
  });

  it('CRÍTICO: a cor da névoa chega à cúpula do céu', () => {
    expect(cena).toMatch(/sky\.update\([^)]*fog\?\.color\)/s);
    expect(ceu).toMatch(/uHorizonte\.value as THREE\.Color\)\s*\.copy\(corNeblina/);
  });

  it('CRÍTICO: a cúpula desenha primeiro e não escreve profundidade', () => {
    // Escrever profundidade ocultaria sol, lua e estrelas mesmo estando atrás deles; desenhar
    // depois do terreno pintaria por cima do mundo. As duas coisas juntas são o que a faz um fundo.
    expect(ceu).toMatch(/this\.cupula\.renderOrder = -3;/);
    expect(ceu).toMatch(/depthWrite: false,\n\s*fog: false,/);
  });

  it('a cúpula NÃO desliga o teste de profundidade', () => {
    // O cabeçalho do `sky.ts` registra o relato "as estrelas e a lua aparecem por dentro das
    // árvores", que foi exatamente isto. Desenhando primeiro ela não precisa da folga.
    const bloco = ceu.slice(ceu.indexOf('materialCupula = new THREE.ShaderMaterial'), ceu.indexOf('this.cupula = new THREE.Mesh'));
    expect(bloco).not.toMatch(/depthTest:\s*false/);
  });
});

describe('a regra do horizonte existe em TS e em GLSL — a faixa não pode divergir', () => {
  const ceu = readFileSync('src/render/sky.ts', 'utf8');

  it('CRÍTICO: o shader recebe o alcance por uniform, não escrito à mão', () => {
    // Duas cópias de uma regra divergem. O formato pode divergir em silêncio — nenhum teste aqui
    // compila shader —, mas a faixa decide **se o efeito aparece**, e essa não pode.
    expect(ceu).toMatch(/uAlcance: \{ value: ALCANCE_DO_HORIZONTE \}/);
    expect(ceu).toMatch(/import \{ ALCANCE_DO_HORIZONTE \} from '\.\/neblina'/);
  });

  it('o GLSL usa o uniform, e não o número', () => {
    expect(ceu).toMatch(/abs\(vDir\.y\) \/ uAlcance/);
    expect(ceu).not.toMatch(/vDir\.y\) \/ 0\.22/);
  });

  it('a faixa é estreita o bastante para o zênite não ser tingido', () => {
    // Acima de ~0,4 o gradiente alcançaria metade do céu e o deserto ganharia um céu de areia.
    expect(ALCANCE_DO_HORIZONTE).toBeLessThan(0.35);
    expect(ALCANCE_DO_HORIZONTE).toBeGreaterThan(0.05);
  });
});
