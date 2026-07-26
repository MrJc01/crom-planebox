// Cena: sol com sombras, luz de céu, névoa e materiais dos chunks.
// Inclui a curvatura do horizonte (estilo "planeta"): além de uCurvStart,
// os vértices afundam com o quadrado da distância — o mundo dobra para
// baixo na borda, como na vida real.
import * as THREE from 'three';
import { Sky } from './sky';
import { claridadeNoturna } from '../world/moon';

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

/** Injeta a curvatura no vertex shader de um material three.js. */
export function applyCurvature(mat: THREE.Material): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCurvStart = curvature.start;
    shader.uniforms.uCurvInvR = curvature.invR;
    shader.vertexShader =
      'uniform float uCurvStart;\nuniform float uCurvInvR;\n' +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `vec4 cqWorld = modelMatrix * vec4(transformed, 1.0);
         float cqDist = distance(cqWorld.xz, cameraPosition.xz);
         float cqDrop = max(0.0, cqDist - uCurvStart);
         cqWorld.y -= cqDrop * cqDrop * uCurvInvR;
         vec4 mvPosition = viewMatrix * cqWorld;
         gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  mat.customProgramCacheKey = () => 'cq-curvature';
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
  setWeather(luz: number, alcance: number): void;
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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
  const hemi = new THREE.HemisphereLight(0xbdd9f2, 0x5a6b46, 0.75);
  scene.add(hemi);

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
  applyCurvature(waterMaterial);
  applyCurvature(glassMaterial);

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
  const NIGHT_SKY = new THREE.Color(0x0a1020);
  const DUSK_SKY = new THREE.Color(0xe8956b);
  const BRANCO = new THREE.Color(0xffffff);
  const tmpSky = new THREE.Color();

  /** Fase lunar atual, definida pelo `main` a cada novo dia. */
  let fasaLunar = 0;
  function setMoonPhase(fase: number): void { fasaLunar = fase; }
  function getMoonPhase(): number { return fasaLunar; }

  function setTimeOfDay(t: number): void {
    const frac = ((t % 1) + 1) % 1;
    sunAngle = frac * Math.PI * 2;

    // Altura do sol: -1 (meia-noite) a 1 (meio-dia).
    const elevation = -Math.cos(frac * Math.PI * 2);

    // O piso noturno vem da FASE DA LUA, e não é mais fixo em 0.12. É o que faz a lua nova ser
    // uma noite realmente escura e a cheia uma noite navegável — e, como o motor separa luz de
    // céu de luz de bloco, a tocha mantém o mesmo valor nas duas.
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
      // A cor do bioma tinge o céu na proporção da luz do sol: de dia o deserto amarela e o
      // pântano esverdeia o horizonte; de noite tudo volta à cor do céu, porque névoa é ar
      // iluminado e sem sol ela não tem cor própria.
      fog.color.copy(tmpSky).lerp(corBiomaAtual, 0.55 * sunScale);
    }

    aplicarLuzes();

    sky.update(camera, sunAngle, elevation, fasaLunar);
  }

  function getSunScale(): number {
    return sunScale;
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
    sun.intensity = 2.2 * sunScale + clarao * 3.4;
    hemi.intensity = 0.75 * Math.max(0.25, sunScale) + clarao * 2.2;
    if (clarao > 0) {
      (scene.background as THREE.Color).copy(tmpSky).lerp(BRANCO, clarao * 0.7);
    } else {
      (scene.background as THREE.Color).copy(tmpSky);
    }
  }

  function setWeather(luz: number, alcance: number): void {
    const mudouAlcance = Math.abs(alcance - alcanceClima) > 1e-4;
    luzClima = luz;
    alcanceClima = alcance;
    if (mudouAlcance) aplicarAlcance();
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

  return { scene, camera, renderer, sun, solidMaterial, waterMaterial, glassMaterial, updateSun, setViewRange, setCurvature, setBiomeAmbience, setWeather, setLightningFlash, setTimeOfDay, getSunScale, setMoonPhase, getMoonPhase };
}
