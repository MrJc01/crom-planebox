// Céu noturno: estrelas e lua.
//
// Duas decisões de implementação que valem explicar:
//
//  1. **As estrelas são uma cúpula presa à câmera**, não objetos no mundo. Estrela é
//     infinitamente distante — se ficasse parada no espaço do mundo, andar mudaria a posição
//     dela no céu, que é exatamente o que não acontece na realidade.
//  2. **Um único `Points` com 1.500 vértices**, e não 1.500 objetos. A diferença é entre uma
//     chamada de desenho e mil e quinhentas.
//
// A posição das estrelas vem da semente do mundo: dois jogadores no mesmo mundo veem o mesmo
// céu, e o mesmo mundo reaberto tem o mesmo céu.

import * as THREE from 'three';
import { iluminacaoDaFase } from '../world/moon';

const ESTRELAS = 1500;
/** Raio da cúpula. Grande o bastante para ficar atrás de tudo, dentro do alcance da câmera. */
const RAIO_CEU = 900;

export class Sky {
  readonly grupo = new THREE.Group();
  private estrelas: THREE.Points;
  private materialEstrelas: THREE.PointsMaterial;
  private lua: THREE.Mesh;
  private materialLua: THREE.MeshBasicMaterial;
  /** Disco escuro que cobre parte da lua para formar a fase. */
  private sombraLua: THREE.Mesh;

  constructor(semente: number) {
    this.grupo.renderOrder = -1; // desenhado antes do mundo

    // --- Estrelas ---
    const posicoes = new Float32Array(ESTRELAS * 3);
    const tamanhos = new Float32Array(ESTRELAS);
    let h = semente >>> 0;
    const rnd = () => {
      // Gerador simples e determinístico: o céu precisa ser o mesmo em toda sessão.
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
      return h / 4294967296;
    };

    for (let i = 0; i < ESTRELAS; i++) {
      // Distribuição uniforme na esfera. Sortear latitude direto acumularia estrelas nos polos.
      const u = rnd() * 2 - 1;
      const theta = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      // Só o hemisfério superior: metade das estrelas debaixo do terreno seria desperdício.
      const y = Math.abs(u);
      posicoes[i * 3] = Math.cos(theta) * r * RAIO_CEU;
      posicoes[i * 3 + 1] = y * RAIO_CEU;
      posicoes[i * 3 + 2] = Math.sin(theta) * r * RAIO_CEU;
      tamanhos[i] = 1 + rnd() * 2.2;
    }

    const geoEstrelas = new THREE.BufferGeometry();
    geoEstrelas.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));
    geoEstrelas.setAttribute('size', new THREE.BufferAttribute(tamanhos, 1));

    this.materialEstrelas = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      // Sem profundidade: a cúpula está atrás de tudo por construção, e testar profundidade
      // faria as estrelas sumirem atrás da névoa.
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.estrelas = new THREE.Points(geoEstrelas, this.materialEstrelas);
    this.grupo.add(this.estrelas);

    // --- Lua ---
    this.materialLua = new THREE.MeshBasicMaterial({ color: 0xf3f4f6, fog: false, depthTest: false, transparent: true });
    this.lua = new THREE.Mesh(new THREE.CircleGeometry(34, 32), this.materialLua);
    this.lua.renderOrder = -1;

    // A fase é feita cobrindo o disco com outro disco da cor do céu, deslocado. É a mesma
    // solução de um eclipse desenhado à mão, e evita precisar de textura.
    this.sombraLua = new THREE.Mesh(
      new THREE.CircleGeometry(34, 32),
      new THREE.MeshBasicMaterial({ color: 0x05070d, fog: false, depthTest: false, transparent: true }),
    );
    this.sombraLua.position.z = 0.5;
    this.sombraLua.renderOrder = -1;
    this.lua.add(this.sombraLua);
    this.grupo.add(this.lua);
  }

  /**
   * Atualiza o céu.
   *
   * `sunElevation` vai de -1 (meia-noite) a 1 (meio-dia): as estrelas surgem quando ela fica
   * negativa, e a transição é suave para o céu não "acender" de um quadro para o outro.
   */
  public update(camera: THREE.Camera, sunAngle: number, sunElevation: number, fase: number): void {
    // A cúpula acompanha a câmera: estrela não muda de lugar quando o jogador anda.
    this.grupo.position.copy(camera.position);

    // Visíveis do crepúsculo em diante, com margem para a transição.
    const visibilidade = Math.max(0, Math.min(1, -sunElevation * 2.2 + 0.35));
    const iluminacao = iluminacaoDaFase(fase);

    // Lua cheia apaga as estrelas fracas, como na realidade.
    this.materialEstrelas.opacity = visibilidade * (1 - iluminacao * 0.35);
    this.estrelas.visible = this.materialEstrelas.opacity > 0.01;

    // A lua fica oposta ao sol: quando um se põe, o outro nasce.
    const anguloLua = sunAngle + Math.PI;
    const altura = Math.cos(anguloLua - Math.PI);
    this.lua.position.set(
      Math.sin(anguloLua - Math.PI) * RAIO_CEU * 0.72,
      altura * RAIO_CEU * 0.72,
      RAIO_CEU * 0.28,
    );
    this.lua.lookAt(this.grupo.position);

    this.materialLua.opacity = visibilidade;
    this.lua.visible = visibilidade > 0.01;

    // Deslocamento da sombra: centrada esconde tudo (nova), longe não esconde nada (cheia).
    // O sinal inverte na metade do ciclo, para o lado iluminado trocar como na realidade.
    const f = ((fase % 8) + 8) % 8;
    const desloca = (1 - iluminacao) * 62;
    this.sombraLua.position.x = f < 4 ? desloca : -desloca;
  }

  public dispose(): void {
    this.estrelas.geometry.dispose();
    this.materialEstrelas.dispose();
    this.lua.geometry.dispose();
    this.materialLua.dispose();
    (this.sombraLua.material as THREE.Material).dispose();
    this.sombraLua.geometry.dispose();
  }
}
