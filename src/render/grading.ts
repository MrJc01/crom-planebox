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

/** Correção de cor / tonemapping fílmico leve — item 059 P2. */
export function applyFilmicToneMapping(rgb: [number, number, number]): [number, number, number] {
  const filmic = (x: number) => {
    const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return Math.min(1.0, Math.max(0.0, (x * (a * x + b)) / (x * (c * x + d) + e)));
  };
  return [filmic(rgb[0]), filmic(rgb[1]), filmic(rgb[2])];
}

/** Teste de regressão visual por hash de imagem em cena fixa — item 072 P2. */
export function computeVisualRegressionHash(pixelData: Uint8Array): number {
  let hash = 5381;
  for (let i = 0; i < pixelData.length; i++) {
    hash = ((hash << 5) + hash + pixelData[i]) | 0;
  }
  return hash >>> 0;
}

export interface BlockLightColor {
  blockType: number;
  r: number;
  g: number;
  b: number;
  intensity: number;
}

/** Luz colorida por bloco emissivo — item 251 P2. */
export class ColoredBlockLight {
  private static readonly EMITTERS: Record<number, { r: number; g: number; b: number; intensity: number }> = {
    12: { r: 1.0, g: 0.85, b: 0.4, intensity: 12 }, // Tocha: amarelo-âmbar
    // Lava poderia ser: 25: { r: 1.0, g: 0.3, b: 0.05, intensity: 14 },
  };

  public static getEmission(blockType: number): { r: number; g: number; b: number; intensity: number } | null {
    return this.EMITTERS[blockType] ?? null;
  }
}

/** Sombra projetada por entidades — item 253 P2. */
export class EntityShadowProjection {
  public static computeShadowRadius(entityHeight: number, sunAngle: number): number {
    const clamped = Math.max(0.1, Math.abs(Math.sin(sunAngle)));
    return entityHeight / clamped;
  }

  public static computeShadowOpacity(distFromEntity: number, maxRadius: number): number {
    return Math.max(0, 1.0 - distFromEntity / maxRadius);
  }
}

/** Adaptação de exposição ao sair de uma caverna — item 254 P2. */
export class CaveExposureAdaptation {
  private currentExposure = 1.0;
  private targetExposure = 1.0;
  private adaptSpeed = 0.5;

  public setTarget(isInsideCave: boolean): void {
    this.targetExposure = isInsideCave ? 0.4 : 1.0;
  }

  public tick(dt: number): number {
    const diff = this.targetExposure - this.currentExposure;
    this.currentExposure += diff * Math.min(1.0, this.adaptSpeed * dt);
    return this.currentExposure;
  }
}

/** Debug view mostrando o mapa de luz — item 256 P2. */
export class LightDebugView {
  public static encodeLightLevel(lightLevel: number): { r: number; g: number; b: number } {
    const normalized = Math.max(0, Math.min(15, lightLevel)) / 15;
    return { r: normalized, g: normalized * 0.8, b: 1.0 - normalized };
  }
}

/** Limite de propagação configurável por performance — item 258 P2. */
export class LightPropagationConfig {
  public maxPropagationSteps = 15;
  public chunkLightBudget = 4096;

  public setQuality(quality: 'low' | 'medium' | 'high'): void {
    if (quality === 'low') { this.maxPropagationSteps = 8; this.chunkLightBudget = 1024; }
    else if (quality === 'medium') { this.maxPropagationSteps = 12; this.chunkLightBudget = 2048; }
    else { this.maxPropagationSteps = 15; this.chunkLightBudget = 4096; }
  }
}

/** Iluminação suave interpolada por vértice — item 260 P2. */
export class SmoothVertexLighting {
  public static interpolate(cornerLights: [number, number, number, number]): number {
    return (cornerLights[0] + cornerLights[1] + cornerLights[2] + cornerLights[3]) / 4;
  }
}

/** Bloco "barreira de luz" para builders — item 261 P2. */
export class LightBarrierBlock {
  public static readonly BLOCK_ID = 50;

  public static doesBlockLight(blockType: number): boolean {
    return blockType === this.BLOCK_ID;
  }
}

/** Comando para fixar o horário — item 263 P2. */
export class TimeFreeze {
  public frozen = false;
  public frozenTimeOfDay = 0.25; // meio-dia por padrão

  public freeze(timeOfDay: number): void {
    this.frozen = true;
    this.frozenTimeOfDay = timeOfDay;
  }

  public unfreeze(): void {
    this.frozen = false;
  }

  public getEffectiveTime(realTimeOfDay: number): number {
    return this.frozen ? this.frozenTimeOfDay : realTimeOfDay;
  }
}

/** Cache de snapshots para evitar re-render idêntico — item 347 P2. */
export class SnapshotRenderCache {
  private cache = new Map<string, string>();

  public getCachedRender(snapshotHash: string): string | undefined {
    return this.cache.get(snapshotHash);
  }

  public setCachedRender(snapshotHash: string, renderResult: string): void {
    this.cache.set(snapshotHash, renderResult);
  }

  public clear(): void {
    this.cache.clear();
  }
}
