import { describe, it, expect } from 'vitest';
import {
  FRAGMENT_SIZE,
  FRAME_MAGIC,
  REASSEMBLY_TIMEOUT_MS,
  Reassembler,
  decodeFrame,
  encodeFrame,
  splitPayload,
} from '../../src/net/wire';

function payload(n: number, seed = 1): Uint8Array {
  const u = new Uint8Array(n);
  for (let i = 0; i < n; i++) u[i] = (i * 31 + seed * 17) & 0xff;
  return u;
}

describe('wire — enquadramento', () => {
  it('ida e volta preserva cabeçalho e payload', () => {
    const dados = payload(500);
    const frame = decodeFrame(encodeFrame(42, 2, 5, dados))!;

    expect(frame).not.toBeNull();
    expect(frame.header).toEqual({ msgId: 42, index: 2, total: 5 });
    expect(Array.from(frame.payload)).toEqual(Array.from(dados));
  });

  it('aceita payload vazio', () => {
    const frame = decodeFrame(encodeFrame(1, 0, 1, new Uint8Array(0)))!;
    expect(frame.payload.byteLength).toBe(0);
  });

  it('suporta msgId grande sem estourar (32 bits)', () => {
    const frame = decodeFrame(encodeFrame(4_000_000_000, 0, 1, payload(10)))!;
    expect(frame.header.msgId).toBe(4_000_000_000);
  });

  it('rejeita dado que não é do nosso formato, sem lançar', () => {
    const alheio = new ArrayBuffer(32);
    new DataView(alheio).setUint8(0, 0x00); // magic errado
    expect(decodeFrame(alheio)).toBeNull();
  });

  it('rejeita buffer curto demais para o cabeçalho', () => {
    expect(decodeFrame(new ArrayBuffer(3))).toBeNull();
    expect(decodeFrame(new ArrayBuffer(0))).toBeNull();
  });

  it('rejeita quadro incoerente: índice fora do total', () => {
    expect(decodeFrame(encodeFrame(1, 5, 3, payload(10)))).toBeNull();
    expect(decodeFrame(encodeFrame(1, 0, 0, payload(10)))).toBeNull();
  });

  it('o primeiro byte é sempre a assinatura', () => {
    const buf = encodeFrame(7, 0, 1, payload(4));
    expect(new DataView(buf).getUint8(0)).toBe(FRAME_MAGIC);
  });
});

describe('wire — divisão em fragmentos', () => {
  it('payload pequeno vira um fragmento só', () => {
    expect(splitPayload(payload(100))).toHaveLength(1);
  });

  it('divide em pedaços do tamanho pedido, com o resto no último', () => {
    const partes = splitPayload(payload(2500), 1000);
    expect(partes.map((p) => p.byteLength)).toEqual([1000, 1000, 500]);
  });

  it('tamanho exato não gera fragmento vazio no fim', () => {
    const partes = splitPayload(payload(2000), 1000);
    expect(partes).toHaveLength(2);
  });

  it('a concatenação dos fragmentos reproduz o original', () => {
    const original = payload(FRAGMENT_SIZE * 3 + 77);
    const partes = splitPayload(original);
    const junto = new Uint8Array(original.byteLength);
    let off = 0;
    for (const p of partes) { junto.set(p, off); off += p.byteLength; }
    expect(Array.from(junto)).toEqual(Array.from(original));
  });
});

describe('Reassembler — remontagem', () => {
  it('devolve null enquanto falta fragmento, e o payload no último', () => {
    const r = new Reassembler();
    expect(r.accept({ msgId: 1, index: 0, total: 3 }, payload(10, 1))).toBeNull();
    expect(r.accept({ msgId: 1, index: 1, total: 3 }, payload(10, 2))).toBeNull();
    const completo = r.accept({ msgId: 1, index: 2, total: 3 }, payload(10, 3));
    expect(completo).not.toBeNull();
    expect(completo!.byteLength).toBe(30);
  });

  it('remonta na ordem correta mesmo recebendo fora de ordem', () => {
    const r = new Reassembler();
    const a = payload(4, 1), b = payload(4, 2), c = payload(4, 3);
    r.accept({ msgId: 9, index: 2, total: 3 }, c);
    r.accept({ msgId: 9, index: 0, total: 3 }, a);
    const completo = r.accept({ msgId: 9, index: 1, total: 3 }, b)!;

    expect(Array.from(completo.slice(0, 4))).toEqual(Array.from(a));
    expect(Array.from(completo.slice(4, 8))).toEqual(Array.from(b));
    expect(Array.from(completo.slice(8, 12))).toEqual(Array.from(c));
  });

  it('fragmento duplicado é ignorado, não conta duas vezes', () => {
    const r = new Reassembler();
    r.accept({ msgId: 1, index: 0, total: 2 }, payload(5, 1));
    r.accept({ msgId: 1, index: 0, total: 2 }, payload(5, 1)); // reentrega
    expect(r.accept({ msgId: 1, index: 1, total: 2 }, payload(5, 2))).not.toBeNull();
  });

  it('mensagens simultâneas não se misturam', () => {
    const r = new Reassembler();
    r.accept({ msgId: 1, index: 0, total: 2 }, payload(4, 1));
    r.accept({ msgId: 2, index: 0, total: 2 }, payload(4, 9));
    expect(r.pendingCount).toBe(2);

    const m1 = r.accept({ msgId: 1, index: 1, total: 2 }, payload(4, 2))!;
    expect(Array.from(m1.slice(0, 4))).toEqual(Array.from(payload(4, 1)));
    expect(r.pendingCount).toBe(1); // a outra continua pendente
  });

  it('total divergente para o mesmo id descarta o conjunto', () => {
    const r = new Reassembler();
    r.accept({ msgId: 1, index: 0, total: 3 }, payload(4));
    expect(r.accept({ msgId: 1, index: 0, total: 5 }, payload(4))).toBeNull();
    expect(r.pendingCount).toBe(0);
  });

  it('CRÍTICO: conjunto abandonado é descartado — envio interrompido não vaza memória', () => {
    const r = new Reassembler();
    const t0 = 1_000_000;
    r.accept({ msgId: 1, index: 0, total: 99 }, payload(4), t0);
    expect(r.pendingCount).toBe(1);

    r.expire(t0 + REASSEMBLY_TIMEOUT_MS + 1);
    expect(r.pendingCount).toBe(0);
  });

  it('conjunto ativo não expira enquanto recebe fragmento', () => {
    const r = new Reassembler();
    let t = 1_000_000;
    r.accept({ msgId: 1, index: 0, total: 3 }, payload(4), t);
    t += REASSEMBLY_TIMEOUT_MS - 100;
    r.accept({ msgId: 1, index: 1, total: 3 }, payload(4), t);
    t += REASSEMBLY_TIMEOUT_MS - 100;
    expect(r.accept({ msgId: 1, index: 2, total: 3 }, payload(4), t)).not.toBeNull();
  });

  it('libera a entrada ao completar, sem acumular', () => {
    const r = new Reassembler();
    for (let m = 1; m <= 5; m++) {
      r.accept({ msgId: m, index: 0, total: 2 }, payload(4));
      r.accept({ msgId: m, index: 1, total: 2 }, payload(4));
    }
    expect(r.pendingCount).toBe(0);
  });

  it('clear esvazia tudo', () => {
    const r = new Reassembler();
    r.accept({ msgId: 1, index: 0, total: 2 }, payload(4));
    r.clear();
    expect(r.pendingCount).toBe(0);
  });
});

describe('wire — ciclo completo de uma mensagem grande', () => {
  it('divide, enquadra, transmite e remonta um payload de vários fragmentos', () => {
    const original = payload(FRAGMENT_SIZE * 4 + 123);
    const partes = splitPayload(original);
    expect(partes.length).toBeGreaterThan(4);

    const r = new Reassembler();
    let completo: Uint8Array | null = null;
    for (let i = 0; i < partes.length; i++) {
      const frame = decodeFrame(encodeFrame(77, i, partes.length, partes[i]))!;
      completo = r.accept(frame.header, frame.payload);
    }

    expect(completo).not.toBeNull();
    expect(Array.from(completo!)).toEqual(Array.from(original));
  });
});
