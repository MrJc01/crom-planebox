// Gerenciador dos 5 modos de jogo pedidos pelo usuário. Diferente do CameraManager
// (que só troca a câmera), este módulo troca REGRAS de jogo: o que o jogador pode
// fazer, não só o que ele vê.
import { CameraManager } from '../engine/CameraManager';
import { PlayerController } from '../player/controller';
import type { GameMode } from '../storage/Database';

export type { GameMode };

export interface GameModeRules {
  cameraMode: 'topdown' | 'fps' | 'ghost';
  canBreak: boolean;
  canPlace: boolean;
  canFly: boolean;
  hasSurvival: boolean;
  hasCreativeInventory: boolean; // inventário infinito + crafting 6x6
  label: string;
}

export const GAME_MODE_RULES: Record<GameMode, GameModeRules> = {
  classic: { cameraMode: 'topdown', canBreak: true, canPlace: true, canFly: true, hasSurvival: false, hasCreativeInventory: true, label: '1 · Clássico (atual)' },
  survival: { cameraMode: 'fps', canBreak: true, canPlace: true, canFly: false, hasSurvival: true, hasCreativeInventory: false, label: '2 · Sobrevivência (1ª pessoa)' },
  ghost: { cameraMode: 'ghost', canBreak: false, canPlace: false, canFly: true, hasSurvival: false, hasCreativeInventory: false, label: '3 · Fantasma / Voando (1ª pessoa)' },
  creative: { cameraMode: 'fps', canBreak: true, canPlace: true, canFly: true, hasSurvival: false, hasCreativeInventory: true, label: '4 · Criativo + Crafting (1ª pessoa)' },
  adventure: { cameraMode: 'fps', canBreak: false, canPlace: false, canFly: false, hasSurvival: false, hasCreativeInventory: false, label: '5 · Aventura — só andar (visitantes)' },
};

export class GameModeManager {
  public mode: GameMode = 'classic';
  public onModeChanged: (mode: GameMode) => void = () => {};

  constructor(private cameraManager: CameraManager, private player: PlayerController) {}

  public get rules(): GameModeRules {
    return GAME_MODE_RULES[this.mode];
  }

  public setMode(mode: GameMode, opts: { silent?: boolean } = {}): void {
    this.mode = mode;
    const r = GAME_MODE_RULES[mode];
    this.cameraManager.setMode(r.cameraMode);

    // CameraManager já ajusta flying/noclip para topdown/ghost/fps; no Criativo (fps + voo
    // permitido) reabilitamos o voo explicitamente, já que 'fps' por padrão desativa os dois.
    if (mode === 'creative') {
      this.player.flying = true;
      this.player.noclip = false;
    }

    if (!opts.silent) this.onModeChanged(mode);
  }

  public static allModes(): GameMode[] {
    return ['classic', 'survival', 'ghost', 'creative', 'adventure'];
  }
}
