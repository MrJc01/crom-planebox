// Segredos não saem em texto — itens 735 e 736 do checklist.
//
// ## O caminho de saída que não é a rede
//
// `api.env.get('API_KEY')` devolve a chave de verdade ao script, e isso é **correto**: ele roda
// no mesmo cliente, com os mesmos privilégios do jogo, e um mod que precisa da chave para chamar
// uma API precisa da chave. Esconder dele seria teatro.
//
// A fronteira real é o valor **não sair da máquina**. E o caminho mais fácil de saída não é o
// `fetch` — é o texto:
//
// ```js
// api.log('conectando com', api.env.get('API_KEY'));
// ```
//
// A chave vai para o log do mod, aparece no painel, entra no diagnóstico, e pode acabar no
// histórico da conversa que o agente lê. Sai da máquina sem nenhuma chamada de rede envolvida.
//
// E acontece **sem má intenção**: depurar imprimindo a variável é o reflexo mais comum que
// existe, e uma IA escrevendo o mod faz exatamente isso.

import { describe, it, expect } from 'vitest';
import { MASCARA, TAMANHO_MINIMO_REDACAO, contemSegredo, redigirSegredos } from '../../src/mods/redacao';
import { ModContext } from '../../src/mods/ModAPI';

const CHAVE = 'sk-proj-9f3a8b2c1d4e5f6a7b8c9d0e';

describe('redigirSegredos', () => {
  it('CRÍTICO: a chave some do texto', () => {
    const saida = redigirSegredos(`conectando com ${CHAVE} agora`, [CHAVE]);
    expect(saida).not.toContain(CHAVE);
    expect(saida).toContain(MASCARA);
  });

  it('CRÍTICO: some em TODAS as posições, não só na primeira', () => {
    const saida = redigirSegredos(`${CHAVE} e de novo ${CHAVE}`, [CHAVE]);
    expect(contemSegredo(saida, [CHAVE])).toBe(false);
  });

  it('CRÍTICO: some mesmo colada a outro texto, sem espaço em volta', () => {
    // O caso realista: `fetch('https://api.x/v1?key=' + chave)` numa mensagem de erro.
    const saida = redigirSegredos(`https://api.x/v1?key=${CHAVE}&t=1`, [CHAVE]);
    expect(saida).not.toContain(CHAVE);
  });

  it('o segredo mais longo é tratado primeiro', () => {
    // Se um segredo contém outro — uma chave e o seu prefixo — redigir o curto antes partiria o
    // longo ao meio e deixaria a cauda dele visível.
    const curto = 'prefixo123';
    const longo = 'prefixo123-resto-da-chave';
    const saida = redigirSegredos(`valor: ${longo}`, [curto, longo]);
    expect(saida).not.toContain('resto-da-chave');
  });

  it('valor curto NÃO é redigido — o dano colateral seria pior', () => {
    // Um segredo de dois ou três caracteres apareceria por acaso em quase toda mensagem, e o log
    // viraria uma sopa de asteriscos: inútil para depurar e escondendo o problema de verdade.
    expect(redigirSegredos('o valor de on é on', ['on'])).toBe('o valor de on é on');
    expect(TAMANHO_MINIMO_REDACAO).toBeGreaterThanOrEqual(4);
  });

  it('texto sem segredo passa intacto', () => {
    expect(redigirSegredos('tudo certo por aqui', [CHAVE])).toBe('tudo certo por aqui');
  });

  it('lista vazia não quebra nem altera nada', () => {
    expect(redigirSegredos('mensagem', [])).toBe('mensagem');
  });

  it('caractere especial de regex no segredo não quebra a redação', () => {
    // Uma chave com `+`, `?` ou `.` viraria uma expressão regular inválida — ou pior, uma válida
    // que casa com a coisa errada.
    const esquisita = 'a+b.c*d?e(f)';
    expect(redigirSegredos(`x ${esquisita} y`, [esquisita])).not.toContain(esquisita);
  });
});

describe('o log do mod nunca ARMAZENA o segredo', () => {
  function contexto(): ModContext {
    const ctx = new ModContext({ id: 'm1', name: 'Mod', revision: 1 } as any);
    ctx.segredos = [CHAVE];
    return ctx;
  }

  it('CRÍTICO: `api.log` com a chave grava mascarado', () => {
    const ctx = contexto();
    ctx.log('log', 'conectando com', CHAVE);
    expect(JSON.stringify(ctx.logs)).not.toContain(CHAVE);
  });

  it('CRÍTICO: a redação acontece ao GRAVAR, não ao exibir', () => {
    // Proteger em cada leitor — painel, diagnóstico, contexto do agente — é uma corrida que se
    // perde na primeira vez que alguém esquecer um leitor novo. Aqui o valor nunca chega a ser
    // armazenado, então não há leitor que possa vazá-lo.
    const ctx = contexto();
    ctx.log('log', CHAVE);
    expect(ctx.logs[0].message).not.toContain(CHAVE);
    expect(ctx.logs[0].message).toContain(MASCARA);
  });

  it('CRÍTICO: a chave dentro de um objeto serializado também some', () => {
    // `api.log({ config })` é tão comum quanto imprimir a variável solta.
    const ctx = contexto();
    ctx.log('log', { url: 'https://api.x', key: CHAVE });
    expect(JSON.stringify(ctx.logs)).not.toContain(CHAVE);
  });

  it('CRÍTICO: mensagem de ERRO com a chave também é redigida', () => {
    // `fetch(url + chave)` que falha traz a URL inteira, com a chave dentro, no texto da exceção.
    const ctx = contexto();
    ctx.recordError('s1', new Error(`falhou em https://api.x?key=${CHAVE}`));
    expect(JSON.stringify(ctx.logs)).not.toContain(CHAVE);
  });

  it('sem segredos configurados, o log sai literal', () => {
    const ctx = new ModContext({ id: 'm2', name: 'Mod', revision: 1 } as any);
    ctx.log('log', 'mensagem comum');
    expect(ctx.logs[0].message).toBe('mensagem comum');
  });
});
