import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Este arquivo precisa de DOM de verdade — `Tabs` cria elementos e lê estilo aplicado. Um stub
 * mínimo não serviria: o que se está testando é justamente "quantos painéis estão visíveis", e
 * isso mora no `style.display` de elementos reais.
 */
// @vitest-environment jsdom

import { Tabs } from '../../src/ui/Tabs';

function montarTres(): { t: Tabs; montagens: Record<string, number>; ativacoes: string[] } {
  const montagens: Record<string, number> = { a: 0, b: 0, c: 0 };
  const ativacoes: string[] = [];
  const t = new Tabs();
  for (const id of ['a', 'b', 'c']) {
    t.adicionar({
      id,
      titulo: id.toUpperCase(),
      icone: 'inventario',
      montar: (dest) => { montagens[id]++; dest.textContent = `painel ${id}`; },
      aoAtivar: () => ativacoes.push(id),
    });
  }
  return { t, montagens, ativacoes };
}

/** Painéis visíveis agora. É a métrica que o bug relatado violava. */
function visiveis(t: Tabs): string[] {
  return ['a', 'b', 'c'].filter((id) => t.painelDe(id)?.style.display !== 'none');
}

describe('Tabs — a garantia central', () => {
  let t: Tabs;
  beforeEach(() => { t = montarTres().t; });

  it('CRÍTICO: exatamente um painel visível, sempre', () => {
    // É o defeito relatado: "clico numa coisa e abre outra". A causa era não haver um dono do
    // que está visível — dois caminhos desenhavam e o segundo não apagava o primeiro.
    t.iniciar();
    expect(visiveis(t)).toEqual(['a']);

    t.ir('b');
    expect(visiveis(t)).toEqual(['b']);

    t.ir('c');
    expect(visiveis(t)).toEqual(['c']);
  });

  it('CRÍTICO: trocas rápidas em sequência não deixam resíduo', () => {
    t.iniciar();
    for (const id of ['b', 'c', 'a', 'c', 'b', 'a', 'b']) t.ir(id);
    expect(visiveis(t).length).toBe(1);
    expect(visiveis(t)).toEqual(['b']);
  });

  it('CRÍTICO: ir para a aba já ativa não abre uma segunda', () => {
    t.iniciar();
    t.ir('a');
    t.ir('a');
    expect(visiveis(t)).toEqual(['a']);
  });

  it('id desconhecido cai na primeira aba, não deixa a tela em branco', () => {
    // Uma preferência gravada por uma versão anterior — com outras abas — não deve resultar num
    // painel vazio sem explicação.
    t.iniciar('inexistente');
    expect(visiveis(t)).toEqual(['a']);
  });

  it('sem abas, nada quebra', () => {
    const vazio = new Tabs();
    expect(() => vazio.iniciar()).not.toThrow();
    expect(() => vazio.ir('x')).not.toThrow();
  });
});

describe('Tabs — montagem preguiçosa', () => {
  it('CRÍTICO: só a aba aberta é construída', () => {
    // Abrir a tela de mods não deve montar o editor de código junto — nem RODAR o que aquele
    // painel faz ao montar. Painéis que consultam o banco pagariam esse custo sempre.
    const { t, montagens } = montarTres();
    t.iniciar();
    expect(montagens).toEqual({ a: 1, b: 0, c: 0 });

    t.ir('b');
    expect(montagens).toEqual({ a: 1, b: 1, c: 0 });
  });

  it('CRÍTICO: reabrir uma aba não a monta de novo', () => {
    const { t, montagens } = montarTres();
    t.iniciar();
    t.ir('b');
    t.ir('a');
    t.ir('b');
    expect(montagens.a).toBe(1);
    expect(montagens.b).toBe(1);
  });

  it('`aoAtivar` roda toda vez, inclusive na primeira', () => {
    // É a diferença entre montar (uma vez) e atualizar (sempre): a lista de mods precisa refletir
    // o que mudou desde a última visita.
    const { t, ativacoes } = montarTres();
    t.iniciar();
    t.ir('b');
    t.ir('a');
    expect(ativacoes).toEqual(['a', 'b', 'a']);
  });

  it('invalidar força a remontagem e limpa o conteúdo antigo', () => {
    const { t, montagens } = montarTres();
    t.iniciar();
    expect(t.painelDe('a')!.textContent).toBe('painel a');

    t.invalidar('a');
    expect(t.painelDe('a')!.textContent).toBe('');

    t.ir('b');
    t.ir('a');
    expect(montagens.a).toBe(2);
  });
});

describe('Tabs — estado visual e acessibilidade', () => {
  it('só a aba ativa é marcada como selecionada', () => {
    const { t } = montarTres();
    t.iniciar();
    t.ir('b');
    const marcados = Array.from(t.raiz.querySelectorAll('[role="tab"]'))
      .filter((b) => b.getAttribute('aria-selected') === 'true');
    expect(marcados.length).toBe(1);
    expect(marcados[0].textContent).toContain('B');
  });

  it('só a aba ativa é alcançável por Tab — o resto vai pelas setas', () => {
    const { t } = montarTres();
    t.iniciar();
    const focaveis = Array.from(t.raiz.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .filter((b) => b.tabIndex === 0);
    expect(focaveis.length).toBe(1);
  });

  it('as setas percorrem as abas e dão a volta', () => {
    const { t } = montarTres();
    t.iniciar();
    const barra = t.raiz.querySelector('[role="tablist"]')!;

    barra.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(visiveis(t)).toEqual(['b']);

    barra.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(visiveis(t)).toEqual(['a']);

    // Da primeira para trás dá a volta na última.
    barra.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(visiveis(t)).toEqual(['c']);

    barra.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(visiveis(t)).toEqual(['a']);

    barra.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(visiveis(t)).toEqual(['c']);
  });

  it('o clique num botão de aba troca o painel', () => {
    const { t } = montarTres();
    t.iniciar();
    const botaoC = Array.from(t.raiz.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((b) => b.dataset.aba === 'c')!;
    botaoC.click();
    expect(visiveis(t)).toEqual(['c']);
  });

  it('avisa a troca uma vez por troca, e não quando já está na aba', () => {
    const { t } = montarTres();
    const trocas: string[] = [];
    t.onTrocou = (id) => trocas.push(id);
    t.iniciar();
    t.ir('b');
    t.ir('b');
    t.ir('a');
    expect(trocas).toEqual(['a', 'b', 'a']);
  });

  it('o emblema some quando é zero e aparece quando não é', () => {
    let n = 0;
    const t = new Tabs();
    t.adicionar({ id: 'x', titulo: 'X', icone: 'mods', montar: () => {}, emblema: () => n });
    t.iniciar();
    const em = t.raiz.querySelector<HTMLElement>('[data-emblema]')!;
    expect(em.style.display).toBe('none');

    n = 3;
    t.atualizarEmblemas();
    expect(em.textContent).toBe('3');
    expect(em.style.display).not.toBe('none');
  });

  it('nenhum ícone é emoji — são SVG', () => {
    // O pedido foi explícito. Emoji tem desenho por sistema operacional, cor fixa que ignora o
    // tema e alinhamento vertical que varia por fonte.
    const { t } = montarTres();
    t.iniciar();
    for (const b of Array.from(t.raiz.querySelectorAll('[role="tab"]'))) {
      expect(b.querySelector('svg'), 'aba sem ícone SVG').not.toBeNull();
      // Nenhum caractere fora do plano básico (onde vivem os emoji).
      expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(b.textContent ?? '')).toBe(false);
    }
  });
});
