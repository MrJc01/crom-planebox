// Boneco 3D do jogador, montado a partir de uma `Appearance`.
//
// Usado em três lugares, sempre a mesma classe para o personagem ser idêntico nos três:
//   1. terceira pessoa (o próprio jogador se vendo);
//   2. avatares dos outros jogadores no multiplayer P2P;
//   3. o preview girando na tela de customização.
//
// Os membros ficam agrupados em pivôs no ombro/quadril, não no centro da peça — sem isso a
// rotação do ciclo de caminhada gira o braço em torno da barriga em vez do ombro.

import * as THREE from 'three';
import { Appearance, DEFAULT_APPEARANCE, PLAYER_HEIGHT, buildBodyParts, hexToInt, sanitizeAppearance } from './Appearance';

type LimbName = 'armLeft' | 'armRight' | 'legLeft' | 'legRight' | 'head';

/** Altura do pivô de cada membro, em metros a partir dos pés. */
const PIVOTS: Record<LimbName, number> = {
  armLeft: 1.34,  // ombro
  armRight: 1.34,
  legLeft: 0.8,   // quadril
  legRight: 0.8,
  head: 1.4,      // pescoço
};

export class PlayerModel {
  readonly group = new THREE.Group();
  private limbs = new Map<LimbName, THREE.Group>();
  private disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
  private appearance: Appearance;
  private walkCycle = 0;

  constructor(appearance: Appearance = DEFAULT_APPEARANCE) {
    this.appearance = sanitizeAppearance(appearance);
    this.build();
  }

  /** Troca a aparência em tempo real (usado pelo preview da tela de customização). */
  public setAppearance(appearance: Appearance): void {
    this.appearance = sanitizeAppearance(appearance);
    this.build();
  }

  public getAppearance(): Appearance {
    return { ...this.appearance };
  }

  private clear(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.limbs.clear();
    this.group.clear();
  }

  private build(): void {
    this.clear();
    const a = this.appearance;

    for (const name of Object.keys(PIVOTS) as LimbName[]) {
      const pivot = new THREE.Group();
      pivot.position.set(0, PIVOTS[name] * a.build, 0);
      this.limbs.set(name, pivot);
      this.group.add(pivot);
    }

    // Uma cor pode repetir em várias peças; compartilhar o material evita criar dezenas
    // de materiais idênticos por avatar (importante com muitos jogadores na cena).
    const materials = new Map<string, THREE.MeshLambertMaterial>();
    const materialFor = (hex: string): THREE.MeshLambertMaterial => {
      let mat = materials.get(hex);
      if (!mat) {
        mat = new THREE.MeshLambertMaterial({ color: hexToInt(hex) });
        materials.set(hex, mat);
        this.disposables.push(mat);
      }
      return mat;
    };

    for (const part of buildBodyParts(a)) {
      const geo = new THREE.BoxGeometry(part.size[0] * a.build, part.size[1] * a.build, part.size[2] * a.build);
      this.disposables.push(geo);

      const mesh = new THREE.Mesh(geo, materialFor(a[part.slot]));
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const [ox, oy, oz] = part.offset;
      const parent = part.limb ? this.limbs.get(part.limb)! : this.group;

      if (part.limb) {
        // Dentro do pivô a peça é posicionada em relação ao ombro/quadril/pescoço.
        mesh.position.set(ox * a.build, oy * a.build - PIVOTS[part.limb] * a.build, oz * a.build);
      } else {
        mesh.position.set(ox * a.build, oy * a.build, oz * a.build);
      }
      parent.add(mesh);
    }
  }

  /**
   * Anima o boneco. `speed` é a velocidade horizontal em m/s; `grounded` false deixa as pernas
   * em pose de salto em vez de continuar o passo no ar.
   */
  public update(dt: number, speed: number, grounded: boolean, yaw: number, pitch: number): void {
    this.group.rotation.y = yaw;

    const head = this.limbs.get('head');
    // A cabeça acompanha a mira vertical, com limite para o pescoço não inverter.
    if (head) head.rotation.x = Math.max(-1.2, Math.min(1.2, pitch));

    const moving = speed > 0.15;
    if (moving && grounded) {
      this.walkCycle += dt * Math.min(14, 4 + speed * 1.8);
    } else if (!moving) {
      // Volta suavemente à pose neutra em vez de congelar no meio do passo.
      this.walkCycle += dt * 6;
    }

    const swing = grounded ? (moving ? Math.min(0.85, 0.25 + speed * 0.12) : 0) : 0.5;
    const s = Math.sin(this.walkCycle);

    const armL = this.limbs.get('armLeft');
    const armR = this.limbs.get('armRight');
    const legL = this.limbs.get('legLeft');
    const legR = this.limbs.get('legRight');

    if (!grounded) {
      // Pose de salto: braços um pouco abertos, pernas recolhidas.
      if (armL) armL.rotation.x = -0.7;
      if (armR) armR.rotation.x = -0.7;
      if (legL) legL.rotation.x = 0.4;
      if (legR) legR.rotation.x = -0.2;
      return;
    }

    if (armL) armL.rotation.x = -s * swing;
    if (armR) armR.rotation.x = s * swing;
    if (legL) legL.rotation.x = s * swing;
    if (legR) legR.rotation.x = -s * swing;

    // Balanço sutil do corpo, o que separa a marcha "viva" do boneco rígido.
    this.group.position.y = moving ? Math.abs(Math.sin(this.walkCycle * 2)) * 0.02 : 0;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /** Altura real do modelo, já com a variação de porte aplicada. */
  public get height(): number {
    return PLAYER_HEIGHT * this.appearance.build;
  }

  public dispose(): void {
    this.clear();
    this.group.removeFromParent();
  }
}
