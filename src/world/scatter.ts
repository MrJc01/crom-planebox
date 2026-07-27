// Construções espalhadas pelo mundo: onde nascem, de que tipo, e se o terreno aceita.
//
// ## Uma grade só, com as regras competindo pela célula
//
// As árvores já usam grade com vencedor único: cada célula sorteia uma posição e no máximo uma
// árvore. Uma grade com um vencedor **garante o espaçamento por construção**, sem nenhuma
// varredura de vizinhança.
//
// A primeira versão deste módulo deu uma grade **por regra**, e um teste reprovou: a garantia
// valia dentro de cada regra, não entre elas. Na savana, que aceita casa e muro, as duas grades
// tinham arestas diferentes e as estruturas nasceram sobrepostas.
//
// A correção não foi rejeitar colisões depois — isso quebraria a localidade, porque a rejeição
// passaria a depender do que mais estivesse na janela de varredura, e uma estrutura na fronteira
// de dois chunks apareceria num e não no outro. A correção foi **uma grade só**: a célula sorteia
// se tem estrutura, e as regras válidas para aquele bioma competem por ela. O espaçamento volta a
// ser garantia, e a decisão continua local.
//
// ## O que este módulo NÃO faz
//
// Não coloca blocos. Ele decide **se, onde e qual** — tudo função pura de (semente, célula), o
// que permite testar a distribuição inteira sem gerar um voxel. Quem carimba os blocos é o
// `worldgen`, que é onde está o vetor do chunk.
//
// ## Assentar no terreno
//
// Uma estrutura que flutua ou afunda estraga mais que a ausência dela. Duas defesas:
//
//  1. **Rejeição por desnível.** Antes de aceitar o sítio, mede a variação de altura sob a
//     pegada. Terreno acidentado demais simplesmente não recebe construção — é mais barato e
//     mais bonito que tentar consertar depois.
//  2. **Fundação.** O que sobrar de vão entre a base e o chão é preenchido pelo `worldgen`.

import { hash2 } from '../core/rng';
import { BiomeId } from './biomes';
import { SCALE } from './chunk';
import { WATER_LEVEL } from './worldgen';

/**
 * Aresta da célula global, em mini-voxels (~87 m). **É o espaçamento mínimo garantido**: com um
 * vencedor por célula, duas estruturas nunca ficam mais perto que a largura de uma célula menos
 * as margens.
 */
export const CELULA = 260;

/**
 * Chance de uma célula conter alguma estrutura.
 *
 * Baixa de propósito. Uma estrutura que se encontra a cada dois minutos deixa de ser um achado e
 * vira mobília; o valor de uma construção espalhada está em ela ser notável.
 */
export const DENSIDADE = 0.3;

export interface RegraDeEspalhamento {
  /** Id do template em `STRUCTURE_TEMPLATES`. */
  template: string;
  /** Peso relativo na disputa pela célula, entre as regras válidas para o bioma. */
  peso: number;
  /** Biomas onde pode nascer. Lista vazia = nenhum (regra desativada). */
  biomas: BiomeId[];
  /** Meia-largura da pegada, em mini-voxels — usada na medição de desnível. */
  pegada: number;
  /** Desnível máximo tolerado sob a pegada, em mini-voxels. */
  desnivelMax: number;
  /** Altura mínima acima do nível do mar, em mini-voxels. Evita construção com o pé na água. */
  alturaMinAcimaDoMar: number;
}

export const REGRAS: RegraDeEspalhamento[] = [
  {
    template: 'small_house',
    peso: 3,
    biomas: ['planicie', 'floresta', 'savana'],
    pegada: 5,
    desnivelMax: 3,
    alturaMinAcimaDoMar: 2,
  },
  {
    template: 'tower',
    peso: 2,
    // A torre é do alto e do frio: é o que a torna referência visual à distância.
    biomas: ['montanha', 'tundra', 'taiga'],
    pegada: 4,
    desnivelMax: 4,
    alturaMinAcimaDoMar: 6,
  },
  {
    template: 'wall',
    peso: 2,
    // Muro solto no árido lê como ruína — restos de algo que existiu ali.
    biomas: ['deserto', 'savana'],
    pegada: 6,
    desnivelMax: 2,
    alturaMinAcimaDoMar: 2,
  },
];

/**
 * Regras registradas por mods — item 689.
 *
 * Lista separada da nativa pelos mesmos dois motivos dos biomas: **limpar** ao trocar de mundo (um
 * mod de um mundo não pode espalhar as estruturas dele no próximo aberto na mesma sessão) e
 * **restaurar** o conjunto nativo sem precisar lembrar quantas foram acrescentadas.
 */
const REGRAS_DE_MOD: RegraDeEspalhamento[] = [];

/** Todas as regras em jogo: as nativas mais as dos mods. */
export function regrasDeEspalhamento(): RegraDeEspalhamento[] {
  return REGRAS_DE_MOD.length === 0 ? REGRAS : [...REGRAS, ...REGRAS_DE_MOD];
}

/**
 * Registra uma regra de mod. Devolve o erro, ou `null` se entrou.
 *
 * A pegada tem teto porque ela decide a **margem** da posição dentro da célula: uma pegada maior
 * que meia célula não deixaria posição nenhuma sobrando, e a estrutura invadiria a célula vizinha —
 * quebrando a garantia de espaçamento mínimo que é a razão de este sistema existir.
 */
export function registrarRegraDeMod(regra: RegraDeEspalhamento): string | null {
  if (!regra?.template) return 'regra sem template';
  if (!Array.isArray(regra.biomas) || regra.biomas.length === 0) {
    // Uma regra sem bioma nunca ganha célula nenhuma: existiria na tabela e não no mundo.
    return 'a regra precisa de ao menos um bioma';
  }
  if (!(regra.peso > 0)) return 'peso precisa ser maior que zero';
  const teto = Math.floor(CELULA / 4);
  if (!(regra.pegada > 0) || regra.pegada > teto) {
    return `pegada precisa estar entre 1 e ${teto} (recebido ${regra.pegada})`;
  }
  if (REGRAS_DE_MOD.some((r) => r.template === regra.template)) {
    return `já existe uma regra para o template "${regra.template}"`;
  }
  REGRAS_DE_MOD.push(regra);
  return null;
}

/** Esquece as regras de mod. Chamado ao trocar de mundo. */
export function limparRegrasDeMod(): void {
  REGRAS_DE_MOD.length = 0;
}

/** As regras de mod registradas, para o worldgen replicá-las no Worker. */
export function regrasDeModRegistradas(): readonly RegraDeEspalhamento[] {
  return REGRAS_DE_MOD;
}

/**
 * Maior pegada entre as regras em jogo — define a margem da posição dentro da célula.
 *
 * Função, e não constante calculada na carga do módulo: com uma constante, uma regra de mod com
 * pegada maior que todas as nativas usaria uma margem pequena demais, e a estrutura dela vazaria
 * para a célula vizinha. O espaçamento mínimo — a única garantia que este arquivo dá — deixaria de
 * valer, e só para quem instalasse aquele mod.
 */
function maiorPegada(regras: RegraDeEspalhamento[]): number {
  return regras.reduce((m, r) => Math.max(m, r.pegada), 0);
}

export interface SitioDeEstrutura {
  template: string;
  /** Coluna âncora, em mini-voxels absolutos. */
  x: number;
  z: number;
  /** Y da base, já assentado no terreno. */
  y: number;
  /** Meia-largura da pegada, para a fundação. */
  pegada: number;
}

/** O que este módulo precisa saber do terreno para decidir. */
export interface SondaDeTerreno {
  /** Altura da coluna, em mini-voxels. */
  altura(x: number, z: number): number;
  /** Bioma dominante da coluna. */
  bioma(x: number, z: number): BiomeId;
  /** Intensidade de rio (0..1) — não se constrói dentro do leito. */
  rio(x: number, z: number): number;
  /** Intensidade de estrada (0..1). Construção **junto** à estrada é bom; em cima dela, não. */
  estrada(x: number, z: number): number;
}

/**
 * A estrutura desta célula, se houver.
 *
 * A ordem das checagens é do mais barato para o mais caro, e isso importa: a densidade reprova a
 * maioria das células com um único `hash2`, e só o que sobra paga as consultas de terreno.
 */
export function estruturaNaCelula(
  semente: number,
  gx: number,
  gz: number,
  terreno: SondaDeTerreno,
  regras: RegraDeEspalhamento[] = regrasDeEspalhamento(),
): SitioDeEstrutura | null {
  if (hash2(gx, gz, semente ^ 0x5771) >= DENSIDADE) return null;

  // Posição dentro da célula, com margem para a maior pegada possível não vazar para a vizinha.
  // A margem usa a MAIOR pegada, e não a da regra escolhida, porque a posição é sorteada antes
  // de saber qual regra vence — e mudar a posição conforme a regra reabriria a sobreposição.
  const margem = maiorPegada(regras) + 1;
  const util = Math.max(1, CELULA - margem * 2);
  const x = gx * CELULA + margem + Math.floor(hash2(gx, gz, semente ^ 0x1a2b) * util);
  const z = gz * CELULA + margem + Math.floor(hash2(gx, gz, semente ^ 0x3c4d) * util);

  const bioma = terreno.bioma(x, z);
  if (terreno.rio(x, z) > 0.15) return null;
  if (terreno.estrada(x, z) > 0.3) return null;

  // Quem pode nascer aqui, e a disputa pela célula.
  let total = 0;
  for (const r of regras) if (r.biomas.includes(bioma)) total += r.peso;
  if (total <= 0) return null;

  let sorteio = hash2(gx, gz, semente ^ 0x7f7f) * total;
  let regra: RegraDeEspalhamento | null = null;
  for (const r of regras) {
    if (!r.biomas.includes(bioma)) continue;
    sorteio -= r.peso;
    if (sorteio < 0) { regra = r; break; }
  }
  if (!regra) return null;

  const alturaCentro = terreno.altura(x, z);
  if (alturaCentro < WATER_LEVEL + regra.alturaMinAcimaDoMar) return null;

  // Desnível sob a pegada. Quatro cantos e o centro bastam: o que se quer rejeitar é encosta,
  // e encosta aparece nos cantos. Amostrar a pegada inteira custaria dezenas de `column()` por
  // candidato para detectar a mesma coisa.
  const p = regra.pegada;
  let menor = alturaCentro;
  let maior = alturaCentro;
  for (const [dx, dz] of [[-p, -p], [p, -p], [-p, p], [p, p]] as const) {
    const h = terreno.altura(x + dx, z + dz);
    if (h < menor) menor = h;
    if (h > maior) maior = h;
  }
  if (maior - menor > regra.desnivelMax) return null;

  // Assenta no ponto mais BAIXO da pegada, e o vão vira fundação. Assentar no mais alto deixaria
  // a construção sobre pernas de ar no lado da descida.
  return { template: regra.template, x, z, y: menor, pegada: p };
}

/**
 * Todas as estruturas cujas células tocam a região pedida.
 *
 * A região vem com margem, porque uma estrutura ancorada fora do chunk ainda pode invadi-lo —
 * é o mesmo motivo do `DECOR_MARGIN` das copas de árvore.
 */
export function estruturasNaRegiao(
  semente: number,
  x0: number, z0: number, x1: number, z1: number,
  terreno: SondaDeTerreno,
  regras: RegraDeEspalhamento[] = regrasDeEspalhamento(),
): SitioDeEstrutura[] {
  const saida: SitioDeEstrutura[] = [];
  const gx0 = Math.floor(x0 / CELULA);
  const gx1 = Math.floor(x1 / CELULA);
  const gz0 = Math.floor(z0 / CELULA);
  const gz1 = Math.floor(z1 / CELULA);
  for (let gx = gx0; gx <= gx1; gx++) {
    for (let gz = gz0; gz <= gz1; gz++) {
      const s = estruturaNaCelula(semente, gx, gz, terreno, regras);
      if (s) saida.push(s);
    }
  }
  return saida;
}

/**
 * Espaçamento mínimo garantido entre duas estruturas quaisquer, em metros.
 *
 * Consulta as regras **em jogo**, incluindo as de mod: uma regra de mod com pegada maior muda a
 * margem, e um valor calculado só sobre as nativas prometeria uma garantia que deixou de valer.
 */
export function espacamentoMinimo(): number {
  // Pior caso: duas âncoras em células adjacentes, cada uma colada na borda comum. Cada uma fica a
  // `margem` da borda, então a distância entre elas é `2 × margem`, menos as pegadas.
  //
  // A álgebra **cancela a pegada**: `2(p+1) − 2p = 2`, sempre. Isso não é um acidente e vale dizer,
  // porque a fórmula parece depender de `p` e não depende — a margem é definida como `pegada + 1`
  // justamente para garantir um voxel de folga de cada lado, **qualquer que seja a pegada**. Uma
  // regra de mod com pegada enorme continua respeitando a mesma folga; o que ela consome é o espaço
  // útil onde a âncora pode cair dentro da célula, e é por isso que a pegada tem teto no registro.
  const p = maiorPegada(regrasDeEspalhamento());
  return ((p + 1) * 2 - p * 2) / SCALE;
}
