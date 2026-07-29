// Cliente do relay de sinalização ("Crom"). O relay NUNCA vê dados de jogo —
// só troca de SDP/ICE entre host e peer, e um diretório simples de salas abertas.
//
// Suporta dois transportes:
// 1. WebSocket: para comunicação via servidor relay (padrão: ws://localhost:8787).
// 2. BroadcastChannel: para comunicação 100% client-side entre abas do mesmo navegador.
import type { OnlineWorldEntry } from '../ui/MainMenu';

export type SignalKind = 'offer' | 'answer' | 'ice-candidate';

export interface SignalEnvelope {
  kind: SignalKind;
  from: string;
  to: string;
  data: any;
}

export const DEFAULT_RELAY_URL = 'ws://localhost:8787';
const BROADCAST_CHANNEL_NAME = 'crom-planebox-local-relay';

export class SignalingClient {
  private ws: WebSocket | null = null;
  private bc: BroadcastChannel | null = null;
  private relayUrl: string | null = null;
  public clientId = `c-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  public connected = false;
  public mode: 'ws' | 'broadcast' = 'ws';
  public lastError: string | null = null;

  private hostedRoomId: string | null = null;
  private hostedWorldName: string | null = null;

  public onSignal: (env: SignalEnvelope) => void = () => {};
  public onPeerJoined: (peerId: string) => void = () => {};

  public configure(relayUrl: string | null): void {
    if (!relayUrl || relayUrl.trim() === '') {
      // Se passado vazio ou nulo, assume local BroadcastChannel por padrão se nada for especificado
      this.relayUrl = null;
    } else {
      this.relayUrl = relayUrl.trim();
    }
  }

  public isConfigured(): boolean {
    return true; // Sempre configurado: pode rodar local (BroadcastChannel) ou via relay (ws://)
  }

  public getEffectiveUrl(): string {
    if (this.relayUrl === 'local') return 'local';
    return this.relayUrl || DEFAULT_RELAY_URL;
  }

  public connect(forceLocal = false): Promise<boolean> {
    this.lastError = null;
    const targetUrl = forceLocal ? 'local' : this.getEffectiveUrl();

    if (targetUrl === 'local') {
      return this.connectBroadcastChannel();
    }

    return this.connectWebSocket(targetUrl);
  }

  private connectBroadcastChannel(): Promise<boolean> {
    this.mode = 'broadcast';
    this.disconnect();

    if (typeof BroadcastChannel === 'undefined') {
      this.lastError = 'BroadcastChannel não é suportado neste navegador.';
      return Promise.resolve(false);
    }

    try {
      this.bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      this.connected = true;

      this.bc.onmessage = (ev) => {
        try {
          const msg = ev.data;
          if (!msg || typeof msg !== 'object') return;

          // Responder a listagens de sala se formos o host
          if (msg.op === 'list-rooms-req' && this.hostedRoomId) {
            this.bc?.postMessage({
              op: 'room-announced',
              roomId: this.hostedRoomId,
              name: this.hostedWorldName,
              hostId: this.clientId,
              players: 1,
            });
          } else if (msg.op === 'join-room' && msg.roomId === this.hostedRoomId && msg.clientId !== this.clientId) {
            this.onPeerJoined(msg.clientId);
          } else if (msg.op === 'signal' && msg.to === this.clientId) {
            this.onSignal({ kind: msg.kind, from: msg.from, to: msg.to, data: msg.data });
          }
        } catch { /* ignora mensagens malformadas */ }
      };

      return Promise.resolve(true);
    } catch (err: any) {
      this.lastError = `Erro ao abrir BroadcastChannel: ${err?.message || err}`;
      return Promise.resolve(false);
    }
  }

  private connectWebSocket(url: string): Promise<boolean> {
    this.mode = 'ws';
    this.disconnect();

    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(url);

        const timeout = setTimeout(() => {
          if (!this.connected) {
            this.disconnect();
            this.lastError = `Servidor de relay não respondeu em ${url}. Certifique-se de executar 'npm run relay' ou use o modo Local.`;
            resolve(false);
          }
        }, 3500);

        this.ws.onopen = () => {
          clearTimeout(timeout);
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

        this.ws.onclose = () => {
          this.connected = false;
        };

        this.ws.onerror = () => {
          clearTimeout(timeout);
          this.connected = false;
          this.lastError = `Não foi possível conectar ao relay em ${url}. Execute 'npm run relay' no terminal ou altere para o modo Local.`;
          resolve(false);
        };
      } catch (err: any) {
        this.connected = false;
        this.lastError = `Erro ao conectar: ${err?.message || err}`;
        resolve(false);
      }
    });
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    if (this.bc) {
      this.bc.onmessage = null;
      this.bc.close();
      this.bc = null;
    }
    this.connected = false;
    this.hostedRoomId = null;
    this.hostedWorldName = null;
  }

  public async createRoom(worldName: string): Promise<string | null> {
    if (!this.connected) return null;
    const roomId = `room-${Math.random().toString(36).slice(2, 9)}`;
    this.hostedRoomId = roomId;
    this.hostedWorldName = worldName;

    if (this.mode === 'ws' && this.ws) {
      this.ws.send(JSON.stringify({ op: 'create-room', roomId, name: worldName, hostId: this.clientId }));
    } else if (this.mode === 'broadcast' && this.bc) {
      this.bc.postMessage({ op: 'room-announced', roomId, name: worldName, hostId: this.clientId, players: 1 });
    }

    return roomId;
  }

  public closeRoom(roomId: string): void {
    if (this.mode === 'ws' && this.ws) {
      this.ws.send(JSON.stringify({ op: 'close-room', roomId }));
    } else if (this.mode === 'broadcast' && this.bc) {
      this.bc.postMessage({ op: 'close-room', roomId });
    }
    if (this.hostedRoomId === roomId) {
      this.hostedRoomId = null;
      this.hostedWorldName = null;
    }
  }

  public announceJoin(roomId: string): void {
    if (this.mode === 'ws' && this.ws) {
      this.ws.send(JSON.stringify({ op: 'join-room', roomId, clientId: this.clientId }));
    } else if (this.mode === 'broadcast' && this.bc) {
      this.bc.postMessage({ op: 'join-room', roomId, clientId: this.clientId });
    }
  }

  public sendSignal(env: SignalEnvelope): void {
    if (this.mode === 'ws' && this.ws) {
      this.ws.send(JSON.stringify({ op: 'signal', ...env }));
    } else if (this.mode === 'broadcast' && this.bc) {
      this.bc.postMessage({ op: 'signal', ...env });
    }
  }

  public async listRooms(): Promise<OnlineWorldEntry[]> {
    if (this.mode === 'broadcast' && this.bc) {
      const bcRef = this.bc;
      return new Promise((resolve) => {
        const rooms: OnlineWorldEntry[] = [];
        const handler = (ev: MessageEvent) => {
          const msg = ev.data;
          if (msg && msg.op === 'room-announced') {
            if (!rooms.some((r) => r.roomId === msg.roomId)) {
              rooms.push({
                roomId: msg.roomId,
                name: msg.name,
                playerCount: msg.players || 1,
              });
            }
          }
        };

        const prevHandler = bcRef.onmessage;
        bcRef.onmessage = (ev) => {
          if (prevHandler) prevHandler.call(bcRef, ev);
          handler(ev);
        };

        bcRef.postMessage({ op: 'list-rooms-req' });

        setTimeout(() => {
          if (this.bc) this.bc.onmessage = prevHandler;
          resolve(rooms);
        }, 150);
      });
    }

    const targetUrl = this.getEffectiveUrl();
    if (targetUrl === 'local') return [];

    try {
      const httpUrl = targetUrl.replace(/^ws/, 'http').replace(/\/ws\/?$/, '') + '/rooms';
      const res = await fetch(httpUrl);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
}

/** Relay de sinalização nunca recebendo dados de mundo (teste/verificação) — item 373 P2. */
export class SignalingPrivacyCheck {
  public static verifySignalOnlyPayload(payload: Record<string, unknown>): boolean {
    const allowedKeys = new Set(['kind', 'from', 'to', 'data', 'op', 'sdp', 'candidate', 'roomId', 'worldName']);
    for (const key of Object.keys(payload)) {
      if (!allowedKeys.has(key)) return false; // Bloqueia se contiver dados de blocos do mundo
    }
    return true;
  }
}
