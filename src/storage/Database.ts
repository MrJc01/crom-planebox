import Dexie, { Table } from 'dexie';
import { ModPackage, ModRevision } from '../mods/ModTypes';
import { Appearance } from '../player/Appearance';

export type GameMode = 'classic' | 'survival' | 'ghost' | 'creative' | 'adventure';

export interface WorldRecord {
  id: string;
  name: string;
  seed: number;
  groundHeight: number;
  fov: number;
  cameraMode: 'topdown' | 'fps' | 'ghost';
  defaultGameMode?: GameMode;
  onlineEnabled?: boolean;
  /** Hora do mundo em fração de dia (0 = meia-noite, 0.5 = meio-dia). Ausente = manhã. */
  timeOfDay?: number;
  /** Versão do schema de save deste mundo (mundos antigos sem o campo são tratados como versão 1). Incremente ao mudar o formato de PlayerRecord/WorldRecord de um jeito que exija migração. */
  saveVersion?: number;
  createdAt: number;
  updatedAt: number;
}

export const CURRENT_SAVE_VERSION = 1;

export interface BlockModRecord {
  id?: number;
  worldId: string;
  key: string; // `${x},${y},${z}`
  x: number;
  y: number;
  z: number;
  blockType: number;
}

export interface PlayerRecord {
  worldId: string;
  playerId: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  health: number;
  hunger: number;
  gameMode: GameMode;
  inventory: { label: string; block: number; count: number; infinite?: boolean; toolTier?: number }[];
  isOp: boolean;
  updatedAt: number;
}

export interface ChatThreadRecord {
  id: string;
  worldId: string;
  title: string;
  createdAt: number;
  updatedAt: number;

  /**
   * Mod que esta sessão edita. **Este é o vínculo autoritativo** entre conversa e modificação.
   *
   * A cardinalidade é 1 mod → N sessões: dá para abrir uma sessão nova para continuar um mod
   * existente (ex.: "agora vamos ajustar o bioma de cristal") sem herdar o histórico inteiro da
   * conversa anterior, que ficaria caro e confuso no contexto do agente.
   *
   * `undefined` = **sessão livre**: serve para perguntar, inspecionar o mundo e ler outros mods,
   * mas nenhuma ferramenta de escrita funciona até a sessão ser vinculada a um mod. É essa
   * separação que impede uma conversa exploratória de alterar o mundo por engano.
   */
  modId?: string;
}

export interface ChatMessageRecord {
  id?: number;
  worldId: string;
  threadId?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any;
  timestamp: number;
  imageUrl?: string;
}

export interface AppSettingsRecord {
  key: string;
  provider: 'openrouter' | 'google_aistudio';
  openRouterApiKey: string;
  googleApiKey: string;
  model: string;
  systemPrompt: string;
  fov: number;
  renderDistance: number;
}

export interface UICustomizationRecord {
  worldId: string;
  id: string;
  kind: 'style' | 'panel' | 'move';
  payload: any;
  createdAt: number;
}

/**
 * Mod instalado num mundo. O pacote inteiro (blocos com seus `blockId`, espécies de entidade e
 * estruturas) é gravado aqui — é o que faz um bloco criado pela IA continuar existindo, com o
 * mesmo id, depois de fechar o navegador.
 */
export interface ModRecord {
  worldId: string;
  id: string;
  /** `ModPackage` de `src/mods/ModTypes.ts`, serializado. */
  pkg: ModPackage;
  updatedAt: number;
}

/**
 * Perfil do jogador local — aparência do personagem. Fica fora de `worlds` de propósito: o
 * personagem é do jogador, não do mundo, e acompanha ele em todos os mundos e nas sessões P2P.
 */
export interface PlayerProfileRecord {
  key: string; // 'local'
  appearance: Appearance;
  updatedAt: number;
}

/** Uma revisão salva de um mod, para o histórico de versões e o rollback. */
export interface ModRevisionRecord extends ModRevision {
  worldId: string;
  /** Chave composta `${modId}:${revision}` — Dexie não indexa três campos como PK simples. */
  key: string;
}

/** Entidade de mod efetivamente colocada no mundo (a instância, não o molde). */
export interface ModEntityInstanceRecord {
  worldId: string;
  id: string;
  modId: string;
  entityKey: string;
  x: number;
  y: number;
  z: number;
}

export class VoxelDatabase extends Dexie {
  worlds!: Table<WorldRecord, string>;
  blockMods!: Table<BlockModRecord, number>;
  chatMessages!: Table<ChatMessageRecord, number>;
  chatThreads!: Table<ChatThreadRecord, string>;
  settings!: Table<AppSettingsRecord, string>;
  players!: Table<PlayerRecord, [string, string]>;
  uiCustomizations!: Table<UICustomizationRecord, string>;
  mods!: Table<ModRecord, [string, string]>;
  modEntities!: Table<ModEntityInstanceRecord, [string, string]>;
  profiles!: Table<PlayerProfileRecord, string>;
  modRevisions!: Table<ModRevisionRecord, [string, string]>;

  constructor() {
    super('CromPlaneboxDB');
    this.version(2).stores({
      worlds: 'id, name, updatedAt',
      blockMods: '++id, [worldId+key], worldId',
      chatMessages: '++id, worldId, threadId, timestamp',
      chatThreads: 'id, worldId, updatedAt',
      settings: 'key'
    });
    this.version(3).stores({
      worlds: 'id, name, updatedAt',
      blockMods: '++id, [worldId+key], worldId',
      chatMessages: '++id, worldId, threadId, timestamp',
      chatThreads: 'id, worldId, updatedAt',
      settings: 'key',
      players: '[worldId+playerId], worldId',
      uiCustomizations: 'id, worldId'
    });
    // v4: sistema de mods persistente. Dexie só precisa das tabelas novas declaradas — as
    // anteriores são herdadas da v3 e nenhum dado existente é migrado ou perdido.
    this.version(4).stores({
      mods: '[worldId+id], worldId',
      modEntities: '[worldId+id], worldId, [worldId+modId]'
    });
    // v5: perfil/aparência do personagem, global ao jogador (não por mundo).
    this.version(5).stores({
      profiles: 'key'
    });
    // v6: histórico de revisões de mod, para voltar versão sem perder a sessão de chat.
    this.version(6).stores({
      modRevisions: '[worldId+key], worldId, [worldId+modId]'
    });
  }
}

export const db = new VoxelDatabase();
