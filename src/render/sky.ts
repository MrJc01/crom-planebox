// Céu: sol, lua com fases, estrelas e nuvens.
//
// ## Três decisões de implementação
//
//  1. **Tudo é uma cúpula presa à câmera**, não objetos no mundo. Corpo celeste é
//     infinitamente distante — se ficasse parado no espaço do mundo, andar mudaria a posição
//     dele no céu, que é exatamente o que não acontece na realidade.
//  2. **Um único `Points` com 1.500 vértices** para as estrelas, e não 1.500 objetos. A
//     diferença é entre uma chamada de desenho e mil e quinhentas.
//  3. **A profundidade é testada.** Ver o bloco logo abaixo — foi um defeito relatado.
//
// A posição das estrelas vem da semente do mundo: dois jogadores no mesmo mundo veem o mesmo
// céu, e o mesmo mundo reaberto tem o mesmo céu.
//
// ## O defeito do `depthTest: false`
//
// Estrelas e lua estavam com `depthTest: false`, e o sintoma relatado foi "as estrelas e a lua
// aparecem por dentro das árvores": sem teste de profundidade, o céu desenha por cima de tudo
// que já está na tela, inclusive do terreno que deveria estar na frente dele.
//
// O motivo original de desligar era evitar que a cúpula fosse recortada por estar longe demais.
// Mas o raio da cúpula (900) está muito dentro do plano distante da câmera (12000) — ela nunca
// foi recortada, e o `depthTest: false` só criava o problema que ele deveria evitar. Com o teste
// ligado e `depthWrite: false`, o céu é ocultado pelo mundo e não oculta nada: exatamente o que
// se espera de algo infinitamente distante.

import * as THREE from 'three';
import { iluminacaoDaFase } from '../world/moon';

const ESTRELAS = 1500;
/** Raio da cúpula. Grande o bastante para ficar atrás de tudo, dentro do alcance da câmera. */
const RAIO_CEU = 900;
// --- Nuvens ---------------------------------------------------------------------------------
//
// As nuvens são **blocos**, como o resto do mundo. A primeira versão foi um plano com ruído no
// shader, e o problema é o que se vê ao chegar perto: um plano não tem espessura. De cima ele
// some, de baixo é uma decalcomania, e voar até ele revela uma folha de papel. Num jogo de voxel
// isso destoa de tudo à volta.
//
// Aqui a nuvem ocupa volume numa grade grossa, e cada célula cheia vira um cubo translúcido. É
// consistente com o mundo: tem lado, tem topo, tem sombreado por face, e atravessar uma nuvem
// mostra os blocos passando pela câmera.

/** Altura da base das nuvens, em voxels de mundo. Acima do teto do terreno (128). */
const ALTURA_NUVENS = 158;
/** Aresta de um bloco de nuvem, em voxels. Grosso de propósito: nuvem não é detalhe fino. */
const CELULA = 12;
/** Células por lado da grade. `CELULA * GRADE` precisa cobrir a distância de névoa (~260). */
const GRADE = 44;
/** Camadas de espessura. Menos que 3 não lê como volume; mais custa instâncias à toa. */
const CAMADAS = 3;
const MAX_BLOCOS = GRADE * GRADE * CAMADAS;
/** Velocidade do vento, em voxels por segundo. É o que tira o céu da imobilidade. */
const VENTO = 2.6;

const BRANCO_NUVEM = new THREE.Color(0xffffff);
/** Cinza de chuva. Nuvem carregada não é branca — é essa a leitura de "vai chover". */
const CINZA_NUVEM = new THREE.Color(0x6b7280);

/** Ruído de valor determinístico, para a forma das nuvens. */
function hash2(x: number, z: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function ruido2(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  // Suavização cúbica: sem ela a interpolação linear deixa vincos retos visíveis na nuvem.
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm2(x: number, z: number): number {
  let v = 0, a = 0.5, fx = x, fz = z;
  for (let i = 0; i < 4; i++) {
    v += a * ruido2(fx, fz);
    fx *= 2.03; fz *= 2.03; a *= 0.5;
  }
  return v;
}

export class Sky {
  readonly grupo = new THREE.Group();

  private estrelas: THREE.Points;
  private materialEstrelas: THREE.PointsMaterial;

  private lua: THREE.Mesh;
  private materialLua: THREE.ShaderMaterial;

  private sol: THREE.Mesh;
  private materialSol: THREE.ShaderMaterial;

  private nuvens: THREE.InstancedMesh;
  private materialNuvens: THREE.MeshLambertMaterial;
  /** Limiar do ruído. Alto = pouca nuvem. Governado por `setCobertura`. */
  private limiarNuvem = 0.52;
  /** 0 = nuvem branca, 1 = cinza de tempestade. */
  private escuridaoNuvem = 0;
  /** Célula-âncora da última reconstrução, para não remontar a grade a cada quadro. */
  private ancora = { x: NaN, z: NaN, deriva: NaN };

  /** Direção do sol, reaproveitada a cada quadro para não alocar. */
  private dir = new THREE.Vector3();
  /** Matriz de instância reaproveitada — alocar uma por bloco por remontagem seria desperdício. */
  private mat4 = new THREE.Matrix4();

  constructor(semente: number) {
    // Desenhado antes da água e do vidro: o céu está atrás de tudo, e sem isto ele disputaria a
    // ordenação com os transparentes do mundo.
    this.grupo.renderOrder = -1;

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
      // `depthWrite: false` porque o céu não deve ocultar nada; `depthTest` LIGADO porque o mundo
      // deve ocultá-lo. Ver o cabeçalho deste arquivo.
      depthWrite: false,
      depthTest: true,
      fog: false,
    });
    this.estrelas = new THREE.Points(geoEstrelas, this.materialEstrelas);
    this.grupo.add(this.estrelas);

    // --- Lua ---
    //
    // ## Por que a fase virou shader
    //
    // Antes a fase era feita cobrindo o disco com um segundo disco da cor do céu, deslocado. Dois
    // defeitos vinham daí, e o relato "lua duplicada" é o segundo:
    //
    //  1. **O deslocamento estava invertido.** `(1 - iluminacao) * 62` põe a sombra centrada na
    //     lua CHEIA (que deveria estar limpa) e afastada na lua NOVA (que deveria estar coberta).
    //     O comentário no código descrevia o comportamento certo; a expressão fazia o oposto.
    //  2. **Dois discos não conseguem formar uma lua gibosa.** Dois círculos de mesmo raio, um
    //     sobre o outro, só recortam crescentes — a sombra sempre é côncava. Nas fases entre
    //     quarto e cheia, o disco escuro escapa da lua e vira um segundo círculo no céu.
    //
    // O terminador de verdade é uma elipse, e sai de uma linha de matemática: na altura `v` do
    // disco, a fronteira está em `x = k * sqrt(1 - v²)`, com `k = cos(ângulo da fase)`. Em lua
    // nova `k = 1` e a fronteira encosta na borda direita (nada aceso); em lua cheia `k = -1` e
    // encosta na esquerda (tudo aceso). Crescente e gibosa saem sozinhas do mesmo `k`.
    this.materialLua = new THREE.ShaderMaterial({
      uniforms: {
        uK: { value: -1 },
        uOpacidade: { value: 0 },
        uCor: { value: new THREE.Color(0xf3f4f6) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uK;
        uniform float uOpacidade;
        uniform vec3 uCor;
        varying vec2 vUv;
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 1.0) discard;
          // Terminador elíptico. Ver o comentário em sky.ts.
          float xt = uK * sqrt(max(0.0, 1.0 - p.y * p.y));
          if (p.x < xt) discard;
          // Borda suavizada: sem isto o disco fica serrilhado, e a lua é pequena na tela.
          float borda = 1.0 - smoothstep(0.97, 1.0, r);
          gl_FragColor = vec4(uCor, uOpacidade * borda);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: false,
    });
    this.lua = new THREE.Mesh(new THREE.PlaneGeometry(68, 68), this.materialLua);
    this.lua.renderOrder = -1;
    this.grupo.add(this.lua);

    // --- Sol ---
    //
    // Núcleo mais halo, num passe só, com mistura aditiva: é o que faz o sol "queimar" contra o
    // céu em vez de parecer um adesivo redondo. O halo cai com o cubo da distância, que é o
    // suficiente para ler como brilho atmosférico sem virar uma mancha.
    this.materialSol = new THREE.ShaderMaterial({
      uniforms: {
        uOpacidade: { value: 1 },
        uCor: { value: new THREE.Color(0xfff2d8) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacidade;
        uniform vec3 uCor;
        varying vec2 vUv;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          if (d > 1.0) discard;
          float nucleo = 1.0 - smoothstep(0.26, 0.32, d);
          float halo = pow(max(0.0, 1.0 - d), 3.0) * 0.5;
          gl_FragColor = vec4(uCor * (nucleo + halo) * uOpacidade, 1.0);
        }
      `,
      transparent: true,
      // Aditiva: o sol soma luz ao céu. Com mistura normal o halo escureceria a borda.
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      fog: false,
    });
    this.sol = new THREE.Mesh(new THREE.PlaneGeometry(190, 190), this.materialSol);
    this.sol.renderOrder = -1;
    this.grupo.add(this.sol);

    // --- Nuvens: blocos translúcidos numa grade ---
    //
    // `InstancedMesh` porque são milhares de cubos idênticos: uma chamada de desenho para todos,
    // com uma matriz por bloco. Cubos separados seriam milhares de chamadas e o quadro cairia.
    //
    // `depthWrite: true` num material transparente é deliberado. O padrão para transparência é
    // não escrever profundidade e ordenar por distância, mas instâncias de um `InstancedMesh` não
    // podem ser ordenadas entre si — são um objeto só para o renderizador. Sem escrever
    // profundidade, cubos de trás apareceriam por cima dos da frente conforme o ângulo. Como
    // todas as nuvens têm a mesma cor, escrever profundidade não tem custo visual e dá um
    // resultado estável.
    this.materialNuvens = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.86,
      depthWrite: true,
      // A névoa alcança ~260 voxels e as nuvens estão a 158 de altura: sem desligar, as de cima
      // some
      fog: false,
    });
    // Levemente achatado: nuvem é mais larga que alta, e cubos perfeitos leem como blocos de
    // pedra flutuando.
    const geoNuvem = new THREE.BoxGeometry(CELULA, CELULA * 0.62, CELULA);
    this.nuvens = new THREE.InstancedMesh(geoNuvem, this.materialNuvens, MAX_BLOCOS);
    // A grade é remontada só quando a âncora muda, então o three.js não deve presumir estático.
    this.nuvens.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.nuvens.count = 0;
    // Sem sombra: a câmera de sombra alcança 320 voxels e as nuvens cobrem o céu inteiro —
    // ligá-las apagaria o sol do mundo e ainda desperdiçaria a resolução do mapa.
    this.nuvens.castShadow = false;
    this.nuvens.receiveShadow = false;
    // O volume de nuvens é maior que a caixa que o three.js calcula da geometria de UMA instância;
    // sem isto elas somem quando o centro do objeto sai do campo de visão.
    this.nuvens.frustumCulled = false;
    this.nuvens.renderOrder = -1;
    this.grupo.add(this.nuvens);
  }

  /**
   * Remonta a grade de blocos de nuvem.
   *
   * Chamada só quando a âncora muda — ou seja, quando o jogador anda uma célula inteira (12
   * voxels) ou a deriva do vento avança uma célula. Entre duas remontagens o movimento é contínuo
   * porque o grupo inteiro desliza pelo resto sub-célula. Sem isso, as nuvens andariam aos
   * pulos de 12 voxels.
   */
  private remontarNuvens(centroX: number, centroZ: number, derivaCel: number): void {
    let n = 0;
    const meio = (CAMADAS - 1) / 2;
    for (let iz = 0; iz < GRADE; iz++) {
      for (let ix = 0; ix < GRADE; ix++) {
        const cx = centroX + ix - GRADE / 2;
        const cz = centroZ + iz - GRADE / 2;
        // A deriva entra na AMOSTRAGEM do ruído, não na posição: assim o padrão anda pelo céu
        // enquanto os blocos continuam alinhados à grade do mundo.
        const d = fbm2((cx + derivaCel) * 0.085, cz * 0.085);
        if (d <= this.limiarNuvem) continue;

        // Espessura proporcional ao quanto o ruído passou do limiar: a borda da nuvem fica fina e
        // o miolo cheio, que é o que dá a silhueta arredondada em vez de uma laje.
        const espessura = ((d - this.limiarNuvem) / Math.max(0.001, 1 - this.limiarNuvem)) * CAMADAS;
        for (let l = 0; l < CAMADAS; l++) {
          // Cresce a partir da camada do meio, para os dois lados.
          if (Math.abs(l - meio) > espessura / 2) continue;
          if (n >= MAX_BLOCOS) break;
          this.mat4.makeTranslation(
            cx * CELULA,
            ALTURA_NUVENS + l * CELULA * 0.62,
            cz * CELULA,
          );
          this.nuvens.setMatrixAt(n++, this.mat4);
        }
      }
    }
    this.nuvens.count = n;
    this.nuvens.instanceMatrix.needsUpdate = true;
  }

  /**
   * Atualiza o céu.
   *
   * `sunElevation` vai de -1 (meia-noite) a 1 (meio-dia): as estrelas surgem quando ela fica
   * negativa, e a transição é suave para o céu não "acender" de um quadro para o outro.
   *
   * `corCeu` entra para as nuvens: elas são superfície iluminada, então ao pôr do sol precisam
   * puxar para o laranja e à noite para o azul-escuro. Nuvem branca num céu noturno é o tipo de
   * coisa que denuncia o truque na hora.
   */
  public update(
    camera: THREE.Camera,
    sunAngle: number,
    sunElevation: number,
    fase: number,
    corCeu?: THREE.Color,
    tempo = 0,
  ): void {
    // A cúpula acompanha a câmera: estrela não muda de lugar quando o jogador anda.
    this.grupo.position.copy(camera.position);

    // Visíveis do crepúsculo em diante, com margem para a transição.
    const visibilidade = Math.max(0, Math.min(1, -sunElevation * 2.2 + 0.35));
    const iluminacao = iluminacaoDaFase(fase);

    // --- Direção do sol ---
    //
    // Derivada do mesmo ângulo que posiciona a luz direcional em `scene.ts`. Antes o disco da lua
    // usava uma expressão própria, com um `z` que não batia com o da luz — o resultado era a lua
    // não estar exatamente oposta ao sol. Vindo os dois daqui, não há como divergirem.
    this.dir.set(-Math.sin(sunAngle) * 0.72, sunElevation * 0.72, 0.28).normalize();

    // --- Sol ---
    this.sol.position.copy(this.dir).multiplyScalar(RAIO_CEU);
    this.sol.lookAt(this.grupo.position);
    // Some abaixo do horizonte, com margem para não piscar no instante exato do pôr do sol.
    const visSol = Math.max(0, Math.min(1, sunElevation * 4 + 0.35));
    this.materialSol.uniforms.uOpacidade.value = visSol;
    this.sol.visible = visSol > 0.01;
    // Avermelha rasante: é o mesmo motivo do céu alaranjado, e sem isto o sol fica branco-gelo
    // dentro de um pôr do sol laranja.
    const rasante = Math.max(0, 1 - Math.abs(sunElevation) * 3.2);
    (this.materialSol.uniforms.uCor.value as THREE.Color)
      .setHex(0xfff2d8)
      .lerp(new THREE.Color(0xff8a3d), rasante * 0.8);

    // --- Lua: oposta ao sol, por construção ---
    this.lua.position.copy(this.dir).multiplyScalar(-RAIO_CEU);
    this.lua.lookAt(this.grupo.position);
    this.materialLua.uniforms.uOpacidade.value = visibilidade;
    this.lua.visible = visibilidade > 0.01;
    // `k = cos(ângulo da fase)`: +1 em lua nova (nada aceso), -1 em lua cheia (tudo aceso).
    const f = ((fase % 8) + 8) % 8;
    this.materialLua.uniforms.uK.value = Math.cos((f / 8) * Math.PI * 2);

    // --- Estrelas: lua cheia apaga as fracas, como na realidade ---
    this.materialEstrelas.opacity = visibilidade * (1 - iluminacao * 0.35);
    this.estrelas.visible = this.materialEstrelas.opacity > 0.01;

    // --- Nuvens ---
    //
    // O grupo inteiro segue a câmera em todos os eixos, mas as nuvens têm altitude fixa do MUNDO:
    // o `y` local desconta a altura da câmera. Sem isso, subir uma montanha levaria as nuvens
    // junto e o jogador nunca as alcançaria.
    //
    // ## Movimento
    //
    // O vento desloca em `x`. A grade é remontada só quando a deriva avança uma célula inteira;
    // entre duas remontagens, o resto sub-célula desliza a malha continuamente. É o que dá
    // movimento fluido pagando uma remontagem a cada ~20 s em vez de uma por quadro.
    const deriva = tempo * VENTO;
    const derivaCel = Math.floor(deriva / CELULA);
    const resto = deriva - derivaCel * CELULA;

    // A grade acompanha o jogador em passos de uma célula, para as nuvens não acabarem à vista.
    const centroX = Math.round(camera.position.x / CELULA);
    const centroZ = Math.round(camera.position.z / CELULA);
    if (centroX !== this.ancora.x || centroZ !== this.ancora.z || derivaCel !== this.ancora.deriva) {
      this.ancora = { x: centroX, z: centroZ, deriva: derivaCel };
      this.remontarNuvens(centroX, centroZ, derivaCel);
    }
    // O `-resto` é o deslize contínuo entre remontagens; o `-camera.position.*` cancela o
    // acompanhamento do grupo, já que as posições das instâncias são absolutas no mundo.
    this.nuvens.position.set(
      -camera.position.x - resto,
      -camera.position.y,
      -camera.position.z,
    );

    // Nuvem é superfície iluminada pelo mesmo sol, e o material é Lambert — o direcional e a
    // hemisférica já a escurecem sozinhos à noite. O que sobra aqui é o tom: de tempestade ela
    // puxa para o cinza, e ao pôr do sol acompanha o céu.
    this.materialNuvens.color
      .copy(BRANCO_NUVEM)
      .lerp(CINZA_NUVEM, this.escuridaoNuvem);
    if (corCeu) this.materialNuvens.color.lerp(corCeu, 0.18);
  }

  /**
   * Cobertura de nuvens, 0 (céu limpo) a 1 (encoberto), e o quanto elas estão carregadas.
   *
   * Governada pelo clima: era o elo que faltava entre chover e o céu parecer que vai chover. Sem
   * ela o céu de tempestade era idêntico ao de um meio-dia limpo, com chuva caindo de lugar nenhum.
   */
  public setCobertura(v: number, escuridao = 0): void {
    const c = Math.max(0, Math.min(1, v));
    // O limiar anda ao CONTRÁRIO da cobertura: limiar alto deixa pouca nuvem passar. O intervalo
    // foi escolhido para 0 dar céu quase limpo e 1 encobrir sem virar um teto sólido.
    const limiar = 0.62 - c * 0.34;
    this.escuridaoNuvem = Math.max(0, Math.min(1, escuridao));
    if (Math.abs(limiar - this.limiarNuvem) < 0.004) return;
    this.limiarNuvem = limiar;
    // Força a remontagem no próximo quadro: a forma mudou, não só a cor.
    this.ancora.deriva = NaN;
  }

  public dispose(): void {
    this.estrelas.geometry.dispose();
    this.materialEstrelas.dispose();
    this.lua.geometry.dispose();
    this.materialLua.dispose();
    this.sol.geometry.dispose();
    this.materialSol.dispose();
    this.nuvens.geometry.dispose();
    this.materialNuvens.dispose();
  }
}
