// Redação de segredos em texto que sai do mod.
//
// ## A fronteira que este arquivo defende
//
// O `api.env.get('API_KEY')` devolve a chave de verdade ao script, e isso é correto: o script
// roda no mesmo cliente, com os mesmos privilégios do jogo, e um mod que precisa da chave para
// chamar uma API precisa da chave. Esconder dele seria teatro.
//
// A fronteira real é outra: **o valor não pode sair da máquina**. E o caminho mais fácil de saída
// não é a rede — é o **texto**. Um script faz:
//
// ```js
// api.log('conectando com', api.env.get('API_KEY'));
// ```
//
// e a chave vai para o log do mod, que aparece no painel, entra no relatório de diagnóstico e
// pode acabar no histórico da conversa que o agente lê. Dali ela sai da máquina sem nenhum
// `fetch` envolvido.
//
// Pior: isso acontece **sem má intenção**. Depurar imprimindo a variável é o reflexo mais comum
// que existe, e uma IA escrevendo o mod faz exatamente isso.
//
// ## Por que comparar por valor, e não por nome da chave
//
// Redigir "o que veio de `env.get`" exigiria rastrear a origem do dado através de concatenações,
// interpolações e `JSON.stringify` — impossível sem instrumentar o motor. Comparar o texto final
// contra os valores conhecidos é simples e não tem como escapar: se o segredo está ali, em
// qualquer posição, ele sai.

/**
 * Tamanho mínimo para um valor ser redigido.
 *
 * Um segredo de dois ou três caracteres (`"1"`, `"on"`, `"abc"`) apareceria por acaso em quase
 * toda mensagem, e o log viraria uma sopa de asteriscos — inútil para depurar e, pior, escondendo
 * o problema de verdade. Chave de API real tem dezenas de caracteres; este piso não deixa nenhuma
 * de fora e evita o dano colateral.
 */
export const TAMANHO_MINIMO_REDACAO = 6;

export const MASCARA = '••••••';

/** Escapa um texto para uso literal dentro de uma expressão regular. */
function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Substitui por máscara toda ocorrência de qualquer segredo no texto.
 *
 * Os valores mais longos são tratados primeiro: se um segredo contém outro — uma chave e o seu
 * prefixo, por exemplo — redigir o curto antes partiria o longo ao meio e deixaria a cauda dele
 * visível no log.
 */
export function redigirSegredos(texto: string, segredos: Iterable<string>): string {
  const valores = Array.from(segredos)
    .filter((v) => typeof v === 'string' && v.length >= TAMANHO_MINIMO_REDACAO)
    .sort((a, b) => b.length - a.length);

  let saida = texto;
  for (const v of valores) {
    saida = saida.replace(new RegExp(escapar(v), 'g'), MASCARA);
  }
  return saida;
}

/** O texto contém algum dos segredos? Usado por teste e por diagnóstico. */
export function contemSegredo(texto: string, segredos: Iterable<string>): boolean {
  for (const v of segredos) {
    if (typeof v === 'string' && v.length >= TAMANHO_MINIMO_REDACAO && texto.includes(v)) return true;
  }
  return false;
}
