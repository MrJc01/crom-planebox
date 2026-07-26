import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignalingClient, DEFAULT_RELAY_URL } from '../../src/net/SignalingClient';
import { PeerSync } from '../../src/net/PeerSync';

describe('SignalingClient & PeerSync (Multijogador & Local Transport)', () => {
  let signaling: SignalingClient;
  let peerSync: PeerSync;

  beforeEach(() => {
    signaling = new SignalingClient();
    peerSync = new PeerSync(signaling);
  });

  afterEach(() => {
    peerSync.stop();
    signaling.disconnect();
  });

  it('deve usar o URL padrão ws://localhost:8787 se nada for configurado', () => {
    signaling.configure(null);
    expect(signaling.getEffectiveUrl()).toBe(DEFAULT_RELAY_URL);
  });

  it('deve alternar para modo BroadcastChannel ao configurar "local"', async () => {
    // Mock simples de BroadcastChannel se não existir no ambiente Node/jsdom
    if (typeof global.BroadcastChannel === 'undefined') {
      const listeners: ((ev: any) => void)[] = [];
      (global as any).BroadcastChannel = class {
        onmessage: ((ev: any) => void) | null = null;
        constructor(public name: string) {
          listeners.push((ev) => this.onmessage?.(ev));
        }
        postMessage(data: any) {
          setTimeout(() => {
            listeners.forEach((l) => l({ data }));
          }, 0);
        }
        close() {}
      };
    }

    signaling.configure('local');
    const ok = await signaling.connect();
    expect(ok).toBe(true);
    expect(signaling.mode).toBe('broadcast');
    expect(signaling.connected).toBe(true);
  });

  it('deve criar e armazenar nome da sala no modo BroadcastChannel local', async () => {
    if (typeof global.BroadcastChannel === 'undefined') {
      const listeners: ((ev: any) => void)[] = [];
      (global as any).BroadcastChannel = class {
        onmessage: ((ev: any) => void) | null = null;
        constructor(public name: string) {
          listeners.push((ev) => this.onmessage?.(ev));
        }
        postMessage(data: any) {
          setTimeout(() => {
            listeners.forEach((l) => l({ data }));
          }, 0);
        }
        close() {}
      };
    }

    signaling.configure('local');
    await signaling.connect();

    const roomId = await signaling.createRoom('Mundo de Teste Local');
    expect(roomId).toBeTruthy();
    expect(roomId).toMatch(/^room-/);
  });

  it('deve lidar com falta de RTCPeerConnection no ambiente sem quebrar', async () => {
    // Mock de RTCPeerConnection se ausente no ambiente de teste jsdom
    if (typeof global.RTCPeerConnection === 'undefined') {
      (global as any).RTCPeerConnection = class {
        localDescription = { sdp: 'mock-sdp', type: 'offer' };
        createOffer() { return Promise.resolve(this.localDescription); }
        createAnswer() { return Promise.resolve({ sdp: 'mock-answer', type: 'answer' }); }
        setLocalDescription() { return Promise.resolve(); }
        setRemoteDescription() { return Promise.resolve(); }
        createDataChannel() {
          return {
            readyState: 'open',
            send() {},
            close() {},
            onopen: null,
            onmessage: null,
          };
        }
        close() {}
      };
    }

    const offerToken = await peerSync.createManualOfferToken();
    expect(offerToken).toBeTruthy();
    expect(typeof offerToken).toBe('string');

    const guestPeerSync = new PeerSync(new SignalingClient());
    const answerToken = await guestPeerSync.acceptManualOfferToken(offerToken);
    expect(answerToken).toBeTruthy();
    expect(typeof answerToken).toBe('string');

    const accepted = await peerSync.acceptManualAnswerToken(answerToken);
    expect(accepted).toBe(true);
  });
});
