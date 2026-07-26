// Aparição gradual dos chunks — o agendamento, sem Three.js.
//
// ## Por que dithering, e não transparência
//
// A saída óbvia seria material transparente com opacidade subindo. O item 1003 do checklist já
// avisava do custo, e ele é maior do que parece: material transparente **não escreve no buffer de
// profundidade**, então o chunk que aparece deixa de ocultar o que está atrás dele. Durante a
// animação inteira o jogador veria o interior do terreno através do chão que está chegando, e o
// renderizador ainda teria de ordenar os chunks por distância a cada quadro.
//
// A solução deste módulo é **descartar fragmentos por um padrão de Bayer**: o material continua
// opaco, escreve profundidade, não precisa de ordenação, e o que varia é a *fração* de pixels
// desenhados. A 0,6 s de duração o olho lê como um esmaecimento.
//
// ## O que fica aqui e o que fica fora
//
// Este módulo decide **quando** e **quanto** — puro, testável, sem uma linha de GPU. O material e
// o descarte ficam em `scene.ts`. A separação existe porque a parte fácil de errar em silêncio é
// esta: um chunk que nunca termina de aparecer fica meio transparente para sempre, e um que
// reinicia a cada re-mesh pisca toda vez que o jogador põe um bloco.

/** Duração da aparição de um chunk, em segundos. */
export const FADE_DURACAO = 0.6;

/**
 * Atraso mínimo entre o início de dois chunks.
 *
 * Sem escalonar, os oito chunks que ficam prontos no mesmo quadro aparecem juntos — o efeito lê
 * como um piscar do mundo inteiro, não como terreno chegando.
 */
export const ATRASO_ENTRE_CHUNKS = 0.045;

/** Suavização: começa rápido e desacelera. Linear parece mecânico. */
export function suavizar(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - x, 3);
}

export class FadeAgenda {
  private t = 0;
  /** Chunks aparecendo agora: chave → instante de início. */
  private ativos = new Map<string, number>();
  /** Chunks que já apareceram alguma vez. É o que impede o re-mesh de reiniciar a animação. */
  private jaApareceram = new Set<string>();
  private ultimoInicio = -Infinity;
  private terminaramAgora: string[] = [];

  /** Desligável — acompanha o redutor de movimento das opções (item 1009). */
  public ligado = true;

  /**
   * Anuncia que a malha de um chunk ficou pronta.
   *
   * @returns `true` se uma aparição começou. `false` quando o chunk já apareceu antes (re-mesh
   * por alteração do jogador) ou quando o efeito está desligado — nos dois casos o chamador deve
   * usar o material opaco de sempre.
   */
  public registrar(chave: string): boolean {
    if (!this.ligado) { this.jaApareceram.add(chave); return false; }
    // Re-mesh por alteração não refaz a animação: piscaria a cada bloco colocado.
    if (this.jaApareceram.has(chave)) return false;

    this.jaApareceram.add(chave);
    // Escalonamento: cada chunk espera a vez, sem nunca começar no passado.
    const inicio = Math.max(this.t, this.ultimoInicio + ATRASO_ENTRE_CHUNKS);
    this.ultimoInicio = inicio;
    this.ativos.set(chave, inicio);
    return true;
  }

  public update(dt: number): void {
    this.t += dt;
    this.terminaramAgora.length = 0;
    if (this.ativos.size === 0) return;

    for (const [chave, inicio] of this.ativos) {
      if (this.t - inicio >= FADE_DURACAO) {
        this.ativos.delete(chave);
        this.terminaramAgora.push(chave);
      }
    }
  }

  /**
   * Fração visível de um chunk, 0..1.
   *
   * Devolve 1 para tudo que não está aparecendo — inclusive chave desconhecida. É o padrão
   * seguro: um erro de contabilidade some com o efeito, não com o terreno.
   */
  public progresso(chave: string): number {
    const inicio = this.ativos.get(chave);
    if (inicio === undefined) return 1;
    if (this.t < inicio) return 0; // agendado, ainda não começou
    return suavizar((this.t - inicio) / FADE_DURACAO);
  }

  public estaAparecendo(chave: string): boolean {
    return this.ativos.has(chave);
  }

  /** Chunks que terminaram no último `update`. O chamador devolve o material compartilhado. */
  public terminados(): readonly string[] {
    return this.terminaramAgora;
  }

  public get aparecendo(): number {
    return this.ativos.size;
  }

  /**
   * Chunk descarregado. Precisa esquecer as duas coisas: a animação em curso e o registro de
   * "já apareceu" — quem volta ao alcance de render aparece de novo, como da primeira vez.
   */
  public esquecer(chave: string): void {
    this.ativos.delete(chave);
    this.jaApareceram.delete(chave);
  }

  public limpar(): void {
    this.ativos.clear();
    this.jaApareceram.clear();
    this.terminaramAgora.length = 0;
    this.ultimoInicio = -Infinity;
    this.t = 0;
  }
}
