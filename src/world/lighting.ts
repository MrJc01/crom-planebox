// Propagação de luz por flood fill: luz solar descendo do céu e luz de bloco (tocha, lava,
// pedra luminosa) espalhando em todas as direções.
//
// Por que isto importa agora: com as cavernas do `underground.ts`, o subsolo passou a existir —
// mas era iluminado exatamente como a superfície. Sem escuridão real, minerar não tem tensão e
// a tocha não tem função nenhuma.
//
// Formato: um byte por voxel, `(sol << 4) | bloco`, ambos 0-15. Guardar os dois separados é o
// que permite escurecer só a luz solar ao anoitecer sem recalcular nada — a tocha continua
// acesa com o mesmo valor, e o render combina os dois no momento de desenhar.
//
// O módulo é puro: opera sobre a interface `LightGrid`, sem Three.js nem DOM, para o algoritmo
// poder ser verificado numa grade pequena em teste.

import { BLOCKS, B, isOpaque } from './blocks';

export const MAX_LIGHT = 15;

/** Grade mínima que o motor precisa. O `World` real satisfaz. */
export interface LightGrid {
  getBlock(x: number, y: number, z: number): number;
  getLight(x: number, y: number, z: number): number;
  setLight(x: number, y: number, z: number, packed: number): void;
}

export function packLight(sky: number, block: number): number {
  return ((sky & 15) << 4) | (block & 15);
}
export function skyOf(packed: number): number {
  return (packed >> 4) & 15;
}
export function blockOf(packed: number): number {
  return packed & 15;
}

/**
 * Quanto a luz perde ao atravessar este bloco, além do decaimento normal de 1 por passo.
 * `Infinity` significa bloqueio total.
 */
export function opacity(t: number): number {
  if (t === B.AIR) return 0;
  // Folhagem vem ANTES da checagem de opacidade: na paleta as folhas são `opaque` (para o
  // mesher não desenhar as faces internas da copa), mas para a luz elas precisam ser um filtro,
  // não uma parede. Tratá-las como bloqueio total faria toda árvore projetar uma sombra preta
  // sólida no chão e deixaria a floresta com buracos de escuridão.
  if (t === B.LEAVES || t === B.PINE_LEAVES) return 1;
  if (isOpaque(t)) return Infinity;
  // Água tira mais luz que ar: é o que cria o escurecimento ao descer num lago, de graça.
  if (t === B.WATER) return 2;
  return 0; // vidro, capim, flores: praticamente transparentes
}

/** Luz emitida pelo próprio bloco. Blocos de mod declaram via `lightLevel`. */
export function emission(t: number): number {
  const def = BLOCKS[t];
  if (!def || def.reserved) return 0;
  if (def.lightLevel) return Math.min(MAX_LIGHT, def.lightLevel);
  if (t === B.GLOWSTONE) return 15;
  if (t === B.LAVA) return 12;
  return 0;
}

const NEIGHBORS: [number, number, number][] = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

interface Node {
  x: number;
  y: number;
  z: number;
  level: number;
}

export class LightEngine {
  constructor(private grid: LightGrid, private maxY: number) {}

  // --- Luz solar -----------------------------------------------------------------------

  /**
   * Semeia a luz solar numa coluna: desce do topo com nível 15 enquanto o caminho é livre.
   *
   * O primeiro bloco opaco corta a coluna — o que está embaixo dele fica no escuro até a
   * propagação horizontal trazer luz de alguma abertura vizinha. É exatamente isso que faz uma
   * caverna ser escura mesmo tendo um poço de entrada a 20 voxels de distância.
   */
  public seedSunColumn(x: number, z: number, out: Node[]): void {
    let level = MAX_LIGHT;

    for (let y = this.maxY - 1; y >= 0; y--) {
      const t = this.grid.getBlock(x, y, z);
      const op = opacity(t);

      if (op === Infinity) {
        level = 0;
      } else if (op > 0) {
        level = Math.max(0, level - op);
      }

      const packed = this.grid.getLight(x, y, z);
      this.grid.setLight(x, y, z, packLight(level, blockOf(packed)));

      // Só entra na fila o que ainda tem luz para doar aos lados.
      if (level > 1) out.push({ x, y, z, level });
    }
  }

  /** Propaga luz solar a partir das colunas semeadas. */
  public propagateSun(queue: Node[], budget = 400_000): void {
    this.propagate(queue, true, budget);
  }

  // --- Luz de bloco --------------------------------------------------------------------

  /** Registra um bloco emissor e devolve o nó para a fila de propagação. */
  public seedBlockLight(x: number, y: number, z: number, out: Node[]): void {
    const level = emission(this.grid.getBlock(x, y, z));
    if (level <= 0) return;
    const packed = this.grid.getLight(x, y, z);
    this.grid.setLight(x, y, z, packLight(skyOf(packed), level));
    out.push({ x, y, z, level });
  }

  public propagateBlockLight(queue: Node[], budget = 200_000): void {
    this.propagate(queue, false, budget);
  }

  // --- Núcleo do flood fill ------------------------------------------------------------

  /**
   * BFS clássico: cada passo perde 1 nível, mais a opacidade do destino. Um vizinho só entra
   * na fila se a luz que chega é **estritamente maior** que a que ele já tem — é essa condição
   * que garante terminação e evita reprocessar a mesma célula infinitamente.
   */
  private propagate(queue: Node[], isSun: boolean, budget: number): void {
    let head = 0;

    while (head < queue.length && budget-- > 0) {
      const node = queue[head++];

      for (const [dx, dy, dz] of NEIGHBORS) {
        const nx = node.x + dx, ny = node.y + dy, nz = node.z + dz;
        if (ny < 0 || ny >= this.maxY) continue;

        const t = this.grid.getBlock(nx, ny, nz);
        const op = opacity(t);
        if (op === Infinity) continue;

        // Luz solar descendo em linha reta não perde nível: é o que mantém o fundo de um poço
        // vertical tão claro quanto a superfície, em vez de virar um gradiente estranho.
        const cost = isSun && dy === -1 && op === 0 ? 0 : 1 + op;
        const next = node.level - cost;
        if (next <= 0) continue;

        const packed = this.grid.getLight(nx, ny, nz);
        const current = isSun ? skyOf(packed) : blockOf(packed);
        if (current >= next) continue;

        this.grid.setLight(nx, ny, nz, isSun ? packLight(next, blockOf(packed)) : packLight(skyOf(packed), next));
        queue.push({ x: nx, y: ny, z: nz, level: next });
      }
    }
  }

  // --- Atualização incremental ---------------------------------------------------------

  /**
   * Recalcula a luz numa caixa ao redor de uma alteração de bloco.
   *
   * Estratégia: zera a região, re-semeia sol e emissores dentro dela, e deixa a propagação
   * puxar luz de volta das bordas. Recalcular localmente é o que torna colocar uma tocha
   * instantâneo — refazer o chunk inteiro a cada bloco custaria dezenas de milissegundos.
   */
  public recalcRegion(cx: number, cy: number, cz: number, radius: number): void {
    const x0 = cx - radius, x1 = cx + radius;
    const y0 = Math.max(0, cy - radius), y1 = Math.min(this.maxY - 1, cy + radius);
    const z0 = cz - radius, z1 = cz + radius;

    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) this.grid.setLight(x, y, z, 0);
      }
    }

    const sunQueue: Node[] = [];
    const blockQueue: Node[] = [];

    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        // Re-semeia a coluna inteira: a alteração pode ter aberto ou fechado o caminho do sol
        // muito acima da caixa (quebrar o teto de uma caverna, por exemplo).
        this.seedSunColumn(x, z, sunQueue);
      }
    }

    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) this.seedBlockLight(x, y, z, blockQueue);
      }
    }

    // As bordas da caixa reinjetam a luz que vem de fora dela.
    const border: Node[] = [];
    for (let y = y0; y <= y1; y++) {
      for (let z = z0 - 1; z <= z1 + 1; z++) {
        for (let x = x0 - 1; x <= x1 + 1; x++) {
          const inside = x >= x0 && x <= x1 && z >= z0 && z <= z1;
          if (inside) continue;
          const packed = this.grid.getLight(x, y, z);
          if (skyOf(packed) > 1) sunQueue.push({ x, y, z, level: skyOf(packed) });
          if (blockOf(packed) > 1) border.push({ x, y, z, level: blockOf(packed) });
        }
      }
    }

    this.propagateSun(sunQueue, 200_000);
    this.propagateBlockLight(blockQueue.concat(border), 100_000);
  }
}

/**
 * Converte o nível de luz em multiplicador de cor para o mesher.
 *
 * `sunScale` é a intensidade do dia (1 = meio-dia, ~0.12 = madrugada), aplicada só à luz solar.
 * O piso de 0.05 impede preto absoluto: uma caverna sem tocha fica quase invisível, mas o
 * jogador ainda distingue silhuetas em vez de encarar uma tela chapada.
 */
export function lightFactor(packed: number, sunScale = 1): number {
  const sun = skyOf(packed) / MAX_LIGHT;
  const blk = blockOf(packed) / MAX_LIGHT;
  const level = Math.max(sun * sunScale, blk);
  // Curva levemente côncava: a queda de luz fica perceptível cedo, como no olho humano.
  return 0.05 + 0.95 * Math.pow(level, 1.35);
}
