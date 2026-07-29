// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { InventorySearchFilter } from '../../src/player/interaction';
import {
  ProximityWaterLavaSound,
  CaveReverbEffect,
  UnderwaterMuffleEffect,
  TabFocusSilencer,
} from '../../src/audio/AudioSystem';
import {
  CorruptedBiomeSpreader,
  ProgressiveMobilityItem,
  CombinableAccessories,
  BiomeUniqueLoot,
  TrophyCollectionSystem,
  PostBossDifficultyMode,
  FishingRaritySystem,
  ExplorationMapWaypoints,
} from '../../src/world/biomes';
import { VisualMesherRegressionTest } from '../../src/render/scene';

describe('Batch 75 — Busca no Inventário, Áudio Avançado, Biomas Corrompidos, Mobilidade, Loot e Mapa P2', () => {
  describe('interaction — Busca no Inventário (Item 447 P2)', () => {
    it('deve filtrar itens por query de busca', () => {
      const items = [
        { id: 1, name: 'Picareta de Ferro' },
        { id: 2, name: 'Espada de Diamante' },
        { id: 3, name: 'Maçã' },
      ];

      const res = InventorySearchFilter.filterItems(items, 'ferro');
      expect(res.length).toBe(1);
      expect(res[0].id).toBe(1);
    });
  });

  describe('audio — Áudio Avançado (Itens 485, 486, 487, 492 P2)', () => {
    it('deve calcular volume por proximidade', () => {
      expect(ProximityWaterLavaSound.getVolumeByDistance(0, 16)).toBe(1.0);
      expect(ProximityWaterLavaSound.getVolumeByDistance(16, 16)).toBe(0);
    });

    it('deve calcular intensidade de reverb em cavernas', () => {
      expect(CaveReverbEffect.getReverbIntensity(15)).toBe(0.5);
    });

    it('deve aplicar abafamento embaixo d’água', () => {
      expect(UnderwaterMuffleEffect.getLowpassCutoff(true)).toBe(400);
      expect(UnderwaterMuffleEffect.getLowpassCutoff(false)).toBe(22050);
    });

    it('deve silenciar ao perder o foco da aba', () => {
      expect(TabFocusSilencer.shouldMute(false)).toBe(true);
      expect(TabFocusSilencer.shouldMute(true)).toBe(false);
    });
  });

  describe('biomes — Biomas Corrompidos & Mecânicas de Progressão (Itens 503-509, 511, 512 P2)', () => {
    it('deve espalhar contaminação de bioma corrompido', () => {
      const spreader = new CorruptedBiomeSpreader();
      spreader.addCorruptedBlock('0,0,0');

      const newlyCorrupted = spreader.spread(['0,0,1', '0,1,0']);
      expect(newlyCorrupted.length).toBe(2);
      expect(spreader.isCorrupted('0,0,1')).toBe(true);
    });

    it('deve retornar multiplicador de velocidade para itens de mobilidade', () => {
      expect(ProgressiveMobilityItem.getSpeedMultiplier('botas')).toBe(1.5);
    });

    it('deve combinar efeitos de acessórios', () => {
      const combined = CombinableAccessories.combineEffects(['speed', 'jump', 'speed']);
      expect(combined.totalBuffs).toEqual(['speed', 'jump']);
      expect(combined.isCombined).toBe(true);
    });

    it('deve retornar loot único por bioma', () => {
      const loot = BiomeUniqueLoot.getLootForBiome('swamp');
      expect(loot).toContain('swamp_pendant');
    });

    it('deve desbloquear troféus e rastrear conquistas', () => {
      const trophies = new TrophyCollectionSystem();
      expect(trophies.unlockTrophy('first_kill')).toBe(true);
      expect(trophies.unlockTrophy('first_kill')).toBe(false);
      expect(trophies.getUnlockedCount()).toBe(1);
    });

    it('deve alterar spawn rate no modo pós-boss', () => {
      const postBoss = new PostBossDifficultyMode();
      expect(postBoss.getEnemySpawnRateMultiplier()).toBe(1.0);
      postBoss.activate();
      expect(postBoss.getEnemySpawnRateMultiplier()).toBe(2.5);
    });

    it('deve determinar raridade de pesca por roll', () => {
      const fish = FishingRaritySystem.catchFish(0.99);
      expect(fish.rarity).toBe('lendario');
    });

    it('deve registrar chunks explorados e waypoints no mapa', () => {
      const map = new ExplorationMapWaypoints();
      map.exploreChunk(5, 5);
      expect(map.isChunkExplored(5, 5)).toBe(true);

      map.addWaypoint({ id: 'home', name: 'Base', x: 0, z: 0 });
      expect(map.getWaypoints().length).toBe(1);
    });
  });

  describe('render — Teste de Regressão Visual do Mesher (Item 472 P2)', () => {
    it('deve computar hash determinístico de vértices', () => {
      const pos = new Float32Array([1.0, 2.5, 3.1, 4.0]);
      const hash1 = VisualMesherRegressionTest.computeVertexHash(pos);
      const hash2 = VisualMesherRegressionTest.computeVertexHash(pos);
      expect(hash1).toBe(hash2);
      expect(hash1).toBeGreaterThan(0);
    });
  });
});
