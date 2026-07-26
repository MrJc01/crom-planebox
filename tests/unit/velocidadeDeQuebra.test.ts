// Velocidade de quebra por ferramenta — item 1291.
//
// A tier decidia SE um bloco podia ser quebrado e quanto dano causava em combate, mas não quão
// rápido se minerava: `breakCooldown` era fixo. Minerar pedra com a picareta de diamante levava
// exatamente o mesmo tempo que com a de madeira — o oposto da expectativa do gênero, e o que
// desfaz boa parte da razão de subir de tier.

import { describe, it, expect } from 'vitest';
import { fatorDeVelocidade } from '../../src/player/velocidadeDeQuebra';
import { B, BLOCKS } from '../../src/world/blocks';

describe('fatorDeVelocidade', () => {
  it('CRÍTICO: ferramenta melhor mina mais rápido o mesmo bloco', () => {
    const madeira = fatorDeVelocidade(1, B.STONE_BRICK);
    const diamante = fatorDeVelocidade(4, B.STONE_BRICK);
    expect(diamante).toBeLessThan(madeira);
  });

  it('CRÍTICO: a vantagem é relativa ao bloco, não absoluta', () => {
    // Uma picareta de diamante numa pedra que só pede madeira tem três degraus de vantagem; na
    // obsidiana, que pede ferro, tem um. É o que faz o material duro continuar duro mesmo com a
    // melhor ferramenta — sem isso, o fim da progressão apagaria a diferença entre os materiais.
    const emFacil = fatorDeVelocidade(4, B.STONE_BRICK);   // exige tier 1
    const emDificil = fatorDeVelocidade(4, B.OBSIDIAN);    // exige tier 3
    expect(emDificil).toBeGreaterThan(emFacil);
  });

  it('bloco sem exigência não acelera', () => {
    // Terra e areia já saem num golpe. Acelerá-las não daria sensação nenhuma e ainda tornaria o
    // modo detalhe difícil de controlar.
    expect(BLOCKS[B.DIRT]?.minToolTier ?? 0).toBe(0);
    expect(fatorDeVelocidade(4, B.DIRT)).toBe(1);
  });

  it('ferramenta no limite exato do bloco não ganha bônus', () => {
    expect(fatorDeVelocidade(3, B.OBSIDIAN)).toBe(1);
  });

  it('ferramenta insuficiente não é penalizada aqui', () => {
    // Quem barra o bloco é a regra de tier mínimo, não esta função. Devolver um fator gigante
    // aqui seria punir duas vezes pelo mesmo motivo, e num lugar onde ninguém procuraria.
    expect(fatorDeVelocidade(0, B.OBSIDIAN)).toBe(1);
  });

  it('CRÍTICO: existe teto — a mineração não vira um passe de varredura', () => {
    // Sem o piso, uma corrente de tiers longa levaria o fator a zero e o mundo deixaria de ter
    // custo. O que se quer é aliviar a repetição, não apagar a atividade.
    expect(fatorDeVelocidade(99, B.STONE_BRICK)).toBeGreaterThan(0.4);
  });

  it('nunca devolve zero nem negativo — seria recarga instantânea ou inválida', () => {
    for (let t = 0; t <= 10; t++) {
      expect(fatorDeVelocidade(t, B.OBSIDIAN)).toBeGreaterThan(0);
      expect(fatorDeVelocidade(t, B.STONE_BRICK)).toBeGreaterThan(0);
    }
  });

  it('bloco desconhecido não estoura', () => {
    expect(() => fatorDeVelocidade(2, 9999)).not.toThrow();
    expect(fatorDeVelocidade(2, 9999)).toBe(1);
  });
});
