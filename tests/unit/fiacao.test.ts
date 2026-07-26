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
