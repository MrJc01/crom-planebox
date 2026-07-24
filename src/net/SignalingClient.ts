// Cliente do relay mínimo de sinalização ("Crom"). O relay NUNCA vê dados de jogo —
// só troca de SDP/ICE entre host e peer, e um diretório simples de salas abertas
// (nome, id, nº de jogadores) para a listagem "Mundos Online" do MainMenu.
// Sem `relayUrl` configurada, o cliente funciona como no-op (mundo 100% local).
import type { OnlineWorldEntry } from '../ui/MainMenu';

export type SignalKind = 'offer' | 'answer' | 'ice-candidate';

export interface SignalEnvelope {
  kind: SignalKind;
  from: string;
  to: string;
  data: any;
}

export class SignalingClient {
  private ws: WebSocket | null = null;
  private relayUrl: string | null = null;
  public clientId = `c-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  public connected = false;

  public onSignal: (env: SignalEnvelope) => void = () => {};
  public onPeerJoined: (peerId: string) => void = () => {};

  public configure(relayUrl: string | null): void {
    this.relayUrl = relayUrl;
  }

  public isConfigured(): boolean {
    return !!this.relayUrl;
  }

  public connect(): Promise<boolean> {
    if (!this.relayUrl) return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.relayUrl!);
        this.ws.onopen = () => {
          this.connected = true;
          this.ws!.send(JSON.stringify({ op: 'hello', clientId: this.clientId }));
          resolve(true);
        };
        this.ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.op === 'signal') {
              this.onSignal({ kind: msg.kind, from: msg.from, to: msg.to, data: msg.data });
            } else if (msg.op === 'peer-joined') {
              this.onPeerJoined(msg.peerId);
            }
          } catch { /* mensagem malformada do relay: ignora */ }
        };
        this.ws.onclose = () => { this.connected = false; };
        this.ws.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  public disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  public async createRoom(worldName: string): Promise<string | null> {
    if (!this.connected || !this.ws) return null;
    const roomId = `room-${Math.random().toString(36).slice(2, 9)}`;
    this.ws.send(JSON.stringify({ op: 'create-room', roomId, name: worldName, hostId: this.clientId }));
    return roomId;
  }

  public closeRoom(roomId: string): void {
    this.ws?.send(JSON.stringify({ op: 'close-room', roomId }));
  }

  public announceJoin(roomId: string): void {
    this.ws?.send(JSON.stringify({ op: 'join-room', roomId, clientId: this.clientId }));
  }

  public sendSignal(env: SignalEnvelope): void {
    this.ws?.send(JSON.stringify({ op: 'signal', ...env }));
  }

  public async listRooms(): Promise<OnlineWorldEntry[]> {
    if (!this.relayUrl) return [];
    try {
      const httpUrl = this.relayUrl.replace(/^ws/, 'http').replace(/\/ws\/?$/, '') + '/rooms';
      const res = await fetch(httpUrl);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
}
