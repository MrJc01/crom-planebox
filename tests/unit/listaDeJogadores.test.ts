// Quem está na sessão — item 1497.
//
// Duas mecânicas inteiras não tinham porta de entrada. `/mudo` (item 1415) era a única forma de
// silenciar alguém, e quem não sabe que o comando existe não tem forma nenhuma. E o sono coletivo
// (item 139) avisa quem falta por uma mensagem de chat que passa — quem chega depois não descobre
// por quem está esperando.
//
// Os dois recursos existiam, funcionavam, e eram invisíveis.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  montarListaDeJogadores,
  resumoDeSono,
  distanciaLegivel,
  FonteDaLista,
} from '../../src/net/listaDeJogadores';

const base: FonteDaLista = {
  localId: 'eu',
  localNome: 'Ana',
  localDormindo: false,
  olhando: { x: 0, y: 40, z: 0 },
  remotos: [],
  silenciado: () => false,
  dormindo: () => false,
};

describe('a lista', () => {
  it('CRÍTICO: o jogador local vem sempre primeiro', () => {
    const l = montarListaDeJogadores({
      ...base,
      remotos: [{ id: 'b', nome: 'Bia', pos: { x: 1, y: 40, z: 0 } }],
    });
    expect(l[0].euMesmo).toBe(true);
    expect(l[0].nome).toBe('Ana');
  });

  it('CRÍTICO: os outros vêm por distância, não por nome', () => {
    // A lista existe para agir sobre alguém, e essa pessoa quase sempre é a que está por perto.
    // Ordem alfabética faria a mesma pessoa mudar de posição quando outra entrasse, e o clique
    // erraria o alvo.
    const l = montarListaDeJogadores({
      ...base,
      remotos: [
        { id: 'z', nome: 'Zeca', pos: { x: 5, y: 40, z: 0 } },
        { id: 'b', nome: 'Bia', pos: { x: 50, y: 40, z: 0 } },
      ],
    });
    expect(l.map((x) => x.nome)).toEqual(['Ana', 'Zeca', 'Bia']);
  });

  it('CRÍTICO: quem não tem posição vai para o fim', () => {
    // É quem acabou de entrar e ainda não está em lugar nenhum. Pô-lo no topo, com distância zero,
    // faria parecer que está colado no jogador.
    const l = montarListaDeJogadores({
      ...base,
      remotos: [
        { id: 'novo', nome: 'Novato', pos: null },
        { id: 'b', nome: 'Bia', pos: { x: 900, y: 40, z: 0 } },
      ],
    });
    expect(l.map((x) => x.nome)).toEqual(['Ana', 'Bia', 'Novato']);
    expect(l[2].distancia).toBeNull();
  });

  it('a distância conta os três eixos', () => {
    const l = montarListaDeJogadores({
      ...base,
      remotos: [{ id: 'b', nome: 'Bia', pos: { x: 3, y: 44, z: 0 } }],
    });
    expect(l[1].distancia).toBeCloseTo(5, 6);
  });

  it('CRÍTICO: o jogador local nunca aparece silenciado', () => {
    // Silenciar a si mesmo não é o que o botão do microfone faz, e o próprio nome riscado sugeriria
    // que é.
    const l = montarListaDeJogadores({ ...base, silenciado: () => true });
    expect(l[0].silenciado).toBe(false);
  });

  it('o silêncio e o sono chegam de quem sabe', () => {
    const l = montarListaDeJogadores({
      ...base,
      remotos: [{ id: 'b', nome: 'Bia', pos: { x: 1, y: 40, z: 0 } }],
      silenciado: (id) => id === 'b',
      dormindo: (id) => id === 'b',
    });
    expect(l[1].silenciado).toBe(true);
    expect(l[1].dormindo).toBe(true);
  });

  it('sozinho, a lista tem uma linha só', () => {
    const l = montarListaDeJogadores(base);
    expect(l).toHaveLength(1);
    expect(l[0].euMesmo).toBe(true);
  });

  it('dois sem posição ficam em ordem alfabética entre si', () => {
    // Sem critério, a ordem seria a de chegada dos pacotes — instável entre quadros, com a lista
    // trocando de ordem sozinha na frente do jogador.
    const l = montarListaDeJogadores({
      ...base,
      remotos: [
        { id: 'z', nome: 'Zeca', pos: null },
        { id: 'b', nome: 'Bia', pos: null },
      ],
    });
    expect(l.map((x) => x.nome)).toEqual(['Ana', 'Bia', 'Zeca']);
  });
});

describe('o resumo de sono', () => {
  const linha = (nome: string, dormindo: boolean) => ({
    id: nome, nome, euMesmo: false, distancia: 1, silenciado: false, dormindo, falando: false,
  });

  it('CRÍTICO: com ninguém dormindo não aparece', () => {
    // Um contador permanente de "0/3 dormindo" é ruído no meio do dia, e o jogador aprende a não
    // olhar para ele — justamente antes da noite em que ele importa.
    expect(resumoDeSono([linha('a', false), linha('b', false)])).toBeNull();
  });

  it('mostra a fração quando alguns dormem', () => {
    expect(resumoDeSono([linha('a', true), linha('b', false)])).toBe('1/2 dormindo');
  });

  it('com todos dormindo diz isso em palavras', () => {
    expect(resumoDeSono([linha('a', true), linha('b', true)])).toBe('Todos dormindo');
  });
});

describe('a distância em texto', () => {
  it('CRÍTICO: sem posição vira travessão, não zero', () => {
    // Um número inventado seria pior que a ausência: "0 m" diz que a pessoa está colada.
    expect(distanciaLegivel(null)).toBe('—');
  });

  it('perto demais vira palavra', () => {
    expect(distanciaLegivel(0.4)).toBe('aqui');
  });

  it('arredonda e muda de unidade', () => {
    expect(distanciaLegivel(42.6)).toBe('43 m');
    expect(distanciaLegivel(2400)).toBe('2.4 km');
  });
});

describe('a fiação existe — código presente não é código ativo', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  const painel = readFileSync('src/ui/PainelDeJogadores.ts', 'utf8');

  it('CRÍTICO: [Tab] abre e soltar fecha', () => {
    expect(main).toMatch(/if \(e\.code === 'Tab'\) \{\s*\n\s*e\.preventDefault\(\)/);
    expect(main).toMatch(/if \(e\.code === 'Tab'\) painelDeJogadores\.esconder\(\)/);
  });

  it('CRÍTICO: o Tab é impedido de mover o foco do navegador', () => {
    // Sem `preventDefault`, o Tab tira o foco do canvas e o jogador perde o controle sem entender
    // por quê — e a tecla é justamente a que o navegador usa para navegar.
    const i = main.indexOf("if (e.code === 'Tab') {");
    expect(main.slice(i, i + 120)).toMatch(/e\.preventDefault\(\)/);
  });

  it('CRÍTICO: perder o foco da janela também fecha', () => {
    // Alt-tab com o Tab apertado é literalmente o gesto que o navegador rouba: sem isto o painel
    // ficaria preso na tela até alguém apertar Tab de novo, parecendo um painel que não fecha.
    const i = main.indexOf("window.addEventListener('blur'");
    expect(main.slice(i, i + 220)).toMatch(/painelDeJogadores\.esconder\(\)/);
  });

  it('CRÍTICO: a lista é atualizada por quadro enquanto está aberta', () => {
    // As distâncias mudam a cada passo. Uma lista congelada mentiria sobre quem está perto, que é
    // exatamente o que se abre a lista para ver.
    expect(main).toMatch(/painelDeJogadores\.atualizar\(linhasDeJogadores\(\)\)/);
    expect(painel).toMatch(/if \(this\.visivel\) this\.desenhar\(linhas\)/);
  });

  it('CRÍTICO: clicar num nome silencia — a porta que faltava para o item 1415', () => {
    expect(main).toMatch(/painelDeJogadores\.onAlternarSilencio = \(id\) =>/);
    expect(main).toMatch(/silenciados\.alternar\(id\)/);
  });

  it('CRÍTICO: o painel não bloqueia o jogo', () => {
    // Uma tela bloqueante solta o ponteiro, pausa a entrada e devolve o foco ao fechar. Para uma
    // consulta de dois segundos isso é o triplo do custo do benefício.
    expect(main).not.toMatch(/registerBlocking\(painelDeJogadores\)/);
    expect(main).not.toMatch(/openBlocking\('jogadores'\)/);
  });

  it('a lista é derivada do que já existe, não guardada', () => {
    // Manter uma lista própria significaria sincronizá-la com três fontes, e a primeira a divergir
    // seria a de quem saiu — a mesma armadilha do sono coletivo.
    const corpo = main.slice(main.indexOf('function linhasDeJogadores'), main.indexOf('painelDeJogadores.onAlternarSilencio'));
    expect(corpo).toMatch(/avatars\.posicaoDe\(id\)/);
    expect(corpo).toMatch(/silenciados\.estaSilenciado\(id\)/);
    expect(corpo).toMatch(/registroDeSono\.estaDormindo\(id\)/);
  });

  it('o painel usa ícones, não emoji', () => {
    expect(painel).toMatch(/icone_svg\(/);
    expect(painel).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});
