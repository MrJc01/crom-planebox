// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { EcosystemSimulation, MountableEntity, TransportEntity } from '../../src/entities/EntitySystem';
import { ToolRepairSystem, ItemRecycling } from '../../src/crafting/CraftingSystem';

describe('Batch 60 — Testes de Ecologia, Montarias, Transporte, Reparo de Ferramentas e Reciclagem P2', () => {
  describe('EntitySystem — Ecologia (Item 186 P2)', () => {
    it('deve simular dinâmica de população predador/presa', () => {
      const eco = new EcosystemSimulation();
      const initialPrey = eco.preyCount;
      eco.tick(5);
      expect(eco.preyCount).not.toBe(initialPrey);
    });
  });

  describe('EntitySystem — Entidade Montável (Item 188 P2)', () => {
    it('deve montar e desmontar corretamente', () => {
      const mount = new MountableEntity();
      expect(mount.mount('player1')).toBe(true);
      expect(mount.isMounted).toBe(true);

      // Não permite segundo cavaleiro
      expect(mount.mount('player2')).toBe(false);

      mount.dismount();
      expect(mount.isMounted).toBe(false);
    });
  });

  describe('EntitySystem — Entidade Transportadora (Item 189 P2)', () => {
    it('deve armazenar carga até o limite de slots', () => {
      const trans = new TransportEntity();
      expect(trans.addCargo(3, 64)).toBe(true);
      expect(trans.getCargo().get(3)).toBe(64);
    });
  });

  describe('CraftingSystem — Reparo de Ferramentas (Item 200 P2)', () => {
    it('deve somar durabilidade das duas ferramentas com bônus', () => {
      const repaired = ToolRepairSystem.repair(20, 30, 100);
      expect(repaired).toBe(60); // 20 + 30 + 10
    });

    it('não deve exceder durabilidade máxima', () => {
      expect(ToolRepairSystem.repair(80, 50, 100)).toBe(100);
    });
  });

  describe('CraftingSystem — Reciclagem de Itens (Item 201 P2)', () => {
    it('deve retornar ingredientes da reciclagem de um bloco', () => {
      const result = ItemRecycling.recycle(21);
      expect(result).not.toBeNull();
      expect(result?.outputItem).toBe(30);
      expect(result?.count).toBe(2);
    });
  });
});
