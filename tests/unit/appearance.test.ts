import { describe, it, expect } from 'vitest';
import { PlayerModel } from '../../src/player/PlayerModel';
import {
  Appearance,
  COLOR_SLOTS,
  DEFAULT_APPEARANCE,
  HAIR_STYLES,
  PLAYER_HEIGHT,
  SUGGESTED_PALETTE,
  buildBodyParts,
  hexToInt,
  sanitizeAppearance,
} from '../../src/player/Appearance';

describe('Appearance — higienização', () => {
  it('devolve o padrão para entrada nula ou de tipo errado', () => {
    expect(sanitizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(sanitizeAppearance(undefined)).toEqual(DEFAULT_APPEARANCE);
    expect(sanitizeAppearance('não é objeto' as any)).toEqual(DEFAULT_APPEARANCE);
  });

  it('aceita cores hexadecimais válidas e normaliza para minúsculas', () => {
    const a = sanitizeAppearance({ skin: '#ABCDEF', shirt: '  #123456  ' });
    expect(a.skin).toBe('#abcdef');
    expect(a.shirt).toBe('#123456');
  });

  it('SEGURANÇA: descarta cor inválida vinda da rede em vez de repassar à cena', () => {
    // Um peer malicioso pode mandar qualquer coisa no campo de aparência.
    const a = sanitizeAppearance({
      skin: 'javascript:alert(1)',
      hair: '#zzz',
      shirt: 'red',
      pants: '#12345',
      boots: 12345 as any,
      accent: '<script>',
    } as any);

    for (const { slot } of COLOR_SLOTS) {
      expect(a[slot], `slot ${slot} passou lixo adiante`).toMatch(/^#[0-9a-f]{6}$/);
      expect(a[slot]).toBe(DEFAULT_APPEARANCE[slot]);
    }
  });

  it('limita o porte à faixa segura', () => {
    expect(sanitizeAppearance({ build: 99 }).build).toBe(1.1);
    expect(sanitizeAppearance({ build: -5 }).build).toBe(0.9);
  });

  it('valor de porte não finito cai no padrão, em vez de virar escala degenerada', () => {
    // NaN/Infinity não são "grandes demais", são inválidos: clampar Infinity para 1.1 daria a
    // impressão de que o peer pediu um porte legítimo. Melhor tratar como ausência de valor.
    for (const bad of [NaN, Infinity, -Infinity, 'grande', null, {}]) {
      expect(sanitizeAppearance({ build: bad as any }).build).toBe(1);
    }
  });

  it('corta nome longo e recusa nome vazio', () => {
    expect(sanitizeAppearance({ name: 'x'.repeat(80) }).name).toHaveLength(24);
    expect(sanitizeAppearance({ name: '   ' }).name).toBe(DEFAULT_APPEARANCE.name);
    expect(sanitizeAppearance({ name: '  Crom  ' }).name).toBe('Crom');
  });

  it('só aceita estilo de cabelo conhecido', () => {
    expect(sanitizeAppearance({ hairStyle: 'moicano' }).hairStyle).toBe('moicano');
    expect(sanitizeAppearance({ hairStyle: 'inexistente' as any }).hairStyle).toBe(DEFAULT_APPEARANCE.hairStyle);
  });

  it('é idempotente: higienizar duas vezes dá o mesmo resultado', () => {
    const once = sanitizeAppearance({ skin: '#ABCDEF', build: 42, hairStyle: 'longo' });
    expect(sanitizeAppearance(once)).toEqual(once);
  });

  it('a paleta sugerida só tem cores válidas', () => {
    for (const { slot } of COLOR_SLOTS) {
      expect(SUGGESTED_PALETTE[slot].length).toBeGreaterThan(0);
      for (const hex of SUGGESTED_PALETTE[slot]) {
        expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe('hexToInt', () => {
  it('converte cor com e sem #', () => {
    expect(hexToInt('#ff0000')).toBe(0xff0000);
    expect(hexToInt('00ff00')).toBe(0x00ff00);
  });

  it('cai num branco seguro para entrada inválida, sem devolver NaN', () => {
    expect(hexToInt('não é cor')).toBe(0xffffff);
    expect(Number.isNaN(hexToInt('zzz'))).toBe(false);
  });
});

describe('buildBodyParts — anatomia estilo Hytale', () => {
  const parts = buildBodyParts(DEFAULT_APPEARANCE);

  it('tem as peças essenciais do corpo', () => {
    const ids = parts.map((p) => p.id);
    for (const required of ['head', 'torso', 'armLeft', 'armRight', 'legLeft', 'legRight']) {
      expect(ids).toContain(required);
    }
  });

  it('nenhuma peça fica abaixo do chão', () => {
    for (const p of parts) {
      const bottom = p.offset[1] - p.size[1] / 2;
      expect(bottom, `peça ${p.id} atravessa o chão`).toBeGreaterThanOrEqual(-0.001);
    }
  });

  it('o topo da cabeça bate com a altura declarada do jogador', () => {
    const head = parts.find((p) => p.id === 'head')!;
    const top = head.offset[1] + head.size[1] / 2;
    expect(top).toBeCloseTo(PLAYER_HEIGHT, 1);
  });

  it('a cabeça é proporcionalmente grande — é o que separa a silhueta do estilo Minecraft', () => {
    const head = parts.find((p) => p.id === 'head')!;
    const torso = parts.find((p) => p.id === 'torso')!;
    expect(head.size[0] / torso.size[0]).toBeGreaterThan(0.85);
  });

  it('cada peça referencia um slot de cor existente', () => {
    const slots = COLOR_SLOTS.map((s) => s.slot);
    for (const p of parts) expect(slots).toContain(p.slot);
  });

  it('braços e pernas são simétricos em X', () => {
    const pairs: [string, string][] = [['armLeft', 'armRight'], ['legLeft', 'legRight'], ['bootLeft', 'bootRight']];
    for (const [l, r] of pairs) {
      const left = parts.find((p) => p.id === l)!;
      const right = parts.find((p) => p.id === r)!;
      expect(left.offset[0]).toBeCloseTo(-right.offset[0], 5);
      expect(left.size).toEqual(right.size);
    }
  });

  it('todo estilo de cabelo gera uma anatomia válida', () => {
    for (const style of HAIR_STYLES) {
      const a: Appearance = { ...DEFAULT_APPEARANCE, hairStyle: style };
      const built = buildBodyParts(a);
      expect(built.length).toBeGreaterThan(6);
      for (const p of built) {
        expect(p.size.every((v) => v > 0), `peça ${p.id} do cabelo "${style}" tem tamanho zero`).toBe(true);
      }
    }
  });

  it('careca não adiciona peça de cabelo; os outros estilos adicionam', () => {
    const careca = buildBodyParts({ ...DEFAULT_APPEARANCE, hairStyle: 'careca' });
    expect(careca.some((p) => p.slot === 'hair')).toBe(false);

    for (const style of ['curto', 'longo', 'moicano'] as const) {
      const built = buildBodyParts({ ...DEFAULT_APPEARANCE, hairStyle: style });
      expect(built.some((p) => p.slot === 'hair'), `estilo ${style} não gerou cabelo`).toBe(true);
    }
  });

  it('peças de membro declaram a qual membro pertencem, para animar juntas', () => {
    const armParts = parts.filter((p) => p.limb === 'armLeft');
    expect(armParts.map((p) => p.id)).toEqual(expect.arrayContaining(['armLeft', 'handLeft']));
  });
});

describe('PlayerModel — o corpo em primeira pessoa', () => {
  it('CRÍTICO: em primeira pessoa some SÓ a cabeça, não o corpo', () => {
    // Esconder o modelo inteiro é o que fazia olhar para baixo mostrar o chão através do próprio
    // corpo. Um jogo em primeira pessoa sem corpo parece uma câmera flutuante.
    const m = new PlayerModel();
    m.setVisible(true);
    m.setPrimeiraPessoa(true);

    expect(m.group.visible).toBe(true);

    // Exatamente um pivô fica invisível — e o resto do corpo continua desenhado. Contar é o que
    // prova a afirmação: "some só a cabeça" é uma frase sobre quantidade.
    const invisiveis = m.group.children.filter((c) => !c.visible);
    const visiveis = m.group.children.filter((c) => c.visible);
    expect(invisiveis.length).toBe(1);
    expect(visiveis.length).toBeGreaterThan(2); // braços, pernas e tronco continuam lá

    // E o que sobrou visível tem geometria: um pivô vazio passaria na contagem sem mostrar nada.
    expect(visiveis.some((c) => c.children.length > 0 || (c as any).isMesh)).toBe(true);
  });

  it('em terceira pessoa a cabeça volta', () => {
    const m = new PlayerModel();
    m.setVisible(true);
    m.setPrimeiraPessoa(true);
    m.setPrimeiraPessoa(false);
    expect(m.group.children.every((c) => c.visible)).toBe(true);
  });

  it('CRÍTICO: trocar de aparência em primeira pessoa não faz a cabeça reaparecer', () => {
    // `build()` recria os pivôs. Sem reaplicar a visibilidade, a cabeça voltaria na frente da
    // câmera assim que o jogador mudasse de cor na tela de customização.
    const m = new PlayerModel();
    m.setVisible(true);
    m.setPrimeiraPessoa(true);
    m.setAppearance({ ...m.getAppearance(), skin: '#ff0000' });
    expect(m.group.children.filter((c) => !c.visible).length).toBe(1);
  });

  it('oculto por inteiro continua oculto, seja qual for o modo', () => {
    const m = new PlayerModel();
    m.setPrimeiraPessoa(true);
    m.setVisible(false);
    expect(m.group.visible).toBe(false);
    m.setPrimeiraPessoa(false);
    m.setVisible(false);
    expect(m.group.visible).toBe(false);
  });
});
