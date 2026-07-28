// `/mudo` e `/ouvir` — item 1415.
//
// ## Por que este comando NUNCA sai da máquina
//
// Todo comando do chat é despachado para o anfitrião: o convidado manda `{ type: 'command' }` e
// espera a resposta. Este não pode seguir esse caminho, e a razão não é desempenho — é significado.
//
// Emudecer alguém é uma decisão sobre **os meus ouvidos**, e não sobre a sessão. Passando pelo
// anfitrião, ela viraria uma coisa que o anfitrião sabe (quem não gosta de quem), que ele pode
// negar, e que para de funcionar quando ele cai. Nenhuma das três é aceitável para o recurso cuja
// função é justamente dar autonomia a quem está num mundo público.
//
// Por isso a interceptação acontece **antes** do despacho, e este módulo devolve `tratado: true`
// para o chamador parar ali.
//
// ## Por que resolve por nome e guarda por id
//
// O jogador digita o nome, que é o que ele vê na plaquinha. O silêncio é guardado por id de par,
// que é o que não muda: guardar por nome deixaria o silêncio furado por qualquer um que trocasse de
// apelido, e é a primeira coisa que alguém tenta.

import { SilenciadosDeVoz } from './vozEspacial';

export interface PresenteNaSessao {
  id: string;
  nome: string;
}

export interface ResultadoDeSilencio {
  /** O comando era deste módulo? `false` significa "siga o caminho normal". */
  tratado: boolean;
  mensagem?: string;
}

const COMANDOS_MUDO = ['mudo', 'silenciar', 'mute'];
const COMANDOS_OUVIR = ['ouvir', 'dessilenciar', 'unmute'];

/** Normaliza para comparar nomes sem acento e sem caixa. */
function chave(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Interpreta o comando, se for um dos deste módulo.
 *
 * `presentes` é a lista de quem está sendo mostrado agora. Só se pode emudecer quem está presente,
 * e isso é uma limitação assumida: guardar nomes de quem já saiu daria uma lista que cresce para
 * sempre e um comando que aceita qualquer texto sem dizer se funcionou.
 */
export function interpretarComandoDeSilencio(
  raw: string,
  presentes: PresenteNaSessao[],
  silenciados: SilenciadosDeVoz,
): ResultadoDeSilencio {
  const texto = raw.trim().replace(/^\//, '');
  const [verboBruto, ...resto] = texto.split(/\s+/);
  const verbo = chave(verboBruto ?? '');

  const ehMudo = COMANDOS_MUDO.includes(verbo);
  const ehOuvir = COMANDOS_OUVIR.includes(verbo);
  if (!ehMudo && !ehOuvir) return { tratado: false };

  const alvo = resto.join(' ').trim();

  // Sem argumento: lista. É o único jeito de o jogador descobrir que emudeceu alguém três sessões
  // atrás e esqueceu — e "por que fulano não fala?" sem essa lista é indiagnosticável.
  if (!alvo) {
    const ids = silenciados.lista();
    if (ids.length === 0) return { tratado: true, mensagem: 'Você não silenciou ninguém.' };
    const nomes = ids.map((id) => presentes.find((p) => p.id === id)?.nome ?? id);
    return { tratado: true, mensagem: `Silenciados: ${nomes.join(', ')}.` };
  }

  const achado = presentes.find((p) => chave(p.nome) === chave(alvo)) ?? presentes.find((p) => p.id === alvo);
  if (!achado) {
    const perto = presentes.map((p) => p.nome).join(', ');
    return {
      tratado: true,
      mensagem: perto
        ? `Não há ninguém chamado "${alvo}" por aqui. Presentes: ${perto}.`
        : `Não há ninguém chamado "${alvo}" por aqui — você está sozinho na sessão.`,
    };
  }

  if (ehMudo) {
    if (silenciados.estaSilenciado(achado.id)) {
      return { tratado: true, mensagem: `${achado.nome} já estava silenciado.` };
    }
    silenciados.silenciar(achado.id);
    return { tratado: true, mensagem: `${achado.nome} foi silenciado. Use /ouvir ${achado.nome} para desfazer.` };
  }

  if (!silenciados.estaSilenciado(achado.id)) {
    return { tratado: true, mensagem: `${achado.nome} não estava silenciado.` };
  }
  silenciados.ouvir(achado.id);
  return { tratado: true, mensagem: `Você voltou a ouvir ${achado.nome}.` };
}
