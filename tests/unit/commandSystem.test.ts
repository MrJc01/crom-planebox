import { describe, it, expect, vi } from 'vitest';
import { CommandSystem, CommandContext, KnownPlayer } from '../../src/commands/CommandSystem';

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
  const players: KnownPlayer[] = [{ id: 'local', name: 'Você', isOp: true }];
  return {
    callerId: 'local',
    callerIsOp: true,
    isHost: true,
    gameModeManager: { setMode: vi.fn(), mode: 'classic' } as any,
    player: { pos: { set: vi.fn() }, vel: { set: vi.fn() } } as any,
    listPlayers: () => players,
    setOp: vi.fn(() => true),
    setGameMode: vi.fn(() => true),
    kick: vi.fn(() => true),
    connectCrom: vi.fn(async () => 'room-123'),
    disconnectCrom: vi.fn(),
    ...overrides,
  };
}

describe('CommandSystem', () => {
  const cmd = new CommandSystem();

  it('CommandSystem.isCommand só reconhece texto começando com "/"', () => {
    expect(CommandSystem.isCommand('/help')).toBe(true);
    expect(CommandSystem.isCommand('olá mundo')).toBe(false);
  });

  it('autocomplete filtra pelo prefixo digitado', () => {
    expect(CommandSystem.autocomplete('/g')).toContain('/gamemode');
    expect(CommandSystem.autocomplete('/g')).not.toContain('/kick');
  });

  it('/help sempre funciona, mesmo sem OP', async () => {
    const ctx = makeContext({ callerIsOp: false });
    const res = await cmd.execute('/help', ctx);
    expect(res.ok).toBe(true);
    expect(res.message).toContain('/gamemode');
  });

  it('/op sem OP é negado', async () => {
    const ctx = makeContext({ callerIsOp: false });
    const res = await cmd.execute('/op Fulano', ctx);
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/permiss/i);
  });

  it('/op com OP concede e chama setOp', async () => {
    const ctx = makeContext({ callerIsOp: true });
    const res = await cmd.execute('/op Fulano', ctx);
    expect(res.ok).toBe(true);
    expect(ctx.setOp).toHaveBeenCalledWith('Fulano', true);
  });

  it('/gamemode no próprio jogador não exige OP', async () => {
    const ctx = makeContext({ callerIsOp: false, callerId: 'local' });
    const res = await cmd.execute('/gamemode survival', ctx);
    expect(res.ok).toBe(true);
    expect(ctx.setGameMode).toHaveBeenCalledWith(null, 'survival');
  });

  it('/gamemode em outro jogador exige OP', async () => {
    const ctx = makeContext({ callerIsOp: false });
    const res = await cmd.execute('/gamemode survival OutroJogador', ctx);
    expect(res.ok).toBe(false);
  });

  it('/tp sempre permitido (teleporte do próprio jogador)', async () => {
    const ctx = makeContext({ callerIsOp: false });
    const res = await cmd.execute('/tp 10 20 30', ctx);
    expect(res.ok).toBe(true);
    expect(ctx.player.pos.set).toHaveBeenCalledWith(10, 20, 30);
  });

  it('/crom conectar sem OP é negado', async () => {
    const ctx = makeContext({ callerIsOp: false });
    const res = await cmd.execute('/crom conectar', ctx);
    expect(res.ok).toBe(false);
  });

  it('/crom conectar com OP chama connectCrom', async () => {
    const ctx = makeContext({ callerIsOp: true });
    const res = await cmd.execute('/crom conectar', ctx);
    expect(res.ok).toBe(true);
    expect(ctx.connectCrom).toHaveBeenCalled();
  });

  it('comando desconhecido devolve erro amigável', async () => {
    const ctx = makeContext();
    const res = await cmd.execute('/voa-la-pipoca', ctx);
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/desconhecido/i);
  });
});
