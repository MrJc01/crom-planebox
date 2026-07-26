// Teto do mundo — item 030, e o defeito que ele escondia.
//
// Cinco lugares diferentes começavam a varredura de superfície em `120`, num mundo de `128`.
// Os oito voxels do topo eram **invisíveis** para elas: construa uma torre até y=125 e o "achar a
// superfície" devolve o chão lá embaixo, ignorando a torre. Quem teleporta ou nasce nessa coluna
// aparece dentro da construção.
//
// O `120` provavelmente nasceu como margem de segurança e virou um teto silencioso. É o tipo de
// número mágico que o item 030 pede para extrair — e extrair foi o que revelou o defeito, porque
// obrigou a responder "120 por quê?".

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CY, TOPO_VARREDURA, WORLD_MAX_Y } from '../../src/world/chunk';

const SRC = new URL('../../src/', import.meta.url).pathname;

function arquivos(dir = SRC): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) { saida.push(...arquivos(caminho)); continue; }
    if (nome.endsWith('.ts')) saida.push(caminho);
  }
  return saida;
}

describe('constantes de altura', () => {
  it('o teto do mundo é o mesmo da coluna de chunk', () => {
    expect(WORLD_MAX_Y).toBe(CY);
  });

  it('CRÍTICO: a varredura começa no ÚLTIMO voxel que existe, não 8 abaixo dele', () => {
    // O conserto do defeito. Qualquer valor menor que `WORLD_MAX_Y - 1` volta a criar uma faixa
    // no topo do mundo que a varredura não enxerga.
    expect(TOPO_VARREDURA).toBe(WORLD_MAX_Y - 1);
  });

  it('CRÍTICO: uma varredura a partir do topo acha um bloco no alto do mundo', () => {
    // O caso concreto: torre construída perto do teto. Com o início em 120 este laço não a
    // encontrava, e devolvia o chão.
    const alturaDaTorre = WORLD_MAX_Y - 3;
    const mundo = (y: number) => (y === alturaDaTorre || y < 10 ? 1 : 0);

    let achou = -1;
    for (let y = TOPO_VARREDURA; y >= 0; y--) {
      if (mundo(y) !== 0) { achou = y; break; }
    }
    expect(achou).toBe(alturaDaTorre);
  });

  it('CRÍTICO: nenhuma varredura de superfície voltou a usar 120 literal', () => {
    // O número estava em cinco arquivos. Sem este teste, o sexto lugar nasce com o mesmo defeito.
    const infratores: string[] = [];
    for (const arq of arquivos()) {
      const texto = readFileSync(arq, 'utf8');
      texto.split('\n').forEach((linha, i) => {
        // Só varredura DESCENDENTE começando num literal. Um `for (let y = 0; y < CY; y++)` é
        // um laço ascendente legítimo e não tem nada a ver com o defeito.
        if (/for\s*\(\s*let\s+y\s*=\s*\d+\s*;[^)]*y--/.test(linha)) {
          infratores.push(`${arq.slice(SRC.length)}:${i + 1}`);
        }
      });
    }
    expect(infratores, `varredura vertical com número mágico: ${infratores.join(', ')}`).toEqual([]);
  });
});
