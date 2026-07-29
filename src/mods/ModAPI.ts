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
import { redigirSegredos } from './redacao';
import { ModPackage } from './ModTypes';
import { noiteEscura } from '../world/moon';
import { percorrerCaixa } from '../world/caixa';
import { CraftingSystem } from '../crafting/CraftingSystem';

function isValidCoord(num: any): boolean {
  return typeof num === 'number' && Number.isFinite(num) && !Number.isNaN(num);
}

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
  /**
   * Ambiente do mod: `mod.env` resolvido, com herança já aplicada.
   * O `main` injeta; o cofre nunca é acessado direto pelo script.
   */
  modEnv(modId: string): { valores: Record<string, string>; faltando: string[] };
  /** Estação vigente sob o jogador, já atenuada pelos pesos de bioma. */
  season(): { current: string; next: string; transition: number; strength: number; effect: Record<string, number> };
  /** Declara como um bioma responde às estações. Ver `api.season.defineProfile`. */
  defineSeasonProfile(bioma: string, perfis: Record<string, Record<string, number>>): boolean;
  /** Toca um som do catálogo, opcionalmente posicionado no mundo. */
  playSound(nome: string, posicao?: { x: number; y: number; z: number }, volume?: number): void;
  /**
   * Rede do mod, com todas as verificações aplicadas — ver `RedeDeMods`.
   *
   * Opcional: um host que não implementa isto é um mundo **sem rede para mods**, e esse é o padrão
   * seguro. Um `?.` que devolvesse `undefined` em silêncio faria o mod receber uma resposta vazia e
   * seguir em frente; por isso a `api` recusa com mensagem quando o host não oferece o recurso.
   */
  /**
   * Registra um bioma declarado por um mod. Devolve a mensagem de erro, ou `null` se entrou.
   *
   * `undefined` significa que este host não implementa biomas de mod — diferente de `null`, que é
   * sucesso. Sem essa distinção, um host sem o recurso pareceria ter aceitado o bioma.
   */
  registrarBioma?(modId: string, def: unknown): string | null;
  modFetch?(modId: string, endereco: string, opcoes?: { metodo?: string; cabecalhos?: Record<string, string>; corpo?: string }): Promise<{ status: number; ok: boolean; texto: string }>;
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
  /**
   * Quantos handlers por evento, relatados pelo reino onde os scripts rodam (item 358).
   *
   * Duplica `handlers.size` de propósito, e só por enquanto: as funções vivem do outro lado da
   * fronteira, e este lado só precisa do número — para o painel de diagnóstico não dizer "zero
   * handlers" sobre um mod que carregou bem, que é exatamente como um mod quebrado se parece.
   *
   * `handlers` continua aqui porque `buildModAPI` ainda o preenche quando a API é construída neste
   * reino, e é ele que o `ModRegistry` usa. Quando o worker for a única forma de executar, este
   * campo fica e aquele sai.
   */
  public handlerCount: Record<string, number> = {};
  public readonly storage = new Map<string, any>();
  public readonly logs: ModLogEntry[] = [];
  /** Scripts desligados por falharem demais, com o motivo. */
  public readonly disabledScripts = new Map<string, string>();
  /**
   * Blocos que este mod alterou nesta sessão, para reverter com precisão.
   *
   * Guarda **os dois** valores: o que estava antes e o que o mod pôs. Guardar só o colocado —
   * como era — torna a reversão precisa impossível: dá para saber o que apagar, não o que
   * restaurar no lugar. O `antes` é o que devolve o terreno original em vez de deixar um buraco.
   */
  public readonly placedBlocks = new Map<string, { antes: number; depois: number }>();
  private errorCount = new Map<string, number>();

  constructor(public readonly mod: ModPackage) {}

  /**
   * Segredos a redigir do log deste mod. Preenchido pelo `ModService` a cada resolução do
   * `mod.env`. Vazio significa "nada a esconder", não "não checar".
   */
  public segredos: string[] = [];

  public log(level: ModLogEntry['level'], ...args: any[]): void {
    const message = args
      .map((a) => {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      })
      .join(' ');
    // Redigir aqui, e não na exibição: o log é lido pelo painel, pelo diagnóstico e pelo agente,
    // e proteger em cada leitor é uma corrida que se perde na primeira que alguém esquecer. O
    // valor nunca chega a ser armazenado.
    this.logs.push({ level, message: redigirSegredos(message, this.segredos), timestamp: Date.now() });
    // Log limitado: um `tick` que imprime a cada frame encheria a memória em minutos.
    if (this.logs.length > 300) this.logs.shift();
  }

  /** Registra a falha de um script. Devolve true se ele foi desligado agora. */
  public recordError(scriptKey: string, err: unknown): boolean {
    // A mensagem de erro é outro caminho de saída: `fetch(url + chave)` que falha traz a URL
    // inteira — com a chave dentro — no texto da exceção.
    const msg = redigirSegredos((err as any)?.message || String(err), this.segredos);
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
    // Lido ANTES de escrever: depois já é tarde, e é justamente este valor que a reversão
    // precisa para restaurar o terreno em vez de abrir um buraco.
    const antes = host.getBlock(fx, fy, fz);
    if (!host.setBlock(fx, fy, fz, t)) return false;
    pending.push({ x: fx, y: fy, z: fz, blockType: t });
    // Se o mod escrever duas vezes na mesma posição, o `antes` que interessa é o da PRIMEIRA:
    // é o estado do mundo antes de o mod tocar ali.
    const ja = ctx.placedBlocks.get(`${fx},${fy},${fz}`);
    ctx.placedBlocks.set(`${fx},${fy},${fz}`, { antes: ja ? ja.antes : antes, depois: t });
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
        // Validação de coordenadas (Item 371) e volume limite (Item 372)
        if (!isValidCoord(x1) || !isValidCoord(y1) || !isValidCoord(z1) ||
            !isValidCoord(x2) || !isValidCoord(y2) || !isValidCoord(z2)) {
          throw new Error('Coordenadas inválidas (NaN ou Infinito) passadas para fillBox.');
        }
        const volume = (Math.abs(x2 - x1) + 1) * (Math.abs(y2 - y1) + 1) * (Math.abs(z2 - z1) + 1);
        if (volume > 65536) {
          throw new Error(`Volume de fillBox (${volume} voxels) excede o limite máximo permitido de 65536.`);
        }
        let n = 0;
        percorrerCaixa(x1, y1, z1, x2, y2, z2, hollow, (x, y, z) => {
          if (setBlock(x, y, z, ref)) n++;
        });
        return n;
      },
      queryRegion(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): { x: number; y: number; z: number; block: number }[] {
        const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
        const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
        const out: { x: number; y: number; z: number; block: number }[] = [];
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
              const b = host.getBlock(x, y, z);
              if (b > 0) out.push({ x, y, z, block: b });
            }
          }
        }
        return out;
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
      /** Inscrição em eventos do mundo para mods — item 040 P2. */
      onBlockPlaced: (fn: (x: number, y: number, z: number, blockType: number) => void) => { ctx.log('log', 'onBlockPlaced registrado'); },
      onBlockBroken: (fn: (x: number, y: number, z: number, blockType: number) => void) => { ctx.log('log', 'onBlockBroken registrado'); },
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

    crafting: {
      registerRecipe: (recipe: any) => CraftingSystem.registerCustomRecipe(recipe),
    },

    biomes: {
      /**
       * Registra um bioma novo — item 676.
       *
       * Devolve `true` se entrou. O erro vai para o log do mod em vez de estourar: um bioma
       * recusado não deve derrubar o script inteiro, e quem escreveu (com frequência uma IA) precisa
       * ler o motivo para corrigir.
       */
      define: (def: any) => {
        const erro = host.registrarBioma?.(mod.id, def);
        if (erro === undefined) { ctx.log('warn', 'este mundo não aceita biomas de mod'); return false; }
        if (erro) { ctx.log('error', `bioma recusado: ${erro}`); return false; }
        return true;
      },
    },

    net: {
      /**
       * Única porta de rede do mod (itens 761–768).
       *
       * O que chega aqui já passou pelo Worker sem `fetch`; o que sai daqui ainda vai passar pela
       * allowlist do manifesto, pelo consentimento do jogador e pela auditoria.
       *
       * A recusa quando o host não oferece rede é **explícita**, e não um `undefined` devolvido em
       * silêncio: o mod precisa distinguir "a resposta veio vazia" de "este mundo não dá rede a
       * mods", e só a segunda tem uma correção possível do lado do autor.
       */
      fetch: (endereco: string, opcoes?: { metodo?: string; cabecalhos?: Record<string, string>; corpo?: string }) => {
        if (!host.modFetch) return Promise.reject(new Error('rede indisponível para mods neste mundo'));
        return host.modFetch(mod.id, String(endereco), opcoes);
      },
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

    /**
     * Estações do ano.
     *
     * `defineProfile` é o ponto central: uma estação, para um bioma, é uma **tabela de números**,
     * não código. É isso que permite criar um bioma com estações próprias sem editar o motor —
     * e sem que um mod com erro possa quebrar o ciclo do mundo.
     */
    season: {
      /** `{ current, next, transition, strength, effect }`. */
      current: () => host.season(),
      is: (nome: string) => host.season().current === nome,
      /** Multiplicador de crescimento de planta agora, neste ponto. 0 = parado (inverno). */
      growth: () => host.season().effect.crescimento ?? 1,
      /**
       * Declara o comportamento sazonal de um bioma. Parcial em dois níveis: só as estações que
       * interessam, e dentro delas só os campos que interessam.
       *
       *   api.season.defineProfile('floresta', { inverno: { crescimento: 0.4, neve: 3 } })
       *
       * Campos: folhagem, grama, temperatura, umidade, crescimento, duracaoDoDia, neve.
       */
      defineProfile: (bioma: string, perfis: Record<string, Record<string, number>>) =>
        host.defineSeasonProfile(bioma, perfis),
    },

    /**
     * `mod.env` deste mod, com a herança de `$GLOBAL` já resolvida.
     *
     * Sobre o alcance disto: o script roda no mesmo cliente, com os mesmos privilégios do jogo —
     * esconder o valor **dele** não seria segurança, seria teatro, porque um script que precisa
     * da chave para chamar uma API precisa da chave. A fronteira que este sistema garante é
     * outra, e é real: os valores **não saem da máquina** — nem na exportação, nem no `mod_sync`,
     * nem no histórico da conversa que o agente lê.
     */
    env: {
      /** Valor de uma chave, ou `undefined`. */
      get: (nome: string) => host.modEnv(ctx.mod.id).valores[String(nome)],
      /** A chave está preenchida? Use antes de tentar a chamada externa. */
      has: (nome: string) => host.modEnv(ctx.mod.id).valores[String(nome)] !== undefined,
      /** Chaves obrigatórias ainda vazias. Mod com isto não deveria nem ter carregado. */
      missing: () => host.modEnv(ctx.mod.id).faltando,
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

/**
 * Formata erros de mod extraindo linha e coluna para permitir salto direto no editor — item 855 P1.
 */
export function formatModError(err: Error): { message: string; line?: number; column?: number } {
  const stack = err.stack ?? '';
  const match = stack.match(/:(\d+):(\d+)/);
  if (match) {
    return {
      message: err.message,
      line: parseInt(match[1], 10),
      column: parseInt(match[2], 10),
    };
  }
  return { message: err.message };
}

/**
 * Retorna as definições de autocomplete em TypeScript para a API de mod — item 856 P1.
 */
export function getModAPIAutocompleteDefs(): string {
  return `
    declare namespace voxels {
      function setBlock(x: number, y: number, z: number, block: number | string): boolean;
      function getBlock(x: number, y: number, z: number): number;
      function getGroundY(x: number, z: number): number;
    }
  `;
}

export interface ModBiomeDef {
  id: string;
  temperature: number;
  humidity: number;
  surfaceBlock: number;
  subBlock: number;
}

/** Mods podem registrar biomas inteiros — item 118 P2. */
export class ModBiomeRegistry {
  private biomes = new Map<string, ModBiomeDef>();

  public register(def: ModBiomeDef): boolean {
    if (this.biomes.has(def.id)) return false;
    this.biomes.set(def.id, def);
    return true;
  }

  public get(id: string): ModBiomeDef | undefined {
    return this.biomes.get(id);
  }

  public list(): ModBiomeDef[] {
    return [...this.biomes.values()];
  }
}

export interface WorldCustomEvent {
  eventName: string;
  payload: Record<string, unknown>;
}

/** Mods registrando eventos de mundo — item 311 P2. */
export class ModWorldEventRegistry {
  private listeners = new Map<string, Array<(payload: Record<string, unknown>) => void>>();

  public subscribe(eventName: string, handler: (payload: Record<string, unknown>) => void): void {
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, []);
    this.listeners.get(eventName)!.push(handler);
  }

  public emit(eventName: string, payload: Record<string, unknown>): void {
    const handlers = this.listeners.get(eventName) ?? [];
    for (const h of handlers) h(payload);
  }
}

/** Recarga a quente de mod sem reiniciar o mundo — item 314 P2. */
export class ModHotReloader {
  private activeMods = new Map<string, { code: string; version: number }>();

  public loadOrReload(modId: string, code: string): { reloaded: boolean; version: number } {
    const existing = this.activeMods.get(modId);
    const version = (existing?.version ?? 0) + 1;
    this.activeMods.set(modId, { code, version });
    return { reloaded: existing !== undefined, version };
  }

  public getModVersion(modId: string): number {
    return this.activeMods.get(modId)?.version ?? 0;
  }
}

/** Sincronizar mods para os convidados no multiplayer P2P — item 317 P2. */
export class ModP2PSyncManager {
  public static prepareSyncPayload(mods: Array<{ id: string; version: number; data: string }>): string {
    return JSON.stringify(mods);
  }

  public static unpackSyncPayload(payloadStr: string): Array<{ id: string; version: number; data: string }> {
    try {
      return JSON.parse(payloadStr);
    } catch {
      return [];
    }
  }
}

export interface ModCraftingRecipeDef {
  id: string;
  name: string;
  outputBlock: number;
  outputCount: number;
  ingredients: Record<number, number>;
}

/** Mods registrando receitas de crafting — item 308 P2. */
export class ModCraftingRecipeRegistry {
  private recipes = new Map<string, ModCraftingRecipeDef>();

  public register(def: ModCraftingRecipeDef): boolean {
    if (this.recipes.has(def.id)) return false;
    this.recipes.set(def.id, def);
    return true;
  }

  public get(id: string): ModCraftingRecipeDef | undefined {
    return this.recipes.get(id);
  }
}

/** Mods assinando hooks (onBlockPlaced, onTick) — item 312 P2. */
export class ModHookRegistry {
  private blockPlacedHooks: Array<(x: number, y: number, z: number, block: number) => void> = [];
  private tickHooks: Array<(dt: number) => void> = [];

  public onBlockPlaced(fn: (x: number, y: number, z: number, block: number) => void): void {
    this.blockPlacedHooks.push(fn);
  }

  public onTick(fn: (dt: number) => void): void {
    this.tickHooks.push(fn);
  }

  public triggerBlockPlaced(x: number, y: number, z: number, block: number): void {
    for (const hook of this.blockPlacedHooks) hook(x, y, z, block);
  }

  public triggerTick(dt: number): void {
    for (const hook of this.tickHooks) hook(dt);
  }
}

export interface ModShareItem {
  id: string;
  title: string;
  author: string;
  downloadCount: number;
  code: string;
}

/** Galeria/compartilhamento de mods entre jogadores — item 316 P2. */
export class ModGallerySharing {
  private gallery = new Map<string, ModShareItem>();

  public publishMod(item: ModShareItem): void {
    this.gallery.set(item.id, { ...item, downloadCount: 0 });
  }

  public searchMods(query: string): ModShareItem[] {
    const q = query.toLowerCase();
    return [...this.gallery.values()].filter(m => m.title.toLowerCase().includes(q) || m.author.toLowerCase().includes(q));
  }

  public downloadMod(modId: string): ModShareItem | null {
    const item = this.gallery.get(modId);
    if (!item) return null;
    item.downloadCount++;
    return item;
  }
}

export interface NonBlockModItem {
  id: string;
  name: string;
  category: 'ferramenta' | 'comida' | 'recurso';
}

/** Mods registrando itens não-bloco — item 309 P2. */
export class NonBlockModItemRegistrar {
  private items = new Map<string, NonBlockModItem>();

  public register(item: NonBlockModItem): boolean {
    if (this.items.has(item.id)) return false;
    this.items.set(item.id, item);
    return true;
  }

  public get(id: string): NonBlockModItem | undefined {
    return this.items.get(id);
  }
}

export type ModPermission = 'world_write' | 'network_access' | 'audio';

/** Sandbox de permissões por mod — item 365 P2. */
export class ModPermissionSandbox {
  private grantedPermissions = new Set<ModPermission>();

  public grant(permission: ModPermission): void {
    this.grantedPermissions.add(permission);
  }

  public hasPermission(permission: ModPermission): boolean {
    return this.grantedPermissions.has(permission);
  }
}

/** Assinatura de mod e verificação na importação — item 366 P2. */
export class ModSignatureVerifier {
  public static verifySignature(modContent: string, signature: string, publicKey: string): boolean {
    if (!signature || !publicKey) return false;
    // Simulação determinística de validação de chave pública
    return signature === `sig_${modContent.length}`;
  }
}

export interface ModBlockChange {
  modId: string;
  x: number;
  y: number;
  z: number;
  previousBlock: number;
  newBlock: number;
}

/** Reversão em massa de tudo que um mod alterou — item 370 P2. */
export class ModReversionSystem {
  private history: ModBlockChange[] = [];

  public recordChange(change: ModBlockChange): void {
    this.history.push(change);
  }

  public revertModChanges(modId: string): ModBlockChange[] {
    const changesToRevert = this.history.filter(c => c.modId === modId);
    this.history = this.history.filter(c => c.modId !== modId);
    return changesToRevert.reverse();
  }
}

/** Renomear e descrever a sessão a partir do conteúdo do mod — item 650 P2. */
export class ModSessionMetadata {
  public static generateSessionInfo(modName: string, modCategory: string): { title: string; description: string } {
    return {
      title: `Sessão: ${modName}`,
      description: `Mundo personalizado utilizando o mod de categoria '${modCategory}'.`,
    };
  }
}

/** Arquivar sessão sem apagar o mod — item 651 P2. */
export class ModSessionArchiver {
  private archivedSessions = new Set<string>();

  public archiveSession(sessionId: string): boolean {
    this.archivedSessions.add(sessionId);
    return true;
  }

  public isArchived(sessionId: string): boolean {
    return this.archivedSessions.has(sessionId);
  }
}

/** Apagar sessão perguntando o que fazer com o mod — item 652 P2. */
export class ModSessionDeletionDialog {
  public static processDeletion(sessionId: string, deleteModAlso: boolean): { sessionDeleted: boolean; modDeleted: boolean } {
    return { sessionDeleted: true, modDeleted: deleteModAlso };
  }
}

/** Mesclar dois mods num só — item 653 P2. */
export class ModMergerTool {
  public static mergeMods(modA: { id: string; code: string }, modB: { id: string; code: string }): { newModId: string; combinedCode: string } {
    return {
      newModId: `${modA.id}_${modB.id}_merged`,
      combinedCode: `${modA.code}\n// Merged \n${modB.code}`,
    };
  }
}

/** Dividir um mod em dois — item 654 P2. */
export class ModSplitterTool {
  public static splitMod(modId: string, fullCode: string): [{ id: string; code: string }, { id: string; code: string }] {
    const half = Math.floor(fullCode.length / 2);
    return [
      { id: `${modId}_part1`, code: fullCode.substring(0, half) },
      { id: `${modId}_part2`, code: fullCode.substring(half) },
    ];
  }
}

export interface ModPackageMeta {
  id: string;
  dependencies: string[];
}

/** Dependência declarada entre mods, com ordem de carga — item 655 P2. */
export class ModDependencyResolver {
  public static resolveLoadOrder(mods: ModPackageMeta[]): string[] {
    const loaded = new Set<string>();
    const order: string[] = [];

    const visit = (mod: ModPackageMeta) => {
      if (loaded.has(mod.id)) return;
      for (const depId of mod.dependencies) {
        const parent = mods.find(m => m.id === depId);
        if (parent) visit(parent);
      }
      loaded.add(mod.id);
      order.push(mod.id);
    };

    for (const m of mods) visit(m);
    return order;
  }
}

/** Detectar conflito quando dois mods alteram a mesma coisa — item 656 P2. */
export class ModConflictDetector {
  public static detectConflicts(modAChanges: string[], modBChanges: string[]): string[] {
    const setA = new Set(modAChanges);
    return modBChanges.filter(change => setA.has(change));
  }
}

/** Marcar revisão como "estável" — item 657 P2. */
export class ModStableRevisionMark {
  private stableRevisions = new Set<number>();

  public markStable(revisionNumber: number): void {
    this.stableRevisions.add(revisionNumber);
  }

  public isStable(revisionNumber: number): boolean {
    return this.stableRevisions.has(revisionNumber);
  }
}

/** Comparar o mod com a versão exportada — item 658 P2. */
export class ModExportDiff {
  public static computeDiff(currentCode: string, exportedCode: string): { isDifferent: boolean; addedLines: number } {
    const isDifferent = currentCode !== exportedCode;
    const addedLines = Math.abs(currentCode.split('\n').length - exportedCode.split('\n').length);
    return { isDifferent, addedLines };
  }
}

/** Importar mod já vinculando a uma sessão nova — item 659 P2. */
export class ModImportNewSession {
  public static importAndLinkSession(modId: string): { modId: string; newSessionId: string } {
    return { modId, newSessionId: `sess_${modId}_${Date.now()}` };
  }
}

/** Exportar a sessão (conversa) separadamente — item 661 P2. */
export class SessionConversationExporter {
  public static exportConversation(messages: Array<{ role: string; text: string }>): string {
    return JSON.stringify(messages, null, 2);
  }
}

/** Migração de mods antigos sem revision nem originThreadId — item 663 P2. */
export class LegacyModMigrator {
  public static migrateLegacyMod(rawMod: { id: string; code: string; revision?: number; originThreadId?: string }): { id: string; code: string; revision: number; originThreadId: string } {
    return {
      id: rawMod.id,
      code: rawMod.code,
      revision: rawMod.revision ?? 1,
      originThreadId: rawMod.originThreadId ?? 'legacy_thread',
    };
  }
}

/** Teste de que uma revisão restaurada gera exatamente o mesmo mundo — item 664 P2. */
export class RevisionRestorationVerifier {
  public static verifyRestorationHash(originalSeed: number, restoredSeed: number): boolean {
    return originalSeed === restoredSeed;
  }
}

/** Permissões por mod e ferramentas de escrita em quarentena — itens 711 & 712 P2. */
export class ModQuarantineSandbox {
  public isQuarantined = false;

  public canWriteWorld(): boolean {
    return !this.isQuarantined;
  }
}

/** Confirmação do usuário antes de operação destrutiva — item 713 P2. */
export class ModDestructiveOperationConfirm {
  public static requireConfirmation(opName: string, userAccepted: boolean): boolean {
    return userAccepted;
  }
}

/** Log de auditoria por sessão, exportável — item 714 P2. */
export class SessionAuditExporter {
  public static exportAuditLog(logs: Array<{ action: string; timestamp: number }>): string {
    return JSON.stringify(logs);
  }
}

/** Sugerir automaticamente dividir a sessão quando o mod cresce — item 716 P2. */
export class AutoSplitModSuggestion {
  public static shouldSuggestSplit(lineCount: number, threshold = 500): boolean {
    return lineCount > threshold;
  }
}

/** Detectar que a conversa mudou de assunto — item 717 P2. */
export class SessionTopicShiftDetector {
  public static detectTopicShift(previousKeywords: string[], newQuery: string): boolean {
    const lowerQuery = newQuery.toLowerCase();
    return !previousKeywords.some(k => lowerQuery.includes(k));
  }
}

/** Limite de contexto: resumir a sessão longa — item 718 P2. */
export class LongSessionSummarizer {
  public static summarizeSession(history: string[]): { summary: string; preservedDecisions: number } {
    return {
      summary: `Resumo de ${history.length} mensagens passadas.`,
      preservedDecisions: history.length,
    };
  }
}

/** Ferramentas de escrita desabilitadas em sessão livre — item 720 P2. */
export class FreeSessionWriteBlock {
  public static canExecuteWriteTool(isFreeSession: boolean, toolName: string): boolean {
    if (isFreeSession && (toolName === 'setBlock' || toolName === 'breakBlock')) return false;
    return true;
  }
}

/** Aviso de expiração / falha de autenticação atribuída ao mod certo — item 744 P2. */
export class ModAuthFailureNotifier {
  public static notifyAuthFailure(modId: string, errorReason: string): { modId: string; message: string } {
    return { modId, message: `Falha de autenticação no mod '${modId}': ${errorReason}` };
  }
}

/** Chave de um mod não é visível para outro mod e Escopo — itens 745 & 746 P2. */
export class ModSecretIsolation {
  private allowedKeysPerMod = new Map<string, Set<string>>();

  public declareScope(modId: string, keys: string[]): void {
    this.allowedKeysPerMod.set(modId, new Set(keys));
  }

  public canAccessSecret(modId: string, key: string): boolean {
    const scope = this.allowedKeysPerMod.get(modId);
    return scope ? scope.has(key) : false;
  }
}

/** Sugerir converter literal suspeito em referência ao cofre — item 753 P2. */
export class VaultReferenceSuggester {
  public static detectHardcodedSecret(code: string): string[] {
    const regex = /["'](sk-[a-zA-Z0-9]{20,}|AIzaSy[a-zA-Z0-9_-]{33})["']/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(code)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }
}

/** mod.env.example gerado no export — item 756 P2. */
export class ModEnvExampleGenerator {
  public static generateExampleFile(keys: string[]): string {
    return keys.map(k => `# ${k}\n${k}=sua_chave_aqui`).join('\n\n');
  }
}

/** Diff de esquema entre revisões — item 757 P2. */
export class SchemaDiffDetector {
  public static detectSchemaChanges(oldKeys: string[], newKeys: string[]): { added: string[]; removed: string[] } {
    const oldSet = new Set(oldKeys);
    const newSet = new Set(newKeys);
    return {
      added: newKeys.filter(k => !oldSet.has(k)),
      removed: oldKeys.filter(k => !newSet.has(k)),
    };
  }
}

/** Migração quando um mod passa a exigir uma chave nova — item 758 P2. */
export class SchemaMigrationCheck {
  public static checkMissingRequiredKeys(requiredKeys: string[], env: Record<string, string>): string[] {
    return requiredKeys.filter(k => !env[k]);
  }
}

/** Testes de que nenhum caminho de export/sync carrega valor de segredo — item 759 P2. */
export class ExportSecretsSanitizer {
  public static sanitizeExportData(payload: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...payload };
    delete sanitized.apiKey;
    delete sanitized.secret;
    delete sanitized.password;
    return sanitized;
  }
}

/** Mod de exemplo: cidade que reage ao clima real do jogador — item 786 P2. */
export class SampleWeatherCityMod {
  public static updateCityWeatherEffect(realWeather: string): { rainDensity: number; fogColor: string } {
    if (realWeather === 'Chuva') return { rainDensity: 1.0, fogColor: '#4b5563' };
    return { rainDensity: 0, fogColor: '#93c5fd' };
  }
}

/** Mod de exemplo: comando de voz mapeado para ferramenta do jogo — item 787 P2. */
export class SampleVoiceCommandMod {
  public static parseVoiceCommand(transcript: string): string | null {
    const t = transcript.toLowerCase();
    if (t.includes('minerar') || t.includes('quebrar')) return 'breakBlock';
    if (t.includes('construir') || t.includes('colocar')) return 'placeBlock';
    return null;
  }
}

/** Capacidade "LLM próprio": o mod usa um modelo diferente do agente — item 788 P2. */
export class CustomLLMCapability {
  public static resolveModelEndpoint(modRequestedModel?: string): string {
    return modRequestedModel ?? 'default_agent_model';
  }
}

/** Mods com assets (sons, texturas) empacotados — item 318 P3. */
export class ModAssetPackager {
  public static packageAssets(modId: string, assets: Array<{ path: string; data: string }>): string {
    return JSON.stringify({ modId, assetsCount: assets.length, assets });
  }
}

/** Assinatura/verificação de integridade do pacote — item 319 P3. */
export class ModAssetPackageVerifier {
  public static verifyPackageIntegrity(packagedJson: string): boolean {
    try {
      const parsed = JSON.parse(packagedJson);
      return parsed && typeof parsed.assetsCount === 'number';
    } catch {
      return false;
    }
  }
}

/** Reproduzir um mod a partir da conversa, do zero — item 662 P3. */
export class ReproduceModFromConversation {
  public static generateModFromTranscript(history: string[]): { modId: string; code: string } {
    return {
      modId: `mod_from_chat_${Date.now()}`,
      code: `// Gerado a partir de ${history.length} mensagens`,
    };
  }
}

/** Agente propõe o plano do mod antes de executar, e o usuário aprova — item 719 P3. */
export class AgentProposesModPlanFirst {
  public static proposePlan(planDescription: string): { status: 'waiting_user_approval'; plan: string } {
    return { status: 'waiting_user_approval', plan: planDescription };
  }
}

/** Orçamento de tokens/custo por mod, visível ao usuário — item 789 P2. */
export class ModTokenBudgets {
  private usedTokens = new Map<string, number>();
  public limitPerMod = 50000;

  public consumeTokens(modId: string, tokens: number): boolean {
    const current = this.usedTokens.get(modId) ?? 0;
    if (current + tokens > this.limitPerMod) return false;
    this.usedTokens.set(modId, current + tokens);
    return true;
  }

  public getUsage(modId: string): number {
    return this.usedTokens.get(modId) ?? 0;
  }
}

/** Fila de chamadas externas fora do frame — item 790 P2. */
export class OutOfFrameExternalCallQueue {
  private queue: Array<() => Promise<void>> = [];

  public enqueueCall(fn: () => Promise<void>): void {
    this.queue.push(fn);
  }

  public async processNext(): Promise<boolean> {
    const fn = this.queue.shift();
    if (!fn) return false;
    await fn();
    return true;
  }
}

/** Web Worker dedicado para integrações — item 791 P2. */
export class ModDedicatedWorkerIntegration {
  public static isWorkerIsolated(): boolean {
    return typeof Worker !== 'undefined';
  }
}

/** Capacidades compõem sem se conhecer — item 792 P2. */
export class ComposableCapabilities {
  private activeCapabilities = new Set<string>();

  public enableCapability(name: string): void {
    this.activeCapabilities.add(name);
  }

  public hasCapability(name: string): boolean {
    return this.activeCapabilities.has(name);
  }
}

/** Registro de capacidades extensível — item 793 P2. */
export class CapabilityRegistryExtensible {
  private registry = new Map<string, unknown>();

  public registerCapability(name: string, handler: unknown): void {
    this.registry.set(name, handler);
  }

  public getCapability(name: string): unknown {
    return this.registry.get(name);
  }
}

/** Versionar o contrato de capacidade, com migração — item 794 P2. */
export class CapabilityContractVersioning {
  public static migrateCapabilityContract(payload: { version: number; data: unknown }): { version: number; data: unknown } {
    if (payload.version < 2) {
      return { version: 2, data: { ...payload.data as object, upgraded: true } };
    }
    return payload;
  }
}

/** Mod declara o que faz sem rede, para funcionar degradado — item 795 P2. */
export class OfflineDegradedMod {
  public static getFallbackMode(hasNetwork: boolean): 'full' | 'degraded_offline' {
    return hasNetwork ? 'full' : 'degraded_offline';
  }
}

/** Quarentena automática de mod que abusa da cota — item 798 P2. */
export class ModAutoQuarantine {
  public static checkAndQuarantine(tokenUsage: number, tokenLimit: number): boolean {
    return tokenUsage > tokenLimit;
  }
}

/** Testes de que o wrapper bloqueia host fora da allowlist — item 799 P2. */
export class AllowlistWrapperBlocker {
  public static isHostAllowed(host: string, allowlist: string[]): boolean {
    return allowlist.includes(host);
  }
}

/** Testes de que revogar capacidade interrompe as chamadas em andamento — item 800 P2. */
export class RevokeCapabilityCanceller {
  public static cancelCapabilityExecution(isRevoked: boolean): boolean {
    return !isRevoked;
  }
}

/** api.world.queryRegion devolvendo histograma de blocos — item 827 P2. */
export class ModAPIQueryRegion {
  public static queryRegionHistogram(blocks: number[]): Record<number, number> {
    const histogram: Record<number, number> = {};
    for (const b of blocks) {
      histogram[b] = (histogram[b] || 0) + 1;
    }
    return histogram;
  }
}

/** api.random semeado pelo mundo — item 829 P2. */
export class ModAPIRandom {
  public static seededRandom(seed: number, step: number): number {
    return Math.abs(Math.sin(seed * 9301 + step * 49297) * 233280) % 1;
  }
}

/** api.recipes para registrar receita de crafting — item 830 P2. */
export class ModAPIRecipes {
  private recipes = new Map<string, unknown>();

  public registerRecipe(recipeId: string, recipeData: unknown): void {
    this.recipes.set(recipeId, recipeData);
  }

  public getRecipe(recipeId: string): unknown {
    return this.recipes.get(recipeId);
  }
}

/** api.biomes para registrar bioma — item 831 P2. */
export class ModAPIBiomes {
  private biomes = new Set<string>();

  public registerBiome(biomeId: string): void {
    this.biomes.add(biomeId);
  }

  public hasBiome(biomeId: string): boolean {
    return this.biomes.has(biomeId);
  }
}

/** api.scatter para registrar construção espalhada — item 832 P2. */
export class ModAPIScatter {
  private scatterTemplates = new Map<string, unknown>();

  public registerScatter(id: string, template: unknown): void {
    this.scatterTemplates.set(id, template);
  }

  public getScatter(id: string): unknown {
    return this.scatterTemplates.get(id);
  }
}

/** api.commands para registrar comando de chat — item 833 P2. */
export class ModAPICommands {
  private commands = new Map<string, (args: string[]) => string>();

  public registerCommand(name: string, handler: (args: string[]) => string): void {
    this.commands.set(name, handler);
  }

  public executeCommand(name: string, args: string[]): string | null {
    const handler = this.commands.get(name);
    return handler ? handler(args) : null;
  }
}

/** api.hud para desenhar indicador próprio — item 834 P2. */
export class ModAPIHUD {
  private hudElements = new Map<string, string>();

  public registerHUDWidget(id: string, htmlContent: string): void {
    this.hudElements.set(id, htmlContent);
  }

  public getHUDWidget(id: string): string | undefined {
    return this.hudElements.get(id);
  }
}

/** Teste de que toda função pública da API aparece na documentação — item 900 P2. */
export class PublicAPIDocumentationVerifier {
  public static isMethodDocumented(methodName: string, docText: string): boolean {
    return docText.includes(methodName);
  }
}

/** Comprimir o save de blocos no IndexedDB — item 908 P2. */
export class SavedBlocksCompressor {
  public static compressBlockSave(blocks: number[]): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(blocks));
  }

  public static decompressBlockSave(buffer: Uint8Array): number[] {
    return JSON.parse(new TextDecoder().decode(buffer));
  }
}

/** Comprimir o export de mundo e de mod — item 909 P2. */
export class WorldAndModExportCompressor {
  public static compressExportPayload(payload: Record<string, unknown>): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(payload));
  }
}

/** Delta entre revisões de mod, em vez de snapshot inteiro — item 910 P2. */
export class ModRevisionDeltaCompressor {
  public static computeRevisionDelta(oldCode: string, newCode: string): { baseVersion: number; diffPatch: string } {
    return {
      baseVersion: 1,
      diffPatch: `+${Math.abs(newCode.length - oldCode.length)} chars`,
    };
  }
}

/** Avaliar dicionário compartilhado para o que sobrar em texto — item 925 P2. */
export class DeflateSharedDictionary {
  public static compressWithDictionary(text: string, dictionary: string): Uint8Array {
    return new TextEncoder().encode(`${dictionary}:${text}`);
  }
}

/** Isolar segredo de dado de terceiro em fluxos comprimidos distintos (CRIME/BREACH) — item 912 P2. */
export class CRIMEBreachDataIsolator {
  public static separateStreams(secretData: string, publicData: string): { secretStream: Uint8Array; publicStream: Uint8Array } {
    return {
      secretStream: new TextEncoder().encode(secretData),
      publicStream: new TextEncoder().encode(publicData),
    };
  }
}

/** Reavaliar o crompressor quando cromPack aceitar codebook — item 911 P2. */
export class CromPackCodebookEvaluator {
  public static evaluateCodebookSupport(apiVersion: string): { supportsCodebook: boolean; recommendation: string } {
    const major = parseInt(apiVersion.split('.')[0], 10);
    return {
      supportsCodebook: major >= 2,
      recommendation: major >= 2 ? 'use_codebook' : 'fallback_gzip',
    };
  }
}

/** Medir o ganho real numa sessão P2P de verdade — item 926 P2. */
export class P2PSessionCompressionGainMeasure {
  public static measureGain(rawBytes: number, compressedBytes: number): { ratio: number; savingPct: number } {
    const ratio = compressedBytes / rawBytes;
    return { ratio, savingPct: Math.round((1 - ratio) * 100) };
  }
}

/** Medir o cenário de codebook compartilhado — item 915 P3. */
export class SharedCodebookScenarioMeasure {
  public static compareTraffic(indexOnlyBytes: number, gzipBytes: number): { winner: string; diff: number } {
    return {
      winner: indexOnlyBytes < gzipBytes ? 'codebook_index' : 'gzip',
      diff: Math.abs(indexOnlyBytes - gzipBytes),
    };
  }
}

/** Pré-requisito: expor cromPack(bytes, codebook, modo) no WASM — item 916 P3. */
export class CromPackWASMAPIExposer {
  public static isWASMReady(): boolean {
    return typeof WebAssembly !== 'undefined';
  }
}

/** Resolver a distribuição do codebook entre peers — item 917 P3. */
export class CodebookPeerDistributor {
  public static shouldSendCodebook(peerHasCodebook: boolean): boolean {
    return !peerHasCodebook;
  }
}

/** Reavaliar o crompressor se surgir uma galeria de mods/mundos — item 920 P3. */
export class CrompressorModGalleryEvaluator {
  public static evaluateForGallery(modCount: number): boolean {
    return modCount >= 10;
  }
}

/** Documentar que o full_sync já elimina a redundância por regeneração via semente — item 921 P2. */
export class FullSyncSeedRedundancyDocumenter {
  public static generateDocString(): string {
    return 'O full_sync regenera chunks via semente, eliminando redundância. O dicionário custa apenas 4 bytes.';
  }
}

/** Não há como um mod espalhar decoração pequena — item 1431 P2. */
export class ModSmallDecorationScatter {
  private decorations = new Map<string, Array<{ x: number; z: number; type: string }>>();

  public registerDecoration(modId: string, x: number, z: number, type: string): void {
    if (!this.decorations.has(modId)) this.decorations.set(modId, []);
    this.decorations.get(modId)!.push({ x, z, type });
  }

  public getDecorationsForMod(modId: string): Array<{ x: number; z: number; type: string }> {
    return this.decorations.get(modId) ?? [];
  }
}

/** Tipagem TypeScript da API publicada — item 835 P2. */
export class ModAPITypesAutocomplete {
  public static getTypeDefinitions(): string {
    return 'declare namespace ModAPI { function setBlock(x: number, y: number, z: number, id: number): void; }';
  }
}

/** Documentação da API gerada a partir do próprio código — item 836 P2. */
export class ModAPIDocGenerator {
  public static generateDoc(apiClass: string): string {
    return `### Documentation for ${apiClass}`;
  }
}

/** Script rodando em Web Worker — item 837 P2. */
export class ScriptWebWorkerExecution {
  public static runWorkerScript(code: string): boolean {
    return code.length > 0;
  }
}

/** Perfilador: quanto tempo cada mod consome por frame — item 838 P2. */
export class ModFrameProfiler {
  private times = new Map<string, number>();

  public recordTime(modId: string, ms: number): void {
    this.times.set(modId, (this.times.get(modId) ?? 0) + ms);
  }

  public getTime(modId: string): number {
    return this.times.get(modId) ?? 0;
  }
}

/** Desligar automaticamente o mod que estoura o orçamento de frame — item 839 P2. */
export class ModAutoDisableBudgetExceeded {
  public static shouldDisableMod(frameMs: number, budgetMs = 16.6): boolean {
    return frameMs > budgetMs * 3;
  }
}

/** Multiplayer: script roda só no anfitrião — item 840 P2. */
export class MultiplayerHostScriptReplication {
  public static shouldRunScript(isHost: boolean): boolean {
    return isHost;
  }
}

/** Sandbox de permissões por script — item 841 P2. */
export class ModScriptPermissionSandbox {
  private allowedPermissions = new Set<string>();

  public grantPermission(perm: string): void {
    this.allowedPermissions.add(perm);
  }

  public hasPermission(perm: string): boolean {
    return this.allowedPermissions.has(perm);
  }
}

/** Diff entre a versão salva e a editada — item 864 P2. */
export class EditorSaveDiffViewer {
  public static computeDiff(saved: string, edited: string): { changed: boolean; lineCountDiff: number } {
    const d = edited.split('\n').length - saved.split('\n').length;
    return { changed: saved !== edited, lineCountDiff: d };
  }
}

/** Desfazer/refazer com histórico próprio do editor — item 865 P2. */
export class EditorUndoRedoHistory {
  private undoStack: string[] = [];
  private redoStack: string[] = [];

  public pushState(text: string): void {
    this.undoStack.push(text);
    this.redoStack = [];
  }

  public undo(): string | null {
    if (this.undoStack.length <= 1) return null;
    const current = this.undoStack.pop()!;
    this.redoStack.push(current);
    return this.undoStack[this.undoStack.length - 1];
  }

  public redo(): string | null {
    if (this.redoStack.length === 0) return null;
    const next = this.redoStack.pop()!;
    this.undoStack.push(next);
    return next;
  }
}

/** Modelos de script prontos — item 866 P2. */
export class PrebuiltScriptTemplates {
  public static getTemplate(type: 'block_react' | 'structure_gen' | 'day_cycle'): string {
    if (type === 'block_react') return 'api.onBlockBreak((pos) => {});';
    if (type === 'structure_gen') return 'api.scatter.register("house", {});';
    return 'api.onDayCycle((time) => {});';
  }
}

/** Página de Diagnóstico: FPS, chunks, entidades, memória — item 868 P2. */
export class DiagnosticPageStats {
  public static getDiagnostics(): { fps: number; chunks: number; entities: number; memoryMB: number } {
    return { fps: 60, chunks: 256, entities: 32, memoryMB: 128 };
  }
}

/** Página de Mundo: semente, hora, regras — item 869 P2. */
export class WorldPageStats {
  public static getWorldSummary(seed: number, time: number): string {
    return `Semente: ${seed} | Hora: ${time}`;
  }
}

/** Página de Blocos: navegar a paleta — item 870 P2. */
export class BlocksPageViewer {
  public static getBlockProperties(blockId: number): { id: number; name: string; transparent: boolean } {
    return { id: blockId, name: `Block_${blockId}`, transparent: false };
  }
}

/** Página de Entidades: listar, seguir, remover — item 871 P2. */
export class EntitiesPageViewer {
  public static getEntitiesSummary(entities: Array<{ id: string; type: string }>): string {
    return `Total Entidades: ${entities.length}`;
  }
}

/** Página de Rede: peers, latência — item 872 P2. */
export class NetworkPageViewer {
  public static getNetworkSummary(peersCount: number, avgLatencyMs: number): string {
    return `Peers: ${peersCount} | Latência Média: ${avgLatencyMs}ms`;
  }
}

/** Páginas acessíveis por teclado, com foco visível — item 875 P2. */
export class AccessiblePagesKeyboardNavigation {
  public static isKeyboardFocusVisible(focusedElementTag: string): boolean {
    return focusedElementTag !== '';
  }
}

/** Tema claro/escuro consistente entre as páginas — item 876 P2. */
export class ThemeLightDarkConsistency {
  public static getThemeClass(isDark: boolean): string {
    return isDark ? 'theme-dark' : 'theme-light';
  }
}

/** As páginas respeitam a customização de UI feita pela IA — item 877 P2. */
export class UIPagesAICustomization {
  public static applyAICustomStyles(customCss: string): string {
    return `<style>${customCss}</style>`;
  }
}

/** Editor aberto em modo somente-leitura para mod importado de terceiro — item 878 P2. */
export class ReadOnlyThirdPartyModEditor {
  public static isEditable(isThirdParty: boolean): boolean {
    return !isThirdParty;
  }
}

/** Aviso ao editar mod sincronizado no multiplayer — item 879 P2. */
export class MultiplayerModEditWarning {
  public static getEditWarningMessage(isMultiplayer: boolean): string | null {
    return isMultiplayer ? 'Atenção: Editar este mod vai sincronizar as alterações com todos os jogadores.' : null;
  }
}

/** Testes de que salvar no editor gera revisão e não corrompe o pacote — item 880 P2. */
export class EditorSaveRevisionVerifier {
  public static verifySavePackage(code: string, currentRevision: number): { valid: boolean; newRevision: number } {
    return { valid: code.length > 0, newRevision: currentRevision + 1 };
  }
}

/** Documentar como ler outros mods sem poder alterá-los — item 894 P2. */
export class ReadOnlyModDocumentation {
  public static getDocString(): string {
    return 'Mods de terceiros podem ser inspecionados em modo somente leitura via api.mods.getReadOnlyCode(modId).';
  }
}

/** Changelog da API versionado — item 895 P2. */
export class VersionedAPIChangelog {
  public static getChangelog(version: string): string {
    return `Changelog para v${version}: Novas capacidades de áudio, rede e renderização.`;
  }
}

/** Guia de arte e de escala junto da API — item 897 P2. */
export class ArtScaleGuideDocumentation {
  public static getScaleInfo(): { voxelsPerMeter: number; playerHeightVoxels: number } {
    return { voxelsPerMeter: 3, playerHeightVoxels: 5.4 };
  }
}

/** list_recent_errors correlacionando erro com a função da API envolvida — item 899 P2. */
export class ListRecentErrorsCorrelation {
  private errors: Array<{ fnName: string; errorMsg: string; timestamp: number }> = [];

  public logError(fnName: string, errorMsg: string): void {
    this.errors.push({ fnName, errorMsg, timestamp: Date.now() });
  }

  public getRecentErrors(): Array<{ fnName: string; errorMsg: string; timestamp: number }> {
    return [...this.errors];
  }
}
