// Web Worker: gera a malha do chunk fora da thread principal.
//
// Depois que o recálculo de luz deixou de ser o gargalo, o maior custo de frame que sobrou é
// justamente este: percorrer 131 mil voxels e montar dezenas de milhares de faces, na mesma
// thread que desenha. Cada re-mesh era um engasgo visível.
//
// O que atravessa a fronteira são `Uint8Array` (blocos e luz) na ida e `Float32Array`/
// `Uint32Array` (posições, cores, índices) na volta — todos **transferidos**, não copiados.
// `BufferGeometry` não é transferível, então ela é montada do outro lado, o que é barato.

import { meshChunkRaw, transferablesOf } from './mesher';

interface PedidoMesh {
  type: 'mesh';
  /** Identifica a resposta — o chunk pode ter mudado de novo enquanto esta rodava. */
  jobId: number;
  cx: number;
  cz: number;
  padded: ArrayBuffer;
  light: ArrayBuffer | null;
  sunScale: number;
}

self.onmessage = (ev: MessageEvent<PedidoMesh>) => {
  const msg = ev.data;
  if (msg?.type !== 'mesh') return;

  const padded = new Uint8Array(msg.padded);
  const light = msg.light ? new Uint8Array(msg.light) : undefined;

  const bruto = meshChunkRaw(padded, msg.cx, msg.cz, light, msg.sunScale);

  // Os buffers de entrada voltam junto: a thread principal os reaproveita em vez de alocar
  // 300 KB novos a cada re-mesh.
  const devolver: Transferable[] = [...transferablesOf(bruto), msg.padded];
  if (msg.light) devolver.push(msg.light);

  (self as unknown as Worker).postMessage(
    { type: 'meshed', jobId: msg.jobId, cx: msg.cx, cz: msg.cz, geo: bruto, padded: msg.padded, light: msg.light },
    devolver,
  );
};
