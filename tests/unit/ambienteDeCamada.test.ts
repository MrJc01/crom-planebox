// Som de ambiente por camada — item 1438.
//
// A névoa mudou de cor ao descer e a luz parou de seguir o sol, e o silêncio continuou idêntico em
// toda profundidade. Metade do "onde estou" é sonora: uma caverna silenciosa não é uma caverna, é
// um corredor com a luz apagada.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  AMBIENTES,
  avancarAmbiente,
  criarEstadoDoAmbiente,
} from '../../src/audio/ambienteDeCamada';
import { CAMADAS } from '../../src/world/camadas';
import { FOOTSTEP_MAX_DURATION } from '../../src/audio/synth';

/** Sorteio fixo, para o teste não depender de estatística. */
const meio = () => 0.5;

/** Roda `segundos` de jogo a 60 fps e devolve todos os sons disparados. */
function correr(camada: any, segundos: number, sorteio = meio) {
  const e = criarEstadoDoAmbiente();
  const sons = [];
  for (let t = 0; t < segundos * 60; t++) {
    const s = avancarAmbiente(e, camada, 1 / 60, sorteio);
    if (s) sons.push(s);
  }
  return sons;
}

describe('cada profundidade soa diferente', () => {
  it('CRÍTICO: a superfície continua muda — quem manda lá é o bioma', () => {
    // Sobrepor um som de camada em cima apagaria a diferença entre o deserto e a taiga que o
    // sistema de biomas existe para criar. É o mesmo motivo pelo qual a superfície não impõe névoa.
    expect(AMBIENTES.superficie).toBeUndefined();
    expect(correr('superficie', 300)).toHaveLength(0);
  });

  it('CRÍTICO: subsolo, caverna e abismo soam, e nenhum deles soa igual ao outro', () => {
    for (const id of ['subsolo', 'caverna', 'abismo'] as const) {
      expect(correr(id, 120).length, id).toBeGreaterThan(0);
    }
    const assinatura = (id: any) =>
      AMBIENTES[id]!.sons.map((s) => `${s.freq}/${s.filterHz}`).join(',');
    const vistas = new Set(['subsolo', 'caverna', 'abismo'].map(assinatura));
    expect(vistas.size).toBe(3);
  });

  it('CRÍTICO: descer aumenta o ritmo — o abismo fala mais que o subsolo', () => {
    // O ritmo acompanha o `perigo` das camadas de propósito: é a mesma informação que o spawner
    // usa, entregue por um canal que o jogador não precisa abrir nenhum painel para ler.
    const conta = (id: any) => correr(id, 600).length;
    expect(conta('abismo')).toBeGreaterThan(conta('caverna'));
    expect(conta('caverna')).toBeGreaterThan(conta('subsolo'));
  });

  it('o ritmo segue a ordem de perigo declarada nas camadas', () => {
    // Se alguém reordenar `CAMADAS` ou mexer no perigo sem mexer aqui, as duas leituras da mesma
    // ideia divergem em silêncio: o abismo passaria a gerar mais mobs e falar menos.
    const comAmbiente = CAMADAS.filter((c) => AMBIENTES[c.id]);
    for (let i = 1; i < comAmbiente.length; i++) {
      const anterior = AMBIENTES[comAmbiente[i - 1].id]!;
      const atual = AMBIENTES[comAmbiente[i].id]!;
      expect(comAmbiente[i].perigo).toBeGreaterThan(comAmbiente[i - 1].perigo);
      expect(atual.intervalo[1], comAmbiente[i].id).toBeLessThan(anterior.intervalo[1]);
    }
  });
});

describe('o relógio não vira um metrônomo nem um gatilho', () => {
  it('CRÍTICO: o intervalo é sorteado, não fixo', () => {
    // Um período fixo é reconhecível como laço em três repetições, e a partir daí o som deixa de
    // ser ambiente e vira uma batida.
    let n = 0;
    const variando = () => ((n++ * 0.37) % 1);
    const e = criarEstadoDoAmbiente();
    const esperas: number[] = [];
    let desde = 0;
    for (let t = 0; t < 60 * 600; t++) {
      desde += 1 / 60;
      if (avancarAmbiente(e, 'caverna', 1 / 60, variando)) { esperas.push(desde); desde = 0; }
    }
    expect(esperas.length).toBeGreaterThan(10);
    expect(new Set(esperas.map((s) => s.toFixed(1))).size).toBeGreaterThan(3);
  });

  it('CRÍTICO: trocar de camada nunca ESTICA o relógio', () => {
    // Sem isto, quem sobe e desce um degrau adiaria o ambiente para sempre de graça.
    const e = criarEstadoDoAmbiente();
    avancarAmbiente(e, 'abismo', 1 / 60, meio); // arma no intervalo curto do fundo
    const curto = e.restante;
    avancarAmbiente(e, 'subsolo', 1 / 60, meio); // subsolo espera muito mais
    expect(e.camada).toBe('subsolo');
    expect(e.restante).toBeLessThanOrEqual(curto);
  });

  it('CRÍTICO: andar EM CIMA de uma fronteira não silencia o ambiente', () => {
    // O buraco da primeira versão, que passou verde. Um piso a exatamente catorze metros troca de
    // camada a cada quadro; com o relógio reiniciado a cada troca ele nunca chegaria a zero, e o
    // ambiente ficaria mudo justamente onde deveria estar trocando de identidade — um sintoma
    // indistinguível de "o áudio não está ligado".
    const e = criarEstadoDoAmbiente();
    let sons = 0;
    for (let t = 0; t < 60 * 300; t++) {
      const id = t % 2 === 0 ? 'caverna' : 'abismo';
      if (avancarAmbiente(e, id, 1 / 60, meio)) sons++;
    }
    expect(sons).toBeGreaterThan(0);
  });

  it('CRÍTICO: oscilar na fronteira não vira rajada', () => {
    // O outro lado da mesma moeda: depois de disparar, o relógio é rearmado por inteiro, então
    // nenhuma quantidade de vaivém produz sons em sequência.
    const e = criarEstadoDoAmbiente();
    let sons = 0;
    let seguidos = 0, pior = 0;
    for (let t = 0; t < 60 * 300; t++) {
      const id = t % 2 === 0 ? 'caverna' : 'abismo';
      if (avancarAmbiente(e, id, 1 / 60, meio)) { sons++; seguidos++; pior = Math.max(pior, seguidos); }
      else seguidos = 0;
    }
    expect(pior).toBe(1);
    expect(sons).toBeLessThan(300 / 6); // nunca mais denso que o intervalo mínimo do abismo
  });

  it('CRÍTICO: voltar de uma aba em segundo plano não dispara o som na hora', () => {
    // `dt` volta com dezenas de segundos, e sem limite o ambiente seria a única coisa que o jogador
    // notaria no engasgo em que a janela retoma.
    const e = criarEstadoDoAmbiente();
    avancarAmbiente(e, 'abismo', 1 / 60, meio); // arma
    expect(avancarAmbiente(e, 'abismo', 45, meio)).toBeNull();
  });

  it('`dt` negativo não anda para trás nem trava o relógio', () => {
    const e = criarEstadoDoAmbiente();
    avancarAmbiente(e, 'abismo', 1 / 60, meio);
    const antes = e.restante;
    avancarAmbiente(e, 'abismo', -10, meio);
    expect(e.restante).toBe(antes);
  });

  it('sair para a superfície esquece o relógio', () => {
    // Voltar a descer tem de começar com uma espera inteira. Manter o restante faria a primeira
    // descida do dia soar no instante em que o jogador cruza os seis metros.
    const e = criarEstadoDoAmbiente();
    for (let t = 0; t < 60 * 30; t++) avancarAmbiente(e, 'caverna', 1 / 60, meio);
    avancarAmbiente(e, 'superficie', 1 / 60, meio);
    expect(e.camada).toBeNull();
    expect(avancarAmbiente(e, 'caverna', 1 / 60, meio)).toBeNull();
  });

  it('o sorteio no limite superior não estoura o índice dos sons', () => {
    // `Math.floor(1 * n)` é `n`, um a mais que o último índice. Um `sorteio` que devolva 1 é legal
    // e devolveria `undefined` — que o `play` receberia sem reclamar, tocando silêncio para sempre.
    for (const id of ['subsolo', 'caverna', 'abismo'] as const) {
      const e = criarEstadoDoAmbiente();
      let som = null;
      for (let t = 0; t < 60 * 600 && !som; t++) som = avancarAmbiente(e, id, 1 / 60, () => 1);
      expect(som, id).not.toBeNull();
      expect(som!.freq, id).toBeGreaterThan(0);
    }
  });
});

describe('as especificações são tocáveis', () => {
  it('CRÍTICO: nenhum som de ambiente é mais alto que um passo', () => {
    // Ambiente que compete com o som de ação é ruído. `ambient` já sai a 0,6 do master, e um ganho
    // alto aqui atravessaria isso.
    for (const a of Object.values(AMBIENTES)) {
      for (const s of a!.sons) expect(s.gain).toBeLessThanOrEqual(0.3);
    }
  });

  it('todos os campos obrigatórios de `SoundSpec` estão preenchidos e em faixa válida', () => {
    for (const [id, a] of Object.entries(AMBIENTES)) {
      for (const s of a!.sons) {
        expect(s.freq, id).toBeGreaterThan(0);
        expect(s.duration, id).toBeGreaterThan(0);
        expect(s.noise, id).toBeGreaterThanOrEqual(0);
        expect(s.noise, id).toBeLessThanOrEqual(1);
        expect(s.filterHz, id).toBeGreaterThan(0);
        expect(s.attack, id).toBeLessThan(s.duration);
        // Ambiente é longo por definição; um som mais curto que um passo soaria como efeito.
        expect(s.duration, id).toBeGreaterThan(FOOTSTEP_MAX_DURATION);
      }
    }
  });

  it('os intervalos são crescentes e não degeneram', () => {
    for (const [id, a] of Object.entries(AMBIENTES)) {
      expect(a!.intervalo[0], id).toBeGreaterThan(0);
      expect(a!.intervalo[1], id).toBeGreaterThan(a!.intervalo[0]);
    }
  });
});

describe('a fiação existe — código presente não é código ativo', () => {
  const main = readFileSync('src/main.ts', 'utf8');

  it('CRÍTICO: o laço de quadro chama `avancarAmbiente` e toca o resultado', () => {
    // O modo de falha desta casa. O módulo existiria, teria doze testes verdes, e o jogo seguiria
    // mudo — sem nada reprovando, porque nenhum teste de lógica ouve.
    expect(main).toMatch(/avancarAmbiente\(estadoDoAmbiente,\s*camadaAqui\.id,\s*dt\)/);
    expect(main).toMatch(/audio\.play\(somDaCamada,\s*\{\s*channel:\s*'ambient'/);
  });

  it('o estado é criado uma vez, fora do laço', () => {
    // Criá-lo dentro do laço zeraria o relógio a cada quadro: nunca soaria nada, e o sintoma seria
    // indistinguível de "o áudio não está ligado".
    expect(main).toMatch(/const estadoDoAmbiente = criarEstadoDoAmbiente\(\);/);
  });
});
