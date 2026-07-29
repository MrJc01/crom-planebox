// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { NonBlockModItemRegistrar } from '../../src/mods/ModAPI';
import {
  AgentLongTermMemory,
  SemanticHistorySearch,
  MeasurementTool,
  ArchitectMode,
  GameModeToolLimits,
} from '../../src/player/interaction';

describe('Batch 69 — Testes de Mod Items Não-Bloco, Memória de Longo Prazo, Busca Semântica, Medição, Arquiteto e Limite de Ferramentas P2', () => {
  describe('ModAPI — Registro de Itens Não-Bloco (Item 309 P2)', () => {
    it('deve registrar itens não-bloco de mods', () => {
      const reg = new NonBlockModItemRegistrar();
      const success = reg.register({ id: 'espada_laser', name: 'Espada Laser', category: 'ferramenta' });
      expect(success).toBe(true);
      expect(reg.get('espada_laser')?.category).toBe('ferramenta');
    });
  });

  describe('interaction — Memória de Longo Prazo do Agente (Item 345 P2)', () => {
    it('deve registrar ações e localizações das construções', () => {
      const mem = new AgentLongTermMemory();
      mem.remember('Construiu casa de madeira', 10, 64, 10);
      expect(mem.getMemories().length).toBe(1);
      expect(mem.getMemories()[0].action).toContain('madeira');
    });
  });

  describe('interaction — Busca Semântica no Histórico (Item 346 P2)', () => {
    it('deve filtrar memórias por palavras-chave relevantes', () => {
      const mem = new AgentLongTermMemory();
      mem.remember('Construiu ponte de pedra', 0, 64, 0);
      mem.remember('Plantou trigo', 10, 64, 10);

      const results = SemanticHistorySearch.search(mem.getMemories(), 'ponte');
      expect(results.length).toBe(1);
      expect(results[0].action).toContain('ponte');
    });
  });

  describe('interaction — Ferramenta de Medição (Item 348 P2)', () => {
    it('deve medir distância 3D entre pontos', () => {
      const dist = MeasurementTool.measureDistance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 });
      expect(dist).toBe(5);
    });

    it('deve verificar se área está totalmente livre', () => {
      const isSolid = (x: number, y: number, z: number) => x === 2;
      const isFree = MeasurementTool.isAreaFree({ x: 0, y: 0, z: 0 }, { dx: 3, dy: 1, dz: 1 }, isSolid);
      expect(isFree).toBe(false); // Colidiu com x = 2
    });
  });

  describe('interaction — Modo Arquiteto (Item 349 P2)', () => {
    it('deve propor 3 variantes de construção', () => {
      const variants = ArchitectMode.generateVariants('faça uma casa');
      expect(variants.length).toBe(3);
      expect(variants[0].name).toBe('Estilo Rústico');
    });
  });

  describe('interaction — Limites de Ferramentas por Modo de Jogo (Item 350 P2)', () => {
    it('deve limitar ferramentas no modo aventura/sobrevivência', () => {
      const survival = GameModeToolLimits.getAvailableTools('sobrevivencia');
      expect(survival).not.toContain('voar');

      const creative = GameModeToolLimits.getAvailableTools('criativo');
      expect(creative).toContain('voar');
    });
  });
});
