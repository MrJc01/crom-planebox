// Barra de ar e causa da morte — itens 126 e 143.
//
// Duas coisas que o jogo já calculava e não mostrava. O afogamento tinha três segundos cravados
// dentro do `update` e nenhum indicador: o jogador mergulhava e o dano simplesmente começava, e a
// única forma de aprender o limite era morrer nele.
//
// E `onDeath(cause)` sempre entregou a causa — o `main` a recebia como `() => {}` e a descartava na
// assinatura. Sete causas calculadas com cuidado viravam a mesma tela.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  SurvivalSystem,
  RESERVA_DE_AR_S,
  RECUPERACAO_DE_AR_S,
} from '../../src/game/SurvivalSystem';
import { textoDaMorte, descreverMorte, causaConhecida, CausaDaMorte } from '../../src/game/causaDaMorte';

/** Um controlador de jogador de mentira, só com o que o `SurvivalSystem` lê. */
function jogador(over: Record<string, unknown> = {}) {
  return {
    onGround: true, lastImpactVelY: 0,
    headUnder: false, inWater: false, inLava: false,
    ...over,
  } as any;
}

function correr(s: SurvivalSystem, segundos: number, passo = 1 / 60) {
  for (let t = 0; t < segundos / passo; t++) s.update(passo);
}

describe('a reserva de ar — item 126', () => {
  it('CRÍTICO: submergir gasta o ar, e o dano só começa quando ele acaba', () => {
    const p = jogador({ headUnder: true });
    const s = new SurvivalSystem(p);
    correr(s, RESERVA_DE_AR_S - 1);
    expect(s.ar).toBeGreaterThan(0);
    expect(s.health).toBe(100); // ainda intacto: a reserva é aviso, não carência secreta
    correr(s, 2);
    expect(s.ar).toBe(0);
    expect(s.health).toBeLessThan(100);
  });

  it('CRÍTICO: a reserva é longa o bastante para a barra ser legível', () => {
    // Com três segundos, cada bolha vale 0,3 s: a barra pula de cheia a vazia sem passar pelo meio,
    // que é exatamente a informação que ela existe para dar.
    expect(RESERVA_DE_AR_S).toBeGreaterThanOrEqual(8);
  });

  it('CRÍTICO: sair da água recupera o ar', () => {
    const p = jogador({ headUnder: true });
    const s = new SurvivalSystem(p);
    correr(s, RESERVA_DE_AR_S * 0.6);
    const noFundo = s.ar;
    expect(noFundo).toBeLessThan(1);
    p.headUnder = false;
    correr(s, RECUPERACAO_DE_AR_S + 0.5);
    expect(s.ar).toBe(1);
  });

  it('recuperar é mais rápido que gastar', () => {
    // Subir para respirar tem de ser uma pausa curta, senão atravessar um lago vira uma sequência
    // de esperas. O que custa é a descida, não a respirada.
    expect(RECUPERACAO_DE_AR_S).toBeLessThan(RESERVA_DE_AR_S);
  });

  it('CRÍTICO: o ar nunca sai de 0..1', () => {
    // Sem matar o jogador no caminho: com `alive = false` o `update` sai cedo e o ar fica parado —
    // o que está certo, e o que fez a primeira versão deste teste reprovar. Quem devolve o ar de um
    // morto é o `reset`, testado logo abaixo.
    const p = jogador({ headUnder: true });
    const s = new SurvivalSystem(p);
    correr(s, RESERVA_DE_AR_S + 4);
    expect(s.alive).toBe(true);
    expect(s.ar).toBe(0);
    p.headUnder = false;
    correr(s, RECUPERACAO_DE_AR_S * 3);
    expect(s.ar).toBe(1);
  });

  it('CRÍTICO: renascer devolve o ar cheio', () => {
    // Sem isto, quem morre afogado renasce sem ar e leva dano no spawn — uma morte em cadeia que
    // parece um travamento do jogo.
    const p = jogador({ headUnder: true });
    const s = new SurvivalSystem(p);
    correr(s, RESERVA_DE_AR_S + 1);
    expect(s.ar).toBe(0);
    s.reset();
    expect(s.ar).toBe(1);
  });

  it('a mudança de ar avisa a HUD', () => {
    // Sem `onChanged`, a barra só atualizaria quando outra coisa mudasse — e ficaria congelada
    // durante um mergulho tranquilo, que é justamente quando ela importa.
    const p = jogador({ headUnder: true });
    const s = new SurvivalSystem(p);
    let avisos = 0;
    s.onChanged = () => { avisos++; };
    correr(s, 1);
    expect(avisos).toBeGreaterThan(0);
  });

  it('a morte por falta de ar tem a causa certa', () => {
    const p = jogador({ headUnder: true });
    const s = new SurvivalSystem(p);
    let causa = '';
    s.onDeath = (c) => { causa = c; };
    correr(s, RESERVA_DE_AR_S + 20);
    expect(causa).toBe('afogamento');
  });
});

describe('a causa da morte vira frase — item 143', () => {
  const TODAS: CausaDaMorte[] = ['queda', 'afogamento', 'lava', 'queimadura', 'fome', 'criatura', 'desconhecida'];

  it('CRÍTICO: toda causa tem uma frase própria, e nenhuma se repete', () => {
    // Se duas causas caíssem no mesmo texto, o sistema existiria e o jogador continuaria sem saber
    // do que morreu — que é o estado que o item descreve.
    const frases = TODAS.map((c) => descreverMorte(c).frase);
    expect(new Set(frases).size).toBe(TODAS.length);
    for (const f of frases) expect(f.length).toBeGreaterThan(8);
  });

  it('CRÍTICO: a queimadura explica que só a água apaga', () => {
    // A causa mais invisível de todas: mata **depois** de sair da lava, longe dela, e nada na tela
    // liga uma coisa à outra.
    const d = descreverMorte('queimadura');
    expect(d.dica).toBeDefined();
    expect(d.dica).toMatch(/água/i);
  });

  it('CRÍTICO: uma causa desconhecida não deixa a tela sem explicação', () => {
    // Um mod pode chamar `applyDamage` com qualquer string. "Você morreu" é pior que a frase certa
    // e muito melhor que o nada que havia.
    expect(causaConhecida('inventada-por-mod')).toBe('desconhecida');
    expect(causaConhecida(undefined)).toBe('desconhecida');
    expect(textoDaMorte('inventada-por-mod')).toMatch(/Você morreu/);
    expect(textoDaMorte(undefined).length).toBeGreaterThan(5);
  });

  it('as frases são na segunda pessoa', () => {
    // "Você se afogou" e não "Morte por afogamento". A segunda é um rótulo de sistema; a primeira é
    // o que aconteceu com você.
    for (const c of TODAS) expect(descreverMorte(c).frase, c).toMatch(/^Você/);
  });

  it('só há dica onde há algo que o jogador possa não saber', () => {
    // Uma dica óbvia ensina que as dicas não valem a pena ler, e a partir daí ele para de ler
    // todas — inclusive as que importam.
    expect(descreverMorte('queda').dica).toBeUndefined();
    expect(descreverMorte('lava').dica).toBeUndefined();
    expect(descreverMorte('fome').dica).toBeDefined();
  });

  it('`textoDaMorte` junta frase e dica sem sobrar espaço', () => {
    expect(textoDaMorte('queda')).toBe('Você caiu de muito alto.');
    expect(textoDaMorte('fome')).toMatch(/^Você morreu de fome\. \S/);
  });
});

describe('a fiação existe — código presente não é código ativo', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  const hud = readFileSync('src/ui/HUD.ts', 'utf8');
  const survival = readFileSync('src/game/SurvivalSystem.ts', 'utf8');

  it('CRÍTICO: `onDeath` recebe a causa em vez de descartá-la', () => {
    // O defeito exato do item: o parâmetro chegava e morria na assinatura `() => {}`.
    expect(main).toMatch(/survivalSystem\.onDeath = \(causa\) =>/);
    expect(main).toMatch(/textoDaMorte\(causa\)/);
  });

  it('CRÍTICO: o dano de criatura usa a chave que `causaDaMorte` conhece', () => {
    // `'ataque inimigo'` cairia no texto genérico, e nada reprovaria — dois nomes para a mesma
    // coisa é como a tela de morte volta a ser muda sem ninguém notar.
    expect(main).toMatch(/applyDamage\(danoRecebido, 'criatura'\)/);
    expect(causaConhecida('criatura')).toBe('criatura');
  });

  it('CRÍTICO: os dois caminhos de morte mostram a causa', () => {
    // Com itens largados e sem itens largados. Cobrir só um deixaria metade das mortes mudas,
    // dependendo do modo de penalidade do mundo.
    const trecho = main.slice(main.indexOf('survivalSystem.onDeath'), main.indexOf('survivalSystem.onDeath') + 2500);
    expect((trecho.match(/textoDaMorte\(causa\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('CRÍTICO: a HUD recebe o ar todo quadro', () => {
    expect(main).toMatch(/hud\.updateAr\(survivalSystem\.ar\)/);
  });

  it('CRÍTICO: a barra de ar some quando o ar está cheio', () => {
    // Um indicador permanente vira ruído. O que aparece por causa de alguma coisa é lido.
    expect(hud).toMatch(/if \(ar >= 0\.999\)/);
    expect(hud).toMatch(/this\.arEl\.style\.display = 'none'/);
  });

  it('a bolha é ícone, não emoji', () => {
    expect(hud).toMatch(/iconeVital\('bolha'/);
    expect(hud).not.toMatch(/🫧|💧|💀/);
  });

  it('o `airTime` privado não sobreviveu ao lado do novo campo', () => {
    // Dois relógios de ar, um mostrado e outro decidindo o dano, divergiriam em silêncio. A busca é
    // por USO e não pela palavra: ela continua no comentário que explica de onde o campo veio.
    expect(survival).not.toMatch(/this\.airTime/);
    expect(survival).not.toMatch(/private airTime/);
  });
});
