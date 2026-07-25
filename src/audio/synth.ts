// Especificação dos sons do jogo — **descrição**, não reprodução.
//
// Por que síntese em vez de arquivos: o projeto não tem nenhum asset de áudio, e trazê-los
// significaria megabytes de download num jogo que hoje entrega 900 KB. Sintetizar mantém o custo
// em zero e é coerente com o resto (o mesher, o ruído e a interface também são artesanais).
//
// Este arquivo é **puro**: devolve parâmetros, sem tocar em `AudioContext`. Duas razões — dá
// para testar que cada material soa diferente sem navegador, e a mesa de som fica separada do
// motor que a executa.
//
// O que distingue um material de outro, em ordem de importância perceptual:
//   1. Conteúdo de ruído — pedra é quase todo ruído; metal é quase todo tom.
//   2. Tempo de decaimento — vidro estala, terra abafa.
//   3. Frequência do filtro — determina se soa "brilhante" ou "surdo".

import { B, BLOCKS, isFluid } from '../world/blocks';

export interface SoundSpec {
  /** Frequência inicial em Hz. */
  freq: number;
  /** Frequência final — se diferente, o som varre entre as duas (dá o "estalo" ou o "tump"). */
  freqEnd?: number;
  /** Duração total em segundos. */
  duration: number;
  /** Proporção de ruído, 0 (tom puro) a 1 (só ruído). */
  noise: number;
  /** Corte do passa-baixa em Hz — o principal responsável por "brilhante" vs "surdo". */
  filterHz: number;
  /** Volume relativo, 0..1. */
  gain: number;
  /** Ataque em segundos. Curto = percussivo. */
  attack: number;
  /** Harmônicos somados ao tom fundamental — dá o "ring" metálico. */
  harmonics?: number;
}

/** Materiais acusticamente distintos. Vários blocos caem no mesmo. */
export type Material = 'pedra' | 'madeira' | 'terra' | 'areia' | 'vidro' | 'metal' | 'folhagem' | 'fluido' | 'neve';

/**
 * Material acústico de um bloco.
 *
 * Deriva da paleta em vez de uma tabela por id: um bloco criado por mod herda um som coerente
 * sem precisar declarar nada. Sem isso, todo bloco novo soaria como pedra.
 */
export function materialOf(blockType: number): Material {
  if (isFluid(blockType)) return 'fluido';

  switch (blockType) {
    case B.LOG: case B.PINE_LOG: case B.PLANK: return 'madeira';
    case B.DIRT: case B.GRASS: case B.PATH: return 'terra';
    case B.SAND: case B.GRAVEL: return 'areia';
    case B.GLASS: return 'vidro';
    case B.IRON_BLOCK: case B.GOLD_BLOCK: case B.DIAMOND_BLOCK: return 'metal';
    case B.LEAVES: case B.PINE_LEAVES: case B.TALL_GRASS:
    case B.FLOWER_RED: case B.FLOWER_YELLOW: case B.REED: return 'folhagem';
    case B.SNOW: return 'neve';
    default: break;
  }

  // Bloco de mod ou minério: decide pelas propriedades declaradas.
  const def = BLOCKS[blockType];
  if (!def || def.reserved) return 'pedra';
  if (def.decor) return 'folhagem';
  if (def.gravity) return 'areia';
  if (!def.opaque && def.solid) return 'vidro';
  return 'pedra';
}

/** Perfil base por material. Quebrar, colocar e pisar derivam daqui com ajustes. */
const PERFIS: Record<Material, SoundSpec> = {
  pedra:    { freq: 190, freqEnd: 90,  duration: 0.20, noise: 0.85, filterHz: 2600, gain: 0.50, attack: 0.002 },
  madeira:  { freq: 260, freqEnd: 150, duration: 0.16, noise: 0.45, filterHz: 1900, gain: 0.48, attack: 0.003 },
  terra:    { freq: 130, freqEnd: 70,  duration: 0.18, noise: 0.92, filterHz: 900,  gain: 0.42, attack: 0.004 },
  areia:    { freq: 320, freqEnd: 180, duration: 0.22, noise: 0.97, filterHz: 4200, gain: 0.38, attack: 0.006 },
  vidro:    { freq: 1450, freqEnd: 900, duration: 0.13, noise: 0.35, filterHz: 7000, gain: 0.44, attack: 0.001 },
  // Harmônicos são o que faz metal soar metal: sem eles vira um "toc" qualquer.
  metal:    { freq: 620, freqEnd: 540, duration: 0.42, noise: 0.12, filterHz: 5200, gain: 0.40, attack: 0.001, harmonics: 3 },
  folhagem: { freq: 480, freqEnd: 380, duration: 0.15, noise: 1.0,  filterHz: 5600, gain: 0.30, attack: 0.008 },
  fluido:   { freq: 240, freqEnd: 140, duration: 0.26, noise: 0.80, filterHz: 1400, gain: 0.34, attack: 0.010 },
  neve:     { freq: 400, freqEnd: 260, duration: 0.17, noise: 0.95, filterHz: 3000, gain: 0.30, attack: 0.008 },
};

/** Aplica variação determinística mas não repetitiva, para o mesmo som não soar idêntico. */
function variar(spec: SoundSpec, semente: number): SoundSpec {
  // Hash simples: o mesmo bloco na mesma posição soa igual, blocos diferentes soam diferentes.
  let h = (semente | 0) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  const j = ((h >>> 0) / 4294967296) * 0.24 - 0.12; // ±12%

  return {
    ...spec,
    freq: spec.freq * (1 + j),
    freqEnd: spec.freqEnd !== undefined ? spec.freqEnd * (1 + j) : undefined,
    duration: spec.duration * (1 + j * 0.4),
  };
}

export function soundForBreak(blockType: number, semente = 0): SoundSpec {
  const base = PERFIS[materialOf(blockType)];
  return variar({ ...base, gain: base.gain, duration: base.duration * 1.15 }, semente);
}

export function soundForPlace(blockType: number, semente = 0): SoundSpec {
  // Colocar é mais curto e mais grave que quebrar: é um "assentar", não um "estilhaçar".
  const base = PERFIS[materialOf(blockType)];
  return variar({
    ...base,
    freq: base.freq * 0.8,
    freqEnd: (base.freqEnd ?? base.freq) * 0.7,
    duration: base.duration * 0.65,
    gain: base.gain * 0.75,
  }, semente + 7919);
}

/** Teto de duração do passo. É o som mais repetido do jogo; longo vira tortura em dois minutos. */
export const FOOTSTEP_MAX_DURATION = 0.1;

export function soundForFootstep(blockType: number, semente = 0): SoundSpec {
  const base = PERFIS[materialOf(blockType)];
  const variado = variar({
    ...base,
    freq: base.freq * 0.7,
    freqEnd: (base.freqEnd ?? base.freq) * 0.5,
    duration: base.duration * 0.5,
    gain: base.gain * 0.3,
    filterHz: base.filterHz * 0.7,
  }, semente + 104729);

  // O limite é aplicado DEPOIS de variar: aplicá-lo antes deixava a variação furá-lo, e o
  // passo do metal (perfil longo por causa do ring) chegava a 104 ms.
  return {
    ...variado,
    duration: Math.min(FOOTSTEP_MAX_DURATION, variado.duration),
    attack: Math.min(variado.attack, FOOTSTEP_MAX_DURATION * 0.4),
  };
}

/** Sons de evento, que não dependem de material. */
export const SOUNDS: Record<string, SoundSpec> = {
  dano:        { freq: 220, freqEnd: 110, duration: 0.26, noise: 0.55, filterHz: 1500, gain: 0.55, attack: 0.001 },
  morte:       { freq: 300, freqEnd: 70,  duration: 0.95, noise: 0.35, filterHz: 1100, gain: 0.60, attack: 0.004 },
  acerto:      { freq: 520, freqEnd: 300, duration: 0.12, noise: 0.40, filterHz: 3400, gain: 0.45, attack: 0.001 },
  mobMorte:    { freq: 380, freqEnd: 120, duration: 0.45, noise: 0.60, filterHz: 2200, gain: 0.45, attack: 0.003 },
  pegarItem:   { freq: 780, freqEnd: 1180, duration: 0.11, noise: 0.05, filterHz: 6000, gain: 0.30, attack: 0.001, harmonics: 2 },
  craftar:     { freq: 440, freqEnd: 660, duration: 0.20, noise: 0.15, filterHz: 5000, gain: 0.35, attack: 0.002, harmonics: 2 },
  uiClique:    { freq: 900, freqEnd: 900, duration: 0.045, noise: 0.10, filterHz: 6500, gain: 0.20, attack: 0.001 },
  uiAbrir:     { freq: 520, freqEnd: 720, duration: 0.10, noise: 0.08, filterHz: 5500, gain: 0.22, attack: 0.002 },
  queimadura:  { freq: 160, freqEnd: 200, duration: 0.35, noise: 0.90, filterHz: 1000, gain: 0.30, attack: 0.02 },
  splash:      { freq: 300, freqEnd: 160, duration: 0.34, noise: 0.95, filterHz: 2400, gain: 0.42, attack: 0.004 },
  ferramentaQuebrou: { freq: 700, freqEnd: 180, duration: 0.30, noise: 0.55, filterHz: 3000, gain: 0.50, attack: 0.001 },
};

/**
 * Ganho por distância, com corte.
 *
 * O corte importa mais que a curva: sem ele, cada criatura do mundo contribuiria com um ganho
 * ínfimo, e somar centenas de ínfimos dá um zumbido constante.
 */
export function distanceGain(distance: number, maxDistance = 32): number {
  if (distance >= maxDistance) return 0;
  if (distance <= 1) return 1;
  const t = 1 - distance / maxDistance;
  return t * t; // queda quadrática, próxima do comportamento físico
}

/** Panorâmica estéreo, -1 (esquerda) a 1 (direita), a partir da direção da escuta. */
export function stereoPan(
  source: { x: number; z: number },
  listener: { x: number; z: number },
  listenerYaw: number,
): number {
  const dx = source.x - listener.x;
  const dz = source.z - listener.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.001) return 0;

  // Vetor "direita" da escuta, girado 90° do olhar.
  const rightX = Math.cos(listenerYaw);
  const rightZ = -Math.sin(listenerYaw);
  const proj = (dx * rightX + dz * rightZ) / dist;
  return Math.max(-1, Math.min(1, proj));
}
