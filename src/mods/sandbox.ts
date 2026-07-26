// Compilação de um script de mod, com o escopo global sombreado.
//
// ## O defeito que isto corrige
//
// O `ModRuntime` compilava assim, com este comentário ao lado:
//
// ```ts
// // `new Function` com um único parâmetro: o corpo não recebe `window` nem `globalThis`
// const fn = new Function('api', `"use strict";\n${script.code}`);
// ```
//
// **O comentário estava errado, e a consequência é séria.** `new Function` isola o corpo do
// escopo *local* de quem o cria — nada mais. O código continua sendo avaliado no escopo
// **global**, onde `window`, `fetch`, `document`, `localStorage` e `indexedDB` são variáveis
// livres perfeitamente alcançáveis. Não passar como argumento não esconde coisa alguma.
//
// Pesa mais neste projeto que na média: os scripts são **escritos por uma IA** a pedido do
// jogador e rodam no navegador dele, na mesma origem onde estão os mundos salvos e o cofre de
// chaves de API. Um script com `fetch` pode mandar qualquer um dos dois para qualquer lugar.
//
// ## A técnica, e o seu limite
//
// Os nomes perigosos entram como **parâmetros** da função, com valor `undefined`. Como parâmetro
// é uma ligação léxica, ele sombreia o global de mesmo nome: dentro do corpo, `fetch` resolve
// para o parâmetro, não para o global.
//
// **Isto não é uma fronteira de segurança contra código hostil.** Continua havendo saída por
// `[].constructor.constructor('return this')()`, porque a função criada por `Function` também é
// avaliada no escopo global. Há um teste em `tests/unit/modSandbox.test.ts` que **verifica a
// brecha existir**, justamente para ninguém ler os outros testes e concluir demais.
//
// A fronteira de verdade é outro reino de execução — Web Worker sem `fetch`, ou iframe com
// `sandbox` — e é o item 358 do checklist. O que está aqui barra o acesso direto e acidental,
// que é o caso realista de um script gerado por IA, e é uma melhora grande sobre não ter nada.
// Não é o fim do trabalho.

/**
 * Nomes globais sombreados dentro de um script de mod.
 *
 * Critério: tudo que dá **rede**, **armazenamento**, **acesso ao documento** ou um caminho de
 * volta ao objeto global. O que é puro cálculo (`Math`, `JSON`, `Date`, `Array`, `Promise`) fica
 * de fora de propósito — sem eles a plataforma de mods não serve para nada, e a tentação
 * seguinte seria devolver o `fetch` junto.
 */
export const GLOBAIS_BLOQUEADOS: readonly string[] = [
  // Caminhos de volta ao objeto global
  'window', 'globalThis', 'self', 'top', 'parent', 'opener', 'frames',
  // Rede
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'navigator', 'sendBeacon',
  'RTCPeerConnection', 'Request', 'Response', 'caches',
  // Armazenamento — o cofre de segredos e os mundos salvos vivem aqui
  'localStorage', 'sessionStorage', 'indexedDB', 'openDatabase', 'cookieStore',
  // Documento e navegação
  'document', 'location', 'history', 'alert', 'confirm', 'prompt', 'open', 'print',
  // Execução de mais código.
  //
  // `eval` NÃO está na lista, e não por esquecimento: em modo estrito ele é proibido como nome
  // de ligação, então não há como sombreá-lo com um parâmetro — `new Function('eval', ...)` é
  // um `SyntaxError`. É mais uma razão pela qual a fronteira de verdade é outro reino de
  // execução (Web Worker), e não este arquivo.
  'Worker', 'SharedWorker', 'importScripts', 'postMessage',
  // Ambiente Node, para o caso de o script rodar fora do navegador (teste, ferramenta)
  'process', 'require', 'module', 'exports', '__dirname', '__filename', 'Buffer',
];

/**
 * Compila o corpo de um script de mod numa função que recebe a `api` do mod.
 *
 * Lança se o código não for sintaticamente válido — quem chama trata e desliga o script,
 * registrando o motivo.
 */
export function compilarScriptDeMod(codigo: string): (api: unknown) => void {
  // `"use strict"` faz mais que evitar global implícito: em modo estrito, `this` dentro de uma
  // função chamada sem receptor é `undefined` em vez do objeto global, o que fecha a rota de
  // fuga mais óbvia — `(function(){ return this })()`.
  const fn = new Function(
    ...GLOBAIS_BLOQUEADOS,
    'api',
    `"use strict";\n${codigo}`,
  );

  return (api: unknown) => {
    fn(...GLOBAIS_BLOQUEADOS.map(() => undefined), api);
  };
}
