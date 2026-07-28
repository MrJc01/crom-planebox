// O grafo de áudio das vozes remotas — itens 1414 e 1415.
//
// Um `MediaStream` por par entra aqui e sai posicionado no mundo. A regra de **quanto** e **de que
// lado** mora em `vozEspacial.ts`, que é puro e testável; este arquivo só a aplica em nós do Web
// Audio, que nenhum teste consegue instanciar.
//
// A divisão é deliberada: tudo o que decide fica lá, tudo o que é irredutivelmente navegador fica
// aqui, e aqui não há nenhuma decisão para errar.

import { MisturaDeVoz } from './vozEspacial';

/**
 * O mínimo do Web Audio que este mixer usa. Existe para o tipo não arrastar `lib.dom` inteiro para
 * dentro dos testes, e para deixar explícito quão pouco daqui é realmente necessário.
 */
export interface ContextoDeVoz {
  createMediaStreamSource(s: MediaStream): { connect(n: unknown): unknown; disconnect(): void };
  createGain(): { gain: { value: number }; connect(n: unknown): unknown; disconnect(): void };
  createStereoPanner?(): { pan: { value: number }; connect(n: unknown): unknown; disconnect(): void };
  readonly destination: unknown;
}

interface CanalDeVoz {
  fonte: { connect(n: unknown): unknown; disconnect(): void };
  ganho: { gain: { value: number }; connect(n: unknown): unknown; disconnect(): void };
  pan?: { pan: { value: number }; connect(n: unknown): unknown; disconnect(): void };
  /** O elemento mudo que faz o stream correr. Ver o cabeçalho de `vozEspacial.ts`. */
  elemento: HTMLAudioElement;
}

export class MixerDeVoz {
  private canais = new Map<string, CanalDeVoz>();

  constructor(private ctx: ContextoDeVoz, private raiz: HTMLElement) {}

  /**
   * Liga (ou religa) a voz de um par.
   *
   * Chamar de novo com um stream novo é o caso comum: uma renegociação entrega uma trilha nova para
   * o mesmo par, e o canal antigo precisa ser desmontado antes — senão os dois tocam juntos e a
   * pessoa passa a soar duplicada, com um eco de alguns milissegundos.
   */
  public conectar(peerId: string, stream: MediaStream): void {
    this.desconectar(peerId);

    // O elemento existe para o stream fluir e é sempre mudo: quem produz som é o grafo. Sem
    // `muted`, ouviríamos as duas saídas ao mesmo tempo — uma espacial e outra não.
    const elemento = document.createElement('audio');
    elemento.autoplay = true;
    elemento.muted = true;
    elemento.style.display = 'none';
    elemento.srcObject = stream;
    this.raiz.appendChild(elemento);
    void elemento.play().catch(() => { /* o navegador pode exigir gesto; o clique no microfone serve */ });

    const fonte = this.ctx.createMediaStreamSource(stream);
    const ganho = this.ctx.createGain();
    ganho.gain.value = 0; // nasce em silêncio: o primeiro quadro é que decide o volume

    // `StereoPannerNode` não existe em navegadores antigos. Sem ele a voz continua tendo distância,
    // que é a metade que mais importa — degradar é melhor que não tocar.
    const pan = this.ctx.createStereoPanner?.();
    if (pan) {
      fonte.connect(pan);
      pan.connect(ganho);
    } else {
      fonte.connect(ganho);
    }
    ganho.connect(this.ctx.destination);

    this.canais.set(peerId, { fonte, ganho, pan, elemento });
  }

  /** Aplica a mistura calculada para este quadro. Sem par conectado, não faz nada. */
  public aplicar(peerId: string, m: MisturaDeVoz): void {
    const c = this.canais.get(peerId);
    if (!c) return;
    c.ganho.gain.value = m.ganho;
    if (c.pan) c.pan.pan.value = m.pan;
  }

  public conectado(peerId: string): boolean {
    return this.canais.has(peerId);
  }

  public get pares(): string[] {
    return [...this.canais.keys()];
  }

  /**
   * Desmonta o canal de um par.
   *
   * Desconecta os nós **e** remove o elemento. Deixar o elemento no DOM com um `srcObject` vivo
   * mantém a trilha ativa e o navegador continua decodificando áudio de alguém que já saiu.
   */
  public desconectar(peerId: string): void {
    const c = this.canais.get(peerId);
    if (!c) return;
    c.fonte.disconnect();
    c.pan?.disconnect();
    c.ganho.disconnect();
    c.elemento.srcObject = null;
    c.elemento.remove();
    this.canais.delete(peerId);
  }

  public limpar(): void {
    for (const id of this.pares) this.desconectar(id);
  }
}
