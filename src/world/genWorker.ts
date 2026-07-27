// Web Worker: gera chunks fora da main thread para não travar o frame.
import { WorldGen } from './worldgen';
import { limparBiomasDeMod, registrarBiomaDeMod } from './biomes';
import { limparRegrasDeMod, registrarRegraDeMod } from './scatter';
import { registrarTemplateDeMod, limparTemplatesDeMod } from '../crafting/StructureTemplates';

let gen: WorldGen | null = null;

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data;
  if (msg.type === 'init') {
    // Os biomas de mod vêm JUNTO com a semente, e não numa mensagem seguinte — item 676.
    //
    // O worker começa a gerar assim que recebe `init`. Uma lista que chegasse depois faria os
    // primeiros chunks nascerem sem os biomas do mod e os seguintes com eles: o mundo teria uma
    // costura invisível em volta do spawn, e ninguém ligaria isso à ordem de duas mensagens.
    //
    // `limpar` antes de registrar é o que impede o mod do mundo anterior de contaminar o próximo
    // aberto na mesma sessão — o worker é reaproveitado, e o sintoma seria terreno errado num
    // mundo que nunca teve aquele mod.
    limparBiomasDeMod();
    limparRegrasDeMod();
    limparTemplatesDeMod();
    for (const b of msg.biomasDeMod ?? []) registrarBiomaDeMod(b);
    // Os templates vêm ANTES das regras: uma regra aponta para um template por id, e registrá-la
    // primeiro deixaria o worldgen achar o sítio e não achar o que carimbar nele — um buraco no
    // terreno onde deveria haver uma construção.
    for (const t of msg.templatesDeMod ?? []) registrarTemplateDeMod(t);
    for (const r of msg.regrasDeMod ?? []) registrarRegraDeMod(r);
    gen = new WorldGen(msg.seed);
    return;
  }
  if (msg.type === 'gen' && gen) {
    const data = gen.generateChunk(msg.cx, msg.cz);
    (self as unknown as Worker).postMessage(
      { type: 'chunk', cx: msg.cx, cz: msg.cz, buffer: data.buffer },
      [data.buffer],
    );
  }
  // amostra o heightmap para um tile de LOD (Distant Horizons style):
  // n×n colunas com passo `step`, direto da função pura de geração
  if (msg.type === 'lod' && gen) {
    const { level, tx, tz, step, n, tile } = msg;
    const heights = new Int16Array(n * n);
    const surface = new Uint8Array(n * n);
    const tint = new Uint8Array(n * n);
    const ox = tx * tile, oz = tz * tile;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const col = gen.column(ox + i * step, oz + j * step);
        const k = i + j * n;
        heights[k] = col.height;
        surface[k] = col.surface;
        tint[k] = (col.forest * 255) | 0;
      }
    }
    (self as unknown as Worker).postMessage(
      { type: 'lodTile', level, tx, tz, heights, surface, tint },
      [heights.buffer, surface.buffer, tint.buffer],
    );
  }
};
