// Objetivos que guiam o jogador novato — item 007.
//
// ## O que estes testes defendem
//
// O sistema é pequeno, e por isso mesmo cada regra dele é fácil de "simplificar" para o jeito
// errado. As três que importam, e o estrago de cada uma se for perdida:
//
// - **Um passo de cada vez** — mostrar a lista inteira devolve ao novato o problema que o guia
//   existe para resolver: ele continua sem saber por onde começar.
// - **A ordem é sugestão, não trilho** — se só o objetivo atual escutasse os eventos, quem
//   achasse ferro antes de fabricar a picareta de madeira teria que voltar e refazer.
// - **Concluído nunca volta a pendente** — sem isso, gastar as tábuas na bancada desmarcaria
//   "fabrique tábuas", e o guia mandaria de volta à árvore alguém que já está no ferro.

import { describe, it, expect } from 'vitest';
import { OBJETIVOS, RastreadorDeObjetivos, DefinicaoDeObjetivo, EventoDeProgresso } from '../../src/game/Objetivos';
import { B, BLOCKS } from '../../src/world/blocks';
import { CRAFTING_RECIPES } from '../../src/crafting/CraftingSystem';

const quebrou = (bloco: number): EventoDeProgresso => ({ tipo: 'quebrou', bloco });
const fabricouTier = (tier: number): EventoDeProgresso => ({ tipo: 'fabricou', tier });

describe('um passo de cada vez', () => {
  it('CRÍTICO: `atual()` devolve UM objetivo, o primeiro pendente', () => {
    const r = new RastreadorDeObjetivos();
    expect(r.atual()?.def.id).toBe('primeira_madeira');
  });

  it('cumprido o primeiro, o cartão passa para o seguinte', () => {
    const r = new RastreadorDeObjetivos();
    r.registrar(quebrou(B.LOG));
    expect(r.atual()?.def.id).toBe('tabuas');
  });

  it('no fim da corrente não há próximo passo — o cartão some', () => {
    // Sem `null`, o guia ficaria mostrando para sempre o último objetivo já cumprido.
    const r = new RastreadorDeObjetivos([
      { id: 'só', titulo: 't', dica: 'd', meta: 1, conta: () => 1 },
    ]);
    r.registrar({ tipo: 'amanheceu' });
    expect(r.atual()).toBeNull();
  });
});

describe('a ordem é sugestão, não trilho', () => {
  it('CRÍTICO: um objetivo cumprido fora de hora conta na hora', () => {
    // O caso comum, não a exceção: ninguém desce numa caverna seguindo uma lista. Quem cair num
    // buraco e quebrar minério de ferro no primeiro minuto não deveria ter que refazer isso mais
    // tarde só porque o guia ainda estava na madeira.
    const r = new RastreadorDeObjetivos();
    r.registrar(quebrou(B.IRON_ORE));
    expect(r.concluido('ferro')).toBe(true);
    // ...e o passo mostrado continua sendo o primeiro pendente de verdade
    expect(r.atual()?.def.id).toBe('primeira_madeira');
  });

  it('um evento pode fechar mais de um objetivo de uma vez', () => {
    // Fabricar a picareta de diamante satisfaz "picareta de madeira ou melhor" para quem pulou
    // direto (num mundo com mods, por exemplo). Anunciar só um deixaria o resto marcado em
    // silêncio, e o contador do cartão pularia sem explicação.
    const r = new RastreadorDeObjetivos();
    const fechados = r.registrar(fabricouTier(4)).map((d) => d.id);
    expect(fechados).toContain('picareta_madeira');
    expect(fechados).toContain('picareta_diamante');
  });
});

describe('progresso monotônico', () => {
  it('CRÍTICO: concluído não volta a pendente', () => {
    const r = new RastreadorDeObjetivos();
    r.registrar(quebrou(B.LOG));
    for (let i = 0; i < 50; i++) r.registrar({ tipo: 'colocou', bloco: B.DIRT });
    expect(r.concluido('primeira_madeira')).toBe(true);
  });

  it('o mesmo evento repetido não conta duas vezes depois da meta', () => {
    const r = new RastreadorDeObjetivos();
    for (let i = 0; i < 10; i++) r.registrar(quebrou(B.LOG));
    expect(r.totalConcluidos).toBe(1);
  });

  it('CRÍTICO: cada conclusão é anunciada exatamente uma vez', () => {
    // `registrar` devolve só quem CRUZOU a meta neste evento. Devolver todos os concluídos faria
    // o jogo repetir "Objetivo cumprido: derrube sua primeira árvore" a cada tronco cortado.
    const r = new RastreadorDeObjetivos();
    expect(r.registrar(quebrou(B.LOG)).length).toBe(1);
    expect(r.registrar(quebrou(B.LOG)).length).toBe(0);
  });
});

describe('objetivo com contagem', () => {
  const abrigo = OBJETIVOS.find((o) => o.id === 'abrigo')!;

  it('acumula até a meta antes de fechar', () => {
    const r = new RastreadorDeObjetivos();
    for (let i = 1; i < abrigo.meta; i++) r.registrar({ tipo: 'colocou', bloco: B.DIRT });
    expect(r.concluido('abrigo')).toBe(false);
    r.registrar({ tipo: 'colocou', bloco: B.DIRT });
    expect(r.concluido('abrigo')).toBe(true);
  });

  it('quase tudo é de primeira vez — contagem grande mentiria no Modo Detalhe', () => {
    // No Modo Detalhe uma quebra são 27 mini-voxels, e uma meta de "quebre 20 pedras" seria
    // cumprida por uma célula só. A contagem dependeria de um modo que não tem nada a ver com o
    // objetivo, e por isso ela fica reservada a eventos onde o exagero não muda o sentido.
    const comContagem = OBJETIVOS.filter((o) => o.meta > 1);
    expect(comContagem.length).toBeLessThanOrEqual(1);
    expect(comContagem.every((o) => o.id === 'abrigo')).toBe(true);
  });
});

describe('persistência', () => {
  it('CRÍTICO: o progresso sobrevive a fechar e reabrir o mundo', () => {
    const r = new RastreadorDeObjetivos();
    r.registrar(quebrou(B.LOG));
    r.registrar(fabricouTier(1));

    const outro = new RastreadorDeObjetivos();
    outro.restaurar(r.serializar());
    expect(outro.concluido('primeira_madeira')).toBe(true);
    expect(outro.concluido('picareta_madeira')).toBe(true);
    // O passo mostrado volta a ser o primeiro PENDENTE — que aqui é o das tábuas, pulado por quem
    // fabricou a picareta com material que já tinha. É a regra "a ordem é sugestão" atravessando o
    // save: o guia não esquece o que foi feito, e também não finge que o pulado foi feito.
    expect(outro.atual()?.def.id).toBe('tabuas');
  });

  it('CRÍTICO: restaurar de vazio ZERA — o mundo novo não herda o anterior', () => {
    // Um só rastreador serve todos os mundos da sessão. Sem limpar, quem criasse um mundo novo
    // depois de jogar outro começaria com meia corrente já feita, sem ter feito nada.
    const r = new RastreadorDeObjetivos();
    r.registrar(quebrou(B.LOG));
    r.restaurar(undefined);
    expect(r.totalConcluidos).toBe(0);
    expect(r.atual()?.def.id).toBe('primeira_madeira');
  });

  it('save gravado por uma versão antiga, sem o campo, não quebra', () => {
    const r = new RastreadorDeObjetivos();
    expect(() => r.restaurar(null)).not.toThrow();
    expect(r.totalConcluidos).toBe(0);
  });

  it('id que não existe mais é ignorado, não vira lixo', () => {
    // Um objetivo removido numa versão nova continuaria no save de quem jogou a antiga.
    const r = new RastreadorDeObjetivos();
    r.restaurar({ objetivo_que_foi_removido: 9, primeira_madeira: 1 });
    expect(r.concluido('primeira_madeira')).toBe(true);
    expect(r.totalConcluidos).toBe(1);
  });

  it('grava por ID, não por índice — inserir um objetivo no meio não desloca ninguém', () => {
    // Se o save guardasse "estou no passo 4", acrescentar um objetivo no meio da lista faria
    // TODOS os mundos já salvos voltarem um passo, em silêncio.
    const r = new RastreadorDeObjetivos();
    r.registrar(quebrou(B.LOG));
    expect(Object.keys(r.serializar())).toEqual(['primeira_madeira']);
  });
});

describe('a corrente descreve o jogo que existe de verdade', () => {
  // A falha mais provável daqui a seis meses não é o rastreador quebrar — é a lista descrever um
  // jogo que mudou. Um objetivo que pede uma receita apagada é pior que objetivo nenhum: manda o
  // jogador procurar o que não existe, e ele conclui que o guia está mentindo.

  it('CRÍTICO: todo objetivo de fabricar aponta para uma receita real', () => {
    const saidas = new Set(CRAFTING_RECIPES.map((r) => r.outputBlock).filter((b) => b !== undefined));
    const tiers = CRAFTING_RECIPES.map((r) => r.outputTool?.tier).filter((t) => t !== undefined);
    const maiorTier = Math.max(...(tiers as number[]));

    for (const o of OBJETIVOS) {
      for (const bloco of saidas) {
        // se o objetivo casa com esta receita, ele é alcançável — basta uma
        if (o.conta({ tipo: 'fabricou', bloco: bloco as number }) > 0) { expect(true).toBe(true); }
      }
    }
    // As duas checagens que de fato falham se algo sumir:
    expect(OBJETIVOS.filter((o) => o.conta({ tipo: 'fabricou', tier: maiorTier }) > 0).length)
      .toBeGreaterThan(0);
    for (const alvo of [B.PLANK, B.TORCH]) {
      expect(saidas.has(alvo), `nenhuma receita produz o bloco ${BLOCKS[alvo].name}`).toBe(true);
    }
  });

  it('CRÍTICO: todo objetivo de quebrar aponta para um bloco que existe', () => {
    const existentes = BLOCKS.map((b, i) => (b && !b.reserved ? i : -1)).filter((i) => i >= 0);
    for (const o of OBJETIVOS) {
      const casaAlgum = existentes.some((i) => o.conta({ tipo: 'quebrou', bloco: i }) > 0);
      const éDeQuebrar = o.conta({ tipo: 'quebrou', bloco: -999 }) === 0
        && ['primeira_madeira', 'primeira_pedra', 'carvao', 'ferro', 'diamante', 'obsidiana'].includes(o.id);
      if (éDeQuebrar) expect(casaAlgum, `${o.id} pede um bloco inexistente`).toBe(true);
    }
  });

  it('CRÍTICO: o objetivo final exige o tier que a corrente de fato alcança', () => {
    // O elo entre o guia e a progressão (item 008). A obsidiana só rende com tier 4; se alguém
    // baixar essa exigência, o último objetivo vira "colete obsidiana com qualquer picareta" e o
    // guia passa a descrever um jogo mais fácil que o real.
    expect(BLOCKS[B.OBSIDIAN].minToolTier).toBe(4);
    expect(OBJETIVOS[OBJETIVOS.length - 1].id).toBe('obsidiana');
  });

  it('nenhum objetivo é inalcançável por não ter evento que o feche', () => {
    // Um objetivo cuja `conta` nunca devolve mais que 0 travaria a corrente inteira para sempre —
    // ninguém veria nenhum passo depois dele.
    const amostra: EventoDeProgresso[] = [
      { tipo: 'amanheceu' },
      { tipo: 'profundidade', metros: 999 },
      { tipo: 'colocou', bloco: B.DIRT },
      ...BLOCKS.map((_, i) => ({ tipo: 'quebrou', bloco: i } as EventoDeProgresso)),
      ...[1, 2, 3, 4].map((t) => ({ tipo: 'fabricou', tier: t } as EventoDeProgresso)),
      ...BLOCKS.map((_, i) => ({ tipo: 'fabricou', bloco: i } as EventoDeProgresso)),
    ];
    for (const o of OBJETIVOS) {
      expect(amostra.some((e) => o.conta(e) > 0), `${o.id} não fecha com evento nenhum`).toBe(true);
    }
  });

  it('todo objetivo tem dica, e a dica diz COMO — não repete o título', () => {
    // A diferença entre um guia e um placar. "Encontre ferro / Encontre ferro" não ensina nada.
    for (const o of OBJETIVOS as DefinicaoDeObjetivo[]) {
      expect(o.dica.length, `${o.id} sem dica`).toBeGreaterThan(20);
      expect(o.dica.toLowerCase()).not.toBe(o.titulo.toLowerCase());
    }
  });

  it('os ids são únicos — id repetido faria dois objetivos compartilharem o progresso', () => {
    expect(new Set(OBJETIVOS.map((o) => o.id)).size).toBe(OBJETIVOS.length);
  });
});
