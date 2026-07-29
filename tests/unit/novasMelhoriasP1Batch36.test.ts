// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { BiomeDef } from '../../src/world/biomes';
import { HeldToolRenderer } from '../../src/player/interaction';
import { B } from '../../src/world/blocks';

describe('Batch 36 — Testes de Biomas de Mod Customizados e Ferramenta Equipada P1', () => {
  describe('biomes — Propriedades de Bioma de Mod (Item 1423 P1)', () => {
    it('deve suportar definição customizada de bloco de superfície e árvore em BiomeDef', () => {
      const customBiome: BiomeDef = {
        id: 'bioma_magico',
        nome: 'Bioma Mágico',
        temp: 0.2,
        moist: 0.8,
        grama: [0.5, 0.2, 0.8],
        folhagem: [0.6, 0.3, 0.9],
        neblina: [0.4, 0.2, 0.6],
        alcanceNeblina: 1.2,
        saturacao: 1.5,
        sazonal: false,
        surfaceBlock: B.SNOW,
        treeType: 'pinheiro',
      };

      expect(customBiome.surfaceBlock).toBe(B.SNOW);
      expect(customBiome.treeType).toBe('pinheiro');
    });
  });

  describe('HeldToolRenderer — Visualização e Animação em 1ª Pessoa (Itens 950, 951 P1)', () => {
    it('deve atualizar o item equipado acompanhando a hotbar e animar o golpe', () => {
      const renderer = new HeldToolRenderer();
      renderer.setEquippedItem(B.DIAMOND_BLOCK);

      expect(renderer.equippedBlock).toBe(B.DIAMOND_BLOCK);
      expect(renderer.isSwinging).toBe(false);

      renderer.triggerPunchAnimation();
      expect(renderer.isSwinging).toBe(true);
      expect(renderer.swingProgress).toBe(0);

      renderer.updateAnimation(0.1);
      expect(renderer.swingProgress).toBeGreaterThan(0);

      renderer.updateAnimation(0.2);
      expect(renderer.isSwinging).toBe(false);
    });
  });
});
