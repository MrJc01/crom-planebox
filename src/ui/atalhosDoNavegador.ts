// Os atalhos do navegador que atropelam o jogo — item 1550.
//
// ## O que acontece hoje
//
// O jogo roda numa aba, e a aba tem dono. Ctrl+W fecha a partida no meio, Ctrl+S abre "salvar
// página", Ctrl+D favorita, Ctrl+P imprime, F5 recarrega, F3 abre a busca do Firefox por cima do
// mundo. Nenhum deles é recuperável e nenhum avisa: o jogador aperta uma combinação que num jogo
// significa outra coisa, e perde o que estava fazendo.
//
// Só o Tab estava tratado, e por acidente — porque tirava o foco do canvas (item 1497).
//
// ## O que dá e o que não dá para impedir
//
// Isto é o ponto que decide o desenho. O navegador **não deixa** interceptar tudo, e é bom que não
// deixe: uma página que sequestra Ctrl+W é uma página da qual não se sai.
//
// | tecla | dá para impedir? |
// |---|---|
// | Ctrl+S, Ctrl+P, Ctrl+D, Ctrl+F, Ctrl+G, Ctrl+O, Ctrl+U | sim |
// | F1, F3, F5, F7 | sim |
// | Ctrl+W, Ctrl+T, Ctrl+N, Ctrl+Shift+W, Alt+F4 | **não** — são do navegador e do sistema |
// | Ctrl+Tab, Alt+Tab | **não** |
//
// Para os que não dão, a única resposta honesta é o `beforeunload`: um "tem certeza?" nativo. Não é
// bonito e é o máximo que a plataforma oferece.
//
// ## Por que só com o ponteiro travado
//
// Fora do jogo — num menu, digitando no chat — Ctrl+F **deve** procurar e Ctrl+C **deve** copiar.
// Bloquear sempre transformaria a página num lugar onde os reflexos de todo mundo param de
// funcionar, o que é pior que o problema. O critério é o mesmo que o jogo já usa para saber se está
// sendo jogado: o ponteiro está travado.

/**
 * Combinações que o jogo toma para si quando está sendo jogado.
 *
 * `ctrl` cobre também o Command do macOS — quem usa Mac aperta Cmd+S com a mesma naturalidade.
 */
interface Combinacao {
  code: string;
  ctrl?: boolean;
  shift?: boolean;
}

const ROUBADAS: Combinacao[] = [
  // Salvar, imprimir, favoritar, abrir, ver-fonte: todas abrem uma janela por cima do jogo.
  { code: 'KeyS', ctrl: true },
  { code: 'KeyP', ctrl: true },
  { code: 'KeyD', ctrl: true },
  { code: 'KeyO', ctrl: true },
  { code: 'KeyU', ctrl: true },
  // Busca da página. `KeyF` sozinho já é uma tecla do jogo (voar/alternar), e com Ctrl abriria a
  // barra de busca por cima.
  { code: 'KeyF', ctrl: true },
  { code: 'KeyG', ctrl: true },
  // Recarregar. Perde a partida inteira, e é a tecla mais fácil de acertar sem querer.
  { code: 'F5' },
  { code: 'KeyR', ctrl: true },
  // Ajuda do navegador e busca rápida do Firefox.
  { code: 'F1' },
  { code: 'F3' },
  // O jogo já usa F6 e F7 para telas próprias; sem isto, o navegador disputa o F7 (cursor de
  // navegação do Firefox) e o jogador acaba com um cursor piscando dentro do mundo.
  { code: 'F7' },
];

/**
 * Combinações que o navegador **não** entrega, listadas para o aviso poder dizer quais são.
 *
 * Existe como dado e não como comentário porque a tela de configurações precisa mostrá-las: dizer
 * ao jogador "estas quatro eu não consigo impedir" é mais útil que fingir que o problema não
 * existe.
 */
export const FORA_DO_ALCANCE = [
  'Ctrl+W (fecha a aba)',
  'Ctrl+T (nova aba)',
  'Ctrl+N (nova janela)',
  'Ctrl+Tab (troca de aba)',
  'Alt+Tab (troca de janela)',
  'F11 (tela cheia) — em alguns navegadores',
];

/** Esta tecla deve ser tomada do navegador agora? */
export function deveRoubar(
  e: { code: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
  jogando: boolean,
): boolean {
  // Fora do jogo o navegador manda. Ctrl+F deve procurar e Ctrl+C deve copiar num menu ou num campo
  // de texto — bloquear sempre faria os reflexos de todo mundo pararem de funcionar na página
  // inteira, que é pior que o problema original.
  if (!jogando) return false;

  const ctrl = e.ctrlKey || e.metaKey;
  for (const c of ROUBADAS) {
    if (c.code !== e.code) continue;
    if ((c.ctrl ?? false) !== ctrl) continue;
    if (c.shift !== undefined && c.shift !== e.shiftKey) continue;
    return true;
  }
  return false;
}

/** As combinações tomadas, em texto, para a tela de configurações. */
export function listarRoubadas(): string[] {
  return ROUBADAS.map((c) => (c.ctrl ? 'Ctrl+' : '') + (c.shift ? 'Shift+' : '') + rotulo(c.code));
}

function rotulo(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

/**
 * A porta para as ferramentas de desenvolvedor — item 1553.
 *
 * Com F12 e Ctrl+Shift+I fora do alcance de qualquer página, e com o resto dos atalhos tomados, o
 * jogador precisa de um caminho que **não** dependa do navegador. Não dá para abrir o DevTools por
 * código — nenhuma API permite, e é assim de propósito.
 *
 * O que dá é dizer como. A frase é curta porque ela existe num toast e num campo de configuração, e
 * porque instruções longas não são lidas no meio de uma partida.
 */
export const COMO_ABRIR_DEVTOOLS =
  'F12 continua funcionando — o jogo não intercepta essa tecla. '
  + 'Se o seu navegador não responder, use o menu ⋮ → Mais ferramentas → Ferramentas do desenvolvedor.';
