// Fluidos finitos em mini-voxels — água e lava como cubinhos discretos que escoam, no espírito
// do Lay of the Land (onde tudo é voxel de verdade e obedece física).
//
// Diferença central para o Minecraft: aqui **não existe fonte infinita**. Cada voxel de fluido é
// uma unidade de massa que se move; o sistema nunca cria um voxel novo, só transporta os que já
// existem. Uma poça derramada espalha, afina e para — não se auto-alimenta para sempre.
//
// Regras de escoamento, por voxel e nesta ordem:
//   1. Cai, se a célula de baixo aceitar fluido. Cair **restaura** o orçamento de espalhamento,
//      como acontece de verdade: a água que despenca de um penhasco volta a se espalhar embaixo.
//   2. Se não pode cair, escorre lateralmente — preferindo a direção onde há um degrau para
//      baixo (a "beirada"), que é o que faz o líquido procurar o desnível.
//   3. Cada passo lateral gasta um ponto do orçamento. Sem orçamento, o voxel assenta e sai da
//      simulação. É esse contador que garante terminação e nivelamento em vez de espalhamento
//      infinito por um plano.
//
// O módulo é puro de propósito (só depende de `blocks.ts` e de uma interface mínima de mundo),
// para a mecânica poder ser testada sem Three.js nem navegador.

import { B, isFluid, isFluidPassable } from './blocks';

/** Interface mínima de mundo que o sistema precisa — o `World` real satisfaz. */
export interface FluidWorld {
  getBlock(x: number, y: number, z: number): number;
  setBlock(x: number, y: number, z: number, t: number, markEdited?: boolean): boolean;
}

/**
 * Quantos passos laterais um voxel de fluido consegue dar antes de assentar.
 * É o análogo do alcance de escoamento: maior = poças mais largas e finas.
 */
export const WATER_SPREAD = 6;
export const LAVA_SPREAD = 2; // lava é viscosa: escorre bem menos que a água

export interface FluidCell {
  x: number;
  y: number;
  z: number;
  /** Passos laterais restantes. Reabastecido ao cair. */
  spread: number;
}

export interface FluidChange {
  x: number;
  y: number;
  z: number;
  blockType: number;
}

const HORIZONTAL: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function maxSpreadFor(type: number): number {
  return type === B.LAVA ? LAVA_SPREAD : WATER_SPREAD;
}

export class FluidSystem {
  private world: FluidWorld;
  /** Voxels de fluido ainda em movimento, indexados por posição para evitar duplicatas na fila. */
  private active = new Map<string, FluidCell>();
  /** Contador de passos, usado só para alternar a ordem das direções e evitar viés para um lado. */
  private tick = 0;

  constructor(world: FluidWorld) {
    this.world = world;
  }

  public get pendingCount(): number {
    return this.active.size;
  }

  private static key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  /**
   * Marca um voxel de fluido como em movimento.
   *
   * Com `spread` explícito o valor é **imposto** — é assim que um voxel que acabou de dar um
   * passo lateral registra o orçamento já descontado. Sem argumento, vale o maior entre o atual
   * e o máximo do fluido, que é o comportamento desejado ao perturbar uma poça parada (água nova
   * chegando reanima o que estava assentado).
   *
   * A distinção importa: enquanto `activate` sempre elevava para o máximo, o `disturb` disparado
   * logo após um passo lateral reabastecia o orçamento do próprio voxel que tinha acabado de
   * gastá-lo, e a poça se espalhava para sempre.
   */
  public activate(x: number, y: number, z: number, spread?: number): void {
    const t = this.world.getBlock(x, y, z);
    if (!isFluid(t)) return;
    const k = FluidSystem.key(x, y, z);
    const existing = this.active.get(k);

    if (existing) {
      if (spread === undefined) existing.spread = Math.max(existing.spread, maxSpreadFor(t));
      else existing.spread = spread;
      return;
    }
    this.active.set(k, { x, y, z, spread: spread ?? maxSpreadFor(t) });
  }

  /** Reanima os fluidos vizinhos de uma célula alterada (bloco quebrado abaixo de uma poça, etc.). */
  public disturb(x: number, y: number, z: number): void {
    for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) {
      this.activate(x + dx, y + dy, z + dz);
    }
  }

  /**
   * Avança a simulação. `budget` limita quantos voxels são processados neste passo, para o
   * custo por frame ficar constante mesmo com um dilúvio em andamento.
   * Devolve as células alteradas, para o chamador re-meshar, salvar e sincronizar no P2P.
   */
  public step(budget = 120): FluidChange[] {
    const changes: FluidChange[] = [];
    if (this.active.size === 0) return changes;

    this.tick++;
    const cells = Array.from(this.active.values()).slice(0, budget);

    for (const cell of cells) {
      const k = FluidSystem.key(cell.x, cell.y, cell.z);
      this.active.delete(k);

      const type = this.world.getBlock(cell.x, cell.y, cell.z);
      if (!isFluid(type)) continue;

      if (this.tryFall(cell, type, changes)) continue;
      if (this.trySpread(cell, type, changes)) continue;
      // Sem para onde ir: assenta e sai da simulação até algo perturbá-lo de novo.
    }

    return changes;
  }

  /** Passo 1: cair. Cair restaura o orçamento de espalhamento. */
  private tryFall(cell: FluidCell, type: number, changes: FluidChange[]): boolean {
    const { x, y, z } = cell;
    const below = this.world.getBlock(x, y - 1, z);

    if (this.reactsWith(type, below)) {
      this.solidify(x, y - 1, z, changes);
      return true;
    }
    if (!isFluidPassable(below)) return false;

    this.move(x, y, z, x, y - 1, z, type, changes);
    // A ordem importa: `disturb` usa o orçamento padrão, então precisa vir ANTES do
    // `activate` explícito, que é quem fixa o orçamento correto do voxel que se moveu.
    this.disturb(x, y, z);
    this.activate(x, y - 1, z, maxSpreadFor(type));
    return true;
  }

  /**
   * Passo 2: escorrer para o lado.
   *
   * Duas situações permitem o passo lateral, e a distinção é o que dá comportamento de líquido
   * em vez de "gota que rasteja":
   *
   *   a) **Beirada** — há um vizinho livre com vazio embaixo. O fluido sempre procura o desnível,
   *      mesmo isolado; é assim que a água encontra a borda do platô e despenca.
   *   b) **Pressão** — a célula de cima também é fluido, isto é, existe coluna empurrando. É o
   *      que faz uma pilha de água se nivelar numa poça larga.
   *
   * Sem a regra de pressão, um único voxel numa planície ficava perambulando até gastar o
   * orçamento e parava num lugar arbitrário, longe de onde foi derramado.
   */
  private trySpread(cell: FluidCell, type: number, changes: FluidChange[]): boolean {
    if (cell.spread <= 0) return false;
    const { x, y, z } = cell;
    const hasPressure = isFluid(this.world.getBlock(x, y + 1, z));

    // Alterna o ponto de partida a cada tick para a poça não crescer sempre para o mesmo lado.
    const offset = this.tick % HORIZONTAL.length;
    const dirs = HORIZONTAL.map((_, i) => HORIZONTAL[(i + offset) % HORIZONTAL.length]);

    let fallback: [number, number] | null = null;

    for (const [dx, dz] of dirs) {
      const nx = x + dx, nz = z + dz;
      const target = this.world.getBlock(nx, y, nz);

      if (this.reactsWith(type, target)) {
        this.solidify(nx, y, nz, changes);
        return true;
      }
      if (!isFluidPassable(target)) continue;

      // Beirada: dá para cair logo depois de dar este passo. É a direção preferida.
      if (isFluidPassable(this.world.getBlock(nx, y - 1, nz))) {
        this.move(x, y, z, nx, y, nz, type, changes);
        this.disturb(x, y, z);
        this.activate(nx, y, nz, cell.spread - 1);
        return true;
      }
      if (!fallback) fallback = [dx, dz];
    }

    // Passo lateral em terreno plano só com coluna empurrando por cima.
    if (fallback && hasPressure) {
      const nx = x + fallback[0], nz = z + fallback[1];
      this.move(x, y, z, nx, y, nz, type, changes);
      this.disturb(x, y, z);
      this.activate(nx, y, nz, cell.spread - 1);
      return true;
    }

    return false;
  }

  /** Água encostando em lava (ou o contrário) solidifica — evita os dois se atravessarem. */
  private reactsWith(type: number, other: number): boolean {
    return (type === B.WATER && other === B.LAVA) || (type === B.LAVA && other === B.WATER);
  }

  /**
   * Contato água/lava: a célula de lava vira obsidiana e o escoamento daquele voxel para ali.
   * O voxel de água que provocou o contato permanece onde está — é o comportamento esperado de
   * "jogar água na lava" e mantém a massa de água conservada.
   */
  private solidify(tx: number, ty: number, tz: number, changes: FluidChange[]): void {
    this.world.setBlock(tx, ty, tz, B.OBSIDIAN, false);
    changes.push({ x: tx, y: ty, z: tz, blockType: B.OBSIDIAN });
  }

  private move(fx: number, fy: number, fz: number, tx: number, ty: number, tz: number, type: number, changes: FluidChange[]): void {
    this.world.setBlock(fx, fy, fz, B.AIR, false);
    this.world.setBlock(tx, ty, tz, type, false);
    changes.push({ x: fx, y: fy, z: fz, blockType: B.AIR });
    changes.push({ x: tx, y: ty, z: tz, blockType: type });
  }
}

/**
 * Desmoronamento lateral de blocos com gravidade (areia, cascalho).
 *
 * Sozinha, a queda vertical produz colunas verticais impossíveis de areia. Com o ângulo de
 * repouso, um monte não sustenta um degrau: se a célula ao lado está livre **e** a de baixo dela
 * também, o grão escorrega na diagonal. É a mesma ideia do "items tumble down slopes" do
 * Lay of the Land, aplicada ao terreno.
 *
 * Devolve para onde o bloco deve escorregar, ou `null` se o monte está estável.
 */
export function findSlideTarget(
  world: FluidWorld,
  x: number,
  y: number,
  z: number,
  tiebreak = 0,
): { x: number; y: number; z: number } | null {
  const offset = ((tiebreak % HORIZONTAL.length) + HORIZONTAL.length) % HORIZONTAL.length;

  for (let i = 0; i < HORIZONTAL.length; i++) {
    const [dx, dz] = HORIZONTAL[(i + offset) % HORIZONTAL.length];
    const nx = x + dx, nz = z + dz;

    // Precisa de espaço ao lado E um degrau vazio abaixo dele: é isso que caracteriza
    // "íngreme demais". Se só o lado estiver livre, o grão fica — encosta estável.
    if (!isFluidPassable(world.getBlock(nx, y, nz))) continue;
    if (!isFluidPassable(world.getBlock(nx, y - 1, nz))) continue;

    return { x: nx, y: y - 1, z: nz };
  }

  return null;
}
