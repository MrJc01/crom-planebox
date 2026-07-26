import * as THREE from 'three';
import { World } from '../world/world';
import { B, isSolid } from '../world/blocks';
import { CombatTimers, MOB_PROFILES, MobKind, MobProfile, knockbackFrom } from './Combat';
import { PathNode, findPathCached } from './Pathfinding';

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

  // --- Combate (só preenchido em hostis) ---
  /** Perfil do mob. Presença deste campo é o que define "é hostil". */
  profile?: MobProfile;
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
}

export class EntitySystem {
  private world: World;
  private scene: THREE.Scene;
  private entities: Map<string, EntityRecord> = new Map();

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
    record.timers = new CombatTimers();
    record.vel = new THREE.Vector3();
    record.state = 'ocioso';
    record.attackTimer = 0;
    record.health = profile.maxHealth;
    record.maxHealth = profile.maxHealth;
    record.targetPos = undefined; // hostis não vagueiam à toa; a IA decide

    this.recolor(record, profile.bodyColor, profile.headColor);
    // A aranha é baixa e larga: silhueta reconhecível de longe, sem modelar outra anatomia.
    if (kind === 'aranha') record.mesh.scale.set(1.25, 0.6, 1.25);

    return record;
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

  /** Notifica a morte de um hostil, para o chamador conceder loot. */
  public onEntityDeath: (entity: EntityRecord) => void = () => {};

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

  /**
   * Updates all entity positions, animations, and simple pathfinding/wandering.
   */
  public update(dt: number, playerPos?: THREE.Vector3): number {
    let damageToPlayer = 0;

    for (const entity of this.entities.values()) {
      // Hostis têm IA própria (perceber/perseguir/atacar) e colisão com o mundo; o vagar
      // aleatório abaixo continua valendo só para os NPCs decorativos.
      if (entity.profile && playerPos) {
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
}
