// Gradação de cor: a paleta que o pedido chama de "gráficos do Lay of the Land".
//
// ## O que dá o visual, e o que não dá
//
// A referência não se distingue pela geometria — mini-blocos e oclusão de ambiente já estão
// entregues. O que a distingue é a **cor**: paleta dessaturada, sombra puxada para o azul, luz
// puxada para o âmbar. Sem isso, o mesmo terreno com a mesma malha parece um voxel genérico.
//
// ## Por que não há um passe de tela cheia
//
// A solução de manual é um `EffectComposer` com LUT. Ela custa um alvo de render do tamanho da
// tela, uma cópia por quadro e um passe de fragmento sobre cada pixel — e este projeto já veio de
// um relato de *"está muito muito travado"*. As operações aqui são seis instruções dentro do
// fragmento que já ia rodar de qualquer jeito, sem alvo intermediário nenhum.
//
// **A limitação é real e vale dizer:** a gradação assim aplicada alcança o terreno, a água e o
// vidro — não o personagem, as criaturas nem o céu. Com uma gradação sutil, que é o caso da
// referência, a diferença não se nota; com uma agressiva, notaria. O LUT completo continua
// pendente no checklist (itens 1075 e 1083), e é ele que exigiria o passe.
//
// Módulo puro: decide os números. Quem os entrega à GPU é `scene.ts`.

export interface Gradacao {
  /** 0 = cinza, 1 = cor original, >1 = mais viva. */
  saturacao: number;
  /** 1 = sem efeito. Aplicado em torno do cinza médio. */
  contraste: number;
  /** Cor multiplicada nas sombras. A assinatura da referência é azulada. */
  sombra: [number, number, number];
  /** Cor multiplicada nas luzes. Âmbar. */
  luz: [number, number, number];
  /** Força geral, 0..1. Zero devolve a imagem intacta. */
  forca: number;
  /** Exposição do mapeamento de tom. */
  exposicao: number;
}

export const NEUTRA: Gradacao = {
  saturacao: 1, contraste: 1, sombra: [1, 1, 1], luz: [1, 1, 1], forca: 0, exposicao: 1,
};

export type PredefinicaoId = 'natural' | 'cinema' | 'vivido' | 'nenhuma';
export type ModoDaltonismo = 'nenhum' | 'protanopia' | 'deuteranopia' | 'tritanopia';

/** Ajustes de cor para modo daltonismo (Acessibilidade) — item 436. */
export function aplicarModoDaltonismo(base: Gradacao, modo: ModoDaltonismo): Gradacao {
  if (modo === 'nenhum') return base;
  const out = { ...base, sombra: [...base.sombra] as [number, number, number], luz: [...base.luz] as [number, number, number] };
  if (modo === 'protanopia') {
    out.luz = [base.luz[0] * 0.56, base.luz[1] * 0.44 + 0.55, base.luz[2]];
  } else if (modo === 'deuteranopia') {
    out.luz = [base.luz[0] * 0.62, base.luz[1] * 0.38 + 0.45, base.luz[2]];
  } else if (modo === 'tritanopia') {
    out.sombra = [base.sombra[0], base.sombra[1] * 0.7, base.sombra[2] * 0.3 + 0.7];
  }
  return out;
}

/**
 * Predefinições selecionáveis nas opções.
 *
 * `natural` é o padrão e é deliberadamente contida: a gradação certa é a que ninguém nota como
 * efeito, só como "o jogo tem cara". Uma gradação que se anuncia cansa em dez minutos.
 */
export const PREDEFINICOES: Record<PredefinicaoId, Gradacao> = {
  natural: {
    saturacao: 0.92, contraste: 1.06,
    sombra: [0.93, 0.97, 1.08], luz: [1.05, 1.01, 0.94],
    forca: 1, exposicao: 1,
  },
  cinema: {
    saturacao: 0.8, contraste: 1.16,
    sombra: [0.86, 0.94, 1.16], luz: [1.1, 1.02, 0.88],
    forca: 1, exposicao: 0.96,
  },
  vivido: {
    saturacao: 1.18, contraste: 1.1,
    sombra: [0.96, 0.99, 1.05], luz: [1.06, 1.03, 0.97],
    forca: 1, exposicao: 1.04,
  },
  nenhuma: NEUTRA,
};

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

/**
 * Exposição conforme a hora do dia.
 *
 * Não é o mesmo que a intensidade do sol: `sunScale` diz quanta luz existe, a exposição diz como
 * o olho se adapta a ela. Sem isso, a noite fica com a mesma resposta tonal do meio-dia e o
 * escuro vira preto chapado em vez de escuro legível.
 *
 * @param elevacao -1 (meia-noite) a 1 (meio-dia)
 */
export function exposicaoDaHora(elevacao: number): number {
  const e = clamp(elevacao, -1, 1);
  // Abre à noite (o olho se adapta), fecha no meio-dia. A faixa é estreita de propósito: exagerar
  // aqui produz aquele efeito de câmera automática mal ajustada, que é pior que não ter nenhum.
  return 1.16 - 0.22 * ((e + 1) / 2);
}

export interface ContextoGradacao {
  predefinicao: PredefinicaoId;
  /** -1..1, elevação do sol. */
  elevacaoSolar: number;
  /** Saturação vinda da mistura de biomas (`misturarEscalar(pesos, 'saturacao')`). */
  saturacaoBioma: number;
  /** 0..1 — quanto está chovendo. Chuva lava a cor. */
  molhado: number;
}

/**
 * Gradação efetiva num instante e num lugar.
 *
 * A saturação do bioma **multiplica** a da predefinição, em vez de substituí-la: quem escolheu
 * "cinema" quer o mundo inteiro mais contido, e o deserto continua mais lavado que a selva dentro
 * dessa escolha. Substituir faria a predefinição valer só onde o bioma não tivesse opinião.
 */
export function gradacaoEm(ctx: ContextoGradacao): Gradacao {
  const base = PREDEFINICOES[ctx.predefinicao] ?? NEUTRA;
  if (base.forca <= 0) {
    // Mesmo sem gradação, a exposição continua acompanhando a hora — ela é resposta tonal, não
    // estilo, e desligá-la deixaria a noite chapada.
    return { ...NEUTRA, exposicao: exposicaoDaHora(ctx.elevacaoSolar) };
  }

  const bioma = clamp(ctx.saturacaoBioma, 0.2, 2);
  const chuva = clamp(ctx.molhado, 0, 1);

  return {
    saturacao: clamp(base.saturacao * bioma * (1 - chuva * 0.22), 0, 2),
    contraste: base.contraste,
    sombra: base.sombra,
    luz: base.luz,
    forca: base.forca,
    exposicao: exposicaoDaHora(ctx.elevacaoSolar) * base.exposicao * (1 - chuva * 0.1),
  };
}
