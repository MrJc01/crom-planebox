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
import { CY, SCALE, TOPO_VARREDURA, WORLD_MAX_Y } from '../../src/world/chunk';
import { WorldGen } from '../../src/world/worldgen';
import { ORE_TIERS } from '../../src/world/underground';
import { CAMADAS } from '../../src/world/camadas';

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

describe('o subsolo tem fundo para o que ele promete — item 029', () => {
  // O item pedia "aumentar o limite vertical porque as varreduras assumem y < 128". Medindo antes de
  // mexer, o teto NUNCA era tocado: a coluna mais alta de uma amostra de 26 mil dava 38 m num mundo
  // de 42,7, e zero por cento encostava nele.
  //
  // O aperto era do outro lado. Superfície a 22 m e rocha-mãe em zero davam 21 metros de rocha para
  // faixas de minério que pedem até 40 — o diamante tinha 23% da faixa dele existindo de verdade.
  // Nada errava: ele era só raro demais, de um jeito que se lê como má sorte.

  const gen = new WorldGen(4242);

  /** Altura de superfície num quadriculado largo, em metros. */
  function alturasEmMetros(): number[] {
    const hs: number[] = [];
    for (let x = -2000; x < 2000; x += 211) {
      for (let z = -2000; z < 2000; z += 211) hs.push(gen.column(x, z).height / SCALE);
    }
    return hs;
  }

  it('CRÍTICO: toda faixa de minério cabe abaixo da superfície MAIS BAIXA', () => {
    // A verificação que importa. Um minério cuja faixa começa abaixo do fundo do mundo existe na
    // tabela e não no jogo — e o sintoma é "esse minério é raríssimo", nunca "esse minério está
    // quebrado".
    const maisBaixa = Math.min(...alturasEmMetros());
    for (const t of ORE_TIERS) {
      expect(t.minDepth, `${t.chave} começa abaixo do terreno mais baixo`).toBeLessThan(maisBaixa);
    }
  });

  it('CRÍTICO: a faixa INTEIRA do diamante existe sob o terreno médio', () => {
    // Era o pior caso: 1,4 m dos 6 m alcançáveis.
    const medias = alturasEmMetros();
    const media = medias.reduce((a, b) => a + b, 0) / medias.length;
    const diamante = ORE_TIERS.find((t) => t.chave === 'diamante')!;
    expect(diamante.maxDepth, 'a faixa do diamante ainda passa do fundo').toBeLessThanOrEqual(media);
  });

  it('CRÍTICO: toda camada vertical começa acima do fundo alcançável', () => {
    // A camada do abismo nascia como uma fatia de um metro no fundo do mundo — presente na tabela e
    // quase inexistente no jogo.
    const maisBaixa = Math.min(...alturasEmMetros());
    for (const c of CAMADAS) {
      expect(c.inicio, `a camada "${c.id}" começa abaixo do terreno mais baixo`).toBeLessThan(maisBaixa);
    }
  });

  it('sobra espaço para construir acima da montanha mais alta', () => {
    // Um teto colado no relevo transforma "construir uma torre" em "bater no limite do mundo", e o
    // jogador descobre isso depois de ter subido.
    const maisAlta = Math.max(...alturasEmMetros());
    const teto = WORLD_MAX_Y / SCALE;
    expect(teto - maisAlta, 'menos de 10 m livres acima do pico').toBeGreaterThan(10);
  });

  it('nenhuma coluna encosta no teto', () => {
    // Se encostasse, a montanha estaria sendo cortada — e o corte é plano, o que se lê como bug de
    // geração e não como limite.
    for (const h of alturasEmMetros()) {
      expect(h * SCALE, 'coluna colada no teto').toBeLessThan(WORLD_MAX_Y - 1);
    }
  });
});
