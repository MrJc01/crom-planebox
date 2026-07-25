// Ponte entre a geometria crua do mesher e o Three.js.
//
// Existe separado de `mesher.ts` porque aquele módulo roda dentro do Web Worker: importar o
// Three.js lá dentro inflava o bundle do worker em ~100 KB que nunca seriam usados. Aqui fica
// só o que a thread principal precisa.

import * as THREE from 'three';
import { ChunkGeometryRaw, RawGeometry, meshChunkRaw } from './mesher';

export interface ChunkGeometry {
  solid: THREE.BufferGeometry | null;
  water: THREE.BufferGeometry | null;
  glass: THREE.BufferGeometry | null;
}

/** Monta a `BufferGeometry` a partir dos arrays crus. É barato: não copia os dados. */
export function geometryFromRaw(bruto: RawGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(bruto.pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(bruto.col, 3));
  g.setIndex(new THREE.BufferAttribute(bruto.idx, 1));
  g.computeVertexNormals();
  return g;
}

/**
 * Gera a malha na própria thread e já devolve `BufferGeometry`.
 * O jogo usa o worker; isto serve para teste e para o caminho de emergência.
 */
export function meshChunk(padded: Uint8Array, cx: number, cz: number, light?: Uint8Array, sunScale = 1): ChunkGeometry {
  const bruto: ChunkGeometryRaw = meshChunkRaw(padded, cx, cz, light, sunScale);
  return {
    solid: bruto.solid ? geometryFromRaw(bruto.solid) : null,
    water: bruto.water ? geometryFromRaw(bruto.water) : null,
    glass: bruto.glass ? geometryFromRaw(bruto.glass) : null,
  };
}
