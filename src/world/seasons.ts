// Estações do ano, configuráveis por bioma sem escrever código.
//
// ## O requisito, e por que ele decide o desenho
//
// O pedido foi: *"o bioma quero que seja fácil configurar as estações do ano, que muda o
// comportamento do bioma"*. A palavra que manda é **configurar**. Se uma estação nova exigisse um
// `switch` em algum lugar, a IA que cria um bioma teria de editar código do motor — exatamente o
// que o sistema de mods existe para evitar, e exatamente o tipo de edição que corrompe o mundo.
//
// Então uma estação, para um bioma, é uma **tabela de números**: quanto a folhagem puxa para o
// vermelho, quanto a temperatura sobe, quanto a planta cresce. O motor lê a tabela; ele não sabe
// o que é outono.
//
// ## Interpolação, não degrau
//
// O outono não chega num amanhecer. Todo valor é interpolado entre a estação atual e a próxima ao
// longo do ano — é por isso que os perfis são números e não enums: números se interpolam.
//
// ## O que o bioma pode dizer
//
// Um bioma declara `sazonal: false` (selva, deserto) e o ano inteiro passa sem efeito nenhum. E
// como `fatorSazonal` mistura pelos pesos, a beira entre selva e floresta tem meia estação — a
// floresta muda de cor e a selva ao lado não, com a transição no meio.

import { BiomeId, fatorSazonal, PesoBioma } from './biomes';

export type EstacaoId = 'primavera' | 'verao' | 'outono' | 'inverno';

export const ESTACOES: EstacaoId[] = ['primavera', 'verao', 'outono', 'inverno'];

export const NOMES_ESTACAO: Record<EstacaoId, string> = {
  primavera: 'Primavera',
  verao: 'Verão',
  outono: 'Outono',
  inverno: 'Inverno',
};

/** Dias de jogo por estação. Quatro estações = um ano de 32 dias, dois ciclos lunares completos. */
export const DIAS_POR_ESTACAO = 8;
export const DIAS_POR_ANO = DIAS_POR_ESTACAO * ESTACOES.length;

/**
 * O que uma estação faz com um bioma. **Só números** — é isto que permite configurar sem código.
 *
 * Todos são deltas ou multiplicadores em torno do neutro, e não valores absolutos: assim um
 * perfil parcial (só `folhagem`) funciona, e o que não foi dito fica como está.
 */
export interface PerfilSazonal {
  /** Deslocamento de matiz da folhagem, -1..1. Positivo puxa para o quente (outono). */
  folhagem: number;
  /** Deslocamento da cor da grama, mesma convenção. */
  grama: number;
  /** Delta de temperatura, na mesma escala de `temp` do gerador (-1..1). */
  temperatura: number;
  /** Delta de umidade. */
  umidade: number;
  /** Multiplicador da taxa de crescimento de plantas. 0 = parado. */
  crescimento: number;
  /** Multiplicador da duração do dia claro. <1 = noite mais longa. */
  duracaoDoDia: number;
  /** Multiplicador do peso da neve no sorteio de clima. */
  neve: number;
}

const NEUTRO: PerfilSazonal = {
  folhagem: 0, grama: 0, temperatura: 0, umidade: 0,
  crescimento: 1, duracaoDoDia: 1, neve: 1,
};

/**
 * Perfis padrão, usados por qualquer bioma sazonal que não declare os próprios.
 *
 * Um bioma que só quer "um inverno mais duro" sobrescreve `inverno` e herda o resto — é a razão
 * de `definirPerfil` aceitar `Partial`.
 */
export const PERFIS_PADRAO: Record<EstacaoId, PerfilSazonal> = {
  primavera: { folhagem: -0.15, grama: -0.1, temperatura: 0.05, umidade: 0.25, crescimento: 1.6, duracaoDoDia: 1.0, neve: 0.2 },
  verao: { folhagem: -0.05, grama: 0, temperatura: 0.35, umidade: -0.1, crescimento: 1.2, duracaoDoDia: 1.15, neve: 0 },
  outono: { folhagem: 0.75, grama: 0.4, temperatura: -0.05, umidade: 0.05, crescimento: 0.5, duracaoDoDia: 0.9, neve: 0.4 },
  inverno: { folhagem: 0.25, grama: 0.5, temperatura: -0.45, umidade: -0.2, crescimento: 0, duracaoDoDia: 0.78, neve: 2.5 },
};

/**
 * Perfis por bioma. Vazio por padrão: quem não declara nada usa `PERFIS_PADRAO`.
 *
 * É um registro mutável de propósito — é o ponto de extensão que um mod usa, pela ferramenta
 * `configure_biome_seasons`, sem tocar em nenhuma linha deste arquivo.
 */
const PERFIS_POR_BIOMA = new Map<BiomeId, Partial<Record<EstacaoId, Partial<PerfilSazonal>>>>();

/**
 * Registra (ou ajusta) o comportamento sazonal de um bioma.
 *
 * Aceita parcial em dois níveis: só algumas estações, e dentro delas só alguns campos. Um mod que
 * quer "no meu bioma o inverno não para o crescimento" escreve exatamente isso e nada mais.
 */
export function definirPerfil(
  bioma: BiomeId,
  perfis: Partial<Record<EstacaoId, Partial<PerfilSazonal>>>,
): void {
  const atual = PERFIS_POR_BIOMA.get(bioma) ?? {};
  for (const est of ESTACOES) {
    if (perfis[est]) atual[est] = { ...(atual[est] ?? {}), ...perfis[est] };
  }
  PERFIS_POR_BIOMA.set(bioma, atual);
}

/** Devolve tudo ao padrão. Usado ao trocar de mundo e pelos testes. */
export function limparPerfis(): void {
  PERFIS_POR_BIOMA.clear();
}

/** O perfil efetivo de um bioma numa estação: o declarado por cima do padrão. */
export function perfilDe(bioma: BiomeId, estacao: EstacaoId): PerfilSazonal {
  return { ...PERFIS_PADRAO[estacao], ...(PERFIS_POR_BIOMA.get(bioma)?.[estacao] ?? {}) };
}

/** Posição no ano, 0..1. */
export function posicaoNoAno(dia: number): number {
  const d = dia / DIAS_POR_ANO;
  return d - Math.floor(d);
}

/** Estação vigente no dia informado. */
export function estacaoDoDia(dia: number): EstacaoId {
  const i = Math.floor(posicaoNoAno(dia) * ESTACOES.length) % ESTACOES.length;
  return ESTACOES[i];
}

/**
 * Estação seguinte e o quanto da travessia já passou.
 *
 * A travessia ocupa o **último terço** de cada estação, e não o ano inteiro: o meio do outono
 * deve ser outono de verdade, não uma média perpétua entre verão e inverno. Sem esse platô,
 * nenhuma estação teria caráter próprio.
 */
export function travessia(dia: number): { de: EstacaoId; para: EstacaoId; t: number } {
  const pos = posicaoNoAno(dia) * ESTACOES.length;
  const i = Math.floor(pos) % ESTACOES.length;
  const dentro = pos - Math.floor(pos);
  const INICIO_TRAVESSIA = 2 / 3;
  const t = dentro < INICIO_TRAVESSIA ? 0 : (dentro - INICIO_TRAVESSIA) / (1 - INICIO_TRAVESSIA);
  return { de: ESTACOES[i], para: ESTACOES[(i + 1) % ESTACOES.length], t };
}

function misturar(a: PerfilSazonal, b: PerfilSazonal, t: number): PerfilSazonal {
  const f = (x: number, y: number): number => x + (y - x) * t;
  return {
    folhagem: f(a.folhagem, b.folhagem),
    grama: f(a.grama, b.grama),
    temperatura: f(a.temperatura, b.temperatura),
    umidade: f(a.umidade, b.umidade),
    crescimento: f(a.crescimento, b.crescimento),
    duracaoDoDia: f(a.duracaoDoDia, b.duracaoDoDia),
    neve: f(a.neve, b.neve),
  };
}

/** Interpola um perfil na direção do neutro. `forca = 0` devolve o neutro exato. */
function atenuar(p: PerfilSazonal, forca: number): PerfilSazonal {
  return misturar(NEUTRO, p, Math.max(0, Math.min(1, forca)));
}

export interface EstadoSazonal {
  estacao: EstacaoId;
  proxima: EstacaoId;
  /** 0 = no coração da estação; 1 = trocando agora. */
  travessia: number;
  /** Quanto este ponto responde às estações, pelos pesos de bioma. */
  forca: number;
  /** Perfil já interpolado no tempo e atenuado pela força — é o que o resto do jogo consome. */
  efeito: PerfilSazonal;
}

/**
 * Estado sazonal de um ponto do mundo.
 *
 * Recebe os **pesos de bioma**, e não um bioma só, por dois motivos: `fatorSazonal` derruba o
 * efeito na beira da selva sem degrau, e o perfil é a média ponderada dos biomas presentes — a
 * fronteira entre tundra e floresta tem um inverno intermediário, não o inverno de um dos dois.
 */
export function estadoSazonal(dia: number, pesos: PesoBioma[]): EstadoSazonal {
  const { de, para, t } = travessia(dia);
  const forca = fatorSazonal(pesos);

  // Média ponderada dos perfis dos biomas presentes.
  let acc: PerfilSazonal = { ...NEUTRO, crescimento: 0, duracaoDoDia: 0, neve: 0 };
  let somaPeso = 0;
  for (const p of pesos) {
    const perfil = misturar(perfilDe(p.id, de), perfilDe(p.id, para), t);
    acc = {
      folhagem: acc.folhagem + perfil.folhagem * p.peso,
      grama: acc.grama + perfil.grama * p.peso,
      temperatura: acc.temperatura + perfil.temperatura * p.peso,
      umidade: acc.umidade + perfil.umidade * p.peso,
      crescimento: acc.crescimento + perfil.crescimento * p.peso,
      duracaoDoDia: acc.duracaoDoDia + perfil.duracaoDoDia * p.peso,
      neve: acc.neve + perfil.neve * p.peso,
    };
    somaPeso += p.peso;
  }
  if (somaPeso <= 0) acc = { ...NEUTRO };

  return { estacao: de, proxima: para, travessia: t, forca, efeito: atenuar(acc, forca) };
}

/** Nome legível, mostrando a travessia quando há uma. */
export function descreverEstacao(e: EstadoSazonal): string {
  const base = NOMES_ESTACAO[e.estacao];
  if (e.travessia <= 0) return base;
  return `${base} → ${NOMES_ESTACAO[e.proxima]} (${Math.round(e.travessia * 100)}%)`;
}
