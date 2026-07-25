// Motor de áudio: executa as especificações de `synth.ts` via Web Audio API.
//
// Três restrições moldaram o desenho:
//
//  1. **Autoplay.** Navegador não deixa tocar áudio antes de uma interação do usuário. O contexto
//     nasce suspenso e é retomado no primeiro clique ou tecla — tentar tocar antes disso não
//     falha ruidosamente, apenas não soa.
//  2. **Limite de vozes.** Um desmoronamento pode disparar centenas de sons no mesmo frame.
//     Sem teto, o mixer satura e o resultado é um estouro, não um desmoronamento.
//  3. **Custo por som.** Cada som cria alguns nós e os descarta. Isso é aceitável porque são
//     efeitos curtos; o que não seria aceitável é manter centenas vivos.

import { SoundSpec, distanceGain, stereoPan } from './synth';

export type AudioChannel = 'master' | 'sfx' | 'ambient' | 'music' | 'ui';

/** Vozes simultâneas. Acima disso, o som novo é descartado. */
const MAX_VOICES = 24;
/** Sons idênticos disparados dentro desta janela são fundidos — evita o "flanger" de repetição. */
const DEDUPE_MS = 28;

export interface PlayOptions {
  channel?: AudioChannel;
  /** Posição no mundo. Sem ela, o som é tocado no centro, sem atenuação. */
  position?: { x: number; y: number; z: number };
  /** Multiplicador extra de volume. */
  volume?: number;
  /** Identificador para deduplicação; sons com a mesma chave não se acumulam. */
  dedupeKey?: string;
}

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private channelGains = new Map<AudioChannel, GainNode>();
  private volumes: Record<AudioChannel, number> = {
    master: 0.7, sfx: 1, ambient: 0.6, music: 0.5, ui: 0.8,
  };
  private vozesAtivas = 0;
  private ultimoDisparo = new Map<string, number>();
  private listener = { x: 0, y: 0, z: 0, yaw: 0 };
  private ligado = true;

  /** Buffer de ruído branco, gerado uma vez e reaproveitado — recriar por som seria desperdício. */
  private ruido: AudioBuffer | null = null;

  public get habilitado(): boolean {
    return this.ligado;
  }

  public setHabilitado(v: boolean): void {
    this.ligado = v;
    if (!v && this.ctx) void this.ctx.suspend();
    else if (v && this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  /**
   * Cria o contexto de áudio. Deve ser chamado **de dentro** de um gesto do usuário; antes disso
   * o navegador mantém o contexto suspenso e nada soa.
   */
  public despertar(): void {
    if (!this.ligado) return;

    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctor) return; // navegador sem Web Audio: o jogo segue mudo, sem quebrar
      this.ctx = new Ctor();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volumes.master;
      this.masterGain.connect(this.ctx.destination);

      for (const canal of ['sfx', 'ambient', 'music', 'ui'] as AudioChannel[]) {
        const g = this.ctx.createGain();
        g.gain.value = this.volumes[canal];
        g.connect(this.masterGain);
        this.channelGains.set(canal, g);
      }

      this.ruido = this.gerarRuido();
    }

    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Ruído branco de 1 s, suficiente para qualquer efeito curto por recorte aleatório. */
  private gerarRuido(): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const dados = buf.getChannelData(0);
    for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;
    return buf;
  }

  public setListener(x: number, y: number, z: number, yaw: number): void {
    this.listener = { x, y, z, yaw };
  }

  public setVolume(canal: AudioChannel, valor: number): void {
    const v = Math.max(0, Math.min(1, valor));
    this.volumes[canal] = v;
    if (canal === 'master') {
      if (this.masterGain) this.masterGain.gain.value = v;
      return;
    }
    const g = this.channelGains.get(canal);
    if (g) g.gain.value = v;
  }

  public getVolume(canal: AudioChannel): number {
    return this.volumes[canal];
  }

  /**
   * Toca uma especificação de som. Silenciosamente não faz nada se o áudio não estiver pronto —
   * um efeito sonoro nunca deve interromper o jogo.
   */
  public play(spec: SoundSpec, options: PlayOptions = {}): void {
    if (!this.ligado || !this.ctx || this.ctx.state !== 'running') return;
    if (this.vozesAtivas >= MAX_VOICES) return;

    const agora = performance.now();
    if (options.dedupeKey) {
      const ultimo = this.ultimoDisparo.get(options.dedupeKey) ?? -Infinity;
      if (agora - ultimo < DEDUPE_MS) return;
      this.ultimoDisparo.set(options.dedupeKey, agora);
    }

    // Atenuação e panorâmica: calculadas aqui, não com PannerNode, porque um ganho e um pan
    // simples custam muito menos e a diferença é imperceptível para efeitos curtos.
    let ganhoDistancia = 1;
    let pan = 0;
    if (options.position) {
      const d = Math.hypot(
        options.position.x - this.listener.x,
        options.position.y - this.listener.y,
        options.position.z - this.listener.z,
      );
      ganhoDistancia = distanceGain(d);
      if (ganhoDistancia <= 0.001) return; // longe demais: não gasta nó nenhum
      pan = stereoPan(options.position, this.listener, this.listener.yaw);
    }

    const ctx = this.ctx;
    const destino = this.channelGains.get(options.channel ?? 'sfx') ?? this.masterGain!;
    const t0 = ctx.currentTime;
    const dur = Math.max(0.02, spec.duration);
    const volume = spec.gain * ganhoDistancia * (options.volume ?? 1);

    const envelope = ctx.createGain();
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = spec.filterHz;

    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.value = pan;

    // Envelope percussivo: ataque curto e decaimento exponencial. `linearRampToValueAtTime` no
    // ataque evita o clique que um salto instantâneo produz.
    envelope.gain.setValueAtTime(0.0001, t0);
    envelope.gain.linearRampToValueAtTime(volume, t0 + Math.min(spec.attack, dur * 0.5));
    envelope.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    filtro.connect(envelope);
    if (panner) {
      envelope.connect(panner);
      panner.connect(destino);
    } else {
      envelope.connect(destino);
    }

    const fontes: AudioScheduledSourceNode[] = [];

    // Componente tonal.
    if (spec.noise < 0.999) {
      const osc = ctx.createOscillator();
      osc.type = spec.harmonics ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(spec.freq, t0);
      if (spec.freqEnd !== undefined && spec.freqEnd !== spec.freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.freqEnd), t0 + dur);
      }
      const g = ctx.createGain();
      g.gain.value = 1 - spec.noise;
      osc.connect(g);
      g.connect(filtro);
      fontes.push(osc);

      // Harmônicos dão o "ring" do metal. Só quando pedidos, para não custar em todo som.
      for (let h = 2; h <= (spec.harmonics ?? 1); h++) {
        const extra = ctx.createOscillator();
        extra.type = 'sine';
        extra.frequency.setValueAtTime(spec.freq * h, t0);
        const gh = ctx.createGain();
        gh.gain.value = (1 - spec.noise) / (h * 2.2);
        extra.connect(gh);
        gh.connect(filtro);
        fontes.push(extra);
      }
    }

    // Componente de ruído, recortado de um ponto aleatório do buffer.
    if (spec.noise > 0.001 && this.ruido) {
      const src = ctx.createBufferSource();
      src.buffer = this.ruido;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = spec.noise;
      src.connect(g);
      g.connect(filtro);
      // O offset aleatório é o que faz dois passos seguidos não soarem idênticos.
      try { src.start(t0, Math.random() * 0.9, dur); } catch { src.start(t0); }
      fontes.push(src);
    }

    this.vozesAtivas++;
    let liberado = false;
    const liberar = () => {
      if (liberado) return;
      liberado = true;
      this.vozesAtivas = Math.max(0, this.vozesAtivas - 1);
      for (const f of fontes) { try { f.disconnect(); } catch { /* já desconectado */ } }
      try { filtro.disconnect(); envelope.disconnect(); panner?.disconnect(); } catch { /* idem */ }
    };

    for (const f of fontes) {
      if (f instanceof OscillatorNode) { f.start(t0); f.stop(t0 + dur); }
    }
    // `onended` é o caminho normal; o timer é a rede de segurança, porque um nó que nunca
    // dispara `onended` vazaria uma voz do orçamento para sempre.
    fontes[0]?.addEventListener('ended', liberar);
    setTimeout(liberar, dur * 1000 + 120);
  }

  /** Vozes em uso — para o painel de diagnóstico. */
  public get vozes(): number {
    return this.vozesAtivas;
  }

  public get pronto(): boolean {
    return this.ctx?.state === 'running';
  }
}
