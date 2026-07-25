import { describe, it, expect } from 'vitest';
import { OP, decodeBinary, encodeBinary, hashAppearance, isBinaryMessage, jsonSizeOf } from '../../src/net/codec';
import { FRAME_MAGIC, encodeFrame } from '../../src/net/wire';
import { NetMessage } from '../../src/net/protocol';
import { DEFAULT_APPEARANCE } from '../../src/player/Appearance';

const blockUpdate: NetMessage = { type: 'block_update', x: -120, y: 64, z: 300, blockType: 11 };

const playerState: NetMessage = {
  type: 'player_state',
  playerId: 'local-a1b2c3d',
  name: 'Aventureiro',
  x: 10.5, y: 64.25, z: -3.75,
  yaw: 1.5, pitch: 0.25,
  gameMode: 'survival',
  health: 87,
  hunger: 62,
};

describe('codec — ida e volta', () => {
  it('block_update preserva coordenadas e tipo', () => {
    const msg = decodeBinary(encodeBinary(blockUpdate)!) as any;
    expect(msg).toMatchObject({ type: 'block_update', x: -120, y: 64, z: 300, blockType: 11 });
  });

  it('coordenadas negativas e nos extremos sobrevivem', () => {
    for (const [x, z] of [[-32768, 32767], [0, 0], [-1, 1], [12345, -12345]]) {
      const m = decodeBinary(encodeBinary({ type: 'block_update', x, y: 0, z, blockType: 1 })!) as any;
      expect([m.x, m.z]).toEqual([x, z]);
    }
  });

  it('block_batch preserva todos os blocos, na ordem', () => {
    const blocks = Array.from({ length: 250 }, (_, i) => ({ x: i - 125, y: 60 + (i % 10), z: i * 2 - 250, blockType: i % 30 }));
    const msg = decodeBinary(encodeBinary({ type: 'block_batch', blocks })!) as any;
    expect(msg.blocks).toEqual(blocks);
  });

  it('block_batch vazio não quebra', () => {
    const msg = decodeBinary(encodeBinary({ type: 'block_batch', blocks: [] })!) as any;
    expect(msg.blocks).toEqual([]);
  });

  it('player_state preserva posição, mira e estado', () => {
    const msg = decodeBinary(encodeBinary(playerState)!) as any;
    expect(msg.playerId).toBe('local-a1b2c3d');
    expect(msg.x).toBeCloseTo(10.5, 3);
    expect(msg.yaw).toBeCloseTo(1.5, 3);
    expect(msg.health).toBe(87);
    expect(msg.hunger).toBe(62);
    expect(msg.gameMode).toBe('survival');
  });

  it('id de jogador longo é truncado sem corromper o resto do pacote', () => {
    const longo = { ...playerState, playerId: 'x'.repeat(60) } as NetMessage;
    const msg = decodeBinary(encodeBinary(longo)!) as any;
    expect(msg.playerId.length).toBeLessThanOrEqual(16);
    expect(msg.health).toBe(87); // os campos seguintes continuam alinhados
  });

  it('vida e fome fora da faixa são limitadas em vez de estourar o byte', () => {
    const msg = decodeBinary(encodeBinary({ ...playerState, health: 9999, hunger: -50 } as NetMessage)!) as any;
    expect(msg.health).toBeLessThanOrEqual(255);
    expect(msg.hunger).toBeGreaterThanOrEqual(0);
  });

  it('tipos não frequentes devolvem null — vão em JSON mesmo', () => {
    expect(encodeBinary({ type: 'chat_message', playerId: 'a', name: 'b', text: 'oi', timestamp: 1 })).toBeNull();
    expect(encodeBinary({ type: 'player_left', playerId: 'a' })).toBeNull();
    expect(encodeBinary({ type: 'full_sync', blockMods: [], players: [] })).toBeNull();
  });
});

describe('codec — robustez contra quadro inválido', () => {
  it('opcode desconhecido devolve null, sem lançar', () => {
    const buf = new ArrayBuffer(9);
    new DataView(buf).setUint8(0, 0x7f);
    expect(decodeBinary(buf)).toBeNull();
  });

  it('quadro truncado devolve null', () => {
    expect(decodeBinary(new ArrayBuffer(0))).toBeNull();
    const curto = new ArrayBuffer(4);
    new DataView(curto).setUint8(0, OP.BLOCK_UPDATE);
    expect(decodeBinary(curto)).toBeNull();
  });

  it('CRÍTICO: lote que declara mais blocos do que traz é recusado', () => {
    // Sem esta checagem, ler adiante do buffer produziria blocos de lixo silenciosamente.
    const buf = new ArrayBuffer(3 + 2 * 8);
    const v = new DataView(buf);
    v.setUint8(0, OP.BLOCK_BATCH);
    v.setUint16(1, 9999, true); // mente sobre a quantidade
    expect(decodeBinary(buf)).toBeNull();
  });
});

describe('codec — convivência com o enquadramento de mensagem grande', () => {
  it('os opcodes nunca colidem com a assinatura de fragmento', () => {
    for (const op of Object.values(OP)) expect(op).not.toBe(FRAME_MAGIC);
  });

  it('isBinaryMessage distingue mensagem codificada de fragmento', () => {
    expect(isBinaryMessage(encodeBinary(blockUpdate)!)).toBe(true);
    expect(isBinaryMessage(encodeFrame(1, 0, 2, new Uint8Array([1, 2, 3])))).toBe(false);
  });

  it('isBinaryMessage não estoura em buffer vazio', () => {
    expect(isBinaryMessage(new ArrayBuffer(0))).toBe(false);
  });
});

describe('hashAppearance — reenviar só quando muda', () => {
  it('é estável para a mesma aparência', () => {
    expect(hashAppearance(DEFAULT_APPEARANCE)).toBe(hashAppearance({ ...DEFAULT_APPEARANCE }));
  });

  it('muda quando qualquer campo visível muda', () => {
    const base = hashAppearance(DEFAULT_APPEARANCE);
    expect(hashAppearance({ ...DEFAULT_APPEARANCE, skin: '#000000' })).not.toBe(base);
    expect(hashAppearance({ ...DEFAULT_APPEARANCE, hairStyle: 'moicano' })).not.toBe(base);
    expect(hashAppearance({ ...DEFAULT_APPEARANCE, build: 1.05 })).not.toBe(base);
    expect(hashAppearance({ ...DEFAULT_APPEARANCE, name: 'Outro' })).not.toBe(base);
  });

  it('aparência ausente vale 0, e cabe em 32 bits sem sinal', () => {
    expect(hashAppearance(undefined)).toBe(0);
    const h = hashAppearance(DEFAULT_APPEARANCE);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('codec — o ganho que justifica existir', () => {
  it('block_update ocupa 9 bytes, contra ~80 do JSON', () => {
    const bin = encodeBinary(blockUpdate)!.byteLength;
    expect(bin).toBe(9);
    expect(bin).toBeLessThan(jsonSizeOf(blockUpdate) / 5);
  });

  it('player_state encolhe bastante, mesmo sem a aparência', () => {
    const bin = encodeBinary(playerState)!.byteLength;
    expect(bin).toBeLessThan(jsonSizeOf(playerState) / 2);
  });

  it('a aparência NÃO viaja no pacote binário — só o hash', () => {
    const comAparencia = { ...playerState, appearance: DEFAULT_APPEARANCE } as NetMessage;
    // O tamanho não muda: a aparência inteira não entra no quadro.
    expect(encodeBinary(comAparencia)!.byteLength).toBe(encodeBinary(playerState)!.byteLength);

    const decodificado = decodeBinary(encodeBinary(comAparencia)!) as any;
    expect(decodificado.appearanceHash).toBe(hashAppearance(DEFAULT_APPEARANCE));
    expect(decodificado.appearance).toBeUndefined();
  });

  it('o lote paga o cabeçalho uma vez, não uma por bloco', () => {
    const blocks = Array.from({ length: 500 }, (_, i) => ({ x: i, y: 60, z: 0, blockType: 3 }));
    const lote = encodeBinary({ type: 'block_batch', blocks })!.byteLength;
    const separados = blocks.length * encodeBinary(blockUpdate)!.byteLength;
    expect(lote).toBeLessThan(separados);
  });

  it('tráfego de partida encolhe mais de 5x contra o que era enviado antes', () => {
    // Linha de base = o que o código ANTIGO mandava: JSON com a aparência inteira em TODO
    // pacote de player_state. Omiti-la aqui daria uma vantagem que o código antigo não tinha.
    const msgs: NetMessage[] = [];
    for (let i = 0; i < 300; i++) msgs.push({ type: 'block_update', x: i, y: 60, z: -i, blockType: i % 20 });
    for (let i = 0; i < 300; i++) {
      msgs.push({ ...playerState, x: i * 0.1, appearance: DEFAULT_APPEARANCE } as NetMessage);
    }

    const antes = msgs.reduce((a, m) => a + jsonSizeOf(m), 0);
    const agora = msgs.reduce((a, m) => a + (encodeBinary(m)?.byteLength ?? jsonSizeOf(m)), 0);

    expect(antes / agora).toBeGreaterThan(5);
  });

  it('agrupar o lote empurra o ganho bem mais alto', () => {
    // Uma construção da IA: 800 blocos num frame, em coordenadas de mundo de verdade (não
    // perto da origem — número curto no JSON favoreceria a linha de base artificialmente).
    const blocks = Array.from({ length: 800 }, (_, i) => ({
      x: 1240 + (i % 40), y: 62 + (i % 8), z: -880 - Math.floor(i / 40), blockType: 11,
    }));

    const antes = blocks.reduce(
      (a, b) => a + jsonSizeOf({ type: 'block_update', ...b } as NetMessage), 0,
    );
    const agora = encodeBinary({ type: 'block_batch', blocks })!.byteLength;

    // Medido em 7,9x: 8 bytes por bloco contra ~63 do JSON, com o cabeçalho pago uma vez só.
    expect(antes / agora).toBeGreaterThan(7.5);
  });
});
