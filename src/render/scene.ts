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

  const SNAP = 8;
  function updateSun(px: number, pz: number): void {
    const cx = Math.round(px / SNAP) * SNAP;
    const cz = Math.round(pz / SNAP) * SNAP;
    sun.position.set(cx + 60, 95, cz + 30);
    sun.target.position.set(cx, 0, cz);
  }

  function setViewRange(voxels: number): void {
    const f = scene.fog as THREE.Fog | null;
    if (f) {
      f.near = voxels * 0.5;
      f.far = voxels * 0.98;
    }
  }

  return { scene, camera, renderer, sun, solidMaterial, waterMaterial, glassMaterial, updateSun, setViewRange };
}
