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
import { BLOCKS, resetCustomBlocks } from '../world/blocks';
import {
  ExportedModPackage,
  MOD_FORMAT_VERSION,
  ModBlockDef,
  ModEntityDef,
  ModPackage,
  ModStructureDef,
  emptyModPackage,
  stripLocalState,
} from './ModTypes';
import { esquemaPadrao, resolverEnv, validarEsquema } from './ModEnv';
import { SecretVault } from './SecretVault';
import {
  allocateBlockIds,
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
  /**
   * Cofre dos valores de `mod.env`. Vive aqui, e não no pacote do mod, para que exportação e
   * `mod_sync` não tenham o que filtrar — ver `ModSecretRecord`.
   */
  public readonly vault = new SecretVault();
  private world: World;
  private entitySystem?: EntitySystem;
  private worldId: string;
  /** Cache em memória dos mods do mundo ativo; a fonte da verdade continua sendo o IndexedDB. */
  private mods: ModPackage[] = [];
  /**
   * Sessão de chat aberta e o mod que ela edita.
   *
   * É esse par que define **qual mod as ferramentas alteram por padrão**: o agente não repete o
   * id do mod a cada chamada nem corre o risco de escrever no mod errado. Uma sessão sem
   * `activeModId` é uma **sessão livre** — pode ler tudo, não pode escrever nada.
   */
  private activeThreadId?: string;
  private activeModId?: string;

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

  /** Informa qual sessão está aberta e qual mod ela edita (`undefined` = sessão livre). */
  public setActiveSession(threadId?: string, modId?: string): void {
    this.activeThreadId = threadId;
    this.activeModId = modId;
  }

  public getActiveThreadId(): string | undefined {
    return this.activeThreadId;
  }

  public getActiveModId(): string | undefined {
    return this.activeModId;
  }

  /** A sessão atual é livre (sem mod vinculado)? Nela só leitura é permitida. */
  public isFreeSession(): boolean {
    return !this.activeModId;
  }

  /** Mod vinculado à sessão de chat atual, se houver. */
  public getModForActiveThread(): ModPackage | undefined {
    if (!this.activeModId) return undefined;
    return this.getMod(this.activeModId);
  }

  /**
   * Resolve qual mod a ferramenta deve editar.
   *
   * Ordem: id explícito > mod da sessão atual. Sem nenhum dos dois é sessão livre, e o chamador
   * deve recusar a escrita com uma orientação — melhor que gravar no mod errado.
   */
  public resolveTargetMod(explicitId?: string): ModPackage | undefined {
    if (explicitId) return this.getMod(explicitId);
    return this.getModForActiveThread();
  }

  /**
   * Mensagem padrão quando uma ferramenta de escrita é chamada numa sessão livre.
   * Centralizada para todas as ferramentas orientarem exatamente do mesmo jeito.
   */
  public freeSessionHint(acao: string): string {
    const disponiveis = this.mods.map((m) => `"${m.id}"`).join(', ') || 'nenhum ainda';
    return (
      `Esta é uma sessão livre (sem mod vinculado), então ${acao} está bloqueado — é o que impede ` +
      `uma conversa exploratória de alterar o mundo por engano. ` +
      `Use create_mod para começar uma modificação nova nesta sessão, ou attach_session_to_mod ` +
      `para continuar uma existente. Mods deste mundo: ${disponiveis}.`
    );
  }

  /**
   * Chamado ao carregar um mundo: recarrega os mods dele, registra os blocos nos ids salvos e
   * recria as entidades que estavam colocadas. É o que fecha o ciclo "a IA criou → foi salvo →
   * continua lá depois de reabrir".
   */
  public async loadForWorld(worldId: string): Promise<{ mods: number; blocks: number; entities: number }> {
    this.worldId = worldId;
    // O cofre antes dos mods: `applyIsolated` consulta as chaves para decidir quarentena, e
    // carregá-lo depois faria todo mod com chave obrigatória ser isolado por engano no primeiro
    // carregamento do mundo.
    await this.vault.setWorldId(worldId);
    this.mods = await WorldRepository.getMods(worldId);

    // Aplicação mod a mod, com isolamento: um pacote corrompido é posto em quarentena e o
    // carregamento continua. Antes, `applyAllMods` propagava a exceção e um único mod quebrado
    // impedia o mundo inteiro de abrir.
    const { blocksApplied, modsApplied } = this.applyIsolated();

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
      `[ModService] Mundo "${worldId}": ${modsApplied} mod(s) aplicados, ` +
        `${blocksApplied} bloco(s) customizados registrados, ${entitiesRestored} entidade(s) restaurada(s).`,
    );
    return { mods: modsApplied, blocks: blocksApplied, entities: entitiesRestored };
  }

  /**
   * Aplica os mods um a um, isolando falhas.
   * O que não aplica é marcado como quarentenado em memória (e gravado logo em seguida), em vez
   * de abortar o carregamento do mundo.
   */
  private applyIsolated(): { blocksApplied: number; modsApplied: number } {
    resetCustomBlocks();
    let blocksApplied = 0;
    let modsApplied = 0;

    for (const mod of this.mods) {
      if (!mod.enabled || mod.quarantined) continue;

      const errors = validateModPackage(mod);
      if (errors.length > 0) {
        this.markQuarantined(mod, `pacote inválido: ${errors.join(' ')}`);
        continue;
      }

      // Chave obrigatória faltando é motivo de quarentena, não de erro silencioso mais tarde.
      // Um mod que precisa de uma API e não a tem vai falhar de qualquer jeito; falhar aqui diz
      // ao jogador exatamente qual chave preencher, em vez de dar um erro de rede sem contexto.
      if (mod.env) {
        const problemas = validarEsquema(mod.env);
        if (problemas.length > 0) {
          this.markQuarantined(mod, `mod.env inválido: ${problemas.map((p) => `${p.chave}: ${p.motivo}`).join('; ')}`);
          continue;
        }
        const { faltando } = resolverEnv(mod.env, this.vault.valoresDe(mod.id), this.vault.globaisComDerivadas());
        if (faltando.length > 0) {
          this.markQuarantined(mod, `faltam chaves obrigatórias em mod.env: ${faltando.join(', ')}`);
          continue;
        }
      }

      try {
        blocksApplied += applyModBlocks(mod).length;
        modsApplied++;
      } catch (err: any) {
        revokeModBlocks(mod);
        this.markQuarantined(mod, err?.message || String(err));
      }
    }

    return { blocksApplied, modsApplied };
  }

  private markQuarantined(mod: ModPackage, reason: string): void {
    mod.enabled = false;
    mod.quarantined = true;
    mod.quarantineReason = reason;
    console.warn(`[ModService] Mod "${mod.id}" isolado ao carregar: ${reason}`);
    // Grava o estado de quarentena, mas sem `persist` — não é uma edição do usuário e não deve
    // gerar revisão nem eco para a rede.
    WorldRepository.saveMod(this.worldId, mod).catch(() => {});
    this.onModQuarantined(mod, reason);
  }

  /** Avisa a UI que um mod foi isolado, para o usuário saber por que ele sumiu. */
  public onModQuarantined: (mod: ModPackage, reason: string) => void = () => {};

  /**
   * Salva uma revisão do estado ATUAL antes de aplicar uma mudança.
   * Fotografar o "antes" (e não o "depois") é o que faz o rollback voltar para um estado que
   * o usuário efetivamente viu funcionando.
   */
  private async snapshot(pkg: ModPackage, summary: string): Promise<void> {
    await WorldRepository.saveModRevision(this.worldId, {
      modId: pkg.id,
      revision: pkg.revision ?? 1,
      snapshot: JSON.parse(JSON.stringify(pkg)),
      summary,
      createdAt: Date.now(),
    });
  }

  /** Persiste um mod já validado e o mantém no cache em memória. */
  private async persist(pkg: ModPackage): Promise<void> {
    await WorldRepository.saveMod(this.worldId, pkg);
    const idx = this.mods.findIndex((m) => m.id === pkg.id);
    if (idx >= 0) this.mods[idx] = pkg;
    else this.mods.push(pkg);
    this.onModChanged(pkg);
  }

  /**
   * Notifica que um mod foi criado ou alterado. O anfitrião usa para replicar aos convidados.
   * Não dispara em `applyRemoteMods`, senão um mod recebido voltaria de eco para a rede.
   */
  public onModChanged: (mod: ModPackage) => void = () => {};

  /**
   * Instala mods vindos do anfitrião numa sessão P2P.
   *
   * Diferente de `importMod`, aqui os `blockId` do pacote são **preservados como estão**. É o
   * ponto crítico da sincronização: anfitrião e convidado precisam concordar sobre qual id é
   * qual bloco, porque as mensagens `block_update` transportam só o número. Realocar aqui faria
   * o convidado pintar o mundo com os blocos trocados.
   */
  public async applyRemoteMods(incoming: ModPackage[]): Promise<number> {
    let applied = 0;

    for (const raw of incoming || []) {
      const pkg: ModPackage = JSON.parse(JSON.stringify(raw));
      const errors = validateModPackage(pkg);
      if (errors.length > 0) {
        console.warn(`[ModService] Mod "${pkg?.id}" recebido do anfitrião foi recusado: ${errors.join(' ')}`);
        continue;
      }

      try {
        if (pkg.enabled) applyModBlocks(pkg);
      } catch (err: any) {
        console.warn(`[ModService] Falha ao aplicar mod remoto "${pkg.id}": ${err?.message || err}`);
        continue;
      }

      // Grava sem passar por `persist`, para não ecoar de volta pela rede.
      await WorldRepository.saveMod(this.worldId, pkg);
      const idx = this.mods.findIndex((m) => m.id === pkg.id);
      if (idx >= 0) this.mods[idx] = pkg;
      else this.mods.push(pkg);
      applied++;
    }

    if (applied > 0) {
      console.log(`[ModService] ${applied} mod(s) sincronizados do anfitrião com os ids originais.`);
    }
    return applied;
  }

  /** Cria um mod vazio (ou devolve o existente com o mesmo id, sem sobrescrever conteúdo). */
  public async createMod(name: string, description = '', explicitId?: string): Promise<ModApplyResult> {
    const id = explicitId?.trim() || `mod-${normalizeKey(name) || Date.now()}`;
    const existing = this.getMod(id);
    if (existing) {
      // Já existe: em vez de recusar, vincula a sessão atual a ele e continua o trabalho.
      await this.attachActiveSession(id);
      return { ok: true, message: `O mod "${existing.name}" (${id}) já existe — esta sessão passou a editá-lo.`, details: { modId: id } };
    }

    const pkg = emptyModPackage(id, name, description, this.activeThreadId);
    // Todo mod nasce com `mod.env` (item 721). Vazio seria pior que ausente: o autor teria de
    // descobrir a convenção sozinho, e a sintaxe de herança nunca seria usada.
    pkg.env = esquemaPadrao();
    const errors = validateModPackage(pkg);
    if (errors.length > 0) return { ok: false, message: `Mod inválido: ${errors.join(' ')}` };

    await this.persist(pkg);
    // A sessão que criou o mod passa a ser a sessão dele: é o que dá escopo às ferramentas
    // seguintes sem o agente precisar repetir o id em cada chamada.
    await this.attachActiveSession(id);

    return {
      ok: true,
      message: `Mod "${name}" criado (id: ${id}) e vinculado a esta sessão de chat. As próximas ferramentas editam este mod por padrão.`,
      details: { modId: id },
    };
  }

  /** Vincula a sessão de chat atual a um mod (ou a solta, com `undefined`). */
  public async attachActiveSession(modId?: string): Promise<ModApplyResult> {
    if (modId && !this.getMod(modId)) {
      return { ok: false, message: `Mod "${modId}" não existe neste mundo.` };
    }
    this.activeModId = modId;
    if (this.activeThreadId) await WorldRepository.setThreadMod(this.activeThreadId, modId);

    return {
      ok: true,
      message: modId
        ? `Esta sessão agora edita o mod "${modId}".`
        : 'Esta sessão voltou a ser livre: dá para ler tudo, mas nenhuma escrita é permitida.',
      details: { modId },
    };
  }

  // --- Versionamento -----------------------------------------------------------------------

  /** Histórico de revisões de um mod, da mais recente para a mais antiga. */
  public async listRevisions(modId: string): Promise<{ revision: number; summary: string; createdAt: number }[]> {
    const rows = await WorldRepository.getModRevisions(this.worldId, modId);
    return rows.map((r) => ({ revision: r.revision, summary: r.summary, createdAt: r.createdAt }));
  }

  /**
   * Volta o mod para uma revisão anterior.
   *
   * Antes de reverter, tira um snapshot do estado atual — voltar não pode ser uma via de mão
   * única, senão o rollback vira uma nova forma de perder trabalho. Os blocos da versão atual
   * saem do registro e os da versão restaurada entram, com os mesmos ids que já estavam no save.
   */
  public async rollbackMod(modId: string, revision: number): Promise<ModApplyResult> {
    const atual = this.getMod(modId);
    if (!atual) return { ok: false, message: `Mod "${modId}" não encontrado.` };

    const alvo = await WorldRepository.getModRevision(this.worldId, modId, revision);
    if (!alvo) {
      const disponiveis = (await this.listRevisions(modId)).map((r) => r.revision).join(', ');
      return { ok: false, message: `Revisão ${revision} não existe para "${modId}". Disponíveis: ${disponiveis || 'nenhuma'}.` };
    }

    await this.snapshot(atual, `Estado antes de voltar para a revisão ${revision}`);

    const restaurado: ModPackage = JSON.parse(JSON.stringify(alvo.snapshot));
    // A revisão avança mesmo voltando no conteúdo: o histórico é linear e nunca reescrito.
    restaurado.revision = (atual.revision ?? 1) + 1;
    restaurado.quarantined = false;
    restaurado.quarantineReason = undefined;

    revokeModBlocks(atual);
    try {
      if (restaurado.enabled) applyModBlocks(restaurado);
    } catch (err: any) {
      applyModBlocks(atual); // desfaz a tentativa e mantém o estado que funcionava
      return { ok: false, message: `Não foi possível aplicar a revisão ${revision}: ${err?.message || err}` };
    }

    await this.persist(restaurado);
    return {
      ok: true,
      message: `Mod "${atual.name}" voltou para a revisão ${revision} (agora é a revisão ${restaurado.revision}). O histórico anterior continua salvo.`,
      details: { modId, revision: restaurado.revision },
    };
  }

  /**
   * Desliga um mod que falhou, sem deixar a falha derrubar o mundo.
   *
   * É o ponto que atende ao requisito de isolamento: se um mod corromper as próprias definições,
   * ele é isolado e reportado, e o carregamento do mundo segue com os demais.
   */
  public async quarantine(modId: string, reason: string): Promise<void> {
    const mod = this.getMod(modId);
    if (!mod) return;
    const updated: ModPackage = { ...mod, enabled: false, quarantined: true, quarantineReason: reason };
    revokeModBlocks(updated);
    await this.persist(updated);
    console.warn(`[ModService] Mod "${modId}" posto em quarentena: ${reason}`);
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

    await this.snapshot(mod, `Antes de adicionar o bloco "${key}"`);
    candidate.revision = (mod.revision ?? 1) + 1;
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

    await this.snapshot(mod, `Antes de adicionar a entidade "${key}"`);
    candidate.revision = (mod.revision ?? 1) + 1;
    await this.persist(candidate);
    return {
      ok: true,
      message: `Espécie de entidade "${entity.name}" adicionada ao mod "${mod.name}" (referência: "${modId}:${key}"). Use spawn_mod_entity para colocá-la no mundo.`,
      details: { modId, key },
    };
  }

  /**
   * Adiciona ou substitui um script do mod. Substituir é o caminho do editor: salvar de novo o
   * mesmo `key` atualiza o código e gera revisão, em vez de acumular arquivos.
   */
  public async setScript(modId: string, script: { key: string; name?: string; code: string; enabled?: boolean }): Promise<ModApplyResult> {
    const mod = this.getMod(modId);
    if (!mod) return { ok: false, message: `Mod "${modId}" não encontrado.` };

    const key = normalizeKey(script.key || 'main');
    if (!key) return { ok: false, message: 'O script precisa de uma chave válida.' };
    if (typeof script.code !== 'string') return { ok: false, message: 'O script precisa de código.' };

    const anteriores = mod.scripts ?? [];
    const existente = anteriores.find((s) => s.key === key);
    const novo = {
      key,
      name: script.name || existente?.name || key,
      code: script.code,
      enabled: script.enabled ?? existente?.enabled ?? true,
    };

    const candidate: ModPackage = {
      ...mod,
      scripts: existente ? anteriores.map((s) => (s.key === key ? novo : s)) : [...anteriores, novo],
    };

    await this.snapshot(mod, existente ? `Antes de alterar o script "${key}"` : `Antes de adicionar o script "${key}"`);
    candidate.revision = (mod.revision ?? 1) + 1;
    await this.persist(candidate);

    return {
      ok: true,
      message: `Script "${key}" ${existente ? 'atualizado' : 'adicionado'} no mod "${mod.name}" (revisão ${candidate.revision}).`,
      details: { modId, key, revision: candidate.revision },
    };
  }

  /** Liga/desliga um script sem removê-lo. */
  public async setScriptEnabled(modId: string, key: string, enabled: boolean): Promise<ModApplyResult> {
    const mod = this.getMod(modId);
    if (!mod) return { ok: false, message: `Mod "${modId}" não encontrado.` };
    const scripts = mod.scripts ?? [];
    if (!scripts.some((s) => s.key === key)) return { ok: false, message: `O mod não tem o script "${key}".` };

    const candidate: ModPackage = { ...mod, scripts: scripts.map((s) => (s.key === key ? { ...s, enabled } : s)) };
    candidate.revision = (mod.revision ?? 1) + 1;
    await this.persist(candidate);
    return { ok: true, message: `Script "${key}" ${enabled ? 'ligado' : 'desligado'}.` };
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

    await this.snapshot(mod, `Antes de adicionar a estrutura "${key}"`);
    candidate.revision = (mod.revision ?? 1) + 1;
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

    const warn = unresolved.length > 0 ? ` Blocos não resolvidos e pulados: ${unresolved.join(', ')}.` : '';
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
    if (purgePlacedBlocks) {
      // Duas fontes: os blocos com autoria registrada (colocados por script) e os que usam um
      // tipo de bloco declarado pelo mod. A união cobre os dois caminhos de escrita.
      const porAutoria = await WorldRepository.purgeBlocksOfMod(this.worldId, modId);
      const porTipo = blockIds.length > 0 ? await WorldRepository.purgeBlocksOfTypes(this.worldId, blockIds) : [];

      const vistos = new Set<string>();
      const positions = [...porAutoria, ...porTipo].filter((p) => {
        const k = `${p.x},${p.y},${p.z}`;
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
      });

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
    // `stripLocalState` tira a conversa, a quarentena e os ids locais: o que sai é a estrutura
    // do mod, que é o que faz sentido levar para outro mundo ou compartilhar.
    return { formatVersion: MOD_FORMAT_VERSION, exportedAt: Date.now(), mod: stripLocalState(mod) };
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
    console.log(`[ModService] ${orphans.length} bloco(s) criados via script foram adotados no mod "${id}" e salvos.`);
    return orphans.length;
  }
}

function rgbToHex(rgb: number[]): number {
  const r = Math.round((rgb?.[0] ?? 0) * 255);
  const g = Math.round((rgb?.[1] ?? 0) * 255);
  const b = Math.round((rgb?.[2] ?? 0) * 255);
  return (r << 16) | (g << 8) | b;
}
