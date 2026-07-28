// "Você está abrigado?" — item 1306.
//
// ## O que estava errado
//
// O objetivo "levante um abrigo antes do escuro" contava **blocos colocados**: doze quaisquer, e
// pronto. Doze blocos de terra enfileirados no chão cumpriam. O jogador recebia a confirmação de
// ter feito algo que não fez, e a primeira noite o pegava do lado de fora — com o jogo tendo dito
// que estava tudo certo.
//
// Um objetivo que mede a ação errada é pior que objetivo nenhum: ele ensina que o guia não sabe do
// que está falando, e a partir daí nada que ele disser é levado a sério.
//
// ## Como se mede um abrigo
//
// Não pela contagem de paredes, nem por padrão de construção — as duas coisas obrigariam o jogador
// a construir do jeito que o código espera. O que define abrigo é **o ar em volta ser finito**:
// numa caverna, numa cabana ou num buraco tapado, o espaço respirável acaba. A céu aberto, não.
//
// Então é uma busca em largura pelo ar a partir do jogador, com **orçamento**. Se a busca se
// esgota sozinha, o espaço é fechado. Se estoura o orçamento, é porque não tem fim — está do lado
// de fora. Um buraco na parede ou no teto derruba o resultado sozinho, sem precisar de regra
// própria, porque o ar de fora entra pela busca.
//
// A consequência boa: uma caverna conta como abrigo. E deve mesmo — quem passa a noite numa
// caverna tapada está tão abrigado quanto quem construiu, e exigir construção seria exigir um
// estilo de jogo em vez de um resultado.

import { BLOCKS } from '../world/blocks';
import { SCALE, TOPO_VARREDURA } from '../world/chunk';

/** O mínimo que a busca precisa do mundo. */
export interface LeitorDeBlocos {
  getBlock(x: number, y: number, z: number): number;
}

/**
 * Quantas células de um metro a busca pode visitar antes de desistir.
 *
 * É o único número que decide o que conta como abrigo, então vale dizer o que ele significa: 1200
 * células é um recinto de até cerca de 10×10×10 metros. Acima disso o jogo passa a chamar de "lá
 * fora" — o que é o comportamento certo, porque um salão desse tamanho ou é a céu aberto ou é uma
 * caverna grande o bastante para as criaturas nascerem dentro dela.
 *
 * Baixo demais reprovaria uma casa legítima; alto demais faria um vale fechado passar por casa. E
 * é também o teto de custo: a busca nunca visita mais que isto, aconteça o que acontecer.
 */
export const ORCAMENTO_DE_BUSCA = 1200;

/** Verifica se um abrigo é uma casa válida para mudança de NPCs — item 501. */
export function checkNPCHousingQualification(validShelter: boolean): { canMoveIn: boolean; reason: string } {
  if (validShelter) {
    return { canMoveIn: true, reason: 'Abrigo seguro e fechado. Um NPC pode se mudar para cá.' };
  }
  return { canMoveIn: false, reason: 'A estrutura precisa estar fechada e segura para abrigar um morador.' };
}

/** Bloco que barra passagem. Decoração (capim, flor, tocha) não fecha nada. */
function barra(tipo: number): boolean {
  const def = BLOCKS[tipo];
  return !!def && def.solid && !def.decor;
}

/**
 * Há parede entre duas células vizinhas de um metro?
 *
 * A busca anda de metro em metro, mas o mundo é de mini-voxels (`SCALE` por metro). Testar só o
 * ponto de chegada atravessaria uma parede de um mini-voxel de espessura em dois de cada três
 * casos — e paredes assim existem, porque o Modo Detalhe as constrói. Por isso cada passo confere
 * **todos** os mini-voxels no caminho.
 */
function caminhoBloqueado(
  mundo: LeitorDeBlocos, x: number, y: number, z: number, dx: number, dy: number, dz: number,
): boolean {
  for (let i = 1; i <= SCALE; i++) {
    if (barra(mundo.getBlock(x * SCALE + dx * i, y * SCALE + dy * i, z * SCALE + dz * i))) return true;
  }
  return false;
}

const VIZINHOS: Array<[number, number, number]> = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

/** Chave de célula a partir de coordenadas de mini-voxel. */
export function chaveDeCelula(x: number, y: number, z: number): string {
  return `${Math.floor(x / SCALE)},${Math.floor(y / SCALE)},${Math.floor(z / SCALE)}`;
}

/**
 * O **conjunto de células** do espaço fechado em volta do ponto, ou `null` se não houver abrigo.
 *
 * Devolver o conjunto, e não só um sim/não, é o que permite a segunda pergunta: "esta outra célula
 * está dentro do mesmo abrigo?". É dela que o `MobSpawner` precisa para não fazer um hostil nascer
 * dentro da casa do jogador — o defeito clássico do gênero, e o que faz alguém deixar de construir.
 *
 * A busca já visita exatamente essas células; jogá-las fora e recomeçar para cada candidato a
 * spawn custaria uma varredura por candidato.
 *
 * `null` também quando o próprio ponto está dentro de rocha maciça: quem está soterrado não está
 * abrigado, está preso, e dar o objetivo por cumprido ali seria premiar um acidente ruim.
 */
export function mapearAbrigo(
  mundo: LeitorDeBlocos, px: number, py: number, pz: number,
  orcamento = ORCAMENTO_DE_BUSCA,
): Set<string> | null {
  const inicioX = Math.floor(px / SCALE);
  const inicioY = Math.floor(py / SCALE);
  const inicioZ = Math.floor(pz / SCALE);
  if (barra(mundo.getBlock(px, py, pz))) return null;

  const teto = Math.floor(TOPO_VARREDURA / SCALE);
  const visitados = new Set<string>();
  const fila: Array<[number, number, number]> = [[inicioX, inicioY, inicioZ]];
  visitados.add(`${inicioX},${inicioY},${inicioZ}`);

  while (fila.length > 0) {
    if (visitados.size > orcamento) return null; // o ar não acaba: está do lado de fora
    const [x, y, z] = fila.pop()!;

    for (const [dx, dy, dz] of VIZINHOS) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      // Sair pelo topo do mundo é sair a céu aberto, e nenhuma parede pode fechar isso.
      if (ny > teto) return null;
      if (ny < 0) continue;
      const chave = `${nx},${ny},${nz}`;
      if (visitados.has(chave)) continue;
      if (caminhoBloqueado(mundo, x, y, z, dx, dy, dz)) continue;
      visitados.add(chave);
      fila.push([nx, ny, nz]);
    }
  }

  return visitados; // a busca se esgotou sozinha: o espaço tem fim
}

/** O ponto (em mini-voxels) está num espaço fechado? */
export function estaAbrigado(
  mundo: LeitorDeBlocos, px: number, py: number, pz: number,
  orcamento = ORCAMENTO_DE_BUSCA,
): boolean {
  return mapearAbrigo(mundo, px, py, pz, orcamento) !== null;
}
