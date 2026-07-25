// Ponte entre o núcleo puro de mods (`ModRegistry`) e o jogo rodando: aplica os mods no mundo
// 3D, instancia entidades, carimba estruturas e mantém tudo salvo no mundo atual.
//
// Divisão de responsabilidades:
//   ModTypes    — formato dos dados
//   ModRegistry — regras puras (validação, ids, resolução simbólica), testável em Node
//   ModService  — efeitos colaterais (IndexedDB, World, EntitySystem)  ← este arquivo
//
// Coordenadas das estruturas são **mini-voxels absolutos**, a mesma unidade de `setBlock` e do
// `execute_voxel_script`, para a IA não precisar converter escala mentalmente.

import { World } from '../world/world';
import { EntitySystem } from '../entities/EntitySystem';
import { WorldRepository } from '../storage/WorldRepository';
import { BLOCKS } from '../world/blocks';
import {
  ExportedModPackage,
  MOD_FORMAT_VERSION,
  ModBlockDef,
  ModEntityDef,
  ModPackage,
  ModStructureDef,
  emptyModPackage,
} from './ModTypes';
import {
  allocateBlockIds,
  applyAllMods,
  applyModBlocks,
  normalizeKey,
  resolveStructureBlocks,
  revokeModBlocks,
  summarizeMods,
  validateModPackage,
} from './ModRegistry';

export interface ModApplyResult {
  ok: boolean;
  message: string;
  details?: any;
}

export class ModService {
  private world: World;
  private entitySystem?: EntitySystem;
  private worldId: string;
  /** Cache em memória dos mods do mundo ativo; a fonte da verdade continua sendo o IndexedDB. */
  private mods: ModPackage[] = [];

  /** Notifica o host sobre blocos alterados, para retransmitir via PeerSync igual às ferramentas MCP. */
  public onBlocksChanged: (mods: { x: number; y: number; z: number; blockType: number }[]) => void = () => {};

  constructor(world: World, worldId: string, entitySystem?: EntitySystem) {
    this.world = world;
    this.worldId = worldId;
    this.entitySystem = entitySystem;
  }

  public setEntitySystem(entitySystem: EntitySystem): void {
    this.entitySystem = entitySystem;
  }

  public getMods(): ModPackage[] {
    return this.mods;
  }

  public getMod(modId: string): ModPackage | undefined {
    return this.mods.find((m) => m.id === modId);
  }

  /**
   * Chamado ao carregar um mundo: recarrega os mods dele, registra os blocos nos ids salvos e
   * recria as entidades que estavam colocadas. É o que fecha o ciclo "a IA criou → foi salvo →
   * continua lá depois de reabrir".
   */
  public async loadForWorld(worldId: string): Promise<{ mods: number; blocks: number; entities: number }> {
    this.worldId = worldId;
    this.mods = await WorldRepository.getMods(worldId);

    const { blocksApplied, modsApplied } = applyAllMods(this.mods);

    let entitiesRestored = 0;
    if (this.entitySystem) {
      const instances = await WorldRepository.getModEntityInstances(worldId);
      for (const inst of instances) {
        const mod = this.getMod(inst.modId);
        if (!mod || !mod.enabled) continue;
        const species = (mod.entities || []).find((e) => e.key === inst.entityKey);
        if (!species) continue;
        this.entitySystem.createCustomEntity({
          name: species.name,
          faction: species.faction,
          role: species.role,
          x: inst.x,
          y: inst.y,
          z: inst.z,
          parts: species.parts as any,
          behaviorScript: species.behaviorScript,
        });
        entitiesRestored++;
      }
    }

    console.log(
      `🧩 [ModService] Mundo "${worldId}": ${modsApplied} mod(s) aplicados, ` +
        `${blocksApplied} bloco(s) customizados registrados, ${entitiesRestored} entidade(s) restaurada(s).`,
    );
    return { mods: modsApplied, blocks: blocksApplied, entities: entitiesRestored };
  }

  /** Persiste um mod já validado e o mantém no cache em memória. */
  private async persist(pkg: ModPackage): Promise<void> {
    await WorldRepository.saveMod(this.worldId, pkg);
    const idx = this.mods.findIndex((m) => m.id === pkg.id);
    if (idx >= 0) this.mods[idx] = pkg;
    else this.mods.push(pkg);
  }

  /** Cria um mod vazio (ou devolve o existente com o mesmo id, sem sobrescrever conteúdo). */
  public async createMod(name: string, description = '', explicitId?: string): Promise<ModApplyResult> {
    const id = explicitId?.trim() || `mod-${normalizeKey(name) || Date.now()}`;
    const existing = this.getMod(id);
    if (existing) {
      return { ok: true, message: `O mod "${existing.name}" (${id}) já existe — continuando nele.`, details: { modId: id } };
    }

    const pkg = emptyModPackage(id, name, description);
    const errors = validateModPackage(pkg);
    if (errors.length > 0) return { ok: false, message: `Mod inválido: ${errors.join(' ')}` };

    await this.persist(pkg);
    return { ok: true, message: `Mod "${name}" criado (id: ${id}). Agora adicione blocos, entidades e estruturas a ele.`, details: { modId: id } };
  }

  /**
   * Adiciona um bloco ao mod, aloca um id estável, registra em `BLOCKS` e salva.
   * O bloco já fica utilizável na mesma sessão e continua existindo no próximo carregamento.
   */
  public async addBlock(modId: string, block: Omit<ModBlockDef, 'blockId'> & { blockId?: number }): Promise<ModApplyResult> {
    const mod = this.getMod(modId);
    if (!mod) return { ok: false, message: `Mod "${modId}" não encontrado. Use create_mod primeiro.` };

    const key = normalizeKey(block.key || block.name);
    if (!key) return { ok: false, message: 'O bloco precisa de uma chave ou nome válido.' };
    if ((mod.blocks || []).some((b) => b.key === key)) {
      return { ok: false, message: `O mod "${modId}" já tem um bloco com a chave "${key}".` };
    }

    const draft: ModBlockDef = { ...block, key, blockId: block.blockId as number };
    const candidate: ModPackage = { ...mod, blocks: [...(mod.blocks || []), draft] };

    const errors = validateModPackage(candidate);
    if (errors.length > 0) return { ok: false, message: `Bloco inválido: ${errors.join(' ')}` };

    try {
      allocateBlockIds(candidate, this.mods.filter((m) => m.id !== modId));
      applyModBlocks(candidate);
    } catch (err: any) {
      return { ok: false, message: err?.message || String(err) };
    }

    await this.persist(candidate);
    const assigned = candidate.blocks[candidate.blocks.length - 1];
    return {
      ok: true,
      message: `Bloco "${assigned.name}" adicionado ao mod "${mod.name}" com id ${assigned.blockId} (referência: "${modId}:${key}"). Já pode ser usado em set_block e fill_box.`,
      details: { modId, key, blockId: assigned.blockId },
    };
  }

  public async addEntity(modId: string, entity: ModEntityDef): Promise<ModApplyResult> {
    const mod = this.getMod(modId);
    if (!mod) return { ok: false, message: `Mod "${modId}" não encontrado. Use create_mod primeiro.` };

    const key = normalizeKey(entity.key || entity.name);
    if (!key) return { ok: false, message: 'A entidade precisa de uma chave ou nome válido.' };
    if ((mod.entities || []).some((e) => e.key === key)) {
      return { ok: false, message: `O mod "${modId}" já tem uma entidade com a chave "${key}".` };
    }

    const candidate: ModPackage = { ...mod, entities: [...(mod.entities || []), { ...entity, key }] };
    const errors = validateModPackage(candidate);
    if (errors.length > 0) return { ok: false, message: `Entidade inválida: ${errors.join(' ')}` };

    await this.persist(candidate);
    return {
      ok: true,
      message: `Espécie de entidade "${entity.name}" adicionada ao mod "${mod.name}" (referência: "${modId}:${key}"). Use spawn_mod_entity para colocá-la no mundo.`,
      details: { modId, key },
    };
  }

  public async addStructure(modId: string, structure: ModStructureDef): Promise<ModApplyResult> {
    const mod = this.getMod(modId);
    if (!mod) return { ok: false, message: `Mod "${modId}" não encontrado. Use create_mod primeiro.` };

    const key = normalizeKey(structure.key || structure.name);
    if (!key) return { ok: false, message: 'A estrutura precisa de uma chave ou nome válido.' };
    if ((mod.structures || []).some((s) => s.key === key)) {
      return { ok: false, message: `O mod "${modId}" já tem uma estrutura com a chave "${key}".` };
    }

    const candidate: ModPackage = { ...mod, structures: [...(mod.structures || []), { ...structure, key }] };
    const errors = validateModPackage(candidate);
    if (errors.length > 0) return { ok: false, message: `Estrutura inválida: ${errors.join(' ')}` };

    // Falha cedo se a estrutura cita um bloco que não existe, em vez de carimbar buracos depois.
    const { unresolved } = resolveStructureBlocks(structure.blocks, 0, 0, 0, candidate, this.mods);
    if (unresolved.length > 0) {
      return {
        ok: false,
        message: `A estrutura cita blocos que não existem: ${unresolved.join(', ')}. Crie-os com define_mod_block ou use nomes da paleta base.`,
      };
    }

    await this.persist(candidate);
    return {
      ok: true,
      message: `Estrutura "${structure.name}" (${structure.blocks.length} blocos) adicionada ao mod "${mod.name}". Use place_mod_structure para carimbá-la.`,
      details: { modId, key, blocks: structure.blocks.length },
    };
  }

  /** Instancia uma entidade do mod no mundo e **salva a instância**, para ela voltar no reload. */
  public async spawnEntity(modId: string, entityKey: string, x: number, y: number, z: number): Promise<ModApplyResult> {
    const mod = this.getMod(modId);
    if (!mod) return { ok: false, message: `Mod "${modId}" não encontrado.` };
    const species = (mod.entities || []).find((e) => e.key === normalizeKey(entityKey));
    if (!species) return { ok: false, message: `O mod "${modId}" não tem a entidade "${entityKey}".` };
    if (!this.entitySystem) return { ok: false, message: 'Sistema de entidades indisponível.' };

    const record = this.entitySystem.createCustomEntity({
      name: species.name,
      faction: species.faction,
      role: species.role,
      x,
      y,
      z,
      parts: species.parts as any,
      behaviorScript: species.behaviorScript,
    });

    await WorldRepository.saveModEntityInstance({
      worldId: this.worldId,
      id: record.id,
      modId,
      entityKey: species.key,
      x: record.pos.x,
      y: record.pos.y,
      z: record.pos.z,
    });

    return {
      ok: true,
      message: `Entidade "${species.name}" do mod "${mod.name}" criada em (${record.pos.x.toFixed(1)}, ${record.pos.y.toFixed(1)}, ${record.pos.z.toFixed(1)}) e salva no mundo.`,
      details: { entityId: record.id },
    };
  }

  /** Carimba uma estrutura do mod no mundo, resolvendo referências simbólicas e salvando tudo. */
  public async placeStructure(modId: string, structureKey: string, x: number, y: number, z: number): Promise<ModApplyResult> {
    const mod = this.getMod(modId);
    if (!mod) return { ok: false, message: `Mod "${modId}" não encontrado.` };
    const structure = (mod.structures || []).find((s) => s.key === normalizeKey(structureKey));
    if (!structure) return { ok: false, message: `O mod "${modId}" não tem a estrutura "${structureKey}".` };

    const { placements, unresolved } = resolveStructureBlocks(structure.blocks, x, y, z, mod, this.mods);

    const applied: { x: number; y: number; z: number; blockType: number }[] = [];
    for (const p of placements) {
      this.world.setBlock(p.x, p.y, p.z, p.blockType);
      applied.push(p);
    }
    await WorldRepository.saveBlockModBatch(this.worldId, applied);
    this.onBlocksChanged(applied);

    const warn = unresolved.length > 0 ? ` ⚠️ Blocos não resolvidos e pulados: ${unresolved.join(', ')}.` : '';
    return {
      ok: true,
      message: `Estrutura "${structure.name}" carimbada em (${x}, ${y}, ${z}) com ${applied.length} blocos, salvos no mundo.${warn}`,
      details: { placed: applied.length, unresolved },
    };
  }

  /** Liga/desliga um mod. Desligar remove os blocos do registro, mas preserva as definições. */
  public async setEnabled(modId: string, enabled: boolean): Promise<ModApplyResult> {
    const mod = this.getMod(modId);
    if (!mod) return { ok: false, message: `Mod "${modId}" não encontrado.` };

    const updated: ModPackage = { ...mod, enabled };
    if (enabled) applyModBlocks(updated);
    else revokeModBlocks(updated);

    await this.persist(updated);
    return {
      ok: true,
      message: `Mod "${mod.name}" ${enabled ? 'habilitado' : 'desabilitado'}. ${enabled ? '' : 'As definições continuam salvas e podem ser reativadas.'}`,
    };
  }

  /**
   * Remove o mod. Por padrão limpa também os blocos dele já colocados no mundo — senão o save
   * ficaria cheio de posições apontando para ids que não existem mais.
   */
  public async deleteMod(modId: string, purgePlacedBlocks = true): Promise<ModApplyResult> {
    const mod = this.getMod(modId);
    if (!mod) return { ok: false, message: `Mod "${modId}" não encontrado.` };

    const blockIds = revokeModBlocks(mod);

    let purged = 0;
    if (purgePlacedBlocks && blockIds.length > 0) {
      const positions = await WorldRepository.purgeBlocksOfTypes(this.worldId, blockIds);
      for (const p of positions) this.world.setBlock(p.x, p.y, p.z, 0);
      this.onBlocksChanged(positions.map((p) => ({ ...p, blockType: 0 })));
      purged = positions.length;
    }

    await WorldRepository.deleteMod(this.worldId, modId);
    this.mods = this.mods.filter((m) => m.id !== modId);

    return {
      ok: true,
      message: `Mod "${mod.name}" removido. ${purged} bloco(s) que ele havia colocado no mundo foram limpos.`,
      details: { purged },
    };
  }

  /** JSON portátil do mod, para o usuário guardar ou levar para outro mundo. */
  public exportMod(modId: string): ExportedModPackage | null {
    const mod = this.getMod(modId);
    if (!mod) return null;
    return { formatVersion: MOD_FORMAT_VERSION, exportedAt: Date.now(), mod: JSON.parse(JSON.stringify(mod)) };
  }

  /**
   * Importa um mod vindo de fora. Os `blockId` do pacote de origem são **descartados** e
   * realocados neste mundo — dois mundos diferentes não têm por que concordar sobre ids, e
   * reaproveitá-los cegamente sobrescreveria blocos de outro mod já instalado aqui.
   */
  public async importMod(payload: ExportedModPackage | ModPackage): Promise<ModApplyResult> {
    const incoming: ModPackage = (payload as ExportedModPackage).mod ?? (payload as ModPackage);
    if (!incoming || !incoming.id) return { ok: false, message: 'Pacote de mod inválido.' };

    const pkg: ModPackage = JSON.parse(JSON.stringify(incoming));
    if (this.getMod(pkg.id)) pkg.id = `${pkg.id}-${Date.now().toString(36)}`;
    for (const b of pkg.blocks || []) delete (b as any).blockId;

    const errors = validateModPackage(pkg);
    if (errors.length > 0) return { ok: false, message: `Mod inválido: ${errors.join(' ')}` };

    try {
      allocateBlockIds(pkg, this.mods);
      if (pkg.enabled) applyModBlocks(pkg);
    } catch (err: any) {
      return { ok: false, message: err?.message || String(err) };
    }

    await this.persist(pkg);
    return {
      ok: true,
      message: `Mod "${pkg.name}" importado como "${pkg.id}" com ${pkg.blocks.length} bloco(s), ${pkg.entities.length} entidade(s) e ${pkg.structures.length} estrutura(s).`,
      details: { modId: pkg.id },
    };
  }

  public list(): any[] {
    return summarizeMods(this.mods);
  }

  /**
   * Captura blocos que a IA registrou direto no script (`registerCustomBlock`) e ainda não
   * pertencem a nenhum mod, adotando-os num mod "avulso" para que também sejam salvos.
   * Sem isto, o caminho antigo de `execute_voxel_script` continuaria produzindo blocos efêmeros.
   */
  public async adoptOrphanBlocks(modName = 'Blocos avulsos da IA'): Promise<number> {
    const owned = new Set<number>();
    for (const m of this.mods) for (const b of m.blocks || []) owned.add(b.blockId);

    const orphans: ModBlockDef[] = [];
    for (let id = 0; id < BLOCKS.length; id++) {
      const d = BLOCKS[id];
      if (!d || d.reserved || !d.custom) continue;
      if (owned.has(id)) continue;
      orphans.push({
        key: normalizeKey(d.key || d.name) || `bloco_${id}`,
        name: d.name,
        blockId: id,
        topColor: rgbToHex(d.colors[0]),
        sideColor: rgbToHex(d.colors[1]),
        bottomColor: rgbToHex(d.colors[2]),
        solid: d.solid,
        opaque: d.opaque,
        decor: d.decor,
        gravity: d.gravity,
        structural: d.structural,
        drops: d.drops,
        minToolTier: d.minToolTier,
        interactive: d.interactive,
        lightLevel: d.lightLevel,
      });
    }
    if (orphans.length === 0) return 0;

    const id = 'mod-avulsos';
    const existing = this.getMod(id) || emptyModPackage(id, modName, 'Blocos criados diretamente em execute_voxel_script.');
    // Chaves colidem se a IA reusar o mesmo nome — desambigua pelo id, que é único por definição.
    const taken = new Set((existing.blocks || []).map((b) => b.key));
    for (const o of orphans) {
      if (taken.has(o.key)) o.key = `${o.key}_${o.blockId}`;
      taken.add(o.key);
    }
    const updated: ModPackage = { ...existing, blocks: [...(existing.blocks || []), ...orphans] };
    await this.persist(updated);
    console.log(`🧩 [ModService] ${orphans.length} bloco(s) criados via script foram adotados no mod "${id}" e salvos.`);
    return orphans.length;
  }
}

function rgbToHex(rgb: number[]): number {
  const r = Math.round((rgb?.[0] ?? 0) * 255);
  const g = Math.round((rgb?.[1] ?? 0) * 255);
  const b = Math.round((rgb?.[2] ?? 0) * 255);
  return (r << 16) | (g << 8) | b;
}
