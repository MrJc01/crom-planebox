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
}

export interface CommandResult {
  ok: boolean;
  message: string;
}

const COMMAND_NAMES = ['op', 'deop', 'gamemode', 'kick', 'tp', 'crom', 'help'];

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
      case 'help': {
        return {
          ok: true,
          message: [
            '/op <jogador> — concede OP (requer OP)',
            '/deop <jogador> — revoga OP (requer OP)',
            '/gamemode <1-5|classic|survival|ghost|creative|adventure> [jogador] — troca modo de jogo (requer OP para afetar outros)',
            '/kick <jogador> — desconecta um peer (requer OP)',
            '/tp <x> <y> <z> — teleporta você mesmo',
            '/crom conectar | /crom desconectar — liga/desliga a sala P2P deste mundo',
            '/help — esta lista',
          ].join('\n'),
        };
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
        return { ok: false, message: `Comando desconhecido: '/${cmd}'. Use /help.` };
    }
  }
}
