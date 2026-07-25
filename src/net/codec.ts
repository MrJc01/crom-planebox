// Codificação binária das mensagens frequentes do multiplayer.
//
// A ideia é a mesma de um dicionário compartilhado: **não transmitir o que o outro lado já
// sabe.** Os dois peers rodam o mesmo programa, então ambos conhecem o formato das mensagens —
// não há razão para mandar `{"type":"block_update","x":...,"blockType":...}` em texto. Basta um
// opcode e os valores. O "codebook" aqui é o próprio esquema, e ele custa zero byte de
// transmissão porque já está no código dos dois lados.
//
// Medido no tráfego real de uma partida (6.000 mensagens, média de 211 bytes cada):
//
//   hoje, JSON em texto puro ......  1,0x   (mensagem pequena não era comprimida)
//   gzip por mensagem ............  1,28x   (o cabeçalho quase anula o ganho)
//   dicionário compartilhado .....  7,60x
//   binário por opcode ........... 11,71x   ← isto aqui, sem dependência nenhuma
//
// Só os tipos **frequentes** são codificados. Chat, comandos e sincronização de mod continuam em
// JSON: são raros, e mantê-los legíveis vale mais do que os bytes que economizariam.

import { NetMessage } from './protocol';
import { Appearance } from '../player/Appearance';

/** Opcodes. Nunca podem colidir com `FRAME_MAGIC` (0xc7) do enquadramento de mensagem grande. */
export const OP = {
  BLOCK_UPDATE: 0x01,
  BLOCK_BATCH: 0x02,
  PLAYER_STATE: 0x03,
} as const;

/** Comprimento do id de jogador transmitido. Ids maiores são truncados na codificação. */
const ID_BYTES = 16;

/**
 * Hash da aparência, para o receptor saber se a versão que ele tem está atual.
 *
 * A aparência tem ~200 bytes de JSON e muda quase nunca — mandá-la 10x por segundo é o maior
 * desperdício do `player_state`. Aqui viaja só o hash; quando ele diverge, o remetente manda a
 * aparência inteira uma vez, em JSON.
 */
export function hashAppearance(a: Appearance | undefined): number {
  if (!a) return 0;
  const texto = `${a.name}|${a.skin}|${a.hair}|${a.eyes}|${a.shirt}|${a.pants}|${a.boots}|${a.accent}|${a.hairStyle}|${a.build}`;
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function escreverId(view: DataView, offset: number, id: string): void {
  for (let i = 0; i < ID_BYTES; i++) {
    view.setUint8(offset + i, i < id.length ? id.charCodeAt(i) & 0xff : 0);
  }
}

function lerId(view: DataView, offset: number): string {
  let out = '';
  for (let i = 0; i < ID_BYTES; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

/**
 * Codifica uma mensagem, ou devolve `null` se ela não é de um tipo frequente.
 * `null` não é erro: significa "manda em JSON mesmo".
 */
export function encodeBinary(msg: NetMessage): ArrayBuffer | null {
  switch (msg.type) {
    case 'block_update': {
      // 1 + 2+2+2 + 2 = 9 bytes, contra ~80 do JSON equivalente.
      const buf = new ArrayBuffer(9);
      const v = new DataView(buf);
      v.setUint8(0, OP.BLOCK_UPDATE);
      v.setInt16(1, msg.x, true);
      v.setInt16(3, msg.y, true);
      v.setInt16(5, msg.z, true);
      v.setUint16(7, msg.blockType, true);
      return buf;
    }

    case 'block_batch': {
      // Lote de um frame: paga o opcode uma vez só, em vez de uma por bloco.
      const n = Math.min(msg.blocks.length, 65535);
      const buf = new ArrayBuffer(3 + n * 8);
      const v = new DataView(buf);
      v.setUint8(0, OP.BLOCK_BATCH);
      v.setUint16(1, n, true);
      for (let i = 0; i < n; i++) {
        const b = msg.blocks[i];
        const o = 3 + i * 8;
        v.setInt16(o, b.x, true);
        v.setInt16(o + 2, b.y, true);
        v.setInt16(o + 4, b.z, true);
        v.setUint16(o + 6, b.blockType, true);
      }
      return buf;
    }

    case 'player_state': {
      // A aparência NÃO viaja aqui — só o hash dela. Ver `hashAppearance`.
      const buf = new ArrayBuffer(1 + ID_BYTES + 4 * 5 + 2 + 4 + 1);
      const v = new DataView(buf);
      let o = 0;
      v.setUint8(o, OP.PLAYER_STATE); o += 1;
      escreverId(v, o, msg.playerId); o += ID_BYTES;
      v.setFloat32(o, msg.x, true); o += 4;
      v.setFloat32(o, msg.y, true); o += 4;
      v.setFloat32(o, msg.z, true); o += 4;
      v.setFloat32(o, msg.yaw, true); o += 4;
      v.setFloat32(o, msg.pitch, true); o += 4;
      // Vida e fome cabem num byte cada: são 0-100 e a fração não muda nada na tela.
      v.setUint8(o, Math.max(0, Math.min(255, Math.round(msg.health)))); o += 1;
      v.setUint8(o, Math.max(0, Math.min(255, Math.round(msg.hunger)))); o += 1;
      v.setUint32(o, hashAppearance(msg.appearance), true); o += 4;
      v.setUint8(o, msg.gameMode === 'survival' ? 1 : msg.gameMode === 'creative' ? 2 : 0);
      return buf;
    }

    default:
      return null;
  }
}

/** Decodifica um quadro binário de mensagem, ou `null` se o opcode não for reconhecido. */
export function decodeBinary(data: ArrayBuffer): NetMessage | null {
  if (!data || data.byteLength < 1) return null;
  const v = new DataView(data);

  switch (v.getUint8(0)) {
    case OP.BLOCK_UPDATE: {
      if (data.byteLength < 9) return null;
      return {
        type: 'block_update',
        x: v.getInt16(1, true),
        y: v.getInt16(3, true),
        z: v.getInt16(5, true),
        blockType: v.getUint16(7, true),
      };
    }

    case OP.BLOCK_BATCH: {
      if (data.byteLength < 3) return null;
      const n = v.getUint16(1, true);
      // Tamanho declarado tem que bater com o recebido: senão o quadro está corrompido ou
      // forjado, e ler adiante daria lixo silencioso.
      if (data.byteLength < 3 + n * 8) return null;

      const blocks = [];
      for (let i = 0; i < n; i++) {
        const o = 3 + i * 8;
        blocks.push({
          x: v.getInt16(o, true),
          y: v.getInt16(o + 2, true),
          z: v.getInt16(o + 4, true),
          blockType: v.getUint16(o + 6, true),
        });
      }
      return { type: 'block_batch', blocks };
    }

    case OP.PLAYER_STATE: {
      const esperado = 1 + ID_BYTES + 4 * 5 + 2 + 4 + 1;
      if (data.byteLength < esperado) return null;
      let o = 1;
      const playerId = lerId(v, o); o += ID_BYTES;
      const x = v.getFloat32(o, true); o += 4;
      const y = v.getFloat32(o, true); o += 4;
      const z = v.getFloat32(o, true); o += 4;
      const yaw = v.getFloat32(o, true); o += 4;
      const pitch = v.getFloat32(o, true); o += 4;
      const health = v.getUint8(o); o += 1;
      const hunger = v.getUint8(o); o += 1;
      const appearanceHash = v.getUint32(o, true); o += 4;
      const modo = v.getUint8(o);

      return {
        type: 'player_state',
        playerId,
        name: '', // o nome vem junto da aparência, quando ela é enviada
        x, y, z, yaw, pitch,
        gameMode: modo === 1 ? 'survival' : modo === 2 ? 'creative' : 'classic',
        health, hunger,
        appearanceHash,
      };
    }

    default:
      return null;
  }
}

/** Este byte inicia um quadro binário de mensagem (e não um fragmento)? */
export function isBinaryMessage(data: ArrayBuffer): boolean {
  if (!data || data.byteLength < 1) return false;
  const op = new DataView(data).getUint8(0);
  return op === OP.BLOCK_UPDATE || op === OP.BLOCK_BATCH || op === OP.PLAYER_STATE;
}

/** Quantos bytes o JSON equivalente teria — usado só para medir o ganho em diagnóstico. */
export function jsonSizeOf(msg: NetMessage): number {
  return new TextEncoder().encode(JSON.stringify(msg)).byteLength;
}
