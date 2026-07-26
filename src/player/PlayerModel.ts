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
import { ALTURA_MUNDO, Appearance, DEFAULT_APPEARANCE, ESCALA_MODELO, PIVOS, buildBodyParts, hexToInt, sanitizeAppearance } from './Appearance';

type LimbName = 'armLeft' | 'armRight' | 'legLeft' | 'legRight' | 'head';

/** Altura do pivô de cada membro, em metros a partir dos pés. */
/**
 * Altura de cada articulação, **derivada** das proporções em `Appearance.ts`.
 *
 * Antes eram números cravados aqui (1,34 / 0,80 / 1,40), casando com uma versão anterior das
 * proporções. Mexer numa altura do corpo sem lembrar de mexer nestes três giraria os membros em
 * torno de um ponto que já não é a articulação — o braço sairia do ombro ao caminhar, e nada
 * apontaria para a causa.
 */
const PIVOTS: Record<LimbName, number> = {
  armLeft: PIVOS.ombro,
  armRight: PIVOS.ombro,
  legLeft: PIVOS.quadril,
  legRight: PIVOS.quadril,
  head: PIVOS.pescoco,
};

export class PlayerModel {
  /**
   * Transformação de MUNDO do avatar: posição e rotação. Quem escreve nela é o `main`.
   *
   * Nada dentro desta classe pode tocar em `group.position`, e essa separação é o conserto de um
   * defeito real — ver `corpo`.
   */
  readonly group = new THREE.Group();

  /**
   * O corpo em si, dentro do `group`. Carrega a escala e o balanço da caminhada.
   *
   * ## O defeito que este nível a mais corrige
   *
   * O balanço da marcha fazia `this.group.position.y = ...`, e o `main` tinha acabado de escrever
   * a posição do jogador nesse mesmo `group` — a linha seguinte a **descartava**, plantando o
   * avatar em `y = 0` do mundo. Era literalmente "a skin está ficando dentro da terra": o boneco
   * ficava enterrado na origem vertical do mundo, e não nos pés do jogador.
   *
   * Um objeto não pode ter dois donos para a mesma propriedade. Com o corpo num grupo interno, o
   * balanço é local e não existe caminho para ele sobrescrever a posição de mundo.
   */
  private corpo = new THREE.Group();
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
    this.corpo.clear();
    this.group.clear();
  }

  private build(): void {
    this.clear();
    const a = this.appearance;

    // A ponte entre as duas réguas: as peças são descritas em metros, o mundo conta em
    // mini-voxels. Sem esta linha o avatar sai com um terço do tamanho do próprio corpo de
    // colisão — que era o outro lado do relato "não respeita as proporções".
    this.corpo.scale.setScalar(ESCALA_MODELO);
    this.group.add(this.corpo);
    // `build` recria os pivôs, então a visibilidade precisa ser reaplicada depois — senão trocar
    // de aparência em primeira pessoa faria a cabeça reaparecer na frente da câmera.

    for (const name of Object.keys(PIVOTS) as LimbName[]) {
      const pivot = new THREE.Group();
      pivot.position.set(0, PIVOTS[name] * a.build, 0);
      this.limbs.set(name, pivot);
      this.corpo.add(pivot);
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
      const parent = part.limb ? this.limbs.get(part.limb)! : this.corpo;

      if (part.limb) {
        // Dentro do pivô a peça é posicionada em relação ao ombro/quadril/pescoço.
        mesh.position.set(ox * a.build, oy * a.build - PIVOTS[part.limb] * a.build, oz * a.build);
      } else {
        mesh.position.set(ox * a.build, oy * a.build, oz * a.build);
      }
      parent.add(mesh);
    }

    this.aplicarVisibilidade();
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
    //
    // Em `corpo`, NUNCA em `group`: o `group` carrega a posição de mundo escrita pelo `main`, e
    // escrever nela aqui a descartava — era o avatar enterrado em `y = 0`. Como `corpo` já está
    // escalado, o valor é em metros e a amplitude real acompanha o tamanho do boneco.
    this.corpo.position.y = moving ? Math.abs(Math.sin(this.walkCycle * 2)) * 0.02 : 0;
  }

  /**
   * Primeira pessoa: esconde **só a cabeça**, não o boneco inteiro.
   *
   * O motivo de existir esta distinção: a câmera fica dentro da cabeça, e o modelo inteiro
   * visível apareceria como uma parede de textura ocupando a tela. Mas esconder tudo custa o
   * corpo — olhar para baixo e não ver as próprias pernas é o que faz um jogo em primeira pessoa
   * parecer uma câmera flutuante em vez de um corpo no mundo.
   *
   * A cabeça oculta não deixa buraco no pescoço porque o tronco já termina acima da linha do
   * pescoço: o que se vê de dentro é o topo do tronco, não o vazio.
   */
  public setPrimeiraPessoa(ativo: boolean): void {
    this.primeiraPessoa = ativo;
    this.aplicarVisibilidade();
  }

  private primeiraPessoa = false;
  private visivel = true;

  private aplicarVisibilidade(): void {
    this.group.visible = this.visivel;
    const cabeca = this.limbs.get('head');
    // Só a cabeça some. Braços, tronco e pernas continuam desenhados — e continuam projetando
    // sombra, que é parte do que faz o corpo parecer estar mesmo ali.
    if (cabeca) cabeca.visible = !this.primeiraPessoa;
  }

  public setVisible(visible: boolean): void {
    this.visivel = visible;
    this.aplicarVisibilidade();
    this.group.visible = visible;
  }

  /**
   * Peças do corpo: os pivôs dos membros e as caixas fixas (tronco, cinto).
   *
   * Uma camada abaixo da transformação de mundo. Existe para que teste e acessórios não precisem
   * saber o formato da árvore — foi justamente o acoplamento a `group.children` que fez dois
   * testes quebrarem quando o `corpo` entrou no meio.
   */
  public get pecas(): THREE.Object3D[] {
    return this.corpo.children;
  }

  /** Deslocamento vertical do balanço da marcha, em metros locais. Exposto para teste. */
  public get alturaDoBalanco(): number {
    return this.corpo.position.y;
  }

  /** Altura real do modelo em UNIDADES DE MUNDO, já com a variação de porte aplicada. */
  public get height(): number {
    return ALTURA_MUNDO * this.appearance.build;
  }

  public dispose(): void {
    this.clear();
    this.group.removeFromParent();
  }
}
