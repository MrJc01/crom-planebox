// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { getCellularBiomeRegion, getBiomeSpacingFactor } from '../../src/world/escalaDeBioma';

describe('Batch 41 — Testes de Regiões Celulares, Espaçamento de Bioma e Auditoria de Tipagem P1', () => {
  describe('escalaDeBioma — Regiões Celulares e Espaçamento Variável (Itens 1597, 1598 P1)', () => {
    it('deve mapear coordenadas para a célula de bioma correspondente', () => {
      const cell1 = getCellularBiomeRegion(100, 200, 512);
      expect(cell1.cellX).toBe(0);
      expect(cell1.cellZ).toBe(0);

      const cell2 = getCellularBiomeRegion(600, 1200, 512);
      expect(cell2.cellX).toBe(1);
      expect(cell2.cellZ).toBe(2);
    });

    it('deve retornar fatores de espaçamento diferenciados para biomas vastos vs locais', () => {
      const factorDeserto = getBiomeSpacingFactor('deserto');
      const factorPantano = getBiomeSpacingFactor('pantano');

      expect(factorDeserto).toBeGreaterThan(factorPantano);
    });
  });
});
