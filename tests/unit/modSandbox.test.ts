// O que um script de mod alcança — e o que ele NÃO pode alcançar.
//
// ## Por que este arquivo existe
//
// O `ModRuntime` compilava o script assim:
//
// ```ts
// // `new Function` com um único parâmetro: o corpo não recebe `window` nem `globalThis`
// const fn = new Function('api', `"use strict";\n${script.code}`);
// ```
//
// **O comentário estava errado.** `new Function` isola o script do escopo *local* de quem o
// cria — nada mais. O corpo continua sendo avaliado no escopo **global**, então `window`,
// `fetch`, `document`, `localStorage` e `indexedDB` estão todos ao alcance como variáveis
// livres. Não passar como argumento não esconde nada.
//
// Isso importa neste projeto mais que na média: os scripts são **escritos por uma IA** a pedido
// do jogador, e rodam no navegador dele, na mesma origem que guarda os mundos salvos e o cofre
// de chaves de API.
//
// ## O que estes testes garantem, e o que não garantem
//
// O escopo do script é um `with` sobre um `Proxy` cujo `has` responde **sempre que sim**. Dentro
// de um `with`, o motor pergunta ao objeto se ele tem cada nome livre ANTES de procurar no
// escopo externo — respondendo sempre que sim, nenhuma busca chega ao global, e o `get` decide
// nome a nome o que devolver.
//
// A consequência que mais importa: é uma lista de **permitidos**, não de negados. O que ninguém
// previu — uma API nova do navegador, ou uma que eu esqueci — já nasce bloqueada.
//
// **Este arquivo testa o escopo, não a fronteira.** A fronteira de verdade é o Web Worker de
// `modWorker.ts` (item 358), e ela existe desde que o `ModRuntime` passou a executar lá. O escopo
// virou a segunda camada: dentro do Worker, é ele que impede um script de alcançar por engano o que
// sobrou do global daquele reino.
//
// A saída por `[].constructor.constructor('return globalThis')()` continua funcionando — aqui, no
// reino do teste. É o último bloco de testes, e ele explica por que isso deixou de importar.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { GLOBAIS_BLOQUEADOS, compilarScriptDeMod } from '../../src/mods/sandbox';
import { GLOBAIS_A_APAGAR } from '../../src/mods/protocoloDeMods';

/**
 * Roda um script e devolve o que ele reportou pela `api`.
 *
 * `async` desde o item 1251: o corpo do script virou uma função assíncrona, para que `await
 * api.world.getBlock(...)` já seja válido hoje e continue válido quando a API passar a devolver
 * promessas de dentro do Worker (item 358). O corpo ainda roda **sincronamente até o primeiro
 * `await`**, então quase todos os testes abaixo continuariam passando sem o `await` — mas os que
 * verificam **erro** não: com corpo assíncrono, um `throw` síncrono vira promessa rejeitada, e um
 * `expect(...).toThrow()` passaria a não ver nada.
 */
async function rodar(codigo: string): Promise<unknown> {
  let recebido: unknown;
  const api = { registrar: (v: unknown) => { recebido = v; } };
  await compilarScriptDeMod(codigo)(api);
  return recebido;
}

describe('sandbox de mod — o escopo global não vaza mais', () => {
  it('CRÍTICO: `fetch` não está ao alcance do script', async () => {
    // O mais grave da lista: um mod poderia exfiltrar o mundo salvo, ou a chave de API do cofre,
    // para qualquer host — sem o jogador declarar nada.
    expect(await rodar('api.registrar(typeof fetch)')).toBe('undefined');
  });

  it('CRÍTICO: `window`, `globalThis` e `self` não estão ao alcance', async () => {
    expect(await rodar('api.registrar(typeof window)')).toBe('undefined');
    expect(await rodar('api.registrar(typeof globalThis)')).toBe('undefined');
    expect(await rodar('api.registrar(typeof self)')).toBe('undefined');
  });

  it('CRÍTICO: nada de armazenamento — `localStorage` e `indexedDB`', async () => {
    // O cofre de segredos e os mundos salvos vivem no IndexedDB da mesma origem.
    expect(await rodar('api.registrar(typeof localStorage)')).toBe('undefined');
    expect(await rodar('api.registrar(typeof indexedDB)')).toBe('undefined');
  });

  it('CRÍTICO: nada de rede por outros caminhos', async () => {
    expect(await rodar('api.registrar(typeof XMLHttpRequest)')).toBe('undefined');
    expect(await rodar('api.registrar(typeof WebSocket)')).toBe('undefined');
    expect(await rodar('api.registrar(typeof EventSource)')).toBe('undefined');
    expect(await rodar('api.registrar(typeof navigator)')).toBe('undefined');
  });

  it('`document` não está ao alcance — nem para desenhar, nem para ler', async () => {
    expect(await rodar('api.registrar(typeof document)')).toBe('undefined');
  });

  it('a `api` do mod CONTINUA funcionando — o bloqueio não pode matar o recurso', async () => {
    // Sem isto, "consertar" seria trivial e inútil: bastaria não executar o script.
    expect(await rodar('api.registrar(1 + 1)')).toBe(2);
    expect(await rodar('const f = (n) => n * 3; api.registrar(f(5))')).toBe(15);
  });

  it('o que é seguro continua disponível: Math, JSON, Date, Array', async () => {
    // Um mod precisa calcular, serializar e sortear. Bloquear demais tornaria a plataforma
    // inútil, e a tentação seguinte seria devolver o `fetch` junto.
    expect(await rodar('api.registrar(typeof Math)')).toBe('object');
    expect(await rodar('api.registrar(typeof JSON)')).toBe('object');
    expect(await rodar('api.registrar(typeof Date)')).toBe('function');
    expect(await rodar('api.registrar(Math.max(2, 7))')).toBe(7);
  });

  it('CRÍTICO: TODO nome da lista de perigosos é de fato inalcançável', async () => {
    // A lista deixou de ser decoração: cada nome dela é executado dentro do sandbox e precisa
    // sair `undefined`. Antes o teste só verificava que a lista CONTINHA o nome — o que provava
    // que alguém o escreveu, não que ele está bloqueado.
    for (const nome of GLOBAIS_BLOQUEADOS) {
      expect(await rodar(`api.registrar(typeof ${nome})`), `${nome} continua alcançável`).toBe('undefined');
    }
  });

  it('CRÍTICO: é lista de PERMITIDOS — o que ninguém previu já nasce bloqueado', async () => {
    // A diferença que mais importa. Com lista de negados, uma API nova do navegador (ou uma que
    // eu esqueci) entra livre. Aqui o `with` + Proxy responde "eu tenho esse nome" para tudo, e
    // devolve `undefined` para o que não está explicitamente permitido.
    for (const inventado of ['WebTransport', 'showSaveFilePicker', 'apiQueAindaNaoExiste', 'crypto', 'performance']) {
      expect(await rodar(`api.registrar(typeof ${inventado})`), `${inventado} vazou`).toBe('undefined');
    }
  });

  it('escrever numa variável global é recusado, não silenciosamente ignorado', async () => {
    // `with` obriga o invólucro a ser permissivo, onde `vazando = 1` criaria um global de
    // verdade. O `set` do Proxy é o que ocupa o lugar do `"use strict"` externo.
    await expect(rodar('vazando = 1')).rejects.toThrow(/global/i);
  });
});

describe('modo estrito no corpo do script', async () => {
  it('CRÍTICO: `this` numa função chamada sem receptor NÃO é o objeto global', async () => {
    // Rota de fuga mais curta que existe, e ela ficaria aberta se o corpo herdasse o modo
    // permissivo que o `with` obriga no invólucro.
    expect(await rodar('api.registrar(typeof (function(){ return this; })())')).toBe('undefined');
  });
});

describe('a fuga pelo construtor — o que mudou não foi a tranca, foi o cofre', () => {
  it('a fuga CONTINUA funcionando, e passou a não servir para nada', async () => {
    // Este teste passa quando a fuga funciona, e continua sendo intencional — mas agora por um
    // motivo diferente do de antes.
    //
    // Antes ele existia para que ninguém lesse os testes acima e concluísse que o sandbox era uma
    // fronteira de segurança. Não era: `[].constructor` é `Array`, `Array.constructor` é `Function`,
    // e `Function('return this')()` devolve o objeto global — porque a função criada assim é
    // avaliada no escopo global **do reino em que roda**.
    //
    // Continua verdade, e é justamente o ponto. Aqui, no reino do teste, ela devolve um global cheio.
    // Em produção o script não roda mais aqui: roda no Worker de `modWorker.ts`, cujo global foi
    // esvaziado antes de existir um único script. A mesma fuga devolve o global de **lá**.
    //
    // A defesa deixou de ser "eu lembrei de bloquear esse nome" e passou a ser "não existe nada para
    // alcançar" — a diferença entre uma tranca melhor e um cofre vazio.
    const escapou = await rodar('api.registrar(typeof [].constructor.constructor("return this")())');
    expect(escapou).toBe('object');
  });

  it('CRÍTICO: o reino de produção é um Worker, não este', () => {
    // A afirmação acima só vale se o script de verdade for mesmo para outro reino. Sem esta
    // verificação, alguém poderia trocar o padrão do `ModRuntime` de volta para execução local e
    // todos os testes deste arquivo continuariam verdes — descrevendo uma proteção desligada.
    const fonte = readFileSync(new URL('../../src/mods/ModRuntime.ts', import.meta.url), 'utf8');
    expect(fonte).toMatch(/criarPorta: \(\) => Porta = criarPortaDeWorker/);
    expect(fonte).toMatch(/new Worker\(new URL\('\.\/modWorker\.ts'/);
  });

  it('CRÍTICO: o Worker apaga o que torna a fuga perigosa', () => {
    // O global do Worker não é vazio por natureza: `fetch` e `indexedDB` existem lá. O segundo é o
    // mais grave — é onde moram os mundos salvos e o cofre de chaves, na mesma origem.
    for (const critico of ['fetch', 'indexedDB', 'XMLHttpRequest', 'WebSocket', 'importScripts']) {
      expect(GLOBAIS_A_APAGAR).toContain(critico);
    }
    const casca = readFileSync(new URL('../../src/mods/modWorker.ts', import.meta.url), 'utf8');
    expect(casca).toMatch(/esvaziarOReino\(\)/);
  });

  it('o `with` + Proxy continua valendo, agora como segunda camada', () => {
    // Ele deixou de ser a única defesa e não virou inútil: dentro do Worker ele é o que impede um
    // script de alcançar por engano o que sobrou do global de lá. Duas camadas fracas em série não
    // somam uma forte, mas a de fora deixou de ser a única.
    expect(GLOBAIS_BLOQUEADOS.length).toBeGreaterThan(5);
  });
});
