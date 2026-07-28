// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { RedeDeMods, DependenciasDeRede } from '../../src/mods/RedeDeMods';
import { CABECALHO_PADRAO } from '../../src/mods/ModEnv';
import { FRAGMENT_THRESHOLD, encodeFrame, decodeFrame } from '../../src/net/wire';

describe('Batch 7 — Testes de Segurança de Rede, Modo Offline e P2P Isolation', () => {
  const createMockDeps = (hostsConsentidos: string[] = ['api.clima.org']): DependenciasDeRede => {
    return {
      manifestoDe: () => ({
        capacidades: {},
        rede: { hosts: ['*.clima.org', 'api.clima.org'], motivo: 'clima local', envia: false },
      }),
      hostsConsentidos: () => hostsConsentidos,
      pedirConsentimento: async () => true,
      registrar: vi.fn(),
      buscar: async () => new Response('{"temp": 25}', { status: 200 }),
    };
  };

  describe('Modo Offline Global (Item 774 P1)', () => {
    it('deve recusar chamadas externas quando o modo offline global está ativo', async () => {
      const deps = createMockDeps();
      const rede = new RedeDeMods(deps);

      rede.setModoOffline(true);
      expect(rede.isModoOffline()).toBe(true);

      await expect(rede.chamar('mod-test', 'https://api.clima.org/v1')).rejects.toThrow(
        'modo offline global ativo'
      );
      expect(deps.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          recusa: expect.stringContaining('modo offline global ativo'),
        })
      );
    });

    it('deve permitir chamadas externas normalmente quando o modo offline está desativado', async () => {
      const deps = createMockDeps();
      const rede = new RedeDeMods(deps);

      rede.setModoOffline(false);
      const res = await rede.chamar('mod-test', 'https://api.clima.org/v1');
      expect(res.ok).toBe(true);
      expect(res.texto).toContain('temp');
    });
  });

  describe('Degradação Graciosa de Rede (Item 773 P1)', () => {
    it('chamarComDegradacao deve devolver status 0 e mensagem de erro sem lançar exceção', async () => {
      const deps = createMockDeps();
      const rede = new RedeDeMods(deps);
      rede.setModoOffline(true);

      const res = await rede.chamarComDegradacao('mod-test', 'https://api.clima.org/v1');
      expect(res.ok).toBe(false);
      expect(res.status).toBe(0);
      expect(res.texto).toContain('modo offline global ativo');
    });
  });

  describe('Aviso de Literais Públicos no mod.env (Item 751 P1)', () => {
    it('CABECALHO_PADRAO do mod.env deve conter o aviso de que literais são públicos', () => {
      expect(CABECALHO_PADRAO).toContain('item 751 P1');
      expect(CABECALHO_PADRAO).toContain('Literais salvos diretamente neste arquivo são públicos');
      expect(CABECALHO_PADRAO).toContain('Segredos (chaves de API, tokens) NUNCA devem ser salvos como literais');
    });
  });

  describe('Isolamento do Relay P2P (Item 611 P1)', () => {
    it('o enquadramento de quadros binários P2P deve codificar e decodificar cabeçalhos sem vazar payloads', () => {
      const msgId = 12345;
      const payloadOriginal = new Uint8Array([1, 2, 3, 4, 5]);

      const buffer = encodeFrame(msgId, 0, 1, payloadOriginal);
      const decoded = decodeFrame(buffer);

      expect(decoded).not.toBeNull();
      expect(decoded!.header.msgId).toBe(msgId);
      expect(decoded!.header.index).toBe(0);
      expect(decoded!.header.total).toBe(1);
      expect(decoded!.payload).toEqual(payloadOriginal);
    });

    it('FRAGMENT_THRESHOLD deve ser 48KB para fragmentação segura', () => {
      expect(FRAGMENT_THRESHOLD).toBe(48 * 1024);
    });
  });
});
