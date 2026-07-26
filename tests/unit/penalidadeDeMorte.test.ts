// O que a morte custa — item 011, e a resposta à lacuna 1309.
//
// Morrer devolvia o jogador ao spawn com o inventário intacto. O efeito não é "o jogo é fácil": é
// que **o risco deixa de ser informação**. Descer 25 metros atrás de diamante e cair na lava
// custava a caminhada de volta, e nada mais — então não havia decisão a tomar sobre quando descer,
// o que levar, ou quando voltar com o que já se tem.

import { describe, it, expect } from 'vitest';
import {
  PENALIDADE_DE_MUNDO_ANTIGO,
  PENALIDADE_PADRAO,
  ROTULOS,
  SlotDeInventario,
  aplicarPenalidade,
  penalidadeDoMundo,
} from '../../src/game/penalidadeDeMorte';
import { B } from '../../src/world/blocks';

const carga = (): SlotDeInventario[] => [
  { block: B.COBBLE, count: 32 },
  { block: B.LOG, count: 8 },
  { block: -1, count: 1, infinite: true, toolTier: 4 }, // picareta de diamante
  { block: -1, count: 0 },
];

describe('manter — o mundo de construir', () => {
  it('não larga nada nem esvazia nada', () => {
    const r = aplicarPenalidade('manter', carga());
    expect(r.largar).toEqual([]);
    expect(r.esvaziar).toEqual([]);
    expect(r.encerraMundo).toBe(false);
  });
});

describe('dropar — o padrão', () => {
  it('CRÍTICO: os blocos carregados caem', () => {
    const r = aplicarPenalidade('dropar', carga());
    expect(r.largar).toEqual([{ block: B.COBBLE, count: 32 }, { block: B.LOG, count: 8 }]);
  });

  it('CRÍTICO: a FERRAMENTA fica', () => {
    // A penalidade é o material que você carregava, não a progressão que você destravou. Perder a
    // picareta de diamante numa queda apagaria uma corrente inteira de progressão, e a reação de
    // quem joga não é "vou com mais cuidado" — é parar de descer.
    const r = aplicarPenalidade('dropar', carga());
    expect(r.largar.some((i) => i.block < 0)).toBe(false);
    expect(r.esvaziar).not.toContain(2);
  });

  it('os slots largados são esvaziados, e só eles', () => {
    // Largar sem esvaziar duplicaria o inventário: os itens no chão E na mão.
    const r = aplicarPenalidade('dropar', carga());
    expect(r.esvaziar).toEqual([0, 1]);
  });

  it('slot vazio não vira uma pilha de nada no chão', () => {
    const r = aplicarPenalidade('dropar', [{ block: B.DIRT, count: 0 }, { block: -1, count: 5 }]);
    expect(r.largar).toEqual([]);
  });

  it('paleta infinita do Criativo não é carga', () => {
    // `infinite` é a marca do inventário criativo. Largar 9999 pedregulhos no chão ao morrer no
    // Criativo seria um monte de entidades para simular e nenhuma consequência de jogo.
    const r = aplicarPenalidade('dropar', [{ block: B.STONE, count: 9999, infinite: true }]);
    expect(r.largar).toEqual([]);
  });

  it('não encerra o mundo', () => {
    expect(aplicarPenalidade('dropar', carga()).encerraMundo).toBe(false);
  });
});

describe('hardcore — uma vida só', () => {
  it('CRÍTICO: encerra o mundo', () => {
    expect(aplicarPenalidade('hardcore', carga()).encerraMundo).toBe(true);
  });

  it('não larga itens — ninguém vai reabrir para pegá-los', () => {
    // Largar num mundo que não pode mais ser aberto seria trabalho para ninguém ver, e ainda
    // deixaria entidades soltas no save final.
    const r = aplicarPenalidade('hardcore', carga());
    expect(r.largar).toEqual([]);
    expect(r.esvaziar).toEqual([]);
  });
});

describe('o padrão certo para cada origem', () => {
  it('CRÍTICO: mundo SEM o campo mantém o inventário', () => {
    // O que ele sempre teve. Fazer a atualização do jogo mudar em silêncio as regras de um mundo em
    // andamento é a pior surpresa possível: o jogador perderia o inventário na próxima morte por
    // uma decisão que ninguém tomou nem comunicou.
    expect(penalidadeDoMundo(undefined)).toBe('manter');
    expect(penalidadeDoMundo(null)).toBe('manter');
    expect(PENALIDADE_DE_MUNDO_ANTIGO).toBe('manter');
  });

  it('CRÍTICO: mundo NOVO larga os itens', () => {
    // O padrão dos dois lados precisa ser diferente, e é o ponto todo desta dupla de constantes:
    // um mundo sem custo de morte não tem como ensinar o risco.
    expect(PENALIDADE_PADRAO).toBe('dropar');
    expect(PENALIDADE_PADRAO).not.toBe(PENALIDADE_DE_MUNDO_ANTIGO);
  });

  it('valor gravado é respeitado', () => {
    expect(penalidadeDoMundo('hardcore')).toBe('hardcore');
    expect(penalidadeDoMundo('dropar')).toBe('dropar');
  });

  it('lixo no save cai no padrão seguro, não quebra', () => {
    expect(penalidadeDoMundo('modo-inventado')).toBe('manter');
  });
});

describe('as três opções são apresentáveis', () => {
  it('toda opção tem título e descrição que dizem a consequência', () => {
    // O seletor mostra `titulo — descricao`. Uma opção sem descrição faria o jogador escolher
    // hardcore sem saber que hardcore apaga o mundo.
    for (const [id, r] of Object.entries(ROTULOS)) {
      expect(r.titulo.length, `${id} sem título`).toBeGreaterThan(3);
      expect(r.descricao.length, `${id} sem descrição`).toBeGreaterThan(25);
    }
  });

  it('as três opções existem, e só elas', () => {
    expect(Object.keys(ROTULOS).sort()).toEqual(['dropar', 'hardcore', 'manter']);
  });
});
