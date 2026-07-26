// Empilhamento das telas — o relato foi "às vezes os menus ficam sobrepostos".
//
// A palavra que importa no relato é **"às vezes"**, e ela aponta direto para a causa: quando dois
// elementos têm o mesmo `z-index`, o navegador desempata pela ordem no DOM. Essa ordem depende de
// qual tela foi construída primeiro, então o mesmo par de telas trocava de posição entre sessões.
// Um bug que muda de comportamento sem o código mudar é quase sempre um empate em algum lugar.
//
// Havia duas causas, e a segunda é pior que a primeira:
//
//  1. HUD (aviso), `InventoryModal` e `ChatOverlay` estavam todos em `z-index: 100`.
//  2. As telas **bloqueantes** estavam em 60–63 e o chat, que é **flutuante**, em 90–100. O chat
//     desenhava por cima da página de mods — ou seja, a tela que deveria estar bloqueando tudo
//     era a que ficava por baixo.
//
// A tabela `CAMADA` já existia em `theme.ts` para exatamente isto, com o comentário "concentradas
// aqui para não haver disputa de z-index entre telas", e **sete das nove telas a ignoravam**. É o
// sétimo caso neste repositório de código escrito, correto e não usado.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { CAMADA } from '../../src/ui/theme';

const RAIZ = new URL('../../src/', import.meta.url);

function ler(rel: string): string {
  return readFileSync(new URL(rel, RAIZ), 'utf8');
}

describe('CAMADA — a tabela é a única fonte do empilhamento', () => {
  it('CRÍTICO: nenhum arquivo escreve `z-index` literal', () => {
    // Este é o teste que faltava. A tabela existir não impede ninguém de ignorá-la, e foi o que
    // aconteceu: sete telas com valor cravado, três delas empatadas em 100.
    const arquivos = [
      ...readdirSync(new URL('ui/', RAIZ)).filter((f) => f.endsWith('.ts')).map((f) => `ui/${f}`),
      'main.ts',
    ];

    const infratores: string[] = [];
    for (const arq of arquivos) {
      const linhas = ler(arq).split('\n');
      linhas.forEach((linha, i) => {
        // `z-index: 10` sim; `z-index: ${CAMADA.hud}` não.
        if (/z-index:\s*-?\d/.test(linha)) infratores.push(`${arq}:${i + 1}`);
      });
    }

    expect(infratores, `escreveram z-index literal: ${infratores.join(', ')}`).toEqual([]);
  });

  it('CRÍTICO: toda tela bloqueante fica ACIMA de todo painel flutuante', () => {
    // A regra que dá sentido ao resto. Uma tela bloqueante é a única coisa com que o jogador pode
    // interagir enquanto está aberta; se um painel flutuante a cobre, ela deixou de bloquear —
    // e o jogador clica no chat achando que está clicando no inventário.
    expect(CAMADA.tela).toBeGreaterThan(CAMADA.flutuante);
    expect(CAMADA.tela).toBeGreaterThan(CAMADA.flutuanteFundo);
    expect(CAMADA.tela).toBeGreaterThan(CAMADA.hud);
    expect(CAMADA.tela).toBeGreaterThan(CAMADA.hotbar);
  });

  it('CRÍTICO: a dica de retomada fica acima de TUDO', () => {
    // Ela é o caminho de recuperação do pointer lock. Qualquer coisa por cima dela deixa o
    // jogador sem controle de câmera e sem saída visível — que foi um bug real deste projeto.
    const outros = Object.entries(CAMADA)
      .filter(([k]) => k !== 'retomada')
      .map(([, v]) => v);
    expect(CAMADA.retomada).toBeGreaterThan(Math.max(...outros));
  });

  it('o aviso passageiro fica acima das telas — ele avisa sobre o que está por baixo', () => {
    expect(CAMADA.aviso).toBeGreaterThan(CAMADA.menuInicial);
    expect(CAMADA.aviso).toBeGreaterThan(CAMADA.pausa);
  });

  it('a ordem entre as camadas de jogo é a esperada, de baixo para cima', () => {
    const esperada = [
      CAMADA.hud, CAMADA.hotbar, CAMADA.depuracao, CAMADA.dica,
      CAMADA.flutuanteFundo, CAMADA.flutuante,
      CAMADA.tela, CAMADA.hub, CAMADA.pausa, CAMADA.assistente,
      CAMADA.menuInicial, CAMADA.aviso, CAMADA.retomada,
    ];
    const ordenada = [...esperada].sort((a, b) => a - b);
    expect(esperada).toEqual(ordenada);
  });

  it('nenhum empate acidental: só as telas bloqueantes irmãs compartilham valor', () => {
    // Telas bloqueantes dividem `tela` de propósito — o `UIManager` garante que só uma fica
    // aberta por vez, então não há como duas disputarem. Fora isso, empate é bug: é o que produz
    // o "às vezes", porque o desempate por ordem de DOM não é estável entre sessões.
    const valores = Object.values(CAMADA);
    expect(new Set(valores).size).toBe(valores.length);
  });
});

describe('cada tela usa a camada que corresponde ao seu papel', () => {
  const casos: Array<[string, string]> = [
    ['ui/InventoryModal.ts', 'CAMADA.tela'],
    ['ui/CharacterCreator.ts', 'CAMADA.tela'],
    ['ui/ModsPage.ts', 'CAMADA.tela'],
    ['ui/CodeEditorPage.ts', 'CAMADA.tela'],
    ['ui/ChatOverlay.ts', 'CAMADA.flutuante'],
    ['ui/PauseMenu.ts', 'CAMADA.pausa'],
    ['ui/WorldCreationWizard.ts', 'CAMADA.assistente'],
    ['ui/MainMenu.ts', 'CAMADA.menuInicial'],
    ['main.ts', 'CAMADA.retomada'],
  ];

  for (const [arq, camada] of casos) {
    it(`${arq} usa ${camada}`, () => {
      expect(ler(arq)).toContain(`\${${camada}}`);
    });
  }
});
