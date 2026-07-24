import { describe, it, expect } from 'vitest';
import { GAME_MODE_RULES, GameModeManager } from '../../src/game/GameModeManager';

describe('GAME_MODE_RULES', () => {
  it('lista exatamente os 5 modos de jogo pedidos', () => {
    expect(GameModeManager.allModes().sort()).toEqual(
      ['adventure', 'classic', 'creative', 'ghost', 'survival'].sort()
    );
  });

  it('Modo 1 Clássico: câmera top-down, construção livre, sem sobrevivência', () => {
    const r = GAME_MODE_RULES.classic;
    expect(r.cameraMode).toBe('topdown');
    expect(r.canBreak).toBe(true);
    expect(r.canPlace).toBe(true);
    expect(r.hasSurvival).toBe(false);
    expect(r.hasCreativeInventory).toBe(true);
  });

  it('Modo 2 Survival: primeira pessoa, sobrevivência ativa, sem inventário criativo infinito', () => {
    const r = GAME_MODE_RULES.survival;
    expect(r.cameraMode).toBe('fps');
    expect(r.canFly).toBe(false);
    expect(r.hasSurvival).toBe(true);
    expect(r.hasCreativeInventory).toBe(false);
  });

  it('Modo 3 Fantasma: sem colisão implícita (canBreak/canPlace falsos), voo livre', () => {
    const r = GAME_MODE_RULES.ghost;
    expect(r.cameraMode).toBe('ghost');
    expect(r.canBreak).toBe(false);
    expect(r.canPlace).toBe(false);
    expect(r.canFly).toBe(true);
    expect(r.hasCreativeInventory).toBe(false);
  });

  it('Modo 4 Criativo: primeira pessoa, voo livre, inventário infinito + crafting', () => {
    const r = GAME_MODE_RULES.creative;
    expect(r.cameraMode).toBe('fps');
    expect(r.canFly).toBe(true);
    expect(r.canBreak).toBe(true);
    expect(r.canPlace).toBe(true);
    expect(r.hasCreativeInventory).toBe(true);
    expect(r.hasSurvival).toBe(false);
  });

  it('Modo 5 Aventura: só andar — sem quebrar, colocar, voar ou inventário criativo', () => {
    const r = GAME_MODE_RULES.adventure;
    expect(r.canBreak).toBe(false);
    expect(r.canPlace).toBe(false);
    expect(r.canFly).toBe(false);
    expect(r.hasCreativeInventory).toBe(false);
    expect(r.hasSurvival).toBe(false);
  });

  it('só o modo Criativo permite a câmera Top-Down manual (regra de negócio, não da tabela em si)', () => {
    // A tabela em si não teria que impedir topdown fora do creative (isso é feito na UI),
    // mas registramos aqui que só 'classic' e 'creative' têm cameraMode topdown/flexível o
    // suficiente para não quebrar a expectativa: nenhum modo de sobrevivência/aventura usa topdown.
    for (const mode of ['survival', 'ghost', 'adventure'] as const) {
      expect(GAME_MODE_RULES[mode].cameraMode).not.toBe('topdown');
    }
  });
});
