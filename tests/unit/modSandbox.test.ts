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
// Eles verificam que os nomes perigosos estão **sombreados** — a técnica clássica de passá-los
// como parâmetros com valor `undefined`. Isso barra o acesso direto e acidental, que é o caso
// real de um script gerado por IA.
//
// **Não é uma fronteira de segurança contra código hostil.** Continua havendo saída por
// `[].constructor.constructor('return globalThis')()` e parentes. A fronteira de verdade é
// rodar em Web Worker sem `fetch` (item 358 do checklist), e ela segue pendente. O teste abaixo
// documenta a brecha em vez de fingir que ela não existe.

import { describe, it, expect } from 'vitest';
import { GLOBAIS_BLOQUEADOS, compilarScriptDeMod } from '../../src/mods/sandbox';

/** Roda um script e devolve o que ele reportou pela `api`. */
function rodar(codigo: string): unknown {
  let recebido: unknown;
  const api = { registrar: (v: unknown) => { recebido = v; } };
  compilarScriptDeMod(codigo)(api);
  return recebido;
}

describe('sandbox de mod — o escopo global não vaza mais', () => {
  it('CRÍTICO: `fetch` não está ao alcance do script', () => {
    // O mais grave da lista: um mod poderia exfiltrar o mundo salvo, ou a chave de API do cofre,
    // para qualquer host — sem o jogador declarar nada.
    expect(rodar('api.registrar(typeof fetch)')).toBe('undefined');
  });

  it('CRÍTICO: `window`, `globalThis` e `self` não estão ao alcance', () => {
    expect(rodar('api.registrar(typeof window)')).toBe('undefined');
    expect(rodar('api.registrar(typeof globalThis)')).toBe('undefined');
    expect(rodar('api.registrar(typeof self)')).toBe('undefined');
  });

  it('CRÍTICO: nada de armazenamento — `localStorage` e `indexedDB`', () => {
    // O cofre de segredos e os mundos salvos vivem no IndexedDB da mesma origem.
    expect(rodar('api.registrar(typeof localStorage)')).toBe('undefined');
    expect(rodar('api.registrar(typeof indexedDB)')).toBe('undefined');
  });

  it('CRÍTICO: nada de rede por outros caminhos', () => {
    expect(rodar('api.registrar(typeof XMLHttpRequest)')).toBe('undefined');
    expect(rodar('api.registrar(typeof WebSocket)')).toBe('undefined');
    expect(rodar('api.registrar(typeof EventSource)')).toBe('undefined');
    expect(rodar('api.registrar(typeof navigator)')).toBe('undefined');
  });

  it('`document` não está ao alcance — nem para desenhar, nem para ler', () => {
    expect(rodar('api.registrar(typeof document)')).toBe('undefined');
  });

  it('a `api` do mod CONTINUA funcionando — o bloqueio não pode matar o recurso', () => {
    // Sem isto, "consertar" seria trivial e inútil: bastaria não executar o script.
    expect(rodar('api.registrar(1 + 1)')).toBe(2);
    expect(rodar('const f = (n) => n * 3; api.registrar(f(5))')).toBe(15);
  });

  it('o que é seguro continua disponível: Math, JSON, Date, Array', () => {
    // Um mod precisa calcular, serializar e sortear. Bloquear demais tornaria a plataforma
    // inútil, e a tentação seguinte seria devolver o `fetch` junto.
    expect(rodar('api.registrar(typeof Math)')).toBe('object');
    expect(rodar('api.registrar(typeof JSON)')).toBe('object');
    expect(rodar('api.registrar(typeof Date)')).toBe('function');
    expect(rodar('api.registrar(Math.max(2, 7))')).toBe(7);
  });

  it('modo estrito ativo: atribuição solta não cria global', () => {
    expect(() => rodar('vazando = 1')).toThrow();
  });

  it('a lista de bloqueados cobre os nomes que dão rede ou armazenamento', () => {
    for (const nome of ['fetch', 'XMLHttpRequest', 'WebSocket', 'indexedDB', 'localStorage', 'window', 'globalThis', 'document', 'navigator']) {
      expect(GLOBAIS_BLOQUEADOS, `faltou bloquear ${nome}`).toContain(nome);
    }
  });
});

describe('a brecha que CONTINUA aberta — documentada, não escondida', () => {
  it('o sombreamento não impede a saída pelo construtor', () => {
    // Este teste passa quando a fuga FUNCIONA, e é intencional. Ele existe para que ninguém leia
    // os testes acima e conclua que o sandbox é uma fronteira de segurança — não é.
    //
    // `[].constructor` é `Array`; `Array.constructor` é `Function`; e `Function('return this')()`
    // devolve o objeto global, porque a função criada é avaliada no escopo global.
    //
    // Fechar isto exige rodar em outro reino de execução — Web Worker sem `fetch`, ou iframe com
    // sandbox. É o item 358 do checklist, e segue pendente. Quando ele for feito, este teste deve
    // ser invertido.
    const escapou = rodar('api.registrar(typeof [].constructor.constructor("return this")())');
    expect(escapou).toBe('object');
  });
});
