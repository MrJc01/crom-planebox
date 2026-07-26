// Clima do mundo: estado, transições e como o bioma restringe o que pode acontecer.
//
// ## Determinístico, e por quê
//
// Nada aqui usa `Math.random`. A sequência de climas de um mundo é função de (semente, dia) —
// duas razões:
//
//  1. **P2P.** O mundo roda no cliente, mas há outra ponta. Um clima sorteado localmente daria
//     chuva na tela de um jogador e sol na do outro, no mesmo lugar. Sincronizar o estado a cada
//     mudança seria tráfego desnecessário para algo que os dois lados podem *derivar*.
//  2. **Save.** Recarregar o mundo não deve trocar o clima. Sem determinismo, seria preciso
//     gravar o estado e o tempo restante, e qualquer save antigo cairia num caso especial.
//
// O anfitrião ainda manda: se um mod forçar chuva, isso é um estado imposto que viaja pela rede.
// Mas o padrão — o que acontece sem ninguém mandar — é derivado, e por isso é grátis.
//
// ## O bioma restringe, não escolhe
//
// Não neva no deserto e não chove na tundra (vira neve). Em vez de cada bioma ter sua tabela de
// clima, o clima é sorteado uma vez para o mundo e depois **traduzido** pelo bioma local. Assim o
// jogador que atravessa a fronteira vê a chuva virar neve, e não dois climas independentes
// brigando na mesma tela.

import { BiomeId } from './biomes';

export type ClimaId = 'limpo' | 'nublado' | 'chuva' | 'tempestade' | 'neve' | 'neblina';

export interface ClimaDef {
  id: ClimaId;
  nome: string;
  /** Peso no sorteio. Limpo é o padrão do mundo, e domina de propósito. */
  peso: number;
  /** Multiplica o alcance da névoa do bioma: tempestade fecha o horizonte. */
  alcanceNeblina: number;
  /** Escurece a luz do céu. 1 = sem efeito. */
  luz: number;
  /** Partículas por segundo, quando houver o sistema de partículas (item 1100). */
  particulas: number;
  /** Tem trovão? */
  raios: boolean;
  /** Molha o chão — escurece e satura a cor do terreno. */
  molha: boolean;
}

export const CLIMAS: Record<ClimaId, ClimaDef> = {
  limpo: { id: 'limpo', nome: 'Limpo', peso: 46, alcanceNeblina: 1.0, luz: 1.0, particulas: 0, raios: false, molha: false },
  nublado: { id: 'nublado', nome: 'Nublado', peso: 24, alcanceNeblina: 0.88, luz: 0.82, particulas: 0, raios: false, molha: false },
  chuva: { id: 'chuva', nome: 'Chuva', peso: 16, alcanceNeblina: 0.6, luz: 0.62, particulas: 900, raios: false, molha: true },
  tempestade: { id: 'tempestade', nome: 'Tempestade', peso: 5, alcanceNeblina: 0.38, luz: 0.42, particulas: 1800, raios: true, molha: true },
  neve: { id: 'neve', nome: 'Neve', peso: 5, alcanceNeblina: 0.55, luz: 0.78, particulas: 600, raios: false, molha: false },
  neblina: { id: 'neblina', nome: 'Neblina', peso: 4, alcanceNeblina: 0.3, luz: 0.9, particulas: 0, raios: false, molha: false },
};

const ORDEM: ClimaId[] = ['limpo', 'nublado', 'chuva', 'tempestade', 'neve', 'neblina'];

/** Duração de um bloco de clima, em dias de jogo. */
const DURACAO_MIN = 0.35;
const DURACAO_MAX = 1.4;

/** Tempo de transição entre dois climas, em dias de jogo. */
export const TRANSICAO = 0.06;

/**
 * Ruído inteiro determinístico. Não é um gerador de qualidade criptográfica, e nem precisa: o
 * requisito é só que a mesma entrada dê sempre a mesma saída, em qualquer máquina.
 */
function hash(a: number, b: number): number {
  let h = (a * 0x27d4eb2d) ^ (b * 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/**
 * Sorteia um clima pelos pesos. `r` deve estar em 0..1.
 * Separado para poder ser testado sem inventar sementes até cair no caso desejado.
 */
export function climaPorSorteio(r: number): ClimaId {
  let total = 0;
  for (const id of ORDEM) total += CLIMAS[id].peso;
  let acc = 0;
  const alvo = Math.max(0, Math.min(0.999999, r)) * total;
  for (const id of ORDEM) {
    acc += CLIMAS[id].peso;
    if (alvo < acc) return id;
  }
  return 'limpo';
}

export interface BlocoDeClima {
  clima: ClimaId;
  /** Início e fim em dias de jogo (fracionários). */
  inicio: number;
  fim: number;
  /** Índice do bloco na sequência — a chave do determinismo. */
  indice: number;
}

/**
 * O bloco de clima vigente num instante do mundo.
 *
 * Percorre a sequência desde o início. Parece caro, mas cada bloco dura pelo menos 0,35 dia, e a
 * varredura anda em passos de bloco, não de tempo — mil dias de jogo são ~2.800 iterações de
 * aritmética simples, e o resultado é memoizado no `EstadoDoClima`.
 */
export function blocoEm(semente: number, dia: number): BlocoDeClima {
  let inicio = 0;
  let i = 0;
  // Limite de segurança: sem ele, um `dia` NaN ou infinito viraria laço infinito e travaria o
  // jogo inteiro. Um mundo com um clima preso é ruim; um mundo congelado é pior.
  const MAX_PASSOS = 200000;
  for (; i < MAX_PASSOS; i++) {
    const duracao = DURACAO_MIN + hash(semente, i * 2 + 1) * (DURACAO_MAX - DURACAO_MIN);
    const fim = inicio + duracao;
    if (dia < fim || !Number.isFinite(dia)) {
      return { clima: climaPorSorteio(hash(semente, i * 2)), inicio, fim, indice: i };
    }
    inicio = fim;
  }
  return { clima: 'limpo', inicio, fim: inicio + DURACAO_MAX, indice: i };
}

/**
 * Traduz um clima para o que faz sentido no bioma local.
 *
 * É aqui que "não neva no deserto" acontece. A tradução é por bioma **dominante**, e não pela
 * mistura, porque clima não tem meio-termo: não existe 40% de chuva e 60% de neve caindo juntas.
 * A transição entre os dois se vê ao atravessar a fronteira, quando o dominante muda.
 */
export function climaNoBioma(clima: ClimaId, bioma: BiomeId): ClimaId {
  const gelado = bioma === 'tundra' || bioma === 'taiga' || bioma === 'montanha';
  const arido = bioma === 'deserto' || bioma === 'savana';

  if (gelado) {
    if (clima === 'chuva') return 'neve';
    if (clima === 'tempestade') return 'neve';
    return clima;
  }
  if (arido) {
    // O deserto não fica sem tempo nenhum — ele fica limpo, que é o clima dele.
    if (clima === 'neve' || clima === 'chuva' || clima === 'neblina') return 'limpo';
    if (clima === 'tempestade') return 'nublado';
    return clima;
  }
  // Pântano troca o limpo por neblina com frequência — é a identidade do bioma.
  if (bioma === 'pantano' && clima === 'limpo') return 'neblina';
  if (clima === 'neve') return 'chuva';
  return clima;
}

export interface ClimaAtual {
  /** O clima vigente, já traduzido pelo bioma. */
  clima: ClimaId;
  /** Para onde está indo. Igual a `clima` quando não há transição em curso. */
  proximo: ClimaId;
  /** 0..1 — quanto da transição já passou. 1 = estável. */
  progresso: number;
  /** Efeitos já interpolados entre `clima` e `proximo`. Use estes, não os da definição. */
  alcanceNeblina: number;
  luz: number;
  particulas: number;
  /** Verdadeiro se qualquer um dos dois lados da transição tem raios. */
  raios: boolean;
  molha: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Estado do clima num instante, com a transição já resolvida.
 *
 * A transição acontece no **fim** do bloco, não no começo: o clima que está terminando se mistura
 * com o que vem. Fazer no começo daria um pulo no instante da troca — que é justamente o que a
 * transição existe para evitar.
 */
export function climaEm(semente: number, dia: number, bioma: BiomeId, forcado?: ClimaId): ClimaAtual {
  if (forcado) {
    const d = CLIMAS[forcado];
    return {
      clima: forcado, proximo: forcado, progresso: 1,
      alcanceNeblina: d.alcanceNeblina, luz: d.luz, particulas: d.particulas,
      raios: d.raios, molha: d.molha ? 1 : 0,
    };
  }

  const bloco = blocoEm(semente, dia);
  const atual = climaNoBioma(bloco.clima, bioma);

  const restante = bloco.fim - dia;
  let proximo = atual;
  let t = 1;
  if (restante < TRANSICAO) {
    const seguinte = blocoEm(semente, bloco.fim + 1e-6);
    proximo = climaNoBioma(seguinte.clima, bioma);
    t = 1 - restante / TRANSICAO; // 0 no início da transição, 1 ao trocar
  }

  const a = CLIMAS[atual];
  const b = CLIMAS[proximo];
  return {
    clima: atual,
    proximo,
    progresso: t,
    alcanceNeblina: lerp(a.alcanceNeblina, b.alcanceNeblina, t),
    luz: lerp(a.luz, b.luz, t),
    particulas: lerp(a.particulas, b.particulas, t),
    raios: (a.raios && t < 0.5) || (b.raios && t >= 0.5),
    molha: lerp(a.molha ? 1 : 0, b.molha ? 1 : 0, t),
  };
}

/** Nome legível, incluindo a transição — para o painel F3 e para o agente. */
export function descreverClima(c: ClimaAtual): string {
  if (c.clima === c.proximo) return CLIMAS[c.clima].nome;
  return `${CLIMAS[c.clima].nome} → ${CLIMAS[c.proximo].nome} (${Math.round(c.progresso * 100)}%)`;
}
