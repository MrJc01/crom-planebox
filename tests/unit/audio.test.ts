import { describe, it, expect } from 'vitest';
import { B, BLOCKS, CUSTOM_BLOCK_ID_BASE, registerCustomBlockAt, resetCustomBlocks } from '../../src/world/blocks';
import {
  FOOTSTEP_MAX_DURATION,
  SOUNDS,
  SoundSpec,
  distanceGain,
  materialOf,
  soundForBreak,
  soundForFootstep,
  soundForPlace,
  stereoPan,
} from '../../src/audio/synth';

/** Um som só é utilizável se todos os parâmetros forem finitos e nas faixas audíveis. */
function specValido(s: SoundSpec, rotulo: string): void {
  expect(Number.isFinite(s.freq), `${rotulo}: freq`).toBe(true);
  expect(s.freq, `${rotulo}: freq audível`).toBeGreaterThan(20);
  expect(s.freq, `${rotulo}: freq audível`).toBeLessThan(20000);
  expect(s.duration, `${rotulo}: duração`).toBeGreaterThan(0);
  expect(s.duration, `${rotulo}: duração razoável`).toBeLessThan(3);
  expect(s.noise, `${rotulo}: ruído`).toBeGreaterThanOrEqual(0);
  expect(s.noise, `${rotulo}: ruído`).toBeLessThanOrEqual(1);
  expect(s.gain, `${rotulo}: ganho`).toBeGreaterThan(0);
  expect(s.gain, `${rotulo}: ganho`).toBeLessThanOrEqual(1);
  expect(s.attack, `${rotulo}: ataque`).toBeGreaterThan(0);
  expect(s.attack, `${rotulo}: ataque menor que a duração`).toBeLessThan(s.duration);
  expect(s.filterHz, `${rotulo}: filtro`).toBeGreaterThan(100);
}

describe('materialOf — som coerente com o bloco', () => {
  it('classifica os materiais base corretamente', () => {
    expect(materialOf(B.STONE)).toBe('pedra');
    expect(materialOf(B.LOG)).toBe('madeira');
    expect(materialOf(B.PLANK)).toBe('madeira');
    expect(materialOf(B.DIRT)).toBe('terra');
    expect(materialOf(B.SAND)).toBe('areia');
    expect(materialOf(B.GLASS)).toBe('vidro');
    expect(materialOf(B.IRON_BLOCK)).toBe('metal');
    expect(materialOf(B.LEAVES)).toBe('folhagem');
    expect(materialOf(B.SNOW)).toBe('neve');
  });

  it('água e lava são fluido', () => {
    expect(materialOf(B.WATER)).toBe('fluido');
    expect(materialOf(B.LAVA)).toBe('fluido');
  });

  it('CRÍTICO: bloco de mod herda material coerente das propriedades, sem declarar nada', () => {
    resetCustomBlocks();
    // Sem esta derivação, todo bloco criado pela IA soaria como pedra.
    const cristal = registerCustomBlockAt(CUSTOM_BLOCK_ID_BASE, {
      name: 'cristal', topColor: 0x38bdf8, opaque: false, solid: true,
    });
    const tufo = registerCustomBlockAt(CUSTOM_BLOCK_ID_BASE + 1, {
      name: 'tufo', topColor: 0x00ff00, decor: true, solid: false, opaque: false,
    });
    const graos = registerCustomBlockAt(CUSTOM_BLOCK_ID_BASE + 2, {
      name: 'graos', topColor: 0xd2c48e, gravity: true,
    });

    expect(materialOf(cristal)).toBe('vidro');
    expect(materialOf(tufo)).toBe('folhagem');
    expect(materialOf(graos)).toBe('areia');
    resetCustomBlocks();
  });

  it('id órfão cai em pedra em vez de quebrar', () => {
    expect(materialOf(9999)).toBe('pedra');
  });
});

describe('sons de bloco', () => {
  const blocos = [B.STONE, B.LOG, B.DIRT, B.SAND, B.GLASS, B.IRON_BLOCK, B.LEAVES, B.WATER, B.SNOW, B.TORCH];

  it('quebrar, colocar e pisar geram especificações válidas para todo bloco', () => {
    for (let id = 1; id < BLOCKS.length; id++) {
      const def = BLOCKS[id];
      if (!def || def.reserved) continue;
      specValido(soundForBreak(id), `quebrar ${def.name}`);
      specValido(soundForPlace(id), `colocar ${def.name}`);
      specValido(soundForFootstep(id), `pisar ${def.name}`);
    }
  });

  it('materiais diferentes soam diferentes — é o ponto de existir a tabela', () => {
    const assinaturas = new Set(
      blocos.map((b) => {
        const s = soundForBreak(b);
        return `${Math.round(s.freq)}|${s.noise}|${s.filterHz}`;
      }),
    );
    // Fluido e neve podem coincidir com outro em alguma dimensão, mas não todos entre si.
    expect(assinaturas.size).toBeGreaterThan(6);
  });

  it('colocar é mais grave e mais curto que quebrar', () => {
    for (const b of blocos) {
      const quebrar = soundForBreak(b);
      const colocar = soundForPlace(b);
      expect(colocar.freq, `bloco ${b}`).toBeLessThan(quebrar.freq);
      expect(colocar.duration, `bloco ${b}`).toBeLessThan(quebrar.duration);
    }
  });

  it('passo é bem mais discreto que quebrar — é o som mais repetido do jogo', () => {
    for (const b of blocos) {
      expect(soundForFootstep(b).gain).toBeLessThan(soundForBreak(b).gain * 0.7);
      expect(soundForFootstep(b).duration).toBeLessThanOrEqual(FOOTSTEP_MAX_DURATION);
    }
  });

  it('vidro é mais brilhante que terra, e metal ressoa mais que pedra', () => {
    expect(soundForBreak(B.GLASS).filterHz).toBeGreaterThan(soundForBreak(B.DIRT).filterHz);
    expect(soundForBreak(B.IRON_BLOCK).duration).toBeGreaterThan(soundForBreak(B.STONE).duration);
    // Só metal tem harmônicos: é o que faz soar metálico em vez de um "toc" qualquer.
    expect(soundForBreak(B.IRON_BLOCK).harmonics).toBeGreaterThan(1);
    expect(soundForBreak(B.DIRT).harmonics ?? 1).toBe(1);
  });

  it('a variação é determinística: mesma posição soa igual, posições diferentes soam diferente', () => {
    expect(soundForBreak(B.STONE, 42).freq).toBe(soundForBreak(B.STONE, 42).freq);
    expect(soundForBreak(B.STONE, 42).freq).not.toBe(soundForBreak(B.STONE, 43).freq);
  });

  it('a variação nunca sai da faixa audível, mesmo com semente extrema', () => {
    for (const semente of [0, -1, 2 ** 31, -(2 ** 31), 999999999]) {
      specValido(soundForBreak(B.STONE, semente), `semente ${semente}`);
      specValido(soundForFootstep(B.GLASS, semente), `semente ${semente}`);
    }
  });
});

describe('catálogo de sons de evento', () => {
  it('todo som do catálogo é válido', () => {
    for (const [nome, spec] of Object.entries(SOUNDS)) specValido(spec, nome);
  });

  it('os eventos importantes existem', () => {
    for (const nome of ['dano', 'morte', 'acerto', 'mobMorte', 'pegarItem', 'uiClique', 'splash']) {
      expect(SOUNDS[nome], `falta o som "${nome}"`).toBeDefined();
    }
  });

  it('morte é o som de evento mais longo — precisa ter peso', () => {
    // O invariante é sobre RESPOSTA A AÇÃO: nenhum retorno de ato do jogador pode se arrastar
    // mais que a própria morte, senão o som atrapalha o ato seguinte. Sons atmosféricos são
    // outra categoria — o trovão dura 1,6 s de propósito, e encurtá-lo para caber aqui seria
    // deixar o teste ditar o jogo.
    const ATMOSFERICOS = new Set(['trovao', 'raio']);
    for (const [nome, spec] of Object.entries(SOUNDS)) {
      if (nome === 'morte' || ATMOSFERICOS.has(nome)) continue;
      expect(spec.duration, `${nome} não pode durar mais que a morte`).toBeLessThanOrEqual(SOUNDS.morte.duration);
    }
  });

  it('os sons atmosféricos são longos de propósito, e continuam sendo sons válidos', () => {
    for (const nome of ['trovao', 'raio']) {
      const spec = SOUNDS[nome];
      expect(spec.duration).toBeGreaterThan(0.2);
      expect(spec.duration).toBeLessThan(4);
      expect(spec.gain).toBeGreaterThan(0);
      expect(spec.gain).toBeLessThanOrEqual(1);
    }
    // Trovão é grave; o agudo é o primeiro a se perder no ar.
    expect(SOUNDS.trovao.filterHz).toBeLessThan(SOUNDS.raio.filterHz);
  });

  it('sons de UI são discretos', () => {
    expect(SOUNDS.uiClique.gain).toBeLessThan(SOUNDS.dano.gain);
    expect(SOUNDS.uiClique.duration).toBeLessThan(0.1);
  });
});

describe('distanceGain — atenuação', () => {
  it('perto é volume cheio, longe é silêncio', () => {
    expect(distanceGain(0)).toBe(1);
    expect(distanceGain(1)).toBe(1);
    expect(distanceGain(32)).toBe(0);
    expect(distanceGain(500)).toBe(0);
  });

  it('cai monotonicamente com a distância', () => {
    let anterior = 1.1;
    for (let d = 0; d <= 40; d += 2) {
      const g = distanceGain(d);
      expect(g).toBeLessThanOrEqual(anterior);
      anterior = g;
    }
  });

  it('CRÍTICO: corta em zero — sem isso, somar centenas de ganhos ínfimos daria zumbido', () => {
    expect(distanceGain(33)).toBe(0);
    let soma = 0;
    for (let i = 0; i < 500; i++) soma += distanceGain(40 + i);
    expect(soma).toBe(0);
  });
});

describe('stereoPan — panorâmica', () => {
  it('fonte à frente fica centrada', () => {
    // Olhando para -Z (yaw 0), uma fonte à frente não tem componente lateral.
    expect(Math.abs(stereoPan({ x: 0, z: -10 }, { x: 0, z: 0 }, 0))).toBeLessThan(0.001);
  });

  it('fonte à direita e à esquerda dão sinais opostos', () => {
    const dir = stereoPan({ x: 10, z: 0 }, { x: 0, z: 0 }, 0);
    const esq = stereoPan({ x: -10, z: 0 }, { x: 0, z: 0 }, 0);
    expect(Math.sign(dir)).toBe(-Math.sign(esq));
    expect(Math.abs(dir)).toBeGreaterThan(0.9);
  });

  it('girar a escuta inverte a percepção do mesmo ponto', () => {
    const antes = stereoPan({ x: 10, z: 0 }, { x: 0, z: 0 }, 0);
    const depois = stereoPan({ x: 10, z: 0 }, { x: 0, z: 0 }, Math.PI);
    expect(Math.sign(antes)).toBe(-Math.sign(depois));
  });

  it('fica sempre na faixa -1..1 e nunca dá NaN', () => {
    for (const yaw of [0, 1, -1, Math.PI, 10, -10]) {
      for (const [x, z] of [[0, 0], [1, 1], [-100, 50], [0.001, -0.001]]) {
        const p = stereoPan({ x, z }, { x: 0, z: 0 }, yaw);
        expect(Number.isNaN(p)).toBe(false);
        expect(p).toBeGreaterThanOrEqual(-1);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });

  it('fonte sobreposta à escuta fica centrada, sem divisão por zero', () => {
    expect(stereoPan({ x: 0, z: 0 }, { x: 0, z: 0 }, 0)).toBe(0);
  });
});
