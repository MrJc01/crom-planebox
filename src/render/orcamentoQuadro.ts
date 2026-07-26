// Orçamento de trabalho por quadro — item 402.
//
// A base do orçamento vem do alcance de visão: quanto mais longe se enxerga, mais chunks
// precisam ficar prontos para o mundo não aparecer aos pedaços. Isso é metade do problema, e a
// metade fácil — já existia.
//
// O que faltava é reagir ao custo **real**. Numa máquina lenta, ou num momento caro (tempestade
// com partículas, muitas criaturas em volta), gerar o mesmo número de malhas transforma um quadro
// pesado numa engasgada visível. O mundo carregar um pouco mais devagar é a troca certa:
// **atraso se percebe menos que solavanco**.
//
// Mora num módulo próprio porque a regra tem estado entre quadros e merece teste — dentro de
// `bootstrap()` ela não seria testável sem subir o jogo inteiro.

/** Alvo de tempo por quadro, em segundos. 16,7 ms são 60 quadros por segundo. */
export const ALVO_QUADRO = 0.0167;

export class OrcamentoDeQuadro {
  /**
   * Fator atual, 0..1.
   *
   * É memória entre quadros de propósito: reagir só ao quadro atual faria o orçamento oscilar a
   * cada engasgada isolada, e a oscilação em si já produz irregularidade.
   */
  private fator = 1;

  /**
   * Quanto trabalho cabe neste quadro.
   *
   * **Sobe devagar e desce depressa**, e a assimetria é deliberada: um solavanco precisa de
   * resposta imediata, enquanto recuperar o ritmo pode levar alguns quadros. Subir devagar evita
   * o vaivém de um controle que corrige demais e passa a causar o problema que deveria resolver.
   */
  public paraEste(base: number, dt: number): number {
    if (dt > ALVO_QUADRO * 1.5) this.fator = Math.max(0.15, this.fator - 0.25);
    else if (dt < ALVO_QUADRO * 1.1) this.fator = Math.min(1, this.fator + 0.05);

    // Piso de 1: com zero o mundo pararia de carregar e nunca sairia do quadro caro, porque o
    // custo alto não vem só das malhas. Uma por quadro ainda é progresso.
    return Math.max(1, Math.round(base * this.fator));
  }

  /** Fator atual, para o painel de diagnóstico mostrar que o orçamento está atuando. */
  public get fatorAtual(): number {
    return this.fator;
  }
}
