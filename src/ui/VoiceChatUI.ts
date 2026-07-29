// Indicador visual de voz ativa em participantes de fala — itens 1548 P2 & 1500 P3.
import { icone } from './icons';

export interface SpeakerState {
  id: string;
  name: string;
  isSpeaking: boolean;
  audioLevel: number;
}

export class VoiceChatUI {
  private speakers = new Map<string, SpeakerState>();

  public setSpeakerState(id: string, name: string, isSpeaking: boolean, audioLevel = 0.5): void {
    this.speakers.set(id, { id, name, isSpeaking, audioLevel });
  }

  public getActiveSpeakers(): SpeakerState[] {
    return Array.from(this.speakers.values()).filter((s) => s.isSpeaking);
  }

  public renderSpeakerBadge(speaker: SpeakerState): string {
    if (!speaker.isSpeaking) return '';
    return `<span style="display:inline-flex; align-items:center; gap:4px; color:#4ade80; font-size:11px; font-weight:700;">
      ${icone('chat', 14)} <span style="animation: pulse 1s infinite;">falando...</span>
    </span>`;
  }
}
