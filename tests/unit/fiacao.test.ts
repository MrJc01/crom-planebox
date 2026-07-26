// "Está ligado?" — o teste que faltava nas oito vezes.
//
// ## Por que este arquivo existe
//
// O modo dominante de falha deste repositório **não é código errado**. É código certo, completo,
// comentado e às vezes até testado, que **ninguém invoca**. Já aconteceu oito vezes:
//
//  1. `setViewRange` — ajustava a névoa, e `scene.fog` era `null`
//  2. `applyCurvature` — o shader existia com `invR = 0`
//  3. `UndoManager.recordBatch` — nenhuma edição o chamava
//  4. As estações — mudavam o clima e o F3, e nada no mundo
//  5. Os biomas — o worldgen usava limiares paralelos próprios
//  6. A onda da água — `applyCurvature(waterMaterial)` sem o segundo argumento
//  7. A tabela `CAMADA` — sete das nove telas escreviam `z-index` literal
//  8. `WorldRepository.deleteWorld` — completa, transacional em nove tabelas, e não havia botão
//
// O que os oito têm em comum é que **todo teste passava**. Uma função nunca chamada não quebra
// nada; ela simplesmente não acontece. Testes de unidade provam que a função funciona — nenhum
// deles pergunta se alguém a usa.
//
// ## O que este teste faz, e o que ele não faz
//
// Ele varre o código fonte procurando um chamador para cada API que já esteve dormente. É um
// teste **textual**, com a fragilidade que isso implica: um `grep` sofisticado, não uma prova.
//
// Não é a ferramenta ideal. A ideal seria cobertura de integração com o jogo rodando, e isso
// exige WebGL, que jsdom não tem. Enquanto não existir, este arquivo é o que separa "a função
// existe" de "a função acontece" — e falha exatamente nos oito acidentes que já ocorreram.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../../src/', import.meta.url).pathname;

/** Todo o código fonte concatenado, com o caminho de cada arquivo à frente. */
function todoOFonte(): Array<{ arquivo: string; texto: string }> {
  const saida: Array<{ arquivo: string; texto: string }> = [];
  const andar = (dir: string): void => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) { andar(caminho); continue; }
      if (!nome.endsWith('.ts')) continue;
      saida.push({ arquivo: caminho.slice(SRC.length), texto: readFileSync(caminho, 'utf8') });
    }
  };
  andar(SRC);
  return saida;
}

const FONTE = todoOFonte();

/**
 * Procura um chamador de `padrao` fora dos arquivos que o **definem**.
 *
 * Excluir o arquivo de definição é o ponto todo: uma função que só aparece onde foi escrita é
 * precisamente a que está dormente.
 */
function temChamador(padrao: RegExp, ondeMora: string[]): string[] {
  return FONTE
    .filter(({ arquivo }) => !ondeMora.some((m) => arquivo.endsWith(m)))
    .filter(({ texto }) => padrao.test(texto))
    .map(({ arquivo }) => arquivo);
}

describe('as oito funcionalidades que já estiveram dormentes seguem ligadas', () => {
  const casos: Array<{ nome: string; padrao: RegExp; mora: string[] }> = [
    {
      nome: 'setViewRange — ajusta a névoa à distância de render',
      padrao: /\.setViewRange\s*\(/,
      mora: ['render/scene.ts'],
    },
    {
      nome: 'setCurvature — a curvatura do horizonte',
      padrao: /\.setCurvature\s*\(/,
      mora: ['render/scene.ts'],
    },
    {
      nome: 'UndoManager.recordBatch — o desfazer de uma edição em lote',
      padrao: /recordBatch\s*\(/,
      mora: ['storage/UndoManager.ts'],
    },
    {
      nome: 'estações — o tingimento sazonal chega ao mundo',
      padrao: /setSeasonTint\s*\(/,
      mora: ['render/scene.ts'],
    },
    {
      nome: 'biomas — o worldgen consulta a mistura de biomas',
      padrao: /pesosDeBioma|biomaDominante/,
      mora: ['world/biomes.ts'],
    },
    {
      nome: 'onda da água — o relógio é avançado por alguém',
      padrao: /ondaUniforms\.tempo\.value\s*=/,
      mora: [],
    },
    {
      nome: 'CAMADA — a tabela de empilhamento é consultada',
      padrao: /CAMADA\.\w+/,
      mora: ['ui/theme.ts'],
    },
    {
      nome: 'deleteWorld — existe um caminho para apagar um mundo',
      padrao: /deleteWorld\s*\(/,
      mora: ['storage/WorldRepository.ts'],
    },
  ];

  for (const { nome, padrao, mora } of casos) {
    it(`CRÍTICO: ${nome}`, () => {
      const chamadores = temChamador(padrao, mora);
      expect(
        chamadores.length,
        `nada fora de [${mora.join(', ') || '—'}] usa isto: a funcionalidade está escrita e inerte`,
      ).toBeGreaterThan(0);
    });
  }
});

describe('objetivos — o guia do novato está de fato ligado (item 007)', () => {
  // O candidato mais óbvio a virar o nono caso. `RastreadorDeObjetivos` é uma classe pura,
  // testável e completamente inerte sozinha: sem os quatro pontos de instrumentação abaixo, todos
  // os testes de `objetivos.test.ts` passariam e **nenhum objetivo jamais avançaria em jogo**.
  //
  // Cada linha aqui corresponde a um evento do tipo `EventoDeProgresso`. Se alguém acrescentar uma
  // variante nova ao tipo e não a emitir, é este arquivo que deveria crescer junto.
  const main = FONTE.find((f) => f.arquivo.endsWith('main.ts'))!.texto;

  it('CRÍTICO: quebrar um bloco alimenta o progresso', () => {
    expect(/registrarProgresso\(\{\s*tipo:\s*'quebrou'/.test(main)).toBe(true);
  });

  it('CRÍTICO: quebrar reporta o bloco que SAIU, não o ar que ficou', () => {
    // `onBlockChange` recebe `blockType = 0` ao quebrar. Passar esse zero faria "derrube uma
    // árvore" nunca casar, e o guia travaria no primeiro passo para sempre.
    expect(/tipo:\s*'quebrou',\s*bloco:\s*blocoAnterior/.test(main)).toBe(true);
  });

  it('CRÍTICO: colocar um bloco alimenta o progresso (objetivo do abrigo)', () => {
    expect(/registrarProgresso\(\{\s*tipo:\s*'colocou'/.test(main)).toBe(true);
  });

  it('CRÍTICO: fabricar alimenta o progresso', () => {
    expect(/onCrafted\s*=/.test(main)).toBe(true);
    expect(/registrarProgresso\(\{\s*tipo:\s*'fabricou'/.test(main)).toBe(true);
  });

  it('CRÍTICO: `onCrafted` é disparado por quem coleta a receita', () => {
    const inv = FONTE.find((f) => f.arquivo.endsWith('ui/InventoryModal.ts'))!.texto;
    expect(/this\.onCrafted\(/.test(inv)).toBe(true);
  });

  it('CRÍTICO: o amanhecer alimenta o progresso', () => {
    expect(/registrarProgresso\(\{\s*tipo:\s*'amanheceu'/.test(main)).toBe(true);
  });

  it('CRÍTICO: o amanhecer é o AMANHECER, não a virada do contador de dias', () => {
    // O relógio do mundo dá a volta em `timeOfDay = 0`, que é **meia-noite**. Pendurar o evento na
    // virada de `worldDay` — o lugar mais óbvio, e onde ele esteve — fecharia "sobreviva até o
    // amanhecer" no meio da noite, antes da parte perigosa. Nada falharia: o objetivo marcaria, o
    // toast apareceria, e a única coisa errada seria o jogo ter dado a vitória cedo demais.
    const trecho = main.slice(
      Math.max(0, main.indexOf("registrarProgresso({ tipo: 'amanheceu'") - 400),
      main.indexOf("registrarProgresso({ tipo: 'amanheceu'"),
    );
    expect(/faseAtual === 'amanhecer'/.test(trecho), 'não está preso à fase do dia').toBe(true);
    expect(/worldDay\+\+/.test(trecho), 'voltou a pendurar na virada do contador de dias').toBe(false);
  });

  it('CRÍTICO: a profundidade alimenta o progresso', () => {
    expect(/registrarProgresso\(\{\s*tipo:\s*'profundidade'/.test(main)).toBe(true);
  });

  it('CRÍTICO: o cartão do HUD é desenhado por alguém', () => {
    // A classe podia estar perfeitamente alimentada e ainda assim invisível.
    expect(temChamador(/mostrarObjetivo\s*\(/, ['ui/HUD.ts']).length).toBeGreaterThan(0);
  });

  it('CRÍTICO: o progresso é salvo E restaurado', () => {
    // Salvar sem restaurar é o meio-caminho que não falha em lugar nenhum: tudo funciona na
    // sessão, e o jogador perde a corrente inteira ao fechar a aba.
    expect(/objetivos\.serializar\(\)/.test(main), 'não é salvo').toBe(true);
    expect(/objetivos\.restaurar\(/.test(main), 'não é restaurado').toBe(true);
  });
});

describe('o próprio varredor é confiável', () => {
  it('encontra arquivos de verdade', () => {
    // Um teste que varre o fonte e não acha nada passaria vazio e daria falsa segurança — todos
    // os `expect` acima seriam avaliados contra uma lista vazia de arquivos.
    expect(FONTE.length).toBeGreaterThan(30);
    expect(FONTE.some((f) => f.arquivo.endsWith('main.ts'))).toBe(true);
  });

  it('acusa uma função inventada, que ninguém poderia chamar', () => {
    // Prova que a ausência de chamador é de fato detectada, e não um padrão que casa com tudo.
    expect(temChamador(/funcaoQueNaoExisteEmLugarNenhum\s*\(/, [])).toEqual([]);
  });
});

describe('multijogador — os dois jogadores no MESMO mundo', () => {
  const main = FONTE.find((f) => f.arquivo.endsWith('main.ts'))!.texto;
  const protocolo = FONTE.find((f) => f.arquivo.endsWith('net/protocol.ts'))!.texto;

  it('CRÍTICO: o mundo do convidado NÃO nasce de uma semente aleatória', () => {
    // O relato foi "o mundo não é o mesmo no multiplayer", e a causa era total: o mundo do
    // convidado era criado com `seed: Math.floor(Math.random() * 1000000)`. O terreno é gerado a
    // partir da semente, então cada jogador via um mundo inteiramente diferente.
    //
    // O `full_sync` não resolvia: ele carrega só o que foi EDITADO à mão. Sobre um terreno gerado
    // diferente, uma casa construída num morro do anfitrião aparece flutuando — ou enterrada.
    const criacaoConvidado = main.slice(
      main.indexOf('const guestWorld: WorldRecord'),
      main.indexOf('await WorldRepository.saveWorld(guestWorld)'),
    );
    expect(criacaoConvidado.length).toBeGreaterThan(50);
    expect(criacaoConvidado).not.toMatch(/seed:\s*Math\.random|seed:\s*Math\.floor\(Math\.random/);
    expect(criacaoConvidado).toMatch(/seed:\s*info\.seed/);
    expect(criacaoConvidado).toMatch(/groundHeight:\s*info\.groundHeight/);
  });

  it('CRÍTICO: o anfitrião anuncia a identidade do terreno', () => {
    expect(protocolo).toContain('WorldInfoMsg');
    expect(protocolo).toMatch(/type:\s*'world_info'/);
    // Semente E altura base: as duas entram na geração. Mandar só uma ainda daria mundos
    // diferentes, e o defeito voltaria pela metade — que é pior, porque parece quase certo.
    expect(protocolo).toMatch(/seed:\s*number/);
    expect(protocolo).toMatch(/groundHeight:\s*number/);
  });

  it('CRÍTICO: o convidado ESPERA a identidade antes de criar o mundo', () => {
    // Se criasse antes e corrigisse depois, o terreno errado já teria sido gerado e gravado.
    const espera = main.indexOf('resolverInfoDoMundo = resolve');
    const criacao = main.indexOf('const guestWorld: WorldRecord');
    expect(espera).toBeGreaterThan(-1);
    expect(espera).toBeLessThan(criacao);
  });

  it('a espera tem prazo — anfitrião de versão antiga não trava a entrada', () => {
    expect(main).toMatch(/resolverInfoDoMundo = null; resolve\(null\)/);
  });
});
