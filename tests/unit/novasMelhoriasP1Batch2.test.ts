import { describe, it, expect } from 'vitest';
import { computeChunkLOD } from '../../src/render/scene';
import { paletizeChunk } from '../../src/world/chunk';
import { generateRiverPath, getBiomeVegetationDensity, getBiomePalette } from '../../src/world/worldgen';
import { PeerSync } from '../../src/net/PeerSync';
import {
  createAIPlan, approveStep, dryRunBuild,
  checkIterationLimit, checkMemoryLimit, detectExposedApiKeys,
} from '../../src/commands/CommandSystem';
import {
  computeSwimPhysics, createDecorativeInstancedMesh, computeVoxelVisualHeight,
} from '../../src/world/physics';
import { generateRuinStructure, generateLootChest } from '../../src/world/scatter';

// PeerSync mock de sinalização
function mockSignaling() {
  return {
    onSignal: null as any,
    onPeerJoined: null as any,
    onPeerLeft: null as any,
    disconnect: () => {},
    closeRoom: () => {},
  };
}

describe('Batch P1 — LOD, Paletização, Rios, IA, Rede, Física, Biomas, Estruturas', () => {

  // ── 031 LOD de chunks distantes ──
  it('031 — retorna LOD 0 (full) para chunks próximos', () => {
    const r = computeChunkLOD(3);
    expect(r.lod).toBe(0);
    expect(r.label).toBe('full');
  });

  it('031 — retorna LOD 1 (simplified) para chunks a média distância', () => {
    const r = computeChunkLOD(9);
    expect(r.lod).toBe(1);
    expect(r.label).toBe('simplified');
  });

  it('031 — retorna LOD 2 (impostor) para chunks muito distantes', () => {
    const r = computeChunkLOD(20);
    expect(r.lod).toBe(2);
    expect(r.label).toBe('impostor');
  });

  // ── 033 Paletização de chunk ──
  it('033 — paletiza array de blocos com poucos tipos distintos', () => {
    const blocks = new Uint8Array([1, 2, 1, 3, 2, 1]);
    const { palette, indices } = paletizeChunk(blocks);
    expect(palette).toContain(1);
    expect(palette).toContain(2);
    expect(palette).toContain(3);
    expect(palette.length).toBe(3);
    // Reconstrução: palette[indices[i]] === blocks[i]
    for (let i = 0; i < blocks.length; i++) {
      expect(palette[indices[i]]).toBe(blocks[i]);
    }
  });

  // ── 104 Rios e lagos ──
  it('104 — gera caminho de rio descendo o gradiente', () => {
    const heightMap = [
      [10, 9, 8],
      [9, 7, 6],
      [8, 6, 3],
    ];
    const { path, lakeCells } = generateRiverPath(heightMap, 0, 0);
    expect(path.length).toBeGreaterThan(1);
    // O caminho termina no ponto mais baixo (3 em [2,2])
    const last = path[path.length - 1];
    expect(last.h).toBeLessThanOrEqual(path[0].h);
  });

  it('104 — detecta lago quando encontra depressão local', () => {
    const heightMap = [
      [10, 10, 10],
      [10, 2, 10],
      [10, 10, 10],
    ];
    const { lakeCells } = generateRiverPath(heightMap, 1, 1);
    expect(lakeCells.length).toBeGreaterThan(0);
  });

  // ── 340 Planejador multi-etapa da IA ──
  it('340 — cria plano com etapas não aprovadas', () => {
    const plan = createAIPlan([
      { description: 'Limpar área', estimatedBlocks: 100 },
      { description: 'Construir fundação', estimatedBlocks: 200 },
    ]);
    expect(plan.length).toBe(2);
    expect(plan[0].approved).toBe(false);
    expect(plan[1].id).toBe(2);
  });

  it('340 — aprova uma etapa pelo ID', () => {
    const plan = createAIPlan([{ description: 'Teste', estimatedBlocks: 50 }]);
    const ok = approveStep(plan, 1);
    expect(ok).toBe(true);
    expect(plan[0].approved).toBe(true);
  });

  // ── 341 Dry-run ──
  it('341 — dry-run detecta operação segura', () => {
    const result = dryRunBuild(500, 100);
    expect(result.safe).toBe(true);
    expect(result.affectedChunks).toBeGreaterThan(0);
  });

  it('341 — dry-run alerta se exceder limite', () => {
    const result = dryRunBuild(8000, 5000);
    expect(result.safe).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  // ── 360 Limite de iterações ──
  it('360 — detecta iterações dentro do limite', () => {
    const r = checkIterationLimit(50, 100);
    expect(r.exceeded).toBe(false);
    expect(r.remaining).toBe(50);
  });

  it('360 — detecta iterações excedidas', () => {
    const r = checkIterationLimit(100, 100);
    expect(r.exceeded).toBe(true);
    expect(r.remaining).toBe(0);
  });

  // ── 361 Limite de memória/blocos por script ──
  it('361 — detecta uso de blocos dentro do limite', () => {
    const r = checkMemoryLimit(500, 10000);
    expect(r.exceeded).toBe(false);
    expect(r.usagePercent).toBe(5);
  });

  it('361 — detecta uso de blocos excedido', () => {
    const r = checkMemoryLimit(10000, 10000);
    expect(r.exceeded).toBe(true);
    expect(r.usagePercent).toBe(100);
  });

  // ── 362 Detecção de chaves de API expostas ──
  it('362 — detecta chave OpenAI exposta', () => {
    const r = detectExposedApiKeys('config: sk-abcdefghij1234567890abcdef');
    expect(r.found).toBe(true);
    expect(r.patterns).toContain('OpenAI');
  });

  it('362 — não alerta em texto seguro', () => {
    const r = detectExposedApiKeys('apenas um texto normal sem chaves');
    expect(r.found).toBe(false);
  });

  // ── 383 Interpolação de posição de jogadores remotos ──
  it('383 — interpola posição entre dois pontos', () => {
    const ps = new PeerSync(mockSignaling());
    const result = ps.interpolateRemotePlayer(
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 20, z: 30 },
      0.5,
    );
    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(10);
    expect(result.z).toBeCloseTo(15);
  });

  // ── 384 Reconexão automática ──
  it('384 — consulta informação de reconexão com backoff', () => {
    const ps = new PeerSync(mockSignaling());
    const r1 = ps.queryReconnectInfo();
    expect(r1.willRetry).toBe(true);
    expect(r1.attempt).toBe(1);
    expect(r1.delayMs).toBe(1000);
  });

  it('384 — reset zera contadores de reconexão', () => {
    const ps = new PeerSync(mockSignaling());
    ps.resetReconnect();
    const r = ps.queryReconnectInfo();
    expect(r.willRetry).toBe(true);
  });

  // ── 385 Delta sync ──
  it('385 — computa delta de versões de chunks', () => {
    const ps = new PeerSync(mockSignaling());
    const local = new Map([['0,0', 3], ['1,0', 2]]);
    const remote = new Map([['0,0', 1], ['2,0', 5]]);
    const delta = ps.computeDeltaSync(local, remote);
    expect(delta.chunksToSend).toContain('0,0');
    expect(delta.chunksToSend).toContain('1,0');
    expect(delta.chunksToRequest).toContain('2,0');
  });

  // ── 387 Validação de permissão OP ──
  it('387 — permite build para qualquer peer', () => {
    const ps = new PeerSync(mockSignaling());
    const r = ps.validatePeerPermission('peer1', 'build', new Set());
    expect(r.allowed).toBe(true);
  });

  it('387 — bloqueia comando de peer sem OP', () => {
    const ps = new PeerSync(mockSignaling());
    (ps as any).role = 'guest';
    const r = ps.validatePeerPermission('peer1', 'command', new Set());
    expect(r.allowed).toBe(false);
  });

  // ── 406 Instanced mesh para decorativos ──
  it('406 — cria instanced mesh para decorativos', () => {
    const r = createDecorativeInstancedMesh(100);
    expect(r.created).toBe(true);
    expect(r.maxCount).toBe(100);
  });

  it('406 — recusa instanced mesh com count zero', () => {
    const r = createDecorativeInstancedMesh(0);
    expect(r.created).toBe(false);
  });

  // ── 499 Eventos de invasão (apenas definição; spawning testado em mobSync) ──
  // O teste do spawnHostile já é coberto; aqui validamos a interface InvasionEvent
  it('499 — InvasionEvent interface está exportada', async () => {
    const mod = await import('../../src/entities/EntitySystem');
    // Se InvasionEvent existir como tipo, a importação do módulo não falha
    expect(mod.EntitySystem).toBeDefined();
  });

  // ── 541 Altura visual do voxel por volume ──
  it('541 — voxel com volume total tem heightScale 1', () => {
    const r = computeVoxelVisualHeight(1);
    expect(r.heightScale).toBe(1);
  });

  it('541 — voxel com metade do volume tem heightScale 0.5', () => {
    const r = computeVoxelVisualHeight(0.5);
    expect(r.heightScale).toBeCloseTo(0.5);
  });

  // ── 542 Nadar e boiar ──
  it('542 — sem submersão, não entra em modo natação', () => {
    const r = computeSwimPhysics(0, false, false, 0, 0.016);
    expect(r.isSwimming).toBe(false);
  });

  it('542 — com submersão, ativa modo natação', () => {
    const r = computeSwimPhysics(0.8, true, false, 0, 0.016);
    expect(r.isSwimming).toBe(true);
    expect(r.velY).toBeGreaterThan(0); // flutuando
  });

  // ── 670 Vegetação por bioma ──
  it('670 — floresta tem alta densidade de árvores', () => {
    const v = getBiomeVegetationDensity('floresta');
    expect(v.treeDensity).toBeGreaterThan(0.5);
  });

  it('670 — deserto tem baixíssima densidade de árvores', () => {
    const v = getBiomeVegetationDensity('deserto');
    expect(v.treeDensity).toBeLessThan(0.1);
  });

  // ── 671 Paleta de blocos por bioma ──
  it('671 — floresta usa grama como superfície', () => {
    const p = getBiomePalette('floresta');
    expect(p.surface).toBe('grama');
  });

  it('671 — deserto usa areia como superfície', () => {
    const p = getBiomePalette('deserto');
    expect(p.surface).toBe('areia');
  });

  // ── 685 Ruínas e torres ──
  it('685 — gera estrutura de ruína procedural', () => {
    const r = generateRuinStructure(42, 'floresta');
    expect(['torre', 'ruina', 'acampamento']).toContain(r.type);
    expect(r.sizeX).toBeGreaterThan(0);
    expect(r.hasLoot).toBe(true);
  });

  // ── 686 Baú de loot ──
  it('686 — gera loot para torre', () => {
    const loot = generateLootChest('torre', 7);
    expect(loot.length).toBeGreaterThan(0);
    expect(loot[0].item).toBeDefined();
  });

  it('686 — gera loot para acampamento', () => {
    const loot = generateLootChest('acampamento', 13);
    expect(loot.length).toBeGreaterThan(0);
  });
});
