// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import {
  KeyboardMenuNavigation,
  ARIARoleManager,
  MinimapWidget,
  CompassWidget,
  DeathSummaryScreen,
  BlockTooltipProvider,
} from '../../src/ui/HUD';
import { MockedThreeSceneEntityTest } from '../../src/entities/EntitySystem';
import {
  CICoverageRequirement,
  E2EPlaywrightSimulation,
  SaveVersionMigration,
  WorldScenarioFixtures,
} from '../../src/world/world';

describe('Batch 74 — UI/Acessibilidade, Testes CI, E2E, Migração e Fixtures P2', () => {
  describe('HUD — Navegação por Teclado (Item 440 P2)', () => {
    it('deve navegar ciclicamente entre elementos focáveis', () => {
      const el1 = document.createElement('button');
      const el2 = document.createElement('button');
      const nav = new KeyboardMenuNavigation([el1, el2]);

      expect(nav.navigate('next')).toBe(el2);
      expect(nav.navigate('next')).toBe(el1);
      expect(nav.navigate('prev')).toBe(el2);
    });
  });

  describe('HUD — Rótulos ARIA (Item 441 P2)', () => {
    it('deve aplicar aria-label, role e tabindex ao elemento', () => {
      const el = document.createElement('div');
      ARIARoleManager.applyAccessibleLabel(el, 'Abrir Menu', 'menuitem');
      expect(el.getAttribute('aria-label')).toBe('Abrir Menu');
      expect(el.getAttribute('role')).toBe('menuitem');
      expect(el.getAttribute('tabindex')).toBe('0');
    });
  });

  describe('HUD — Minimapa (Item 443 P2)', () => {
    it('deve retornar dados de renderização do minimapa', () => {
      const mm = new MinimapWidget();
      const data = mm.renderMinimapData(100, 200);
      expect(data.center).toEqual([100, 200]);
      expect(data.radius).toBe(16);
    });
  });

  describe('HUD — Bússola (Item 444 P2)', () => {
    it('deve retornar a direção cardeal baseada no ângulo de rotação', () => {
      expect(CompassWidget.getCardinalDirection(0)).toBe('N');
      expect(CompassWidget.getCardinalDirection(Math.PI / 2)).toBe('E');
      expect(CompassWidget.getCardinalDirection(Math.PI)).toBe('S');
    });
  });

  describe('HUD — Tela de Morte (Item 445 P2)', () => {
    it('deve formatar resumo de morte', () => {
      const text = DeathSummaryScreen.formatSummary({ cause: 'Lava', blocksBroken: 42, timeSurvivedSeconds: 300 });
      expect(text).toContain('Lava');
      expect(text).toContain('300');
    });
  });

  describe('HUD — Tooltip de Bloco (Item 446 P2)', () => {
    it('deve mostrar nome e ID do bloco, incluindo mod se aplicável', () => {
      expect(BlockTooltipProvider.getTooltipText(1, 'Pedra')).toBe('Pedra (ID: 1)');
      expect(BlockTooltipProvider.getTooltipText(99, 'Cristal', 'MagicMod')).toContain('[Mod: MagicMod]');
    });
  });

  describe('EntitySystem — Teste com Cena Three Mockada (Item 468 P2)', () => {
    it('deve simular anexação de mesh de entidade a cena mockada', () => {
      const addFn = vi.fn();
      const result = MockedThreeSceneEntityTest.simulateEntityMeshAttachment('ent_1', { add: addFn });
      expect(result).toBe(true);
      expect(addFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('world — CI & Testes E2E (Itens 470, 471, 473, 474 P2)', () => {
    it('deve validar cobertura mínima no CI', () => {
      expect(CICoverageRequirement.isCoverageAcceptable(75, 60)).toBe(true);
      expect(CICoverageRequirement.isCoverageAcceptable(50, 60)).toBe(false);
    });

    it('deve simular workflow E2E de mundo', () => {
      const res = E2EPlaywrightSimulation.simulateWorldWorkflow('TestWorld');
      expect(res.created).toBe(true);
      expect(res.blockPlaced).toBe(true);
    });

    it('deve migrar save de versão antiga para nova', () => {
      const migrated = SaveVersionMigration.migrateSaveData({ version: 1, blocks: [1, 2, 3] });
      expect(migrated.version).toBe(2);
    });

    it('deve gerar fixture de mundo plano para testes', () => {
      const fixture = WorldScenarioFixtures.getFlatWorldFixture();
      expect(fixture.size).toBe(16 * 16 * 3);
      expect(fixture.get('0,0,0')).toBe(3); // Pedra
    });
  });
});
