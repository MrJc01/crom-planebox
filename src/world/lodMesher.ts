// Mesher de LOD simplificado para chunks distantes utilizando a cor dominante da seções paletizadas — itens 1626-1628.
import * as THREE from 'three';
import { Chunk } from './chunk';
import { valorDominante } from './paleta';
import { BLOCKS, isSolid } from './blocks';

export class LodMesher {
  /**
   * Gera uma malha simplificada de baixa resolução (LOD) para um chunk distante.
   * Cada seção homogênea de 8x8x8 vira um único cubo/voxel representativo com a cor dominante.
   */
  public static buildLodMesh(chunk: Chunk): THREE.Mesh | null {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    let vertexOffset = 0;

    for (let sy = 0; sy < 32; sy++) {
      for (let sz = 0; sz < 4; sz++) {
        for (let sx = 0; sx < 4; sx++) {
          const secIdx = sx + 4 * (sz + 4 * sy);
          const secao = chunk.secoes[secIdx];
          const domBlock = valorDominante(secao);

          if (!isSolid(domBlock)) continue;

          const blockDef = BLOCKS[domBlock];
          if (!blockDef) continue;

          // Coordenadas base da seção em metros
          const x0 = sx * 8;
          const y0 = sy * 8;
          const z0 = sz * 8;
          const x1 = x0 + 8;
          const y1 = y0 + 8;
          const z1 = z0 + 8;

          const [r, g, b] = blockDef.colors[0];

          // Adiciona os 8 vértices do cubo da seção
          positions.push(
            x0, y0, z0,  x1, y0, z0,  x1, y1, z0,  x0, y1, z0,
            x0, y0, z1,  x1, y0, z1,  x1, y1, z1,  x0, y1, z1
          );

          for (let v = 0; v < 8; v++) {
            colors.push(r, g, b);
          }

          // Triângulos das 6 faces do cubo LOD
          const faceIndices = [
            0, 2, 1, 0, 3, 2, // Frontal
            4, 5, 6, 4, 6, 7, // Traseira
            0, 1, 5, 0, 5, 4, // Inferior
            3, 6, 2, 3, 7, 6, // Superior
            0, 4, 7, 0, 7, 3, // Esquerda
            1, 2, 6, 1, 6, 5  // Direita
          ];

          for (const idx of faceIndices) {
            indices.push(vertexOffset + idx);
          }

          vertexOffset += 8;
        }
      }
    }

    if (positions.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    return new THREE.Mesh(geo, mat);
  }
}
