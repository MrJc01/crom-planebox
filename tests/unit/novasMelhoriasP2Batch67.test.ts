// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { WorldVersionHistoryRollback, RoundTripExportImportTest } from '../../src/world/world';
import { ModWorldEventRegistry, ModHotReloader, ModP2PSyncManager } from '../../src/mods/ModAPI';

describe('Batch 67 — Testes de Histórico de Versões do Mundo, Round-Trip, Eventos de Mods, Hot Reload e Sync P2P P2', () => {
  describe('world — Histórico de Versões e Rollback (Item 287 P2)', () => {
    it('deve salvar snapshots e permitir rollback para versão anterior', () => {
      const vh = new WorldVersionHistoryRollback();
      const v1Blocks = new Map<string, number>([['0,0,0', 1]]);
      const v1 = vh.createSnapshot(v1Blocks);

      const v2Blocks = new Map<string, number>([['0,0,0', 2], ['1,0,0', 3]]);
      vh.createSnapshot(v2Blocks);

      const restoredV1 = vh.rollbackToVersion(v1);
      expect(restoredV1).not.toBeNull();
      expect(restoredV1?.get('0,0,0')).toBe(1);
      expect(restoredV1?.has('1,0,0')).toBe(false);
    });
  });

  describe('world — Testes de Round-Trip Export/Import (Item 288 P2)', () => {
    it('deve confirmar que exportação e importação preservam 100% dos dados', () => {
      const map = new Map<string, number>([['10,64,10', 5], ['-5,32,-5', 12]]);
      expect(RoundTripExportImportTest.verifyRoundTrip(map)).toBe(true);
    });
  });

  describe('ModAPI — Eventos Customizados de Mundo por Mods (Item 311 P2)', () => {
    it('deve permitir emitir e assinar eventos customizados de mods', () => {
      const events = new ModWorldEventRegistry();
      let triggered = false;
      events.subscribe('boss_defeated', payload => {
        if (payload.bossId === 'dragon') triggered = true;
      });

      events.emit('boss_defeated', { bossId: 'dragon' });
      expect(triggered).toBe(true);
    });
  });

  describe('ModAPI — Hot Reload de Mods (Item 314 P2)', () => {
    it('deve recarregar mods a quente incrementando a versão', () => {
      const reloader = new ModHotReloader();
      const res1 = reloader.loadOrReload('my_mod', 'console.log(1);');
      expect(res1.reloaded).toBe(false);
      expect(res1.version).toBe(1);

      const res2 = reloader.loadOrReload('my_mod', 'console.log(2);');
      expect(res2.reloaded).toBe(true);
      expect(res2.version).toBe(2);
    });
  });

  describe('ModAPI — Sincronização P2P de Mods (Item 317 P2)', () => {
    it('deve empacotar e desempacotar mods para sync multiplayer', () => {
      const mods = [{ id: 'mod1', version: 1, data: 'code' }];
      const payload = ModP2PSyncManager.prepareSyncPayload(mods);
      const unpacked = ModP2PSyncManager.unpackSyncPayload(payload);

      expect(unpacked).toEqual(mods);
    });
  });
});
