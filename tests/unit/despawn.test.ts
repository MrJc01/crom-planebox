// Quando uma criatura deixa de existir — item 1321.
//
// A regra de abrigo valia para o BERÇO e mais nada: `isSpawnable` recusa o interior da casa, e é
// só isso. Quem fechasse a porta com um zumbi dentro ficava com ele lá para sempre — o jogador
// constrói exatamente para se proteger, e a construção não o protegia do caso mais óbvio.
//
// Não havia despawn de espécie alguma, aliás. Uma criatura só saía do mundo morrendo. Quem gerasse
// hostis num canto e atravessasse o mundo levava o teto consigo, ocupado por criaturas a centenas
// de metros — e teto ocupado quer dizer que **nada nasce perto**. O sintoma é o mundo ficar
// inexplicavelmente vazio depois de uma hora de jogo.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  motivoDeDespawn,
  RelogioDeDespawn,
  ESPERA_NO_ABRIGO_S,
  ESPERA_LONGE_S,
  DISTANCIA_DE_ESQUECIMENTO,
  CARENCIA_APOS_COMBATE_S,
  CriaturaObservada,
} from '../../src/entities/despawn';
import { MAX_SPAWN_DISTANCE } from '../../src/entities/MobSpawner';

const JOGADOR = { x: 0, y: 40, z: 0 };

function bicho(over: Partial<CriaturaObservada> = {}): CriaturaObservada {
  return { id: 'm1', x: 1, y: 40, z: 1, desdeOCombate: Infinity, ...over };
}

/** Um abrigo que contém tudo com x < 10 — basta para separar dentro de fora. */
const abrigo = (x: number) => x < 10;

describe('a regra', () => {
  it('CRÍTICO: quem está preso no abrigo do jogador tem motivo para sair', () => {
    // O item inteiro. Sem isto, tapar o buraco com um zumbi dentro é permanente, e nada no jogo
    // avisa que é permanente.
    const m = motivoDeDespawn(bicho({ x: 2 }), { jogador: JOGADOR, dentroDoAbrigo: (x) => abrigo(x) });
    expect(m).toBe('preso-no-abrigo');
  });

  it('CRÍTICO: quem está longe demais é esquecido', () => {
    const longe = bicho({ x: DISTANCIA_DE_ESQUECIMENTO + 1 });
    expect(motivoDeDespawn(longe, { jogador: JOGADOR })).toBe('longe-demais');
  });

  it('CRÍTICO: quem acabou de lutar NÃO some, esteja onde estiver', () => {
    // O caso constrangedor que a carência existe para impedir: o jogador está apanhando, recua
    // para dentro de casa, e o zumbi que o está mordendo evapora. Isso não lê como abrigo — lê
    // como o jogo desistindo da luta no meio.
    const lutando = bicho({ x: 2, desdeOCombate: 0 });
    const ctx = { jogador: JOGADOR, dentroDoAbrigo: (x: number) => abrigo(x) };
    expect(motivoDeDespawn(lutando, ctx)).toBeNull();
    expect(motivoDeDespawn({ ...lutando, desdeOCombate: CARENCIA_APOS_COMBATE_S - 0.1 }, ctx)).toBeNull();
    expect(motivoDeDespawn({ ...lutando, desdeOCombate: CARENCIA_APOS_COMBATE_S }, ctx)).toBe('preso-no-abrigo');
  });

  it('a carência também vale para quem está longe', () => {
    // Senão, fugir de uma luta correndo faria o perseguidor sumir — que é a mesma quebra por outro
    // caminho: o jogador aprenderia a "desaparecer" inimigos andando.
    const longe = bicho({ x: DISTANCIA_DE_ESQUECIMENTO + 1, desdeOCombate: 1 });
    expect(motivoDeDespawn(longe, { jogador: JOGADOR })).toBeNull();
  });

  it('CRÍTICO: quem está perto e livre não some', () => {
    expect(motivoDeDespawn(bicho({ x: 20 }), { jogador: JOGADOR })).toBeNull();
  });

  it('sem abrigo mapeado, a regra de abrigo não se aplica a ninguém', () => {
    // `dentroDoAbrigo` ausente quer dizer "ninguém está abrigado". Tratá-lo como "todo mundo está
    // dentro" limparia o mundo de hostis de dia, quando o mapa de abrigo nem é calculado.
    expect(motivoDeDespawn(bicho({ x: 2 }), { jogador: JOGADOR })).toBeNull();
  });

  it('a distância é medida em três eixos', () => {
    // Só em x/z, quem estivesse cem metros acima ou abaixo contaria como perto — e no fundo de uma
    // caverna isso é exatamente onde as criaturas ficam.
    const fundo = bicho({ y: JOGADOR.y - DISTANCIA_DE_ESQUECIMENTO - 1 });
    expect(motivoDeDespawn(fundo, { jogador: JOGADOR })).toBe('longe-demais');
  });

  it('CRÍTICO: a distância de esquecimento é bem maior que a de spawn', () => {
    // Se fosse próxima, as criaturas sumiriam na borda do campo de visão do jogador enquanto ele
    // anda — visível, e pior que o problema original.
    expect(DISTANCIA_DE_ESQUECIMENTO).toBeGreaterThan(MAX_SPAWN_DISTANCE * 1.5);
  });
});

describe('o relógio', () => {
  const ctxAbrigo = { jogador: JOGADOR, dentroDoAbrigo: (x: number) => abrigo(x) };

  function correr(r: RelogioDeDespawn, c: CriaturaObservada[], ctx: any, segundos: number) {
    const saiu: string[] = [];
    for (let t = 0; t < segundos * 60; t++) {
      for (const { id } of r.avancar(c, ctx, 1 / 60)) saiu.push(id);
    }
    return saiu;
  }

  it('CRÍTICO: não some no quadro em que a condição passa a valer', () => {
    // Uma criatura que evapora na frente do jogador é pior que uma criatura presa: uma é um
    // incômodo, a outra denuncia que o mundo é uma simulação frouxa.
    const r = new RelogioDeDespawn();
    expect(r.avancar([bicho({ x: 2 })], ctxAbrigo, 1 / 60)).toHaveLength(0);
  });

  it('CRÍTICO: some depois da espera, e só uma vez', () => {
    const r = new RelogioDeDespawn();
    const saiu = correr(r, [bicho({ x: 2 })], ctxAbrigo, ESPERA_NO_ABRIGO_S + 4);
    expect(saiu).toEqual(['m1']);
  });

  it('CRÍTICO: sair do abrigo e voltar REINICIA a conta', () => {
    // Sem isso bastaria o mob cruzar a soleira uma vez para ficar marcado, e ele sumiria depois,
    // já do lado de fora, sem nenhum motivo visível.
    const r = new RelogioDeDespawn();
    const dentro = [bicho({ x: 2 })];
    const fora = [bicho({ x: 20 })];
    for (let t = 0; t < (ESPERA_NO_ABRIGO_S - 1) * 60; t++) r.avancar(dentro, ctxAbrigo, 1 / 60);
    expect(r.tempoDe('m1')).toBeGreaterThan(ESPERA_NO_ABRIGO_S - 2);
    r.avancar(fora, ctxAbrigo, 1 / 60);
    expect(r.tempoDe('m1')).toBe(0);
    // E agora precisa da espera inteira de novo.
    expect(correr(r, dentro, ctxAbrigo, ESPERA_NO_ABRIGO_S - 1)).toHaveLength(0);
  });

  it('CRÍTICO: trocar de motivo reinicia — são condições distintas', () => {
    // Somar os dois tempos misturaria duas contas com esperas diferentes, e a criatura sumiria
    // antes de qualquer uma das duas se cumprir.
    const r = new RelogioDeDespawn();
    for (let t = 0; t < (ESPERA_NO_ABRIGO_S - 1) * 60; t++) {
      r.avancar([bicho({ x: 2 })], ctxAbrigo, 1 / 60);
    }
    r.avancar([bicho({ x: DISTANCIA_DE_ESQUECIMENTO + 1 })], ctxAbrigo, 1 / 60);
    expect(r.tempoDe('m1')).toBeCloseTo(1 / 60, 6);
  });

  it('a espera de "longe demais" é maior que a de abrigo', () => {
    // Estar longe é a condição mais comum e a menos urgente; estar preso numa casa é o defeito
    // que o jogador está vendo agora.
    expect(ESPERA_LONGE_S).toBeGreaterThan(ESPERA_NO_ABRIGO_S);
  });

  it('CRÍTICO: voltar de uma aba em segundo plano não limpa o mundo de uma vez', () => {
    // `dt` volta com dezenas de segundos. Sem limite, todas as criaturas elegíveis sumiriam no
    // mesmo quadro em que a janela retoma — de uma vez, na frente do jogador.
    const r = new RelogioDeDespawn();
    expect(r.avancar([bicho({ x: 2 })], ctxAbrigo, 300)).toHaveLength(0);
  });

  it('`dt` negativo não faz o tempo andar para trás', () => {
    const r = new RelogioDeDespawn();
    r.avancar([bicho({ x: 2 })], ctxAbrigo, 1);
    const antes = r.tempoDe('m1');
    r.avancar([bicho({ x: 2 })], ctxAbrigo, -50);
    expect(r.tempoDe('m1')).toBe(antes);
  });

  it('CRÍTICO: a criatura que morreu não deixa entrada para trás', () => {
    // O mapa cresceria pelo tempo de sessão inteiro, e um id reaproveitado herdaria a conta de
    // outra criatura — que sumiria antes da hora, uma vez a cada tanto, sem padrão nenhum.
    const r = new RelogioDeDespawn();
    r.avancar([bicho({ x: 2 })], ctxAbrigo, 1);
    expect(r.tempoDe('m1')).toBeGreaterThan(0);
    r.avancar([], ctxAbrigo, 1 / 60);
    expect(r.tempoDe('m1')).toBe(0);
  });

  it('várias criaturas contam separadamente', () => {
    const r = new RelogioDeDespawn();
    const dois = [bicho({ id: 'a', x: 2 }), bicho({ id: 'b', x: 20 })];
    const saiu = correr(r, dois, ctxAbrigo, ESPERA_NO_ABRIGO_S + 2);
    expect(saiu).toEqual(['a']);
  });
});

describe('a fiação existe — código presente não é código ativo', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  const sistema = readFileSync('src/entities/EntitySystem.ts', 'utf8');

  it('CRÍTICO: o laço de quadro avança o relógio e remove quem sai', () => {
    expect(main).toMatch(/relogioDeDespawn\.avancar\(observadas,/);
    expect(main).toMatch(/entitySystem\.despawnEntity\(id\)/);
  });

  it('CRÍTICO: só o anfitrião decide', () => {
    // No convidado as criaturas vêm pelo `mob_sync`; removê-las lá as faria piscar de volta na
    // sincronização seguinte, uma vez por segundo, para sempre.
    const trecho = main.slice(main.indexOf('relogioDeDespawn.avancar') - 900, main.indexOf('relogioDeDespawn.avancar'));
    expect(trecho).toMatch(/if \(entitySystem\.autoridade\)/);
  });

  it('CRÍTICO: sumir não concede despojos', () => {
    // Premiar o despawn com loot daria ao jogador uma fazenda de recursos que se opera fechando a
    // porta. `despawnEntity` não pode chamar `onEntityDeath`.
    const corpo = sistema.slice(sistema.indexOf('public despawnEntity'), sistema.indexOf('public desdeOCombate'));
    expect(corpo).not.toMatch(/onEntityDeath/);
    expect(corpo).toMatch(/this\.entities\.delete\(id\)/);
  });

  it('CRÍTICO: dar e levar golpe marcam o combate', () => {
    // Se só um dos dois marcasse, metade dos casos de carência não existiria — e qual metade
    // dependeria de quem bateu primeiro.
    expect(sistema).toMatch(/e\.ultimoCombate = 0;\n\s*this\.updateHealthBar/);
    expect(sistema).toMatch(/e\.ultimoCombate = 0;\n\s*return p\.attackDamage/);
  });

  it('CRÍTICO: a marca de combate envelhece', () => {
    // Sem envelhecer, a primeira briga da vida da criatura a tornaria imune a despawn para sempre.
    expect(sistema).toMatch(/entity\.ultimoCombate \+= dt/);
  });

  it('o relógio é criado uma vez, fora do laço', () => {
    expect(main).toMatch(/const relogioDeDespawn = new RelogioDeDespawn\(\);/);
  });
});
