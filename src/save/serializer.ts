// Serialização do mundo: apenas chunks editados, RLE por chunk.
// O terreno intocado é re-gerado pela seed — o save só carrega o diff.
import { World } from '../world/world';
import { Chunk, CHUNK_VOLUME } from '../world/chunk';

const MAGIC = 0x43524f4d; // "CROM"
const VERSION = 1;

export interface SaveData {
  seed: number;
  px: number; py: number; pz: number;
  yaw: number; pitch: number;
}

export function serializeWorld(world: World, meta: SaveData): Uint8Array {
  const edited: Chunk[] = [];
  for (const c of world.chunks.values()) if (c.edited) edited.push(c);

  // estimativa generosa; corta no final
  const parts: number[] = [];
  const pushU32 = (v: number) => { parts.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); };
  const pushF32 = (v: number) => {
    const b = new DataView(new ArrayBuffer(4));
    b.setFloat32(0, v, true);
    parts.push(b.getUint8(0), b.getUint8(1), b.getUint8(2), b.getUint8(3));
  };

  pushU32(MAGIC);
  pushU32(VERSION);
  pushU32(meta.seed);
  pushF32(meta.px); pushF32(meta.py); pushF32(meta.pz);
  pushF32(meta.yaw); pushF32(meta.pitch);
  pushU32(edited.length);

  for (const c of edited) {
    pushU32(c.cx | 0);
    pushU32(c.cz | 0);
    // RLE: [tipo u8][run u16 LE] até cobrir o volume
    const runs: number[] = [];
    let cur = c.data[0], run = 1;
    for (let i = 1; i < CHUNK_VOLUME; i++) {
      const t = c.data[i];
      if (t === cur && run < 65535) run++;
      else { runs.push(cur, run & 255, (run >>> 8) & 255); cur = t; run = 1; }
    }
    runs.push(cur, run & 255, (run >>> 8) & 255);
    pushU32(runs.length);
    for (const b of runs) parts.push(b);
  }

  return new Uint8Array(parts);
}

export function deserializeWorld(bytes: Uint8Array): { meta: SaveData; chunks: Map<string, Uint8Array> } | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 0;
  const readU32 = () => { const v = dv.getUint32(o, true); o += 4; return v; };
  const readF32 = () => { const v = dv.getFloat32(o, true); o += 4; return v; };

  if (bytes.length < 12 || readU32() !== MAGIC) return null;
  const version = readU32();
  if (version !== VERSION) return null;

  const seed = readU32();
  const px = readF32(), py = readF32(), pz = readF32();
  const yaw = readF32(), pitch = readF32();
  const count = readU32();

  const chunks = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    const cx = readU32() | 0, cz = readU32() | 0;
    const len = readU32();
    const data = new Uint8Array(CHUNK_VOLUME);
    let di = 0;
    for (let r = 0; r < len; r += 3) {
      const t = bytes[o + r];
      const run = bytes[o + r + 1] | (bytes[o + r + 2] << 8);
      data.fill(t, di, di + run);
      di += run;
    }
    o += len;
    chunks.set(cx + ',' + cz, data);
  }

  return { meta: { seed, px, py, pz, yaw, pitch }, chunks };
}
