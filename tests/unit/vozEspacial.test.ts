// A voz vem de onde a pessoa está, e dá para calar quem se quiser — itens 1414 e 1415.
//
// Cada par recebia um `<audio autoplay>` e mais nada: todo mundo se ouvia no mesmo volume, de
// qualquer distância, de qualquer direção. Quatro pessoas espalhadas por quatrocentos metros soavam
// exatamente como quatro pessoas na mesma sala, e a única informação que a voz carrega além das
// palavras — *onde você está* — se perdia inteira.
//
// E não havia como emudecer ninguém, só a si mesmo. Num mundo público isso é a diferença entre
// jogar e sair.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  misturaDaVoz,
  SilenciadosDeVoz,
  ALCANCE_DA_VOZ,
  RAIO_INTIMO,
} from '../../src/net/vozEspacial';
import { interpretarComandoDeSilencio } from '../../src/net/comandoDeSilencio';

const OUVINTE = { x: 0, y: 40, z: 0, yaw: 0 };

/** Armazenamento de mentira, para o silêncio poder ser testado sem navegador. */
function armazem() {
  const dados = new Map<string, string>();
  return {
    dados,
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => { dados.set(k, v); },
  };
}

describe('a voz tem lugar — item 1414', () => {
  it('CRÍTICO: quem está longe soa mais baixo que quem está perto', () => {
    // O item inteiro. Sem isto, aproximar-se de alguém não significa nada.
    const perto = misturaDaVoz(OUVINTE, { x: 10, y: 40, z: 0 }, false);
    const longe = misturaDaVoz(OUVINTE, { x: 60, y: 40, z: 0 }, false);
    expect(perto.ganho).toBeGreaterThan(longe.ganho);
  });

  it('CRÍTICO: além do alcance não se ouve nada', () => {
    // Finito de propósito: é o alcance que faz aproximar-se ser uma decisão.
    expect(misturaDaVoz(OUVINTE, { x: ALCANCE_DA_VOZ + 1, y: 40, z: 0 }, false).ganho).toBe(0);
  });

  it('CRÍTICO: o alcance da voz é bem maior que o dos efeitos', () => {
    // Um alcance curto demais transformaria toda conversa em "espera, deixa eu chegar aí". A voz é
    // o que permite combinar alguma coisa a distância.
    expect(ALCANCE_DA_VOZ).toBeGreaterThan(64);
  });

  it('CRÍTICO: quem está à direita soa à direita', () => {
    // Com `yaw = 0` o "direita" da escuta é +x — ver `stereoPan`.
    expect(misturaDaVoz(OUVINTE, { x: 30, y: 40, z: 0 }, false).pan).toBeGreaterThan(0.5);
    expect(misturaDaVoz(OUVINTE, { x: -30, y: 40, z: 0 }, false).pan).toBeLessThan(-0.5);
  });

  it('CRÍTICO: virar a cabeça troca o lado', () => {
    // Se o pan viesse só da posição e não do olhar, a voz ficaria presa ao mundo e não à cabeça —
    // e girar no lugar não mudaria nada, que é o oposto de como se ouve.
    const olhandoParaTras = { ...OUVINTE, yaw: Math.PI };
    const a = misturaDaVoz(OUVINTE, { x: 30, y: 40, z: 0 }, false).pan;
    const b = misturaDaVoz(olhandoParaTras, { x: 30, y: 40, z: 0 }, false).pan;
    expect(Math.sign(a)).toBe(-Math.sign(b));
  });

  it('CRÍTICO: quem está colado sai centrado e em volume cheio', () => {
    // Sem a zona morta, a voz de quem está a meio metro salta de um lado para o outro a cada
    // movimento do mouse — a direção de alguém muito perto muda por completo com um giro pequeno.
    const colado = misturaDaVoz(OUVINTE, { x: RAIO_INTIMO - 0.5, y: 40, z: 0 }, false);
    expect(colado.ganho).toBe(1);
    expect(colado.pan).toBe(0);
  });

  it('CRÍTICO: a distância conta a altura', () => {
    // Só em x/z, alguém trinta metros acima soaria colado. Num mundo com cavernas e torres isso é
    // comum, não excepcional.
    const acima = misturaDaVoz(OUVINTE, { x: 0, y: 40 + ALCANCE_DA_VOZ + 5, z: 0 }, false);
    expect(acima.ganho).toBe(0);
  });

  it('CRÍTICO: quem ainda não mandou posição é ouvido, e não silenciado', () => {
    // A primeira coisa que alguém faz ao entrar é falar. Emudecê-lo até o primeiro `player_state`
    // o receberia com um silêncio que ninguém consegue diagnosticar.
    const semPosicao = misturaDaVoz(OUVINTE, null, false);
    expect(semPosicao.ganho).toBe(1);
    expect(semPosicao.pan).toBe(0);
  });

  it('o ganho nunca sai de 0..1 nem o pan de -1..1', () => {
    for (const d of [0, 1, 5, 30, 95, 200, 1000]) {
      for (const yaw of [0, 1, 3, -2]) {
        const m = misturaDaVoz({ ...OUVINTE, yaw }, { x: d, y: 40 + d / 3, z: d / 2 }, false);
        expect(m.ganho).toBeGreaterThanOrEqual(0);
        expect(m.ganho).toBeLessThanOrEqual(1);
        expect(m.pan).toBeGreaterThanOrEqual(-1);
        expect(m.pan).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('o silêncio — item 1415', () => {
  it('CRÍTICO: quem está silenciado tem ganho zero, esteja onde estiver', () => {
    expect(misturaDaVoz(OUVINTE, { x: 1, y: 40, z: 0 }, true).ganho).toBe(0);
    expect(misturaDaVoz(OUVINTE, null, true).ganho).toBe(0);
  });

  it('CRÍTICO: o silêncio sobrevive a uma reconexão', () => {
    // Se caísse ao reconectar, o jogador refaria a escolha toda vez que a conexão oscilasse — que é
    // exatamente quando ele menos quer mexer em menu.
    const a = armazem();
    new SilenciadosDeVoz(a).silenciar('par-7');
    expect(new SilenciadosDeVoz(a).estaSilenciado('par-7')).toBe(true);
  });

  it('CRÍTICO: um armazenamento corrompido não derruba a entrada no mundo', () => {
    // Silêncio perdido é um aborrecimento; não conseguir entrar é o jogo.
    const a = armazem();
    a.dados.set('crom:voz:silenciados', '{isto não é json');
    expect(() => new SilenciadosDeVoz(a)).not.toThrow();
    expect(new SilenciadosDeVoz(a).lista()).toEqual([]);
  });

  it('conteúdo de tipo errado é ignorado sem estourar', () => {
    const a = armazem();
    a.dados.set('crom:voz:silenciados', '{"nao":"lista"}');
    expect(new SilenciadosDeVoz(a).lista()).toEqual([]);
    const b = armazem();
    b.dados.set('crom:voz:silenciados', '[1, null, "ok", {}]');
    expect(new SilenciadosDeVoz(b).lista()).toEqual(['ok']);
  });

  it('sem armazenamento funciona só para a sessão, sem quebrar', () => {
    // Modo privado, ou o `main` rodando onde `localStorage` não existe.
    const s = new SilenciadosDeVoz();
    s.silenciar('x');
    expect(s.estaSilenciado('x')).toBe(true);
  });

  it('alternar devolve o estado novo e é idempotente por par', () => {
    const s = new SilenciadosDeVoz(armazem());
    expect(s.alternar('a')).toBe(true);
    expect(s.alternar('a')).toBe(false);
    s.silenciar('b'); s.silenciar('b');
    expect(s.lista()).toEqual(['b']);
  });
});

describe('o comando', () => {
  const presentes = [{ id: 'p1', nome: 'Ana' }, { id: 'p2', nome: 'José' }];

  it('CRÍTICO: `/mudo Ana` silencia quem se vê pelo nome, guardando o id', () => {
    // O jogador digita o nome, que é o que ele vê na plaquinha. O silêncio é guardado por id, que é
    // o que não muda — guardar por nome ficaria furado por quem trocasse de apelido, e é a
    // primeira coisa que alguém tenta.
    const s = new SilenciadosDeVoz(armazem());
    const r = interpretarComandoDeSilencio('/mudo Ana', presentes, s);
    expect(r.tratado).toBe(true);
    expect(s.estaSilenciado('p1')).toBe(true);
    expect(s.lista()).toEqual(['p1']);
  });

  it('CRÍTICO: um comando que não é deste módulo passa adiante', () => {
    // `tratado: false` é o que devolve o comando ao caminho normal. Um `true` por engano engoliria
    // silenciosamente `/tp`, `/give` e todo o resto.
    for (const c of ['/tp 0 0 0', '/give pedra', '/help', 'oi pessoal', '']) {
      expect(interpretarComandoDeSilencio(c, presentes, new SilenciadosDeVoz()).tratado, c).toBe(false);
    }
  });

  it('nome com acento e caixa diferente resolve', () => {
    const s = new SilenciadosDeVoz(armazem());
    interpretarComandoDeSilencio('/mudo jose', presentes, s);
    expect(s.estaSilenciado('p2')).toBe(true);
  });

  it('`/ouvir` desfaz', () => {
    const s = new SilenciadosDeVoz(armazem());
    interpretarComandoDeSilencio('/mudo Ana', presentes, s);
    const r = interpretarComandoDeSilencio('/ouvir Ana', presentes, s);
    expect(r.tratado).toBe(true);
    expect(s.estaSilenciado('p1')).toBe(false);
  });

  it('CRÍTICO: `/mudo` sem argumento lista quem está silenciado', () => {
    // É o único jeito de descobrir que se emudeceu alguém três sessões atrás e esqueceu. Sem a
    // lista, "por que fulano não fala?" é indiagnosticável.
    const s = new SilenciadosDeVoz(armazem());
    expect(interpretarComandoDeSilencio('/mudo', presentes, s).mensagem).toMatch(/não silenciou ninguém/i);
    interpretarComandoDeSilencio('/mudo Ana', presentes, s);
    expect(interpretarComandoDeSilencio('/mudo', presentes, s).mensagem).toMatch(/Ana/);
  });

  it('nome inexistente diz quem está por perto', () => {
    const r = interpretarComandoDeSilencio('/mudo Fulano', presentes, new SilenciadosDeVoz());
    expect(r.tratado).toBe(true);
    expect(r.mensagem).toMatch(/Ana/);
    expect(r.mensagem).toMatch(/José/);
  });

  it('sozinho na sessão, a mensagem diz isso', () => {
    const r = interpretarComandoDeSilencio('/mudo Alguém', [], new SilenciadosDeVoz());
    expect(r.mensagem).toMatch(/sozinho/i);
  });

  it('silenciar duas vezes avisa em vez de fingir que fez algo', () => {
    const s = new SilenciadosDeVoz(armazem());
    interpretarComandoDeSilencio('/mudo Ana', presentes, s);
    expect(interpretarComandoDeSilencio('/mudo Ana', presentes, s).mensagem).toMatch(/já estava/i);
    expect(interpretarComandoDeSilencio('/ouvir José', presentes, s).mensagem).toMatch(/não estava/i);
  });
});

describe('a fiação existe — código presente não é código ativo', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  const mixer = readFileSync('src/net/MixerDeVoz.ts', 'utf8');

  it('CRÍTICO: o comando de silêncio é resolvido ANTES do despacho ao anfitrião', () => {
    // Se caísse depois, o convidado mandaria ao anfitrião uma decisão sobre os próprios ouvidos —
    // que ele pode negar e que para de funcionar quando o anfitrião cai.
    const i = main.indexOf('interpretarComandoDeSilencio');
    const j = main.indexOf("peerSync.sendToHost({ type: 'command'");
    expect(i).toBeGreaterThan(0);
    expect(j).toBeGreaterThan(0);
    expect(i).toBeLessThan(j);
  });

  it('CRÍTICO: o laço de quadro aplica a mistura em todo par', () => {
    expect(main).toMatch(/mixerDeVoz\.aplicar\(/);
    expect(main).toMatch(/misturaDaVoz\(ouvinte, avatars\.posicaoDe\(peerId\), silenciados\.estaSilenciado\(peerId\)\)/);
  });

  it('CRÍTICO: a mistura usa a posição EXIBIDA, depois do `avatars.update`', () => {
    // Com a posição-alvo vinda da rede, a voz sairia de um ponto adiante do avatar, e a diferença
    // é audível quando alguém corre.
    expect(main.indexOf('avatars.update(dt)')).toBeLessThan(main.indexOf('mixerDeVoz.aplicar'));
  });

  it('CRÍTICO: o elemento de áudio fica MUDO — quem produz som é o grafo', () => {
    // Sem `muted`, ouviríamos as duas saídas ao mesmo tempo: uma espacial e outra não. E sem o
    // elemento, o stream do WebRTC não flui para o Web Audio no Chrome — nenhum erro, só silêncio.
    expect(mixer).toMatch(/elemento\.muted = true/);
    expect(mixer).toMatch(/elemento\.srcObject = stream/);
  });

  it('CRÍTICO: reconectar um par desmonta o canal antigo', () => {
    // Uma renegociação entrega uma trilha nova para o mesmo par. Sem desmontar, os dois tocam
    // juntos e a pessoa passa a soar duplicada, com eco de alguns milissegundos.
    const corpo = mixer.slice(mixer.indexOf('public conectar'), mixer.indexOf('public aplicar'));
    expect(corpo).toMatch(/this\.desconectar\(peerId\)/);
  });

  it('sair da sessão remove o elemento do DOM', () => {
    // Deixá-lo com um `srcObject` vivo mantém o navegador decodificando áudio de quem já saiu.
    const corpo = mixer.slice(mixer.indexOf('public desconectar'), mixer.indexOf('public limpar'));
    expect(corpo).toMatch(/elemento\.srcObject = null/);
    expect(corpo).toMatch(/elemento\.remove\(\)/);
  });

  it('o mixer nasce depois do primeiro gesto, sem perder quem entrou antes', () => {
    // O `AudioContext` só existe depois de um gesto do usuário. Descartar as trilhas até lá seria
    // um silêncio impossível de diagnosticar para quem entrou primeiro.
    expect(main).toMatch(/trilhasPendentes\.set\(peerId, stream\)/);
    expect(main).toMatch(/for \(const \[id, s\] of trilhasPendentes\) mixerDeVoz\.conectar\(id, s\)/);
  });
});
