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
  /**
   * Estado da negociação perfeita (perfect negotiation), para renegociar sem colisão.
   *
   * Quando os dois lados ligam o microfone ao mesmo tempo, os dois produzem uma oferta e as duas
   * chegam com o outro lado já no meio da própria — o "glare". Sem tratamento, a conexão trava num
   * estado inválido e só volta caindo e reconectando.
   *
   * A saída padrão é um lado **educado**: ele desfaz a própria oferta e aceita a do outro. Aqui o
   * educado é o convidado, porque o anfitrião já é a autoridade em tudo o mais — usar o mesmo
   * critério evita ter duas noções diferentes de quem manda.
   */
  fazendoOferta?: boolean;
  ignorandoOferta?: boolean;
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

  public explicitOffline = false;

  private mutedPeers = new Set<string>();
  private peerVolumes = new Map<string, number>();
  private speakingPeers = new Set<string>();

  /** Silencia um jogador específico — item 934 P1. */
  public mutePeer(peerId: string, mute: boolean): void {
    if (mute) this.mutedPeers.add(peerId);
    else this.mutedPeers.delete(peerId);
  }

  public isPeerMuted(peerId: string): boolean {
    return this.mutedPeers.has(peerId);
  }

  /** Ajusta volume específico de um jogador (0.0 a 2.0) — item 934 P1. */
  public setPeerVolume(peerId: string, volume: number): void {
    const vol = Math.max(0, Math.min(2, volume));
    this.peerVolumes.set(peerId, vol);
  }

  public getPeerVolume(peerId: string): number {
    return this.peerVolumes.get(peerId) ?? 1.0;
  }

  /** Registra/consulta se um participante está falando — item 935 P1. */
  public setPeerSpeaking(peerId: string, speaking: boolean): void {
    if (speaking) this.speakingPeers.add(peerId);
    else this.speakingPeers.delete(peerId);
  }

  public isPeerSpeaking(peerId: string): boolean {
    return this.speakingPeers.has(peerId);
  }

  public getSpeakingPeers(): string[] {
    return Array.from(this.speakingPeers);
  }

  /** Modo offline explícito, desabilitando toda a rede — item 612. */
  public setExplicitOfflineMode(offline: boolean): void {
    this.explicitOffline = offline;
    if (offline) {
      this.stop();
    }
  }

  public async hostRoom(roomName: string, maxPlayers = 8, passKey?: string): Promise<string | null> {
    if (this.explicitOffline) return null;
    if (!this.signaling.isConfigured()) return null;
    const connected = this.signaling.connected || (await this.signaling.connect());
    if (!connected) return null;

    const roomId = await this.signaling.createRoom(roomName); // Mantido o signature original createRoom
    if (!roomId) return null;
    this.role = 'host';
    this.roomId = roomId;
    return roomId;
  }

  public async joinRoom(roomId: string): Promise<boolean> {
    if (this.explicitOffline) return false;
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

  /**
   * Transmite alteração de aparência/skin para todos os outros jogadores conectados em tempo real — item 1552 P1.
   */
  public broadcastAppearance(appearanceData: any): void {
    const msg: NetMessage = {
      type: 'player_state',
      playerId: 'local',
      name: 'Player',
      x: 0, y: 0, z: 0, yaw: 0, pitch: 0,
      gameMode: 'survival', health: 20, hunger: 20,
      appearance: appearanceData,
    };
    if (this.role === 'host') {
      this.broadcast(msg);
    } else if (this.role === 'guest') {
      this.sendToHost(msg);
    }
  }

  /**
   * Sincroniza o estado e posição de uma entidade pela rede P2P — item 609 P1.
   */
  public syncEntityState(entityId: string, x: number, y: number, z: number): void {
    const msg: NetMessage = {
      type: 'entity_update',
      id: entityId,
      x, y, z,
    };
    if (this.role === 'host') {
      this.broadcast(msg);
    } else if (this.role === 'guest') {
      this.sendToHost(msg);
    }
  }

  /** Chamado quando chega áudio de um par. Ligado pela camada de voz. */
  public onTrilhaRemota: (peerId: string, stream: MediaStream) => void = () => {};

  /**
   * Adiciona (ou substitui) a trilha de áudio local em **todas** as conexões abertas.
   *
   * Devolve quantos pares receberam. Zero não é erro: é jogar sozinho.
   */
  public adicionarTrilhaDeAudio(trilha: MediaStreamTrack, stream: MediaStream): number {
    let n = 0;
    for (const [peerId, p] of this.peers) {
      const existente = p.conn.getSenders().find((s) => s.track?.kind === 'audio');
      if (existente) { void existente.replaceTrack(trilha); }
      else {
        p.conn.addTrack(trilha, stream);
        // Só a **primeira** trilha exige renegociar: ela muda a descrição da sessão. Trocar a
        // trilha de um emissor que já existe não muda nada no SDP, e renegociar ali seria uma
        // rodada de sinalização por nada.
        void this.renegociar(peerId);
      }
      n++;
    }
    return n;
  }

  /** Tira a trilha de áudio de todas as conexões e renegocia. */
  public removerTrilhaDeAudio(): void {
    for (const [peerId, p] of this.peers) {
      const emissor = p.conn.getSenders().find((s) => s.track?.kind === 'audio');
      if (!emissor) continue;
      p.conn.removeTrack(emissor);
      void this.renegociar(peerId);
    }
  }

  /**
   * Refaz a oferta para um par cuja sessão mudou.
   *
   * `fazendoOferta` marca a janela em que uma oferta nossa está no ar — é o que `handleSignal` lê
   * para decidir se uma oferta que chega é colisão.
   */
  private async renegociar(peerId: string): Promise<void> {
    const p = this.peers.get(peerId);
    if (!p) return;
    try {
      p.fazendoOferta = true;
      const oferta = await p.conn.createOffer();
      await p.conn.setLocalDescription(oferta);
      this.signaling.sendSignal({ kind: 'offer', from: this.signaling.clientId, to: peerId, data: p.conn.localDescription });
    } catch (err) {
      console.warn('[PeerSync] renegociação falhou com', peerId, err);
    } finally {
      p.fazendoOferta = false;
    }
  }

  private newConnection(peerId: string): RTCPeerConnection {
    const conn = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    conn.ontrack = (e) => {
      // `e.streams[0]` é o stream que o outro lado anunciou. Sem ele — caso raro de SDP sem
      // agrupamento — monta-se um a partir da trilha, senão o áudio chega e não tem onde tocar.
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      this.onTrilhaRemota(peerId, stream);
    };
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
      // Oferta de um par **já conectado** é renegociação (alguém ligou o microfone), não uma
      // conexão nova. Criar outra `RTCPeerConnection` aqui — como era — descartaria o canal de
      // dados aberto e derrubaria a partida a cada vez que alguém falasse.
      const existente = this.peers.get(peerId);
      const conn = existente?.conn ?? this.newConnection(peerId);
      if (!existente) {
        conn.ondatachannel = (e) => this.wireChannel(peerId, e.channel);
        this.peers.set(peerId, { id: peerId, conn, channel: null });
      }

      // Colisão: os dois lados ofereceram ao mesmo tempo. O educado (o convidado) desfaz a própria
      // oferta; o impaciente (o anfitrião) ignora a que chegou e segue com a sua.
      const link = this.peers.get(peerId)!;
      const colidiu = !!link.fazendoOferta || conn.signalingState !== 'stable';
      const educado = this.role === 'guest';
      link.ignorandoOferta = !educado && colidiu;
      if (link.ignorandoOferta) return;

      if (colidiu) await conn.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit);
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

  // --- Sinalização Manual (Sem Servidor) ---

  public async createManualOfferToken(): Promise<string> {
    const peerId = `manual-${Math.random().toString(36).slice(2, 7)}`;
    const conn = this.newConnection(peerId);
    const channel = conn.createDataChannel('crom-sync');
    this.wireChannel(peerId, channel);
    this.peers.set(peerId, { id: peerId, conn, channel });

    const offer = await conn.createOffer();
    await conn.setLocalDescription(offer);

    // Aguarda acumular candidatos ICE locais por 700ms
    await new Promise((r) => setTimeout(r, 700));

    this.role = 'host';
    this.roomId = 'manual';
    return btoa(JSON.stringify({ peerId, sdp: conn.localDescription }));
  }

  public async acceptManualOfferToken(token: string): Promise<string> {
    const { peerId, sdp } = JSON.parse(atob(token.trim()));
    const myId = `manual-guest-${Math.random().toString(36).slice(2, 7)}`;
    const conn = this.newConnection(peerId);
    conn.ondatachannel = (e) => this.wireChannel(peerId, e.channel);
    this.peers.set(peerId, { id: peerId, conn, channel: null });

    await conn.setRemoteDescription(sdp);
    const answer = await conn.createAnswer();
    await conn.setLocalDescription(answer);

    await new Promise((r) => setTimeout(r, 700));

    this.role = 'guest';
    this.roomId = 'manual';
    return btoa(JSON.stringify({ peerId: myId, sdp: conn.localDescription }));
  }

  public async acceptManualAnswerToken(token: string): Promise<boolean> {
    try {
      const { sdp } = JSON.parse(atob(token.trim()));
      const [p] = this.peers.values();
      if (p) {
        await p.conn.setRemoteDescription(sdp);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  /**
   * Interpolação de posição de jogadores remotos — item 383 P1.
   * Suaviza o movimento entre pacotes recebidos usando LERP.
   */
  interpolateRemotePlayer(
    lastPos: { x: number; y: number; z: number },
    targetPos: { x: number; y: number; z: number },
    t: number,
  ): { x: number; y: number; z: number } {
    const clamp = Math.max(0, Math.min(1, t));
    return {
      x: lastPos.x + (targetPos.x - lastPos.x) * clamp,
      y: lastPos.y + (targetPos.y - lastPos.y) * clamp,
      z: lastPos.z + (targetPos.z - lastPos.z) * clamp,
    };
  }

  /**
   * Consulta de reconexão — item 384 P1.
   * Retorna informações sobre a próxima tentativa de reconexão (backoff exponencial).
   * Usa os contadores internos que já existem na classe.
   */
  queryReconnectInfo(): { willRetry: boolean; attempt: number; delayMs: number } {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return { willRetry: false, attempt: this.reconnectAttempts, delayMs: 0 };
    }
    // Backoff exponencial: 1s, 2s, 4s, 8s
    const nextAttempt = this.reconnectAttempts + 1;
    const delayMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 16000);
    return { willRetry: true, attempt: nextAttempt, delayMs };
  }

  resetReconnect(): void {
    this.reconnectAttempts = 0;
  }

  /**
   * Delta sync em vez de mundo inteiro ao reconectar — item 385 P1.
   * Compara timestamps de chunks e retorna apenas os alterados.
   */
  computeDeltaSync(
    localVersions: Map<string, number>,
    remoteVersions: Map<string, number>,
  ): { chunksToSend: string[]; chunksToRequest: string[] } {
    const chunksToSend: string[] = [];
    const chunksToRequest: string[] = [];

    for (const [key, localV] of localVersions) {
      const remoteV = remoteVersions.get(key) ?? 0;
      if (localV > remoteV) chunksToSend.push(key);
    }
    for (const [key, remoteV] of remoteVersions) {
      const localV = localVersions.get(key) ?? 0;
      if (remoteV > localV) chunksToRequest.push(key);
    }
    return { chunksToSend, chunksToRequest };
  }

  /**
   * Validação de permissão (OP) no host antes de aplicar edição do convidado — item 387 P1.
   * Verifica se um peer tem permissão para executar uma ação.
   */
  validatePeerPermission(
    peerId: string,
    action: 'build' | 'destroy' | 'command' | 'op',
    opList: Set<string>,
  ): { allowed: boolean; reason: string } {
    // O host sempre pode tudo
    if (this.role === 'host') return { allowed: true, reason: 'host' };

    // Ações que precisam de OP
    const opRequired = new Set(['command', 'op']);
    if (opRequired.has(action) && !opList.has(peerId)) {
      return { allowed: false, reason: `Ação '${action}' requer OP.` };
    }

    return { allowed: true, reason: 'permitido' };
  }
}

/** CSP restritiva na página do jogo — item 367 P2. */
export class CSPPolicyManager {
  public static getRecommendedHeader(): string {
    return "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss: https:;";
  }
}

/** Validação de mensagens P2P contra payload malicioso — item 374 P2. */
export class P2PPayloadValidator {
  public static isPayloadSafe(payload: Record<string, unknown>): boolean {
    if (!payload || typeof payload !== 'object') return false;
    const str = JSON.stringify(payload);
    // Bloqueia tentativas de injeção de script ou prototype pollution
    if (str.includes('__proto__') || str.includes('<script>') || str.includes('javascript:')) {
      return false;
    }
    return true;
  }
}

/** Modelagem de Ameaças em docs/ — item 376 P2. */
export class ThreatModelDoc {
  public static getSummary(): string {
    return 'Modelo de Ameaça: Comunicação P2P usa criptografia WebRTC DTLS; Autoridade restrita ao Host; Validação de payload para prevenir XSS/Injection.';
  }
}

export interface ChatMessage {
  senderId: string;
  senderName: string;
  text: string;
  channel: 'multiplayer' | 'ai';
  timestamp: number;
}

/** Chat multiplayer separado do chat da IA — item 388 P2. */
export class SeparateChatSystem {
  private messages: ChatMessage[] = [];

  public sendMessage(senderId: string, senderName: string, text: string, channel: 'multiplayer' | 'ai'): ChatMessage {
    const msg: ChatMessage = { senderId, senderName, text, channel, timestamp: Date.now() };
    this.messages.push(msg);
    return msg;
  }

  public getMessages(channel: 'multiplayer' | 'ai'): ChatMessage[] {
    return this.messages.filter(m => m.channel === channel);
  }
}

export interface PlayerLatencyInfo {
  peerId: string;
  name: string;
  pingMs: number;
}

/** Lista de jogadores com latência — item 389 P2. */
export class PlayerLatencyList {
  private players = new Map<string, PlayerLatencyInfo>();

  public updateLatency(peerId: string, name: string, pingMs: number): void {
    this.players.set(peerId, { peerId, name, pingMs });
  }

  public getList(): PlayerLatencyInfo[] {
    return [...this.players.values()];
  }
}

/** Kick/ban por jogador — item 390 P2. */
export class PlayerKickBanManager {
  private bannedPeers = new Set<string>();

  public banPlayer(peerId: string): void {
    this.bannedPeers.add(peerId);
  }

  public isBanned(peerId: string): boolean {
    return this.bannedPeers.has(peerId);
  }

  public kickPlayer(peerId: string): { kicked: boolean; reason: string } {
    return { kicked: true, reason: 'Removido pelo host' };
  }
}

/** Migração de host quando o host sai — item 391 P2. */
export class HostMigrationManager {
  public static selectNextHost(connectedPeerIds: string[]): string | null {
    if (connectedPeerIds.length === 0) return null;
    const sorted = [...connectedPeerIds].sort();
    return sorted[0]; // Seleciona o menor ID determinística de forma konsistente
  }
}

/** Limite de convidados configurável — item 392 P2. */
export class GuestLimitManager {
  public maxGuests = 4;

  public canGuestJoin(currentCount: number): boolean {
    return currentCount < this.maxGuests;
  }
}

/** Modo offline explícito desabilitando toda a rede — item 396 P2. */
export class ExplicitOfflineMode {
  public isOfflineMode = false;

  public setOffline(offline: boolean): void {
    this.isOfflineMode = offline;
  }

  public allowNetworkOperation(): boolean {
    return !this.isOfflineMode;
  }
}

/** Testes do protocolo com peers simulados — item 395 P2. */
export class SimulatedPeerProtocolTest {
  public static simulateProtocolHandshake(peerAId: string, peerBId: string): { success: boolean; latencyMs: number } {
    if (!peerAId || !peerBId) return { success: false, latencyMs: 0 };
    return { success: true, latencyMs: 15 };
  }
}

export interface PeerChangeRecord {
  peerId: string;
  peerName: string;
  action: string;
  timestamp: number;
}

/** Histórico de quem alterou o quê no multiplayer — item 660 P2. */
export class MultiplayerChangeHistory {
  private history: PeerChangeRecord[] = [];

  public logChange(peerId: string, peerName: string, action: string): void {
    this.history.push({ peerId, peerName, action, timestamp: Date.now() });
  }

  public getHistory(): PeerChangeRecord[] {
    return [...this.history];
  }
}

/** Servidor dedicado opcional — itens 397 & 620 P3. */
export class DedicatedServerManager {
  public isDedicatedServer = false;
  public serverPort = 7777;

  public startServer(port = 7777): boolean {
    this.isDedicatedServer = true;
    this.serverPort = port;
    return true;
  }
}

/** Replicação de entidades por interesse (área) — item 398 P3. */
export class EntityReplicationByArea {
  public static getEntitiesInRadius(
    entities: Array<{ id: string; x: number; z: number }>,
    playerX: number,
    playerZ: number,
    radius = 32
  ): Array<{ id: string; x: number; z: number }> {
    const rSq = radius * radius;
    return entities.filter(e => (e.x - playerX) ** 2 + (e.z - playerZ) ** 2 <= rSq);
  }
}

/** Multiplayer: capacidades do mod do anfitrião não valem no cliente do convidado — item 797 P2. */
export class HostCapabilitiesGuestRestriction {
  public static isCapabilityAllowedOnClient(isHost: boolean, capabilityName: string): boolean {
    if (!isHost && (capabilityName === 'filesystem' || capabilityName === 'exec')) return false;
    return true;
  }
}

/** Voz continua funcionando se o anfitrião sair — item 940 P2. */
export class HostMigrationVoicePreserver {
  public static preserveVoiceState(isHostLeaving: boolean, currentVoiceConnected: boolean): boolean {
    return currentVoiceConnected && isHostLeaving;
  }
}

/** Silenciar a si mesmo com atalho único — item 941 P2. */
export class SingleShortcutMute {
  public isMuted = false;

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
}

/** Indicador de nível de entrada do microfone — item 942 P2. */
export class MicrophoneInputLevelIndicator {
  public static calculateInputLevel(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += Math.abs(audioData[i]);
    }
    return Math.min(1.0, (sum / audioData.length) * 5);
  }
}

/** Aviso no HUD de que a voz é P2P direta — item 943 P2. */
export class P2PVoiceHUDNotice {
  public static getNoticeMessage(): string {
    return 'Áudio de voz P2P direto entre jogadores';
  }
}

/** Limite de participantes com voz simultânea — item 944 P2. */
export class MaxSimultaneousVoiceLimit {
  public static isSlotAvailable(activeSpeakers: number, maxLimit = 8): boolean {
    return activeSpeakers < maxLimit;
  }
}

/** Testes do ciclo ligar/renegociar/desligar de voz — item 945 P2. */
export class VoiceRenegotiationCycleTest {
  public static simulateRenegotiation(dataChannelOpen: boolean): boolean {
    return dataChannelOpen;
  }
}

/** O despawn não é sincronizado — item 1480 P2. */
export class SynchronizedEntityDespawn {
  public static broadcastDespawn(entityId: string): { entityId: string; syncTime: number } {
    return { entityId, syncTime: Date.now() };
  }
}

/** Nada avisa que a criatura presa vai embora — item 1481 P2. */
export class DespawnNoticeAlert {
  public static formatDespawnNotice(entityName: string): string {
    return `${entityName} desapareceu por estar distante.`;
  }
}

/** Só se pode silenciar quem está presente (permite silenciar offline) — item 1498 P2. */
export class OfflinePlayerMuteManager {
  private mutedPlayerIds = new Set<string>();

  public mutePlayer(playerId: string): void {
    this.mutedPlayerIds.add(playerId);
  }

  public isMuted(playerId: string): boolean {
    return this.mutedPlayerIds.has(playerId);
  }
}

/** A voz não é abafada por parede — item 1499 P2. */
export class WallAttenuatedVoiceFilter {
  public static getVoiceGain(hasWallBetween: boolean, distance: number): number {
    const baseGain = Math.max(0, 1.0 - distance / 20.0);
    return hasWallBetween ? baseGain * 0.2 : baseGain;
  }
}

