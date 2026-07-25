// Cena: sol com sombras, luz de céu, névoa e materiais dos chunks.
// Inclui a curvatura do horizonte (estilo "planeta"): além de uCurvStart,
// os vértices afundam com o quadrado da distância — o mundo dobra para
// baixo na borda, como na vida real.
import * as THREE from 'three';

/** uniforms compartilhados por todos os materiais de terreno/água/LOD */
export const curvature = {
  start: { value: 500 },        // voxels a partir dos quais começa a curvar
  invR: { value: 0 },           // 0 = mundo 100% plano e reto
};

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
  /** Aplica a hora do dia (0 = meia-noite, 0.5 = meio-dia) ao céu, ao sol e à luz ambiente. */
  setTimeOfDay(t: number): void;
  /** Intensidade atual da luz solar, 0..1 — o mesher usa para escurecer a luz de céu à noite. */
  getSunScale(): number;
}

export function createScene(container: HTMLElement): GameScene {
  const scene = new THREE.Scene();
  const skyColor = new THREE.Color(0x9fc7e8);
  scene.background = skyColor;
  scene.fog = null;

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
  const tmpSky = new THREE.Color();

  function setTimeOfDay(t: number): void {
    const frac = ((t % 1) + 1) % 1;
    sunAngle = frac * Math.PI * 2;

    // Altura do sol: -1 (meia-noite) a 1 (meio-dia).
    const elevation = -Math.cos(frac * Math.PI * 2);
    sunScale = Math.max(0.12, Math.min(1, elevation * 1.5 + 0.35));

    // Céu: azul de dia, laranja rasante no nascer/pôr, azul-escuro à noite.
    const duskAmount = Math.max(0, 1 - Math.abs(elevation) * 3.2);
    tmpSky.copy(elevation > 0 ? DAY_SKY : NIGHT_SKY);
    if (elevation <= 0) tmpSky.lerp(DAY_SKY, Math.max(0, (elevation + 0.35) / 0.35) * 0.5);
    tmpSky.lerp(DUSK_SKY, duskAmount * 0.55);
    (scene.background as THREE.Color).copy(tmpSky);
    const fog = scene.fog as THREE.Fog | null;
    if (fog) fog.color.copy(tmpSky);

    sun.intensity = 2.2 * sunScale;
    hemi.intensity = 0.75 * Math.max(0.25, sunScale);
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

  function setViewRange(voxels: number): void {
    const f = scene.fog as THREE.Fog | null;
    if (f) {
      f.near = voxels * 0.5;
      f.far = voxels * 0.98;
    }
  }

  setTimeOfDay(0.35); // começa de manhã

  return { scene, camera, renderer, sun, solidMaterial, waterMaterial, glassMaterial, updateSun, setViewRange, setTimeOfDay, getSunScale };
}
