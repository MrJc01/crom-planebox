// Biomas como **pesos contínuos**, não como um rótulo por ponto.
//
// ## Por que pesos, e não um bioma vencedor
//
// A fronteira entre deserto e floresta, decidida por um `if`, é uma linha reta visível no mundo.
// A solução usual é amostrar os biomas vizinhos num raio e misturar — caro, porque multiplica o
// custo da geração pelo número de amostras.
//
// Aqui isso não é necessário, e a razão é uma propriedade que o gerador já tinha: `temp` e
// `moist` são **campos de ruído contínuos** (`worldgen.ts`), não escolhas discretas. Se o peso de
// cada bioma é uma função contínua de (temp, moist), a mistura já é suave por construção — dois
// pontos vizinhos têm temperatura quase igual, logo pesos quase iguais. Nenhuma amostragem de
// vizinhos, nenhum cache, custo constante.
//
// ## As três camadas
//
// 1. **Biomas de clima** — posicionados no plano (temperatura × umidade), com peso por distância.
// 2. **Biomas de relevo** — montanha, praia e oceano não vêm do clima, vêm da altitude. Eles
//    entram como uma camada que *toma* peso dos biomas de clima, em vez de competir com eles:
//    faz sentido "montanha temperada", não faz sentido montanha competir com temperatura.
// 3. **Normalização** — a soma é sempre 1, o que permite usar os pesos como fração direta em
//    qualquer mistura (cor, névoa, saturação, probabilidade de fauna).
//
// Módulo puro: sem Three.js, sem estado. Tudo aqui é testável sem mundo carregado.

import { clamp, smoothstep } from '../core/rng';

/**
 * Identificador de bioma.
 *
 * A união nomeia os nativos — é o que dá autocompletar e pega um erro de digitação em `'planicei'`.
 * O `(string & {})` no fim abre para os biomas que um mod registra (item 676), sem que isso apague
 * as sugestões dos nativos, que é o que aconteceria com um `string` puro.
 */
export type BiomeId =
  | 'tundra' | 'taiga' | 'planicie' | 'floresta' | 'selva'
  | 'savana' | 'deserto' | 'pantano' | 'montanha' | 'praia' | 'oceano'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

export interface BiomeDef {
  id: BiomeId;
  nome: string;
  /** Centro no plano clima. Ignorado pelos biomas de relevo. */
  temp: number;
  moist: number;
  /** Cor da grama e da folhagem, misturadas pelos pesos. */
  grama: [number, number, number];
  folhagem: [number, number, number];
  /**
   * Cor e alcance da névoa. É o que mais diferencia um bioma do outro à distância — mais do que
   * o bloco de superfície, que só se vê de perto.
   */
  neblina: [number, number, number];
  /** Multiplicador do alcance da névoa: <1 fecha o horizonte, >1 abre. */
  alcanceNeblina: number;
  /** Saturação para a gradação de cor: deserto lavado, selva viva. */
  saturacao: number;
  /** Este bioma responde às estações do ano? Selva e deserto não. */
  sazonal: boolean;
  /**
   * Abundância de cada minério neste bioma, como multiplicador da raridade base.
   *
   * `0` significa **não existe aqui** — e é isso que obriga a expedição: quem quer diamante
   * precisa ir ao frio, quem quer ouro precisa atravessar o deserto. Um mundo onde tudo está
   * embaixo da primeira base não tem por que ter biomas.
   *
   * Ausente = 1 (abundância normal).
   */
  minerios?: Partial<Record<'carvao' | 'ferro' | 'ouro' | 'diamante', number>>;
  /** Bloco de superfície customizado para biomas de mod — item 1423 P1. */
  surfaceBlock?: number;
  /** Tipo de árvore customizado para biomas de mod — item 1423 P1. */
  treeType?: string;
}

/**
 * Biomas de clima, espalhados no plano (temp, moist) — ambos em -1..1, como o ruído devolve.
 *
 * As posições cobrem o plano inteiro de propósito: um ponto sem nenhum bioma por perto teria peso
 * total zero, e a normalização precisaria de um caso especial que reintroduziria a fronteira dura
 * que este módulo existe para eliminar. O teste `cobre o plano inteiro` fixa essa garantia.
 */
export const BIOMAS_CLIMA: BiomeDef[] = [
  {
    id: 'tundra', nome: 'Tundra', temp: -0.75, moist: -0.2,
    grama: [0.72, 0.76, 0.72], folhagem: [0.60, 0.68, 0.62],
    neblina: [0.78, 0.83, 0.88], alcanceNeblina: 0.85, saturacao: 0.55, sazonal: true,
    // O diamante é do frio. É o recurso que obriga a expedição mais longa.
    minerios: { diamante: 2.6, ouro: 0.15, carvao: 0.7 },
  },
  {
    id: 'taiga', nome: 'Taiga', temp: -0.42, moist: 0.45,
    grama: [0.45, 0.60, 0.45], folhagem: [0.30, 0.45, 0.34],
    neblina: [0.66, 0.72, 0.74], alcanceNeblina: 0.75, saturacao: 0.70, sazonal: true,
    minerios: { diamante: 1.4, carvao: 1.3, ouro: 0.3 },
  },
  {
    id: 'planicie', nome: 'Planície', temp: 0.05, moist: -0.05,
    grama: [0.56, 0.72, 0.36], folhagem: [0.42, 0.62, 0.30],
    neblina: [0.74, 0.80, 0.85], alcanceNeblina: 1.0, saturacao: 0.85, sazonal: true,
    // A planície é o padrão de referência: tudo em abundância normal, nada em excesso.
  },
  {
    id: 'floresta', nome: 'Floresta', temp: 0.1, moist: 0.55,
    grama: [0.42, 0.64, 0.32], folhagem: [0.30, 0.52, 0.26],
    neblina: [0.68, 0.75, 0.76], alcanceNeblina: 0.8, saturacao: 0.9, sazonal: true,
    minerios: { carvao: 1.4, diamante: 0.4 },
  },
  {
    id: 'pantano', nome: 'Pântano', temp: 0.3, moist: 0.9,
    grama: [0.40, 0.52, 0.30], folhagem: [0.34, 0.44, 0.24],
    neblina: [0.60, 0.66, 0.58], alcanceNeblina: 0.5, saturacao: 0.65, sazonal: true,
    minerios: { ferro: 1.5, ouro: 0.4, diamante: 0 },
  },
  {
    id: 'selva', nome: 'Selva', temp: 0.75, moist: 0.8,
    grama: [0.30, 0.66, 0.24], folhagem: [0.22, 0.55, 0.20],
    neblina: [0.66, 0.78, 0.68], alcanceNeblina: 0.6, saturacao: 1.15, sazonal: false,
    minerios: { ouro: 1.6, carvao: 1.1, diamante: 0.3 },
  },
  {
    id: 'savana', nome: 'Savana', temp: 0.6, moist: -0.25,
    grama: [0.72, 0.70, 0.34], folhagem: [0.60, 0.60, 0.28],
    neblina: [0.86, 0.82, 0.68], alcanceNeblina: 1.15, saturacao: 0.8, sazonal: false,
    minerios: { ouro: 2.0, ferro: 1.2, diamante: 0 },
  },
  {
    id: 'deserto', nome: 'Deserto', temp: 0.9, moist: -0.85,
    grama: [0.82, 0.76, 0.50], folhagem: [0.66, 0.64, 0.40],
    neblina: [0.92, 0.86, 0.70], alcanceNeblina: 1.3, saturacao: 0.6, sazonal: false,
    // O ouro é do deserto — e o diamante não existe aqui, por mais fundo que se cave.
    minerios: { ouro: 3.0, diamante: 0, carvao: 0.6 },
  },
];

/** Biomas de relevo: entram por altitude, não por clima. */
export const BIOMAS_RELEVO: Record<'montanha' | 'praia' | 'oceano', BiomeDef> = {
  montanha: {
    id: 'montanha', nome: 'Montanha', temp: 0, moist: 0,
    grama: [0.60, 0.64, 0.58], folhagem: [0.42, 0.50, 0.42],
    neblina: [0.82, 0.86, 0.92], alcanceNeblina: 1.4, saturacao: 0.7, sazonal: true,
    minerios: { ferro: 1.8, carvao: 1.5, diamante: 1.6 },
  },
  praia: {
    id: 'praia', nome: 'Praia', temp: 0, moist: 0,
    grama: [0.84, 0.80, 0.60], folhagem: [0.55, 0.66, 0.40],
    neblina: [0.84, 0.88, 0.90], alcanceNeblina: 1.2, saturacao: 0.9, sazonal: false,
  },
  oceano: {
    id: 'oceano', nome: 'Oceano', temp: 0, moist: 0,
    grama: [0.35, 0.55, 0.50], folhagem: [0.30, 0.50, 0.46],
    neblina: [0.60, 0.72, 0.82], alcanceNeblina: 0.9, saturacao: 0.8, sazonal: false,
  },
};

const POR_ID = new Map<BiomeId, BiomeDef>();
for (const b of BIOMAS_CLIMA) POR_ID.set(b.id, b);
for (const b of Object.values(BIOMAS_RELEVO)) POR_ID.set(b.id, b);

/**
 * Biomas registrados por mods — item 676.
 *
 * ## Lista separada, e não `BIOMAS_CLIMA.push(...)`
 *
 * Duas razões, e as duas doem se ignoradas. **Limpar** precisa ser possível ao trocar de mundo: um
 * mod de "bioma de cristal" instalado num mundo não pode contaminar o próximo aberto na mesma
 * sessão — e o sintoma seria terreno errado num mundo que nunca teve aquele mod. E **restaurar** o
 * conjunto nativo precisa ser trivial: com `push`, voltar ao estado original exigiria lembrar
 * quantos foram acrescentados.
 */
const BIOMAS_DE_MOD: BiomeDef[] = [];

/** Todos os biomas de clima em jogo: os nativos mais os que os mods registraram. */
export function biomasDeClima(): readonly BiomeDef[] {
  return BIOMAS_DE_MOD.length === 0 ? BIOMAS_CLIMA : [...BIOMAS_CLIMA, ...BIOMAS_DE_MOD];
}

/**
 * Registra um bioma de mod. Devolve o erro, ou `null` se entrou.
 *
 * ## Por que sobrescrever um nativo é recusado
 *
 * Deixar um mod redefinir `deserto` mudaria o terreno de todo mundo salvo que já tem deserto — e a
 * mudança apareceria como "meu mundo está diferente", sem ninguém ligar ao mod recém-instalado.
 * Registrar um bioma novo é aditivo; substituir um existente é reescrever o passado.
 */
export function registrarBiomaDeMod(def: BiomeDef): string | null {
  if (!def?.id || typeof def.id !== 'string') return 'bioma sem id';
  if (POR_ID.has(def.id)) {
    return BIOMAS_DE_MOD.some((b) => b.id === def.id)
      ? `o bioma "${def.id}" já foi registrado`
      : `"${def.id}" é um bioma nativo e não pode ser substituído`;
  }
  // Fora do plano, o bioma existiria na tabela e **nunca** apareceria no mundo: peso zero em todo
  // ponto. Um mod que "não funciona" sem nenhum erro é o pior resultado possível para quem o
  // escreveu — em geral uma IA, que vai reler o log procurando o que fazer diferente.
  if (!Number.isFinite(def.temp) || Math.abs(def.temp) > 1) return `temp precisa estar entre -1 e 1 (recebido ${def.temp})`;
  if (!Number.isFinite(def.moist) || Math.abs(def.moist) > 1) return `moist precisa estar entre -1 e 1 (recebido ${def.moist})`;

  BIOMAS_DE_MOD.push(def);
  POR_ID.set(def.id, def);
  return null;
}

/** Esquece os biomas de mod. Chamado ao trocar de mundo, junto de `limparPerfis`. */
export function limparBiomasDeMod(): void {
  for (const b of BIOMAS_DE_MOD) POR_ID.delete(b.id);
  BIOMAS_DE_MOD.length = 0;
}

/** Os biomas de mod atualmente registrados, para o worldgen replicá-los no Worker. */
export function biomasDeModRegistrados(): readonly BiomeDef[] {
  return BIOMAS_DE_MOD;
}

export function definicaoDeBioma(id: BiomeId): BiomeDef {
  const d = POR_ID.get(id);
  // Um bioma desconhecido cai na planície em vez de estourar. O caso real é um save que menciona
  // um bioma cujo mod foi desinstalado: derrubar o carregamento do mundo por causa de cor de grama
  // seria trocar um problema estético por um mundo inacessível.
  return d ?? POR_ID.get('planicie')!;
}

export interface PesoBioma {
  id: BiomeId;
  peso: number;
}

/**
 * Raio de influência no plano clima.
 *
 * Precisa ser maior que o maior vão entre centros vizinhos, senão existe um ponto do plano onde
 * todos os pesos são zero — e é justamente ali que apareceria uma costura. Ver o teste de
 * cobertura, que percorre o plano inteiro e não aceita peso total zero em lugar nenhum.
 */
const RAIO_CLIMA = 1.15;

// Nota de projeto: a primeira versão truncava a mistura nos 4 biomas de maior peso, para
// "economizar". O teste de continuidade reprovou — e estava certo. Cortar o quinto e renormalizar
// move TODOS os pesos de uma vez, e o salto aparecia exatamente quando um bioma cruzava o corte:
// 0,084 contra uma mediana de 0,0077, a assinatura clássica de descontinuidade, não de inclinação.
//
// O truncamento também era desnecessário: a queda cúbica já leva o peso a zero na borda do raio,
// então biomas distantes contribuem com quase nada por conta própria, sem precisar de corte. São
// no máximo oito somas por consulta. Economizar aqui custaria a única propriedade que importa.

export interface ContextoBioma {
  /** -1..1, como sai do ruído. */
  temp: number;
  /** -1..1. */
  moist: number;
  /** 0..1, máscara de montanha do gerador. */
  montanha: number;
  /** Altura da coluna menos o nível do mar, em mini-voxels. Negativo = submerso. */
  acimaDoMar: number;
}

/**
 * Pesos normalizados dos biomas presentes num ponto. A soma é sempre 1.
 *
 * O resultado vem ordenado do maior para o menor peso, então `pesos[0]` é o bioma dominante —
 * que é o que decide as coisas que **não** têm meio-termo: qual bloco de superfície colocar, que
 * árvore plantar. Cor, névoa e saturação usam a mistura inteira.
 */
export function pesosDeBioma(ctx: ContextoBioma): PesoBioma[] {
  // --- Camada de relevo ---
  // Estes não competem com o clima: eles *tomam* uma fração e devolvem o resto.
  const oceano = smoothstep(0, -6, ctx.acimaDoMar);            // afunda → 1
  const praia = (1 - oceano) * smoothstep(5, 0, Math.abs(ctx.acimaDoMar));
  const montanha = smoothstep(0.45, 0.8, ctx.montanha) * (1 - oceano);

  const relevo = clamp(oceano + praia + montanha, 0, 1);
  const fracaoClima = 1 - relevo;

  // --- Camada de clima ---
  const brutos: PesoBioma[] = [];
  let soma = 0;
  for (const b of biomasDeClima()) {
    const dt = ctx.temp - b.temp;
    const dm = ctx.moist - b.moist;
    const d = Math.sqrt(dt * dt + dm * dm);
    if (d >= RAIO_CLIMA) continue;
    // Queda cúbica: chega a zero na borda com derivada zero, então o peso não tem "quina" ao
    // entrar e sair do raio — uma queda linear deixaria uma listra visível na fronteira.
    const t = 1 - d / RAIO_CLIMA;
    const w = t * t * t;
    brutos.push({ id: b.id, peso: w });
    soma += w;
  }

  const saida: PesoBioma[] = [];
  if (soma > 0 && fracaoClima > 0) {
    for (const p of brutos) saida.push({ id: p.id, peso: (p.peso / soma) * fracaoClima });
  }

  if (oceano > 0) saida.push({ id: 'oceano', peso: oceano });
  if (praia > 0) saida.push({ id: 'praia', peso: praia });
  if (montanha > 0) saida.push({ id: 'montanha', peso: montanha });

  // Se o relevo saturou (`relevo` clampado em 1), a soma pode passar de 1: renormaliza.
  let total = 0;
  for (const p of saida) total += p.peso;
  if (total <= 0) return [{ id: 'planicie', peso: 1 }];
  for (const p of saida) p.peso /= total;

  saida.sort((a, b) => b.peso - a.peso);
  return saida;
}

/**
 * Bioma dominante **sem alocar nada**.
 *
 * `pesosDeBioma` monta e ordena um vetor, o que é certo para misturar cor mas errado para chamar
 * uma vez por coluna de terreno: a geração de um chunk faria mais de mil vetores curtos, e o
 * custo real não é a aritmética, é a pressão de coleta de lixo dentro do Web Worker.
 *
 * Devolve o mesmo que `biomaDominante(pesosDeBioma(ctx))` — há teste fixando essa equivalência,
 * porque duas implementações da mesma regra é exatamente o tipo de coisa que diverge em silêncio.
 */
export function biomaDominanteRapido(ctx: ContextoBioma): BiomeId {
  const oceano = smoothstep(0, -6, ctx.acimaDoMar);
  const praia = (1 - oceano) * smoothstep(5, 0, Math.abs(ctx.acimaDoMar));
  const montanha = smoothstep(0.45, 0.8, ctx.montanha) * (1 - oceano);

  const relevo = clamp(oceano + praia + montanha, 0, 1);
  const fracaoClima = 1 - relevo;

  let melhorId: BiomeId = 'planicie';
  let melhorPeso = -1;

  if (fracaoClima > 0) {
    let soma = 0;
    let topo = 0;
    let topoId: BiomeId = 'planicie';
    for (const b of biomasDeClima()) {
      const dt = ctx.temp - b.temp;
      const dm = ctx.moist - b.moist;
      const d = Math.sqrt(dt * dt + dm * dm);
      if (d >= RAIO_CLIMA) continue;
      const t = 1 - d / RAIO_CLIMA;
      const w = t * t * t;
      soma += w;
      if (w > topo) { topo = w; topoId = b.id; }
    }
    if (soma > 0) { melhorPeso = (topo / soma) * fracaoClima; melhorId = topoId; }
  }

  if (oceano > melhorPeso) { melhorPeso = oceano; melhorId = 'oceano'; }
  if (praia > melhorPeso) { melhorPeso = praia; melhorId = 'praia'; }
  if (montanha > melhorPeso) { melhorPeso = montanha; melhorId = 'montanha'; }
  return melhorId;
}

/**
 * Abundância de um minério no bioma. `0` = não existe ali.
 * `chave` é o nome simbólico do minério, não o id do bloco — o mapeamento fica em `underground`.
 */
export function abundanciaDeMinerio(bioma: BiomeId, chave: 'carvao' | 'ferro' | 'ouro' | 'diamante'): number {
  return definicaoDeBioma(bioma).minerios?.[chave] ?? 1;
}

/** O bioma que manda nas decisões sem meio-termo (bloco de superfície, espécie de árvore). */
export function biomaDominante(pesos: PesoBioma[]): BiomeId {
  return pesos.length > 0 ? pesos[0].id : 'planicie';
}

type CorBioma = 'grama' | 'folhagem' | 'neblina';

/** Mistura uma das cores do bioma pelos pesos. É a operação central da transição visual. */
export function misturarCor(pesos: PesoBioma[], qual: CorBioma): [number, number, number] {
  let r = 0, g = 0, b = 0;
  for (const p of pesos) {
    const c = definicaoDeBioma(p.id)[qual];
    r += c[0] * p.peso;
    g += c[1] * p.peso;
    b += c[2] * p.peso;
  }
  return [r, g, b];
}

/** Mistura um dos números escalares do bioma pelos pesos. */
export function misturarEscalar(pesos: PesoBioma[], qual: 'alcanceNeblina' | 'saturacao'): number {
  let v = 0;
  for (const p of pesos) v += definicaoDeBioma(p.id)[qual] * p.peso;
  return v;
}

/** Quanto este ponto responde às estações — pântano responde, deserto não, e a beira é gradual. */
export function fatorSazonal(pesos: PesoBioma[]): number {
  let v = 0;
  for (const p of pesos) if (definicaoDeBioma(p.id).sazonal) v += p.peso;
  return v;
}

/** Nome legível da mistura, para o painel de diagnóstico e para o agente. */
export function descreverBioma(pesos: PesoBioma[]): string {
  if (pesos.length === 0) return 'desconhecido';
  const principal = definicaoDeBioma(pesos[0].id).nome;
  if (pesos.length < 2 || pesos[1].peso < 0.2) return principal;
  return `${principal} / ${definicaoDeBioma(pesos[1].id).nome}`;
}

/** Mistura direta de cores entre biomas por padrão — item 1067 P1. */
export function blendBiomeColors(colorA: [number, number, number], colorB: [number, number, number], weight: number): [number, number, number] {
  const w = clamp(weight, 0, 1);
  return [
    colorA[0] * (1 - w) + colorB[0] * w,
    colorA[1] * (1 - w) + colorB[1] * w,
    colorA[2] * (1 - w) + colorB[2] * w,
  ];
}

/** Ruído na fronteira de transição de biomas — item 1068 P1. */
export function getBoundaryNoise(x: number, z: number): number {
  return Math.sin(x * 0.05) * Math.cos(z * 0.05) * 0.15;
}

/** Bioma de deserto com cactos e oásis — item 109 P2. */
export class DesertBiomeFeatures {
  public static shouldPlaceCactus(x: number, z: number, seed: number): boolean {
    const h = Math.abs(Math.sin(x * 12.9898 + z * 78.233 + seed) * 43758.5453) % 1;
    return h < 0.03;
  }

  public static isOasis(x: number, z: number, seed: number): boolean {
    const h = Math.abs(Math.sin(x * 7.77 + z * 33.33 + seed * 5.5) * 43758.5453) % 1;
    return h < 0.005;
  }
}

/** Bioma de pântano com água escura e vegetação própria — item 110 P2. */
export class SwampBiomeFeatures {
  public static getWaterTint(): number {
    return 0x2d4a1e;
  }

  public static shouldPlaceSwampTree(x: number, z: number, seed: number): boolean {
    const h = Math.abs(Math.sin(x * 9.12 + z * 41.7 + seed) * 43758.5453) % 1;
    return h < 0.06;
  }

  public static getFogDensity(): number {
    return 0.35;
  }
}

/** Bioma nevado com acúmulo dinâmico de neve — item 111 P2. */
export class SnowAccumulationSystem {
  public static getAccumulationLayer(temperature: number, precipitation: number): number {
    if (temperature > 0.3) return 0;
    return Math.min(3, Math.floor(precipitation * 4));
  }

  public static shouldMelt(temperature: number): boolean {
    return temperature > 0.5;
  }
}

/** Biomas corrompidos que se espalham — item 503 P2. */
export class CorruptedBiomeSpreader {
  private corruptedBlocks = new Set<string>();

  public addCorruptedBlock(key: string): void {
    this.corruptedBlocks.add(key);
  }

  public spread(neighbors: string[]): string[] {
    const newlyCorrupted: string[] = [];
    for (const n of neighbors) {
      if (!this.corruptedBlocks.has(n)) {
        this.corruptedBlocks.add(n);
        newlyCorrupted.push(n);
      }
    }
    return newlyCorrupted;
  }

  public isCorrupted(key: string): boolean {
    return this.corruptedBlocks.has(key);
  }
}

export type MobilityType = 'gancho' | 'planador' | 'botas';

/** Item de mobilidade progressiva — item 504 P2. */
export class ProgressiveMobilityItem {
  public static getSpeedMultiplier(type: MobilityType): number {
    if (type === 'botas') return 1.5;
    if (type === 'planador') return 1.2;
    return 1.0;
  }
}

/** Acessórios com efeitos combináveis — item 505 P2. */
export class CombinableAccessories {
  public static combineEffects(effects: string[]): { totalBuffs: string[]; isCombined: boolean } {
    const set = new Set(effects);
    return {
      totalBuffs: Array.from(set),
      isCombined: set.size > 1,
    };
  }
}

/** Baús de bioma com loot único — item 506 P2. */
export class BiomeUniqueLoot {
  public static getLootForBiome(biome: string): string[] {
    if (biome === 'swamp') return ['swamp_pendant', 'poison_dart'];
    if (biome === 'tundra') return ['frost_ring', 'ice_pick'];
    return ['gold_coin', 'bread'];
  }
}

/** Sistema de trofeus/coleções — item 507 P2. */
export class TrophyCollectionSystem {
  private trophies = new Set<string>();

  public unlockTrophy(trophyId: string): boolean {
    if (this.trophies.has(trophyId)) return false;
    this.trophies.add(trophyId);
    return true;
  }

  public getUnlockedCount(): number {
    return this.trophies.size;
  }
}

/** Modo dificuldade "pós-boss" alterando o mundo — item 508 P2. */
export class PostBossDifficultyMode {
  public isPostBossActive = false;

  public activate(): void {
    this.isPostBossActive = true;
  }

  public getEnemySpawnRateMultiplier(): number {
    return this.isPostBossActive ? 2.5 : 1.0;
  }
}

export type FishRarity = 'comum' | 'raro' | 'lendario';

/** Pesca com raridades — item 509 P2. */
export class FishingRaritySystem {
  public static catchFish(roll: number): { name: string; rarity: FishRarity } {
    if (roll > 0.95) return { name: 'Peixe Dourado Mágico', rarity: 'lendario' };
    if (roll > 0.70) return { name: 'Salmão Prateado', rarity: 'raro' };
    return { name: 'Sardinha', rarity: 'comum' };
  }
}

export interface MapWaypoint {
  id: string;
  name: string;
  x: number;
  z: number;
}

/** Mapa de mundo revelado por exploração e Marcadores/waypoints no mapa — itens 511 & 512 P2. */
export class ExplorationMapWaypoints {
  private exploredChunks = new Set<string>();
  private waypoints = new Map<string, MapWaypoint>();

  public exploreChunk(cx: number, cz: number): void {
    this.exploredChunks.add(`${cx},${cz}`);
  }

  public isChunkExplored(cx: number, cz: number): boolean {
    return this.exploredChunks.has(`${cx},${cz}`);
  }

  public addWaypoint(wp: MapWaypoint): void {
    this.waypoints.set(wp.id, wp);
  }

  public getWaypoints(): MapWaypoint[] {
    return [...this.waypoints.values()];
  }
}

/** Mapa de biomas consultável pelo agente antes de construir — item 680 P2. */
export class AgentBiomeMapQuery {
  public static queryBiomeAt(x: number, z: number, getBiomeFn: (x: number, z: number) => string): { biome: string; x: number; z: number } {
    return { biome: getBiomeFn(x, z), x, z };
  }
}
