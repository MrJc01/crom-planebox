// Quem está na sessão — item 1497.
//
// ## O que estava faltando, e o que a falta custava
//
// Duas mecânicas inteiras não tinham porta de entrada. `/mudo` (item 1415) era a única forma de
// silenciar alguém, e quem não sabe que o comando existe não tem forma nenhuma. E o sono coletivo
// (item 139) avisa quem falta por uma mensagem de chat que passa — quem chega depois não tem como
// descobrir por quem está esperando.
//
// As duas dependem da mesma coisa: **saber quem está aqui**. Uma lista resolve as duas, e o custo
// de não ter é que os dois recursos existem, funcionam, e são invisíveis.
//
// ## Por que a lista é derivada e não guardada
//
// Ela é montada na hora a partir do que já existe: os avatares mostrados, o registro de silêncio, o
// conjunto de quem dorme. Manter uma lista própria significaria mantê-la sincronizada com três
// fontes, e a primeira a divergir seria a de quem saiu — a mesma armadilha que já apareceu no sono
// coletivo, com a lista mostrando alguém que não está mais lá.

export interface LinhaDeJogador {
  id: string;
  nome: string;
  /** É este cliente? */
  euMesmo: boolean;
  /** Distância em voxels, ou `null` para si mesmo e para quem ainda não mandou posição. */
  distancia: number | null;
  silenciado: boolean;
  dormindo: boolean;
  /** Está falando agora? Reservado — hoje sempre `false`, ver a lacuna 1500. */
  falando: boolean;
}

export interface FonteDaLista {
  localId: string;
  localNome: string;
  localDormindo: boolean;
  /** Posição de quem está olhando, para a distância. */
  olhando: { x: number; y: number; z: number };
  /** Os outros presentes, com a posição exibida quando houver. */
  remotos: { id: string; nome: string; pos: { x: number; y: number; z: number } | null }[];
  silenciado: (id: string) => boolean;
  dormindo: (id: string) => boolean;
}

/**
 * Monta a lista, com o jogador local primeiro e o resto por distância.
 *
 * ## Por que ordenar por distância e não por nome
 *
 * A lista existe para agir sobre alguém — silenciar, saber por quem se espera —, e a pessoa sobre
 * quem se age quase sempre é a que está por perto. Ordem alfabética faria a mesma pessoa mudar de
 * posição quando outra entrasse, e o clique erra o alvo.
 *
 * Quem não tem posição vai para o fim: é quem acabou de entrar, e ainda não está em lugar nenhum.
 */
export function montarListaDeJogadores(f: FonteDaLista): LinhaDeJogador[] {
  const eu: LinhaDeJogador = {
    id: f.localId,
    nome: f.localNome,
    euMesmo: true,
    distancia: null,
    // Silenciar a si mesmo não é o que o botão do microfone faz, e mostrar o próprio nome riscado
    // sugeriria que é. O jogador local nunca aparece silenciado nesta lista.
    silenciado: false,
    dormindo: f.localDormindo,
    falando: false,
  };

  const outros: LinhaDeJogador[] = f.remotos.map((r) => ({
    id: r.id,
    nome: r.nome,
    euMesmo: false,
    distancia: r.pos ? distanciaEntre(f.olhando, r.pos) : null,
    silenciado: f.silenciado(r.id),
    dormindo: f.dormindo(r.id),
    falando: false,
  }));

  outros.sort((a, b) => {
    if (a.distancia === null && b.distancia === null) return a.nome.localeCompare(b.nome);
    if (a.distancia === null) return 1;
    if (b.distancia === null) return -1;
    return a.distancia - b.distancia;
  });

  return [eu, ...outros];
}

function distanciaEntre(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * O resumo do sono, para o cabeçalho da lista.
 *
 * Devolve `null` quando ninguém está dormindo: um contador permanente de "0/3 dormindo" é ruído no
 * meio do dia, e o jogador aprende a não olhar para ele — justamente antes da noite em que ele
 * importa.
 */
export function resumoDeSono(linhas: LinhaDeJogador[]): string | null {
  const dormindo = linhas.filter((l) => l.dormindo).length;
  if (dormindo === 0) return null;
  if (dormindo === linhas.length) return 'Todos dormindo';
  return `${dormindo}/${linhas.length} dormindo`;
}

/** Distância em texto curto. `null` vira travessão — um número inventado seria pior. */
export function distanciaLegivel(d: number | null): string {
  if (d === null) return '—';
  if (d < 1) return 'aqui';
  if (d < 1000) return `${Math.round(d)} m`;
  return `${(d / 1000).toFixed(1)} km`;
}
