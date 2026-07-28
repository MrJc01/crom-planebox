// Avatares dos outros jogadores na sessão P2P.
//
// Cada peer vira um `PlayerModel` na cena, com a aparência que ele mesmo enviou — é assim que o
// personagem customizado "aparece para os outros online". Continua tudo client-side: a aparência
// viaja no `player_state` pelo DataChannel WebRTC, direto entre os navegadores; o relay só
// intermedia a sinalização e nunca vê esses dados.
//
// A posição recebida é interpolada em vez de aplicada de imediato: os pacotes chegam a poucos
// hertz e, aplicados crus, o avatar anda aos saltos.

import * as THREE from 'three';
import { Appearance, sanitizeAppearance } from './Appearance';
import { PlayerModel } from './PlayerModel';
import { ALTURA_MUNDO } from './Appearance';

interface Avatar {
  model: PlayerModel;
  label: THREE.Sprite;
  name: string;
  /** Posição-alvo vinda da rede; a exibida persegue esta. */
  target: THREE.Vector3;
  shown: THREE.Vector3;
  yaw: number;
  pitch: number;
  /** Velocidade estimada pela distância percorrida, para escolher a animação. */
  speed: number;
  lastSeen: number;
  appearanceKey: string;
}

/** Some com o avatar de quem parou de mandar estado (aba fechada sem avisar, queda de conexão). */
const STALE_MS = 12_000;

export class AvatarManager {
  private scene: THREE.Scene;
  private avatars = new Map<string, Avatar>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Aplica um `player_state` recebido pela rede. */
  public updateFromState(
    playerId: string,
    name: string,
    x: number, y: number, z: number,
    yaw: number, pitch: number,
    appearance?: Appearance,
  ): void {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;

    const clean = sanitizeAppearance(appearance);
    const key = JSON.stringify(clean);
    let avatar = this.avatars.get(playerId);

    if (!avatar) {
      const model = new PlayerModel(clean);
      const label = makeNameLabel(name);
      // Derivado da altura do avatar, e não cravado: com o número solto (2.15, calibrado para
      // um modelo de 1,8) a plaquinha foi parar na altura do peito quando o modelo passou a ter
      // o tamanho certo de 5,3.
      label.position.set(0, ALTURA_MUNDO + 0.45, 0);
      model.group.add(label);
      this.scene.add(model.group);

      avatar = {
        model, label, name,
        target: new THREE.Vector3(x, y, z),
        shown: new THREE.Vector3(x, y, z),
        yaw, pitch, speed: 0,
        lastSeen: Date.now(),
        appearanceKey: key,
      };
      this.avatars.set(playerId, avatar);
    } else if (avatar.appearanceKey !== key) {
      // O peer trocou de visual na tela de customização: reconstrói o boneco.
      avatar.model.setAppearance(clean);
      avatar.appearanceKey = key;
    }

    // A velocidade sai da distância entre pacotes — o protocolo não transporta velocidade.
    avatar.speed = Math.hypot(x - avatar.target.x, z - avatar.target.z) * 4;
    avatar.target.set(x, y, z);
    avatar.yaw = yaw;
    avatar.pitch = pitch;
    avatar.lastSeen = Date.now();

    if (avatar.name !== name) {
      avatar.name = name;
      avatar.model.group.remove(avatar.label);
      disposeLabel(avatar.label);
      avatar.label = makeNameLabel(name);
      avatar.// Derivado da altura do avatar, e não cravado: com o número solto (2.15, calibrado para
      // um modelo de 1,8) a plaquinha foi parar na altura do peito quando o modelo passou a ter
      // o tamanho certo de 5,3.
      label.position.set(0, ALTURA_MUNDO + 0.45, 0);
      avatar.model.group.add(avatar.label);
    }
  }

  public remove(playerId: string): void {
    const avatar = this.avatars.get(playerId);
    if (!avatar) return;
    disposeLabel(avatar.label);
    avatar.model.dispose();
    this.avatars.delete(playerId);
  }

  public clear(): void {
    for (const id of Array.from(this.avatars.keys())) this.remove(id);
  }

  public update(dt: number): void {
    const now = Date.now();
    for (const [id, a] of this.avatars) {
      if (now - a.lastSeen > STALE_MS) {
        this.remove(id);
        continue;
      }

      // Perseguição exponencial: suave, e sem depender da taxa de pacotes.
      a.shown.lerp(a.target, Math.min(1, dt * 9));
      a.model.group.position.copy(a.shown);
      a.model.update(dt, a.speed, true, a.yaw, a.pitch);

      // A etiqueta gira junto do grupo; contra-rotaciona para ficar sempre legível.
      a.label.rotation.y = -a.yaw;
    }
  }

  public get count(): number {
    return this.avatars.size;
  }

  /**
   * Onde este jogador está agora, ou `null` se ele não está sendo mostrado.
   *
   * Devolve a posição **exibida** e não a última recebida: é onde o avatar está desenhado, e a voz
   * tem de sair da boca que o jogador está vendo. Com a posição-alvo, a voz chegaria antes do corpo
   * e a diferença é audível quando alguém corre.
   */
  public posicaoDe(playerId: string): { x: number; y: number; z: number } | null {
    const a = this.avatars.get(playerId);
    return a ? { x: a.shown.x, y: a.shown.y, z: a.shown.z } : null;
  }

  /** Os ids sendo mostrados agora. */
  public idsVisiveis(): string[] {
    return Array.from(this.avatars.keys());
  }

  /**
   * Quem está por perto, com id e nome.
   *
   * Existe para o comando de silêncio poder resolver um nome digitado em id — o silêncio é
   * guardado por id, que é o que não muda quando alguém troca de apelido.
   */
  public presentes(): { id: string; nome: string }[] {
    return Array.from(this.avatars.entries()).map(([id, a]) => ({ id, nome: a.name }));
  }
}

function makeNameLabel(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.fillText(name.slice(0, 18), 128, 41);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  // Acompanha a escala do avatar: uma plaquinha de 1,4 ao lado de um boneco de 5,3 fica
  // ilegível de longe.
  sprite.scale.set(2.8, 0.7, 1);
  return sprite;
}

function disposeLabel(sprite: THREE.Sprite): void {
  const mat = sprite.material as THREE.SpriteMaterial;
  mat.map?.dispose();
  mat.dispose();
  sprite.removeFromParent();
}
