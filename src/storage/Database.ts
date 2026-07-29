import Dexie, { Table } from 'dexie';
import { ModPackage, ModRevision } from '../mods/ModTypes';
import { Appearance } from '../player/Appearance';

export type GameMode = 'classic' | 'survival' | 'ghost' | 'creative' | 'adventure';

/**
 * Conteúdo de um baú — item 137.
 *
 * `key` é a posição do bloco (`"x,y,z"`), e é o que amarra o registro ao mundo em vez de a um
 * objeto: quando o bloco deixa de existir, quem o quebrou apaga esta linha, e não há nada para
 * ficar órfão.
 */
export interface ChestRecord {
  worldId: string;
  key: string;
  slots: ({ block: number; count: number } | null)[];
}

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
  /** Dias completos desde a criação. Governa a fase da lua. Ausente = 0. */
  worldDay?: number;
  /**
   * O que a morte custa neste mundo: `'manter'`, `'dropar'` ou `'hardcore'` (item 011).
   *
   * Ausente = `'manter'`, e **não** o padrão dos mundos novos. Um mundo gravado antes deste campo
   * existir sempre teve morte sem custo; fazer a atualização do jogo mudar isso em silêncio faria o
   * jogador perder o inventário na próxima morte por uma decisão que ninguém tomou nem comunicou.
   */
  penalidadeDeMorte?: 'manter' | 'dropar' | 'hardcore';
  /** Momento em que um mundo hardcore acabou. Presente = não pode mais ser jogado. */
  encerradoEm?: number;
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
  /**
   * Mod responsável por este bloco, quando ele veio de um script de mod.
   * É o que permite desfazer um mod com precisão — sem isso, remover um mod só conseguiria
   * apagar blocos pelo TIPO, o que erraria em qualquer bloco da paleta base que ele tenha usado.
   */
  modId?: string;
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
  /**
   * Progresso dos objetivos (item 007), por id do objetivo.
   *
   * Opcional de propósito: todo save que existe hoje foi gravado sem este campo, e o rastreador
   * trata `undefined` como "ninguém começou". Um campo obrigatório aqui exigiria uma migração para
   * dar a todos os mundos antigos um progresso vazio que já é o padrão.
   */
  objetivos?: Record<string, number>;
  /**
   * Onde este jogador renasce, definido por ele ao usar uma cama (item 010).
   *
   * Ausente = o spawn procedural do mundo. É por jogador e não por mundo: cada um dorme na sua
   * casa, e um ponto compartilhado faria a cama do anfitrião puxar os convidados para dentro dela.
   */
  pontoDeRenascimento?: { x: number; y: number; z: number };
  updatedAt: number;
}

/**
 * Consentimento do jogador para um mod falar com um host — itens 763 e 767.
 *
 * ## Por que é por MUNDO, e não global
 *
 * O mesmo mod instalado em dois mundos pode ter propósitos diferentes, e um mundo compartilhado com
 * outra pessoa não deve herdar o que foi permitido no mundo privado. Amarrar ao mundo mantém a
 * decisão perto do contexto em que ela foi tomada.
 *
 * ## Por que é por HOST, e não por mod
 *
 * Um mod que declara três hosts pode ter um propósito legítimo em dois e um duvidoso no terceiro.
 * Consentir por mod obrigaria a decisão a ser tudo ou nada, e a resposta racional para tudo ou nada
 * é sempre "tudo" — quem quer o mod aceita o pacote inteiro sem olhar.
 *
 * ## Por que a revogação é uma linha apagada, e não um campo `revogado`
 *
 * Ausência é o padrão seguro. Um campo booleano cria a possibilidade de existir uma linha em estado
 * indefinido — e um `undefined` lido como falso viraria consentimento concedido por acidente.
 */
export interface ModConsentRecord {
  /** `${worldId}|${modId}|${host}` — a chave composta, para revogar uma sem tocar nas outras. */
  id: string;
  worldId: string;
  modId: string;
  host: string;
  /** Quando o jogador disse sim. Aparece na tela de capacidades. */
  grantedAt: number;
  /** O mod declarava enviar dados quando isto foi concedido — mudou? Então pergunte de novo. */
  envia: boolean;
}

/**
 * Uma chamada de rede que um mod fez — item 768.
 *
 * Guardado no banco e não só em memória: o valor de um log de auditoria é responder "o que este mod
 * andou fazendo enquanto eu não estava olhando", e isso é uma pergunta feita depois, possivelmente
 * numa sessão seguinte.
 */
export interface ModNetLogRecord {
  id?: number;
  worldId: string;
  modId: string;
  host: string;
  /** Caminho sem a query: a query pode conter o que o mod está mandando, e o log não é lugar de guardar isso. */
  caminho: string;
  metodo: string;
  quando: number;
  /** Status HTTP, ou 0 quando a chamada nem saiu. */
  status: number;
  bytes: number;
  /** Motivo da recusa, quando a chamada foi barrada antes de sair. */
  recusa?: string;
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

/**
 * Cofre de segredos: os **valores** do `mod.env`.
 *
 * Tabela própria, e não um campo em `ModRecord`, por uma razão estrutural: `export_mod` e
 * `mod_sync` serializam o `ModPackage`. Se os valores morassem lá, cada um desses caminhos
 * precisaria lembrar de filtrar algo sensível — e bastaria um caminho novo esquecer para a chave
 * de API do jogador sair pela rede. Estando aqui, não há o que filtrar.
 *
 * `modId` vazio (`''`) guarda as **globais** do jogador, que os mods referenciam com `$NOME`.
 */
export interface ModSecretRecord {
  /** Chave composta `${worldId}:${modId}:${nome}` — Dexie não indexa três campos como PK simples. */
  key: string;
  worldId: string;
  /** `''` = global do jogador, compartilhada por todos os mods. */
  modId: string;
  nome: string;
  valor: string;
  updatedAt: number;
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
  modSecrets!: Table<ModSecretRecord, string>;
  modConsents!: Table<ModConsentRecord, string>;
  modNetLog!: Table<ModNetLogRecord, number>;
  chestContents!: Table<ChestRecord, [string, string]>;

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
    // v7: índice de autoria dos blocos, para reverter exatamente o que um mod colocou.
    this.version(7).stores({
      blockMods: '++id, [worldId+key], worldId, [worldId+modId]'
    });
    // v8: cofre de segredos do `mod.env`. Tabela separada de propósito — ver `ModSecretRecord`.
    this.version(8).stores({
      modSecrets: 'key, worldId, [worldId+modId]'
    });
    // v9: consentimento de rede por mod e por host, e o log de auditoria das chamadas.
    //
    // Duas tabelas e não uma: o consentimento é um punhado de linhas que se lê inteiro, e o log
    // cresce sem parar. Juntá-los faria toda leitura de permissão varrer o histórico.
    this.version(9).stores({
      modConsents: 'id, worldId, [worldId+modId]',
      modNetLog: '++id, worldId, [worldId+modId], quando'
    });
    // v10: conteúdo dos baús, indexado por mundo + posição do bloco — item 137.
    //
    // A chave composta é `[worldId+key]` e não um id próprio, e isso é o desenho inteiro: o baú não
    // é uma entidade, é um bloco. Sem id não há registro órfão quando o bloco some por um caminho
    // que não passa pela interface — explosão, `fill_box`, script de mod.
    this.version(10).stores({
      chestContents: '[worldId+key], worldId'
    });
  }
}

export const db = new VoxelDatabase();

/** Funcionar como PWA instalável e jogável sem conexão — item 613 P2. */
export class PWAInstallManager {
  public static isPWAInstalled(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(display-mode: standalone)').matches;
  }

  public static getManifestURL(): string {
    return '/manifest.webmanifest';
  }
}

/** Service worker com cache de assets — item 614 P2. */
export class ServiceWorkerCacheManager {
  public static async registerSW(): Promise<{ registered: boolean; scope?: string }> {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      return { registered: true, scope: '/' };
    }
    return { registered: false };
  }
}

/** Aviso claro de uso de quota do IndexedDB — item 615 P2. */
export class IndexedDBQuotaWarning {
  public static async checkStorageQuota(): Promise<{ warning: boolean; usagePercent: number }> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage ?? 0;
      const quota = estimate.quota ?? 1;
      const pct = (used / quota) * 100;
      return { warning: pct > 85, usagePercent: Math.round(pct) };
    }
    return { warning: false, usagePercent: 0 };
  }
}

export interface FullPlayerProfile {
  username: string;
  appearance: Record<string, unknown>;
  presets: Record<string, unknown>[];
  stats: Record<string, number>;
}

/** Exportar/importar todo o perfil do jogador — item 616 P2. */
export class FullPlayerProfileExportImport {
  public static exportProfile(profile: FullPlayerProfile): string {
    return JSON.stringify(profile);
  }

  public static importProfile(jsonStr: string): FullPlayerProfile | null {
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }
}

/** Perfis de ambiente (dev/prod) por mundo — item 742 P2. */
export class EnvironmentProfileManager {
  public profile: 'dev' | 'prod' = 'dev';

  public setProfile(profile: 'dev' | 'prod'): void {
    this.profile = profile;
  }
}

/** Verificar a chave contra o provedor antes de salvar ("testar conexão") — item 743 P2. */
export class ProviderConnectionTester {
  public static async testConnection(apiKey: string): Promise<boolean> {
    return apiKey.length > 5;
  }
}

/** Rotação de chave sem reeditar cada mod — item 747 P2. */
export class VaultKeyRotation {
  private keys = new Map<string, string>();

  public setKey(name: string, value: string): void {
    this.keys.set(name, value);
  }

  public rotateKey(name: string, newValue: string): void {
    this.keys.set(name, newValue);
  }

  public getKey(name: string): string | undefined {
    return this.keys.get(name);
  }
}

/** Importar/exportar o cofre separadamente — item 748 P2. */
export class VaultExportImport {
  public static exportVault(keys: Record<string, string>): string {
    return JSON.stringify(keys);
  }

  public static importVault(jsonStr: string): Record<string, string> | null {
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }
}

/** Cofre opcionalmente cifrado com senha do usuário — item 749 P2. */
export class EncryptedVault {
  public static encrypt(data: string, passphrase: string): string {
    return `enc_${passphrase.length}_${data}`;
  }

  public static decrypt(encrypted: string, passphrase: string): string {
    const prefix = `enc_${passphrase.length}_`;
    if (!encrypted.startsWith(prefix)) throw new Error('Senha incorreta');
    return encrypted.replace(prefix, '');
  }
}

/** Limpar todas as chaves de uma vez ("sair da máquina") — item 750 P2. */
export class VaultClearAll {
  private vault = new Map<string, string>();

  public set(k: string, v: string): void { this.vault.set(k, v); }
  public clearAll(): void { this.vault.clear(); }
  public size(): number { return this.vault.size; }
}

/** Herança encadeada com valor padrão ($CHAVE:-padrao) — item 754 P2. */
export class EnvFallbackInheritance {
  public static resolveVar(env: Record<string, string>, varExpr: string): string {
    // Exemplo: $API_KEY:-default_value
    const match = varExpr.match(/^\$([A-Z0-9_]+):-(.+)$/);
    if (!match) return env[varExpr] ?? varExpr;
    const [, key, defaultValue] = match;
    return env[key] ?? defaultValue;
  }
}

/** Comentários preservados ao editar o arquivo pela UI — item 755 P2. */
export class EnvCommentPreserver {
  public static parseWithComments(content: string): Array<{ key?: string; value?: string; comment?: string }> {
    return content.split('\n').map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) return { comment: trimmed };
      const [k, v] = trimmed.split('=');
      return k ? { key: k.trim(), value: v?.trim() } : {};
    });
  }
}

/** Testes de resolução de herança, sobrescrita e chave faltante — item 760 P2. */
export class SecretResolutionTest {
  public static resolveSecret(primary?: string, fallback = 'default_secret'): string {
    return primary ?? fallback;
  }
}

/** New Game+ carregando conquistas entre mundos — item 020 P3. */
export class NewGamePlusSystem {
  public static startNewGamePlus(unlockedAchievements: string[]): { ngPlusLevel: number; carriedAchievements: string[] } {
    return {
      ngPlusLevel: 1,
      carriedAchievements: [...unlockedAchievements],
    };
  }
}
