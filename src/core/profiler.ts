// Medição de tempo por sistema dentro do frame.
//
// Toda a otimização da rodada anterior foi medida **em bancada** — Node, com estruturas de
// teste. Isso mostra a ordem de grandeza, mas não prova onde o frame real está indo: o
// navegador tem GC, compilação JIT e composição de tela que a bancada não reproduz.
//
// A média móvel existe porque o número instantâneo é inútil para decidir: um pico isolado de
// GC faz qualquer sistema parecer culpado. O que interessa é o custo sustentado.

export interface AmostraSistema {
  rotulo: string;
  /** Média dos últimos frames, em milissegundos. */
  ms: number;
  /** Pior frame na janela — é onde mora o engasgo percebido. */
  pico: number;
}

/** Frames considerados na média. ~1 segundo a 60 fps. */
const JANELA = 60;

export class Profiler {
  private atual = new Map<string, number>();
  private inicios = new Map<string, number>();
  private historico = new Map<string, number[]>();
  private tempoFrame: number[] = [];
  private inicioFrame = 0;
  public habilitado = false;

  public beginFrame(): void {
    if (!this.habilitado) return;
    this.inicioFrame = performance.now();
    this.atual.clear();
  }

  public begin(rotulo: string): void {
    if (!this.habilitado) return;
    this.inicios.set(rotulo, performance.now());
  }

  public end(rotulo: string): void {
    if (!this.habilitado) return;
    const t0 = this.inicios.get(rotulo);
    if (t0 === undefined) return;
    // Acumula: um sistema pode ser medido mais de uma vez no mesmo frame.
    this.atual.set(rotulo, (this.atual.get(rotulo) ?? 0) + (performance.now() - t0));
  }

  public endFrame(): void {
    if (!this.habilitado) return;

    for (const [rotulo, ms] of this.atual) {
      let h = this.historico.get(rotulo);
      if (!h) { h = []; this.historico.set(rotulo, h); }
      h.push(ms);
      if (h.length > JANELA) h.shift();
    }

    this.tempoFrame.push(performance.now() - this.inicioFrame);
    if (this.tempoFrame.length > JANELA) this.tempoFrame.shift();
  }

  /** Sistemas ordenados do mais caro para o mais barato. */
  public snapshot(): AmostraSistema[] {
    const out: AmostraSistema[] = [];
    for (const [rotulo, h] of this.historico) {
      if (h.length === 0) continue;
      let soma = 0, pico = 0;
      for (const v of h) { soma += v; if (v > pico) pico = v; }
      out.push({ rotulo, ms: soma / h.length, pico });
    }
    return out.sort((a, b) => b.ms - a.ms);
  }

  /** Tempo total gasto dentro do `tick`, médio e pior. Não inclui o que o navegador faz depois. */
  public frameStats(): { media: number; pico: number; fps: number } {
    if (this.tempoFrame.length === 0) return { media: 0, pico: 0, fps: 0 };
    let soma = 0, pico = 0;
    for (const v of this.tempoFrame) { soma += v; if (v > pico) pico = v; }
    const media = soma / this.tempoFrame.length;
    return { media, pico, fps: media > 0 ? 1000 / media : 0 };
  }

  public reset(): void {
    this.historico.clear();
    this.tempoFrame.length = 0;
  }
}

/** Instância única. Desligada por padrão: medir custa, e ninguém deve pagar sem pedir. */
export const profiler = new Profiler();
