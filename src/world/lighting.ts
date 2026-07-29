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

    // O céu acima do terreno é sempre luz plena: descer bloco a bloco por dezenas de voxels de
    // ar só para descobrir isso era o segundo maior custo do recálculo. Aqui a coluna começa
    // logo acima do primeiro bloco não-transparente, e o vazio acima é preenchido em bloco.
    let topo = this.maxY - 1;
    while (topo > 0 && opacity(this.grid.getBlock(x, topo, z)) === 0) topo--;

    const cheio = packLight(MAX_LIGHT, 0);
    for (let y = this.maxY - 1; y > topo; y--) {
      const packed = this.grid.getLight(x, y, z);
      // Preserva luz de bloco que exista no ar (tocha flutuante, por exemplo).
      this.grid.setLight(x, y, z, blockOf(packed) === 0 ? cheio : packLight(MAX_LIGHT, blockOf(packed)));
    }
    // O primeiro voxel abaixo do céu aberto é quem semeia a propagação lateral.
    if (topo < this.maxY - 1) out.push({ x, y: topo + 1, z, level: MAX_LIGHT });

    for (let y = topo; y >= 0; y--) {
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

    const volume = (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);

    // Fase 1 — apagar. Coleta a luz atual da caixa, zera, e enfileira para propagar a
    // **escuridão** para fora dela.
    const removerSol: Node[] = [];
    const removerBloco: Node[] = [];

    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const packed = this.grid.getLight(x, y, z);
          const sol = skyOf(packed), blk = blockOf(packed);
          if (sol > 0) removerSol.push({ x, y, z, level: sol });
          if (blk > 0) removerBloco.push({ x, y, z, level: blk });
          this.grid.setLight(x, y, z, 0);
        }
      }
    }

    // Propagar a escuridão é o que estava faltando. Sem esta fase, ao fechar um buraco no teto
    // os vizinhos FORA da caixa continuavam guardando a luz antiga e a reinjetavam de volta —
    // a caverna nunca escurecia. Quem for fonte independente é recolhido para reacender depois.
    let readicionarSol: Node[] = [];
    let readicionarBloco: Node[] = [];
    this.removeLight(removerSol, true, readicionarSol, volume * 8);
    this.removeLight(removerBloco, false, readicionarBloco, volume * 6);

    // As fontes são revalidadas contra o estado FINAL, e não o do momento em que foram vistas.
    //
    // Uma célula pode ser marcada como fonte independente cedo e ser apagada logo depois por
    // outro caminho da remoção. Reacendê-la com o nível antigo injetava luz que não existe mais
    // — era isso que deixava a caverna com um gradiente subindo a partir do chão.
    const revalidar = (fontes: Node[], isSun: boolean): Node[] =>
      fontes
        .map((f) => ({ ...f, level: isSun ? skyOf(this.grid.getLight(f.x, f.y, f.z)) : blockOf(this.grid.getLight(f.x, f.y, f.z)) }))
        .filter((f) => f.level > 1);

    readicionarSol = revalidar(readicionarSol, true);
    readicionarBloco = revalidar(readicionarBloco, false);

    // Fase 2 — reacender. Emissores dentro da caixa, mais as fontes independentes achadas.
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const emissao = emission(this.grid.getBlock(x, y, z));
          if (emissao <= 0) continue;
          const packed = this.grid.getLight(x, y, z);
          this.grid.setLight(x, y, z, packLight(skyOf(packed), emissao));
          readicionarBloco.push({ x, y, z, level: emissao });
        }
      }
    }

    // O sol que entra pelo teto da caixa: a caixa não precisa saber de onde ele veio, só quanto
    // chega. Antes, cada coluna era re-semeada do topo do mundo — com raio 8 são 289 colunas de
    // até 128 voxels, e isso sozinho custava dezenas de milissegundos por bloco colocado.
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const sol = skyOf(this.grid.getLight(x, y1 + 1, z));
        if (sol > 0) readicionarSol.push({ x, y: y1 + 1, z, level: sol });
      }
    }

    this.propagateSun(readicionarSol, volume * 8);
    this.propagateBlockLight(readicionarBloco, volume * 6);
  }

  /**
   * Propaga escuridão a partir de células que perderam a luz.
   *
   * Um vizinho mais escuro que a origem só podia estar sendo iluminado por ela: apaga e
   * continua. Um vizinho igual ou mais claro tem fonte própria, então é recolhido em
   * `fontesIndependentes` para reacender a região depois que a limpeza terminar.
   */
  private removeLight(queue: Node[], isSun: boolean, fontesIndependentes: Node[], budget: number): void {
    let head = 0;

    while (head < queue.length && budget-- > 0) {
      const node = queue[head++];

      for (const [dx, dy, dz] of NEIGHBORS) {
        const nx = node.x + dx, ny = node.y + dy, nz = node.z + dz;
        if (ny < 0 || ny >= this.maxY) continue;

        const packed = this.grid.getLight(nx, ny, nz);
        const nivel = isSun ? skyOf(packed) : blockOf(packed);
        if (nivel === 0) continue;

        // Luz solar descendo não perde nível (é o que mantém o fundo de um poço claro), então um
        // vizinho de baixo com valor IGUAL também foi iluminado por nós.
        //
        // Restringir este caso ao nível 15 deixava vazar toda luz que primeiro andou de lado e
        // depois desceu: a coluna abaixo ficava com o valor antigo e o reinjetava, e a caverna
        // não escurecia ao fechar o buraco do teto.
        const iluminadoPorNos = nivel < node.level || (isSun && dy === -1 && nivel === node.level);

        if (iluminadoPorNos) {
          this.grid.setLight(nx, ny, nz, isSun ? packLight(0, blockOf(packed)) : packLight(skyOf(packed), 0));
          queue.push({ x: nx, y: ny, z: nz, level: nivel });
        } else {
          fontesIndependentes.push({ x: nx, y: ny, z: nz, level: nivel });
        }
      }
    }
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

/**
 * Tabela de 256 entradas com o fator de luz de cada valor empacotado possível.
 *
 * O mesher chama `lightFactor` **uma vez por face** — dezenas de milhares de vezes por chunk. Com
 * `Math.pow` lá dentro, isso dominava o custo de gerar a malha. Como só existem 256 combinações
 * de (sol, bloco), vale pré-calcular todas de uma vez e depois só indexar.
 *
 * A tabela depende de `sunScale`, mas o mundo só é re-meshado quando ele muda um degrau
 * perceptível — então uma tabela por chamada de `meshChunk` já elimina o custo.
 */
export function buildLightTable(sunScale = 1): Float32Array {
  const tabela = new Float32Array(256);
  for (let packed = 0; packed < 256; packed++) tabela[packed] = lightFactor(packed, sunScale);
  return tabela;
}

/** Configuração de bloom/glow sutil para blocos emissivos — item 058 P2. */
export function getEmissiveGlowConfig(blockType: number): { intensity: number; color: [number, number, number] } | null {
  if (blockType === B.GLOWSTONE) return { intensity: 0.8, color: [1.0, 0.9, 0.4] };
  if (blockType === B.LAVA) return { intensity: 1.0, color: [1.0, 0.3, 0.1] };
  if (blockType === B.TORCH) return { intensity: 0.5, color: [1.0, 0.8, 0.2] };
  return null;
}
