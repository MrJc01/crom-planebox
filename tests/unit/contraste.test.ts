// Contraste entre blocos — item 076.
//
// O jogador pede "cria um bloco de pedra escura" e a IA gera um cinza. Já existe um cinza quase
// igual. Os dois viram blocos distintos no inventário, com nomes e receitas diferentes, e
// **indistinguíveis na tela**. O jogador quebra o errado, constrói com o errado, e nada avisa.
//
// Não é um erro que o agente perceba sozinho: ele não vê a tela, e do ponto de vista dele o bloco
// foi criado com sucesso.

import { describe, it, expect } from 'vitest';
import {
  DISTANCIA_MINIMA, corDeHex, distanciaPerceptual, verificarContraste,
} from '../../src/mods/contraste';

const cinza = corDeHex(0x808080);

describe('distância perceptual', () => {
  it('cor igual a si mesma tem distância zero', () => {
    expect(distanciaPerceptual(cinza, cinza)).toBe(0);
  });

  it('preto e branco são o par mais distante', () => {
    expect(distanciaPerceptual(corDeHex(0x000000), corDeHex(0xffffff))).toBeCloseTo(1, 1);
  });

  it('é simétrica — a ordem dos argumentos não muda nada', () => {
    const a = corDeHex(0x3366aa), b = corDeHex(0xaa6633);
    expect(distanciaPerceptual(a, b)).toBeCloseTo(distanciaPerceptual(b, a), 10);
  });

  it('CRÍTICO: pesa a luminância, não só o RGB cru', () => {
    // Em RGB cru, `#00FF00`→`#00E000` e `#0000FF`→`#0000E0` têm a MESMA distância numérica. Aos
    // olhos o par verde é bem mais parecido, porque a visão é mais sensível ao verde. Uma métrica
    // que trate os dois igual erra justamente onde importa.
    const dVerde = distanciaPerceptual(corDeHex(0x00ff00), corDeHex(0x00e000));
    const dAzul = distanciaPerceptual(corDeHex(0x0000ff), corDeHex(0x0000e0));
    expect(dVerde).toBeGreaterThan(dAzul);
  });
});

describe('verificarContraste', () => {
  const existentes = [
    { nome: 'Pedra', topo: corDeHex(0x808080) },
    { nome: 'Grama', topo: corDeHex(0x4a9d3f) },
  ];

  it('CRÍTICO: recusa um cinza quase idêntico à Pedra', () => {
    const c = verificarContraste(corDeHex(0x828282), existentes);
    expect(c?.conflitaCom).toBe('Pedra');
  });

  it('aceita uma cor claramente diferente', () => {
    expect(verificarContraste(corDeHex(0xff2fd0), existentes)).toBeNull();
  });

  it('aponta o conflito MAIS PRÓXIMO, e um só', () => {
    // Uma cor parecida com cinco cinzas geraria cinco reclamações sobre o mesmo problema, e o
    // agente que lê isso tende a tratar como cinco correções separadas.
    const muitos = [
      { nome: 'Cinza A', topo: corDeHex(0x808080) },
      { nome: 'Cinza B', topo: corDeHex(0x848484) },
    ];
    expect(verificarContraste(corDeHex(0x838383), muitos)?.conflitaCom).toBe('Cinza B');
  });

  it('a sugestão aponta a direção que AFASTA do vizinho', () => {
    // "Escolha outra cor" devolve o problema para quem não sabe resolvê-lo.
    const maisClaro = verificarContraste(corDeHex(0x8a8a8a), existentes);
    expect(maisClaro?.sugestao).toMatch(/clare/i);
    const maisEscuro = verificarContraste(corDeHex(0x767676), existentes);
    expect(maisEscuro?.sugestao).toMatch(/escure/i);
  });

  it('permite uma variação legítima — "pedra escura" passa, sendo escura o bastante', () => {
    // O caso exato do item 076: o jogador pede "pedra escura". Ela DEVE ser aceita quando de fato
    // é escura. Limiar alto demais proibiria a variação legítima, e a consequência prática seria
    // o agente inventar cores berrantes para passar na validação — pior que o problema original.
    expect(verificarContraste(corDeHex(0x4a4a4a), existentes)).toBeNull();
    expect(DISTANCIA_MINIMA).toBeLessThan(0.12);
  });

  it('sem blocos existentes, nada conflita', () => {
    expect(verificarContraste(cinza, [])).toBeNull();
  });
});

describe('corDeHex', () => {
  it('aceita número e string, com e sem #', () => {
    expect(corDeHex(0xff0000)).toEqual([1, 0, 0]);
    expect(corDeHex('#00ff00')).toEqual([0, 1, 0]);
    expect(corDeHex('0000ff')).toEqual([0, 0, 1]);
  });
});
