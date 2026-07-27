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
  }
}

export const db = new VoxelDatabase();
