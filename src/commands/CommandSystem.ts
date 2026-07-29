// Parser de comandos de barra para o Chat do Mundo (Minecraft-like). O dono do mundo
// (host) é sempre OP por padrão; comandos sensíveis exigem OP e, quando vêm de um
// peer remoto, DEVEM ser validados aqui no host antes de qualquer efeito no mundo.
import { GameModeManager } from '../game/GameModeManager';
import { PlayerController } from '../player/controller';
import type { GameMode } from '../storage/Database';

export interface KnownPlayer {
  id: string;
  name: string;
  isOp: boolean;
}

export interface CommandContext {
  callerId: string;
  callerIsOp: boolean;
  isHost: boolean;
  gameModeManager: GameModeManager;
  player: PlayerController;
  listPlayers: () => KnownPlayer[];
  setOp: (playerIdOrName: string, isOp: boolean) => boolean;
  setGameMode: (playerIdOrName: string | null, mode: GameMode) => boolean;
  kick: (playerIdOrName: string) => boolean;
  connectCrom: () => Promise<string | null>;
  disconnectCrom: () => void;
  seed?: number | string;
  grantItem?: (blockOrName: number | string, count: number) => boolean;
  setWeather?: (weather: string) => boolean;
  getWeather?: () => string;
}

export interface CommandResult {
  ok: boolean;
  message: string;
}

const COMMAND_NAMES = [
  'op', 'deop', 'gamemode', 'kick', 'tp', 'crom',
  'clima', 'weather', 'seed', 'coords', 'list', 'give', 'help', 'ajuda',
  'time', 'spawn', 'clear'
];

interface CommandDef {
  name: string;
  usage: string;
  description: string;
  requireOp?: boolean;
}

const COMMAND_DOCS: CommandDef[] = [
  { name: 'op', usage: '/op <jogador>', description: 'Concede privilégio OP a um jogador', requireOp: true },
  { name: 'deop', usage: '/deop <jogador>', description: 'Revoga privilégio OP de um jogador', requireOp: true },
  { name: 'gamemode', usage: '/gamemode <1-5|modo> [jogador]', description: 'Troca o modo de jogo (classic, survival, ghost, creative, adventure)' },
  { name: 'kick', usage: '/kick <jogador>', description: 'Desconecta um jogador (requer OP)', requireOp: true },
  { name: 'tp', usage: '/tp <x> <y> <z>', description: 'Teleporta você mesmo para as coordenadas XYZ' },
  { name: 'clima', usage: '/clima <limpo|chuva|tempestade|neve>', description: 'Altera o clima do mundo (requer OP)', requireOp: true },
  { name: 'weather', usage: '/weather <clear|rain|storm|snow>', description: 'Altera o clima do mundo (requer OP)', requireOp: true },
  { name: 'time', usage: '/time <day|night|dia|noite>', description: 'Altera o ciclo solar entre dia e noite' },
  { name: 'spawn', usage: '/spawn', description: 'Teleporta o jogador de volta para o ponto inicial de spawn' },
  { name: 'clear', usage: '/clear', description: 'Limpa os itens da barra do jogador' },
  { name: 'seed', usage: '/seed', description: 'Exibe a semente do mundo atual' },
  { name: 'coords', usage: '/coords', description: 'Exibe sua posição atual (X, Y, Z)' },
  { name: 'list', usage: '/list', description: 'Lista os jogadores conectados no mundo' },
  { name: 'give', usage: '/give <bloco|item> [quantidade]', description: 'Adiciona blocos/itens ao seu inventário' },
  { name: 'crom', usage: '/crom conectar | /crom desconectar', description: 'Liga ou desliga a sala P2P deste mundo' },
  { name: 'help', usage: '/help ou /ajuda', description: 'Exibe esta lista de comandos' },
];

export class CommandSystem {
  public static isCommand(text: string): boolean {
    return text.trim().startsWith('/');
  }

  public static autocomplete(partial: string): string[] {
    const word = partial.replace(/^\//, '').toLowerCase();
    return COMMAND_NAMES.filter((c) => c.startsWith(word)).map((c) => `/${c}`);
  }

  public async execute(raw: string, ctx: CommandContext): Promise<CommandResult> {
    const parts = raw.trim().replace(/^\//, '').split(/\s+/);
    const cmd = (parts.shift() || '').toLowerCase();

    const requireOp = (): CommandResult | null => {
      if (!ctx.callerIsOp) return { ok: false, message: `Sem permissão: '/${cmd}' exige OP.` };
      return null;
    };

    switch (cmd) {
      case 'ajuda':
      case 'help': {
        const lines = COMMAND_DOCS.map((doc) => `${doc.usage} — ${doc.description}`);
        return { ok: true, message: lines.join('\n') };
      }

      case 'op': {
        const denied = requireOp(); if (denied) return denied;
        const target = parts[0];
        if (!target) return { ok: false, message: 'Uso: /op <jogador>' };
        const done = ctx.setOp(target, true);
        return done ? { ok: true, message: `${target} agora é OP.` } : { ok: false, message: `Jogador '${target}' não encontrado.` };
      }

      case 'deop': {
        const denied = requireOp(); if (denied) return denied;
        const target = parts[0];
        if (!target) return { ok: false, message: 'Uso: /deop <jogador>' };
        const done = ctx.setOp(target, false);
        return done ? { ok: true, message: `${target} não é mais OP.` } : { ok: false, message: `Jogador '${target}' não encontrado.` };
      }

      case 'gamemode': {
        const modeArg = (parts[0] || '').toLowerCase();
        const targetArg = parts[1] || null;
        const modeMap: Record<string, GameMode> = {
          '1': 'classic', 'classic': 'classic', 'classico': 'classic',
          '2': 'survival', 'survival': 'survival', 'sobrevivencia': 'survival',
          '3': 'ghost', 'ghost': 'ghost', 'fantasma': 'ghost',
          '4': 'creative', 'creative': 'creative', 'criativo': 'creative',
          '5': 'adventure', 'adventure': 'adventure', 'aventura': 'adventure',
        };
        const mode = modeMap[modeArg];
        if (!mode) return { ok: false, message: 'Uso: /gamemode <1-5|classic|survival|ghost|creative|adventure> [jogador]' };
        if (targetArg && targetArg !== ctx.callerId) {
          const denied = requireOp(); if (denied) return denied;
        }
        const done = ctx.setGameMode(targetArg, mode);
        return done ? { ok: true, message: `Modo de jogo alterado para ${mode}.` } : { ok: false, message: 'Falha ao trocar modo de jogo.' };
      }

      case 'kick': {
        const denied = requireOp(); if (denied) return denied;
        const target = parts[0];
        if (!target) return { ok: false, message: 'Uso: /kick <jogador>' };
        const done = ctx.kick(target);
        return done ? { ok: true, message: `${target} foi removido do mundo.` } : { ok: false, message: `Jogador '${target}' não encontrado.` };
      }

      case 'tp': {
        if (parts.length < 3) return { ok: false, message: 'Uso: /tp <x> <y> <z>' };
        const [x, y, z] = parts.map(Number);
        if ([x, y, z].some((n) => isNaN(n))) return { ok: false, message: 'Coordenadas inválidas.' };
        ctx.player.pos.set(x, y, z);
        ctx.player.vel.set(0, 0, 0);
        return { ok: true, message: `Teleportado para (${x}, ${y}, ${z}).` };
      }

      case 'clima':
      case 'weather': {
        const denied = requireOp(); if (denied) return denied;
        const targetWeather = parts[0];
        if (!targetWeather) {
          const actual = ctx.getWeather?.() || 'desconhecido';
          return { ok: true, message: `Clima atual: ${actual}. Uso: /clima <limpo|chuva|tempestade|neve>` };
        }
        const ok = ctx.setWeather?.(targetWeather);
        return ok
          ? { ok: true, message: `Clima alterado para '${targetWeather}'.` }
          : { ok: false, message: `Clima '${targetWeather}' inválido ou indisponível.` };
      }

      case 'seed': {
        const seedVal = ctx.seed ?? 'desconhecida';
        return { ok: true, message: `Semente do mundo: ${seedVal}` };
      }

      case 'coords': {
        const { x, y, z } = ctx.player.pos;
        return { ok: true, message: `Posição: (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})` };
      }

      case 'list': {
        const players = ctx.listPlayers();
        const names = players.map((p) => `${p.name}${p.isOp ? ' (OP)' : ''}`).join(', ');
        return { ok: true, message: `Jogadores (${players.length}): ${names || 'nenhum'}` };
      }

      case 'give': {
        const targetItem = parts[0];
        const count = Math.max(1, parseInt(parts[1] || '1', 10) || 1);
        if (!targetItem) return { ok: false, message: 'Uso: /give <bloco|item> [quantidade]' };
        const ok = ctx.grantItem?.(targetItem, count);
        return ok
          ? { ok: true, message: `Concedido ${count}x '${targetItem}'.` }
          : { ok: false, message: `Item/bloco '${targetItem}' não encontrado ou inventário cheio.` };
      }

      case 'crom': {
        const sub = (parts[0] || '').toLowerCase();
        if (sub === 'conectar') {
          const denied = requireOp(); if (denied) return denied;
          const roomId = await ctx.connectCrom();
          return roomId
            ? { ok: true, message: `Conectado à Crom! Sala: ${roomId}` }
            : { ok: false, message: 'Não foi possível conectar (relay não configurado ou indisponível).' };
        }
        if (sub === 'desconectar') {
          const denied = requireOp(); if (denied) return denied;
          ctx.disconnectCrom();
          return { ok: true, message: 'Desconectado da Crom. O mundo voltou a ser 100% local.' };
        }
        return { ok: false, message: 'Uso: /crom conectar | /crom desconectar' };
      }

      default:
        return { ok: false, message: `Comando desconhecido: '/${cmd}'. Use /help ou /ajuda.` };
    }
  }
}

/**
 * Planejador multi-etapa explícito — item 340 P1.
 * A IA declara o plano antes de executar; cada etapa pode ser aprovada ou rejeitada.
 */
export interface AIPlanStep {
  id: number;
  description: string;
  estimatedBlocks: number;
  approved: boolean;
}

export function createAIPlan(steps: Array<{ description: string; estimatedBlocks: number }>): AIPlanStep[] {
  return steps.map((s, i) => ({
    id: i + 1,
    description: s.description,
    estimatedBlocks: s.estimatedBlocks,
    approved: false,
  }));
}

export function approveStep(plan: AIPlanStep[], stepId: number): boolean {
  const step = plan.find(s => s.id === stepId);
  if (!step) return false;
  step.approved = true;
  return true;
}

/**
 * Ferramenta de dry-run — item 341 P1.
 * Simula a modificação e reporta o impacto sem aplicar.
 */
export interface DryRunResult {
  blocksPlaced: number;
  blocksRemoved: number;
  affectedChunks: number;
  estimatedTimeMs: number;
  safe: boolean;
  warnings: string[];
}

export function dryRunBuild(
  blocksToPlace: number,
  blocksToRemove: number,
  maxBlocksPerOp = 10000,
): DryRunResult {
  const warnings: string[] = [];
  const total = blocksToPlace + blocksToRemove;
  if (total > maxBlocksPerOp) {
    warnings.push(`Operação excede o limite de ${maxBlocksPerOp} blocos (${total}).`);
  }
  const affectedChunks = Math.ceil(total / 512); // ~512 blocos por chunk em média
  const estimatedTimeMs = total * 0.05; // ~0.05ms por bloco
  return {
    blocksPlaced: blocksToPlace,
    blocksRemoved: blocksToRemove,
    affectedChunks,
    estimatedTimeMs,
    safe: warnings.length === 0,
    warnings,
  };
}

/**
 * Limite de iterações além do limite de tempo — item 360 P1.
 */
export function checkIterationLimit(current: number, max: number): { exceeded: boolean; remaining: number } {
  return { exceeded: current >= max, remaining: Math.max(0, max - current) };
}

/**
 * Limite de memória/blocos por script — item 361 P1.
 */
export function checkMemoryLimit(
  blocksUsed: number,
  maxBlocks: number,
): { exceeded: boolean; usagePercent: number; remaining: number } {
  const usagePercent = maxBlocks > 0 ? (blocksUsed / maxBlocks) * 100 : 100;
  return {
    exceeded: blocksUsed >= maxBlocks,
    usagePercent: Math.min(100, usagePercent),
    remaining: Math.max(0, maxBlocks - blocksUsed),
  };
}

/**
 * Nunca persistir chave de API em texto claro sem aviso — item 362 P1.
 * Verifica se um texto contém chaves de API expostas.
 */
export function detectExposedApiKeys(text: string): { found: boolean; patterns: string[] } {
  const patterns: string[] = [];
  // Padrões comuns de chaves de API
  const regexes = [
    { name: 'OpenAI', pattern: /sk-[a-zA-Z0-9]{20,}/ },
    { name: 'Google API', pattern: /AIza[a-zA-Z0-9_-]{35}/ },
    { name: 'AWS Access Key', pattern: /AKIA[A-Z0-9]{16}/ },
    { name: 'Generic Bearer', pattern: /bearer\s+[a-zA-Z0-9_\-./]{20,}/i },
  ];
  for (const { name, pattern } of regexes) {
    if (pattern.test(text)) patterns.push(name);
  }
  return { found: patterns.length > 0, patterns };
}
