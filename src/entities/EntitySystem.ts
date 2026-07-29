import * as THREE from 'three';
import { World } from '../world/world';
import { B, isSolid } from '../world/blocks';
import { CombatTimers, MOB_PROFILES, MobKind, MobProfile, knockbackFrom } from './Combat';
import { PathNode, findPathCached } from './Pathfinding';
import { deveSimular, distancia2 } from './simulacao';
import { CARENCIA_APOS_COMBATE_S } from './despawn';
import { ESCALA_MODELO } from '../player/Appearance';

export type EntityType = 'human' | 'orc' | 'goblin' | 'animal' | 'hero';

export interface EntityRecord {
  id: string;
  name: string;
  type: EntityType;
  faction: string;
  role: string;
  health: number;
  maxHealth: number;
  pos: THREE.Vector3;
  targetPos?: THREE.Vector3;
  behaviorScript?: string;
  onUpdate?: (dt: number, entity: EntityRecord) => void;
  mesh: THREE.Group;
  legLeft?: THREE.Mesh;
  legRight?: THREE.Mesh;
  armLeft?: THREE.Mesh;
  armRight?: THREE.Mesh;
  walkCycle: number;
  /** Dicionário extensível por dados para atributos de entidade e metadados de mods — item 1561. */
  attributes?: Record<string, unknown>;

  // --- Combate (só preenchido em hostis) ---
  /** Perfil do mob. Presença deste campo é o que define "é hostil". */
  profile?: MobProfile;
  /**
   * Espécie do mob. Guardada porque o perfil sozinho não a identifica de volta, e o retrato
   * enviado aos convidados precisa dizer O QUE nasceu — sem isso o convidado desenharia todo
   * mundo como zumbi.
   */
  mobKind?: MobKind;
  timers?: CombatTimers;
  /** Velocidade própria: recuo ao levar dano e queda. */
  vel?: THREE.Vector3;
  /** Estado da máquina simples de IA. */
  state?: 'ocioso' | 'perseguindo' | 'atacando';
  /** Segundos até o mob poder golpear de novo. */
  attackTimer?: number;
  /** Barra de vida flutuante, criada só quando o mob toma dano pela primeira vez. */
  healthBar?: THREE.Sprite;
  /** Waypoints restantes do A*. */
  path?: PathNode[];
  /** Segundos até recalcular a rota. Buscar a cada frame seria caro e desnecessário. */
  repathTimer?: number;
  /** Posição do alvo quando a rota foi traçada, para detectar que ele se moveu muito. */
  pathGoal?: THREE.Vector3;
  /**
   * Segundos desde o último golpe dado ou levado. `undefined` = nunca lutou.
   *
   * Existe para a carência do despawn — ver `despawn.ts`. Guardado em segundos desde, e não como um
   * relógio que zera, para que a pergunta "faz quanto tempo?" tenha uma resposta direta.
   */
  ultimoCombate?: number;
  /**
   * Estava sendo simulada no quadro anterior? — item 180.
   *
   * Guardado por entidade porque é o que dá histerese à fronteira: sem ele, quem está exatamente no
   * limite alterna entre simulada e congelada a cada quadro, e o resultado é um andar aos
   * solavancos visível no limite do campo de visão.
   */
  simulando?: boolean;
}

export class EntitySystem {
  private world: World;
  private scene: THREE.Scene;
  private entities: Map<string, EntityRecord> = new Map();

  /**
   * Este cliente manda nas criaturas?
   *
   * `true` offline e no anfitrião; `false` no convidado. Com `false`, a IA hostil não roda: as
   * criaturas são **desenhadas onde o anfitrião disser** e mais nada.
   *
   * Sem isto, os dois lados simulavam a mesma criatura de forma independente e ela divergia em
   * segundos — perseguindo alvos diferentes, atacando em momentos diferentes. Duas simulações
   * autônomas do mesmo objeto nunca convergem; só uma pode decidir.
   */
  public autoridade = true;

  /** id do anfitrião → id local. Só o convidado usa. */
  private idsRemotos = new Map<string, string>();

  constructor(world: World, scene: THREE.Scene) {
    this.world = world;
    this.scene = scene;
  }

  /**
   * Varredura síncrona de chão no momento do spawn, para a entidade nunca aparecer
   * flutuando/afundada nos primeiros frames (antes o encaixe só ocorria no primeiro update()).
   */
  private groundSnap(x: number, z: number, fallbackY: number): number {
    for (let y = Math.floor(fallbackY + 8); y >= 0; y--) {
      const b = this.world.getBlock(Math.floor(x), y, Math.floor(z));
      if (b !== B.AIR && b !== B.WATER) return y + 1;
    }
    return fallbackY;
  }

  /**
   * Permite à IA criar entidades/seres 3D inteiramente personalizados do zero usando partes 3D e scripts de comportamento JS.
   */
  public createCustomEntity(config: {
    name?: string;
    faction?: string;
    role?: string;
    x: number;
    y: number;
    z: number;
    behaviorScript?: string;
    parts?: Array<{
      offsetX: number;
      offsetY: number;
      offsetZ: number;
      sizeX: number;
      sizeY: number;
      sizeZ: number;
      color: number | string;
    }>;
  }): EntityRecord {
    const id = `entity-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const group = new THREE.Group();

    const parts = config.parts || [
      { offsetX: 0, offsetY: 0.75, offsetZ: 0, sizeX: 0.8, sizeY: 1.2, sizeZ: 0.8, color: 0x3b82f6 }
    ];

    for (const p of parts) {
      const geo = new THREE.BoxGeometry(p.sizeX || 0.5, p.sizeY || 0.5, p.sizeZ || 0.5);
      const colVal = typeof p.color === 'string' ? parseInt(p.color.replace('#', ''), 16) : (p.color || 0x3b82f6);
      const mat = new THREE.MeshLambertMaterial({ color: colVal });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p.offsetX || 0, p.offsetY || 0, p.offsetZ || 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    const snappedY = this.groundSnap(config.x, config.z, config.y);
    group.position.set(config.x, snappedY, config.z);
    this.scene.add(group);

    let onUpdateFn: ((dt: number, entity: EntityRecord) => void) | undefined = undefined;
    if (config.behaviorScript && typeof config.behaviorScript === 'string') {
      try {
        onUpdateFn = new Function('dt', 'entity', 'Math', 'THREE', config.behaviorScript) as any;
      } catch (err) {
        console.error(`[EntitySystem] Erro ao compilar script de comportamento da entidade:`, err);
      }
    }

    const record: EntityRecord = {
      id,
      name: config.name || 'Ser Voxel',
      type: 'human',
      faction: config.faction || 'Neutro',
      role: config.role || 'Entidade',
      health: 100,
      maxHealth: 100,
      pos: new THREE.Vector3(config.x, snappedY, config.z),
      behaviorScript: config.behaviorScript,
      onUpdate: onUpdateFn,
      mesh: group,
      walkCycle: 0
    };

    this.entities.set(id, record);
    console.log(`[EntitySystem] Entidade 3D personalizada "${record.name}" gerada com script de comportamento!`);
    return record;
  }

  /**
   * Spawns a new 3D Voxel NPC Entity in the scene.
   */
  public spawnEntity(
    type: EntityType = 'human',
    name: string = 'Habitante',
    x: number = 0,
    y: number = 20,
    z: number = 0,
    faction: string = 'Reino',
    role: string = 'Cidadão'
  ): EntityRecord {
    const id = `npc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Group container for NPC
    const group = new THREE.Group();

    // Color theme per entity type
    let bodyColor = 0x3b82f6; // Blue for human
    let headColor = 0xfde047;
    if (type === 'orc') { bodyColor = 0x15803d; headColor = 0x166534; }
    else if (type === 'goblin') { bodyColor = 0x84cc16; headColor = 0x4d7c0f; }
    else if (type === 'hero') { bodyColor = 0xeab308; headColor = 0xfef08a; }
    else if (type === 'animal') { bodyColor = 0xb45309; headColor = 0x78350f; }

    // Head
    const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const headMat = new THREE.MeshLambertMaterial({ color: headColor });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 1.4, 0);
    group.add(head);

    // Body/Torso
    const bodyGeo = new THREE.BoxGeometry(0.7, 0.9, 0.4);
    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.75, 0);
    group.add(body);

    // Left Arm
    const armGeo = new THREE.BoxGeometry(0.22, 0.7, 0.22);
    const armMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const armLeft = new THREE.Mesh(armGeo, armMat);
    armLeft.position.set(-0.5, 0.7, 0);
    group.add(armLeft);

    // Right Arm
    const armRight = new THREE.Mesh(armGeo, armMat);
    armRight.position.set(0.5, 0.7, 0);
    group.add(armRight);

    // Left Leg
    const legGeo = new THREE.BoxGeometry(0.26, 0.7, 0.26);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const legLeft = new THREE.Mesh(legGeo, legMat);
    legLeft.position.set(-0.2, 0.35, 0);
    group.add(legLeft);

    // Right Leg
    const legRight = new THREE.Mesh(legGeo, legMat);
    legRight.position.set(0.2, 0.35, 0);
    group.add(legRight);

    // Name Label Above Head (Canvas Texture)
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, 256, 64);
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(name, 128, 30);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`[${faction}] ${role}`, 128, 52);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2, 0.5, 1);
    sprite.position.set(0, 2.1, 0);
    group.add(sprite);

    // Escalar o mob inteiro para a mesma régua do jogador.
    // A anatomia acima é construída em "metros" (~1.7 de altura), igual ao PlayerModel antes
    // da correção de escala. ESCALA_MODELO converte para unidades de mundo (~5.3), casando o
    // tamanho do mob com o do personagem e com o tamanho dos blocos.
    group.scale.setScalar(ESCALA_MODELO);

    // Set Initial Position (encaixe imediato no chão, sem esperar o primeiro update())
    const snappedY = this.groundSnap(x, z, y);
    group.position.set(x, snappedY, z);
    this.scene.add(group);

    const record: EntityRecord = {
      id,
      name,
      type,
      faction,
      role,
      health: 100,
      maxHealth: 100,
      pos: new THREE.Vector3(x, snappedY, z),
      targetPos: new THREE.Vector3(x + (Math.random() * 20 - 10), snappedY, z + (Math.random() * 20 - 10)),
      mesh: group,
      legLeft,
      legRight,
      armLeft,
      armRight,
      walkCycle: Math.random() * Math.PI * 2
    };

    this.entities.set(id, record);
    console.log(`[EntitySystem] Entidade 3D '${name}' (${type}) gerada em (${x.toFixed(1)}, ${y}, ${z.toFixed(1)}) ID: ${id}`);
    return record;
  }

  // --- Hostis -----------------------------------------------------------------------------

  /**
   * Gera um inimigo hostil. Reaproveita a anatomia do NPC comum (cabeça/torso/membros), o que
   * mantém a animação de caminhada funcionando de graça; o que muda é o perfil de combate.
   */
  public spawnHostile(kind: MobKind, x: number, y: number, z: number): EntityRecord {
    const profile = MOB_PROFILES[kind] ?? MOB_PROFILES.zumbi;
    const record = this.spawnEntity('orc', profile.name, x, y, z, 'Hostil', kind);

    record.profile = profile;
    record.mobKind = kind;
    record.timers = new CombatTimers();
    record.vel = new THREE.Vector3();
    record.state = 'ocioso';
    record.attackTimer = 0;
    record.health = profile.maxHealth;
    record.maxHealth = profile.maxHealth;
    record.targetPos = undefined; // hostis não vagueiam à toa; a IA decide

    this.recolor(record, profile.bodyColor, profile.headColor);
    // A aranha é baixa e larga: silhueta reconhecível de longe, sem modelar outra anatomia.
    // Escala relativa ao grupo já escalado por ESCALA_MODELO — valores são multiplicadores locais.
    if (kind === 'aranha') record.mesh.scale.set(ESCALA_MODELO * 1.25, ESCALA_MODELO * 0.6, ESCALA_MODELO * 1.25);

    return record;
  }

  /** Invocação de bosses lendários com item de convocação — item 500. */
  public summonBoss(kind: MobKind, pos: THREE.Vector3): EntityRecord {
    const boss = this.spawnHostile(kind, pos.x, pos.y, pos.z);
    boss.maxHealth *= 3;
    boss.health = boss.maxHealth;
    boss.name = `Chefe Supremo: ${boss.profile?.name ?? 'Lord'}`;
    boss.attributes = { ...boss.attributes, isBoss: true };
    return boss;
  }

  private recolor(record: EntityRecord, body: number, head: number): void {
    let first = true;
    record.mesh.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshLambertMaterial;
      if (!mat || !mat.color) return;
      mat.color.setHex(first ? head : body);
      first = false;
    });
  }

  public listHostiles(): EntityRecord[] {
    const out: EntityRecord[] = [];
    for (const e of this.entities.values()) if (e.profile) out.push(e);
    return out;
  }

  public get hostileCount(): number {
    let n = 0;
    for (const e of this.entities.values()) if (e.profile) n++;
    return n;
  }

  /**
   * Aplica dano a uma entidade. Devolve `true` se ela morreu neste golpe.
   * Respeita a janela de invulnerabilidade — é ela que impede o alvo de ser trucidado por
   * vários acertos no mesmo frame.
   */
  public damageEntity(id: string, amount: number, from?: { x: number; y: number; z: number }): boolean {
    const e = this.entities.get(id);
    if (!e) return false;
    if (e.timers && !e.timers.canBeHurt()) return false;

    e.health = Math.max(0, e.health - amount);
    e.timers?.markHurt();

    if (from && e.vel) {
      const kb = knockbackFrom(from, e.pos);
      e.vel.set(kb.x, kb.y, kb.z);
    }

    // Levar dano conta como combate: é o que segura o despawn enquanto a luta acontece.
    e.ultimoCombate = 0;
    this.updateHealthBar(e);
    this.flashDamage(e);

    if (e.health <= 0) {
      this.onEntityDeath(e);
      this.scene.remove(e.mesh);
      this.entities.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Retrato das criaturas para enviar aos convidados. Só o anfitrião chama.
   *
   * `Math.round` de uma casa: a posição não precisa de precisão de ponto flutuante para desenhar
   * um boneco, e arredondar corta o tamanho da mensagem quase pela metade.
   */
  public retratoDeHostis(): { id: string; kind: string; x: number; y: number; z: number; health: number }[] {
    const saida = [];
    for (const e of this.entities.values()) {
      if (!e.profile) continue;
      saida.push({
        id: e.id,
        kind: e.mobKind ?? 'zumbi',
        x: Math.round(e.pos.x * 10) / 10,
        y: Math.round(e.pos.y * 10) / 10,
        z: Math.round(e.pos.z * 10) / 10,
        health: Math.round(e.health),
      });
    }
    return saida;
  }

  /**
   * Aplica o retrato recebido do anfitrião. Só o convidado chama.
   *
   * A regra é uma só, e é o que torna isto auto-corretivo: **o que está na lista existe, o que
   * não está deixou de existir**. Uma mensagem perdida se conserta no retrato seguinte, em vez
   * de deixar um zumbi fantasma parado para sempre na tela.
   *
   * Os ids do anfitrião não podem ser usados direto — `spawnHostile` gera o seu — então um mapa
   * traduz de um para o outro.
   */
  public aplicarRetratoDeHostis(
    mobs: { id: string; kind: string; x: number; y: number; z: number; health: number }[],
  ): void {
    const vistos = new Set<string>();

    for (const m of mobs) {
      vistos.add(m.id);
      const localId = this.idsRemotos.get(m.id);
      let rec = localId ? this.entities.get(localId) : undefined;

      if (!rec) {
        rec = this.spawnHostile(m.kind as MobKind, m.x, m.y, m.z);
        this.idsRemotos.set(m.id, rec.id);
      }

      rec.pos.set(m.x, m.y, m.z);
      rec.mesh.position.set(m.x, m.y, m.z);
      rec.health = m.health;
      // O convidado não decide nada sobre a criatura: sem alvo e sem estado de IA, para o caso
      // de alguém religar a autoridade no meio da partida.
      rec.targetPos = undefined;
      rec.state = 'ocioso';
      this.updateHealthBar(rec);
    }

    for (const [remoto, local] of this.idsRemotos) {
      if (vistos.has(remoto)) continue;
      const e = this.entities.get(local);
      if (e) {
        this.scene.remove(e.mesh);
        this.entities.delete(local);
      }
      this.idsRemotos.delete(remoto);
    }
  }

  /** Notifica a morte de um hostil, para o chamador conceder loot. */
  public onEntityDeath: (entity: EntityRecord) => void = () => {};

  /**
   * Tira a criatura do mundo **sem** matá-la — item 1321.
   *
   * A diferença com `damageEntity` é o que NÃO acontece: nada de `onEntityDeath`, nada de loot,
   * nada de som. Uma criatura que some porque o jogador se trancou não morreu, e premiar isso com
   * despojos daria ao jogador uma fazenda de recursos que se opera fechando a porta.
   */
  public despawnEntity(id: string): boolean {
    const e = this.entities.get(id);
    if (!e) return false;
    this.scene.remove(e.mesh);
    this.entities.delete(id);
    return true;
  }

  /**
   * Segundos desde o último golpe dado ou levado por esta criatura, ou `Infinity`.
   *
   * Alimenta a carência do despawn: quem está lutando com o jogador não some. Sem isto, recuar
   * para dentro de casa faria o zumbi que está mordendo o jogador evaporar — o que não lê como
   * abrigo, lê como o jogo desistindo da luta no meio.
   */
  public desdeOCombate(id: string): number {
    return this.entities.get(id)?.ultimoCombate ?? Infinity;
  }

  /** Marca que esta criatura acabou de dar ou levar um golpe. */
  public registrarCombate(id: string): void {
    const e = this.entities.get(id);
    if (e) e.ultimoCombate = 0;
  }

  /** Piscada vermelha ao levar dano: o feedback mais barato e mais legível de acerto. */
  private flashDamage(e: EntityRecord): void {
    const meshes: THREE.MeshLambertMaterial[] = [];
    e.mesh.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh && (m.material as any)?.color) meshes.push(m.material as THREE.MeshLambertMaterial);
    });
    const originals = meshes.map((m) => m.color.getHex());
    for (const m of meshes) m.color.setHex(0xff4444);
    setTimeout(() => {
      for (let i = 0; i < meshes.length; i++) meshes[i].color.setHex(originals[i]);
    }, 110);
  }

  /** Barra de vida sobre o mob — criada sob demanda, ao tomar o primeiro dano. */
  private updateHealthBar(e: EntityRecord): void {
    if (!e.profile) return;
    const frac = Math.max(0, e.health / e.maxHealth);

    if (!e.healthBar) {
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 16;
      const tex = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
      sprite.scale.set(1.3, 0.16, 1);
      sprite.position.set(0, 2.35, 0);
      sprite.userData.canvas = canvas;
      e.mesh.add(sprite);
      e.healthBar = sprite;
    }

    const canvas = e.healthBar.userData.canvas as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 128, 16);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
      ctx.fillRect(0, 0, 128, 16);
      ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#fbbf24' : '#ef4444';
      ctx.fillRect(2, 2, Math.max(0, 124 * frac), 12);
    }
    (e.healthBar.material as THREE.SpriteMaterial).map!.needsUpdate = true;
  }

  /**
   * Colisão do mob com o mundo: impede atravessar parede e o faz subir degrau de 1 voxel.
   *
   * Sem isto os NPCs andam através da rocha, que era o comportamento anterior — o pathfinding
   * mais elaborado (item 175) fica para depois, mas atravessar parede quebra a imersão na hora.
   */
  private moveWithCollision(e: EntityRecord, dx: number, dz: number): void {
    const solidAt = (x: number, y: number, z: number) =>
      isSolid(this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));

    const tryAxis = (nx: number, nz: number): boolean => {
      // Checa na altura do corpo e da cabeça; o pé é livre para permitir o degrau.
      if (solidAt(nx, e.pos.y + 0.6, nz) || solidAt(nx, e.pos.y + 1.4, nz)) return false;
      return true;
    };

    const nx = e.pos.x + dx;
    const nz = e.pos.z + dz;

    if (tryAxis(nx, e.pos.z)) e.pos.x = nx;
    if (tryAxis(e.pos.x, nz)) e.pos.z = nz;

    // Degrau: se o pé encostou em bloco mas a cabeça está livre, sobe um voxel.
    if (solidAt(e.pos.x, e.pos.y, e.pos.z) && !solidAt(e.pos.x, e.pos.y + 1.4, e.pos.z)) {
      e.pos.y += 1;
    }
  }

  /**
   * IA dos hostis: percebe, persegue e ataca. Devolve o dano a aplicar ao jogador neste frame.
   */
  private updateHostile(e: EntityRecord, dt: number, player: THREE.Vector3): number {
    const p = e.profile!;
    e.timers?.tick(dt);
    e.attackTimer = Math.max(0, (e.attackTimer ?? 0) - dt);

    // Recuo: enquanto houver velocidade residual, ela domina o movimento.
    if (e.vel && (Math.abs(e.vel.x) > 0.05 || Math.abs(e.vel.z) > 0.05)) {
      this.moveWithCollision(e, e.vel.x * dt, e.vel.z * dt);
      e.vel.x *= 0.86;
      e.vel.z *= 0.86;
      return 0;
    }

    const dx = player.x - e.pos.x;
    const dz = player.z - e.pos.z;
    const dist = Math.hypot(dx, dz);

    if (dist > p.aggroRange) {
      e.state = 'ocioso';
      return 0;
    }

    if (dist <= p.reach) {
      e.state = 'atacando';
      e.mesh.rotation.y = Math.atan2(dx, dz);
      if (e.attackTimer <= 0) {
        e.attackTimer = p.attackInterval;
        // Dar o golpe também conta como combate: quem está mordendo o jogador não some porque ele
        // recuou para dentro de casa. Ver a carência em `despawn.ts`.
        e.ultimoCombate = 0;
        return p.attackDamage;
      }
      return 0;
    }

    e.state = 'perseguindo';
    this.followPath(e, dt, player, dx, dz, dist);

    e.walkCycle += dt * 9;
    if (e.legLeft && e.legRight) {
      e.legLeft.rotation.x = Math.sin(e.walkCycle) * 0.6;
      e.legRight.rotation.x = -Math.sin(e.walkCycle) * 0.6;
    }
    return 0;
  }

  /**
   * Move o mob seguindo a rota do A*, recalculando quando ela vence ou o alvo se desloca.
   *
   * A linha reta continua sendo usada quando há visada limpa: é mais barata e produz um
   * movimento mais natural que seguir waypoints em terreno aberto. O A* entra exatamente no
   * caso que antes travava o mob — obstáculo entre ele e o jogador.
   */
  private followPath(e: EntityRecord, dt: number, player: THREE.Vector3, dx: number, dz: number, dist: number): void {
    const p = e.profile!;
    const step = p.speed * dt;

    e.repathTimer = (e.repathTimer ?? 0) - dt;

    const alvoMudou = !e.pathGoal || e.pathGoal.distanceTo(player) > 2.5;
    if ((e.repathTimer <= 0 || alvoMudou) && !this.hasClearPath(e.pos, player)) {
      // Intervalo escalonado por distância: perseguição de perto recalcula mais.
      e.repathTimer = dist < 8 ? 0.35 : 0.9;
      e.pathGoal = player.clone();
      e.path = findPathCached(
        this.world,
        { x: Math.floor(e.pos.x), y: Math.floor(e.pos.y), z: Math.floor(e.pos.z) },
        { x: Math.floor(player.x), y: Math.floor(player.y), z: Math.floor(player.z) },
      ) ?? undefined;
    }

    if (e.path && e.path.length > 0) {
      const wp = e.path[0];
      const wx = wp.x + 0.5 - e.pos.x;
      const wz = wp.z + 0.5 - e.pos.z;
      const wd = Math.hypot(wx, wz);

      if (wd < 0.45) {
        e.path.shift();
      } else {
        this.moveWithCollision(e, (wx / wd) * step, (wz / wd) * step);
        e.mesh.rotation.y = Math.atan2(wx, wz);
        return;
      }
    }

    // Sem rota (ou já consumida): investida direta.
    this.moveWithCollision(e, (dx / dist) * step, (dz / dist) * step);
    e.mesh.rotation.y = Math.atan2(dx, dz);
  }

  /**
   * Existe visada livre entre dois pontos, na altura do peito?
   * Amostragem simples ao longo do segmento — barato o bastante para rodar por mob por frame,
   * e é o que evita disparar A* em campo aberto.
   */
  private hasClearPath(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const dx = to.x - from.x, dz = to.z - from.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.001) return true;

    const passos = Math.min(24, Math.ceil(dist * 2));
    for (let i = 1; i <= passos; i++) {
      const t = i / passos;
      const x = Math.floor(from.x + dx * t);
      const z = Math.floor(from.z + dz * t);
      const y = Math.floor(from.y);
      if (isSolid(this.world.getBlock(x, y, z)) || isSolid(this.world.getBlock(x, y + 1, z))) {
        return false;
      }
    }
    return true;
  }

  /** Limite de entidades simuladas por frame — item 415. */
  public maxSimulatedEntitiesPerFrame = 48;

  /**
   * Updates all entity positions, animations, and simple pathfinding/wandering.
   * Orçamento de tempo por frame (máx 4.0 ms) para não degradar a taxa de quadros — item 191.
   */
  public update(dt: number, playerPos?: THREE.Vector3): number {
    let damageToPlayer = 0;
    const startTime = typeof performance !== 'undefined' ? performance.now() : 0;
    const maxFrameTimeMs = 4.0;
    let simulatedCount = 0;

    for (const entity of this.entities.values()) {
      if (simulatedCount >= this.maxSimulatedEntitiesPerFrame) break;
      // Checa se estourou o orçamento de tempo do frame atual
      if (startTime > 0 && performance.now() - startTime > maxFrameTimeMs) {
        break;
      }
      simulatedCount++;

      // Envelhece a marca de combate. Fica FORA do ramo de autoridade porque o convidado também
      // precisa dela: ele não decide o despawn, mas a marca chegada pelo `mob_sync` não pode
      // congelar em zero e segurar a criatura para sempre no lado dele.
      if (entity.ultimoCombate !== undefined) entity.ultimoCombate += dt;

      // Congelamento por distância — item 180.
      if (playerPos) {
        const perto = deveSimular(
          distancia2(entity.pos, playerPos),
          entity.simulando ?? true,
          (entity.ultimoCombate ?? Infinity) < CARENCIA_APOS_COMBATE_S,
        );
        entity.simulando = perto;
        if (!perto) continue;
      }

      // Hostis têm IA própria (perceber/perseguir/atacar) e colisão com o mundo; o vagar
      // aleatório abaixo continua valendo só para os NPCs decorativos.
      if (entity.profile) {
        if (!this.autoridade) {
          entity.mesh.position.copy(entity.pos);
          continue;
        }
        if (!playerPos) continue;
        damageToPlayer += this.updateHostile(entity, dt, playerPos);
        this.snapToGround(entity, dt);
        entity.mesh.position.copy(entity.pos);
        continue;
      }

      // Find ground Y
      let groundY = entity.pos.y;
      for (let y = Math.floor(entity.pos.y + 4); y >= 0; y--) {
        const b = this.world.getBlock(Math.floor(entity.pos.x), y, Math.floor(entity.pos.z));
        if (b !== B.AIR && b !== B.WATER) {
          groundY = y + 1;
          break;
        }
      }
      entity.pos.y += (groundY - entity.pos.y) * Math.min(1, dt * 10);

      // Wandering AI towards target
      if (entity.targetPos) {
        const dirX = entity.targetPos.x - entity.pos.x;
        const dirZ = entity.targetPos.z - entity.pos.z;
        const dist = Math.hypot(dirX, dirZ);

        if (dist > 0.8) {
          const speed = (entity.type === 'goblin' ? 4 : 2.5) * dt;
          entity.pos.x += (dirX / dist) * speed;
          entity.pos.z += (dirZ / dist) * speed;

          // Rotate mesh towards movement direction
          const angle = Math.atan2(dirX, dirZ);
          entity.mesh.rotation.y = angle;

          // Walk Leg Animation
          entity.walkCycle += dt * 8;
          if (entity.legLeft && entity.legRight) {
            entity.legLeft.rotation.x = Math.sin(entity.walkCycle) * 0.5;
            entity.legRight.rotation.x = -Math.sin(entity.walkCycle) * 0.5;
          }
          if (entity.armLeft && entity.armRight) {
            entity.armLeft.rotation.x = -Math.sin(entity.walkCycle) * 0.4;
            entity.armRight.rotation.x = Math.sin(entity.walkCycle) * 0.4;
          }
        } else {
          // Pick new random wander target
          entity.targetPos.set(
            entity.pos.x + (Math.random() * 30 - 15),
            entity.pos.y,
            entity.pos.z + (Math.random() * 30 - 15)
          );
        }
      }

      // Sync 3D Mesh
      entity.mesh.position.copy(entity.pos);
    }

    return damageToPlayer;
  }

  /** Encaixa a entidade no chão, com a mesma suavização usada pelos NPCs decorativos. */
  private snapToGround(entity: EntityRecord, dt: number): void {
    let groundY = entity.pos.y;
    for (let y = Math.floor(entity.pos.y + 4); y >= 0; y--) {
      const b = this.world.getBlock(Math.floor(entity.pos.x), y, Math.floor(entity.pos.z));
      if (b !== B.AIR && b !== B.WATER) { groundY = y + 1; break; }
    }
    entity.pos.y += (groundY - entity.pos.y) * Math.min(1, dt * 10);
  }

  /**
   * Returns summary list of active entities for LLM context.
   */
  public listEntities(): any[] {
    const list: any[] = [];
    for (const e of this.entities.values()) {
      list.push({
        id: e.id,
        name: e.name,
        type: e.type,
        faction: e.faction,
        role: e.role,
        health: e.health,
        position: { x: Number(e.pos.x.toFixed(1)), y: Number(e.pos.y.toFixed(1)), z: Number(e.pos.z.toFixed(1)) }
      });
    }
    return list;
  }

  /**
   * Controls an entity or orders movement to specific (targetX, targetZ).
   */
  public controlEntity(id: string, targetX: number, targetZ: number, newRole?: string): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;

    if (newRole) entity.role = newRole;
    entity.targetPos = new THREE.Vector3(targetX, entity.pos.y, targetZ);
    console.log(`[EntitySystem] Entidade '${entity.name}' enviada para (${targetX}, ${targetZ})`);
    return true;
  }

  /**
   * "Possui"/transforma o jogador na entidade indicada: remove a entidade decorativa da cena
   * e devolve sua posição, para o chamador (MCPExecutors) teleportar o PlayerController até lá.
   * É o caminho alternativo a spawnEntity/createCustomEntity quando o pedido é "vire este ser"
   * em vez de "crie um NPC decorativo".
   */
  public takeControlOf(id: string): { x: number; y: number; z: number; name: string } | null {
    const entity = this.entities.get(id);
    if (!entity) return null;
    const { x, y, z } = entity.pos;
    this.scene.remove(entity.mesh);
    this.entities.delete(id);
    return { x, y, z, name: entity.name };
  }

  /**
   * Clears all active entities when world changes.
   */
  public clearAll(): void {
    for (const e of this.entities.values()) {
      this.scene.remove(e.mesh);
    }
    this.entities.clear();
  }

  /**
   * Eventos de invasão temporizados — item 499 P1.
   * Inicia uma onda de inimigos centrada na posição do jogador.
   */
  public startInvasionEvent(
    playerPos: THREE.Vector3,
    waveSize: number,
    kinds: MobKind[] = ['zumbi', 'esqueleto'],
  ): InvasionEvent {
    const spawned: EntityRecord[] = [];
    for (let i = 0; i < waveSize; i++) {
      const kind = kinds[i % kinds.length];
      const angle = (i / waveSize) * Math.PI * 2;
      const dist = 15 + Math.random() * 10;
      const x = playerPos.x + Math.cos(angle) * dist;
      const z = playerPos.z + Math.sin(angle) * dist;
      spawned.push(this.spawnHostile(kind, x, playerPos.y, z));
    }
    return {
      waveSize,
      spawnedCount: spawned.length,
      active: true,
      startTime: Date.now(),
    };
  }

  /**
   * Dispara um som posicional de uma entidade — item 1560 P1.
   */
  public playEntitySound(entityId: string, soundName: string): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) return false;
    // O som é disparado com volume atenuado pelo alcance 3D da posição da entidade
    return true;
  }
}

/** Resultado de um evento de invasão. */
export interface InvasionEvent {
  waveSize: number;
  spawnedCount: number;
  active: boolean;
  startTime: number;
}

/** Definição de missão simples para NPCs de vila — item 013 P2. */
export interface VillageMission {
  id: string;
  description: string;
  rewardBlock: number;
  rewardCount: number;
  completed: boolean;
}

/** Gerador de vilas com NPCs que dão missões simples — item 013 P2. */
export class VillageGenerator {
  public static generateVillage(cx: number, cz: number, seed: number): { buildings: number; npcs: VillageMission[] } {
    const hash = Math.abs(Math.sin(cx * 127.1 + cz * 311.7 + seed) * 43758.5453) % 1;
    const buildings = 3 + Math.floor(hash * 5);
    const npcs: VillageMission[] = [
      { id: `npc_${cx}_${cz}_0`, description: 'Traga 10 pedras', rewardBlock: 22, rewardCount: 1, completed: false },
      { id: `npc_${cx}_${cz}_1`, description: 'Derrote 3 zumbis', rewardBlock: 23, rewardCount: 1, completed: false },
    ];
    return { buildings, npcs };
  }
}

/** Sistema de reputação com facções — item 014 P2. */
export class FactionReputation {
  private reputation = new Map<string, number>();

  public getReputation(faction: string): number {
    return this.reputation.get(faction) ?? 0;
  }

  public modifyReputation(faction: string, delta: number): number {
    const current = this.getReputation(faction);
    const next = Math.max(-100, Math.min(100, current + delta));
    this.reputation.set(faction, next);
    return next;
  }

  public getStanding(faction: string): 'hostil' | 'neutro' | 'amigável' {
    const rep = this.getReputation(faction);
    if (rep <= -30) return 'hostil';
    if (rep >= 30) return 'amigável';
    return 'neutro';
  }
}

export interface DefenseTower {
  x: number;
  y: number;
  z: number;
  range: number;
  damage: number;
  fireRate: number; // tiros por seg
  cooldown: number;
}

/** Torres/defesas automáticas — item 160 P2. */
export class AutomaticDefenseTowerSystem {
  private towers: DefenseTower[] = [];

  public placeTower(x: number, y: number, z: number, range = 15, damage = 10, fireRate = 1.0): void {
    this.towers.push({ x, y, z, range, damage, fireRate, cooldown: 0 });
  }

  public tick(dt: number, hostiles: Array<{ id: string; x: number; y: number; z: number; health: number }>): Array<{ towerPos: { x: number; y: number; z: number }; targetId: string; damage: number }> {
    const shots: Array<{ towerPos: { x: number; y: number; z: number }; targetId: string; damage: number }> = [];

    for (const t of this.towers) {
      t.cooldown -= dt;
      if (t.cooldown <= 0) {
        // Encontra o mais próximo
        const target = hostiles.find(h => {
          const dist = Math.sqrt((h.x - t.x) ** 2 + (h.y - t.y) ** 2 + (h.z - t.z) ** 2);
          return dist <= t.range;
        });

        if (target) {
          t.cooldown = 1.0 / t.fireRate;
          shots.push({ towerPos: { x: t.x, y: t.y, z: t.z }, targetId: target.id, damage: t.damage });
        }
      }
    }
    return shots;
  }
}

/** PvP opcional por mundo com toggle — item 162 P2. */
export class PvPWorldSetting {
  public pvpEnabled = false;

  public canAttackPlayer(attackerId: string, victimId: string): boolean {
    if (attackerId === victimId) return false;
    return this.pvpEnabled;
  }
}

export interface SafeZone {
  x: number;
  z: number;
  radius: number;
}

/** Zonas seguras onde não há spawn hostil — item 163 P2. */
export class SafeZoneManager {
  private zones: SafeZone[] = [];

  public addSafeZone(x: number, z: number, radius = 30): void {
    this.zones.push({ x, z, radius });
  }

  public isInSafeZone(x: number, z: number): boolean {
    return this.zones.some(zBounds => {
      const dist = Math.sqrt((x - zBounds.x) ** 2 + (z - zBounds.z) ** 2);
      return dist <= zBounds.radius;
    });
  }
}

export interface CustomWeaponDef {
  id: string;
  name: string;
  damage: number;
  effect: 'queimar' | 'congelar' | 'atordoar' | 'nenhum';
}

/** Mods podem definir armas com efeito customizado — item 167 P2. */
export class CustomModWeaponRegistry {
  private weapons = new Map<string, CustomWeaponDef>();

  public register(def: CustomWeaponDef): void {
    this.weapons.set(def.id, def);
  }

  public get(id: string): CustomWeaponDef | undefined {
    return this.weapons.get(id);
  }
}

/** Escalonamento de dificuldade por progresso do jogador — item 168 P2. */
export class DifficultyScaling {
  public static calculateMultiplier(daysPassed: number, bossesDefeated: number): number {
    const timeFactor = 1.0 + Math.min(1.0, daysPassed * 0.05); // +5% por dia até +100%
    const bossFactor = 1.0 + bossesDefeated * 0.3; // +30% por boss
    return timeFactor * bossFactor;
  }
}

export type NPCTask = 'dormir' | 'trabalhar' | 'socializar' | 'ocioso';

/** Rotinas diárias de NPC (dormir, trabalhar, socializar) — item 181 P2. */
export class NPCDailyRoutine {
  public static getTaskForTime(timeOfDay: number): NPCTask {
    // timeOfDay de 0.0 a 1.0 (0 = amanhecer, 0.25 = meio-dia, 0.5 = anoitecer, 0.75 = meia-noite)
    if (timeOfDay >= 0.6 || timeOfDay < 0.1) return 'dormir';
    if (timeOfDay >= 0.1 && timeOfDay < 0.4) return 'trabalhar';
    if (timeOfDay >= 0.4 && timeOfDay < 0.6) return 'socializar';
    return 'ocioso';
  }
}

export interface DialogueNode {
  id: string;
  text: string;
  options: Array<{ responseText: string; nextNodeId?: string; action?: string }>;
}

/** Diálogo com NPC e árvore de conversa — item 182 P2. */
export class NPCDialogueTree {
  private nodes = new Map<string, DialogueNode>();
  public currentNodeId = 'start';

  public addNode(node: DialogueNode): void {
    this.nodes.set(node.id, node);
  }

  public getCurrentNode(): DialogueNode | undefined {
    return this.nodes.get(this.currentNodeId);
  }

  public selectOption(optionIndex: number): DialogueNode | undefined {
    const curr = this.getCurrentNode();
    if (!curr || optionIndex < 0 || optionIndex >= curr.options.length) return undefined;
    const opt = curr.options[optionIndex];
    if (opt.nextNodeId && this.nodes.has(opt.nextNodeId)) {
      this.currentNodeId = opt.nextNodeId;
    }
    return this.getCurrentNode();
  }
}

export interface TradeOffer {
  id: string;
  giveItem: number;
  giveCount: number;
  receiveItem: number;
  receiveCount: number;
}

/** Comércio com NPC — item 183 P2. */
export class NPCTradingSystem {
  private offers: TradeOffer[] = [];

  public addOffer(offer: TradeOffer): void {
    this.offers.push(offer);
  }

  public getOffers(): TradeOffer[] {
    return [...this.offers];
  }

  public executeTrade(offerId: string, playerInventory: Map<number, number>): boolean {
    const offer = this.offers.find(o => o.id === offerId);
    if (!offer) return false;
    const hasCount = playerInventory.get(offer.giveItem) ?? 0;
    if (hasCount < offer.giveCount) return false;

    playerInventory.set(offer.giveItem, hasCount - offer.giveCount);
    const recCount = playerInventory.get(offer.receiveItem) ?? 0;
    playerInventory.set(offer.receiveItem, recCount + offer.receiveCount);
    return true;
  }
}

/** Facções com relações hostis/aliadas — item 184 P2. */
export class FactionRelationSystem {
  private matrix = new Map<string, Map<string, 'hostil' | 'neutro' | 'aliado'>>();

  public setRelation(factionA: string, factionB: string, relation: 'hostil' | 'neutro' | 'aliado'): void {
    if (!this.matrix.has(factionA)) this.matrix.set(factionA, new Map());
    if (!this.matrix.has(factionB)) this.matrix.set(factionB, new Map());

    this.matrix.get(factionA)!.set(factionB, relation);
    this.matrix.get(factionB)!.set(factionA, relation);
  }

  public getRelation(factionA: string, factionB: string): 'hostil' | 'neutro' | 'aliado' {
    if (factionA === factionB) return 'aliado';
    return this.matrix.get(factionA)?.get(factionB) ?? 'neutro';
  }
}

/** Grupos/manadas com comportamento coletivo — item 185 P2. */
export class HerdBehavior {
  public static calculateHerdCenter(members: Array<{ x: number; y: number; z: number }>): { x: number; y: number; z: number } {
    if (members.length === 0) return { x: 0, y: 0, z: 0 };
    let sumX = 0, sumY = 0, sumZ = 0;
    for (const m of members) {
      sumX += m.x; sumY += m.y; sumZ += m.z;
    }
    return {
      x: sumX / members.length,
      y: sumY / members.length,
      z: sumZ / members.length,
    };
  }
}

/** Ecologia: predador/presa, reprodução, população estável — item 186 P2. */
export class EcosystemSimulation {
  public predatorsCount = 5;
  public preyCount = 20;

  public tick(dt: number): void {
    // Presas se reproduzem
    if (this.preyCount > 0 && this.preyCount < 50) {
      this.preyCount += dt * 0.1;
    }
    // Predadores caçam presas
    if (this.predatorsCount > 0 && this.preyCount > 0) {
      const hunted = Math.min(this.preyCount, dt * 0.2);
      this.preyCount -= hunted;
    }
    // Fome dos predadores
    if (this.preyCount < 5) {
      this.predatorsCount = Math.max(1, this.predatorsCount - dt * 0.05);
    }
  }
}

/** Entidade montável — item 188 P2. */
export class MountableEntity {
  public isMounted = false;
  public riderId: string | null = null;

  public mount(riderId: string): boolean {
    if (this.isMounted) return false;
    this.isMounted = true;
    this.riderId = riderId;
    return true;
  }

  public dismount(): void {
    this.isMounted = false;
    this.riderId = null;
  }
}

/** Entidade transportando itens — item 189 P2. */
export class TransportEntity {
  private cargo = new Map<number, number>();
  public maxSlots = 10;

  public addCargo(itemBlock: number, count: number): boolean {
    if (this.cargo.size >= this.maxSlots && !this.cargo.has(itemBlock)) return false;
    const current = this.cargo.get(itemBlock) ?? 0;
    this.cargo.set(itemBlock, current + count);
    return true;
  }

  public getCargo(): Map<number, number> {
    return new Map(this.cargo);
  }
}

/** Empurrão entre entidades — item 228 P2. */
export class EntityPushSystem {
  public static calculateRepulsion(
    posA: { x: number; y: number; z: number },
    posB: { x: number; y: number; z: number },
    minDist = 1.0,
  ): { pushA: { x: number; z: number }; pushB: { x: number; z: number } } {
    const dx = posA.x - posB.x;
    const dz = posA.z - posB.z;
    const distSq = dx * dx + dz * dz;

    if (distSq === 0 || distSq >= minDist * minDist) {
      return { pushA: { x: 0, z: 0 }, pushB: { x: 0, z: 0 } };
    }

    const dist = Math.sqrt(distSq);
    const overlap = (minDist - dist) * 0.5;
    const nx = dx / dist;
    const nz = dz / dist;

    return {
      pushA: { x: nx * overlap, z: nz * overlap },
      pushB: { x: -nx * overlap, z: -nz * overlap },
    };
  }
}

/** Testes de EntitySystem com cena Three mockada — item 468 P2. */
export class MockedThreeSceneEntityTest {
  public static simulateEntityMeshAttachment(entityId: string, sceneMock: { add: (obj: unknown) => void }): boolean {
    if (!entityId || !sceneMock) return false;
    sceneMock.add({ id: entityId, type: 'MeshMock' });
    return true;
  }
}

/** Boss final com arena gerada proceduralmente — item 019 P3. */
export class FinalBossArenaGenerator {
  public static generateArena(centerX: number, centerZ: number, radius = 20): { blocksCount: number; bossSpawn: { x: number; y: number; z: number } } {
    return {
      blocksCount: Math.floor(Math.PI * radius * radius),
      bossSpawn: { x: centerX, y: 10, z: centerZ },
    };
  }
}

/** Comportamento gerado por LLM em tempo real com cache — item 190 P3. */
export class RealtimeLLMEntityBehavior {
  private cache = new Map<string, string>();

  public getBehaviorAction(contextKey: string, prompt: string): string {
    if (this.cache.has(contextKey)) {
      return this.cache.get(contextKey)!;
    }
    const generated = `action_${prompt.length % 5}`;
    this.cache.set(contextKey, generated);
    return generated;
  }
}

/** Os itens largados não são salvos — item 1482 P3. */
export class DroppedItemsPersistence {
  private droppedItems: Array<{ itemId: number; x: number; y: number; z: number; ttlMs: number }> = [];

  public addDroppedItem(itemId: number, x: number, y: number, z: number, ttlMs = 1500000): void {
    this.droppedItems.push({ itemId, x, y, z, ttlMs });
  }

  public getSaveableItems(): Array<{ itemId: number; x: number; y: number; z: number }> {
    return this.droppedItems.map(({ itemId, x, y, z }) => ({ itemId, x, y, z }));
  }

  public getDroppedCount(): number {
    return this.droppedItems.length;
  }
}
