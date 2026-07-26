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
// O corpo do script roda dentro de um `with` sobre um `Proxy` cujo `has` responde **sempre que
// sim**. Dentro de um `with`, o motor pergunta ao objeto se ele tem cada nome livre antes de
// procurar no escopo externo; respondendo sempre que sim, nenhuma busca chega ao global, e o
// `get` decide nome a nome o que devolver.
//
// Isso torna a proteção uma lista de **permitidos**. A primeira versão era uma lista de negados
// — os nomes perigosos entravam como parâmetros `undefined` — e tinha o defeito de qualquer
// lista de negados: o que eu esquecesse, ou o que o navegador ganhasse depois, entrava livre.
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
 * Intrínsecos que um script de mod PODE ver.
 *
 * Lista de permitidos, e não de negados — a diferença é o que acontece com o que ninguém
 * previu. Com lista de negados, uma API nova do navegador (ou uma que eu simplesmente esqueci)
 * entra livre. Com lista de permitidos, ela é bloqueada por omissão, que é o padrão certo para
 * código escrito por uma IA e executado no navegador do jogador.
 *
 * Só cálculo puro: nada aqui alcança rede, disco, documento ou relógio de parede de alta
 * resolução. `console` fica de fora de propósito — o mod registra pelo `api.log`, que aparece no
 * painel de mods e é atribuível a quem escreveu.
 */
export const INTRINSECOS_PERMITIDOS: readonly string[] = [
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt',
  'Math', 'JSON', 'Date', 'RegExp',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise',
  'Error', 'TypeError', 'RangeError', 'SyntaxError',
  'isNaN', 'isFinite', 'parseInt', 'parseFloat',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'NaN', 'Infinity', 'undefined',
  'Int8Array', 'Uint8Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
];

/**
 * Compila o corpo de um script de mod numa função que recebe a `api` do mod.
 *
 * Lança se o código não for sintaticamente válido — quem chama trata e desliga o script,
 * registrando o motivo.
 */
export function compilarScriptDeMod(codigo: string): (api: unknown) => Promise<void> {
  const permitidos = new Set(INTRINSECOS_PERMITIDOS);

  return async (api: unknown) => {
    /**
     * O escopo do script.
     *
     * `has` devolvendo `true` para tudo é o coração da coisa: dentro de um `with`, o motor
     * pergunta ao objeto se ele tem cada nome livre ANTES de procurar no escopo externo.
     * Respondendo sempre que sim, **nenhuma busca chega ao global** — e o `get` decide, nome a
     * nome, o que devolver. É por isso que a proteção não depende de eu ter lembrado de listar
     * `fetch`: qualquer nome não permitido devolve `undefined`, inclusive os que ainda não
     * existem.
     */
    const escopo = new Proxy(Object.create(null) as Record<string | symbol, unknown>, {
      has: () => true,
      get(_alvo, nome) {
        // `Symbol.unscopables` precisa ser `undefined`, senão o motor tenta interpretá-lo como
        // uma lista de nomes a ignorar e o `with` deixa de capturar tudo.
        if (nome === Symbol.unscopables) return undefined;
        if (nome === 'api') return api;
        if (typeof nome === 'string' && permitidos.has(nome)) {
          return (globalThis as Record<string, unknown>)[nome];
        }
        return undefined;
      },
      set(_alvo, nome) {
        // Dentro de `with`, atribuir a um nome livre passa por aqui. Recusar é o que substitui o
        // `"use strict"` do escopo externo, que não pode existir junto com `with`.
        throw new TypeError(`Mod tentou escrever na variável global "${String(nome)}".`);
      },
    });

    // ## Por que o corpo é estrito e o invólucro não
    //
    // `with` é proibido em modo estrito, então o invólucro precisa ser permissivo. Mas o corpo do
    // script dentro dele PODE ser estrito, e precisa ser: em modo permissivo,
    // `(function(){ return this })()` devolve o objeto global — a rota de fuga mais curta que
    // existe. Com `"use strict"` no corpo, esse `this` é `undefined`.
    // ## Por que o corpo é `async` — item 1251
    //
    // O sandbox de verdade (item 358) é um Web Worker, e um Worker só conversa por `postMessage`.
    // Toda leitura do mundo — `api.world.getBlock(x, y, z)` — vira ida e volta assíncrona no dia em
    // que o script sair deste reino de execução.
    //
    // Trocar o tipo de retorno naquele dia quebraria **todo mod já escrito**, de uma vez, sem aviso.
    // Tornar o corpo `async` desde já resolve isso sem custo nenhum hoje: `await` sobre um valor que
    // não é promessa devolve o próprio valor. Um mod escrito com `await api.world.getBlock(...)`
    // funciona **agora**, com a API síncrona, e continua funcionando depois, com a API do Worker.
    //
    // É a única forma de migração que não tem um dia de ruptura: os dois mundos são válidos ao
    // mesmo tempo, e a mudança de verdade acontece embaixo, sem ninguém reescrever nada.
    const fn = new Function(
      '__escopo__',
      'with (__escopo__) { return (async function () { "use strict";\n' + codigo + '\n}); }',
    );

    await fn(escopo)();
  };
}
