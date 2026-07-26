// Superfície de funções que um mod pode chamar — o contrato entre o jogo e o código do mod.
//
// Até aqui um mod era só dados: descrevia o que existe, nunca o que acontece. Com scripts ele
// passa a reagir — a um bloco quebrado, ao passar do tempo, à morte de uma criatura.
//
// Três decisões sustentam o desenho, e vêm antes de qualquer conveniência:
//
//  1. **A API é injetada, não global.** O script recebe um objeto `api` e não enxerga `window`,
//     `fetch` nem `document`. O que não estiver nesta função, o mod não alcança — e é isso que
//     torna a superfície auditável lendo um arquivo só.
//  2. **Erro de mod não derruba o jogo.** Cada handler roda protegido, e um script que falha
//     repetidamente é desligado sozinho. O caso comum é um erro dentro de `tick`: sem
//     desligamento, a mesma exceção seria lançada 60 vezes por segundo.
//  3. **Escrita atribuída.** Todo bloco alterado por script fica marcado como pertencente ao
//     mod, para poder ser desfeito com precisão depois.

import { B, BLOCKS } from '../world/blocks';
import { ModPackage } from './ModTypes';
import { noiteEscura } from '../world/moon';

export type ModEvent =
  | 'load'          // o mod acabou de ser carregado — payload: {}
  | 'unload'        // vai ser descarregado — payload: {}
  | 'tick'          // a cada frame — payload: { dt }
  | 'blockPlaced'   // payload: { x, y, z, block }
  | 'blockBroken'   // payload: { x, y, z, block }
  | 'playerDamaged' // payload: { amount, cause, health }
  | 'entityDeath'   // payload: { id, name, x, y, z }
  | 'dayPhase'      // payload: { phase, timeOfDay }
  | 'weatherChange'; // payload: { weather, previous }

export const MOD_EVENTS: ModEvent[] = [
  'load', 'unload', 'tick', 'blockPlaced', 'blockBroken', 'playerDamaged', 'entityDeath', 'dayPhase', 'weatherChange',
];

export type ModHandler = (payload: any) => void;

/** O que o jogo precisa fornecer para a API funcionar. Injetado pelo `main`. */
export interface ModHostBridge {
  getBlock(x: number, y: number, z: number): number;
  setBlock(x: number, y: number, z: number, t: number): boolean;
  getGroundY(x: number, z: number): number;
  spawnEntity(modId: string, entityKey: string, x: number, y: number, z: number): string | null;
  listEntities(): { id: string; name: string; x: number; y: number; z: number }[];
  damageEntity(id: string, amount: number): boolean;
  playerPosition(): { x: number; y: number; z: number };
  teleportPlayer(x: number, y: number, z: number): void;
  playerHealth(): number;
  giveItem(block: number, count: number): void;
  toast(message: string): void;
  timeOfDay(): number;
  moonPhase(): number;
  /** Clima vigente já traduzido pelo bioma local. */
  weather(): { current: string; next: string; progress: number; lightning: boolean; wet: number };
  /** Impõe um clima, ou devolve o mundo à sequência natural com `null`. */
  setWeather(clima: string | null): boolean;
  /** Toca um som do catálogo, opcionalmente posicionado no mundo. */
  playSound(nome: string, posicao?: { x: number; y: number; z: number }, volume?: number): void;
}

/** Teto de blocos que um único handler altera, para um laço mal escrito não travar o frame. */
export const BLOCK_BUDGET_PER_CALL = 20_000;

export interface ModLogEntry {
  level: 'log' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

/** Quantos erros um script suporta antes de ser desligado. */
export const MAX_SCRIPT_ERRORS = 5;

/**
 * Estado de um mod em execução: handlers, armazenamento e log.
 * Um por mod — é a unidade de isolamento.
 */
export class ModContext {
  public readonly handlers = new Map<ModEvent, { scriptKey: string; fn: ModHandler }[]>();
  public readonly storage = new Map<string, any>();
  public readonly logs: ModLogEntry[] = [];
  /** Scripts desligados por falharem demais, com o motivo. */
  public readonly disabledScripts = new Map<string, string>();
  /** Blocos que este mod alterou nesta sessão, para reverter com precisão. */
  public readonly placedBlocks = new Map<string, number>();
  private errorCount = new Map<string, number>();

  constructor(public readonly mod: ModPackage) {}

  public log(level: ModLogEntry['level'], ...args: any[]): void {
    const message = args
      .map((a) => {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      })
      .join(' ');
    this.logs.push({ level, message, timestamp: Date.now() });
    // Log limitado: um `tick` que imprime a cada frame encheria a memória em minutos.
    if (this.logs.length > 300) this.logs.shift();
  }

  /** Registra a falha de um script. Devolve true se ele foi desligado agora. */
  public recordError(scriptKey: string, err: unknown): boolean {
    const msg = (err as any)?.message || String(err);
    const n = (this.errorCount.get(scriptKey) ?? 0) + 1;
    this.errorCount.set(scriptKey, n);
    this.log('error', `[${scriptKey}] ${msg}`);

    if (n >= MAX_SCRIPT_ERRORS) {
      this.disabledScripts.set(scriptKey, msg);
      this.removeHandlersOf(scriptKey);
      this.log('warn', `[${scriptKey}] desligado após ${n} erros — corrija e recarregue.`);
      return true;
    }
    return false;
  }

  public removeHandlersOf(scriptKey: string): void {
    for (const [event, list] of this.handlers) {
      this.handlers.set(event, list.filter((h) => h.scriptKey !== scriptKey));
    }
    this.errorCount.delete(scriptKey);
  }

  public reset(): void {
    this.handlers.clear();
    this.disabledScripts.clear();
    this.errorCount.clear();
  }
}

/**
 * Monta o objeto `api` entregue ao script.
 * Esta função **é** a superfície do mod: o que não aparece aqui não existe para ele.
 */
export function buildModAPI(ctx: ModContext, host: ModHostBridge, scriptKey: string): Record<string, any> {
  const mod = ctx.mod;
  let blockBudget = BLOCK_BUDGET_PER_CALL;
  const pending: { x: number; y: number; z: number; blockType: number }[] = [];

  /** Resolve id de bloco: número, chave do mod (`meu_cristal`) ou nome da paleta (`pedra`). */
  const resolveBlock = (ref: number | string): number => {
    if (typeof ref === 'number') return Number.isInteger(ref) && ref >= 0 ? ref : B.STONE;
    const chave = String(ref ?? '').trim().toLowerCase();
    const own = (mod.blocks || []).find((b) => b.key === chave);
    if (own && Number.isInteger(own.blockId)) return own.blockId;
    for (let i = 0; i < BLOCKS.length; i++) {
      const d = BLOCKS[i];
      if (d && !d.reserved && d.name.toLowerCase() === chave) return i;
    }
    return B.STONE;
  };

  const setBlock = (x: number, y: number, z: number, ref: number | string): boolean => {
    if (blockBudget <= 0) return false;
    blockBudget--;
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    if (!Number.isFinite(fx) || !Number.isFinite(fy) || !Number.isFinite(fz)) return false;
    const t = resolveBlock(ref);
    if (!host.setBlock(fx, fy, fz, t)) return false;
    pending.push({ x: fx, y: fy, z: fz, blockType: t });
    ctx.placedBlocks.set(`${fx},${fy},${fz}`, t);
    return true;
  };

  return {
    mod: { id: mod.id, name: mod.name, revision: mod.revision },

    /** Registra um handler. Chamado no corpo do script, durante a carga. */
    on(event: ModEvent, fn: ModHandler): void {
      if (!MOD_EVENTS.includes(event)) {
        ctx.log('warn', `Evento desconhecido "${event}". Válidos: ${MOD_EVENTS.join(', ')}`);
        return;
      }
      if (typeof fn !== 'function') {
        ctx.log('warn', `on("${event}") precisa de uma função.`);
        return;
      }
      const list = ctx.handlers.get(event) ?? [];
      list.push({ scriptKey, fn });
      ctx.handlers.set(event, list);
    },

    world: {
      getBlock: (x: number, y: number, z: number) => host.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)),
      setBlock,
      fillBox(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, ref: number | string, hollow = false): number {
        const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
        const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
        let n = 0;
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
              if (hollow && x !== minX && x !== maxX && y !== minY && y !== maxY && z !== minZ && z !== maxZ) continue;
              if (setBlock(x, y, z, ref)) n++;
            }
          }
        }
        return n;
      },
      getGroundY: (x: number, z: number) => host.getGroundY(Math.floor(x), Math.floor(z)),
      /** Bloco mais próximo do jogador, num raio. `null` se não achar. */
      findNearest(ref: number | string, radius = 16): { x: number; y: number; z: number } | null {
        const alvo = resolveBlock(ref);
        const p = host.playerPosition();
        const r = Math.min(32, Math.max(1, Math.floor(radius)));
        let melhor: { x: number; y: number; z: number } | null = null;
        let melhorD = Infinity;
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dz = -r; dz <= r; dz++) {
              const x = Math.floor(p.x) + dx, y = Math.floor(p.y) + dy, z = Math.floor(p.z) + dz;
              if (host.getBlock(x, y, z) !== alvo) continue;
              const d = dx * dx + dy * dy + dz * dz;
              if (d < melhorD) { melhorD = d; melhor = { x, y, z }; }
            }
          }
        }
        return melhor;
      },
      blockId: resolveBlock,
    },

    entities: {
      spawn: (entityKey: string, x: number, y: number, z: number) => host.spawnEntity(mod.id, String(entityKey), x, y, z),
      list: () => host.listEntities(),
      damage: (id: string, amount: number) => host.damageEntity(String(id), Number(amount) || 0),
    },

    player: {
      position: () => host.playerPosition(),
      teleport: (x: number, y: number, z: number) => host.teleportPlayer(x, y, z),
      health: () => host.playerHealth(),
      give: (ref: number | string, count = 1) => host.giveItem(resolveBlock(ref), Math.max(1, Math.floor(count))),
    },

    ui: {
      toast: (msg: string) => host.toast(String(msg).slice(0, 200)),
    },

    audio: {
      /**
       * Toca um som do catálogo do jogo. Nomes válidos em `api.audio.nomes`.
       *
       * O mod escolhe de um catálogo em vez de sintetizar livremente: som é a superfície mais
       * fácil de tornar insuportável, e um catálogo mantém o jogo coerente.
       */
      play: (nome: string, posicao?: { x: number; y: number; z: number }, volume?: number) =>
        host.playSound(String(nome), posicao, volume),
      nomes: [
        'dano', 'morte', 'acerto', 'mobMorte', 'pegarItem', 'craftar',
        'uiClique', 'uiAbrir', 'queimadura', 'splash', 'ferramentaQuebrou',
      ],
    },

    time: {
      /** Fração do dia: 0 = meia-noite, 0.5 = meio-dia. */
      ofDay: () => host.timeOfDay(),
      isNight: () => {
        const t = host.timeOfDay();
        return t < 0.25 || t > 0.75;
      },
      /** Fase da lua: 0 = nova (noite escura), 4 = cheia (noite clara). */
      moonPhase: () => host.moonPhase(),
      /** A noite de hoje é das escuras? Útil para o mod reagir sem decorar a tabela de fases. */
      isDarkNight: () => noiteEscura(host.moonPhase()),
    },

    /**
     * Clima. Ler é sempre permitido; **forçar altera o mundo para todos**, então vale a mesma
     * regra dos blocos: é uma escrita, e um mod que abusa disso aparece no diagnóstico.
     */
    weather: {
      /** Clima atual, o próximo e o quanto da transição já passou. */
      current: () => host.weather(),
      isRaining: () => {
        const c = host.weather().current;
        return c === 'chuva' || c === 'tempestade';
      },
      isStorm: () => host.weather().current === 'tempestade',
      /** `null` devolve o mundo à sequência derivada da semente. Devolve false se o nome não existe. */
      set: (clima: string | null) => host.setWeather(clima),
    },

    /** Chave-valor do mod, isolado dos demais. Dura a sessão. */
    storage: {
      get: (k: string) => ctx.storage.get(String(k)),
      set: (k: string, v: any) => { ctx.storage.set(String(k), v); },
      has: (k: string) => ctx.storage.has(String(k)),
      keys: () => Array.from(ctx.storage.keys()),
    },

    /** Console do mod: vai para o log do mod, não para o do navegador. */
    console: {
      log: (...a: any[]) => ctx.log('log', ...a),
      warn: (...a: any[]) => ctx.log('warn', ...a),
      error: (...a: any[]) => ctx.log('error', ...a),
    },

    /** Paleta base, para o script não precisar decorar ids. */
    B: {
      AIR: B.AIR, GRASS: B.GRASS, DIRT: B.DIRT, STONE: B.STONE, SAND: B.SAND, GRAVEL: B.GRAVEL,
      WATER: B.WATER, LOG: B.LOG, LEAVES: B.LEAVES, PLANK: B.PLANK, COBBLE: B.COBBLE,
      GLASS: B.GLASS, GLOWSTONE: B.GLOWSTONE, OBSIDIAN: B.OBSIDIAN, LAVA: B.LAVA,
      TORCH: B.TORCH, COAL_ORE: B.COAL_ORE, IRON_ORE: B.IRON_ORE,
      GOLD_ORE: B.GOLD_ORE, DIAMOND_ORE: B.DIAMOND_ORE, BRICK: B.BRICK, STONE_BRICK: B.STONE_BRICK,
    },

    Math,

    /** Uso interno do runtime: recolhe os blocos alterados e recarrega o orçamento. */
    __drain(): { x: number; y: number; z: number; blockType: number }[] {
      blockBudget = BLOCK_BUDGET_PER_CALL;
      return pending.splice(0, pending.length);
    },
  };
}
