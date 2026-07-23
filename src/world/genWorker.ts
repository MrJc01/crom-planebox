// Web Worker: gera chunks fora da main thread para não travar o frame.
import { WorldGen } from './worldgen';

let gen: WorldGen | null = null;

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data;
  if (msg.type === 'init') {
    gen = new WorldGen(msg.seed);
    return;
  }
  if (msg.type === 'gen' && gen) {
    const data = gen.generateChunk(msg.cx, msg.cz);
    (self as unknown as Worker).postMessage(
      { type: 'chunk', cx: msg.cx, cz: msg.cz, buffer: data.buffer },
      [data.buffer],
    );
  }
  // amostra o heightmap para um tile de LOD (Distant Horizons style):
  // n×n colunas com passo `step`, direto da função pura de geração
  if (msg.type === 'lod' && gen) {
    const { level, tx, tz, step, n, tile } = msg;
    const heights = new Int16Array(n * n);
    const surface = new Uint8Array(n * n);
    const tint = new Uint8Array(n * n);
    const ox = tx * tile, oz = tz * tile;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const col = gen.column(ox + i * step, oz + j * step);
        const k = i + j * n;
        heights[k] = col.height;
        surface[k] = col.surface;
        tint[k] = (col.forest * 255) | 0;
      }
    }
    (self as unknown as Worker).postMessage(
      { type: 'lodTile', level, tx, tz, heights, surface, tint },
      [heights.buffer, surface.buffer, tint.buffer],
    );
  }
};
