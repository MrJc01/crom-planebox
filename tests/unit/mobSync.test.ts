// @vitest-environment jsdom
// Criaturas no multijogador — a segunda metade de "o mundo não é o mesmo".
//
// A primeira metade era a semente do terreno. Esta é o comportamento vivo em cima dele: o
// convidado rodava o **próprio** `MobSpawner`, sem checar o papel. Cada lado criava as suas
// criaturas, em lugares diferentes, e simulava as mesmas de forma independente.
//
// **Duas simulações autônomas do mesmo objeto nunca convergem.** Não é um problema de precisão
// que uma correção periódica resolve — é de autoridade: só um lado pode decidir.
//
// E havia `EntityUpdateMsg` no protocolo, com `id, x, y, z`, **definida e nunca enviada nem
// recebida** — o nono caso de código dormente. Ela também não bastaria: com só posições, o
// convidado nunca sabe que uma criatura NASCEU (não vem o tipo) nem que MORREU (a ausência não é
// um evento). Um zumbi morto pelo anfitrião ficaria parado para sempre na tela do convidado.

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { EntitySystem } from '../../src/entities/EntitySystem';

/** Mundo mínimo: só o que o `EntitySystem` consulta. Tudo sólido abaixo de y=10. */
const mundoFalso = {
  getBlock: (_x: number, y: number, _z: number) => (y < 10 ? 1 : 0),
  setBlock: () => {},
} as any;

function sistema(): EntitySystem {
  return new EntitySystem(mundoFalso, new THREE.Scene());
}

function retrato(...mobs: Array<[string, string, number, number, number]>) {
  return mobs.map(([id, kind, x, y, z]) => ({ id, kind, x, y, z, health: 20 }));
}

describe('retrato de criaturas — o anfitrião descreve, o convidado desenha', () => {
  let host: EntitySystem;

  beforeEach(() => { host = sistema(); });

  it('CRÍTICO: o retrato diz QUAL espécie é cada criatura', () => {
    // Sem o tipo, o convidado desenharia todo mundo como zumbi. O perfil sozinho não identifica
    // a espécie de volta, por isso ela passou a ser guardada no registro.
    host.spawnHostile('aranha', 5, 12, 5);
    host.spawnHostile('esqueleto', 9, 12, 9);
    const especies = host.retratoDeHostis().map((m) => m.kind).sort();
    expect(especies).toEqual(['aranha', 'esqueleto']);
  });

  it('o retrato traz só hostis, não os NPCs decorativos', () => {
    host.spawnHostile('zumbi', 1, 12, 1);
    host.spawnEntity('orc', 'Aldeão', 2, 12, 2, 'Neutro');
    expect(host.retratoDeHostis().length).toBe(1);
  });

  it('CRÍTICO: o convidado nasce com as criaturas do anfitrião', () => {
    const convidado = sistema();
    convidado.autoridade = false;
    convidado.aplicarRetratoDeHostis(retrato(['h1', 'zumbi', 4, 12, 4], ['h2', 'aranha', 8, 12, 8]));
    expect(convidado.hostileCount).toBe(2);
  });

  it('CRÍTICO: a criatura que sumiu do retrato é REMOVIDA', () => {
    // A ausência não é um evento: sem esta regra, um zumbi morto pelo anfitrião ficaria parado
    // para sempre na tela do convidado. É o que um `entity_update` por criatura não resolveria.
    const convidado = sistema();
    convidado.autoridade = false;
    convidado.aplicarRetratoDeHostis(retrato(['h1', 'zumbi', 4, 12, 4], ['h2', 'aranha', 8, 12, 8]));
    convidado.aplicarRetratoDeHostis(retrato(['h1', 'zumbi', 4, 12, 4]));
    expect(convidado.hostileCount).toBe(1);
  });

  it('CRÍTICO: retrato repetido NÃO duplica — move a mesma criatura', () => {
    // O erro clássico de sincronização por retrato: sem mapear o id do anfitrião para o id local,
    // cada mensagem criaria criaturas novas e em segundos haveria centenas.
    const convidado = sistema();
    convidado.autoridade = false;
    for (let i = 0; i < 20; i++) {
      convidado.aplicarRetratoDeHostis(retrato(['h1', 'zumbi', i, 12, 0]));
    }
    expect(convidado.hostileCount).toBe(1);
    expect(convidado.listHostiles()[0].pos.x).toBe(19);
  });

  it('é auto-corretivo: uma mensagem perdida se conserta no retrato seguinte', () => {
    const convidado = sistema();
    convidado.autoridade = false;
    convidado.aplicarRetratoDeHostis(retrato(['h1', 'zumbi', 1, 12, 1]));
    // "perde-se" o retrato que anunciava h2 — o seguinte já o traz, sem estado divergente preso
    convidado.aplicarRetratoDeHostis(retrato(['h1', 'zumbi', 2, 12, 1], ['h2', 'zumbi', 5, 12, 5]));
    expect(convidado.hostileCount).toBe(2);
  });

  it('o retrato do anfitrião é aplicável tal e qual pelo convidado', () => {
    // Ponta a ponta na estrutura de dados: o que sai de um entra no outro sem tradução.
    host.spawnHostile('esqueleto', 3, 12, 7);
    const convidado = sistema();
    convidado.autoridade = false;
    convidado.aplicarRetratoDeHostis(host.retratoDeHostis());
    expect(convidado.hostileCount).toBe(host.hostileCount);
    expect(convidado.listHostiles()[0].mobKind).toBe('esqueleto');
  });
});

describe('autoridade — só um lado decide', () => {
  it('CRÍTICO: sem autoridade, a IA não move a criatura', () => {
    // O ponto todo. Se o convidado simulasse, a mesma criatura andaria para dois lugares
    // diferentes e o retrato seguinte a puxaria de volta — o boneco ficaria tremendo.
    const convidado = sistema();
    convidado.autoridade = false;
    convidado.aplicarRetratoDeHostis(retrato(['h1', 'zumbi', 4, 12, 4]));

    const jogador = new THREE.Vector3(4, 12, 6); // pertinho, para provocar a perseguição
    for (let i = 0; i < 60; i++) convidado.update(0.016, jogador);

    const p = convidado.listHostiles()[0].pos;
    expect(p.x).toBe(4);
    expect(p.y).toBe(12);
    expect(p.z).toBe(4);
  });

  it('COM autoridade, a criatura reage ao jogador — o bloqueio não matou a IA', () => {
    // Sem esta verificação, "consertar" seria trivial e inútil: bastaria nunca mover ninguém.
    const anfitriao = sistema();
    anfitriao.spawnHostile('zumbi', 4, 12, 4);
    const antes = anfitriao.listHostiles()[0].pos.clone();

    const jogador = new THREE.Vector3(4, 12, 7);
    for (let i = 0; i < 120; i++) anfitriao.update(0.016, jogador);

    expect(anfitriao.listHostiles()[0].pos.distanceTo(antes)).toBeGreaterThan(0.05);
  });

  it('offline a autoridade é do próprio jogador, por padrão', () => {
    expect(sistema().autoridade).toBe(true);
  });
});
