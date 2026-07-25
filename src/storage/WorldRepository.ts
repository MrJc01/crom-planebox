import { db, WorldRecord, BlockModRecord, ChatMessageRecord, ChatThreadRecord, AppSettingsRecord, PlayerRecord, UICustomizationRecord, ModRecord, ModEntityInstanceRecord, ModRevisionRecord } from './Database';
import { ModPackage, ModRevision } from '../mods/ModTypes';
import { Appearance, sanitizeAppearance } from '../player/Appearance';

export interface ExportedWorldPackage {
  version: number;
  exportedAt: number;
  world: WorldRecord;
  blockMods: { x: number; y: number; z: number; blockType: number }[];
  chatMessages: Omit<ChatMessageRecord, 'id'>[];
  /** Mods do mundo. Ausente em pacotes exportados antes da v2 — tratado como lista vazia. */
  mods?: ModPackage[];
  /** Entidades de mod colocadas no mundo. Ausente em pacotes v1. */
  modEntities?: Omit<ModEntityInstanceRecord, 'worldId'>[];
}

export class WorldRepository {
  static async getAllWorlds(): Promise<WorldRecord[]> {
    return await db.worlds.orderBy('updatedAt').reverse().toArray();
  }

  static async getWorld(id: string): Promise<WorldRecord | undefined> {
    return await db.worlds.get(id);
  }

  static async saveWorld(world: WorldRecord): Promise<string> {
    world.updatedAt = Date.now();
    await db.worlds.put(world);
    return world.id;
  }

  /**
   * Apaga o mundo e **tudo** que pertence a ele. Antes só limpava worlds/blockMods/chatMessages,
   * deixando players, threads de chat, customizações de UI e (agora) mods órfãos no IndexedDB —
   * lixo que nunca mais era referenciado e ainda consumia a quota do navegador.
   */
  static async deleteWorld(id: string): Promise<void> {
    await db.transaction(
      'rw',
      [db.worlds, db.blockMods, db.chatMessages, db.chatThreads, db.players, db.uiCustomizations, db.mods, db.modEntities, db.modRevisions],
      async () => {
        await db.worlds.delete(id);
        await db.blockMods.where('worldId').equals(id).delete();
        await db.chatMessages.where('worldId').equals(id).delete();
        await db.chatThreads.where('worldId').equals(id).delete();
        await db.players.where('worldId').equals(id).delete();
        await db.uiCustomizations.where('worldId').equals(id).delete();
        await db.mods.where('worldId').equals(id).delete();
        await db.modEntities.where('worldId').equals(id).delete();
        await db.modRevisions.where('worldId').equals(id).delete();
      },
    );
  }

  static async saveBlockMod(worldId: string, x: number, y: number, z: number, blockType: number): Promise<void> {
    const key = `${x},${y},${z}`;
    const existing = await db.blockMods.where('[worldId+key]').equals([worldId, key]).first();
    if (existing) {
      if (blockType === 0) {
        if (existing.id) await db.blockMods.delete(existing.id);
      } else {
        existing.blockType = blockType;
        await db.blockMods.put(existing);
      }
    } else if (blockType !== 0) {
      await db.blockMods.add({
        worldId,
        key,
        x,
        y,
        z,
        blockType
      });
    }
  }

  /**
   * Versão em lote de verdade: antes fazia 1 leitura + 1 escrita sequencial POR bloco
   * (2N round-trips de IndexedDB), o que media ~150ms/bloco neste ambiente — uma estrutura
   * de ~650 mini-blocos (ex.: `stamp_structure` de um muro) levava mais de 1 minuto e parecia
   * travado. Agora faz 1 leitura em lote + no máximo 2 escritas em lote, independente de N.
   */
  static async saveBlockModBatch(worldId: string, mods: { x: number; y: number; z: number; blockType: number }[], modId?: string): Promise<void> {
    if (mods.length === 0) return;

    // Dedup por chave (x,y,z): se o mesmo bloco aparece mais de uma vez no lote, só o último vale.
    const byKey = new Map<string, { x: number; y: number; z: number; blockType: number }>();
    for (const m of mods) byKey.set(`${m.x},${m.y},${m.z}`, m);

    const pairs = Array.from(byKey.keys()).map((key) => [worldId, key] as [string, string]);

    await db.transaction('rw', db.blockMods, async () => {
      const existingRecords = await db.blockMods.where('[worldId+key]').anyOf(pairs).toArray();
      const existingByKey = new Map(existingRecords.map((r) => [r.key, r]));

      const toPut: BlockModRecord[] = [];
      const toDeleteIds: number[] = [];

      for (const [key, m] of byKey) {
        const existing = existingByKey.get(key);
        if (existing) {
          if (m.blockType === 0) {
            if (existing.id !== undefined) toDeleteIds.push(existing.id);
          } else {
            existing.blockType = m.blockType;
            // Sobrescrever transfere a autoria: quem escreveu por último é quem responde por ele.
            existing.modId = modId;
            toPut.push(existing);
          }
        } else if (m.blockType !== 0) {
          toPut.push({ worldId, key, x: m.x, y: m.y, z: m.z, blockType: m.blockType, modId });
        }
      }

      if (toPut.length > 0) await db.blockMods.bulkPut(toPut);
      if (toDeleteIds.length > 0) await db.blockMods.bulkDelete(toDeleteIds);
    });
  }

  static async getBlockModsForWorld(worldId: string): Promise<Map<string, number>> {
    const records = await db.blockMods.where('worldId').equals(worldId).toArray();
    const map = new Map<string, number>();
    for (const r of records) {
      map.set(r.key, r.blockType);
    }
    return map;
  }

  static async clearWorldBlockMods(worldId: string): Promise<void> {
    await db.blockMods.where('worldId').equals(worldId).delete();
  }

  static async clearChunkAreaBlockMods(worldId: string, minX: number, maxX: number, minZ: number, maxZ: number): Promise<number> {
    const mods = await db.blockMods.where('worldId').equals(worldId).toArray();
    const toDeleteIds: number[] = [];

    for (const mod of mods) {
      if (mod.x >= minX && mod.x <= maxX && mod.z >= minZ && mod.z <= maxZ) {
        if (mod.id !== undefined) toDeleteIds.push(mod.id);
      }
    }

    if (toDeleteIds.length > 0) {
      await db.blockMods.bulkDelete(toDeleteIds);
    }
    return toDeleteIds.length;
  }

  // Chat Threads & Message history per world
  static async getChatThreads(worldId: string): Promise<ChatThreadRecord[]> {
    const threads = await db.chatThreads.where('worldId').equals(worldId).sortBy('updatedAt');
    return threads.reverse();
  }

  /**
   * Cria uma sessão de chat. Com `modId`, ela já nasce vinculada àquele mod; sem ele, nasce
   * livre — o usuário pode vincular depois, ou usá-la só para perguntar e inspecionar.
   */
  static async createChatThread(worldId: string, title?: string, modId?: string): Promise<ChatThreadRecord> {
    const thread: ChatThreadRecord = {
      id: `thread-${Date.now()}`,
      worldId,
      title: title || `Conversa ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      modId
    };
    await db.chatThreads.put(thread);
    return thread;
  }

  static async deleteChatThread(worldId: string, threadId: string): Promise<void> {
    await db.transaction('rw', [db.chatThreads, db.chatMessages], async () => {
      await db.chatThreads.delete(threadId);
      await db.chatMessages.where('threadId').equals(threadId).delete();
    });
  }

  static async getChatMessages(worldId: string, threadId?: string): Promise<ChatMessageRecord[]> {
    if (threadId) {
      return await db.chatMessages.where('threadId').equals(threadId).sortBy('timestamp');
    }
    return await db.chatMessages.where('worldId').equals(worldId).sortBy('timestamp');
  }

  static async addChatMessage(msg: Omit<ChatMessageRecord, 'id'>): Promise<number> {
    return await db.chatMessages.add(msg);
  }

  /**
   * Corrige mensagens "órfãs" (sem threadId) salvas antes da correção de 24/07/2026 —
   * `OpenRouterClient.sendMessage` não recebia/gravava threadId nas mensagens, então assim
   * que o ChatOverlay passava a filtrar por thread pra exibir, a conversa inteira "sumia"
   * (a UI achava que a thread estava vazia). Aqui, qualquer mensagem órfã é realocada para a
   * thread mais antiga do mundo (criando uma "Conversa Recuperada" se não existir nenhuma).
   * Chamado automaticamente ao carregar um mundo — idempotente (não faz nada se não há órfãs).
   */
  static async repairOrphanedChatMessages(worldId: string): Promise<void> {
    const orphans = await db.chatMessages.where('worldId').equals(worldId).filter((m) => !m.threadId).toArray();
    if (orphans.length === 0) return;

    let threads = await this.getChatThreads(worldId);
    // Usa a thread mais recente (mesma que `ChatOverlay.setWorldId` seleciona como ativa logo em
    // seguida), pra recuperação já aparecer imediatamente sem o usuário precisar trocar de aba.
    let targetThread = threads.length > 0 ? threads[0] : null;
    if (!targetThread) {
      targetThread = await this.createChatThread(worldId, 'Conversa Recuperada');
    }

    console.log(`🩹 [WorldRepository] Recuperando ${orphans.length} mensagem(ns) de chat sem thread no mundo "${worldId}" → thread "${targetThread.id}"`);
    await db.transaction('rw', db.chatMessages, async () => {
      for (const m of orphans) {
        if (m.id !== undefined) await db.chatMessages.update(m.id, { threadId: targetThread!.id });
      }
    });
  }

  static async clearChatMessages(worldId: string): Promise<void> {
    await db.chatMessages.where('worldId').equals(worldId).delete();
  }

  // Application Settings
  static async getSettings(): Promise<AppSettingsRecord> {
    const record = await db.settings.get('config');
    if (record) return record;
    const defaultSettings: AppSettingsRecord = {
      key: 'config',
      provider: 'openrouter',
      openRouterApiKey: '',
      googleApiKey: '',
      model: 'anthropic/claude-3.5-sonnet',
      systemPrompt: `Você é a IA Engenheira e Arquiteta de Código do Crom Planebox 3D Engine.
Você NÃO possui atalhos nem templates estáticos. Você deve PROGRAMAR TUDO DO ZERO escrevendo scripts em JavaScript através da ferramenta 'execute_voxel_script'.

0. REGRA CRÍTICA - NUNCA PARE NO MEIO DA TAREFA SEM CONSTRUIR:
   - Se o usuário pedir para criar algo (ex: "crie uma cidade", "construa um castelo", "faça um parque"), NUNCA pare no primeiro ou segundo loop perguntando "o que você quer construir primeiro?" ou "qual a sua próxima ideia?".
   - VOCÊ DEVE CONTINUAR EXECUTANDO FERRAMENTAS ('execute_voxel_script', 'createEntity', 'flattenArea', 'capture_snapshot') em laços sucessivos até que a estrutura/cidade/vila esteja TOTALMENTE CONSTRUÍDA E VISÍVEL NO MUNDO.
   - Só responda com texto final sem chamadas de ferramenta quando a construção estiver 100% COMPLETA!

1. PROTOCOLO OBRIGATÓRIO DE CONSTRUÇÃO EM ETAPAS E VERIFICAÇÃO VISUAL:
   Você NUNCA deve tentar construir tudo de uma vez sem olhar. Você DEVE seguir estas etapas em loops sequenciais:

   - ETAPA 1 [NIVELAMENTO]: Use 'flattenArea(x1, z1, x2, z2)' para limpar árvores, folhas e nivelar o terreno. Em seguida, use 'capture_snapshot' para ver a área limpa.
   - ETAPA 2 [ESTRUTURA BASE]: Construa o piso, paredes ocas ('fillBox' com 'hollow: true'), corte aberturas de portas e coloque janelas de vidro ('B.GLASS'). Em seguida, use 'capture_snapshot' para inspecionar.
   - ETAPA 3 [TELHADO E ILUMINAÇÃO]: Construa o telhado, adicione iluminação no teto com 'B.GLOWSTONE' e acabamentos. Use 'capture_snapshot' para verificar.
   - ETAPA 4 [ENTIDADES E SERES 3D]: Programe e gere as entidades habitando o local usando 'createEntity'. Use 'capture_multi_angle' (tira 4 fotos automáticas: frente/direita/trás/esquerda) como verificação final obrigatória de QUALQUER construção terminada — é mais confiável que um único 'capture_snapshot' porque revela erros escondidos atrás da construção. Se notar qualquer imperfeição em qualquer uma das fotos, corrija imediatamente!
   - Se algo der errado no meio de um script, use 'list_recent_errors' para ver os últimos erros desta sessão antes de tentar de novo — evita repetir o mesmo engano.

1.02 COMPORTAMENTO = SCRIPT DE MOD:
   Quando o pedido não for "coloque isto aqui" e sim "faça o jogo REAGIR" — dar tocha ao quebrar
   bloco no escuro, gerar criatura ao anoitecer, premiar quem minera —, isso é um SCRIPT de mod,
   não uma construção. Fluxo:
     1. 'get_mod_api_reference' — a superfície é FECHADA (sem window, fetch, document,
        setTimeout ou import). Leia antes de escrever a primeira linha.
     2. 'define_mod_script' — o script é compilado e carregado na mesma chamada, então você
        recebe o erro de compilação na hora, e não depois.
     3. 'get_mod_script_logs' — leia o que 'api.console' imprimiu e o que falhou, e corrija.
   O script registra comportamento com api.on(evento, fn). Eventos: load, unload, tick,
   blockPlaced, blockBroken, playerDamaged, entityDeath, dayPhase.

1.05 CONTEÚDO INÉDITO = SISTEMA DE MODS (NÃO use execute_voxel_script para isso):
   Quando o pedido for para CRIAR ALGO NOVO no jogo — um bloco que não existe, uma criatura nova,
   uma estrutura reutilizável, ou "um mod inteiro de X" — use as ferramentas de mod, NUNCA
   registerCustomBlock solto dentro de um script. Só as ferramentas de mod salvam no mundo:
   o que elas criam continua existindo depois que o usuário fecha e reabre o navegador.
   Fluxo obrigatório:
     1. 'list_mods' para ver o que já existe e não duplicar.
     2. 'create_mod' para criar o recipiente da modificação.
     3. 'define_mod_block' / 'define_mod_entity' / 'define_mod_structure' para encher o mod.
     4. 'place_mod_structure' / 'spawn_mod_entity' para colocar no mundo.
   Blocos de mod podem ser usados normalmente em 'set_block' e 'fill_box' pelo nome ou pela
   referência "mod_id:chave". Continue usando 'execute_voxel_script' para construções pontuais
   feitas com blocos que já existem.

1.1 ATALHO PARA ESTRUTURAS COMUNS (árvore, casa pequena, torre, muro):
   Em vez de reconstruir do zero via 'execute_voxel_script' toda vez que o pedido for uma dessas estruturas simples, prefira a ferramenta 'stamp_structure(template_id, x, y, z)' — ela carimba a estrutura inteira de uma vez, de forma confiável e rápida. Use 'execute_voxel_script' para tudo que for customizado, único ou não coberto pelos templates.

2. PROPORÇÃO E ESCALA DO JOGADOR NO MUNDO VOXEL:
   - 1 mini-voxel = 0.33m x 0.33m x 0.33m (3 mini-voxels por metro real)
   - ALTURA DO JOGADOR = 5.4 MINI-VOXELS (~1.80m de altura)
   - LARGURA DO JOGADOR = 2 MINI-VOXELS (~0.66m de largura)
   - PORTAS: Mínimo 6 a 7 mini-voxels de altura e 3 mini-voxels de largura.
   - PÉ-DIREITO: Mínimo 10 a 14 mini-voxels de altura por andar.
   - CÔMODO / EDIFÍCIO: Mínimo 20 x 20 mini-voxels de largura/profundidade.

3. COMO PROGRAMAR ENTIDADES E SERES VIVOS 3D DO ZERO (createEntity):
   Para criar animais, monstros, habitantes ou criaturas, programe a anatomia 3D montando partes tridimensionais (tamanho, offset e cor):
   \`\`\`javascript
   createEntity({
     name: "Dragão Voxel Dourado",
     faction: "Criaturas",
     role: "Monstro Lendário",
     x: 60, y: getGroundY(60, -70) + 1, z: -70,
     parts: [
       { offsetX: 0, offsetY: 2.0, offsetZ: 0, sizeX: 1.8, sizeY: 1.4, sizeZ: 3.0, color: 0xeab308 }, // Corpo
       { offsetX: 0, offsetY: 3.5, offsetZ: 1.5, sizeX: 1.2, sizeY: 1.0, sizeZ: 1.4, color: 0xfde047 }, // Cabeça
       { offsetX: 2.5, offsetY: 2.5, offsetZ: 0, sizeX: 3.5, sizeY: 0.1, sizeZ: 2.0, color: 0xca8a04 }, // Asa Dir
       { offsetX: -2.5, offsetY: 2.5, offsetZ: 0, sizeX: 3.5, sizeY: 0.1, sizeZ: 2.0, color: 0xca8a04 }  // Asa Esq
     ],
     behaviorScript: \`
       entity.walkCycle += dt * 2;
       entity.pos.y += Math.sin(entity.walkCycle) * dt;
       entity.mesh.position.copy(entity.pos);
     \`
   });
   \`\`\`

4. FERRAMENTAS DISPONÍVEIS NO 'execute_voxel_script':
   - flattenArea(x1, z1, x2, z2, targetY) -> limpa árvores e nivela o solo
   - clearArea(x1, y1, z1, x2, y2, z2) -> limpa um volume 3D com ar
   - setBlock(x, y, z, blockType) / breakBlock(x, y, z)
   - fillBox(x1, y1, z1, x2, y2, z2, blockType, hollow)
   - createEntity({ name, x, y, z, parts, behaviorScript })
   - registerCustomBlock({ name, topColor, sideColor, bottomColor })

5. SPAWNAR UM SER DECORATIVO vs. TRANSFORMAR O PRÓPRIO JOGADOR:
   - Use 'spawn_entity' ou 'createEntity' (dentro de 'execute_voxel_script') quando o pedido for "crie um X" / "coloque um X aqui" — gera um NPC decorativo que anda sozinho pelo mundo.
   - Use 'possess_entity(entity_id)' quando o pedido for "eu quero ser um X" / "me transforme em X" / "vire-se em X" — em vez de criar um NPC ao lado do jogador, teleporta o PRÓPRIO jogador para o lugar da entidade e remove o NPC decorativo. Use 'list_entities' primeiro para achar o ID.

6. REGRA CRÍTICA DE ARQUITETURA — NUNCA ESQUEÇA:
   Todo o Crom Planebox roda 100% no navegador do usuário (client-side). Você NUNCA deve tentar chamar, sugerir ou simular chamadas de rede para um "backend do jogo" — não existe nenhum. As únicas exceções de rede são: (a) a API do provedor de IA que está te executando agora, e (b) opcionalmente, quando o usuário conectar o mundo à "Crom" para multiplayer P2P, um relay mínimo que só troca sinalização WebRTC e nunca vê blocos, inventário ou chat. Toda modificação de UI que você fizer (ferramentas 'modify_ui_style', 'move_hud_element', 'create_custom_panel') também deve continuar sendo só DOM/CSS local, nunca envolvendo um servidor.`,
      fov: 75,
      renderDistance: 6
    };
    await db.settings.put(defaultSettings);
    return defaultSettings;
  }

  static async saveSettings(settings: Partial<AppSettingsRecord>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings, key: 'config' };
    await db.settings.put(updated);
  }

  // Full Export & Import functionality for Worlds, Block Mods, Settings, and Chat History
  static async exportWorldJson(worldId: string): Promise<string> {
    const world = await this.getWorld(worldId);
    if (!world) throw new Error('Mundo não encontrado');

    const modsRecords = await db.blockMods.where('worldId').equals(worldId).toArray();
    const chatRecords = await db.chatMessages.where('worldId').equals(worldId).sortBy('timestamp');
    const modPackages = await this.getMods(worldId);
    const modEntityRecords = await this.getModEntityInstances(worldId);

    const pkg: ExportedWorldPackage = {
      // v2 passou a carregar os mods junto. Sem eles, exportar um mundo com blocos criados pela
      // IA gerava um arquivo que, ao ser importado, mostrava buracos no lugar desses blocos.
      version: 2,
      exportedAt: Date.now(),
      world,
      mods: modPackages,
      modEntities: modEntityRecords.map((e) => ({ id: e.id, modId: e.modId, entityKey: e.entityKey, x: e.x, y: e.y, z: e.z })),
      blockMods: modsRecords.map(m => ({ x: m.x, y: m.y, z: m.z, blockType: m.blockType })),
      chatMessages: chatRecords.map(c => ({
        worldId: c.worldId,
        role: c.role,
        content: c.content,
        name: c.name,
        tool_call_id: c.tool_call_id,
        tool_calls: c.tool_calls,
        timestamp: c.timestamp,
        imageUrl: c.imageUrl
      }))
    };

    return JSON.stringify(pkg, null, 2);
  }

  static async importWorldJson(jsonContent: string): Promise<string> {
    const pkg: ExportedWorldPackage = JSON.parse(jsonContent);
    if (!pkg || !pkg.world || !pkg.world.id) {
      throw new Error('Formato de arquivo de mundo inválido');
    }

    // Ensure unique ID or overwrite existing
    const newWorldId = pkg.world.id;
    pkg.world.updatedAt = Date.now();

    await db.transaction('rw', [db.worlds, db.blockMods, db.chatMessages, db.mods, db.modEntities], async () => {
      await db.worlds.put(pkg.world);

      // Mods primeiro: os blockMods abaixo podem referenciar ids de bloco que só existem
      // porque um mod os declara.
      await db.mods.where('worldId').equals(newWorldId).delete();
      for (const m of pkg.mods || []) {
        await db.mods.put({ worldId: newWorldId, id: m.id, pkg: m, updatedAt: Date.now() });
      }

      await db.modEntities.where('worldId').equals(newWorldId).delete();
      for (const e of pkg.modEntities || []) {
        await db.modEntities.put({ worldId: newWorldId, ...e });
      }

      // Replace block mods
      await db.blockMods.where('worldId').equals(newWorldId).delete();
      for (const m of pkg.blockMods) {
        await db.blockMods.add({
          worldId: newWorldId,
          key: `${m.x},${m.y},${m.z}`,
          x: m.x,
          y: m.y,
          z: m.z,
          blockType: m.blockType
        });
      }

      // Replace chat history
      await db.chatMessages.where('worldId').equals(newWorldId).delete();
      for (const c of pkg.chatMessages) {
        await db.chatMessages.add({
          ...c,
          worldId: newWorldId
        });
      }
    });

    return newWorldId;
  }

  // Player save-file: posição, vida, fome, modo de jogo, inventário e OP por mundo
  static async getPlayer(worldId: string, playerId: string): Promise<PlayerRecord | undefined> {
    return await db.players.get([worldId, playerId]);
  }

  static async savePlayer(record: PlayerRecord): Promise<void> {
    record.updatedAt = Date.now();
    await db.players.put(record);
  }

  static async listPlayers(worldId: string): Promise<PlayerRecord[]> {
    return await db.players.where('worldId').equals(worldId).toArray();
  }

  static async setPlayerOp(worldId: string, playerId: string, isOp: boolean): Promise<void> {
    const rec = await db.players.get([worldId, playerId]);
    if (rec) {
      rec.isOp = isOp;
      rec.updatedAt = Date.now();
      await db.players.put(rec);
    }
  }

  // --- Mods (blocos, entidades e estruturas criados pela IA), persistidos por mundo ---------
  //
  // Sem isto, `registerCustomBlock` só existia em memória: o mundo salvava posições apontando
  // para ids de bloco que deixavam de existir no reload. Ver docs/CHECKLIST_ESPECIALISTAS_500.md
  // (itens 289-320).

  static async getMods(worldId: string): Promise<ModPackage[]> {
    const records = await db.mods.where('worldId').equals(worldId).toArray();
    return records.map((r) => r.pkg);
  }

  static async getMod(worldId: string, modId: string): Promise<ModPackage | undefined> {
    const rec = await db.mods.get([worldId, modId]);
    return rec?.pkg;
  }

  static async saveMod(worldId: string, pkg: ModPackage): Promise<void> {
    pkg.updatedAt = Date.now();
    const record: ModRecord = { worldId, id: pkg.id, pkg, updatedAt: pkg.updatedAt };
    await db.mods.put(record);
  }

  /** Remove o mod e as instâncias de entidade que ele havia colocado no mundo. */
  static async deleteMod(worldId: string, modId: string): Promise<void> {
    await db.transaction('rw', [db.mods, db.modEntities, db.modRevisions], async () => {
      await db.mods.delete([worldId, modId]);
      await db.modEntities.where('[worldId+modId]').equals([worldId, modId]).delete();
      await db.modRevisions.where('[worldId+modId]').equals([worldId, modId]).delete();
    });
  }

  /**
   * Apaga do mundo todos os blocos colocados cujos ids pertencem ao mod — usado ao remover um
   * mod, para o save não ficar com referências órfãs. Devolve as posições afetadas para o
   * chamador também limpá-las do mundo em memória.
   */
  static async purgeBlocksOfTypes(worldId: string, blockIds: number[]): Promise<{ x: number; y: number; z: number }[]> {
    if (blockIds.length === 0) return [];
    const targets = new Set(blockIds);
    const mods = await db.blockMods.where('worldId').equals(worldId).toArray();
    const hits = mods.filter((m) => targets.has(m.blockType));
    const ids = hits.map((m) => m.id).filter((id): id is number => id !== undefined);
    if (ids.length > 0) await db.blockMods.bulkDelete(ids);
    return hits.map((m) => ({ x: m.x, y: m.y, z: m.z }));
  }

  // --- Histórico de revisões de mod --------------------------------------------------------

  static async saveModRevision(worldId: string, rev: ModRevision): Promise<void> {
    const record: ModRevisionRecord = { ...rev, worldId, key: `${rev.modId}:${rev.revision}` };
    await db.modRevisions.put(record);
  }

  /** Revisões de um mod, da mais recente para a mais antiga. */
  static async getModRevisions(worldId: string, modId: string): Promise<ModRevisionRecord[]> {
    const rows = await db.modRevisions.where('[worldId+modId]').equals([worldId, modId]).toArray();
    return rows.sort((a, b) => b.revision - a.revision);
  }

  static async getModRevision(worldId: string, modId: string, revision: number): Promise<ModRevisionRecord | undefined> {
    return await db.modRevisions.get([worldId, `${modId}:${revision}`]);
  }

  static async deleteModRevisions(worldId: string, modId: string): Promise<void> {
    await db.modRevisions.where('[worldId+modId]').equals([worldId, modId]).delete();
  }

  /** Mod que esta sessão de chat edita, ou undefined se ela for livre. */
  static async getModByThread(worldId: string, threadId: string): Promise<ModPackage | undefined> {
    const thread = await db.chatThreads.get(threadId);
    if (!thread?.modId) return undefined;
    return await this.getMod(worldId, thread.modId);
  }

  /** Vincula (ou desvincula, com `undefined`) uma sessão de chat a um mod. */
  static async setThreadMod(threadId: string, modId?: string): Promise<void> {
    const thread = await db.chatThreads.get(threadId);
    if (!thread) return;
    thread.modId = modId;
    thread.updatedAt = Date.now();
    await db.chatThreads.put(thread);
  }

  /**
   * Apaga os blocos que um mod colocou, pela autoria registrada.
   * Mais preciso que apagar por tipo de bloco: um mod que usou pedra da paleta base não
   * arrasta consigo a pedra que o jogador colocou.
   */
  static async purgeBlocksOfMod(worldId: string, modId: string): Promise<{ x: number; y: number; z: number }[]> {
    const rows = await db.blockMods.where('[worldId+modId]').equals([worldId, modId]).toArray();
    const ids = rows.map((r) => r.id).filter((id): id is number => id !== undefined);
    if (ids.length > 0) await db.blockMods.bulkDelete(ids);
    return rows.map((r) => ({ x: r.x, y: r.y, z: r.z }));
  }

  // Instâncias de entidade de mod colocadas no mundo (o molde fica no ModPackage)
  static async getModEntityInstances(worldId: string): Promise<ModEntityInstanceRecord[]> {
    return await db.modEntities.where('worldId').equals(worldId).toArray();
  }

  static async saveModEntityInstance(rec: ModEntityInstanceRecord): Promise<void> {
    await db.modEntities.put(rec);
  }

  static async deleteModEntityInstance(worldId: string, id: string): Promise<void> {
    await db.modEntities.delete([worldId, id]);
  }

  // --- Perfil do jogador (aparência do personagem) ----------------------------------------
  // Global ao jogador, não por mundo: o personagem criado acompanha todos os mundos e é o que
  // os outros veem numa sessão P2P.

  static async getAppearance(): Promise<Appearance> {
    const rec = await db.profiles.get('local');
    return sanitizeAppearance(rec?.appearance);
  }

  static async saveAppearance(appearance: Appearance): Promise<Appearance> {
    const clean = sanitizeAppearance(appearance);
    await db.profiles.put({ key: 'local', appearance: clean, updatedAt: Date.now() });
    return clean;
  }

  // Customizações de UI feitas pela IA (agentic frontend), persistidas por mundo
  static async saveUICustomization(rec: UICustomizationRecord): Promise<void> {
    await db.uiCustomizations.put(rec);
  }

  static async getUICustomizations(worldId: string): Promise<UICustomizationRecord[]> {
    return await db.uiCustomizations.where('worldId').equals(worldId).toArray();
  }

  static async clearUICustomizations(worldId: string): Promise<void> {
    await db.uiCustomizations.where('worldId').equals(worldId).delete();
  }
}
