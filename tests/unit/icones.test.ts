import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NomeIcone, existeIcone, icone_svg } from '../../src/ui/icons';

/** Todo `.ts` sob `src/`. */
function arquivos(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, saida);
    else if (nome.endsWith('.ts')) saida.push(caminho);
  }
  return saida;
}

/** Emoji e pictogramas. Não inclui setas nem símbolos de texto (→, ×, ⌘). */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

describe('nenhum emoji na interface', () => {
  it('CRÍTICO: nenhum arquivo de `src/` contém emoji', () => {
    // O pedido foi explícito, e há três razões técnicas por trás dele: cada sistema operacional
    // desenha o próprio emoji (o mesmo menu fica diferente em Windows, Linux e Mac), a cor é
    // fixa e ignora o tema, e o alinhamento vertical varia por fonte — daí os ícones
    // desencontrados nas listas.
    //
    // Este teste existe porque a regra é fácil de quebrar sem perceber: um `console.log` com
    // emoji entra num commit qualquer e ninguém repara até virar padrão de novo.
    const culpados: string[] = [];
    for (const arq of arquivos('src')) {
      const texto = readFileSync(arq, 'utf-8');
      for (const [i, linha] of texto.split('\n').entries()) {
        if (EMOJI.test(linha)) culpados.push(`${arq}:${i + 1} ${linha.trim().slice(0, 70)}`);
      }
    }
    expect(culpados, `use \`icone()\` de src/ui/icons.ts:\n${culpados.join('\n')}`).toEqual([]);
  });
});

describe('o conjunto de ícones', () => {
  const TODOS: NomeIcone[] = [
    'inventario', 'crafting', 'personagem', 'missoes', 'mods', 'codigo',
    'mundo', 'chat', 'engrenagem', 'jogar', 'voltar', 'fechar',
    'mapa', 'rede', 'chave', 'aviso', 'grafico', 'lupa',
    'mais', 'lixeira', 'download', 'upload', 'historico', 'coracao', 'gota',
  ];

  it('todo ícone declarado tem traçado', () => {
    for (const nome of TODOS) {
      const svg = icone_svg(nome);
      expect(svg, nome).toContain('<svg');
      expect(svg.length, `${nome}: traçado vazio`).toBeGreaterThan(120);
    }
  });

  it('CRÍTICO: todos herdam a cor do texto', () => {
    // É o que faz um botão desabilitado, realçado ou de perigo acertar o ícone sem regra a mais.
    for (const nome of TODOS) {
      expect(icone_svg(nome), nome).toContain('currentColor');
    }
  });

  it('nome desconhecido devolve um ícone em vez de quebrar a tela', () => {
    expect(icone_svg('inexistente' as NomeIcone)).toContain('<svg');
    expect(existeIcone('inexistente')).toBe(false);
    expect(existeIcone('mods')).toBe(true);
  });

  it('respeita o tamanho pedido', () => {
    expect(icone_svg('mods', 32)).toContain('width="32"');
  });

  it('é escondido de leitores de tela — o rótulo em texto já diz o que é', () => {
    for (const nome of TODOS) expect(icone_svg(nome)).toContain('aria-hidden');
  });

  it('nenhum traçado contém emoji, o que seria irônico', () => {
    for (const nome of TODOS) expect(EMOJI.test(icone_svg(nome))).toBe(false);
  });
});
