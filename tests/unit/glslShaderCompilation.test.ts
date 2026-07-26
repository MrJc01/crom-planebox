import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Sky } from '../../src/render/sky';
import { applyCurvature } from '../../src/render/scene';

describe('GLSL Shader Compilation & Verification (Item 1178)', () => {
  it('deve inicializar Sky sem lançar erro de uniform ou sintoma GLSL', () => {
    expect(() => {
      const sky = new Sky(0x1234);
      sky.dispose();
    }).not.toThrow();
  });

  it('deve injetar a curvatura e onda no shader de um material de chunk sem erros de sintaxe', () => {
    const mat = new THREE.MeshLambertMaterial({ color: 0x38bdf8 });
    applyCurvature(mat, true);

    const dummyShader: THREE.WebGLProgramParametersWithUniforms = {
      uniforms: {},
      vertexShader: `
        void main() {
          #include <color_vertex>
          #include <project_vertex>
        }
      `,
      fragmentShader: `
        void main() {
          #include <clipping_planes_fragment>
          #include <fog_fragment>
        }
      `,
    };

    expect(() => {
      mat.onBeforeCompile(dummyShader, {} as THREE.WebGLRenderer);
    }).not.toThrow();

    expect(dummyShader.vertexShader).toContain('uOndaTempo');
    expect(dummyShader.vertexShader).toContain('cqWorld');
    expect(dummyShader.fragmentShader).toContain('cqBayer4');
    expect(dummyShader.fragmentShader).toContain('uGradSat');
  });

  it('deve garantir que todos os uniforms declarados na curvatura estejam devidamente preenchidos', () => {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    applyCurvature(mat, false);

    const dummyShader: THREE.WebGLProgramParametersWithUniforms = {
      uniforms: {},
      vertexShader: '#include <color_vertex>\n#include <project_vertex>',
      fragmentShader: '#include <clipping_planes_fragment>\n#include <fog_fragment>',
    };

    mat.onBeforeCompile(dummyShader, {} as THREE.WebGLRenderer);

    expect(dummyShader.uniforms.uCurvStart).toBeDefined();
    expect(dummyShader.uniforms.uCurvInvR).toBeDefined();
    expect(dummyShader.uniforms.uOndaTempo).toBeDefined();
    expect(dummyShader.uniforms.uMolhado).toBeDefined();
    expect(dummyShader.uniforms.uGradSat).toBeDefined();
    expect(dummyShader.uniforms.uGradCon).toBeDefined();
  });
});
