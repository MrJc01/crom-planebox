// As injeções de shader falham EM SILÊNCIO, e é por isso que este arquivo existe.
//
// `applyCurvature` monta curvatura, tingimento sazonal e aparição de chunk substituindo trechos
// do shader do three.js: `#include <project_vertex>`, `#include <color_vertex>` e
// `#include <clipping_planes_fragment>`. Se qualquer um desses nomes mudar numa atualização do
// three.js, `String.replace` simplesmente **não faz nada** e devolve o shader intacto. Nenhum
// erro, nenhum aviso: a curvatura para de curvar, o outono para de pintar, o chunk aparece seco.
//
// Este projeto já teve três funcionalidades completas que nunca rodaram (`setViewRange`,
// `applyCurvature`, `UndoManager.recordBatch`). Um teste que compila de verdade exigiria WebGL;
// este verifica o que dá para verificar sem GPU — que os pontos de injeção existem e que o código
// injetado chegou ao shader.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applyCurvature, curvature, gradacaoUniforms, tinturas } from '../../src/render/scene';

/**
 * Reconstrói o que o three.js entrega ao `onBeforeCompile`: o shader do material com os
 * `#include` ainda por resolver. É exatamente essa a forma em que as substituições agem.
 */
function shaderCru(): { vertexShader: string; fragmentShader: string; uniforms: any } {
  const lib = THREE.ShaderLib.lambert;
  return {
    vertexShader: lib.vertexShader,
    fragmentShader: lib.fragmentShader,
    uniforms: {},
  };
}

function compilar(): { vertexShader: string; fragmentShader: string; uniforms: any } {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  applyCurvature(mat);
  const shader = shaderCru();
  expect(typeof mat.onBeforeCompile).toBe('function');
  (mat.onBeforeCompile as any)(shader, null);
  return shader;
}

describe('pontos de injeção — se um sumir, o efeito some junto', () => {
  it('CRÍTICO: os três `#include` que servem de âncora existem no shader do three.js', () => {
    // Este é o teste que avisa numa atualização do three.js. Sem ele, a descoberta seria
    // "a curvatura parou de funcionar" semanas depois, sem nada apontando para a causa.
    const { vertexShader, fragmentShader } = shaderCru();
    expect(vertexShader).toContain('#include <project_vertex>');
    expect(vertexShader).toContain('#include <color_vertex>');
    expect(fragmentShader).toContain('#include <clipping_planes_fragment>');
    expect(fragmentShader).toContain('#include <fog_fragment>');
  });
});

describe('gradação de cor', () => {
  it('CRÍTICO: a gradação chega ao fragment shader', () => {
    const { fragmentShader } = compilar();
    expect(fragmentShader).toContain('uGradForca');
    expect(fragmentShader).toContain('uGradSat');
    expect(fragmentShader).toContain('gl_FragColor.rgb = mix(');
  });

  it('CRÍTICO: a gradação vem DEPOIS da névoa', () => {
    // Antes dela, a névoa entraria sem gradar e o horizonte destoaria do terreno — exatamente
    // no ponto onde os dois se encontram, que é o mais visível de todos.
    const { fragmentShader } = compilar();
    // Compara com o USO, não com o nome: a declaração `uniform float uGradForca;` fica no topo
    // do arquivo, antes de tudo, e compará-la daria um falso negativo — foi o que este teste
    // acusou na primeira escrita.
    expect(fragmentShader.indexOf('#include <fog_fragment>')).toBeLessThan(
      fragmentShader.indexOf('if (uGradForca > 0.001)'),
    );
  });

  it('usa luminância perceptual, não a média dos canais', () => {
    // A média deixaria o verde da vegetação escuro demais ao dessaturar: o olho é mais sensível
    // a ele, e é por isso que o coeficiente do verde é 0,7152.
    const { fragmentShader } = compilar();
    expect(fragmentShader).toContain('vec3(0.2126, 0.7152, 0.0722)');
  });

  it('é guardada por uma checagem de força — desligada, custa uma comparação', () => {
    const { fragmentShader } = compilar();
    expect(fragmentShader).toContain('if (uGradForca > 0.001)');
  });

  it('nunca deixa canal negativo chegar ao alvo', () => {
    // O contraste pode empurrar abaixo de zero; sem o `max` isso vira comportamento indefinido.
    const { fragmentShader } = compilar();
    expect(fragmentShader).toContain('max(cqC, vec3(0.0))');
  });

  it('os uniforms de gradação são os objetos compartilhados', () => {
    const { uniforms } = compilar();
    expect(uniforms.uGradSat).toBe(gradacaoUniforms.saturacao);
    expect(uniforms.uGradForca).toBe(gradacaoUniforms.forca);
    expect(uniforms.uGradSombra).toBe(gradacaoUniforms.sombra);
  });

  it('começa desligada — quem liga é o `main`, com a predefinição escolhida', () => {
    expect(gradacaoUniforms.forca.value).toBe(0);
  });
});

describe('curvatura do mundo', () => {
  it('CRÍTICO: o código de curvatura chega ao shader', () => {
    const { vertexShader } = compilar();
    expect(vertexShader).toContain('uCurvInvR');
    expect(vertexShader).toContain('cqDrop * cqDrop * uCurvInvR');
    // O `project_vertex` foi SUBSTITUÍDO, não apenas acompanhado: se ele continuasse ali,
    // `gl_Position` seria calculado duas vezes e a curvatura seria sobrescrita.
    expect(vertexShader).not.toContain('#include <project_vertex>');
  });

  it('os uniforms de curvatura são os objetos compartilhados, não cópias', () => {
    // Se fossem cópias, mudar `curvature.invR.value` não teria efeito nenhum na tela — que é
    // exatamente o defeito que este projeto já teve uma vez.
    const { uniforms } = compilar();
    expect(uniforms.uCurvStart).toBe(curvature.start);
    expect(uniforms.uCurvInvR).toBe(curvature.invR);
  });

  it('a declaração dos uniforms vem antes do uso', () => {
    const { vertexShader } = compilar();
    expect(vertexShader.indexOf('uniform float uCurvInvR;')).toBeLessThan(
      vertexShader.indexOf('cqDrop * cqDrop * uCurvInvR'),
    );
  });
});

describe('tingimento sazonal', () => {
  it('CRÍTICO: o tingimento chega ao shader e é multiplicativo', () => {
    const { vertexShader } = compilar();
    expect(vertexShader).toContain('uTintFolhagem');
    expect(vertexShader).toContain('uTintGrama');
    // Multiplicar preserva a luz e a oclusão já assadas na cor do vértice. Somar ou atribuir
    // apagaria o relevo — a folha de pinheiro viraria laranja em vez de escurecer.
    expect(vertexShader).toContain('vColor.rgb *= uTintFolhagem');
    expect(vertexShader).toContain('vColor.rgb *= uTintGrama');
  });

  it('o atributo por vértice é declarado', () => {
    const { vertexShader } = compilar();
    expect(vertexShader).toContain('attribute float aTint;');
  });

  it('o tingimento entra DEPOIS de color_vertex, onde vColor já tem a cor', () => {
    const { vertexShader } = compilar();
    // O include continua no lugar: aqui a injeção é um acréscimo, não uma substituição.
    expect(vertexShader).toContain('#include <color_vertex>');
    expect(vertexShader.indexOf('#include <color_vertex>')).toBeLessThan(
      vertexShader.indexOf('vColor.rgb *= uTintFolhagem'),
    );
  });

  it('está guardado por USE_COLOR — sem cores de vértice, `vColor` não existe', () => {
    const { vertexShader } = compilar();
    const i = vertexShader.indexOf('vColor.rgb *= uTintFolhagem');
    const antes = vertexShader.slice(Math.max(0, i - 300), i);
    expect(antes).toContain('#ifdef USE_COLOR');
  });

  it('os uniforms de tintura são os objetos compartilhados', () => {
    const { uniforms } = compilar();
    expect(uniforms.uTintFolhagem).toBe(tinturas.folhagem);
    expect(uniforms.uTintGrama).toBe(tinturas.grama);
    expect(uniforms.uMolhado).toBe(tinturas.molhado);
  });
});

describe('aparição de chunk por descarte', () => {
  it('CRÍTICO: o descarte chega ao fragment shader', () => {
    const { fragmentShader } = compilar();
    expect(fragmentShader).toContain('uniform float uFade;');
    expect(fragmentShader).toContain('discard');
    expect(fragmentShader).toContain('cqBayer4(gl_FragCoord.xy)');
  });

  it('CRÍTICO: nada de array com índice dinâmico — não é portátil em WebGL1', () => {
    const { fragmentShader } = compilar();
    expect(fragmentShader).not.toContain('cqBayer[');
  });

  it('as funções auxiliares são declaradas antes do uso', () => {
    const { fragmentShader } = compilar();
    expect(fragmentShader.indexOf('float cqBayer4(vec2 a)')).toBeLessThan(
      fragmentShader.indexOf('cqBayer4(gl_FragCoord.xy)'),
    );
    expect(fragmentShader.indexOf('float cqBayer2(vec2 a)')).toBeLessThan(
      fragmentShader.indexOf('float cqBayer4(vec2 a)'),
    );
  });

  it('cada material tem o PRÓPRIO uFade — o progresso é por chunk', () => {
    // Compartilhar este uniform faria todos os chunks aparecerem com o mesmo progresso, e o
    // escalonamento de `FadeAgenda` não teria efeito visível nenhum.
    const a = new THREE.MeshLambertMaterial({ vertexColors: true });
    const b = new THREE.MeshLambertMaterial({ vertexColors: true });
    applyCurvature(a);
    applyCurvature(b);
    expect((a as any).uFade).not.toBe((b as any).uFade);
    (a as any).uFade.value = 0.3;
    expect((b as any).uFade.value).toBe(1);
  });

  it('o material começa visível — um erro de contabilidade não pode apagar o terreno', () => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true });
    applyCurvature(m);
    expect((m as any).uFade.value).toBe(1);
  });
});

describe('um onBeforeCompile só', () => {
  it('CRÍTICO: os três efeitos convivem no mesmo material', () => {
    // O three.js guarda UM `onBeforeCompile` por material: uma segunda atribuição apagaria a
    // primeira em silêncio. O sintoma seria "a curvatura parou quando o outono chegou".
    const { vertexShader, fragmentShader } = compilar();
    expect(vertexShader).toContain('uCurvInvR');
    expect(vertexShader).toContain('uTintFolhagem');
    expect(fragmentShader).toContain('uFade');
  });

  it('a chave de cache do programa é estável — não recompila por material', () => {
    const a = new THREE.MeshLambertMaterial({ vertexColors: true });
    const b = new THREE.MeshLambertMaterial({ vertexColors: true });
    applyCurvature(a);
    applyCurvature(b);
    expect(a.customProgramCacheKey!()).toBe(b.customProgramCacheKey!());
  });
});
