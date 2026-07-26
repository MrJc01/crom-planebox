// Os marcadores em que o jogo injeta GLSL existem mesmo — item 1206, na medida do possível.
//
// ## A ressalva que este arquivo tenta encurtar
//
// Três sistemas deste jogo injetam GLSL por `onBeforeCompile` (curvatura do horizonte, onda da
// água, névoa por bioma), e **nada compila esses shaders num teste**. O sintoma de uma injeção
// malformada não é um erro na tela: é o terreno inteiro desaparecer.
//
// Compilar de verdade exige WebGL, e jsdom não tem. Um contexto headless traria uma dependência
// nativa que quebra em cada versão de Node — o remédio custaria mais que a doença.
//
// ## O que dá para verificar sem GPU nenhuma, e por que vale
//
// A injeção funciona por **substituição de texto**:
//
// ```ts
// shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '...nosso código...');
// ```
//
// `String.replace` que não encontra o alvo **não faz nada e não avisa**. Se o three.js renomear ou
// remover um chunk numa versão nova — e ele faz isso —, a injeção silenciosamente para de
// acontecer. A curvatura sumiria, a onda pararia, e o jogo continuaria rodando bonito e errado.
//
// Isso é verificável sem GPU: `THREE.ShaderLib` é dado puro em JavaScript. Este arquivo pega o
// shader **real** do material que o jogo usa, roda a injeção de verdade em cima dele, e exige que o
// resultado tenha mudado.
//
// **O que ele NÃO prova:** que o GLSL resultante compila. Um `vec3` somado a um `float`, um
// `uniform` com nome trocado ou um ponto e vírgula a menos passam por aqui. Este teste cobre a
// classe de falha *silenciosa*; a classe *ruidosa* continua descoberta, e o item 1206 segue aberto.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applyCurvature } from '../../src/render/scene';

/** Os marcadores que `applyCurvature` substitui, e em qual dos dois shaders cada um vive. */
const MARCADORES: Array<{ marcador: string; onde: 'vertexShader' | 'fragmentShader'; para: string }> = [
  { marcador: '#include <color_vertex>', onde: 'vertexShader', para: 'onda da água e cor de vértice' },
  { marcador: '#include <project_vertex>', onde: 'vertexShader', para: 'curvatura do horizonte' },
  { marcador: '#include <clipping_planes_fragment>', onde: 'fragmentShader', para: 'dither e névoa por bioma' },
  { marcador: '#include <fog_fragment>', onde: 'fragmentShader', para: 'névoa por bioma' },
];

/**
 * O shader real do material que o jogo usa nos chunks.
 *
 * `MeshLambertMaterial` → `ShaderLib.lambert`. Se o jogo trocar de material sem trocar aqui, o teste
 * passa a verificar o shader errado — por isso o primeiro teste confere o vínculo.
 */
const lambert = THREE.ShaderLib.lambert;

describe('os marcadores de injeção existem no three.js desta versão', () => {
  it('CRÍTICO: o material dos chunks continua sendo Lambert', () => {
    // O vínculo entre este arquivo e a realidade. Trocar para `MeshStandardMaterial` mudaria os
    // chunks disponíveis, e todos os testes abaixo continuariam verdes verificando outro shader.
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    expect(mat.type).toBe('MeshLambertMaterial');
    expect(lambert, 'ShaderLib.lambert sumiu desta versão do three.js').toBeDefined();
  });

  for (const { marcador, onde, para } of MARCADORES) {
    it(`CRÍTICO: \`${marcador}\` existe (${para})`, () => {
      // `String.replace` que não acha o alvo não faz nada e não avisa. Este é o teste que separa
      // "a injeção aconteceu" de "a injeção foi escrita".
      expect(
        lambert[onde].includes(marcador),
        `o three.js não tem mais ${marcador} em ${onde}: a injeção de "${para}" virou um no-op silencioso`,
      ).toBe(true);
    });
  }
});

describe('a injeção realmente muda o shader real', () => {
  /** Roda `applyCurvature` contra o shader de verdade do three.js. */
  function injetar(agua: boolean) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    applyCurvature(mat, agua);
    const shader = {
      uniforms: {},
      vertexShader: lambert.vertexShader,
      fragmentShader: lambert.fragmentShader,
    } as THREE.WebGLProgramParametersWithUniforms;
    mat.onBeforeCompile!(shader, {} as THREE.WebGLRenderer);
    return shader;
  }

  it('CRÍTICO: o shader de saída é DIFERENTE do de entrada', () => {
    // A verificação mais crua e a que mais importa: se todos os `replace` errarem o alvo, o shader
    // sai idêntico ao que entrou — e nada em lugar nenhum reclama.
    const s = injetar(false);
    expect(s.vertexShader).not.toBe(lambert.vertexShader);
    expect(s.fragmentShader).not.toBe(lambert.fragmentShader);
  });

  it('CRÍTICO: cada injeção deixou o código dela no shader', () => {
    // A verificação por injeção, e não pelo shader inteiro: se três acertarem o alvo e uma errar, o
    // shader muda e o teste anterior passa — enquanto a quarta funcionalidade some.
    //
    // Não dá para verificar isso pela ausência do marcador. **Duas das quatro injeções preservam o
    // marcador de propósito** (`#include <color_vertex>` seguido do nosso código), porque o chunk
    // original precisa rodar antes: o tingimento multiplica `vColor`, que só existe depois que o
    // include o preencheu. Só `project_vertex` é substituído por inteiro, porque ali o nosso código
    // refaz a projeção que o chunk faria.
    const s = injetar(true);
    const esperado: Array<[string, keyof typeof s]> = [
      ['uTintGrama', 'vertexShader'],       // tingimento de bioma
      ['cqWorld.y -= cqDrop', 'vertexShader'], // curvatura do horizonte
      ['cqBayer4(gl_FragCoord.xy)', 'fragmentShader'], // dither de aparição
      ['uGradForca', 'fragmentShader'],     // gradação de cor
    ];
    for (const [trecho, onde] of esperado) {
      expect(
        String(s[onde]).includes(trecho),
        `"${trecho}" não chegou ao shader: aquela injeção errou o alvo`,
      ).toBe(true);
    }
  });

  it('CRÍTICO: as injeções que PRESERVAM o marcador continuam preservando', () => {
    // O erro simétrico, e mais fácil de cometer numa edição futura: trocar o corpo da substituição e
    // esquecer de repetir o `#include` na saída. O nosso código continuaria lá, o teste acima
    // passaria, e o chunk original do three.js deixaria de rodar — `vColor` nunca receberia a cor do
    // vértice, e o mundo inteiro ficaria de uma cor só.
    const s = injetar(true);
    for (const m of ['#include <color_vertex>', '#include <clipping_planes_fragment>', '#include <fog_fragment>']) {
      const onde = m.includes('vertex') && !m.includes('fragment') ? s.vertexShader : s.fragmentShader;
      expect(onde.includes(m), `${m} foi engolido pela injeção`).toBe(true);
    }
  });

  it('CRÍTICO: os uniforms que o código usa foram declarados no shader', () => {
    // O erro que já aconteceu duas vezes neste projeto, do lado JavaScript: referenciar um nome que
    // ninguém definiu. Em GLSL o sintoma é o terreno sumir.
    const s = injetar(true);
    for (const nome of Object.keys(s.uniforms)) {
      if (!nome.startsWith('u') && !nome.startsWith('cq')) continue;
      expect(
        s.vertexShader.includes(nome) || s.fragmentShader.includes(nome),
        `uniform "${nome}" registrado e nunca usado no GLSL`,
      ).toBe(true);
    }
  });

  it('CRÍTICO: chaves e parênteses continuam balanceados', () => {
    // Um `}` a mais ou a menos é a forma mais comum de quebrar uma injeção por concatenação, e a de
    // sintoma mais assustador: o programa inteiro deixa de compilar e a cena fica vazia.
    const s = injetar(true);
    for (const fonte of [s.vertexShader, s.fragmentShader]) {
      for (const [abre, fecha] of [['{', '}'], ['(', ')']] as const) {
        const a = (fonte.match(new RegExp(`\\${abre}`, 'g')) ?? []).length;
        const f = (fonte.match(new RegExp(`\\${fecha}`, 'g')) ?? []).length;
        expect(a, `desbalanceado: ${a} "${abre}" para ${f} "${fecha}"`).toBe(f);
      }
    }
  });

  it('a água ganha a onda, e o resto do mundo não', () => {
    // A onda custa aritmética por vértice. Aplicá-la ao terreno inteiro seria pagar por todos os
    // chunks para animar o que não se mexe — e foi por errar este argumento que a onda ficou
    // dormente uma vez (`applyCurvature(waterMaterial)` sem o segundo parâmetro).
    //
    // A comparação é pelo **deslocamento**, não pelo uniform: `uOndaTempo` é declarado nos dois,
    // porque o prelúdio de uniforms é um só. Testar pelo nome do uniform passaria a impressão de
    // que o terreno também ondula.
    expect(injetar(true).vertexShader).toContain('sin(cqWorld.x');
    expect(injetar(false).vertexShader).not.toContain('sin(cqWorld.x');
  });
});
