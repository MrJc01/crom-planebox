import { describe, it, expect } from 'vitest';
import {
  ATRASO_ENTRE_CHUNKS,
  FADE_DURACAO,
  FadeAgenda,
  suavizar,
} from '../../src/render/chunkFade';

/** Avança o relógio em passos de quadro, como o jogo faz. */
function correr(a: FadeAgenda, segundos: number, dt = 1 / 60): void {
  for (let t = 0; t < segundos; t += dt) a.update(dt);
}

describe('suavizar — a curva', () => {
  it('vai de 0 a 1 e nunca sai da faixa', () => {
    expect(suavizar(0)).toBe(0);
    expect(suavizar(1)).toBe(1);
    for (let t = -1; t <= 2; t += 0.05) {
      expect(suavizar(t)).toBeGreaterThanOrEqual(0);
      expect(suavizar(t)).toBeLessThanOrEqual(1);
    }
  });

  it('é monotônica', () => {
    let ant = -1;
    for (let t = 0; t <= 1; t += 0.01) {
      const v = suavizar(t);
      expect(v).toBeGreaterThanOrEqual(ant);
      ant = v;
    }
  });

  it('começa rápido e desacelera — linear pareceria mecânico', () => {
    expect(suavizar(0.5)).toBeGreaterThan(0.5);
    const inicio = suavizar(0.1) - suavizar(0);
    const fim = suavizar(1) - suavizar(0.9);
    expect(inicio).toBeGreaterThan(fim);
  });
});

describe('FadeAgenda — o ciclo de vida de um chunk', () => {
  it('CRÍTICO: todo chunk que começa a aparecer TERMINA de aparecer', () => {
    // Um chunk que não termina fica meio desenhado para sempre, e o jogador vê o mundo furado.
    const a = new FadeAgenda();
    for (let i = 0; i < 30; i++) a.registrar(`c${i}`);
    correr(a, FADE_DURACAO + ATRASO_ENTRE_CHUNKS * 30 + 1);
    expect(a.aparecendo).toBe(0);
    for (let i = 0; i < 30; i++) expect(a.progresso(`c${i}`)).toBe(1);
  });

  it('CRÍTICO: re-mesh não reinicia a animação', () => {
    // Sem isto o chunk pisca a cada bloco que o jogador coloca.
    const a = new FadeAgenda();
    expect(a.registrar('c')).toBe(true);
    correr(a, FADE_DURACAO + 0.1);
    expect(a.registrar('c')).toBe(false);
    expect(a.aparecendo).toBe(0);
  });

  it('re-mesh no MEIO da animação também não reinicia', () => {
    const a = new FadeAgenda();
    a.registrar('c');
    correr(a, FADE_DURACAO / 2);
    const meio = a.progresso('c');
    expect(a.registrar('c')).toBe(false);
    expect(a.progresso('c')).toBeCloseTo(meio, 6);
  });

  it('o progresso cresce de 0 a 1 sem voltar', () => {
    const a = new FadeAgenda();
    a.registrar('c');
    let ant = 0;
    for (let i = 0; i < 100; i++) {
      a.update(0.01);
      const p = a.progresso('c');
      expect(p).toBeGreaterThanOrEqual(ant);
      ant = p;
    }
    expect(ant).toBe(1);
  });

  it('chave desconhecida vale 1 — o padrão seguro é "visível"', () => {
    // Um erro de contabilidade deve sumir com o EFEITO, nunca com o terreno.
    const a = new FadeAgenda();
    expect(a.progresso('nunca-visto')).toBe(1);
    expect(a.estaAparecendo('nunca-visto')).toBe(false);
  });

  it('avisa uma vez, e só uma, quando um chunk termina', () => {
    const a = new FadeAgenda();
    a.registrar('c');
    let avisos = 0;
    for (let i = 0; i < 200; i++) {
      a.update(0.01);
      avisos += a.terminados().filter((k) => k === 'c').length;
    }
    expect(avisos).toBe(1);
  });

  it('a lista de terminados é limpa a cada quadro', () => {
    const a = new FadeAgenda();
    a.registrar('c');
    correr(a, FADE_DURACAO + 0.1);
    a.update(0.016);
    expect(a.terminados()).toEqual([]);
  });
});

describe('FadeAgenda — escalonamento', () => {
  it('CRÍTICO: chunks prontos no mesmo quadro não aparecem juntos', () => {
    // Juntos, o efeito lê como um piscar do mundo inteiro em vez de terreno chegando.
    const a = new FadeAgenda();
    for (const k of ['a', 'b', 'c', 'd']) a.registrar(k);
    a.update(1 / 60);
    const progressos = ['a', 'b', 'c', 'd'].map((k) => a.progresso(k));
    expect(new Set(progressos).size).toBeGreaterThan(1);
    // O primeiro está sempre à frente do último.
    expect(progressos[0]).toBeGreaterThan(progressos[3]);
  });

  it('o escalonamento respeita o atraso mínimo', () => {
    const a = new FadeAgenda();
    a.registrar('a');
    a.registrar('b');
    // Depois de exatamente um atraso, 'b' mal começou e 'a' já andou.
    correr(a, ATRASO_ENTRE_CHUNKS, 0.001);
    expect(a.progresso('a')).toBeGreaterThan(0);
    expect(a.progresso('b')).toBeLessThan(a.progresso('a'));
  });

  it('um chunk registrado muito depois não herda a fila antiga', () => {
    const a = new FadeAgenda();
    a.registrar('antigo');
    correr(a, 5);
    a.registrar('novo');
    // Começa agora, não daqui a cinco segundos nem cinco segundos atrás.
    expect(a.progresso('novo')).toBe(0);
    a.update(FADE_DURACAO / 2);
    expect(a.progresso('novo')).toBeGreaterThan(0.4);
  });

  it('uma enxurrada de chunks não empurra o último para o infinito', () => {
    const a = new FadeAgenda();
    for (let i = 0; i < 400; i++) a.registrar(`c${i}`);
    // 400 × 0,045 s = 18 s. É muito, mas é finito e ordenado — e o teste fixa isso como o
    // comportamento esperado, para uma mudança no atraso não passar despercebida.
    correr(a, 400 * ATRASO_ENTRE_CHUNKS + FADE_DURACAO + 1, 0.05);
    expect(a.aparecendo).toBe(0);
  });
});

describe('FadeAgenda — desligar e descarregar', () => {
  it('desligado, nada aparece gradualmente — o terreno entra opaco', () => {
    const a = new FadeAgenda();
    a.ligado = false;
    expect(a.registrar('c')).toBe(false);
    expect(a.progresso('c')).toBe(1);
    expect(a.aparecendo).toBe(0);
  });

  it('CRÍTICO: chunk descarregado e recarregado aparece de novo', () => {
    const a = new FadeAgenda();
    a.registrar('c');
    correr(a, FADE_DURACAO + 0.1);
    a.esquecer('c');
    expect(a.registrar('c')).toBe(true);
  });

  it('esquecer no meio da animação não deixa resíduo', () => {
    const a = new FadeAgenda();
    a.registrar('c');
    correr(a, FADE_DURACAO / 2);
    a.esquecer('c');
    expect(a.aparecendo).toBe(0);
    expect(a.progresso('c')).toBe(1);
  });

  it('limpar zera tudo — trocar de mundo não herda a fila do anterior', () => {
    const a = new FadeAgenda();
    for (let i = 0; i < 10; i++) a.registrar(`c${i}`);
    a.limpar();
    expect(a.aparecendo).toBe(0);
    expect(a.registrar('c0')).toBe(true); // pode aparecer de novo no mundo novo
  });

  it('milhares de ciclos não fazem a agenda crescer sem limite', () => {
    const a = new FadeAgenda();
    for (let i = 0; i < 5000; i++) {
      a.registrar(`c${i % 50}`);
      a.update(0.05);
      a.esquecer(`c${(i + 25) % 50}`);
    }
    expect(a.aparecendo).toBeLessThan(60);
  });
});
