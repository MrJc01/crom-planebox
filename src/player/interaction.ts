// Interação: raycast voxel (DDA), quebrar/colocar, modo de construção Box,
// Modo Detalhe (voxel fino 1/3 m vs bloco cheio 1 m = 3×3×3), hotbar e recursos.
import * as THREE from 'three';
import { World } from '../world/world';
import { VoxelPhysics } from '../world/physics';
import { B, BLOCKS, isSolid, isDecor, isLog, isReplaceable } from '../world/blocks';
import { SCALE } from '../world/chunk';
import { PlayerController } from './controller';
import { getStructureTemplate } from '../crafting/StructureTemplates';

const REACH = 18; // ~6 m

export interface RayHit {
  x: number; y: number; z: number;
  nx: number; ny: number; nz: number;
  type: number;
}

export interface HotbarSlot {
  label: string;
  block: number; // B.AIR = mão
  count: number;
  infinite?: boolean;
  /** Se definido, este slot é uma FERRAMENTA (ex.: picareta), não um bloco colocável. 0=mão, 1=madeira, 2=pedra, 3=ferro. */
  toolTier?: number;
  /** Usos restantes da ferramenta. `undefined` = não desgasta (mão, blocos). */
  durability?: number;
  /** Usos totais, para desenhar a barra de desgaste na hotbar. */
  maxDurability?: number;
  /** Se definido, este slot é uma ESTRUTURA pronta (árvore, casa, torre, muro) — ao colocar, "carimba" todos os blocos do template de uma vez. */
  structureId?: string;
}

export type BuildMode = 'single' | 'box';

export class Interaction {
  hotbar: HotbarSlot[] = [
    { label: 'mão', block: B.AIR, count: 0, infinite: true },
    { label: 'terra', block: B.DIRT, count: 6000 },
    { label: 'pedregulho', block: B.COBBLE, count: 9000 },
    { label: 'tábuas', block: B.PLANK, count: 6000 },
    { label: 'tijolo de pedra', block: B.STONE_BRICK, count: 6000 },
    { label: 'tronco', block: B.LOG, count: 2400 },
    { label: 'areia', block: B.SAND, count: 3000 },
    { label: 'pedra', block: B.STONE, count: 3000 },
    { label: 'folhas', block: B.LEAVES, count: 2400 },
  ];
  selected = 0;
  buildMode: BuildMode = 'single';
  /** modo detalhe: opera em mini-voxels (padrão=true); desligado: blocos de 1 m (3×3×3) */
  detailMode = true;
  boxW = 1; // em unidades do modo atual (macro ou mini)
  boxH = 1;

  highlight: THREE.LineSegments;
  boxPreview: THREE.Mesh;
  /** Preview transparente de uma estrutura inteira (árvore, casa, torre, muro) antes de "carimbar" no mundo. */
  structurePreview: THREE.Group;
  private previewStructureId: string | null = null;
  private breakCooldown = 0;
  private placeCooldown = 0;

  onChanged: () => void = () => {};
  onToast: (msg: string) => void = () => {};

  /** Modo Sobrevivência: gera drops físicos e exige tier de ferramenta; fora dele, grant() instantâneo como hoje. */
  survivalMode = false;
  onItemDrop: (blockType: number, count: number, x: number, y: number, z: number) => void = () => {};
  /** Notifica cada bloco quebrado/colocado localmente — usado pelo host para retransmitir via PeerSync. */
  onBlockChange: (x: number, y: number, z: number, blockType: number) => void = () => {};

  constructor(
    private world: World,
    private physics: VoxelPhysics,
    private player: PlayerController,
    scene: THREE.Scene,
  ) {
    const hgeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
    this.highlight = new THREE.LineSegments(
      hgeo, new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.6 }));
    this.highlight.visible = false;
    scene.add(this.highlight);

    this.boxPreview = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }));
    this.boxPreview.visible = false;
    scene.add(this.boxPreview);

    this.structurePreview = new THREE.Group();
    this.structurePreview.visible = false;
    scene.add(this.structurePreview);

    physics.onDrop = (t, n) => this.grant(t, n);
  }

  /** tamanho da célula de edição no modo atual */
  get cell(): number { return this.detailMode ? 1 : SCALE; }

  /** Raycast DDA (Amanatides & Woo) até REACH voxels. */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3): RayHit | null {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = Math.abs(1 / (dir.x || 1e-10));
    const tDeltaY = Math.abs(1 / (dir.y || 1e-10));
    const tDeltaZ = Math.abs(1 / (dir.z || 1e-10));
    let tMaxX = tDeltaX * (dir.x > 0 ? 1 - (origin.x - x) : origin.x - x);
    let tMaxY = tDeltaY * (dir.y > 0 ? 1 - (origin.y - y) : origin.y - y);
    let tMaxZ = tDeltaZ * (dir.z > 0 ? 1 - (origin.z - z) : origin.z - z);
    let nx = 0, ny = 0, nz = 0;
    let t = 0;

    while (t <= REACH) {
      const bt = this.world.getBlock(x, y, z);
      if (bt !== B.AIR && bt !== B.WATER && (isSolid(bt) || isDecor(bt))) {
        return { x, y, z, nx, ny, nz, type: bt };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
      }
    }
    return null;
  }

  public grant(blockType: number, n: number): void {
    const slot = this.hotbar.find((s) => s.block === blockType);
    if (slot) { slot.count += n; this.onChanged(); }
  }

  /** Concede o drop respeitando o tier de ferramenta (Sobrevivência) e o efeito de item físico. */
  private awardDrop(dropBlock: number, requiredTier: number, x: number, y: number, z: number): void {
    if (dropBlock < 0) return;
    if (this.survivalMode) {
      const equippedTier = this.hotbar[this.selected]?.toolTier ?? 0;
      if (equippedTier < requiredTier) return; // quebra mas não dropa: ferramenta insuficiente
      this.onItemDrop(dropBlock, 1, x + 0.5, y + 0.5, z + 0.5);
    } else {
      this.grant(dropBlock, 1);
    }
  }

  /** célula (alinhada) que contém o voxel, no modo atual */
  private snap(v: number): number {
    return Math.floor(v / this.cell) * this.cell;
  }

  /** enumera os mini-voxels de uma célula de edição */
  private cellVoxels(sx: number, sy: number, sz: number): [number, number, number][] {
    const out: [number, number, number][] = [];
    for (let y = 0; y < this.cell; y++) {
      for (let dx = 0; dx < this.cell; dx++) {
        for (let dz = 0; dz < this.cell; dz++) {
          out.push([sx + dx, sy + y, sz + dz]);
        }
      }
    }
    return out;
  }

  /** células de edição do box, ancoradas na célula alvo (footprint centrado) */
  private boxCells(bx: number, by: number, bz: number): [number, number, number][] {
    const cells: [number, number, number][] = [];
    const c = this.cell;
    const hw = Math.floor((this.boxW - 1) / 2);
    for (let y = 0; y < this.boxH; y++) {
      for (let dx = 0; dx < this.boxW; dx++) {
        for (let dz = 0; dz < this.boxW; dz++) {
          cells.push([bx + (dx - hw) * c, by + y * c, bz + (dz - hw) * c]);
        }
      }
    }
    return cells;
  }

  update(dt: number, camera: THREE.Camera): void {
    this.breakCooldown -= dt;
    this.placeCooldown -= dt;

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = new THREE.Vector3().copy(camera.position);
    const hit = this.raycast(origin, dir);

    if (hit) {
      const c = this.cell;
      const hx = this.snap(hit.x), hy = this.snap(hit.y), hz = this.snap(hit.z);
      this.highlight.visible = true;
      this.highlight.scale.set(c, c, c);
      this.highlight.position.set(hx + c / 2, hy + c / 2, hz + c / 2);

      const structureId = this.hotbar[this.selected].structureId;
      if (structureId) {
        this.boxPreview.visible = false;
        this.updateStructurePreview(structureId, hit);
      } else if (this.buildMode === 'box' && this.hotbar[this.selected].block !== B.AIR) {
        this.structurePreview.visible = false;
        // célula base: vizinha da célula atingida na direção da normal
        const bx = this.snap(hit.x + hit.nx * c);
        const by = this.snap(hit.y + hit.ny * c);
        const bz = this.snap(hit.z + hit.nz * c);
        const hw = Math.floor((this.boxW - 1) / 2);
        const w = this.boxW * c, h = this.boxH * c;
        this.boxPreview.visible = true;
        this.boxPreview.scale.set(w, h, w);
        this.boxPreview.position.set(
          bx - hw * c + w / 2, by + h / 2, bz - hw * c + w / 2);
      } else {
        this.boxPreview.visible = false;
        this.structurePreview.visible = false;
      }
    } else {
      this.highlight.visible = false;
      this.boxPreview.visible = false;
      this.structurePreview.visible = false;
    }
  }

  /** Posição de base (grid macro, 1 bloco = SCALE) para carimbar uma estrutura à frente da face mirada. */
  private structureBasePos(hit: RayHit): [number, number, number] {
    const snapMacro = (v: number) => Math.floor(v / SCALE) * SCALE;
    return [
      snapMacro(hit.x + hit.nx * SCALE),
      snapMacro(hit.y + hit.ny * SCALE),
      snapMacro(hit.z + hit.nz * SCALE),
    ];
  }

  private updateStructurePreview(structureId: string, hit: RayHit): void {
    if (this.previewStructureId !== structureId) {
      this.previewStructureId = structureId;
      this.structurePreview.clear();
      const template = getStructureTemplate(structureId);
      if (template) {
        const geo = new THREE.BoxGeometry(SCALE * 0.96, SCALE * 0.96, SCALE * 0.96);
        const edgeGeo = new THREE.EdgesGeometry(geo);
        for (const b of template.blocks) {
          const def = BLOCKS[b.block];
          const color = def?.colors ? new THREE.Color(def.colors[0][0], def.colors[0][1], def.colors[0][2]) : new THREE.Color(0x38bdf8);
          const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false });
          const mesh = new THREE.Mesh(geo, mat);
          // cada unidade do template ocupa um bloco macro inteiro (SCALE³ mini-voxels);
          // o grupo fica ancorado no canto (bx,by,bz), então cada mesh centra na própria célula.
          mesh.position.set((b.dx + 0.5) * SCALE, (b.dy + 0.5) * SCALE, (b.dz + 0.5) * SCALE);
          this.structurePreview.add(mesh);

          // contorno branco nítido, para o preview ficar legível mesmo quando a cor do bloco
          // se mistura com o terreno (ex.: folhas verdes sobre grama)
          const edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
          edges.position.copy(mesh.position);
          this.structurePreview.add(edges);
        }
      }
    }
    const [bx, by, bz] = this.structureBasePos(hit);
    this.structurePreview.position.set(bx, by, bz);
    this.structurePreview.visible = true;
  }

  /**
   * Tentativa de golpe corpo a corpo, avaliada ANTES de quebrar bloco.
   *
   * A ordem importa: com um inimigo colado numa parede, o raycast acertaria a parede primeiro
   * e o jogador ficaria minerando enquanto apanha. Devolve true se o golpe conectou, e nesse
   * caso `tryBreak` não prossegue.
   */
  public onAttack: (origin: THREE.Vector3, forward: THREE.Vector3, tier: number) => boolean = () => false;

  /** Avisado quando uma ferramenta se desgasta ou quebra, para a UI reagir. */
  public onToolWear: (slot: HotbarSlot, broke: boolean) => void = () => {};

  /**
   * Consome um uso da ferramenta equipada. Devolve true se ela quebrou agora.
   * Mão vazia e blocos não têm durabilidade, então a chamada é inofensiva neles.
   */
  private wearTool(): boolean {
    const slot = this.hotbar[this.selected];
    if (!slot || slot.toolTier === undefined || slot.durability === undefined) return false;

    slot.durability = Math.max(0, slot.durability - 1);
    const broke = slot.durability <= 0;
    if (broke) {
      // A ferramenta some e o slot volta a ser mão vazia — não vira um item fantasma de tier
      // alto com 0 de durabilidade, que continuaria dando o dano cheio.
      slot.label = 'vazio';
      slot.block = B.AIR;
      slot.count = 0;
      slot.toolTier = undefined;
      slot.durability = undefined;
      slot.maxDurability = undefined;
    }
    this.onToolWear(slot, broke);
    this.onChanged();
    return broke;
  }

  tryBreak(camera: THREE.Camera): void {
    if (this.breakCooldown > 0) return;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);

    const tier = this.hotbar[this.selected]?.toolTier ?? 0;
    if (this.onAttack(new THREE.Vector3().copy(camera.position), dir, tier)) {
      this.breakCooldown = 0.42;
      this.wearTool();
      return;
    }

    const hit = this.raycast(new THREE.Vector3().copy(camera.position), dir);
    if (!hit) return;
    this.breakCooldown = this.detailMode ? 0.09 : 0.16;

    // cortar tronco → derruba a árvore inteira (independente do modo)
    if (isLog(hit.type) && !BLOCKS[hit.type].structural) {
      this.world.setBlock(hit.x, hit.y, hit.z, B.AIR);
      this.onBlockChange(hit.x, hit.y, hit.z, B.AIR);
      const push = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      this.physics.fellTree(hit.x, hit.y + 1, hit.z, push.x, push.z);
      this.physics.onBlockChanged(hit.x, hit.y, hit.z);
      this.awardDrop(B.LOG, BLOCKS[hit.type].minToolTier ?? 0, hit.x, hit.y, hit.z);
      this.onChanged();
      return;
    }

    // quebra a célula inteira no modo atual (1 mini ou 3×3×3)
    const sx = this.snap(hit.x), sy = this.snap(hit.y), sz = this.snap(hit.z);
    let broke = 0;
    for (const [x, y, z] of this.cellVoxels(sx, sy, sz)) {
      const t = this.world.getBlock(x, y, z);
      if (t === B.AIR || t === B.WATER) continue;
      if (isLog(t)) continue; // troncos só caem via corte direto
      this.world.setBlock(x, y, z, B.AIR);
      this.onBlockChange(x, y, z, B.AIR);
      const def = BLOCKS[t];
      if (def.drops >= 0) this.awardDrop(def.drops, def.minToolTier ?? 0, x, y, z);
      broke++;
    }
    if (broke > 0) {
      // física uma vez por célula (vizinhos da célula inteira)
      this.physics.onCellChanged(sx, sy, sz, this.cell);
      // Um uso por célula quebrada, não por mini-voxel: no Modo Detalhe uma célula 3×3×3 são
      // 27 voxels, e cobrar 27 usos gastaria a picareta em três blocos.
      this.wearTool();
      this.onChanged();
    }
  }

  tryPlace(camera: THREE.Camera): void {
    if (this.placeCooldown > 0) return;
    const slot = this.hotbar[this.selected];
    if (slot.toolTier !== undefined) return;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const hit = this.raycast(new THREE.Vector3().copy(camera.position), dir);
    if (!hit) return;

    if (slot.structureId) {
      this.placeCooldown = 0.4;
      this.stampStructure(slot.structureId, hit);
      return;
    }
    if (slot.block === B.AIR) return;
    this.placeCooldown = this.buildMode === 'box' ? 0.3 : 0.15;

    const c = this.cell;
    const bx = this.snap(hit.x + hit.nx * c);
    const by = this.snap(hit.y + hit.ny * c);
    const bz = this.snap(hit.z + hit.nz * c);
    const cells = this.buildMode === 'box' ? this.boxCells(bx, by, bz) : [[bx, by, bz] as [number, number, number]];

    const p = this.player.pos;
    let placed = 0;
    for (const [cx, cy, cz] of cells) {
      for (const [x, y, z] of this.cellVoxels(cx, cy, cz)) {
        if (slot.count <= 0 && !slot.infinite) break;
        if (!isReplaceable(this.world.getBlock(x, y, z))) continue;
        // não construir dentro do próprio corpo
        if (x + 1 > p.x - 0.95 && x < p.x + 0.95 &&
            z + 1 > p.z - 0.95 && z < p.z + 0.95 &&
            y + 1 > p.y && y < p.y + 5.3) continue;
        if (this.world.setBlock(x, y, z, slot.block)) {
          this.onBlockChange(x, y, z, slot.block);
          if (!slot.infinite) slot.count--;
          placed++;
        }
      }
      this.physics.onCellChanged(cx, cy, cz, c);
    }
    if (placed > 0) this.onChanged();
    if (slot.count <= 0 && !slot.infinite) {
      this.onToast(`acabou: ${slot.label}!`);
    }
  }

  /**
   * "Carimba" todos os blocos do template de estrutura de uma vez, em vez do fluxo de bloco único.
   * Cada unidade do template vira um bloco macro cheio (cubo SCALE³ de mini-voxels), igual a
   * colocar um bloco normal fora do modo detalhe — para a estrutura ficar na mesma escala visual.
   */
  private stampStructure(structureId: string, hit: RayHit): void {
    const template = getStructureTemplate(structureId);
    if (!template) return;
    const [bx, by, bz] = this.structureBasePos(hit);

    let placed = 0;
    for (const b of template.blocks) {
      const ox = bx + b.dx * SCALE, oy = by + b.dy * SCALE, oz = bz + b.dz * SCALE;
      for (let x = ox; x < ox + SCALE; x++) {
        for (let y = oy; y < oy + SCALE; y++) {
          for (let z = oz; z < oz + SCALE; z++) {
            if (this.world.setBlock(x, y, z, b.block)) {
              this.onBlockChange(x, y, z, b.block);
              placed++;
            }
          }
        }
      }
    }
    if (placed > 0) {
      const maxDim = template.blocks.reduce((m, bl) => Math.max(m, Math.abs(bl.dx), Math.abs(bl.dy), Math.abs(bl.dz)), 0);
      this.physics.onCellChanged(bx, by, bz, (maxDim + 2) * SCALE);
      this.onChanged();
      this.onToast(`${template.name} construída! (${placed} mini-blocos)`);
    }
  }

  cycleBuildMode(): void {
    this.buildMode = this.buildMode === 'single' ? 'box' : 'single';
    this.onChanged();
  }

  toggleDetail(): void {
    this.detailMode = !this.detailMode;
    this.onChanged();
  }

  cycleBoxH(): void {
    this.boxH = this.boxH >= 8 ? 1 : this.boxH + 1;
    this.onChanged();
  }

  cycleBoxW(): void {
    this.boxW = this.boxW >= 7 ? 1 : this.boxW + 2; // 1, 3, 5, 7 (centrado)
    this.onChanged();
  }

  scrollSelect(delta: number): void {
    const n = this.hotbar.length;
    this.selected = ((this.selected + delta) % n + n) % n;
    this.onChanged();
  }
}
