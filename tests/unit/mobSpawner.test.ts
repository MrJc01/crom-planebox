import { describe, it, expect } from 'vitest';
import { B } from '../../src/world/blocks';
import { packLight } from '../../src/world/lighting';
import {
  MAX_HOSTILES,
  MAX_SPAWN_DISTANCE,
  MIN_SPAWN_DISTANCE,
  MobSpawner,
  SPAWN_INTERVAL,
  SPAWN_LIGHT_THRESHOLD,
  SpawnWorld,
  effectiveLight,
  intervaloDeSpawn,
  findSpawnPoint,
  isSpawnable,
  ESPECIES_POR_CAMADA,
  TETO_ABSOLUTO_DE_HOSTIS,
  especieDaCamada,
  limiteDeHostis,
} from '../../src/entities/MobSpawner';
import { CAMADAS } from '../../src/world/camadas';
import { MOB_KINDS } from '../../src/entities/Combat';

/** Mundo de teste: chão sólido em y=9, ar acima, luz configurável por célula. */
function world(opts: { luzPadrao?: number; chaoY?: number } = {}): SpawnWorld & {
  setLight(x: number, y: number, z: number, sky: number, blk: number): void;
  setBlock(x: number, y: number, z: number, t: number): void;
} {
  const chaoY = opts.chaoY ?? 9;
  const luz = opts.luzPadrao ?? 0;
  const blocks = new Map<string, number>();
  const lights = new Map<string, number>();
  const k = (x: number, y: number, z: number) => `${x},${y},${z}`;

  return {
    setBlock(x, y, z, t) { blocks.set(k(x, y, z), t); },
    setLight(x, y, z, sky, blk) { lights.set(k(x, y, z), packLight(sky, blk)); },
    getBlock(x, y, z) {
      const explicit = blocks.get(k(x, y, z));
      if (explicit !== undefined) return explicit;
      return y <= chaoY ? B.STONE : B.AIR;
    },
    getLight(x, y, z) {
      return lights.get(k(x, y, z)) ?? luz;
    },
  };
}

const CTX = { timeOfDay: 0, sunScale: 0.12, hostileCount: 0, maxY: 128 };
const PLAYER = { x: 0, y: 10, z: 0 };

/** Gerador determinístico para os testes não dependerem de sorte. */
function rngSeq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('effectiveLight — a hora do dia entra na conta', () => {
  it('luz de céu vale integralmente ao meio-dia', () => {
    expect(effectiveLight(packLight(15, 0), 1)).toBe(15);
  });

  it('CRÍTICO: à noite a luz de céu despenca — sem isso nada nasceria na superfície', () => {
    expect(effectiveLight(packLight(15, 0), 0.12)).toBeLessThanOrEqual(SPAWN_LIGHT_THRESHOLD);
  });

  it('a tocha não é afetada pela hora — ela protege de dia e de noite', () => {
    expect(effectiveLight(packLight(0, 14), 1)).toBe(14);
    expect(effectiveLight(packLight(0, 14), 0.12)).toBe(14);
  });

  it('vale a maior entre as duas fontes', () => {
    expect(effectiveLight(packLight(15, 3), 1)).toBe(15);
    expect(effectiveLight(packLight(2, 12), 1)).toBe(12);
  });
});

describe('isSpawnable — condições do berço', () => {
  it('aceita chão sólido, dois voxels livres e escuridão', () => {
    const w = world();
    expect(isSpawnable(w, 5, 10, 5, 0.12)).toBe(true);
  });

  it('CRÍTICO: recusa célula iluminada — é isto que faz a tocha proteger a área', () => {
    const w = world();
    w.setLight(5, 10, 5, 0, 14); // tocha por perto
    expect(isSpawnable(w, 5, 10, 5, 0.12)).toBe(false);
  });

  it('recusa quando não há chão sólido embaixo', () => {
    const w = world();
    w.setBlock(5, 9, 5, B.AIR);
    expect(isSpawnable(w, 5, 10, 5, 0.12)).toBe(false);
  });

  it('recusa quando falta espaço para o corpo', () => {
    const w = world();
    w.setBlock(5, 11, 5, B.STONE); // teto colado
    expect(isSpawnable(w, 5, 10, 5, 0.12)).toBe(false);
  });

  it('recusa nascer em cima de lava ou dentro de água', () => {
    const lava = world();
    lava.setBlock(5, 9, 5, B.LAVA);
    expect(isSpawnable(lava, 5, 10, 5, 0.12)).toBe(false);

    const agua = world();
    agua.setBlock(5, 9, 5, B.WATER);
    expect(isSpawnable(agua, 5, 10, 5, 0.12)).toBe(false);
  });

  it('de dia a superfície fica segura, mesmo com a mesma luz de céu', () => {
    const w = world();
    w.setLight(5, 10, 5, 15, 0);
    expect(isSpawnable(w, 5, 10, 5, 1)).toBe(false);   // meio-dia
    expect(isSpawnable(w, 5, 10, 5, 0.12)).toBe(true); // madrugada
  });

  it('a caverna é perigosa a qualquer hora, porque não tem luz de céu', () => {
    const w = world();
    w.setLight(5, 10, 5, 0, 0);
    expect(isSpawnable(w, 5, 10, 5, 1)).toBe(true);
  });
});

describe('findSpawnPoint — escolha do ponto', () => {
  it('encontra um ponto válido num mundo escuro', () => {
    const p = findSpawnPoint(world(), PLAYER, CTX, rngSeq([0.1, 0.5]));
    expect(p).not.toBeNull();
    expect(MOB_KINDS).toContain(p!.kind);
  });

  it('CRÍTICO: respeita a distância mínima — nada materializa na cara do jogador', () => {
    for (let i = 0; i < 40; i++) {
      const p = findSpawnPoint(world(), PLAYER, CTX, Math.random);
      if (!p) continue;
      const d = Math.hypot(p.x - PLAYER.x, p.z - PLAYER.z);
      expect(d).toBeGreaterThanOrEqual(MIN_SPAWN_DISTANCE - 1.5);
      expect(d).toBeLessThanOrEqual(MAX_SPAWN_DISTANCE + 1.5);
    }
  });

  it('devolve null num mundo todo iluminado, em vez de insistir', () => {
    const w = world({ luzPadrao: packLight(15, 15) });
    expect(findSpawnPoint(w, PLAYER, { ...CTX, sunScale: 1 }, Math.random)).toBeNull();
  });

  it('devolve null quando o teto de hostis foi atingido', () => {
    const ctx = { ...CTX, hostileCount: MAX_HOSTILES };
    expect(findSpawnPoint(world(), PLAYER, ctx, Math.random)).toBeNull();
  });

  it('o ponto escolhido é sempre spawnável de fato', () => {
    for (let i = 0; i < 30; i++) {
      const w = world();
      const p = findSpawnPoint(w, PLAYER, CTX, Math.random);
      if (!p) continue;
      expect(isSpawnable(w, Math.floor(p.x), p.y, Math.floor(p.z), CTX.sunScale)).toBe(true);
    }
  });

  it('varia o tipo de mob entre os declarados', () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const p = findSpawnPoint(world(), PLAYER, CTX, Math.random);
      if (p) vistos.add(p.kind);
    }
    expect(vistos.size).toBeGreaterThan(1);
  });
});

describe('MobSpawner — ritmo', () => {
  it('não gera nada antes do intervalo', () => {
    const s = new MobSpawner();
    expect(s.update(0.5, world(), PLAYER, CTX, Math.random)).toBeNull();
  });

  it('gera ao completar o intervalo e reinicia a contagem', () => {
    const s = new MobSpawner();
    expect(s.update(SPAWN_INTERVAL + 0.1, world(), PLAYER, CTX, Math.random)).not.toBeNull();
    expect(s.update(0.1, world(), PLAYER, CTX, Math.random)).toBeNull();
  });

  it('desligado nunca gera — é assim que o Criativo fica seguro', () => {
    const s = new MobSpawner();
    s.enabled = false;
    for (let i = 0; i < 10; i++) {
      expect(s.update(SPAWN_INTERVAL + 1, world(), PLAYER, CTX, Math.random)).toBeNull();
    }
  });

  it('reset zera a contagem acumulada', () => {
    const s = new MobSpawner();
    s.update(SPAWN_INTERVAL - 0.2, world(), PLAYER, CTX, Math.random);
    s.reset();
    expect(s.update(0.3, world(), PLAYER, CTX, Math.random)).toBeNull();
  });
});

describe('intervaloDeSpawn — a fase da lua muda o ritmo', () => {
  it('CRÍTICO: lua nova gera mais rápido que lua cheia', () => {
    // Esta é a única coisa que faz a fase importar para a mecânica. O nível de luz NÃO basta:
    // o limiar é 6, e a luz de céu efetiva à noite vai de ~0,5 (nova) a ~2,9 (cheia) — as duas
    // passam com folga, então a fase mudaria só o quanto se enxerga, e nada mais.
    expect(intervaloDeSpawn(0)).toBeLessThan(intervaloDeSpawn(1));
  });

  it('lua cheia preserva exatamente o ritmo original', () => {
    expect(intervaloDeSpawn(1)).toBe(SPAWN_INTERVAL);
  });

  it('é monotônico e nunca chega a zero — spawn instantâneo travaria o jogo', () => {
    // O intervalo CRESCE com a iluminação: quanto mais cheia a lua, mais espaçado o surgimento.
    let anterior = 0;
    for (let i = 0; i <= 1; i += 0.05) {
      const v = intervaloDeSpawn(i);
      expect(v).toBeGreaterThan(0.5);
      expect(v).toBeGreaterThanOrEqual(anterior - 1e-9);
      anterior = v;
    }
  });

  it('iluminação fora da faixa não quebra o ritmo', () => {
    expect(intervaloDeSpawn(-5)).toBe(intervaloDeSpawn(0));
    expect(intervaloDeSpawn(9)).toBe(intervaloDeSpawn(1));
  });

  it('o contexto sem lua preserva o comportamento antigo — testes existentes não mudam', () => {
    const spawner = new MobSpawner();
    const mundo: SpawnWorld = { getBlock: () => 0, getLight: () => 0 };
    const ctx = { timeOfDay: 0, sunScale: 0, hostileCount: 0, maxY: 128 };
    // Sem `moonIllumination`, o intervalo é o cheio: 3,9 s não dispara, 4,1 s dispara.
    expect(spawner.update(3.9, mundo, { x: 0, y: 40, z: 0 }, ctx)).toBeNull();
  });
});

describe('a casa protege — o abrigo do jogador não é berço (item 1315)', () => {
  // O defeito clássico do gênero, e o que faz alguém deixar de construir: o interior de uma casa
  // fechada é o lugar mais escuro do mundo à noite, e `MIN_SPAWN_DISTANCE` são 14 mini-voxels —
  // menos de cinco metros. Ou seja, o **melhor** berço que o sorteio poderia encontrar era
  // exatamente dentro do abrigo. O jogador constrói para se proteger, e o jogo o pune por isso.

  /** Finge que tudo dentro de um raio horizontal do jogador é o abrigo dele. */
  const abrigoAoRedor = (raio: number) => (x: number, _y: number, z: number) =>
    Math.hypot(x - PLAYER.x, z - PLAYER.z) <= raio;

  it('CRÍTICO: nenhum ponto sorteado cai dentro do abrigo', () => {
    const dentro = abrigoAoRedor(MAX_SPAWN_DISTANCE + 10); // abrigo cobrindo todo o alcance
    const ctx = { ...CTX, dentroDoAbrigo: dentro };
    for (let i = 0; i < 60; i++) {
      expect(findSpawnPoint(world(), PLAYER, ctx, Math.random)).toBeNull();
    }
  });

  it('CRÍTICO: o bloqueio NÃO mata o spawn fora do abrigo', () => {
    // Sem esta verificação, "consertar" seria trivial e inútil: bastaria nunca gerar ninguém, e a
    // noite deixaria de existir como ameaça.
    const ctx = { ...CTX, dentroDoAbrigo: abrigoAoRedor(MIN_SPAWN_DISTANCE - 1) };
    let achou = 0;
    for (let i = 0; i < 60; i++) if (findSpawnPoint(world(), PLAYER, ctx, Math.random)) achou++;
    expect(achou).toBeGreaterThan(0);
  });

  it('`isSpawnable` recusa a célula abrigada mesmo com tudo o mais perfeito', () => {
    const w = world();
    expect(isSpawnable(w, 5, 10, 5, 0.12)).toBe(true);
    expect(isSpawnable(w, 5, 10, 5, 0.12, () => true)).toBe(false);
  });

  it('sem abrigo mapeado, a regra não muda nada', () => {
    // `undefined` é o estado normal: de dia, e sempre que o jogador está a céu aberto.
    const w = world();
    expect(isSpawnable(w, 5, 10, 5, 0.12, undefined)).toBe(true);
  });
});

describe('perigo cresce com a profundidade — item 497', () => {
  // Perigo por tempo pune quem joga devagar e não recompensa nada. Perigo por LUGAR é uma escolha:
  // descer é a decisão de trocar segurança por recurso, e é ela que dá sentido ao diamante estar no
  // fundo. Sem isto, a única diferença entre a caverna e o abismo seria o tempo de caminhada.

  it('CRÍTICO: camada mais funda gera mais depressa', () => {
    const superficie = intervaloDeSpawn(1, CAMADAS[0].perigo);
    const abismo = intervaloDeSpawn(1, CAMADAS[CAMADAS.length - 1].perigo);
    expect(abismo).toBeLessThan(superficie);
  });

  it('CRÍTICO: o perigo divide, e não subtrai', () => {
    // Subtrair faria a lua cheia no abismo ficar mais calma que a lua nova na superfície — o que
    // inverteria a relação que o jogador aprendeu lá em cima.
    const luaCheiaNoAbismo = intervaloDeSpawn(1, 2.2);
    const luaNovaNaSuperficie = intervaloDeSpawn(0, 1);
    expect(luaCheiaNoAbismo).toBeLessThan(luaNovaNaSuperficie);
  });

  it('o perigo ausente preserva o ritmo antigo', () => {
    expect(intervaloDeSpawn(1)).toBe(intervaloDeSpawn(1, 1));
  });

  it('perigo zero ou negativo não vira intervalo infinito nem negativo', () => {
    expect(intervaloDeSpawn(1, 0)).toBeGreaterThan(0);
    expect(Number.isFinite(intervaloDeSpawn(1, -5))).toBe(true);
  });

  it('o perigo cresce monotonicamente com a profundidade', () => {
    // Uma camada mais funda que fosse mais calma faria descer parecer voltar para cima.
    for (let i = 1; i < CAMADAS.length; i++) {
      expect(CAMADAS[i].perigo, CAMADAS[i].id).toBeGreaterThan(CAMADAS[i - 1].perigo);
    }
  });
});

describe('a camada desloca a mistura de espécies — item 1439', () => {
  /** Distribuição de 3.000 sorteios uniformes. */
  function distribuicao(camada: string): Record<string, number> {
    const conta: Record<string, number> = { zumbi: 0, esqueleto: 0, aranha: 0 };
    for (let i = 0; i < 3000; i++) conta[especieDaCamada(camada, i / 3000)]++;
    return conta;
  }

  it('CRÍTICO: no abismo a aranha e o esqueleto dominam', () => {
    const d = distribuicao('abismo');
    expect(d.aranha).toBeGreaterThan(d.zumbi);
    expect(d.esqueleto).toBeGreaterThan(d.zumbi);
  });

  it('CRÍTICO: o zumbi NÃO some do abismo — desloca, não troca', () => {
    // Trocar por completo faria cada camada parecer um jogo diferente, e a passagem entre elas
    // deixaria de ser progressão para virar transporte.
    expect(distribuicao('abismo').zumbi).toBeGreaterThan(0);
  });

  it('a superfície continua uniforme — é o mundo que o jogador já conhece', () => {
    const d = distribuicao('superficie');
    expect(Math.abs(d.zumbi - d.aranha)).toBeLessThan(200);
  });

  it('camada desconhecida cai na mistura da superfície, sem estourar', () => {
    expect(() => especieDaCamada('inventada', 0.5)).not.toThrow();
    expect(MOB_KINDS).toContain(especieDaCamada('inventada', 0.5));
  });

  it('toda camada tem pelo menos uma espécie — nenhuma fica vazia', () => {
    // Uma camada sem espécie devolveria sempre o mesmo padrão, e o sorteio deixaria de importar.
    for (const c of CAMADAS) {
      const pesos = ESPECIES_POR_CAMADA[c.id];
      expect(pesos, c.id).toBeDefined();
      expect(Object.values(pesos!).some((p) => (p ?? 0) > 0), c.id).toBe(true);
    }
  });
});

describe('o teto que saturava — item 1443', () => {
  // Com um teto único, o abismo gerando ao dobro do ritmo simplesmente chegava ao limite mais
  // rápido — e ali o perigo parava de crescer. É o mesmo teto por saturação que já apareceu no
  // TIER_DAMAGE deste projeto: não falha, não avisa, só deixa de recompensar. O jogador desceria
  // mais fundo e sentiria o mesmo, concluindo que a profundidade não muda nada.

  it('CRÍTICO: o teto acompanha o perigo da camada', () => {
    const superficie = limiteDeHostis(CAMADAS[0].perigo);
    const abismo = limiteDeHostis(CAMADAS[CAMADAS.length - 1].perigo);
    expect(abismo).toBeGreaterThan(superficie);
  });

  it('CRÍTICO: existe teto absoluto — difícil não pode virar travado', () => {
    // O limite aqui não é de jogo, é de quadro: cada hostil roda perseguição e colisão por frame. E
    // o jogador não teria como distinguir "muito difícil" de "o jogo travou".
    expect(limiteDeHostis(100)).toBe(TETO_ABSOLUTO_DE_HOSTIS);
    expect(TETO_ABSOLUTO_DE_HOSTIS).toBeGreaterThanOrEqual(MAX_HOSTILES);
  });

  it('sem perigo informado, o teto é o da superfície', () => {
    expect(limiteDeHostis()).toBe(MAX_HOSTILES);
  });

  it('CRÍTICO: o spawner respeita o teto DA CAMADA, não o global', () => {
    // Sem isto, o abismo continuaria parando em 18 e o teto novo seria uma função que ninguém usa.
    const acimaDoGlobal = { ...CTX, hostileCount: MAX_HOSTILES + 2, perigo: 2.2 };
    expect(findSpawnPoint(world(), PLAYER, acimaDoGlobal, Math.random)).not.toBeNull();

    const naSuperficie = { ...CTX, hostileCount: MAX_HOSTILES + 2, perigo: 1 };
    expect(findSpawnPoint(world(), PLAYER, naSuperficie, Math.random)).toBeNull();
  });

  it('perigo absurdo não vira teto negativo nem infinito', () => {
    expect(limiteDeHostis(0)).toBeGreaterThan(0);
    expect(Number.isFinite(limiteDeHostis(-3))).toBe(true);
  });
});
