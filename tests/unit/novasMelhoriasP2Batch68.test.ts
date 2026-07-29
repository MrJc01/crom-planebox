// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import {
  ModBiomeRegistry,
  ModCraftingRecipeRegistry,
  ModHookRegistry,
  ModGallerySharing,
} from '../../src/mods/ModAPI';

describe('Batch 68 — Testes de Receitas de Mods, Registro de Biomas, Hooks e Galeria P2', () => {
  describe('ModAPI — Mods Registrando Biomas (Item 310 P2)', () => {
    it('deve registrar e listar biomas de mods', () => {
      const reg = new ModBiomeRegistry();
      const success = reg.register({
        id: 'floresta_cristal',
        temperature: 0.5,
        humidity: 0.8,
        surfaceBlock: 20,
        subBlock: 1,
      });

      expect(success).toBe(true);
      expect(reg.get('floresta_cristal')?.surfaceBlock).toBe(20);
      expect(reg.list().length).toBe(1);
    });
  });

  describe('ModAPI — Mods Registrando Receitas de Crafting (Item 308 P2)', () => {
    it('deve permitir mods registrarem novas receitas', () => {
      const reg = new ModCraftingRecipeRegistry();
      const success = reg.register({
        id: 'mod_recipe_1',
        name: 'Super Bloco',
        outputBlock: 99,
        outputCount: 1,
        ingredients: { 1: 4 },
      });

      expect(success).toBe(true);
      expect(reg.get('mod_recipe_1')?.name).toBe('Super Bloco');
    });
  });

  describe('ModAPI — Hooks de Mod (onBlockPlaced, onTick) (Item 312 P2)', () => {
    it('deve disparar callbacks quando eventos de bloco/tick ocorrerem', () => {
      const hooks = new ModHookRegistry();
      const onPlaced = vi.fn();
      const onTick = vi.fn();

      hooks.onBlockPlaced(onPlaced);
      hooks.onTick(onTick);

      hooks.triggerBlockPlaced(10, 64, 10, 2);
      hooks.triggerTick(0.016);

      expect(onPlaced).toHaveBeenCalledWith(10, 64, 10, 2);
      expect(onTick).toHaveBeenCalledWith(0.016);
    });
  });

  describe('ModAPI — Galeria e Compartilhamento de Mods (Item 316 P2)', () => {
    it('deve publicar, buscar e baixar mods da galeria', () => {
      const gallery = new ModGallerySharing();
      gallery.publishMod({
        id: 'mod_1',
        title: 'Mod de Voo',
        author: 'DevUser',
        downloadCount: 0,
        code: 'console.log("fly");',
      });

      const searchResult = gallery.searchMods('voo');
      expect(searchResult.length).toBe(1);
      expect(searchResult[0].author).toBe('DevUser');

      const downloaded = gallery.downloadMod('mod_1');
      expect(downloaded?.downloadCount).toBe(1);
    });
  });
});
