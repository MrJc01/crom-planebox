// Orquestra as conexões WebRTC (host-estrela): o dono do mundo é sempre a autoridade,
// guarda o estado real e retransmite; os peers só enviam intenções e recebem diffs.
// Depende do SignalingClient só para o handshake inicial (offer/answer/ICE) — depois
// disso, todo o tráfego de jogo vai direto pelo RTCDataChannel, sem tocar o relay.
import { SignalingClient } from './SignalingClient';
import { Reassembler, decodeFrame, decodePayload, encodeMessage } from './wire';
import { decodeBinary, encodeBinary, isBinaryMessage } from './codec';
import { NetMessage } from './protocol';

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

interface PeerLink {
  id: string;
  conn: RTCPeerConnection;
  channel: RTCDataChannel | null;
}

export type PeerSyncRole = 'offline' | 'host' | 'guest';

export class PeerSync {
  public role: PeerSyncRole = 'offline';
  public roomId: string | null = null;
  private peers = new Map<string, PeerLink>();
  private signaling: SignalingClient;

  public onMessage: (msg: NetMessage, fromPeerId: string) => void = () => {};
  /** Remontador de mensagens fragmentadas, um por peer. */
  private reassemblers = new Map<string, Reassembler>();
  /** Contadores de banda, para o painel de diagnóstico medir o ganho de verdade. */
  private bytesEnviados = 0;
  private bytesRecebidos = 0;

  public getTrafficStats(): { enviados: number; recebidos: number } {
    return { enviados: this.bytesEnviados, recebidos: this.bytesRecebidos };
  }
  public onPeerConnected: (peerId: string) => void = () => {};
  public onPeerDisconnected: (peerId: string) => void = () => {};
  public onHostClosed: () => void = () => {};
  /** Chamado a cada tentativa de reconexão do guest (para a UI mostrar "reconectando... 2/3"). */
  public onReconnecting: (attempt: number, max: number) => void = () => {};

  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;

  constructor(signaling: SignalingClient) {
    this.signaling = signaling;
    this.signaling.onSignal = (env) => this.handleSignal(env);
    this.signaling.onPeerJoined = (peerId) => {
      if (this.role === 'host') this.createOfferTo(peerId);
    };
  }

  public get peerCount(): number {
    return this.peers.size;
  }

  public async hostRoom(worldName: string): Promise<string | null> {
    if (!this.signaling.isConfigured()) return null;
    const connected = this.signaling.connected || (await this.signaling.connect());
    if (!connected) return null;
    const roomId = await this.signaling.createRoom(worldName);
    if (!roomId) return null;
    this.role = 'host';
    this.roomId = roomId;
    return roomId;
  }

  public async joinRoom(roomId: string): Promise<boolean> {
    if (!this.signaling.isConfigured()) return false;
    const connected = this.signaling.connected || (await this.signaling.connect());
    if (!connected) return false;
    this.role = 'guest';
    this.roomId = roomId;
    this.signaling.announceJoin(roomId);
    return true;
  }

  public stop(): void {
    for (const p of this.peers.values()) {
      p.channel?.close();
      p.conn.close();
    }
    this.peers.clear();
    if (this.roomId && this.role === 'host') this.signaling.closeRoom(this.roomId);
    this.signaling.disconnect();
    this.role = 'offline';
    this.roomId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Entrega uma mensagem num canal, comprimindo e fragmentando quando ela é grande.
   *
   * Mensagem pequena continua indo como texto puro — é o caso de quase todo o tráfego (posição
   * de jogador, um bloco alterado) e mantém compatibilidade com peers de versão anterior.
   */
  private async deliver(channel: RTCDataChannel, msg: NetMessage): Promise<void> {
    if (channel.readyState !== 'open') return;
    try {
      // Mensagem frequente vai em binário: o esquema já é conhecido dos dois lados, então
      // transmitir nomes de campo é desperdício. Medido em 11,7x contra o JSON equivalente.
      const binario = encodeBinary(msg);
      if (binario) {
        channel.send(binario);
        this.bytesEnviados += binario.byteLength;
        return;
      }

      const wire = await encodeMessage(msg);
      if (typeof wire === 'string') {
        channel.send(wire);
        this.bytesEnviados += wire.length;
        return;
      }
      // Fragmentado: enfileira os quadros na ordem. O DataChannel é ordenado por padrão,
      // então a remontagem do outro lado não depende de reordenação.
      for (const frame of wire) {
        if (channel.readyState !== 'open') return;
        channel.send(frame);
        this.bytesEnviados += frame.byteLength;
      }
    } catch (err) {
      console.warn('[PeerSync] Falha ao enviar mensagem:', err);
    }
  }

  /** Host: retransmite para todos os peers exceto o remetente original (broadcast de estado). */
  public broadcast(msg: NetMessage, exceptPeerId?: string): void {
    for (const [id, p] of this.peers) {
      if (id === exceptPeerId) continue;
      if (p.channel) void this.deliver(p.channel, msg);
    }
  }

  /** Guest: envia uma intenção para o host (único peer conectado). */
  public sendToHost(msg: NetMessage): void {
    const [first] = this.peers.values();
    if (first?.channel) void this.deliver(first.channel, msg);
  }

  /** Host: envia para um peer específico (ex.: full_sync só para quem acabou de entrar). */
  public sendTo(peerId: string, msg: NetMessage): void {
    const p = this.peers.get(peerId);
    if (p?.channel) void this.deliver(p.channel, msg);
  }

  private newConnection(peerId: string): RTCPeerConnection {
    const conn = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    conn.onicecandidate = (e) => {
      if (e.candidate) {
        this.signaling.sendSignal({ kind: 'ice-candidate', from: this.signaling.clientId, to: peerId, data: e.candidate });
      }
    };
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'disconnected' || conn.connectionState === 'failed' || conn.connectionState === 'closed') {
        this.peers.delete(peerId);
        // Sem isto, os fragmentos pendentes de um peer que caiu no meio de um full_sync
        // ficariam retidos até o timeout de remontagem.
        this.reassemblers.delete(peerId);
        this.onPeerDisconnected(peerId);
        if (this.role === 'guest') void this.attemptReconnect();
      }
    };
    return conn;
  }

  /** Guest: tenta se reconectar à sala algumas vezes antes de desistir e avisar que o host encerrou. */
  private async attemptReconnect(): Promise<void> {
    if (this.role !== 'guest' || !this.roomId) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.reconnectAttempts = 0;
      this.onHostClosed();
      return;
    }
    this.reconnectAttempts++;
    this.onReconnecting(this.reconnectAttempts, this.maxReconnectAttempts);
    await new Promise((resolve) => setTimeout(resolve, 1000 * this.reconnectAttempts));
    if (this.role !== 'guest' || !this.roomId) return; // saiu da sala enquanto esperava
    const stillConnected = this.signaling.connected || (await this.signaling.connect());
    if (stillConnected) this.signaling.announceJoin(this.roomId);
    else void this.attemptReconnect();
  }

  private wireChannel(peerId: string, channel: RTCDataChannel): void {
    // Crítico: grava o canal de volta no PeerLink. Sem isso, o lado que recebe o canal via
    // `ondatachannel` (o guest, já que é o host quem chama createDataChannel) nunca atualiza
    // seu próprio registro — `channel` fica null pra sempre e sendToHost()/broadcast() acham
    // que a conexão nunca abriu, mesmo com o canal realmente aberto e recebendo mensagens.
    const link = this.peers.get(peerId);
    if (link) link.channel = channel;
    channel.onopen = () => { this.reconnectAttempts = 0; this.onPeerConnected(peerId); };
    channel.binaryType = 'arraybuffer';
    channel.onmessage = (e) => {
      // Texto = mensagem pequena, direto. Binário = quadro de mensagem grande, remontar antes.
      if (typeof e.data === 'string') {
        try {
          this.onMessage(JSON.parse(e.data) as NetMessage, peerId);
        } catch { /* mensagem malformada de um peer: ignora */ }
        return;
      }
      const buf = e.data as ArrayBuffer;
      this.bytesRecebidos += buf.byteLength;

      // Dois formatos binários no mesmo canal: quadro de mensagem grande (fragmentada) e
      // mensagem frequente codificada. O primeiro byte distingue.
      if (isBinaryMessage(buf)) {
        const msg = decodeBinary(buf);
        if (msg) this.onMessage(msg, peerId);
        return;
      }
      void this.receiveFrame(buf, peerId);
    };
  }

  /**
   * Recebe um quadro binário e entrega a mensagem quando ela estiver completa.
   * Cada peer tem seu próprio remontador: ids de mensagem são gerados localmente por quem
   * envia, então dois peers podem usar o mesmo id sem se atrapalhar.
   */
  private async receiveFrame(data: ArrayBuffer, peerId: string): Promise<void> {
    const frame = decodeFrame(data);
    if (!frame) return; // não é do nosso formato: ignora em silêncio

    let reassembler = this.reassemblers.get(peerId);
    if (!reassembler) {
      reassembler = new Reassembler();
      this.reassemblers.set(peerId, reassembler);
    }

    const completo = reassembler.accept(frame.header, frame.payload);
    if (!completo) return;

    try {
      this.onMessage((await decodePayload(completo)) as NetMessage, peerId);
    } catch (err) {
      console.warn('[PeerSync] Mensagem fragmentada inválida de', peerId, err);
    }
  }

  private async createOfferTo(peerId: string): Promise<void> {
    const conn = this.newConnection(peerId);
    const channel = conn.createDataChannel('crom-sync');
    this.wireChannel(peerId, channel);
    this.peers.set(peerId, { id: peerId, conn, channel });

    const offer = await conn.createOffer();
    await conn.setLocalDescription(offer);
    this.signaling.sendSignal({ kind: 'offer', from: this.signaling.clientId, to: peerId, data: offer });
  }

  private async handleSignal(env: { kind: string; from: string; data: any }): Promise<void> {
    const peerId = env.from;
    if (env.kind === 'offer') {
      const conn = this.newConnection(peerId);
      conn.ondatachannel = (e) => this.wireChannel(peerId, e.channel);
      this.peers.set(peerId, { id: peerId, conn, channel: null });
      await conn.setRemoteDescription(env.data);
      const answer = await conn.createAnswer();
      await conn.setLocalDescription(answer);
      this.signaling.sendSignal({ kind: 'answer', from: this.signaling.clientId, to: peerId, data: answer });
    } else if (env.kind === 'answer') {
      const p = this.peers.get(peerId);
      await p?.conn.setRemoteDescription(env.data);
    } else if (env.kind === 'ice-candidate') {
      const p = this.peers.get(peerId);
      try { await p?.conn.addIceCandidate(env.data); } catch { /* candidato chegou fora de ordem: ignora */ }
    }
  }
}
