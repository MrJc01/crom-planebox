// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  CharacterEmotesSystem,
  CharacterFacialFeatures,
  CharacterPresetsManager,
  CharacterExportImportJSON,
} from '../../src/player/interaction';
import { OverTheShoulderCamera } from '../../src/engine/CameraManager';
import {
  PWAInstallManager,
  ServiceWorkerCacheManager,
  IndexedDBQuotaWarning,
  FullPlayerProfileExportImport,
} from '../../src/storage/Database';

describe('Batch 78 — Emotes, Personalização de Personagem, Câmera 3ª Pessoa & PWA P2', () => {
  describe('interaction — Emotes & Personalização (Itens 596, 597, 598, 600 P2)', () => {
    it('deve alternar e parar emotes de gestos', () => {
      const emotes = new CharacterEmotesSystem();
      emotes.playEmote('dance');
      expect(emotes.currentEmote).toBe('dance');

      emotes.stopEmote();
      expect(emotes.currentEmote).toBeNull();
    });

    it('deve ajustar características faciais', () => {
      const facial = new CharacterFacialFeatures();
      facial.setFeature('beard', 'full_beard');
      expect(facial.options.beard).toBe('full_beard');
    });

    it('deve salvar e consultar presets de personagem', () => {
      const manager = new CharacterPresetsManager();
      const preset = {
        name: 'Guerreiro',
        skinColor: '#ffcc99',
        facial: { eyebrows: 'thick', beard: 'none', mouth: 'smile' },
      };

      manager.savePreset(preset);
      expect(manager.getPreset('Guerreiro')?.skinColor).toBe('#ffcc99');
      expect(manager.listPresets().length).toBe(1);
    });

    it('deve exportar e importar preset em JSON', () => {
      const preset = {
        name: 'Mago',
        skinColor: '#7744aa',
        facial: { eyebrows: 'thin', beard: 'long', mouth: 'neutral' },
      };

      const json = CharacterExportImportJSON.exportToJSON(preset);
      const imported = CharacterExportImportJSON.importFromJSON(json);
      expect(imported?.name).toBe('Mago');
    });
  });

  describe('CameraManager — Ombro Esquerdo/Direito na 3ª Pessoa (Item 599 P2)', () => {
    it('deve alternar ombro e calcular offset lateral', () => {
      const cam = new OverTheShoulderCamera();
      expect(cam.shoulder).toBe('right');
      expect(cam.getShoulderOffset()).toBe(0.75);

      cam.toggleShoulder();
      expect(cam.shoulder).toBe('left');
      expect(cam.getShoulderOffset()).toBe(-0.75);
    });
  });

  describe('storage — PWA, SW, Storage Quota & Perfil Export (Itens 613, 614, 615, 616 P2)', () => {
    it('deve verificar status de PWA e URL do manifesto', () => {
      expect(typeof PWAInstallManager.isPWAInstalled()).toBe('boolean');
      expect(PWAInstallManager.getManifestURL()).toBe('/manifest.webmanifest');
    });

    it('deve checar registro de ServiceWorker', async () => {
      const sw = await ServiceWorkerCacheManager.registerSW();
      expect(typeof sw.registered).toBe('boolean');
    });

    it('deve consultar cota do IndexedDB sem falhas', async () => {
      const quota = await IndexedDBQuotaWarning.checkStorageQuota();
      expect(typeof quota.warning).toBe('boolean');
    });

    it('deve exportar e importar perfil completo do jogador', () => {
      const profile = {
        username: 'Steve',
        appearance: { skin: 'default' },
        presets: [],
        stats: { blocksBroken: 150 },
      };

      const json = FullPlayerProfileExportImport.exportProfile(profile);
      const imported = FullPlayerProfileExportImport.importProfile(json);
      expect(imported?.username).toBe('Steve');
      expect(imported?.stats.blocksBroken).toBe(150);
    });
  });
});
