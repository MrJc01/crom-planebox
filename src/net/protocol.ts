// Protocolo JSON trocado entre host e peers via WebRTC DataChannel.
// Nenhuma dessas mensagens passa pelo relay de sinalização — só trafegam
// diretamente entre os clientes depois que a conexão P2P é estabelecida.
// Ver docs/NETWORK_PROTOCOL.md para a descrição completa.

import { Appearance } from '../player/Appearance';
import { ModPackage } from '../mods/ModTypes';

export interface BlockUpdateMsg {
  type: 'block_update';
  x: number; y: number; z: number; blockType: number;
}

/**
 * Lote de blocos do mesmo frame.
 *
 * Uma construção da IA ou um desmoronamento altera centenas de blocos de uma vez. Mandar uma
 * mensagem por bloco paga o cabeçalho centenas de vezes; agrupar paga uma.
 */
export interface BlockBatchMsg {
  type: 'block_batch';
  blocks: { x: number; y: number; z: number; blockType: number }[];
}

export interface EntityUpdateMsg {
  type: 'entity_update';
  id: string; x: number; y: number; z: number;
}

export interface PlayerStateMsg {
  type: 'player_state';
  playerId: string; name: string;
  x: number; y: number; z: number; yaw: number; pitch: number;
  gameMode: string; health: number; hunger: number;
  /**
   * Aparência do personagem, para os outros verem o boneco customizado em vez de um genérico.
   * Opcional: um peer de versão antiga simplesmente não manda, e cai no padrão.
   * SEMPRE passar por `sanitizeAppearance` ao receber — vem de outro cliente.
   */
  appearance?: Appearance;
  /**
   * Hash da aparência que o remetente está usando. Vai em todo pacote binário; a aparência
   * inteira só é enviada quando o hash muda. Ver `hashAppearance` em `codec.ts`.
   */
  appearanceHash?: number;
}

export interface ChatMessageMsg {
  type: 'chat_message';
  playerId: string; name: string; text: string; timestamp: number;
}

export interface CommandMsg {
  type: 'command';
  playerId: string; raw: string;
}

export interface FullSyncMsg {
  type: 'full_sync';
  blockMods: { x: number; y: number; z: number; blockType: number }[];
  players: { playerId: string; name: string; isOp: boolean }[];
  /**
   * Mods do mundo do anfitrião. Precisam chegar ANTES de `blockMods` serem aplicados: sem eles
   * o convidado recebe posições com ids de bloco que não existem no registro dele e enxerga
   * "bloco ausente" em magenta onde o anfitrião vê o bloco de verdade.
   * Ausente em anfitriões de versão antiga — tratado como lista vazia.
   */
  mods?: ModPackage[];
}

/**
 * Um mod criado ou alterado durante a partida. Enviado pelo anfitrião para os convidados
 * registrarem o bloco na hora, sem precisar de um `full_sync` inteiro.
 */
export interface ModSyncMsg {
  type: 'mod_sync';
  mod: ModPackage;
}

/**
 * Relógio do mundo, enviado pelo anfitrião.
 *
 * Sem isto, cada par contava o próprio tempo a partir do momento em que entrou: dois jogadores no
 * mesmo mundo viam horas do dia diferentes, fases da lua diferentes e — desde que o clima passou
 * a ser derivado de (semente, dia) — climas diferentes no mesmo lugar.
 *
 * É barato de propósito: dois números, mandados de tempos em tempos. O convidado **não** ajusta o
 * relógio de uma vez quando a diferença é pequena; ele corre um pouco mais rápido ou mais devagar
 * até alcançar. Saltar faria o sol pular no céu a cada mensagem.
 */
export interface WorldTimeMsg {
  type: 'world_time';
  /** Fração do dia, 0..1. */
  timeOfDay: number;
  /** Dias completos desde a criação — governa a fase da lua e a sequência do clima. */
  worldDay: number;
  /** Clima imposto pelo anfitrião, ou ausente se o mundo segue a sequência natural. */
  forcedWeather?: string | null;
}

export interface PlayerJoinedMsg { type: 'player_joined'; playerId: string; name: string; appearance?: Appearance }
export interface PlayerLeftMsg { type: 'player_left'; playerId: string }
export interface OpChangedMsg { type: 'op_changed'; playerId: string; isOp: boolean }
export interface KickMsg { type: 'kick'; playerId: string }

export type NetMessage =
  | BlockUpdateMsg
  | BlockBatchMsg
  | EntityUpdateMsg
  | PlayerStateMsg
  | ChatMessageMsg
  | CommandMsg
  | FullSyncMsg
  | ModSyncMsg
  | WorldTimeMsg
  | PlayerJoinedMsg
  | PlayerLeftMsg
  | OpChangedMsg
  | KickMsg;
