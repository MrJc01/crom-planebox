import { describe, it, expect } from 'vitest';
import { generateWorldTerrainPreview } from '../../src/world/worldgen';

describe('Item 464 P1 — Testes de worldgen Verificando Determinismo por Semente', () => {
  it('deve gerar mapas idênticos para a mesma semente', () => {
    const seed = 987654321;
    const preview1 = generateWorldTerrainPreview(seed, 10, 10);
    const preview2 = generateWorldTerrainPreview(seed, 10, 10);

    expect(preview1.heightMap).toEqual(preview2.heightMap);
    expect(preview1.biomeMap).toEqual(preview2.biomeMap);
  });

  it('deve gerar mapas diferentes para sementes distintas', () => {
    const previewA = generateWorldTerrainPreview(11111, 10, 10);
    const previewB = generateWorldTerrainPreview(99999, 10, 10);

    expect(previewA.heightMap).not.toEqual(previewB.heightMap);
  });
});
