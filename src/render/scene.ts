// Cena: sol com sombras, luz de céu, névoa e materiais dos chunks.
// Inclui a curvatura do horizonte (estilo "planeta"): além de uCurvStart,
// os vértices afundam com o quadrado da distância — o mundo dobra para
// baixo na borda, como na vida real.
import * as THREE from 'three';
import { Sky } from './sky';
import { claridadeNoturna } from '../world/moon';
import { Gradacao } from './grading';

/**
 * Uniforms da curvatura do mundo, compartilhados por terreno, água e vidro.
 *
 * O shader estava completo, mas **inerte**: `invR` era 0 (mundo plano) e nada no projeto o
 * alterava. Além disso `start` era 500 voxels, enquanto a distância de render são ~192 — a
 * curvatura começaria além do que existe desenhado, e não apareceria nem se fosse ligada.
 *
 * Agora os dois são derivados da distância de render por `setCurvature`.
 */
export const curvature = {
  /** Voxels a partir dos quais o mundo começa a dobrar. */
  start: { value: 60 },
  /** Intensidade. 0 = plano; o afundamento cresce com o quadrado da distância. */
  invR: { value: 0.00035 },
};

/** Quanto o horizonte afunda, em voxels, no limite da distância de render. */
export const CURVATURA_QUEDA_PADRAO = 26;

/**
 * Tingimento sazonal e de chuva, compartilhado pelos materiais dos chunks.
 *
 * A luz e a oclusão estão assadas na cor dos vértices, então mudar a cor da folhagem exigiria
 * remontar o chunk — inaceitável para algo que muda todo dia de calendário. A saída é o canal
 * `aTint` do mesher: um byte por vértice dizendo *se* aquele vértice responde, e a cor vive
 * aqui, num uniform. O outono chega ao mundo inteiro trocando três números.
 *
 * A operação é **multiplicativa**: preserva o sombreamento e a luz que já estão na cor, em vez
 * de substituí-los por uma cor chapada.
 */
export const gradacaoUniforms = {
  saturacao: { value: 1 },
  contraste: { value: 1 },
  sombra: { value: new THREE.Color(1, 1, 1) },
  luz: { value: new THREE.Color(1, 1, 1) },
  forca: { value: 0 },
};

/**
 * Relógio da onda da água, compartilhado por todos os materiais de água.
 *
 * Um uniform só, atualizado uma vez por quadro. A alternativa seria remontar a malha da água com
 * alturas novas — o que significaria marcar todo chunk com água como sujo a cada quadro, e é
 * exatamente o tipo de coisa que derruba o jogo para conseguir um efeito de superfície.
 */
export const ondaUniforms = {
  tempo: { value: 0 },
};

export const tinturas = {
  /** Cor multiplicada na folhagem. Branco = sem efeito. */
  folhagem: { value: new THREE.Color(1, 1, 1) },
  /** Cor multiplicada na grama (só no topo). */
  grama: { value: new THREE.Color(1, 1, 1) },
  /** Escurecimento por chuva, aplicado a tudo. 0 = seco. */
  molhado: { value: 0 },
};

/**
 * Injeta curvatura e tingimento no shader de um material de chunk.
 *
 * Os dois moram no mesmo `onBeforeCompile` porque o three.js só guarda **um** por material — a
 * segunda atribuição apagaria a primeira em silêncio, e o sintoma seria "a curvatura parou de
 * funcionar quando o outono chegou", sem nada apontando para a causa.
 */
export function applyCurvature(mat: THREE.Material, ehAgua = false): void {
  // Uniform de aparição, **por material** e não compartilhado: cada chunk que está chegando tem o
  // próprio progresso. Fica pendurado no material para o chamador poder ajustar sem guardar um
  // mapa paralelo — e como todos os materiais compartilham o mesmo `customProgramCacheKey`, criar
  // um por chunk que aparece não recompila shader nenhum.
  const fade = { value: 1 };
  (mat as any).uFade = fade;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFade = fade;
    shader.uniforms.uCurvStart = curvature.start;
    shader.uniforms.uCurvInvR = curvature.invR;
    shader.uniforms.uTintFolhagem = tinturas.folhagem;
    shader.uniforms.uTintGrama = tinturas.grama;
    shader.uniforms.uMolhado = tinturas.molhado;
    shader.uniforms.uGradSat = gradacaoUniforms.saturacao;
    shader.uniforms.uGradCon = gradacaoUniforms.contraste;
    shader.uniforms.uGradSombra = gradacaoUniforms.sombra;
    shader.uniforms.uGradLuz = gradacaoUniforms.luz;
    shader.uniforms.uGradForca = gradacaoUniforms.forca;

    // O tingimento entra depois de `color_vertex`, onde `vColor` já recebeu a cor do vértice com
    // luz e oclusão dentro. Multiplicar preserva as duas; somar ou substituir apagaria o relevo.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <color_vertex>',
      `#include <color_vertex>
       #ifdef USE_COLOR
         if (aTint > 1.5) vColor.rgb *= uTintGrama;
         else if (aTint > 0.5) vColor.rgb *= uTintFolhagem;
         vColor.rgb *= 1.0 - uMolhado * 0.28;
       #endif`,
    );

    // Onda da água, só no material da água.
    //
    // Duas senoides de frequências que não são múltiplas uma da outra: o padrão resultante leva
    // muito tempo para se repetir, e o olho lê como movimento irregular em vez de uma esteira
    // rolante. Uma senoide só, por mais bem escolhida, denuncia o período em segundos.
    //
    // O deslocamento é pequeno (±0,11 voxel) de propósito: a água é feita de blocos com topo
    // rebaixado, e uma onda grande separaria visivelmente um bloco do vizinho.
    shader.uniforms.uOndaTempo = ondaUniforms.tempo;
    const onda = ehAgua
      ? `cqWorld.y += (sin(cqWorld.x * 0.42 + uOndaTempo * 1.7)
                     + sin(cqWorld.z * 0.31 + uOndaTempo * 1.15)) * 0.055;`
      : '';

    shader.vertexShader =
      'uniform float uCurvStart;\nuniform float uCurvInvR;\nuniform float uOndaTempo;\n' +
      'uniform vec3 uTintFolhagem;\nuniform vec3 uTintGrama;\nuniform float uMolhado;\n' +
      'attribute float aTint;\n' +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `vec4 cqWorld = modelMatrix * vec4(transformed, 1.0);
         ${onda}
         float cqDist = distance(cqWorld.xz, cameraPosition.xz);
         float cqDrop = max(0.0, cqDist - uCurvStart);
         cqWorld.y -= cqDrop * cqDrop * uCurvInvR;
         vec4 mvPosition = viewMatrix * cqWorld;
         gl_Position = projectionMatrix * mvPosition;`,
      );

    // Aparição por DESCARTE, não por transparência.
    //
    // Transparência resolveria em duas linhas e custaria caro: material transparente não escreve
    // profundidade, então o chunk que chega deixaria de ocultar o que está atrás — o jogador
    // veria o interior do terreno através do chão que está aparecendo, durante a animação
    // inteira, e o renderizador ainda teria de ordenar os chunks a cada quadro.
    //
    // Descartando fragmentos por um padrão de Bayer 4×4, o material continua opaco: escreve
    // profundidade, dispensa ordenação, e o que varia é a fração de pixels desenhados. Em 0,6 s
    // o olho lê como um esmaecimento.
    shader.fragmentShader =
      'uniform float uFade;\n' +
      // Bayer 4×4 calculado, sem tabela: array com índice dinâmico não é portátil em WebGL1, e
      // a construção recursiva do padrão custa quatro instruções.
      'float cqBayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }\n' +
      'float cqBayer4(vec2 a) { return cqBayer2(a * 0.5) * 0.25 + cqBayer2(a); }\n' +
      shader.fragmentShader.replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
         if (uFade < 0.999 && cqBayer4(gl_FragCoord.xy) > uFade) discard;`,
      );

    // Gradação de cor, **depois da névoa**: se viesse antes, a névoa entraria sem gradar e o
    // horizonte destoaria do terreno — exatamente onde os dois se encontram.
    //
    // Seis instruções dentro de um fragmento que já ia rodar. A alternativa de manual é um passe
    // de tela cheia com LUT, que custa um alvo de render do tamanho da tela e uma cópia por
    // quadro; ver `src/render/grading.ts` para por que isso foi recusado aqui.
    shader.fragmentShader =
      'uniform float uGradSat;\nuniform float uGradCon;\n' +
      'uniform vec3 uGradSombra;\nuniform vec3 uGradLuz;\nuniform float uGradForca;\n' +
      shader.fragmentShader.replace(
        '#include <fog_fragment>',
        `#include <fog_fragment>
         if (uGradForca > 0.001) {
           vec3 cqC = gl_FragColor.rgb;
           // Luminância perceptual (Rec. 709): usar a média dos canais deixaria o verde da
           // vegetação escuro demais ao dessaturar, porque o olho é mais sensível a ele.
           float cqL = dot(cqC, vec3(0.2126, 0.7152, 0.0722));
           cqC = mix(vec3(cqL), cqC, uGradSat);
           cqC = (cqC - 0.5) * uGradCon + 0.5;
           // Tonalização dividida: a sombra puxa para o frio, a luz para o quente. É a assinatura
           // da referência, e o que faz a mesma paleta parecer "de fim de tarde".
           cqC *= mix(uGradSombra, uGradLuz, clamp(cqL, 0.0, 1.0));
           gl_FragColor.rgb = mix(gl_FragColor.rgb, max(cqC, vec3(0.0)), uGradForca);
         }`,
      );
  };
  mat.customProgramCacheKey = () => 'cq-curvature-tint-fade';
}

export interface GameScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  sun: THREE.DirectionalLight;
  solidMaterial: THREE.Material;
  waterMaterial: THREE.Material;
  glassMaterial: THREE.Material;
  updateSun(px: number, pz: number): void;
  /** ajusta a névoa ao alcance de render do LOD */
  setViewRange(voxels: number): void;
  /** Curvatura do horizonte. `queda = 0` deixa o mundo plano. */
  setCurvature(voxels: number, queda?: number): void;
  /**
   * Cor e alcance da névoa vindos da mistura de biomas do ponto onde o jogador está.
   * `dt` é usado para interpolar no tempo — chamar todo quadro é o uso previsto.
   */
  setBiomeAmbience(cor: [number, number, number], alcance: number, dt: number): void;
  /**
   * Efeitos do clima, como MULTIPLICADORES do que o bioma e a hora já definiram.
   * `luz` escurece o céu; `alcance` fecha a névoa.
   */
  setWeather(luz: number, alcance: number, nuvens?: number): void;
  /**
   * Cor multiplicativa da folhagem e da grama, e o quanto o chão está molhado.
   * Não remonta chunk: só troca uniforms lidos pelo canal `aTint` do mesher.
   */
  setSeasonTint(folhagem: [number, number, number], grama: [number, number, number], molhado: number): void;
  /**
   * Cria um material para um chunk que está aparecendo. Descarta-o (`dispose`) ao terminar e
   * devolva o chunk ao material compartilhado — ver `src/render/chunkFade.ts`.
   */
  /** Aplica a gradação de cor (ver `src/render/grading.ts`). */
  setGrading(g: Gradacao): void;
  /** Elevação do sol agora, -1 (meia-noite) a 1 (meio-dia) — entrada da gradação. */
  getSunElevation(): number;
  criarMaterialFade(qual: 'solid' | 'water' | 'glass'): THREE.Material;
  /** Progresso da aparição de um material criado por `criarMaterialFade`, 0..1. */
  setMaterialFade(mat: THREE.Material, v: number): void;
  /** Clarão do relâmpago, 0..1. Ilumina a cena sem marcar chunk como sujo. */
  setLightningFlash(v: number): void;
  /** Fase lunar (0 = nova, 4 = cheia). Governa a claridade da noite e o desenho da lua. */
  setMoonPhase(fase: number): void;
  getMoonPhase(): number;
  /** Aplica a hora do dia (0 = meia-noite, 0.5 = meio-dia) ao céu, ao sol e à luz ambiente. */
  setTimeOfDay(t: number): void;
  /** Intensidade atual da luz solar, 0..1 — o mesher usa para escurecer a luz de céu à noite. */
  getSunScale(): number;
}

export function createScene(container: HTMLElement): GameScene {
  const scene = new THREE.Scene();
  const skyColor = new THREE.Color(0x9fc7e8);
  scene.background = skyColor;
  // Neblina atmosférica (item 054), o que faltava para fechar a estética alvo.
  //
  // Ela faz três coisas ao mesmo tempo: dá profundidade ao terreno distante, esconde a borda
  // dura onde os chunks acabam — que sem isso aparece como um recorte reto no vazio — e
  // permite reduzir a distância de render sem que fique óbvio, o que é ganho de desempenho.
  //
  // A cor acompanha o céu, e não é fixa: com névoa cinza num pôr do sol laranja, o horizonte
  // vira uma faixa suja em vez de derreter no céu.
  scene.fog = new THREE.Fog(skyColor.getHex(), 60, 260);

  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 12000);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  // `PCFSoftShadowMap` foi depreciado e o three.js já o rebaixava para `PCFShadowMap` sozinho,
  // avisando no console a cada abertura. Pedir o que de fato se recebe cala o aviso e deixa
  // explícito qual filtro está em uso.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // sol de fim de manhã, quente
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.position.set(60, 95, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 320;
  const S = 95;
  sun.shadow.camera.left = -S;
  sun.shadow.camera.right = S;
  sun.shadow.camera.top = S;
  sun.shadow.camera.bottom = -S;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  scene.add(sun.target);

  // luz ambiente: céu azulado por cima, quicada esverdeada por baixo
  const hemi = new THREE.HemisphereLight(0xbdd9f2, 0x7d8a68, 0.9);
  scene.add(hemi);

  /**
   * Termo ambiente — o que faltava para o lado sem sol não ser preto.
   *
   * O relato foi "o lado que não bate luz fica totalmente escuro", e a causa é que a cena só tinha
   * direcional e hemisférica. Uma face virada para longe do sol recebe `N·L = 0` do direcional e
   * fica só com a hemisférica; essa sobra ainda é multiplicada pelo sombreado de face já assado no
   * vértice (0,68 a 0,86 nas laterais) e pela oclusão de ambiente, e o ACES no fim esmaga o que
   * restou. Três atenuações em cima de um valor já pequeno dão preto.
   *
   * O ambiente incide igual em toda face, independente da normal, então ele **levanta o piso**
   * sem achatar o relevo — quem dá forma continua sendo o direcional. O direcional caiu de 2,2
   * para 1,75 na mesma medida, senão o lado iluminado estouraria no tonemapping.
   */
  const ambiente = new THREE.AmbientLight(0xdfe9f5, 0.5);
  scene.add(ambiente);

  // Céu noturno: estrelas por padrão e lua com fases. A semente vem depois, via `setSkySeed`.
  const sky = new Sky(0x5eed);
  scene.add(sky.grupo);

  const solidMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  const waterMaterial = new THREE.MeshLambertMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glassMaterial = new THREE.MeshLambertMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  applyCurvature(solidMaterial);
  // O `true` é o que liga a onda. Sem ele o shader da onda é escrito, compilado e nunca emitido
  // para a água — o mesmo defeito que já apareceu cinco vezes neste projeto: código completo que
  // ninguém chama. Ver o teste `agua.test.ts`, que existe para esta linha não voltar a ser `false`.
  applyCurvature(waterMaterial, true);
  applyCurvature(glassMaterial);

  /**
   * Materiais para os chunks que estão aparecendo.
   *
   * Um por chunk em animação, porque o progresso é individual e o three.js só reenvia uniforms de
   * material quando o material muda. Não é caro: `customProgramCacheKey` é o mesmo para todos, e
   * portanto o shader é compilado **uma vez** e reaproveitado — o que se cria aqui é estado de
   * uniform, não programa de GPU.
   *
   * `clone()` não serve: `Material.copy` do three.js não copia `onBeforeCompile`, e o clone sairia
   * sem curvatura, sem tingimento e sem o descarte — silenciosamente.
   */
  function criarMaterialFade(qual: 'solid' | 'water' | 'glass'): THREE.Material {
    const base = qual === 'solid' ? solidMaterial : qual === 'water' ? waterMaterial : glassMaterial;
    const m = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: (base as THREE.MeshLambertMaterial).transparent,
      opacity: (base as THREE.MeshLambertMaterial).opacity,
      depthWrite: (base as THREE.MeshLambertMaterial).depthWrite,
      side: (base as THREE.MeshLambertMaterial).side,
    });
    // A água que está APARECENDO também ondula. Esquecer aqui daria o defeito mais difícil de
    // enxergar da família: o lago ondula, mas para de ondular durante os 0,6 s em que o chunk
    // surge — e volta a ondular sozinho quando termina.
    applyCurvature(m, qual === 'water');
    return m;
  }

  function setMaterialFade(mat: THREE.Material, v: number): void {
    const u = (mat as any).uFade as { value: number } | undefined;
    if (u) u.value = Math.max(0, Math.min(1, v));
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // --- Ciclo dia/noite ---------------------------------------------------------------------
  //
  // `sunScale` sai de uma curva suave em torno do meio-dia, com um platô de noite fechada.
  // Ele governa três coisas ao mesmo tempo: a cor do céu, a intensidade das luzes da cena e
  // (via mesher) o quanto a luz de céu armazenada nos voxels de fato ilumina.
  let sunScale = 1;
  let sunAngle = 0;
  const DAY_SKY = new THREE.Color(0x9fc7e8);
  // Quase preto, e não o azul-ardósia de antes: com a névoa assumindo esta cor à noite, um
  // 0x0a1020 deixava o horizonte visivelmente azul num mundo escuro.
  const NIGHT_SKY = new THREE.Color(0x04070f);
  const DUSK_SKY = new THREE.Color(0xe8956b);
  const BRANCO = new THREE.Color(0xffffff);
  const tmpSky = new THREE.Color();

  /** Fase lunar atual, definida pelo `main` a cada novo dia. */
  let fasaLunar = 0;
  function setMoonPhase(fase: number): void { fasaLunar = fase; }
  function getMoonPhase(): number { return fasaLunar; }

  // Relógio de parede para a deriva do vento nas nuvens. Independente da hora do jogo de
  // propósito: o vento sopra na mesma velocidade com o tempo acelerado ou parado, e é ele que
  // impede o céu de parecer uma foto.
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const agora = (): number =>
    ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0) / 1000;

  function setTimeOfDay(t: number): void {
    const relogioCeu = agora();
    ondaUniforms.tempo.value = relogioCeu;
    const frac = ((t % 1) + 1) % 1;
    sunAngle = frac * Math.PI * 2;

    // Altura do sol: -1 (meia-noite) a 1 (meio-dia).
    const elevation = -Math.cos(frac * Math.PI * 2);
    sunElevation = elevation;

    // O piso noturno vem da FASE DA LUA, e não é mais fixo em 0.12. É o que faz a lua nova ser
    // uma noite realmente escura e a cheia uma noite navegável — e, como o motor separa luz de
    // céu de luz de bloco, a tocha mantém o mesmo valor nas duas.
    // Luz do SOL sozinha, sem o piso lunar: zera de verdade à noite. É a diferença que faz a
    // névoa ficar preta — ver o comentário adiante, na cor da névoa.
    const luzDoDia = Math.max(0, Math.min(1, elevation * 1.5 + 0.35));

    const pisoNoturno = claridadeNoturna(fasaLunar);
    // O clima multiplica DEPOIS do piso noturno: uma tempestade escurece a noite de lua cheia,
    // mas o piso continua sendo um piso — o mundo nunca chega ao preto absoluto.
    sunScale = Math.max(pisoNoturno * luzClima, Math.min(1, elevation * 1.5 + 0.35) * luzClima);

    // Céu: azul de dia, laranja rasante no nascer/pôr, azul-escuro à noite.
    const duskAmount = Math.max(0, 1 - Math.abs(elevation) * 3.2);
    tmpSky.copy(elevation > 0 ? DAY_SKY : NIGHT_SKY);
    if (elevation <= 0) tmpSky.lerp(DAY_SKY, Math.max(0, (elevation + 0.35) / 0.35) * 0.5);
    tmpSky.lerp(DUSK_SKY, duskAmount * 0.55);
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      // A cor do bioma tinge o céu na proporção da **luz do dia**, não de `sunScale`.
      //
      // Este era o defeito do relato "o fog à noite não fica preto". `sunScale` tem um piso
      // noturno — a claridade da lua — e portanto NUNCA chega a zero. O fator nunca zerava, e a
      // cor clara do bioma (0,74 0,80 0,85) continuava entrando à meia-noite, deixando o
      // horizonte cinza dentro de uma noite escura.
      //
      // `luzDoDia` zera de fato quando o sol se põe. Névoa é ar iluminado pelo SOL: sem ele, ela
      // não tem cor própria, e a lua não ilumina o ar o bastante para dar cor a nada.
      fog.color.copy(tmpSky).lerp(corBiomaAtual, 0.55 * luzDoDia);
    }

    aplicarLuzes();

    sky.update(camera, sunAngle, elevation, fasaLunar, tmpSky, relogioCeu);
  }

  function getSunScale(): number {
    return sunScale;
  }

  /** Elevação do sol: -1 (meia-noite) a 1 (meio-dia). */
  let sunElevation = 1;
  function getSunElevation(): number {
    return sunElevation;
  }

  const SNAP = 8;
  function updateSun(px: number, pz: number): void {
    const cx = Math.round(px / SNAP) * SNAP;
    const cz = Math.round(pz / SNAP) * SNAP;
    // O sol descreve um arco de verdade em vez de ficar cravado: é o que dá o movimento das
    // sombras ao longo do dia.
    const h = Math.max(20, Math.cos(sunAngle - Math.PI) * 95);
    sun.position.set(cx + Math.sin(sunAngle - Math.PI) * 70, h, cz + 30);
    sun.target.position.set(cx, 0, cz);
  }

  /**
   * Ajusta a névoa à distância de render.
   *
   * Este método existia e não fazia nada, porque `scene.fog` era `null` — a checagem `if (f)`
   * sempre falhava em silêncio. Agora que a névoa existe, ele funciona de fato.
   */
  /**
   * Ajusta a curvatura à distância de render.
   *
   * `queda` é o quanto o horizonte afunda no limite do que se enxerga. Derivar daí, em vez de
   * fixar `invR`, é o que mantém o efeito com a mesma intensidade visual quando o jogador muda
   * a distância — com valor fixo, aumentar o alcance dobraria o mundo ao ponto do absurdo,
   * porque a queda cresce com o quadrado.
   */
  function setCurvature(voxels: number, queda = CURVATURA_QUEDA_PADRAO): void {
    if (queda <= 0) { curvature.invR.value = 0; return; }
    const inicio = voxels * 0.3;
    const alcance = Math.max(1, voxels - inicio);
    curvature.start.value = inicio;
    curvature.invR.value = queda / (alcance * alcance);
  }

  /** Última distância pedida, guardada para reaplicar quando o alcance do bioma muda. */
  let alcanceBaseVoxels = 260;

  function setViewRange(voxels: number): void {
    alcanceBaseVoxels = voxels;
    aplicarAlcance();
  }

  function aplicarAlcance(): void {
    const f = scene.fog as THREE.Fog | null;
    if (!f) return;
    // Começa na metade e fecha um pouco antes do limite: se `far` coincidisse com a última
    // coluna carregada, o recorte reapareceria exatamente no ponto que a névoa deveria cobrir.
    // O bioma multiplica: pântano fecha o horizonte, deserto abre.
    const v = alcanceBaseVoxels * alcanceBiomaAtual * alcanceClima;
    f.near = v * 0.45;
    f.far = Math.min(v * 0.92, alcanceBaseVoxels * 1.02);
  }

  // --- Ambiência de bioma ---
  //
  // A névoa é o principal veículo de identidade de bioma, porque é o que se vê a distância — o
  // bloco de superfície só aparece de perto. Duas decisões:
  //
  //  1. **A cor do bioma tinge o céu, não o substitui**, e a força do tingimento acompanha a luz
  //     do sol. Substituir deixaria a névoa do deserto clara à meia-noite, com o mundo escuro
  //     atrás dela. Névoa é ar iluminado: sem sol, ela tem a cor do céu.
  //  2. **A mudança é interpolada no tempo**, com constante de meio segundo. Atravessar a
  //     fronteira de dois biomas troca os pesos continuamente no espaço, mas o jogador pode se
  //     teletransportar ou nascer em outro lugar — e aí a troca seca seria um piscar.
  const corBiomaAtual = new THREE.Color(0.74, 0.80, 0.85);
  const corBiomaAlvo = new THREE.Color(0.74, 0.80, 0.85);
  let alcanceBiomaAtual = 1;
  let alcanceBiomaAlvo = 1;

  // --- Clima ---
  //
  // Multiplicadores, não valores absolutos: o clima modula o que o bioma e a hora já
  // estabeleceram. Uma tempestade escurece o meio-dia e a meia-noite na mesma proporção, que é o
  // comportamento certo — e evita que o clima precise conhecer a hora ou o bioma.
  let luzClima = 1;
  let alcanceClima = 1;

  /**
   * Clarão do relâmpago, 0..1.
   *
   * Some na luz da cena e no céu, mas **não** entra no `sunScale` que o mesher consome: se
   * entrasse, cada raio marcaria todos os chunks como sujos e o mundo inteiro seria remontado
   * duas vezes por relâmpago. O clarão é de iluminação, não de geometria.
   */
  let clarao = 0;
  function setLightningFlash(v: number): void {
    clarao = Math.max(0, Math.min(1, v));
    aplicarLuzes();
  }

  function aplicarLuzes(): void {
    sun.intensity = 1.75 * sunScale + clarao * 3.4;
    hemi.intensity = 0.9 * Math.max(0.3, sunScale) + clarao * 2.2;
    // Piso de 0,26 mesmo na noite mais fechada: é o mínimo para uma parede virada para longe da
    // lua continuar sendo uma parede, e não um recorte preto. Escuro o bastante para a tocha
    // continuar valendo a pena.
    ambiente.intensity = 0.26 + 0.34 * sunScale + clarao * 1.2;
    if (clarao > 0) {
      (scene.background as THREE.Color).copy(tmpSky).lerp(BRANCO, clarao * 0.7);
    } else {
      (scene.background as THREE.Color).copy(tmpSky);
    }
  }

  /**
   * Tingimento sazonal e de chuva. Barato de propósito: três uniforms, nenhuma geometria tocada.
   */
  /**
   * Aplica a gradação. `exposicao` vai direto no renderizador, que é global e alcança tudo —
   * inclusive o que os uniforms de material não alcançam.
   */
  function setGrading(g: Gradacao): void {
    gradacaoUniforms.saturacao.value = g.saturacao;
    gradacaoUniforms.contraste.value = g.contraste;
    gradacaoUniforms.sombra.value.setRGB(g.sombra[0], g.sombra[1], g.sombra[2]);
    gradacaoUniforms.luz.value.setRGB(g.luz[0], g.luz[1], g.luz[2]);
    gradacaoUniforms.forca.value = g.forca;
    renderer.toneMappingExposure = g.exposicao;
  }

  function setSeasonTint(
    folhagem: [number, number, number],
    grama: [number, number, number],
    molhado: number,
  ): void {
    tinturas.folhagem.value.setRGB(folhagem[0], folhagem[1], folhagem[2]);
    tinturas.grama.value.setRGB(grama[0], grama[1], grama[2]);
    tinturas.molhado.value = Math.max(0, Math.min(1, molhado));
  }

  /**
   * Efeitos do clima. `nuvens` é a cobertura do céu, 0 a 1.
   *
   * A cobertura é **derivada da luz do clima** quando não vem explícita, e não é um acaso: um
   * clima escurece o mundo justamente porque há nuvem entre o sol e o chão. Amarrar as duas
   * garante que nunca haja tempestade com céu limpo — que era exatamente o relato, chuva caindo
   * de um céu idêntico ao de um meio-dia de sol.
   */
  function setWeather(luz: number, alcance: number, nuvens?: number): void {
    const mudouAlcance = Math.abs(alcance - alcanceClima) > 1e-4;
    luzClima = luz;
    alcanceClima = alcance;
    if (mudouAlcance) aplicarAlcance();

    const cobertura = nuvens ?? Math.max(0, Math.min(1, (1 - luz) * 1.7));
    // Quanto mais escuro o clima, mais carregada a nuvem. Nuvem branca numa tempestade é o tipo
    // de detalhe que desmancha a cena inteira.
    sky.setCobertura(cobertura, Math.max(0, Math.min(1, (1 - luz) * 1.9)));
  }

  function setBiomeAmbience(cor: [number, number, number], alcance: number, dt: number): void {
    corBiomaAlvo.setRGB(cor[0], cor[1], cor[2]);
    alcanceBiomaAlvo = alcance;

    // Meia-vida de 0,5 s, independente da taxa de quadros.
    const k = 1 - Math.pow(0.5, Math.min(dt, 0.25) / 0.5);
    corBiomaAtual.lerp(corBiomaAlvo, k);
    const alcanceAntes = alcanceBiomaAtual;
    alcanceBiomaAtual += (alcanceBiomaAlvo - alcanceBiomaAtual) * k;
    if (Math.abs(alcanceBiomaAtual - alcanceAntes) > 1e-4) aplicarAlcance();
  }

  setTimeOfDay(0.35); // começa de manhã

  return { scene, camera, renderer, sun, solidMaterial, waterMaterial, glassMaterial, updateSun, setViewRange, setCurvature, setBiomeAmbience, setWeather, setSeasonTint, setGrading, getSunElevation, criarMaterialFade, setMaterialFade, setLightningFlash, setTimeOfDay, getSunScale, setMoonPhase, getMoonPhase };
}
