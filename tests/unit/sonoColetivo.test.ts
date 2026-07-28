// A noite passa quando todos dormem — item 139.
//
// `porQueNaoPodeDormir` recusava o convidado com `souORelogio`, e a razão era boa: o relógio do
// mundo é do anfitrião. A consequência não era: num mundo compartilhado a noite deixava de ter
// saída. Quem hospeda dorme sozinho e passa a noite; quem entrou fica acordado no escuro esperando,
// sem nada que possa fazer e sem nada explicando por quê.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { estadoDoSonoColetivo, RegistroDeSono } from '../../src/game/sonoColetivo';
import { porQueNaoPodeDormir } from '../../src/game/dormir';

const nomes = new Map([['a', 'Ana'], ['b', 'Bia'], ['c', 'Caio']]);

describe('todos, e não a maioria', () => {
  it('CRÍTICO: com um acordado, a noite não passa', () => {
    // Maioria significa ter a noite pulada contra a própria vontade — e quem estava no fundo de uma
    // caverna acabou de perder a noite inteira de trabalho seguro. Numa sessão de dois, que é o
    // caso comum, "maioria" nem quer dizer nada.
    const e = estadoDoSonoColetivo({ presentes: ['a', 'b', 'c'], dormindo: new Set(['a', 'b']), nomes });
    expect(e.todosDormem).toBe(false);
    expect(e.quantosDormem).toBe(2);
  });

  it('CRÍTICO: com todos deitados, passa', () => {
    const e = estadoDoSonoColetivo({ presentes: ['a', 'b'], dormindo: new Set(['a', 'b']), nomes });
    expect(e.todosDormem).toBe(true);
    expect(e.faltam).toEqual([]);
  });

  it('CRÍTICO: a mensagem DIZ QUEM falta', () => {
    // O custo de exigir todos é que uma pessoa distraída segura a noite dos outros. Sem o nome, o
    // recurso vira uma espera sem explicação — pior que não existir.
    const e = estadoDoSonoColetivo({ presentes: ['a', 'b', 'c'], dormindo: new Set(['a']), nomes });
    expect(e.mensagem).toMatch(/Bia/);
    expect(e.mensagem).toMatch(/Caio/);
    expect(e.mensagem).toMatch(/1\/3/);
  });

  it('ninguém dormindo não gera mensagem', () => {
    // Um aviso a cada vez que alguém apenas passa perto de uma cama seria ruído constante.
    const e = estadoDoSonoColetivo({ presentes: ['a', 'b'], dormindo: new Set(), nomes });
    expect(e.mensagem).toBeNull();
    expect(e.todosDormem).toBe(false);
  });

  it('sozinho no mundo, dormir não anuncia nada', () => {
    // A partida local é o caso mais comum, e "Todos dormiram" para uma pessoa só é absurdo.
    const e = estadoDoSonoColetivo({ presentes: ['a'], dormindo: new Set(['a']), nomes });
    expect(e.todosDormem).toBe(true);
    expect(e.mensagem).toBeNull();
  });

  it('um id sem nome aparece como o próprio id', () => {
    // Melhor um id feio que uma frase com um buraco onde deveria estar um nome.
    const e = estadoDoSonoColetivo({ presentes: ['a', 'zz'], dormindo: new Set(['a']) });
    expect(e.mensagem).toMatch(/zz/);
  });
});

describe('quem saiu não conta', () => {
  it('CRÍTICO: alguém que desconectou DORMINDO não trava a noite para sempre', () => {
    // O modo de falha que este teste existe para pegar. Só acontece quando alguém sai enquanto
    // dorme — raro o bastante para não aparecer em nenhum teste manual, e permanente quando
    // acontece: o "todos dormiram" nunca mais seria verdade e ninguém saberia por quê.
    const r = new RegistroDeSono();
    r.marcar('a', true);
    r.marcar('b', true);
    r.sairam(['a']); // b desconectou
    const e = estadoDoSonoColetivo({ presentes: ['a'], dormindo: r.conjunto, nomes });
    expect(e.todosDormem).toBe(true);
  });

  it('CRÍTICO: o total vem dos PRESENTES, não do conjunto de dormindo', () => {
    // Contar pelo conjunto deixaria alguém que saiu dormindo para sempre.
    const e = estadoDoSonoColetivo({ presentes: ['a'], dormindo: new Set(['a', 'fantasma']), nomes });
    expect(e.total).toBe(1);
    expect(e.todosDormem).toBe(true);
  });

  it('presentes repetidos não contam duas vezes', () => {
    const e = estadoDoSonoColetivo({ presentes: ['a', 'a', 'b'], dormindo: new Set(['a', 'b']), nomes });
    expect(e.total).toBe(2);
    expect(e.todosDormem).toBe(true);
  });

  it('levantar tira do registro', () => {
    const r = new RegistroDeSono();
    r.marcar('a', true);
    expect(r.estaDormindo('a')).toBe(true);
    r.marcar('a', false);
    expect(r.estaDormindo('a')).toBe(false);
  });

  it('sessão vazia não estoura', () => {
    const e = estadoDoSonoColetivo({ presentes: [], dormindo: new Set() });
    expect(e.total).toBe(0);
    expect(e.todosDormem).toBe(false);
    expect(e.mensagem).toBeNull();
  });
});

describe('a recusa antiga saiu junto com a regra', () => {
  it('CRÍTICO: o convidado pode deitar', () => {
    // Era `souORelogio`. O campo saiu do tipo em vez de ficar sem leitor — que é como um parâmetro
    // morto sobrevive a três refatorações e depois confunde quem tenta entender a regra.
    expect(porQueNaoPodeDormir({ ehNoite: true, abrigado: true, jaDormindo: false })).toBeNull();
  });

  it('as outras três recusas continuam valendo', () => {
    const base = { ehNoite: true, abrigado: true, jaDormindo: false };
    expect(porQueNaoPodeDormir({ ...base, ehNoite: false })).toMatch(/noite/i);
    expect(porQueNaoPodeDormir({ ...base, abrigado: false })).toMatch(/aberto/i);
    expect(porQueNaoPodeDormir({ ...base, jaDormindo: true })).toMatch(/dormindo/i);
  });

  it('`souORelogio` não sobreviveu em lugar nenhum', () => {
    const dormir = readFileSync('src/game/dormir.ts', 'utf8');
    const main = readFileSync('src/main.ts', 'utf8');
    expect(dormir).not.toMatch(/souORelogio: boolean/);
    expect(main).not.toMatch(/souORelogio:/);
  });
});

describe('a fiação existe — código presente não é código ativo', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  const protocolo = readFileSync('src/net/protocol.ts', 'utf8');

  it('CRÍTICO: o relógio só acelera quando todos dormem', () => {
    // Sem a consulta, o anfitrião voltaria a passar a noite sozinho e o item inteiro não faria
    // nada — com o convidado agora deitado, esperando algo que nunca acontece.
    expect(main).toMatch(/if \(dormindo && peerSync\.role !== 'guest'\)/);
    expect(main).toMatch(/\.todosDormem\) \{\s*\n\s*ritmo = RITMO_DORMINDO;/);
  });

  it('CRÍTICO: deitar e levantar anunciam', () => {
    expect((main.match(/anunciarSono\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(main).toMatch(/anunciarSono\(true\)/);
    expect(main).toMatch(/anunciarSono\(false\)/);
  });

  it('CRÍTICO: quem sai é retirado da conta', () => {
    // Nos dois caminhos: a mensagem `player_left` e a desconexão detectada localmente.
    const iLeft = main.indexOf("case 'player_left'");
    const trecho = main.slice(iLeft, iLeft + 600);
    expect(trecho).toMatch(/avaliarSonoColetivo\(\)/);
    expect(main).toMatch(/peerSync\.broadcast\(\{ type: 'player_left', playerId: peerId \}\);\s*\n\s*avaliarSonoColetivo\(\)/);
  });

  it('CRÍTICO: o aviso vai para TODOS, não só para quem deitou', () => {
    // Quem está acordado precisa saber que os outros estão esperando por ele.
    const corpo = main.slice(main.indexOf('function avaliarSonoColetivo'), main.indexOf('function avaliarSonoColetivo') + 1400);
    expect(corpo).toMatch(/peerSync\.broadcast\(\{ type: 'chat_message'/);
  });

  it('o convidado manda o pedido em vez de marcar sozinho', () => {
    const corpo = main.slice(main.indexOf('function anunciarSono'), main.indexOf('function presentesNaSessao'));
    expect(corpo).toMatch(/peerSync\.sendToHost\(\{ type: 'sleep_state'/);
    expect(corpo.indexOf('sendToHost')).toBeLessThan(corpo.indexOf('registroDeSono.marcar'));
  });

  it('a mensagem está no protocolo', () => {
    expect(protocolo).toMatch(/type: 'sleep_state'/);
    expect(protocolo).toMatch(/\| SleepStateMsg;/);
  });
});
