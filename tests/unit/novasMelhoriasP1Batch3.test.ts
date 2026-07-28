import { describe, it, expect } from 'vitest';
import { World } from '../../src/world/world';
import { Chunk } from '../../src/world/chunk';
import {
  MiniStructureEditor,
  createCraftingTableItem,
  MiniStructureEditorHistory,
  createScaleTableItem,
  calculateScaleRequirements,
  MesaDeEscalaQueue,
  materializeScaledStructure,
} from '../../src/world/miniStructureEditor';
import { groupNeighborChunkMeshes } from '../../src/render/scene';
import { updateFirstPersonToolView, renderEquipmentOverlay } from '../../src/player/controller';
import {
  getModSessionMap,
  computeRevisionDiff,
  pruneOldRevisions,
  rollbackPartialRevision,
  revertRevisionWorldBlocks,
} from '../../src/mods/ModService';
import {
  isMountainBiomeHeightCondition,
  smoothBiomeHeightTransition,
  getBiomeHostileMob,
  getBiomeTemperatureEffect,
  selectModBiomeEqualWeight,
} from '../../src/world/worldgen';
import {
  generateUndergroundStructure,
  generateVillageStructures,
  validateScatterBiomeConstraint,
} from '../../src/world/scatter';
import { emptyModPackage } from '../../src/mods/ModTypes';

describe('Suíte de Testes Batch 3 P1 — Mesa de Escala, Visão 1ª Pessoa, Revisões de Mods, Biomas e Estruturas', () => {
  // ── 1564 Item Mesa de Criação ──
  it('1564 — cria item funcional da mesa de criação de mini-blocos', () => {
    const item = createCraftingTableItem();
    expect(item.id).toBe('mesa_de_criacao');
    expect(item.isFunctional).toBe(true);
  });

  // ── 1565 Volume delimitado visual ──
  it('1565 — retorna a caixa delimitadora visual do editor', () => {
    const editor = new MiniStructureEditor({ originX: 10, originY: 10, originZ: 10, sizeX: 8, sizeY: 8, sizeZ: 8 });
    const bbox = editor.getVisualBoundingBox();
    expect(bbox.sizeX).toBe(8);
    expect(bbox.originX).toBe(10);
  });

  // ── 1566 Desfazer/refazer do editor ──
  it('1566 — desfaz e refaz alterações locais do editor', () => {
    const world = new World();
    world.addChunk(new Chunk(0, 0));

    const history = new MiniStructureEditorHistory();
    history.pushAction([{ x: 2, y: 2, z: 2, oldBlock: 0, newBlock: 1 }]);
    world.setBlock(2, 2, 2, 1);

    expect(world.getBlock(2, 2, 2)).toBe(1);

    // Undo
    history.undo(world);
    expect(world.getBlock(2, 2, 2)).toBe(0);

    // Redo
    history.redo(world);
    expect(world.getBlock(2, 2, 2)).toBe(1);
  });

  // ── 1567 Template em escala original ──
  it('1567 — exporta mini template reusável', () => {
    const world = new World();
    world.addChunk(new Chunk(0, 0));
    world.setBlock(1, 1, 1, 3); // bloco de terra

    const editor = new MiniStructureEditor({ originX: 0, originY: 0, originZ: 0, sizeX: 4, sizeY: 4, sizeZ: 4 });
    const template = editor.exportMiniTemplate(world, 'tpl-1', 'Miniauto');
    expect(template.id).toBe('tpl-1');
    expect(template.blocks.length).toBe(1);
    expect(template.blocks[0].block).toBe(3);
  });

  // ── 1652 Item Mesa de Escala ──
  it('1652 — cria item funcional da mesa de escala', () => {
    const item = createScaleTableItem();
    expect(item.id).toBe('mesa_de_escala');
    expect(item.isFunctional).toBe(true);
  });

  // ── 1653 Cálculo de requisitos de blocos por escala ──
  it('1653 — calcula multiplicador de blocos proporcional à escala escolhida', () => {
    const template = {
      id: 'test',
      name: 'Test',
      blocks: [
        { dx: 0, dy: 0, dz: 0, block: 1 },
        { dx: 1, dy: 0, dz: 0, block: 2 },
      ],
    };

    // Escala 2x -> 2^3 = 8 por bloco -> 16 total
    const reqs = calculateScaleRequirements(template, 2);
    expect(reqs.targetScale).toBe(2);
    expect(reqs.totalBlocksNeeded).toBe(16);
    expect(reqs.blockCounts[1]).toBe(8);
    expect(reqs.blockCounts[2]).toBe(8);
  });

  // ── 1654 Fila de espera por recursos na Mesa de Escala ──
  it('1654 — gerencia depósito de recursos e barra de progresso até atingir requisitos', () => {
    const template = {
      id: 'test',
      name: 'Test',
      blocks: [{ dx: 0, dy: 0, dz: 0, block: 1 }],
    };
    const reqs = calculateScaleRequirements(template, 2); // 8 blocos
    const queue = new MesaDeEscalaQueue(reqs);

    expect(queue.isComplete()).toBe(false);
    expect(queue.getProgressPercentage()).toBe(0);

    const dep1 = queue.deposit(1, 4);
    expect(dep1.accepted).toBe(4);
    expect(dep1.isComplete).toBe(false);
    expect(queue.getProgressPercentage()).toBe(50);

    const dep2 = queue.deposit(1, 10); // tenta depositar mais do que o necessário
    expect(dep2.accepted).toBe(4); // só aceita os 4 restantes
    expect(dep2.isComplete).toBe(true);
    expect(queue.getProgressPercentage()).toBe(100);
  });

  // ── 1655 Materialização da estrutura escalada ──
  it('1655 — materializa a estrutura ampliada no mundo ao completar os requisitos', () => {
    const world = new World();
    world.addChunk(new Chunk(0, 0));

    const template = {
      id: 'test',
      name: 'Test',
      blocks: [{ dx: 0, dy: 0, dz: 0, block: 2 }],
    };

    const res = materializeScaledStructure(template, 2, { x: 0, y: 0, z: 0 }, world);
    expect(res.success).toBe(true);
    expect(res.blocksPlaced).toBe(8);
    expect(world.getBlock(0, 0, 0)).toBe(2);
    expect(world.getBlock(1, 1, 1)).toBe(2);
  });

  // ── 407 Agrupamento de chunks para reduzir draw calls ──
  it('407 — agrupa chaves de chunks vizinhos em grupos de tamanho fixo', () => {
    const chunks = ['0,0', '0,1', '1,0', '1,1', '2,0'];
    const res = groupNeighborChunkMeshes(chunks, 4);
    expect(res.totalGroups).toBe(2);
    expect(res.chunksPerGroup[0].length).toBe(4);
    expect(res.chunksPerGroup[1].length).toBe(1);
  });

  // ── 594 Visão em primeira pessoa de braço e ferramenta ──
  it('594 — calcula transformações de primeira pessoa para ferramenta na mão', () => {
    const viewNoSwing = updateFirstPersonToolView('espada', 0);
    expect(viewNoSwing.visible).toBe(true);

    const viewSwing = updateFirstPersonToolView('espada', 0.5);
    expect(viewSwing.rotation.pitch).toBeLessThan(0); // balança para baixo
  });

  // ── 595 Peças de equipamento visíveis ──
  it('595 — calcula overlay e armadura total de equipamentos equipados', () => {
    const res = renderEquipmentOverlay({
      head: 'capacete_ferro',
      chest: 'peitoral_ferro',
      legs: null,
      feet: null,
    });

    expect(res.slotsVisible.head).toBe(true);
    expect(res.slotsVisible.chest).toBe(true);
    expect(res.slotsVisible.legs).toBe(false);
    expect(res.armorRating).toBe(8); // 2 + 6
  });

  // ── 643 Aba de sessões por mod ──
  it('643 — associa sessões ativas ao mod correto', () => {
    const mod1 = emptyModPackage('mod1', 'Mod Um', 'Desc');
    const mod2 = emptyModPackage('mod2', 'Mod Dois', 'Desc');
    const map = getModSessionMap([mod1, mod2]);

    expect(map.length).toBe(2);
    expect(map[0].modId).toBe('mod1');
    expect(map[1].modId).toBe('mod2');
  });

  // ── 644 Diff legível entre revisões ──
  it('644 — gera diff legível indicando blocos e estruturas adicionados ou removidos', () => {
    const oldP = emptyModPackage('m1', 'Mod', 'Desc');
    const newP = {
      ...oldP,
      blocks: [{ key: 'b1', name: 'Bloco 1', blockId: 100, colors: [[0, 0, 0]] }],
    };

    const diff = computeRevisionDiff(oldP, newP);
    expect(diff.blocksAdded).toBe(1);
    expect(diff.summary).toContain('+1 bloco');
  });

  // ── 645 Limite e poda de revisões ──
  it('645 — poda revisões antigas mantendo apenas o limite máximo', () => {
    const revs = [1, 2, 3, 4, 5, 6, 7];
    const res = pruneOldRevisions(revs, 5);
    expect(res.prunedCount).toBe(2);
    expect(res.kept).toEqual([3, 4, 5, 6, 7]);
  });

  // ── 646 Rollback parcial ──
  it('646 — executa rollback apenas das estruturas mantendo os blocos', () => {
    const current = {
      ...emptyModPackage('m1', 'Mod', 'Desc'),
      blocks: [{ key: 'b1', name: 'Bloco', blockId: 10, colors: [[0, 0, 0]] }],
      structures: [{ id: 's1', name: 'Struct', blocks: [] }],
    };
    const prev = {
      ...emptyModPackage('m1', 'Mod', 'Desc'),
      blocks: [],
      structures: [],
    };

    const rolled = rollbackPartialRevision(current, 'structures_only', prev);
    expect(rolled.blocks.length).toBe(1); // manteve blocos
    expect(rolled.structures.length).toBe(0); // reverteu estruturas
  });

  // ── 647 Reverter blocos do mundo ──
  it('647 — restaura blocos originais no mundo a partir do histórico de revisão', () => {
    const world = new World();
    world.addChunk(new Chunk(0, 0));
    world.setBlock(1, 1, 1, 99); // bloco alterado pelo mod

    const history = [{ x: 1, y: 1, z: 1, originalBlock: 3 }];
    const res = revertRevisionWorldBlocks(history, world);
    expect(res.revertedCount).toBe(1);
    expect(world.getBlock(1, 1, 1)).toBe(3);
  });

  // ── 672 Montanha por altura ──
  it('672 — classifica como montanha se a altura for superior ao limiar', () => {
    expect(isMountainBiomeHeightCondition(70)).toBe(true);
    expect(isMountainBiomeHeightCondition(50)).toBe(false);
  });

  // ── 673 Transição suave de altura ──
  it('673 — realiza interpolação suave entre alturas de biomas', () => {
    const mid = smoothBiomeHeightTransition(10, 20, 0.5);
    expect(mid).toBe(15);
  });

  // ── 674 Mob hostil por bioma ──
  it('674 — retorna mob hostil característico do bioma', () => {
    const resDeserto = getBiomeHostileMob('deserto');
    expect(resDeserto.mob).toBe('esqueleto');

    const resPantano = getBiomeHostileMob('pantano');
    expect(resPantano.mob).toBe('aranha');
  });

  // ── 675 Temperatura e status effect do bioma ──
  it('675 — determina efeito de temperatura congelante na tundra e calor extremo no deserto', () => {
    const tundra = getBiomeTemperatureEffect('tundra');
    expect(tundra.statusEffect).toBe('congelamento');

    const deserto = getBiomeTemperatureEffect('deserto');
    expect(deserto.statusEffect).toBe('calor_extremo');
  });

  // ── 678 Bioma de mod em igualdade de peso ──
  it('678 — escolhe biomas de mod com peso igual aos biomas base', () => {
    const base = ['floresta', 'deserto'];
    const mods = ['vulcano', 'cristal'];
    const chosen = selectModBiomeEqualWeight(base, mods, 3);
    expect(mods).toContain(chosen);
  });

  // ── 687 Estruturas subterrâneas em cavernas ──
  it('687 — gera estrutura subterrânea conectada a caverna', () => {
    const struct = generateUndergroundStructure(123, 15);
    expect(struct.connectedToCave).toBe(true);
    expect(struct.depthY).toBe(15);
  });

  // ── 688 Aldeias com várias estruturas e caminhos ──
  it('688 — gera layout de aldeia com múltiplos edifícios e caminhos de conexão', () => {
    const village = generateVillageStructures(100, 30, 100, 42);
    expect(village.buildingsCount).toBeGreaterThan(2);
    expect(village.hasConnectingPaths).toBe(true);
  });

  // ── 691 Restrição de bioma para espalhamento ──
  it('691 — valida se bioma atual é permitido para estrutura espalhada', () => {
    const valid = validateScatterBiomeConstraint(['floresta', 'pantano'], 'floresta');
    expect(valid.allowed).toBe(true);

    const invalid = validateScatterBiomeConstraint(['floresta', 'pantano'], 'deserto');
    expect(invalid.allowed).toBe(false);
  });
});
