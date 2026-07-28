// Baús — item 137.
//
// Não havia armazenamento nenhum. Tudo o que o jogador tem cabe na hotbar, e o que não cabe é
// largado no chão — onde agora expira (item 1330). O efeito em cascata é maior do que parece: sem
// onde guardar, minerar além do necessário não faz sentido, construir uma base não tem função além
// de dormir, e a progressão inteira fica presa ao que se carrega.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  bauVazio,
  chaveDoBau,
  depositar,
  retirar,
  esvaziar,
  ocupacao,
  estaVazio,
  sanearBau,
  SLOTS_DO_BAU,
  MAX_POR_PILHA,
} from '../../src/game/bau';
import { B, BLOCKS } from '../../src/world/blocks';
import { CRAFTING_RECIPES, CraftingSystem } from '../../src/crafting/CraftingSystem';

describe('guardar', () => {
  it('CRÍTICO: guardar num baú vazio ocupa um slot só', () => {
    const b = bauVazio();
    const r = depositar(b, B.STONE, 40);
    expect(r.guardados).toBe(40);
    expect(r.sobra).toBe(0);
    expect(ocupacao(b)).toBe(1);
  });

  it('CRÍTICO: empilha no que já existe antes de abrir slot novo', () => {
    // Não é otimização: é o que faz "guardar tudo" produzir um baú organizado em vez de 27 pilhas
    // de um item cada, que é o resultado de preencher na ordem dos buracos.
    const b = bauVazio();
    for (let i = 0; i < 20; i++) depositar(b, B.STONE, 1);
    expect(ocupacao(b)).toBe(1);
    expect(b[0]!.count).toBe(20);
  });

  it('CRÍTICO: tipos diferentes não se misturam', () => {
    const b = bauVazio();
    depositar(b, B.STONE, 10);
    depositar(b, B.DIRT, 10);
    expect(ocupacao(b)).toBe(2);
    expect(b[0]!.block).toBe(B.STONE);
    expect(b[1]!.block).toBe(B.DIRT);
  });

  it('CRÍTICO: transborda para o slot seguinte ao passar do máximo por pilha', () => {
    const b = bauVazio();
    const r = depositar(b, B.STONE, MAX_POR_PILHA + 5);
    expect(r.sobra).toBe(0);
    expect(b[0]!.count).toBe(MAX_POR_PILHA);
    expect(b[1]!.count).toBe(5);
  });

  it('CRÍTICO: baú cheio devolve sobra em vez de perder itens', () => {
    // Perder em silêncio seria o pior resultado possível: o jogador guarda o que minerou por uma
    // hora e o número simplesmente diminui, sem mensagem nenhuma.
    const b = bauVazio();
    const cabe = SLOTS_DO_BAU * MAX_POR_PILHA;
    const r = depositar(b, B.STONE, cabe + 77);
    expect(r.guardados).toBe(cabe);
    expect(r.sobra).toBe(77);
    expect(ocupacao(b)).toBe(SLOTS_DO_BAU);
  });

  it('guardar ar ou quantidade não positiva não faz nada', () => {
    const b = bauVazio();
    expect(depositar(b, B.AIR, 10).guardados).toBe(0);
    expect(depositar(b, B.STONE, 0).guardados).toBe(0);
    expect(depositar(b, B.STONE, -5).guardados).toBe(0);
    expect(estaVazio(b)).toBe(true);
  });

  it('CRÍTICO: uma pilha zerada não ocupa slot', () => {
    // O bug da primeira versão: `{ block: X, count: 0 }` parece ocupado para o empilhamento e
    // vazio para o desenho. O baú ficava "cheio" mostrando 27 quadrados vazios.
    const b = bauVazio();
    b[3] = { block: B.STONE, count: 0 };
    expect(ocupacao(b)).toBe(0);
    depositar(b, B.DIRT, 5);
    expect(ocupacao(b)).toBe(1);
  });
});

describe('retirar e esvaziar', () => {
  it('CRÍTICO: retirar devolve a pilha inteira e deixa o slot livre', () => {
    const b = bauVazio();
    depositar(b, B.STONE, 30);
    const p = retirar(b, 0);
    expect(p).toEqual({ block: B.STONE, count: 30 });
    expect(estaVazio(b)).toBe(true);
  });

  it('retirar de um slot vazio ou fora da faixa devolve null', () => {
    const b = bauVazio();
    expect(retirar(b, 0)).toBeNull();
    expect(retirar(b, -1)).toBeNull();
    expect(retirar(b, 999)).toBeNull();
  });

  it('CRÍTICO: `esvaziar` devolve tudo E limpa, na mesma chamada', () => {
    // Separar as duas coisas abriria a janela em que o conteúdo existe em dois lugares — se algo
    // falhar no meio, o jogador duplica o inventário inteiro.
    const b = bauVazio();
    depositar(b, B.STONE, 10);
    depositar(b, B.DIRT, 20);
    const fora = esvaziar(b);
    expect(fora).toEqual([{ block: B.STONE, count: 10 }, { block: B.DIRT, count: 20 }]);
    expect(estaVazio(b)).toBe(true);
  });

  it('`esvaziar` devolve cópias, não as pilhas de dentro', () => {
    // Devolvendo a referência, mexer no que saiu mexeria no baú que acabou de ser limpo — e o bug
    // só apareceria se alguém guardasse o resultado.
    const b = bauVazio();
    depositar(b, B.STONE, 10);
    const fora = esvaziar(b);
    fora[0].count = 999;
    expect(estaVazio(b)).toBe(true);
  });
});

describe('a chave é a posição', () => {
  it('CRÍTICO: a chave é sempre de inteiros', () => {
    // A posição vem de um raycast e chega fracionária. Sem `floor`, o mesmo baú teria uma chave
    // diferente a cada abertura e o conteúdo pareceria sumir.
    expect(chaveDoBau(3.7, 40.2, -2.9)).toBe(chaveDoBau(3, 40, -3));
    expect(chaveDoBau(3, 40, -3)).toBe('3,40,-3');
  });

  it('posições diferentes dão chaves diferentes', () => {
    expect(chaveDoBau(1, 0, 0)).not.toBe(chaveDoBau(0, 1, 0));
    expect(chaveDoBau(0, 0, 1)).not.toBe(chaveDoBau(1, 0, 0));
  });
});

describe('dado vindo do banco', () => {
  it('CRÍTICO: lixo não derruba a interface', () => {
    // Um save de outra versão, ou um mod que mexeu na tabela. Um baú com 400 slots ou `count: NaN`
    // quebraria longe daqui, e o sintoma seria "o inventário não abre".
    for (const lixo of [null, undefined, 42, 'texto', {}, [1, 2, 3]]) {
      const b = sanearBau(lixo);
      expect(b).toHaveLength(SLOTS_DO_BAU);
      expect(estaVazio(b)).toBe(true);
    }
  });

  it('CRÍTICO: corta o excesso de slots em vez de aceitar', () => {
    const grande = new Array(400).fill({ block: B.STONE, count: 1 });
    expect(sanearBau(grande)).toHaveLength(SLOTS_DO_BAU);
  });

  it('descarta pilhas inválidas e limita a contagem', () => {
    const b = sanearBau([
      { block: B.STONE, count: 5 },
      { block: B.STONE, count: NaN },
      { block: B.AIR, count: 9 },
      { block: B.DIRT, count: -3 },
      { block: B.DIRT, count: 1e9 },
    ]);
    expect(b[0]).toEqual({ block: B.STONE, count: 5 });
    expect(b[1]).toBeNull();
    expect(b[2]).toBeNull();
    expect(b[3]).toBeNull();
    expect(b[4]!.count).toBe(MAX_POR_PILHA);
  });

  it('preserva a posição dos slots — um buraco no meio continua buraco', () => {
    // Compactar mudaria o baú do jogador sozinho, na primeira vez que ele fosse carregado.
    const b = sanearBau([{ block: B.STONE, count: 1 }, null, { block: B.DIRT, count: 2 }]);
    expect(b[0]).not.toBeNull();
    expect(b[1]).toBeNull();
    expect(b[2]).not.toBeNull();
  });
});

describe('o bloco', () => {
  it('CRÍTICO: o baú existe na paleta e dropa a si mesmo', () => {
    // Sem o drop, mover um baú de lugar custaria a madeira de novo — e o jogador aprenderia a não
    // mover baús, que é o oposto de um contêiner.
    expect(BLOCKS[B.CHEST]).toBeDefined();
    expect(BLOCKS[B.CHEST].drops).toBe(B.CHEST);
  });

  it('CRÍTICO: o baú NÃO é opaco', () => {
    // A tampa é mais baixa que um cubo cheio, e um baú encostado noutro precisa mostrar a divisão.
    expect(BLOCKS[B.CHEST].opaque).toBe(false);
    expect(BLOCKS[B.CHEST].solid).toBe(true);
  });

  it('o id do baú não colide com nenhum outro', () => {
    const ids = new Set<number>();
    for (const chave of Object.keys(B)) {
      const v = (B as any)[chave];
      if (typeof v !== 'number') continue;
      expect(ids.has(v), `id ${v} duplicado`).toBe(false);
      ids.add(v);
    }
  });
});

describe('a persistência', () => {
  const db = readFileSync('src/storage/Database.ts', 'utf8');
  const repo = readFileSync('src/storage/WorldRepository.ts', 'utf8');

  it('CRÍTICO: a tabela é indexada por mundo + posição, sem id próprio', () => {
    // Sem id não há registro órfão quando o bloco some por um caminho que não passa pela interface:
    // explosão, `fill_box`, script de mod.
    expect(db).toMatch(/chestContents: '\[worldId\+key\], worldId'/);
    expect(db).not.toMatch(/chestContents: '\+\+id/);
  });

  it('a versão do esquema subiu', () => {
    expect(db).toMatch(/this\.version\(10\)\.stores/);
  });

  it('CRÍTICO: um baú vazio é APAGADO em vez de gravado vazio', () => {
    // Sem isso, cada baú aberto por curiosidade deixaria uma linha para sempre, e a tabela
    // cresceria com o número de baús que o jogador já olhou.
    const corpo = repo.slice(repo.indexOf('static async salvarBau'), repo.indexOf('static async apagarBau'));
    expect(corpo).toMatch(/if \(!temAlgo\)/);
    expect(corpo).toMatch(/db\.chestContents\.delete/);
  });
});

describe('a barra guarda o que não tinha — um defeito antigo que o baú expôs', () => {
  const inter = readFileSync('src/player/interaction.ts', 'utf8');

  it('CRÍTICO: `grant` não pode mais perder item em silêncio', () => {
    // Era `hotbar.find(s => s.block === t)` e, se não achasse, não fazia nada: pegar do chão um
    // bloco que não estava na barra perdia o item sem mensagem, sem som diferente, com a pilha
    // sumindo ao ser tocada. O caminho do baú tornou isso visível porque precisa saber quanto
    // coube — o defeito já estava ali, na coleta de todo dia.
    expect(inter).toMatch(/public guardarNaHotbar\(blockType: number, n: number\): number/);
    expect(inter).toMatch(/public grant\(blockType: number, n: number\): void \{\s*\n\s*this\.guardarNaHotbar/);
  });

  it('CRÍTICO: um slot vazio é aproveitado', () => {
    expect(inter).toMatch(/s\.block === -1/);
  });

  it('a barra cheia devolve 0 em vez de fingir que guardou', () => {
    // Quem chama é que decide o destino da sobra — o baú a devolve para dentro dele.
    expect(inter).toMatch(/return 0; \/\/ barra cheia/);
  });
});

describe('a fiação existe — código presente não é código ativo', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  const interacao = readFileSync('src/player/interaction.ts', 'utf8');

  it('CRÍTICO: clicar num baú abre o baú', () => {
    expect(interacao).toMatch(/hit\.type === B\.BED \|\| hit\.type === B\.CHEST/);
    expect(main).toMatch(/if \(blockType === B\.CHEST\) \{\s*\n\s*void abrirBau\(bx, by, bz\)/);
  });

  it('CRÍTICO: quebrar um baú devolve o conteúdo', () => {
    // A única regra que `bau.ts` não impõe sozinho: o conteúdo está amarrado à POSIÇÃO, e quando o
    // bloco some não sobra ninguém para lembrar dele. Sem isto, quebrar um baú apaga tudo o que
    // estava dentro, em silêncio.
    expect(main).toMatch(/blocoAnterior === B\.CHEST/);
    expect(main).toMatch(/void devolverConteudoDoBau\(x, y, z\)/);
  });

  it('CRÍTICO: quebrar o baú ABERTO usa o estado da memória, não o do banco', () => {
    // Ele pode ter mudado sem ter sido gravado ainda. Ler do banco nesse caso perderia itens.
    expect(main).toMatch(/bauAberto\?\.key === key\s*\n?\s*\?\s*bauAberto\.slots/);
  });

  it('CRÍTICO: a sobra volta para o baú em vez de cair no chão', () => {
    // O jogador clicou para PEGAR. Ver a pilha cair aos pés dele parece erro do jogo, não
    // inventário cheio.
    const corpo = main.slice(main.indexOf('bauModal.onRetirar'), main.indexOf('bauModal.onGuardarSelecionado'));
    expect(corpo).toMatch(/depositar\(bauAberto\.slots, p\.block, p\.count - guardou\)/);
    expect(corpo).not.toMatch(/itemDropSystem\.spawn/);
  });

  it('toda mudança é gravada', () => {
    expect((main.match(/void gravarBauAberto\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('a tela é registrada e tem atalho de guardar', () => {
    expect(main).toMatch(/uiManager\.registerBlocking\(bauModal\)/);
    expect(main).toMatch(/e\.code === 'KeyG' && bauModal\.isOpen/);
  });

  it('CRÍTICO: o baú não pode ser guardado dentro de si mesmo por um slot infinito', () => {
    // `infinite` é a mão e os blocos de teste do modo criativo: guardá-los criaria matéria do nada,
    // um slot por clique, sem limite.
    const corpo = main.slice(main.indexOf('bauModal.onGuardarSelecionado'), main.indexOf('bauModal.onFechar'));
    expect(corpo).toMatch(/slot\.infinite/);
  });
});

describe('o baú no mundo compartilhado — item 1522', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  const protocolo = readFileSync('src/net/protocol.ts', 'utf8');

  it('CRÍTICO: o convidado NUNCA grava conteúdo de baú', () => {
    // Sem autoridade, dois jogadores no mesmo baú escrevem por cima um do outro e cada um vê um
    // conteúdo diferente do mesmo bloco — a forma mais confusa possível de perder itens, porque os
    // dois juram que guardaram.
    const corpo = main.slice(main.indexOf('async function gravarBauAberto'), main.indexOf('async function devolverConteudoDoBau'));
    expect(corpo).toMatch(/if \(peerSync\.role === 'guest'\) return;/);
  });

  it('CRÍTICO: o convidado pede e espera, em vez de ler o banco local', () => {
    const corpo = main.slice(main.indexOf('async function abrirBau'), main.indexOf('async function gravarBauAberto'));
    expect(corpo).toMatch(/peerSync\.sendToHost\(\{ type: 'chest_open', key \}\)/);
    // O `return` antes de tocar no `WorldRepository` é o que garante que ele não crie um segundo
    // conteúdo para o mesmo bloco.
    expect(corpo.indexOf("type: 'chest_open'")).toBeLessThan(corpo.indexOf('WorldRepository.carregarBau'));
  });

  it('CRÍTICO: o anfitrião difunde para TODOS, não só para quem pediu', () => {
    // Outro convidado com o mesmo baú aberto precisa ver a mudança, senão ele clica numa pilha que
    // já não existe.
    const corpo = main.slice(main.indexOf("case 'chest_move'"), main.indexOf("case 'chest_state'"));
    expect(corpo).toMatch(/peerSync\.broadcast\(\{ type: 'chest_state'/);
    expect(corpo).not.toMatch(/sendTo\(fromPeerId, \{ type: 'chest_state'/);
  });

  it('CRÍTICO: o anfitrião usa o estado aberto quando é o mesmo baú', () => {
    // Ele pode estar com a tela aberta; ler do banco descartaria o que ele acabou de mexer.
    const corpo = main.slice(main.indexOf("case 'chest_move'"), main.indexOf("case 'chest_state'"));
    expect(corpo).toMatch(/bauAberto\?\.key === msg\.key/);
  });

  it('CRÍTICO: o que sai vai como drop no mundo', () => {
    // O inventário do convidado é local e o anfitrião não o conhece. Cair aos pés de quem pediu é a
    // única entrega que funciona sem inventar um segundo canal.
    const corpo = main.slice(main.indexOf("case 'chest_move'"), main.indexOf("case 'chest_state'"));
    expect(corpo).toMatch(/itemDropSystem\.spawn\(p\.block, p\.count/);
  });

  it('CRÍTICO: a sobra de um depósito recusado não some', () => {
    const corpo = main.slice(main.indexOf("case 'chest_move'"), main.indexOf("case 'chest_state'"));
    expect(corpo).toMatch(/if \(r\.sobra > 0\)/);
  });

  it('o convidado sanea o que chega da rede', () => {
    // A mensagem vem de outra máquina. Um `slots` malformado quebraria a tela dele.
    const corpo = main.slice(main.indexOf("case 'chest_state'"), main.indexOf("case 'block_update'"));
    expect(corpo).toMatch(/sanearBau\(msg\.slots\)/);
  });

  it('as três mensagens estão no protocolo', () => {
    for (const t of ['chest_open', 'chest_state', 'chest_move']) {
      expect(protocolo).toMatch(new RegExp(`type: '${t}'`));
    }
    expect(protocolo).toMatch(/\| ChestOpenMsg\n\s*\| ChestStateMsg\n\s*\| ChestMoveMsg\b/);
  });
});

describe('a receita do baú — item 1523', () => {
  it('CRÍTICO: existe uma receita de baú', () => {
    // O bloco existia e não tinha receita: só chegava ao jogador pelo inventário criativo, o que
    // deixava o armazenamento inteiro inalcançável em Sobrevivência.
    const r = CRAFTING_RECIPES.find((x) => x.outputBlock === B.CHEST);
    expect(r).toBeDefined();
    expect(r!.shape).toBeDefined();
  });

  it('CRÍTICO: TODA receita com forma de fato casa contra a grade', () => {
    // O erro que este teste existe para pegar, e que eu cometi: escrevi o buraco do meio do baú
    // como `0`. `CraftCell` é `number | null`, e `0` é `B.AIR` — um bloco de verdade que o jogador
    // não pode pôr na grade. A receita compilava, aparecia na lista, e NUNCA casava.
    const sis = new CraftingSystem();
    for (const receita of CRAFTING_RECIPES) {
      if (!receita.shape) continue;
      const grade = CraftingSystem.emptyGrid(6);
      for (let r = 0; r < receita.shape.length; r++) {
        for (let c = 0; c < receita.shape[r].length; c++) {
          grade[r][c] = receita.shape[r][c];
        }
      }
      expect(sis.match(grade)?.id, `${receita.id} não casa com a própria forma`).toBe(receita.id);
    }
  });

  it('nenhuma forma usa 0 para dizer "vazio"', () => {
    for (const receita of CRAFTING_RECIPES) {
      for (const linha of receita.shape ?? []) {
        for (const c of linha) {
          expect(c, `${receita.id} usa 0 no lugar de null`).not.toBe(0);
        }
      }
    }
  });
});

describe('quebrar um baú do lado certo — item 1532', () => {
  const main = readFileSync('src/main.ts', 'utf8');

  it('CRÍTICO: o convidado NÃO devolve conteúdo localmente', () => {
    // Rodar ali leria o banco local (vazio), não devolveria nada, e ainda deixaria o conteúdo real
    // órfão no banco do anfitrião — o item some duas vezes, de dois jeitos diferentes.
    expect(main).toMatch(/blocoAnterior === B\.CHEST && peerSync\.role !== 'guest'/);
  });

  it('CRÍTICO: o anfitrião confere ANTES do `setBlock`', () => {
    // Depois dele o bloco já é ar e não há mais como saber que ali havia um baú. A ordem é a
    // função inteira.
    const i = main.indexOf("case 'block_update':");
    const trecho = main.slice(i, i + 260);
    expect(trecho.indexOf('conferirBauQuebrado')).toBeLessThan(trecho.indexOf('world.setBlock'));
  });

  it('o lote também é conferido', () => {
    // Um `fill_box` do convidado chega como `block_batch`, e um baú apagado por um lote some tão
    // silenciosamente quanto um apagado por um clique.
    const i = main.indexOf("case 'block_batch':");
    expect(main.slice(i, i + 300)).toMatch(/conferirBauQuebrado\(b\.x, b\.y, b\.z, b\.blockType\)/);
  });
});
