// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { triggerWorldEvent } from '../../src/world/weather';
import { ProjectPalette } from '../../src/crafting/StructureTemplates';
import { UndoManager } from '../../src/storage/UndoManager';
import { getEmissiveGlowConfig } from '../../src/world/lighting';
import { B } from '../../src/world/blocks';

describe('Batch 45 — Testes de Eventos Sazonais, Paleta de Projeto, Limite de Undo e Bloom P2', () => {
  describe('weather — Eventos Sazonais no Mundo (Item 016 P2)', () => {
    it('deve disparar evento sazonal do mundo com cor do céu customizada', () => {
      const evt = triggerWorldEvent('lua_sangue');
      expect(evt.active).toBe(true);
      expect(evt.skyColor).toBe('#ef4444');
    });
  });

  describe('StructureTemplates — Paleta de Projeto Salvável (Item 023 P2)', () => {
    it('deve armazenar e listar a paleta de blocos do projeto', () => {
      const pal = new ProjectPalette('Minha Base');
      pal.addBlock(B.STONE);
      pal.addBlock(B.GLASS);

      expect(pal.getPalette()).toEqual([B.STONE, B.GLASS]);
    });
  });

  describe('UndoManager — Limite de Histórico Configurável (Item 046 P2)', () => {
    it('deve ajustar o limite máximo de histórico dinamicamente', () => {
      const undo = new UndoManager({} as any);
      undo.setMaxHistory(10);
      expect(undo.getMaxHistory()).toBe(10);
    });
  });

  describe('lighting — Configuração de Bloom Emissivo (Item 058 P2)', () => {
    it('deve devolver a configuração de brilho para blocos de luz', () => {
      const glowLava = getEmissiveGlowConfig(B.LAVA);
      expect(glowLava).not.toBeNull();
      expect(glowLava?.intensity).toBe(1.0);

      const glowPedra = getEmissiveGlowConfig(B.STONE);
      expect(glowPedra).toBeNull();
    });
  });
});
