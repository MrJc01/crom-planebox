// Núcleo do sistema de mods: validação, alocação de ids e aplicação no registro global de blocos.
//
// Este módulo é deliberadamente **puro** — depende só de `blocks.ts`, sem Three.js, sem Dexie e
// sem DOM. Toda a lógica que pode corromper um save (id de bloco, referência simbólica,
// duplicidade de chave) mora aqui justamente para poder ser testada em Node sem navegador.
//
// A persistência fica no `WorldRepository` e a aplicação no runtime 3D no `ModService`.

import { BlocoComparavel, ConflitoDeCor, corDeHex, verificarContraste } from './contraste';
import type { ColorInput } from './ModTypes';
import {
  BLOCKS,
  CUSTOM_BLOCK_ID_BASE,
  MAX_CUSTOM_BLOCKS,
  registerCustomBlockAt,
  resetCustomBlocks,
  unregisterCustomBlock,
} from '../world/blocks';
import { ModBlockDef, ModPackage, ModStructureBlock } from './ModTypes';
import { BIOMAS_CLIMA, BIOMAS_RELEVO, definicaoDeBioma, registrarBiomaDeMod } from '../world/biomes';
import { registrarRegraDeMod } from '../world/scatter';
import { registrarTemplateDeMod } from '../crafting/StructureTemplates';

/** Ids nativos, para saber quando um bioma declarado por mod precisa de prefixo. */
const BIOMAS_NATIVOS = new Set<string>([
  ...BIOMAS_CLIMA.map((b) => b.id as string),
  ...Object.values(BIOMAS_RELEVO).map((b) => b.id as string),
]);

const KEY_PATTERN = /^[a-z0-9][a-z0-9_]*$/;

/** Normaliza uma chave livre digitada pela IA ('Rubi Bruto') para o formato canônico ('rubi_bruto'). */
export function normalizeKey(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Valida um pacote antes de persistir. Devolve a lista de problemas (vazia = válido).
 * Falhar aqui é sempre melhor que gravar: um mod inconsistente corrompe o mundo silenciosamente.
 */
export function validateModPackage(pkg: ModPackage): string[] {
  const errors: string[] = [];

  if (!pkg.id || !pkg.id.trim()) errors.push('O mod precisa de um id.');
  if (!pkg.name || !pkg.name.trim()) errors.push('O mod precisa de um nome.');

  const seenBlockKeys = new Set<string>();
  for (const b of pkg.blocks || []) {
    if (!KEY_PATTERN.test(b.key)) {
      errors.push(`Chave de bloco inválida: "${b.key}" (use minúsculas, dígitos e _).`);
    }
    if (seenBlockKeys.has(b.key)) errors.push(`Chave de bloco duplicada no mod: "${b.key}".`);
    seenBlockKeys.add(b.key);

    if (!b.name || !b.name.trim()) errors.push(`O bloco "${b.key}" precisa de um nome exibível.`);
    if (b.topColor === undefined || b.topColor === null) {
      errors.push(`O bloco "${b.key}" precisa de topColor.`);
    }
    if (b.blockId !== undefined && b.blockId !== null) {
      if (!Number.isInteger(b.blockId) || b.blockId < CUSTOM_BLOCK_ID_BASE) {
        errors.push(`O bloco "${b.key}" tem blockId inválido (${b.blockId}).`);
      }
    }
  }

  const seenEntityKeys = new Set<string>();
  for (const e of pkg.entities || []) {
    if (!KEY_PATTERN.test(e.key)) errors.push(`Chave de entidade inválida: "${e.key}".`);
    if (seenEntityKeys.has(e.key)) errors.push(`Chave de entidade duplicada no mod: "${e.key}".`);
    seenEntityKeys.add(e.key);
    if (!e.parts || e.parts.length === 0) {
      errors.push(`A entidade "${e.key}" precisa de pelo menos uma parte 3D.`);
    }
  }

  const seenStructureKeys = new Set<string>();
  for (const s of pkg.structures || []) {
    if (!KEY_PATTERN.test(s.key)) errors.push(`Chave de estrutura inválida: "${s.key}".`);
    if (seenStructureKeys.has(s.key)) errors.push(`Chave de estrutura duplicada no mod: "${s.key}".`);
    seenStructureKeys.add(s.key);
    if (!s.blocks || s.blocks.length === 0) {
      errors.push(`A estrutura "${s.key}" está vazia.`);
    }
  }

  return errors;
}

/** Todos os ids de bloco já comprometidos por um conjunto de mods (inclusive os desabilitados). */
export function collectUsedBlockIds(mods: ModPackage[]): Set<number> {
  const used = new Set<number>();
  for (const mod of mods) {
    for (const b of mod.blocks || []) {
      if (Number.isInteger(b.blockId)) used.add(b.blockId);
    }
  }
  return used;
}

/**
 * Atribui `blockId` aos blocos que ainda não têm um, evitando os ids já usados por **qualquer**
 * mod do mundo — inclusive desabilitados, porque um mod desabilitado pode ser reativado e os
 * blocos dele ainda podem estar colocados no mundo.
 *
 * Mods desabilitados serem contados aqui é o que impede o cenário clássico de corrupção:
 * desabilitar o mod A, criar o mod B que reusa o id 64, reabilitar A — e as construções de A
 * virarem blocos de B.
 */
export function allocateBlockIds(pkg: ModPackage, otherMods: ModPackage[] = []): ModPackage {
  const used = collectUsedBlockIds([...otherMods, pkg]);
  let cursor = CUSTOM_BLOCK_ID_BASE;

  for (const b of pkg.blocks || []) {
    if (Number.isInteger(b.blockId) && b.blockId >= CUSTOM_BLOCK_ID_BASE) continue;

    while (used.has(cursor)) cursor++;
    if (cursor >= CUSTOM_BLOCK_ID_BASE + MAX_CUSTOM_BLOCKS) {
      throw new Error(
        `Limite de ${MAX_CUSTOM_BLOCKS} blocos customizados por mundo atingido. ` +
          `Remova um mod antigo antes de criar novos blocos.`,
      );
    }
    b.blockId = cursor;
    used.add(cursor);
    cursor++;
  }

  return pkg;
}

/**
 * O bloco novo é distinguível dos que já existem? — item 076.
 *
 * ## Por que NÃO está dentro de `validateModPackage`
 *
 * Aquela função roda também na **carga** de um mod já salvo. Um bloco criado antes desta regra
 * existir passaria a reprovar, e o mod iria para quarentena sozinho na próxima abertura do mundo
 * — o jogador perderia conteúdo por causa de uma regra nova. A regra vale para o que está sendo
 * **criado agora**, e é por isso que ela mora separada e é chamada só no caminho de criação.
 *
 * Compara contra os blocos nativos e contra os de outros mods, ignorando os do próprio pacote:
 * um mod que declara uma família coerente (pedra, pedra musgosa) não deve brigar consigo mesmo.
 */
export function conflitoDeContraste(
  topo: ColorInput,
  ignorarModId?: string,
): ConflitoDeCor | null {
  const existentes: BlocoComparavel[] = [];
  for (const d of BLOCKS) {
    if (!d || d.reserved) continue;
    if (ignorarModId && (d as any).modId === ignorarModId) continue;
    existentes.push({ nome: d.name, topo: [d.colors[0][0], d.colors[0][1], d.colors[0][2]] });
  }
  return verificarContraste(corDeHex(topo), existentes);
}

/**
 * Registra os biomas de um mod — item 676.
 *
 * Devolve os erros, sem estourar: um bioma recusado (centro fora do plano, colisão de nome) não
 * pode impedir os blocos e as criaturas do mesmo mod de carregarem. Um mod meio aplicado é ruim;
 * um mod inteiro perdido por causa de um número errado num bioma é pior.
 */
export function applyModBiomes(pkg: ModPackage): string[] {
  const erros: string[] = [];
  for (const b of pkg.biomes || []) {
    const base = definicaoDeBioma('planicie');
    const cor = (v: ColorInput | undefined, padrao: [number, number, number]): [number, number, number] =>
      v === undefined ? padrao : (corDeHex(v as any) as [number, number, number]);
    const erro = registrarBiomaDeMod({
      id: `${pkg.id}:${b.key}`,
      nome: b.nome,
      temp: b.temp,
      moist: b.moist,
      grama: cor(b.grama, base.grama),
      folhagem: cor(b.folhagem, base.folhagem),
      neblina: cor(b.neblina, base.neblina),
      alcanceNeblina: b.alcanceNeblina ?? base.alcanceNeblina,
      saturacao: b.saturacao ?? base.saturacao,
      sazonal: b.sazonal ?? true,
      minerios: b.minerios,
    });
    if (erro) erros.push(`bioma "${b.key}": ${erro}`);
  }
  return erros;
}

/**
 * Registra as estruturas do mod como templates e as regras de espalhamento delas — item 689.
 *
 * Os templates entram **antes** das regras: uma regra aponta para um template por id, e a ordem
 * inversa deixaria o worldgen achar o sítio e não achar o que carimbar nele — um clarão de terreno
 * aplanado com nada em cima, que se parece com defeito de geração e não com mod mal declarado.
 */
export function applyModScatter(pkg: ModPackage): string[] {
  const erros: string[] = [];
  for (const e of pkg.structures || []) {
    const erro = registrarTemplateDeMod({
      id: `${pkg.id}:${e.key}`,
      name: e.name,
      // As estruturas de mod guardam `block` como id **ou** referência simbólica. O carimbo do
      // worldgen espera id numérico, então o que não resolver é descartado com aviso em vez de
      // virar bloco 0 — um buraco no meio da construção.
      blocks: (e.blocks || []).map((b) => ({
        dx: b.dx, dy: b.dy, dz: b.dz,
        block: typeof b.block === 'number' ? b.block : NaN,
      })).filter((b) => Number.isFinite(b.block)),
    });
    if (erro) erros.push(`estrutura "${e.key}": ${erro}`);
  }

  for (const r of pkg.scatter || []) {
    const erro = registrarRegraDeMod({
      template: `${pkg.id}:${r.estrutura}`,
      peso: r.peso,
      // Bioma do próprio mod vem sem prefixo na declaração — é como o autor o escreveu. Aqui ele
      // ganha o mesmo prefixo que o registro de biomas usou, senão a regra nunca casaria.
      biomas: (r.biomas || []).map((b) => (b.includes(':') || BIOMAS_NATIVOS.has(b) ? b : `${pkg.id}:${b}`)),
      pegada: r.pegada,
      desnivelMax: r.desnivelMax,
      alturaMinAcimaDoMar: r.alturaMinAcimaDoMar,
    });
    if (erro) erros.push(`espalhamento de "${r.estrutura}": ${erro}`);
  }
  return erros;
}

/** Registra os blocos de um mod no array global `BLOCKS`, nos ids que o pacote já carrega. */
export function applyModBlocks(pkg: ModPackage): number[] {
  const applied: number[] = [];
  for (const b of pkg.blocks || []) {
    if (!Number.isInteger(b.blockId)) {
      throw new Error(`O bloco "${b.key}" do mod "${pkg.id}" não tem blockId — chame allocateBlockIds antes de aplicar.`);
    }
    registerCustomBlockAt(b.blockId, {
      name: b.name,
      topColor: b.topColor,
      sideColor: b.sideColor,
      bottomColor: b.bottomColor,
      solid: b.solid,
      opaque: b.opaque,
      decor: b.decor,
      gravity: b.gravity,
      structural: b.structural,
      drops: b.drops,
      minToolTier: b.minToolTier,
      interactive: b.interactive,
      lightLevel: b.lightLevel,
      modId: pkg.id,
      key: b.key,
    });
    applied.push(b.blockId);
  }
  return applied;
}

/** Tira do registro global os blocos de um mod (ao desabilitar ou remover). */
export function revokeModBlocks(pkg: ModPackage): number[] {
  const revoked: number[] = [];
  for (const b of pkg.blocks || []) {
    if (Number.isInteger(b.blockId)) {
      unregisterCustomBlock(b.blockId);
      revoked.push(b.blockId);
    }
  }
  return revoked;
}

/**
 * Ponto de entrada ao carregar um mundo: limpa o registro de blocos customizados da sessão
 * anterior e reaplica só os mods habilitados deste mundo.
 */
export function applyAllMods(mods: ModPackage[]): { blocksApplied: number; modsApplied: number } {
  resetCustomBlocks();
  let blocksApplied = 0;
  let modsApplied = 0;
  for (const mod of mods) {
    if (!mod.enabled) continue;
    blocksApplied += applyModBlocks(mod).length;
    applyModBiomes(mod);
    applyModScatter(mod);
    modsApplied++;
  }
  return { blocksApplied, modsApplied };
}

/**
 * Resolve a referência de bloco de uma estrutura para um id numérico.
 *
 * Aceita, em ordem: id numérico já pronto; `'meumod:rubi'`; `'rubi'` (procurado primeiro no mod
 * dono da estrutura, depois nos demais); e nome de bloco base (`'STONE'`, `'pedra'`).
 * Devolve `null` quando não resolve — o chamador decide se pula o bloco ou aborta, em vez de
 * cair silenciosamente num bloco errado.
 */
export function resolveBlockRef(
  ref: number | string,
  ownerMod: ModPackage | null,
  allMods: ModPackage[] = [],
): number | null {
  if (typeof ref === 'number') {
    return Number.isInteger(ref) && ref >= 0 ? ref : null;
  }
  const raw = String(ref || '').trim();
  if (!raw) return null;

  const asNumber = Number(raw);
  if (Number.isInteger(asNumber) && raw !== '' && !Number.isNaN(asNumber)) return asNumber;

  const findInMod = (mod: ModPackage | null, key: string): number | null => {
    if (!mod) return null;
    const hit = (mod.blocks || []).find((b) => b.key === key);
    return hit && Number.isInteger(hit.blockId) ? hit.blockId : null;
  };

  if (raw.includes(':')) {
    const [modId, blockKey] = raw.split(':', 2);
    const key = normalizeKey(blockKey);
    const target = allMods.find((m) => m.id === modId) || (ownerMod?.id === modId ? ownerMod : null);
    return findInMod(target, key);
  }

  const key = normalizeKey(raw);
  const own = findInMod(ownerMod, key);
  if (own !== null) return own;

  for (const mod of allMods) {
    const hit = findInMod(mod, key);
    if (hit !== null) return hit;
  }

  // Por último, nome de bloco da paleta base ('STONE', 'pedra', 'stone_brick').
  const wanted = normalizeKey(raw);
  for (let i = 0; i < BLOCKS.length; i++) {
    const d = BLOCKS[i];
    if (!d || d.reserved) continue;
    if (normalizeKey(d.name) === wanted) return i;
  }

  return null;
}

/**
 * Converte os blocos de uma estrutura em posições absolutas já com ids resolvidos.
 * Referências que não resolvem são reportadas em `unresolved` em vez de virarem pedra silenciosa.
 */
export function resolveStructureBlocks(
  blocks: ModStructureBlock[],
  originX: number,
  originY: number,
  originZ: number,
  ownerMod: ModPackage | null,
  allMods: ModPackage[] = [],
): { placements: { x: number; y: number; z: number; blockType: number }[]; unresolved: string[] } {
  const placements: { x: number; y: number; z: number; blockType: number }[] = [];
  const unresolved: string[] = [];

  for (const b of blocks || []) {
    const id = resolveBlockRef(b.block, ownerMod, allMods);
    if (id === null) {
      const label = String(b.block);
      if (!unresolved.includes(label)) unresolved.push(label);
      continue;
    }
    placements.push({ x: originX + b.dx, y: originY + b.dy, z: originZ + b.dz, blockType: id });
  }

  return { placements, unresolved };
}

/** Resumo legível para a IA inspecionar o que já existe antes de criar algo duplicado. */
export function summarizeMods(mods: ModPackage[]): any[] {
  return mods.map((m) => ({
    id: m.id,
    name: m.name,
    version: m.version,
    enabled: m.enabled,
    description: m.description || '',
    blocks: (m.blocks || []).map((b: ModBlockDef) => ({ key: b.key, name: b.name, blockId: b.blockId })),
    entities: (m.entities || []).map((e) => ({ key: e.key, name: e.name, parts: e.parts?.length ?? 0 })),
    structures: (m.structures || []).map((s) => ({ key: s.key, name: s.name, blocks: s.blocks?.length ?? 0 })),
  }));
}
