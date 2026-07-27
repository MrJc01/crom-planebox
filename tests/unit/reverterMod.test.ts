// Desfazer os blocos de um mod — item 705, e o décimo caso de código dormente.
//
// `ModContext.placedBlocks` existia, era preenchido a cada `setBlock` do mod, e trazia o
// comentário "para reverter com precisão". **Nada revertia** — nem existia função de reverter.
// O único uso era `blocksPlaced: ctx.placedBlocks.size`, num relatório de diagnóstico.
//
// E havia um defeito dentro do defeito: o mapa guardava o bloco **colocado**, não o anterior.
// Com esse dado a reversão precisa é impossível — dá para saber o que apagar, não o que restaurar
// no lugar. O mod que trocou terra por pedra deixaria um buraco de ar.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ModHostBridge } from '../../src/mods/ModAPI';
import { ModRuntime } from '../../src/mods/ModRuntime';
import { instalarNucleo } from '../../src/mods/nucleoDoWorker';
import { Porta } from '../../src/mods/protocoloDeMods';

/** Mundo de mentira com blocos numa grade esparsa. Padrão 1 = terra. */
function hostFalso(): ModHostBridge & { blocos: Map<string, number> } {
  const blocos = new Map<string, number>();
  const k = (x: number, y: number, z: number) => `${x},${y},${z}`;
  return {
    blocos,
    getBlock: (x, y, z) => blocos.get(k(x, y, z)) ?? 1,
    setBlock: (x, y, z, t) => { blocos.set(k(x, y, z), t); return true; },
    getGroundY: () => 10,
    spawnEntity: () => 'e1',
    listEntities: () => [],
    damageEntity: () => true,
    playerPosition: () => ({ x: 0, y: 10, z: 0 }),
    teleportPlayer: () => {},
    playerHealth: () => 100,
    giveItem: () => {},
    toast: () => {},
    timeOfDay: () => 0.5,
    modEnv: () => ({ valores: {}, faltando: [] }),
  } as any;
}

/**
 * Reino de execução no mesmo processo, com entrega síncrona.
 *
 * O padrão do runtime é um `Worker` de verdade (item 358), que jsdom não tem. A entrega síncrona
 * mantém estes testes sobre o que eles são: reversão de blocos, não sincronização de mensagens.
 */
function portaLocal(): Porta {
  const a: Porta = { postMessage: () => {}, onmessage: null };
  const b: Porta = { postMessage: () => {}, onmessage: null };
  a.postMessage = (m) => b.onmessage?.({ data: m });
  b.postMessage = (m) => a.onmessage?.({ data: m });
  instalarNucleo(a);
  return b;
}

async function comMod(codigo: string) {
  const host = hostFalso();
  const rt = new ModRuntime(host, portaLocal);
  await rt.loadMod({
    id: 'm1', name: 'Mod', revision: 1, enabled: true,
    scripts: [{ key: 's', code: codigo, enabled: true }],
  } as any);
  return { host, rt };
}

describe('reverterBlocosDoMod', () => {
  it('CRÍTICO: restaura o bloco ANTERIOR, não deixa um buraco', async () => {
    // O defeito que o mapa antigo garantiria: guardando só o colocado, o melhor que dá para
    // fazer é apagar — e o mod que trocou terra por pedra deixaria ar no lugar.
    const { host, rt } = await comMod('api.world.setBlock(5, 10, 5, 3);');
    expect(host.getBlock(5, 10, 5)).toBe(3);

    const revertidos = rt.reverterBlocosDoMod('m1');
    expect(revertidos).toHaveLength(1);
    expect(host.getBlock(5, 10, 5)).toBe(1); // terra de volta, não ar
  });

  it('CRÍTICO: NÃO toca onde o jogador mexeu depois', async () => {
    // A guarda que separa "desfazer o mod" de "voltar o mundo no tempo". Reverter sobre uma
    // edição do jogador destruiria trabalho dele para desfazer o de outro.
    const { host, rt } = await comMod('api.world.setBlock(1, 10, 1, 3); api.world.setBlock(2, 10, 2, 3);');
    host.setBlock(1, 10, 1, 7); // o jogador construiu por cima

    const revertidos = rt.reverterBlocosDoMod('m1');
    expect(host.getBlock(1, 10, 1)).toBe(7);  // preservado
    expect(host.getBlock(2, 10, 2)).toBe(1);  // revertido
    expect(revertidos).toHaveLength(1);
  });

  it('CRÍTICO: escrita dupla na mesma posição guarda o `antes` da PRIMEIRA', async () => {
    // O estado que interessa é o do mundo antes de o mod tocar ali. Guardar o da última escrita
    // restauraria um valor que o próprio mod pôs.
    const { host, rt } = await comMod('api.world.setBlock(0, 10, 0, 3); api.world.setBlock(0, 10, 0, 4);');
    expect(host.getBlock(0, 10, 0)).toBe(4);
    rt.reverterBlocosDoMod('m1');
    expect(host.getBlock(0, 10, 0)).toBe(1);
  });

  it('reverter duas vezes não desfaz nada a mais', async () => {
    const { host, rt } = await comMod('api.world.setBlock(3, 10, 3, 3);');
    rt.reverterBlocosDoMod('m1');
    host.setBlock(3, 10, 3, 9); // o jogador construiu depois da reversão
    expect(rt.reverterBlocosDoMod('m1')).toEqual([]);
    expect(host.getBlock(3, 10, 3)).toBe(9);
  });

  it('mod desconhecido devolve lista vazia, sem estourar', async () => {
    const { rt } = await comMod('');
    expect(rt.reverterBlocosDoMod('nao-existe')).toEqual([]);
  });

  it('mod que não colocou nada não reverte nada', async () => {
    const { rt } = await comMod('api.log("oi");');
    expect(rt.reverterBlocosDoMod('m1')).toEqual([]);
  });
});

describe('atribuição das ferramentas diretas do agente — item 704', () => {
  // O agente altera o mundo por dois caminhos: o script do mod, que já registrava, e as
  // ferramentas diretas `set_block`, `fill_box` e `execute_voxel_script`. As segundas escreviam
  // sem atribuição — e o que não tem dono não pode ser revertido.
  //
  // Na prática isso partia a reversão ao meio: o jogador pedia "faça uma torre", o agente usava
  // `fill_box`, e "desfaça esse mod" deixava a torre de pé. A metade vinda do script sumia, a
  // metade vinda da ferramenta ficava — um mundo em estado intermediário que ninguém pediu.

  it('CRÍTICO: bloco registrado por fora do script também é revertido', async () => {
    const { host, rt } = await comMod('');
    rt.registrarBlocoColocado('m1', 8, 10, 8, 1, 5);
    host.setBlock(8, 10, 8, 5); // como a ferramenta faria

    rt.reverterBlocosDoMod('m1');
    expect(host.getBlock(8, 10, 8)).toBe(1);
  });

  it('mistura os dois caminhos numa reversão só', async () => {
    const { host, rt } = await comMod('api.world.setBlock(1, 10, 1, 3);');
    rt.registrarBlocoColocado('m1', 2, 10, 2, 1, 5);
    host.setBlock(2, 10, 2, 5);

    expect(rt.reverterBlocosDoMod('m1')).toHaveLength(2);
    expect(host.getBlock(1, 10, 1)).toBe(1);
    expect(host.getBlock(2, 10, 2)).toBe(1);
  });

  it('registrar em mod desconhecido não estoura', async () => {
    const { rt } = await comMod('');
    expect(() => rt.registrarBlocoColocado('fantasma', 0, 0, 0, 1, 2)).not.toThrow();
  });

  it('CRÍTICO: nenhuma escrita do agente escapa do caminho atribuído', async () => {
    // Deixar cada `case` chamar `world.setBlock` direto é o que permitiu metade das alterações
    // ficarem sem dono. Um caminho novo nasceria sem atribuição e ninguém perceberia até alguém
    // tentar reverter.
    const fonte = readFileSync(new URL('../../src/ai/MCPExecutors.ts', import.meta.url), 'utf8');
    const diretas = fonte.split('\n').filter((l) => l.includes('this.world.setBlock('));
    // A única permitida é a de dentro do próprio helper.
    expect(diretas).toHaveLength(1);
    expect(diretas[0]).toContain('return false');
  });
});
