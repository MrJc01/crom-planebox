// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { SimulatedPeerProtocolTest } from '../../src/net/PeerSync';
import {
  WaterCurrentPushSystem,
  SunWaterEvaporationSystem,
  IceFreezingSystem,
  LavaCoolingStoneSystem,
  WaterTurbineMechanicalPower,
} from '../../src/world/physics';

describe('Batch 76 — Protocolo P2P Simulador e Física Avançada de Fluidos P2', () => {
  describe('net — Testes do Protocolo com Peers Simulados (Item 469 P2)', () => {
    it('deve simular troca de mensagens de protocolo entre peers', () => {
      const res = SimulatedPeerProtocolTest.simulateProtocolHandshake('host_peer', 'guest_peer');
      expect(res.success).toBe(true);
      expect(res.latencyMs).toBeLessThan(100);
    });
  });

  describe('physics — Física de Fluidos (Itens 545, 546, 547, 548, 549 P2)', () => {
    it('deve calcular empurrão de correnteza de água', () => {
      const push = WaterCurrentPushSystem.calculateWaterPush({ x: 1, z: 0 }, 2.5);
      expect(push.pushX).toBe(2.5);
      expect(push.pushZ).toBe(0);
    });

    it('deve evaporar poça rasa no sol com temperatura alta', () => {
      expect(SunWaterEvaporationSystem.shouldEvaporate(true, true, 0.8)).toBe(true);
      expect(SunWaterEvaporationSystem.shouldEvaporate(true, false, 0.8)).toBe(false);
    });

    it('deve congelar água em biomas gelados', () => {
      expect(IceFreezingSystem.shouldFreezeToIce(9, 0.1)).toBe(true);
      expect(IceFreezingSystem.shouldFreezeToIce(9, 0.5)).toBe(false);
    });

    it('deve resfriar lava em pedra quando longe de fonte de calor', () => {
      expect(LavaCoolingStoneSystem.getCoolingResult(10, false)).toBe(3); // Pedra
      expect(LavaCoolingStoneSystem.getCoolingResult(10, true)).toBeNull();
    });

    it('deve calcular energia mecânica gerada por fluxo de fluido em turbina', () => {
      const torque = WaterTurbineMechanicalPower.calculateGeneratedTorque(5.0, 0.8);
      expect(torque).toBe(40);
    });
  });
});
