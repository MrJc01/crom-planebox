import { db, WorldRecord, BlockModRecord, ChatMessageRecord, ChatThreadRecord, AppSettingsRecord } from './Database';
import { BlockType } from '../voxel/BlockTypes';

export interface ExportedWorldPackage {
  version: number;
  exportedAt: number;
  world: WorldRecord;
  blockMods: { x: number; y: number; z: number; blockType: BlockType }[];
  chatMessages: Omit<ChatMessageRecord, 'id'>[];
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

  static async deleteWorld(id: string): Promise<void> {
    await db.transaction('rw', [db.worlds, db.blockMods, db.chatMessages], async () => {
      await db.worlds.delete(id);
      await db.blockMods.where('worldId').equals(id).delete();
      await db.chatMessages.where('worldId').equals(id).delete();
    });
  }

  static async saveBlockMod(worldId: string, x: number, y: number, z: number, blockType: BlockType): Promise<void> {
    const key = `${x},${y},${z}`;
    const existing = await db.blockMods.where('[worldId+key]').equals([worldId, key]).first();
    if (existing) {
      if (blockType === BlockType.AIR) {
        if (existing.id) await db.blockMods.delete(existing.id);
      } else {
        existing.blockType = blockType;
        await db.blockMods.put(existing);
      }
    } else if (blockType !== BlockType.AIR) {
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

  static async saveBlockModBatch(worldId: string, mods: { x: number; y: number; z: number; blockType: BlockType }[]): Promise<void> {
    await db.transaction('rw', db.blockMods, async () => {
      for (const m of mods) {
        const key = `${m.x},${m.y},${m.z}`;
        const existing = await db.blockMods.where('[worldId+key]').equals([worldId, key]).first();
        if (existing) {
          if (m.blockType === BlockType.AIR) {
            if (existing.id) await db.blockMods.delete(existing.id);
          } else {
            existing.blockType = m.blockType;
            await db.blockMods.put(existing);
          }
        } else if (m.blockType !== BlockType.AIR) {
          await db.blockMods.add({
            worldId,
            key,
            x: m.x,
            y: m.y,
            z: m.z,
            blockType: m.blockType
          });
        }
      }
    });
  }

  static async getBlockModsForWorld(worldId: string): Promise<Map<string, BlockType>> {
    const records = await db.blockMods.where('worldId').equals(worldId).toArray();
    const map = new Map<string, BlockType>();
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

  static async createChatThread(worldId: string, title?: string): Promise<ChatThreadRecord> {
    const thread: ChatThreadRecord = {
      id: `thread-${Date.now()}`,
      worldId,
      title: title || `Conversa ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
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
   - ETAPA 4 [ENTIDADES E SERES 3D]: Programe e gere as entidades habitando o local usando 'createEntity'. Tire a foto final com 'capture_snapshot'. Se notar qualquer imperfeição na foto, corrija imediatamente!

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
   - registerCustomBlock({ name, topColor, sideColor, bottomColor })`,
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

    const pkg: ExportedWorldPackage = {
      version: 1,
      exportedAt: Date.now(),
      world,
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

    await db.transaction('rw', [db.worlds, db.blockMods, db.chatMessages], async () => {
      await db.worlds.put(pkg.world);

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
}
