import Dexie, { Table } from 'dexie';

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

export class VoxelDatabase extends Dexie {
  worlds!: Table<WorldRecord, string>;
  blockMods!: Table<BlockModRecord, number>;
  chatMessages!: Table<ChatMessageRecord, number>;
  chatThreads!: Table<ChatThreadRecord, string>;
  settings!: Table<AppSettingsRecord, string>;
  players!: Table<PlayerRecord, [string, string]>;
  uiCustomizations!: Table<UICustomizationRecord, string>;

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
  }
}

export const db = new VoxelDatabase();
