// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  NPCDailyRoutine,
  NPCDialogueTree,
  NPCTradingSystem,
  FactionRelationSystem,
  HerdBehavior,
} from '../../src/entities/EntitySystem';

describe('Batch 59 — Testes de Rotina de NPC, Diálogos, Comércio, Relações de Facções e Manadas P2', () => {
  describe('EntitySystem — Rotina Diária de NPC (Item 181 P2)', () => {
    it('deve determinar a tarefa apropriada para o horário', () => {
      expect(NPCDailyRoutine.getTaskForTime(0.75)).toBe('dormir');
      expect(NPCDailyRoutine.getTaskForTime(0.2)).toBe('trabalhar');
      expect(NPCDailyRoutine.getTaskForTime(0.5)).toBe('socializar');
    });
  });

  describe('EntitySystem — Árvore de Diálogo (Item 182 P2)', () => {
    it('deve navegar pela árvore de opções', () => {
      const tree = new NPCDialogueTree();
      tree.addNode({
        id: 'start',
        text: 'Olá forasteiro!',
        options: [{ responseText: 'Quem é você?', nextNodeId: 'info' }],
      });
      tree.addNode({
        id: 'info',
        text: 'Sou o ferreiro da vila.',
        options: [{ responseText: 'Adeus.' }],
      });

      expect(tree.getCurrentNode()?.text).toBe('Olá forasteiro!');
      tree.selectOption(0);
      expect(tree.getCurrentNode()?.text).toBe('Sou o ferreiro da vila.');
    });
  });

  describe('EntitySystem — Comércio com NPC (Item 183 P2)', () => {
    it('deve realizar trocas se o jogador possuir os itens exigidos', () => {
      const trading = new NPCTradingSystem();
      trading.addOffer({ id: 'trade1', giveItem: 31, giveCount: 5, receiveItem: 22, receiveCount: 1 });

      const inv = new Map<number, number>([[31, 10]]);
      const success = trading.executeTrade('trade1', inv);

      expect(success).toBe(true);
      expect(inv.get(31)).toBe(5);
      expect(inv.get(22)).toBe(1);
    });

    it('deve recusar troca se não houver itens suficientes', () => {
      const trading = new NPCTradingSystem();
      trading.addOffer({ id: 'trade1', giveItem: 31, giveCount: 5, receiveItem: 22, receiveCount: 1 });

      const inv = new Map<number, number>([[31, 2]]);
      const success = trading.executeTrade('trade1', inv);
      expect(success).toBe(false);
    });
  });

  describe('EntitySystem — Relações de Facções (Item 184 P2)', () => {
    it('deve definir e consultar relações entre facções', () => {
      const facs = new FactionRelationSystem();
      facs.setRelation('humanos', 'orcs', 'hostil');
      facs.setRelation('humanos', 'elfos', 'aliado');

      expect(facs.getRelation('humanos', 'orcs')).toBe('hostil');
      expect(facs.getRelation('humanos', 'elfos')).toBe('aliado');
      expect(facs.getRelation('humanos', 'anões')).toBe('neutro');
      expect(facs.getRelation('humanos', 'humanos')).toBe('aliado');
    });
  });

  describe('EntitySystem — Comportamento de Manada (Item 185 P2)', () => {
    it('deve calcular o centro de massa do grupo', () => {
      const members = [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 5, y: 6, z: 9 },
      ];
      const center = HerdBehavior.calculateHerdCenter(members);
      expect(center.x).toBe(5);
      expect(center.y).toBe(2);
      expect(center.z).toBe(3);
    });
  });
});
