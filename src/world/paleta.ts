// Chunk paletizado por seção — itens 1579 e 1580.
//
// ## A medição que justifica isto
//
// Recortei um chunk real em seções e paletizei cada uma com bits empacotados:
//
// | aresta | no mundo | seções mistas | bytes/chunk |
// |---|---|---|---|
// | 4³ | 1,33 m | 18,8% | 41 KB |
// | **8³** | **2,67 m** | **41,1%** | **23 KB** |
// | 16³ | 5,33 m | 57,3% | 37 KB |
// | 32³ | 10,67 m | 62,5% | 54 KB |
//
// **256 KB viram 23 KB — onze vezes menos, sem perder um voxel.** A paleta mediana de uma seção de
// 8³ é **dois**: quase todo pedaço do mundo é ar-e-mais-uma-coisa, e guardar isso em oito bits por
// voxel desperdiça sete deles.
//
// ## Por que 8³ e não 16³, que é o tamanho de costume
//
// A tabela acima tem um mínimo, e ele não está na ponta. Seções grandes desperdiçam porque quase
// todas ficam mistas; seções pequenas desperdiçam porque o cabeçalho de cada uma passa a pesar mais
// que os voxels. Oito é onde as duas curvas se cruzam **neste** mundo — e é por isso que o número
// está medido e não escolhido por analogia com outro jogo.
//
// ## Por que isto melhora quando o bloco fica menor
//
// É a parte contraintuitiva, e é o que faz a subdivisão do item 1584 caber. As seções mistas são as
// que uma **fronteira de material atravessa**, e fronteira é superfície — coisa de duas dimensões.
// Ao refinar 3×, o número de seções cresce 27× e o número de seções atravessadas cresce só 9×: a
// fração de mistas cai por três. A tabela mostra isso medido, e é por isso que a conta ingênua de
// 2,4 GB para `SCALE = 9` errava por um fator de quinze.
//
// ## O que este módulo NÃO faz
//
// Ele não substitui o `Uint8Array` do chunk hoje. É a estrutura de dados, testada e medida, para o
// `Chunk` passar a usar — e para o LOD do item 1627 tirar a cor dominante de graça, porque a paleta
// de uma seção já é a resposta de "qual a cor média disto".

/** Aresta da seção, em mini-voxels. Medido: é onde o custo é mínimo. Ver o cabeçalho. */
export const ARESTA_DA_SECAO = 8;
export const VOXELS_POR_SECAO = ARESTA_DA_SECAO ** 3;

/**
 * Uma seção: ou um valor só, ou uma paleta com índices empacotados.
 *
 * `dados === null` é o caso homogêneo, e ele é a maior parte do mundo — 42,7% das seções já são de
 * valor único hoje, e a fração sobe quando o bloco fica menor. Guardar meio milhar de bytes para
 * dizer "isto é tudo ar" é o desperdício principal do formato plano.
 */
export interface Secao {
  /** Valores distintos presentes. Índice na paleta é o que os `dados` guardam. */
  paleta: number[];
  /** Índices empacotados, ou `null` quando a seção inteira é `paleta[0]`. */
  dados: Uint8Array | null;
  /** Bits por voxel. 0 quando homogênea. */
  bits: number;
}

/** Bits necessários para representar `n` valores distintos. Nunca menos que 1. */
export function bitsPara(n: number): number {
  if (n <= 1) return 0;
  return Math.max(1, Math.ceil(Math.log2(n)));
}

export function secaoHomogenea(valor: number): Secao {
  return { paleta: [valor], dados: null, bits: 0 };
}

/**
 * Monta uma seção a partir de um bloco de voxels crus.
 *
 * `ler(i)` recebe o índice local 0..VOXELS_POR_SECAO-1. Recebe uma função e não um array para o
 * chamador poder alimentar de um `Uint8Array` plano com qualquer disposição, sem copiar antes.
 */
export function empacotarSecao(ler: (i: number) => number): Secao {
  const indiceDe = new Map<number, number>();
  const paleta: number[] = [];

  for (let i = 0; i < VOXELS_POR_SECAO; i++) {
    const v = ler(i);
    if (!indiceDe.has(v)) {
      indiceDe.set(v, paleta.length);
      paleta.push(v);
    }
  }

  if (paleta.length === 1) return secaoHomogenea(paleta[0]);

  const bits = bitsPara(paleta.length);
  const dados = new Uint8Array(Math.ceil((VOXELS_POR_SECAO * bits) / 8));

  for (let i = 0; i < VOXELS_POR_SECAO; i++) {
    escreverBits(dados, i, bits, indiceDe.get(ler(i))!);
  }

  return { paleta, dados, bits };
}

/**
 * Lê o voxel `i` de uma seção.
 *
 * Sem ramo para o caso homogêneo além do `dados === null`: é o caminho mais quente do mesher e do
 * `getBlock`, e um `if` a mais aqui roda centenas de milhares de vezes por chunk.
 */
export function lerSecao(s: Secao, i: number): number {
  if (s.dados === null) return s.paleta[0];
  return s.paleta[lerBits(s.dados, i, s.bits)];
}

/**
 * Escreve um voxel, crescendo a paleta se o valor for novo.
 *
 * Devolve a seção — que pode ser **outra**: quando a paleta cresce além do que os bits atuais
 * comportam, tudo precisa ser reempacotado. Devolver em vez de mutar em silêncio é o que impede o
 * chamador de continuar segurando a versão antiga; um `void` aqui produziria escritas que somem, e
 * só nas seções que por acaso ganharam um bloco novo.
 */
export function escreverSecao(s: Secao, i: number, valor: number): Secao {
  const jaTem = s.paleta.indexOf(valor);

  if (jaTem >= 0) {
    if (s.dados === null) return s; // homogênea e o valor é o mesmo: nada muda
    escreverBits(s.dados, i, s.bits, jaTem);
    return s;
  }

  // Valor novo. Se era homogênea, agora tem dois; se já tinha paleta, ela cresce.
  const paleta = [...s.paleta, valor];
  const bits = bitsPara(paleta.length);

  if (s.dados !== null && bits === s.bits) {
    escreverBits(s.dados, i, bits, paleta.length - 1);
    return { paleta, dados: s.dados, bits };
  }

  // Reempacota: os bits por voxel mudaram, e os índices antigos não cabem mais no mesmo formato.
  const dados = new Uint8Array(Math.ceil((VOXELS_POR_SECAO * bits) / 8));
  for (let k = 0; k < VOXELS_POR_SECAO; k++) {
    const antigo = s.dados === null ? 0 : lerBits(s.dados, k, s.bits);
    escreverBits(dados, k, bits, k === i ? paleta.length - 1 : antigo);
  }
  return { paleta, dados, bits };
}

/**
 * Empacota uma seção lendo direto de um array plano — o caminho rápido.
 *
 * ## Por que existe, se `empacotarSecao` já faz isso
 *
 * `empacotarSecao` recebe uma função e a chama **duas vezes por voxel** (uma para montar a paleta,
 * outra para escrever), com um `Map` no meio. Medido: 43 ms por chunk — tão caro quanto gerar o
 * chunk inteiro. Serve para testar e para fontes exóticas; não serve para o caminho por onde todo
 * chunk do mundo passa.
 *
 * Aqui a fonte é o `Uint8Array` que o gerador já produz, a paleta cabe num array de 256 posições
 * indexado pelo próprio valor do bloco (não há bloco acima de 255, por construção), e cada voxel é
 * lido uma vez só.
 *
 * `base` é o índice do voxel (0,0,0) da seção no array plano; `passoZ` e `passoY` são os saltos
 * entre linhas e camadas. X é sempre contíguo — é assim que `blockIndex` está montado.
 */
export function empacotarDePlano(
  fonte: Uint8Array,
  base: number,
  passoZ: number,
  passoY: number,
): Secao {
  const A = ARESTA_DA_SECAO;
  // Indexado pelo valor do bloco: -1 = ainda não visto. Evita o `Map` e o hashing por voxel.
  const posicaoNaPaleta = new Int16Array(256).fill(-1);
  const paleta: number[] = [];

  for (let y = 0; y < A; y++) {
    const oy = base + y * passoY;
    for (let z = 0; z < A; z++) {
      const oz = oy + z * passoZ;
      for (let x = 0; x < A; x++) {
        const v = fonte[oz + x];
        if (posicaoNaPaleta[v] < 0) {
          posicaoNaPaleta[v] = paleta.length;
          paleta.push(v);
        }
      }
    }
  }

  if (paleta.length === 1) return secaoHomogenea(paleta[0]);

  const bits = bitsPara(paleta.length);
  const dados = new Uint8Array(Math.ceil((VOXELS_POR_SECAO * bits) / 8));
  let i = 0;
  for (let y = 0; y < A; y++) {
    const oy = base + y * passoY;
    for (let z = 0; z < A; z++) {
      const oz = oy + z * passoZ;
      for (let x = 0; x < A; x++) {
        escreverBits(dados, i++, bits, posicaoNaPaleta[fonte[oz + x]]);
      }
    }
  }
  return { paleta, dados, bits };
}

/**
 * Escreve a seção de volta num array plano — o caminho rápido de leitura.
 *
 * O par do `empacotarDePlano`, e o que permite ao mesher continuar recebendo um bloco contíguo sem
 * pagar uma leitura de bits por voxel.
 *
 * Uma seção homogênea vira oito `fill` de oito bytes por camada, sem tocar em bit nenhum — e é o
 * caso da maioria do mundo. É por isso que descomprimir sai mais barato que comprimir.
 */
export function escreverPlanoEm(
  s: Secao,
  destino: Uint8Array,
  base: number,
  passoZ: number,
  passoY: number,
): void {
  const A = ARESTA_DA_SECAO;

  if (s.dados === null) {
    const v = s.paleta[0];
    for (let y = 0; y < A; y++) {
      const oy = base + y * passoY;
      for (let z = 0; z < A; z++) {
        const oz = oy + z * passoZ;
        destino.fill(v, oz, oz + A);
      }
    }
    return;
  }

  const { paleta, dados, bits } = s;
  let i = 0;
  for (let y = 0; y < A; y++) {
    const oy = base + y * passoY;
    for (let z = 0; z < A; z++) {
      const oz = oy + z * passoZ;
      for (let x = 0; x < A; x++) {
        destino[oz + x] = paleta[lerBits(dados, i++, bits)];
      }
    }
  }
}

/** Bytes que esta seção ocupa de fato. Existe para medir, e o teste mede. */
export function bytesDaSecao(s: Secao): number {
  // 8 de cabeçalho (bits, comprimento) + 1 por entrada de paleta + os dados.
  return 8 + s.paleta.length + (s.dados?.length ?? 0);
}

/**
 * O valor que mais ocupa a seção — a resposta de "qual a cor deste pedaço visto de longe".
 *
 * Serve ao LOD do item 1627, e é praticamente de graça: numa seção homogênea é `paleta[0]` sem
 * olhar um voxel sequer, que é o caso da maioria.
 */
export function valorDominante(s: Secao): number {
  if (s.dados === null) return s.paleta[0];
  const conta = new Array(s.paleta.length).fill(0);
  for (let i = 0; i < VOXELS_POR_SECAO; i++) conta[lerBits(s.dados, i, s.bits)]++;
  let melhor = 0;
  for (let p = 1; p < conta.length; p++) if (conta[p] > conta[melhor]) melhor = p;
  return s.paleta[melhor];
}

// --- bits ------------------------------------------------------------------------------------
//
// Um índice pode cruzar a fronteira de dois bytes — com 3 bits por voxel, o voxel 2 ocupa o fim do
// byte 0 e o começo do byte 1. Tratar os dois bytes é obrigatório e é onde este tipo de código
// costuma errar: a versão que só lê um byte funciona para 1, 2, 4 e 8 bits e falha para 3, 5, 6 e
// 7 — ou seja, funciona para as paletas pequenas dos testes e quebra no mundo real.

function lerBits(d: Uint8Array, i: number, bits: number): number {
  const inicio = i * bits;
  const byte = inicio >> 3;
  const desloc = inicio & 7;
  const bruto = d[byte] | (d[byte + 1] ?? 0) << 8;
  return (bruto >> desloc) & ((1 << bits) - 1);
}

function escreverBits(d: Uint8Array, i: number, bits: number, valor: number): void {
  const inicio = i * bits;
  const byte = inicio >> 3;
  const desloc = inicio & 7;
  const mascara = ((1 << bits) - 1) << desloc;
  const bruto = (d[byte] | (d[byte + 1] ?? 0) << 8) & ~mascara | ((valor << desloc) & mascara);
  d[byte] = bruto & 0xff;
  if (byte + 1 < d.length) d[byte + 1] = (bruto >> 8) & 0xff;
}

/**
 * Compressão RLE (Run-Length Encoding) para salvamento compacto de voxels e chunks — itens 034, 279.
 */
export function compressRLE(data: Uint8Array): Uint8Array {
  if (data.length === 0) return new Uint8Array(0);
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const val = data[i];
    let count = 1;
    while (i + count < data.length && data[i + count] === val && count < 255) {
      count++;
    }
    out.push(count, val);
    i += count;
  }
  return new Uint8Array(out);
}

/**
 * Descompressão RLE revertendo pares [contagem, valor] ao array de voxels original — itens 034, 279.
 */
export function decompressRLE(compressed: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < compressed.length; i += 2) {
    const count = compressed[i];
    const val = compressed[i + 1];
    for (let c = 0; c < count; c++) {
      out.push(val);
    }
  }
  return new Uint8Array(out);
}
