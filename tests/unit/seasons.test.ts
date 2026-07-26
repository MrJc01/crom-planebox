import { describe, it, expect, beforeEach } from 'vitest';
import { pesosDeBioma } from '../../src/world/biomes';
import {
  DIAS_POR_ANO,
  DIAS_POR_ESTACAO,
  ESTACOES,
  EstacaoId,
  PERFIS_PADRAO,
  definirPerfil,
  descreverEstacao,
  estacaoDoDia,
  estadoSazonal,
  limparPerfis,
  perfilDe,
  posicaoNoAno,
  travessia,
} from '../../src/world/seasons';

beforeEach(() => limparPerfis());

/** Pesos de um bioma puro, para isolar o efeito da estação do efeito da mistura. */
function puro(temp: number, moist: number) {
  return pesosDeBioma({ temp, moist, montanha: 0, acimaDoMar: 30 });
}
const FLORESTA = () => puro(0.1, 0.55);
const DESERTO = () => puro(0.9, -0.85);
const TUNDRA = () => puro(-0.75, -0.2);

describe('o calendário fecha', () => {
  it('CRÍTICO: o ciclo volta ao início — como o teste da lua', () => {
    expect(estacaoDoDia(0)).toBe(estacaoDoDia(DIAS_POR_ANO));
    expect(estacaoDoDia(3)).toBe(estacaoDoDia(DIAS_POR_ANO + 3));
    expect(estacaoDoDia(DIAS_POR_ANO * 7 + 5)).toBe(estacaoDoDia(5));
  });

  it('cada estação ocupa exatamente sua fatia do ano', () => {
    for (let i = 0; i < ESTACOES.length; i++) {
      expect(estacaoDoDia(i * DIAS_POR_ESTACAO)).toBe(ESTACOES[i]);
      expect(estacaoDoDia(i * DIAS_POR_ESTACAO + DIAS_POR_ESTACAO - 0.01)).toBe(ESTACOES[i]);
    }
  });

  it('as quatro estações aparecem ao longo de um ano', () => {
    const vistas = new Set<EstacaoId>();
    for (let d = 0; d < DIAS_POR_ANO; d += 0.5) vistas.add(estacaoDoDia(d));
    expect(vistas.size).toBe(ESTACOES.length);
  });

  it('dia negativo não quebra o calendário', () => {
    for (const d of [-1, -9, -DIAS_POR_ANO, -100.5]) {
      expect(ESTACOES).toContain(estacaoDoDia(d));
      expect(posicaoNoAno(d)).toBeGreaterThanOrEqual(0);
      expect(posicaoNoAno(d)).toBeLessThan(1);
    }
  });
});

describe('travessia — interpolação, não degrau', () => {
  it('CRÍTICO: o coração da estação NÃO é uma média perpétua', () => {
    // Sem o platô, o meio do outono seria meio verão e meio inverno, e nenhuma estação teria
    // caráter próprio — que é o oposto do pedido.
    for (let i = 0; i < ESTACOES.length; i++) {
      expect(travessia(i * DIAS_POR_ESTACAO + 1).t).toBe(0);
    }
  });

  it('a travessia acontece no fim da estação e completa na troca', () => {
    const fim = DIAS_POR_ESTACAO - 0.001;
    expect(travessia(fim).t).toBeGreaterThan(0.9);
    expect(travessia(DIAS_POR_ESTACAO * 0.8).t).toBeGreaterThan(0);
    expect(travessia(DIAS_POR_ESTACAO * 0.8).t).toBeLessThan(1);
  });

  it('a estação seguinte é sempre a próxima do ciclo, dando a volta', () => {
    expect(travessia(0).para).toBe(ESTACOES[1]);
    expect(travessia(DIAS_POR_ANO - 0.5).para).toBe(ESTACOES[0]);
  });

  it('CRÍTICO: nenhum efeito dá salto ao longo do ano', () => {
    let ant = estadoSazonal(0, FLORESTA());
    let maior = 0;
    for (let d = 0; d < DIAS_POR_ANO * 2; d += 0.01) {
      const e = estadoSazonal(d, FLORESTA());
      maior = Math.max(maior, Math.abs(e.efeito.folhagem - ant.efeito.folhagem));
      maior = Math.max(maior, Math.abs(e.efeito.temperatura - ant.efeito.temperatura));
      ant = e;
    }
    expect(maior).toBeLessThan(0.01);
  });
});

describe('o bioma manda — configuração sem código', () => {
  it('CRÍTICO: um bioma que ignora estações passa o ano sem efeito nenhum', () => {
    // Requisito textual: selva e deserto não têm estação. Se isto falhasse, o outono pintaria a
    // selva de laranja.
    for (let d = 0; d < DIAS_POR_ANO; d += 0.5) {
      const e = estadoSazonal(d, DESERTO());
      expect(Math.abs(e.efeito.folhagem)).toBeLessThan(0.35);
      expect(e.forca).toBeLessThan(0.4);
    }
  });

  it('a tundra responde forte às estações', () => {
    const inverno = estadoSazonal(DIAS_POR_ESTACAO * 3 + 1, TUNDRA());
    expect(inverno.forca).toBeGreaterThan(0.6);
    expect(inverno.efeito.temperatura).toBeLessThan(-0.15);
  });

  it('CRÍTICO: definirPerfil muda o comportamento sem tocar em código do motor', () => {
    // É o requisito central: a IA cria um bioma com estações próprias declarando uma tabela.
    const antes = perfilDe('floresta', 'inverno').crescimento;
    expect(antes).toBe(0);

    definirPerfil('floresta', { inverno: { crescimento: 0.9 } });

    expect(perfilDe('floresta', 'inverno').crescimento).toBe(0.9);
    // E só o campo declarado muda — o resto continua herdado do padrão.
    expect(perfilDe('floresta', 'inverno').temperatura).toBe(PERFIS_PADRAO.inverno.temperatura);
    // E só o bioma declarado muda.
    expect(perfilDe('taiga', 'inverno').crescimento).toBe(0);
  });

  it('perfis parciais acumulam em vez de se substituírem', () => {
    definirPerfil('floresta', { inverno: { crescimento: 0.5 } });
    definirPerfil('floresta', { inverno: { neve: 4 } });
    const p = perfilDe('floresta', 'inverno');
    expect(p.crescimento).toBe(0.5);
    expect(p.neve).toBe(4);
  });

  it('declarar uma estação não afeta as outras', () => {
    definirPerfil('floresta', { verao: { temperatura: 9 } });
    expect(perfilDe('floresta', 'verao').temperatura).toBe(9);
    expect(perfilDe('floresta', 'inverno').temperatura).toBe(PERFIS_PADRAO.inverno.temperatura);
  });

  it('limparPerfis devolve tudo ao padrão — trocar de mundo não herda mods do anterior', () => {
    definirPerfil('floresta', { inverno: { crescimento: 0.9 } });
    limparPerfis();
    expect(perfilDe('floresta', 'inverno').crescimento).toBe(PERFIS_PADRAO.inverno.crescimento);
  });

  it('um bioma sem perfil declarado não quebra nada — o padrão precisa existir', () => {
    for (const est of ESTACOES) {
      const p = perfilDe('praia', est);
      expect(Number.isFinite(p.crescimento)).toBe(true);
      expect(Number.isFinite(p.folhagem)).toBe(true);
    }
  });
});

describe('estadoSazonal — as invariantes de quem consome', () => {
  it('todo campo é finito, em qualquer dia e qualquer bioma', () => {
    const cenarios = [FLORESTA(), DESERTO(), TUNDRA(), puro(0.5, 0.5), []];
    for (const pesos of cenarios) {
      for (let d = -20; d < DIAS_POR_ANO * 2; d += 0.7) {
        const e = estadoSazonal(d, pesos);
        for (const v of Object.values(e.efeito)) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('CRÍTICO: crescimento e duração do dia nunca ficam negativos', () => {
    // Crescimento negativo faria plantas encolherem; duração negativa inverteria o dia.
    for (let d = 0; d < DIAS_POR_ANO * 2; d += 0.13) {
      for (const pesos of [FLORESTA(), TUNDRA(), DESERTO()]) {
        const e = estadoSazonal(d, pesos);
        expect(e.efeito.crescimento).toBeGreaterThanOrEqual(0);
        expect(e.efeito.duracaoDoDia).toBeGreaterThan(0.5);
        expect(e.efeito.neve).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('lista de pesos vazia devolve o neutro em vez de estourar', () => {
    const e = estadoSazonal(5, []);
    expect(e.efeito.crescimento).toBe(1);
    expect(e.efeito.folhagem).toBe(0);
  });

  it('a fronteira entre dois biomas tem uma estação intermediária', () => {
    // Meio do caminho entre tundra (sazonal) e algo temperado: nem o inverno de um, nem o do
    // outro. É o que faz a fronteira não ter linha.
    const meio = pesosDeBioma({ temp: -0.35, moist: 0.1, montanha: 0, acimaDoMar: 30 });
    const dia = DIAS_POR_ESTACAO * 3 + 1;
    const t = estadoSazonal(dia, TUNDRA()).efeito.temperatura;
    const m = estadoSazonal(dia, meio).efeito.temperatura;
    const d = estadoSazonal(dia, DESERTO()).efeito.temperatura;
    expect(m).toBeGreaterThan(Math.min(t, d) - 1e-9);
    expect(m).toBeLessThan(Math.max(t, d) + 1e-9);
  });

  it('o inverno é mais frio que o verão, em todo bioma sazonal', () => {
    for (const pesos of [FLORESTA(), TUNDRA()]) {
      const verao = estadoSazonal(DIAS_POR_ESTACAO * 1 + 1, pesos).efeito.temperatura;
      const inverno = estadoSazonal(DIAS_POR_ESTACAO * 3 + 1, pesos).efeito.temperatura;
      expect(inverno).toBeLessThan(verao);
    }
  });

  it('o outono é a estação que mais puxa a folhagem para o quente', () => {
    const p = FLORESTA();
    const outono = estadoSazonal(DIAS_POR_ESTACAO * 2 + 1, p).efeito.folhagem;
    for (const i of [0, 1, 3]) {
      expect(outono).toBeGreaterThan(estadoSazonal(DIAS_POR_ESTACAO * i + 1, p).efeito.folhagem);
    }
  });

  it('a descrição mostra a travessia só quando há uma', () => {
    expect(descreverEstacao(estadoSazonal(1, FLORESTA()))).not.toContain('→');
    expect(descreverEstacao(estadoSazonal(DIAS_POR_ESTACAO - 0.2, FLORESTA()))).toContain('→');
  });
});
