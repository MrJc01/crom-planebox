// Protocolo JSON trocado entre host e peers via WebRTC DataChannel.
// Nenhuma dessas mensagens passa pelo relay de sinalização — só trafegam
// diretamente entre os clientes depois que a conexão P2P é estabelecida.
// Ver docs/NETWORK_PROTOCOL.md para a descrição completa.

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
}

export interface PlayerJoinedMsg { type: 'player_joined'; playerId: string; name: string }
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
  | PlayerJoinedMsg
  | PlayerLeftMsg
  | OpChangedMsg
  | KickMsg;
