// Quem é simulado neste quadro — item 180.
//
// `EntitySystem.update` rodava tudo para todo mundo, todo quadro, a qualquer distância. E o ramo
// dos NPCs decorativos faz uma varredura de chão que desce da cabeça da entidade **até o y zero** —
// até cento e trinta consultas por entidade por quadro, para mover um boneco que ninguém vê.
//
// Nada disso falha. O jogo só fica mais lento à medida que o mundo se povoa, de forma proporcional
// a quantas criaturas existem e não a quantas importam.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  deveSimular,
  distancia2,
  RAIO_DE_SIMULACAO,
  RAIO_DE_CONGELAMENTO,
} from '../../src/entities/simulacao';
import { MOB_PROFILES } from '../../src/entities/Combat';
import { DISTANCIA_DE_ESQUECIMENTO } from '../../src/entities/despawn';

const q = (d: number) => d * d;

describe('perto simula, longe congela', () => {
  it('CRÍTICO: dentro do raio, sempre simula', () => {
    expect(deveSimular(q(RAIO_DE_SIMULACAO - 1), false)).toBe(true);
    expect(deveSimular(0, false)).toBe(true);
  });

  it('CRÍTICO: bem longe, sempre congela', () => {
    expect(deveSimular(q(RAIO_DE_CONGELAMENTO + 1), true)).toBe(false);
    expect(deveSimular(q(10_000), true)).toBe(false);
  });

  it('CRÍTICO: na faixa do meio, mantém o estado — senão anda aos solavancos', () => {
    // Sem histerese, quem está exatamente na fronteira alterna a cada quadro. O resultado não é
    // "meio simulado": é um andar aos trancos, visível justamente no limite do campo de visão.
    const meio = q((RAIO_DE_SIMULACAO + RAIO_DE_CONGELAMENTO) / 2);
    expect(deveSimular(meio, true)).toBe(true);
    expect(deveSimular(meio, false)).toBe(false);
  });

  it('as duas soleiras estão em ordem e separadas', () => {
    // Iguais, a histerese não existe e o teste acima passaria por acaso.
    expect(RAIO_DE_CONGELAMENTO).toBeGreaterThan(RAIO_DE_SIMULACAO);
    expect(RAIO_DE_CONGELAMENTO - RAIO_DE_SIMULACAO).toBeGreaterThan(8);
  });
});

describe('o que nunca congela', () => {
  it('CRÍTICO: quem está em combate simula, por mais longe que esteja', () => {
    // O caso real é o jogador recuando depressa de uma luta. Uma criatura congelada no meio do
    // golpe é um inimigo que some.
    expect(deveSimular(q(10_000), false, true)).toBe(true);
  });

  it('CRÍTICO: o raio de simulação cobre a percepção do mob mais atento', () => {
    // Se um mob congelasse a poucos passos de notar o jogador, ele passaria por ela e nada
    // aconteceria — um inimigo que existe e não reage, que lê como o jogo estar quebrado.
    const maiorAggro = Math.max(...Object.values(MOB_PROFILES).map((p) => p.aggroRange));
    expect(RAIO_DE_SIMULACAO).toBeGreaterThan(maiorAggro);
  });

  it('CRÍTICO: congela ANTES de a criatura ser esquecida pelo despawn', () => {
    // Se o congelamento começasse depois do raio de despawn, ele nunca aconteceria: a criatura
    // seria removida antes de chegar lá, e o sistema inteiro rodaria sem efeito nenhum — o modo de
    // falha do item 029.
    expect(RAIO_DE_CONGELAMENTO).toBeLessThan(DISTANCIA_DE_ESQUECIMENTO);
  });
});

describe('a distância', () => {
  it('conta os três eixos', () => {
    // Só em x/z, quem está cem metros acima contaria como perto — e num mundo com cavernas e
    // torres isso é comum, não excepcional.
    expect(distancia2({ x: 0, y: 0, z: 0 }, { x: 0, y: 10, z: 0 })).toBe(100);
    expect(distancia2({ x: 3, y: 0, z: 4 }, { x: 0, y: 0, z: 0 })).toBe(25);
  });

  it('é simétrica e nunca negativa', () => {
    const a = { x: -7, y: 3, z: 11 }, b = { x: 2, y: -5, z: 0 };
    expect(distancia2(a, b)).toBe(distancia2(b, a));
    expect(distancia2(a, b)).toBeGreaterThan(0);
  });
});

describe('a fiação existe — código presente não é código ativo', () => {
  const sistema = readFileSync('src/entities/EntitySystem.ts', 'utf8');

  it('CRÍTICO: o `update` pula quem está congelado', () => {
    expect(sistema).toMatch(/const perto = deveSimular\(/);
    expect(sistema).toMatch(/if \(!perto\) continue;/);
  });

  it('CRÍTICO: a marca de combate envelhece ANTES do congelamento', () => {
    // Uma criatura congelada com a marca parada nunca deixaria a carência do despawn, e ficaria no
    // mundo para sempre ocupando o teto de hostis — o congelamento reintroduziria, por um caminho
    // novo, o defeito que o item 1321 acabou de fechar.
    const iMarca = sistema.indexOf('entity.ultimoCombate += dt');
    const iCongela = sistema.indexOf('const perto = deveSimular(');
    expect(iMarca).toBeGreaterThan(0);
    expect(iCongela).toBeGreaterThan(iMarca);
  });

  it('CRÍTICO: o estado anterior é guardado por entidade', () => {
    // Sem `simulando`, a histerese não teria memória e a faixa do meio se comportaria como um
    // limiar único — exatamente o solavanco que ela existe para evitar.
    expect(sistema).toMatch(/entity\.simulando = perto/);
    expect(sistema).toMatch(/entity\.simulando \?\? true/);
  });

  it('o combate recente é passado ao decisor', () => {
    expect(sistema).toMatch(/< CARENCIA_APOS_COMBATE_S/);
  });
});
