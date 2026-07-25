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

export interface PlayerJoinedMsg { type: 'player_joined'; playerId: string; name: string; appearance?: Appearance }
export interface PlayerLeftMsg { type: 'player_left'; playerId: string }
export interface OpChangedMsg { type: 'op_changed'; playerId: string; isOp: boolean }
export interface KickMsg { type: 'kick'; playerId: string }

export type NetMessage =
  | BlockUpdateMsg
  | EntityUpdateMsg
  | PlayerStateMsg
  | ChatMessageMsg
  | CommandMsg
  | FullSyncMsg
  | ModSyncMsg
  | PlayerJoinedMsg
  | PlayerLeftMsg
  | OpChangedMsg
  | KickMsg;
