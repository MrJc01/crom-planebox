// A única porta de rede que um mod tem — itens 763, 764, 767 e 768.
//
// O script roda num Worker sem `fetch`. A única forma de alcançar a rede é pedindo à ponte, e a
// ponte chega aqui — não por disciplina, mas porque o outro reino não tem nada com que abrir um
// segundo caminho.

import { describe, it, expect, vi } from 'vitest';
import { RedeDeMods, RegistroDeChamada, caminhoDe } from '../../src/mods/RedeDeMods';
import { MAX_BYTES_DE_RESPOSTA, VERSAO_DO_MANIFESTO } from '../../src/mods/capacidades';

const MANIFESTO = {
  versao: VERSAO_DO_MANIFESTO,
  rede: { hosts: ['api.clima.com'], motivo: 'buscar a previsão do tempo da cidade do jogador' },
};

function montar(over: Partial<{
  manifesto: any;
  consentidos: string[];
  responder: (ok: boolean) => void;
  resposta: Partial<Response> & { text?: () => Promise<string> };
}> = {}) {
  const log: RegistroDeChamada[] = [];
  const perguntas: Array<{ host: string; motivo: string; envia: boolean }> = [];
  let responderCom = true;

  const resp = {
    status: 200, ok: true,
    text: async () => '{"temp":21}',
    ...(over.resposta ?? {}),
  } as Response;

  const buscar = vi.fn(async () => resp) as unknown as typeof fetch;

  const rede = new RedeDeMods({
    manifestoDe: () => ('manifesto' in over ? over.manifesto : MANIFESTO),
    hostsConsentidos: () => over.consentidos ?? ['api.clima.com'],
    pedirConsentimento: async (_m, host, motivo, envia) => {
      perguntas.push({ host, motivo, envia });
      return responderCom;
    },
    registrar: (l) => log.push(l),
    buscar,
    agora: () => 1_000,
  });

  return { rede, log, perguntas, buscar, negar: () => { responderCom = false; } };
}

describe('a chamada que passa', () => {
  it('CRÍTICO: host declarado e consentido chega ao fetch', async () => {
    const { rede, buscar } = montar();
    const r = await rede.chamar('m1', 'https://api.clima.com/v1/agora');
    expect(r).toMatchObject({ status: 200, ok: true, texto: '{"temp":21}' });
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('CRÍTICO: não segue redirecionamento', async () => {
    // A linha que mais importa depois da allowlist. Com `follow`, um host autorizado poderia
    // redirecionar para um host NÃO autorizado, e o conteúdo dele voltaria ao mod como se fosse do
    // host permitido — a allowlist seria contornável por quem controla o servidor que ela autoriza.
    const { rede, buscar } = montar();
    await rede.chamar('m1', 'https://api.clima.com/x');
    expect((buscar as any).mock.calls[0][1]).toMatchObject({ redirect: 'error' });
  });

  it('CRÍTICO: não manda credenciais do jogador', async () => {
    // A chamada é do mod, não do jogador. Mandar cookies de sessão faria o mod agir em nome dele em
    // qualquer serviço onde ele esteja logado.
    const { rede, buscar } = montar();
    await rede.chamar('m1', 'https://api.clima.com/x');
    expect((buscar as any).mock.calls[0][1]).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
  });
});

describe('as quatro recusas, nesta ordem', () => {
  it('CRÍTICO: host fora do manifesto é recusado', async () => {
    const { rede } = montar();
    await expect(rede.chamar('m1', 'https://outro.net/x')).rejects.toThrow(/outro\.net/);
  });

  it('CRÍTICO: host não declarado NÃO gera pergunta ao jogador', async () => {
    // A pergunta é a operação mais cara que existe aqui — interrompe a partida. Perguntar por um
    // host que o manifesto nem declara ensinaria ao jogador que o manifesto não significa nada.
    const { rede, perguntas } = montar({ consentidos: [] });
    await expect(rede.chamar('m1', 'https://outro.net/x')).rejects.toThrow();
    expect(perguntas).toEqual([]);
  });

  it('CRÍTICO: declarado mas não consentido pergunta, e o "não" barra', async () => {
    const { rede, perguntas, negar, buscar } = montar({ consentidos: [] });
    negar();
    await expect(rede.chamar('m1', 'https://api.clima.com/x')).rejects.toThrow(/não autorizou/);
    expect(perguntas[0]).toMatchObject({ host: 'api.clima.com', envia: false });
    expect(buscar).not.toHaveBeenCalled();
  });

  it('o "sim" deixa passar', async () => {
    const { rede, buscar } = montar({ consentidos: [] });
    await rede.chamar('m1', 'https://api.clima.com/x');
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('CRÍTICO: POST sem `rede.envia` é recusado', async () => {
    // A permissão de falar com um endereço não é a de contar coisas para ele.
    const { rede } = montar();
    await expect(rede.chamar('m1', 'https://api.clima.com/x', { metodo: 'POST', corpo: '{}' }))
      .rejects.toThrow(/envia/);
  });

  it('POST com `rede.envia` passa', async () => {
    const { rede, buscar } = montar({
      manifesto: { ...MANIFESTO, rede: { ...MANIFESTO.rede, envia: true } },
    });
    await rede.chamar('m1', 'https://api.clima.com/x', { metodo: 'POST', corpo: '{}' });
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('CRÍTICO: mod sem manifesto não alcança nada', async () => {
    // O padrão de quem não declarou é o mesmo de quem declarou nada: sem rede. Não há regra própria
    // para isso — a lista vazia já recusa tudo.
    const { rede } = montar({ manifesto: undefined });
    await expect(rede.chamar('m1', 'https://api.clima.com/x')).rejects.toThrow();
  });
});

describe('a pergunta não vira enxurrada', () => {
  it('CRÍTICO: três chamadas ao mesmo host no mesmo instante perguntam UMA vez', async () => {
    // Três caixas de diálogo idênticas empilhadas seriam clicadas sem leitura a partir da segunda —
    // exatamente o hábito que a permissão declarada existe para evitar.
    const { rede, perguntas } = montar({ consentidos: [] });
    await Promise.all([
      rede.chamar('m1', 'https://api.clima.com/a'),
      rede.chamar('m1', 'https://api.clima.com/b'),
      rede.chamar('m1', 'https://api.clima.com/c'),
    ]);
    expect(perguntas.length).toBe(1);
  });
});

describe('tetos', () => {
  it('CRÍTICO: resposta grande demais é recusada', async () => {
    // O host é autorizado, então nenhuma outra regra a impediria — e um arquivo gigante trava a aba.
    const { rede } = montar({
      resposta: { text: async () => 'x'.repeat(MAX_BYTES_DE_RESPOSTA + 1) },
    });
    await expect(rede.chamar('m1', 'https://api.clima.com/grande')).rejects.toThrow(/limite/);
  });

  it('o tamanho recusado ainda vai para a auditoria', async () => {
    // Recusar e não registrar esconderia justamente a chamada que vale a pena investigar.
    const { rede, log } = montar({
      resposta: { text: async () => 'x'.repeat(MAX_BYTES_DE_RESPOSTA + 1) },
    });
    await expect(rede.chamar('m1', 'https://api.clima.com/grande')).rejects.toThrow();
    expect(log[0]).toMatchObject({ host: 'api.clima.com', recusa: expect.stringContaining('limite') });
  });
});

describe('auditoria — item 768', () => {
  it('CRÍTICO: a chamada bem-sucedida é registrada com host, status e volume', async () => {
    const { rede, log } = montar();
    await rede.chamar('m1', 'https://api.clima.com/v1/agora');
    expect(log[0]).toMatchObject({
      modId: 'm1', host: 'api.clima.com', caminho: '/v1/agora',
      metodo: 'GET', status: 200, bytes: 11,
    });
  });

  it('CRÍTICO: a chamada RECUSADA também é registrada, com o motivo', async () => {
    // Um log que só guarda o que deu certo responde a pergunta errada: quem audita quer ver o que o
    // mod TENTOU, principalmente quando foi barrado.
    const { rede, log } = montar();
    await expect(rede.chamar('m1', 'https://outro.net/x')).rejects.toThrow();
    expect(log[0]).toMatchObject({ host: 'outro.net', status: 0, recusa: expect.any(String) });
  });

  it('CRÍTICO: a query NÃO entra no log', async () => {
    // A query pode conter exatamente o que o mod está mandando para fora. O log existe para o
    // jogador ver com quem o mod falou, não para virar uma segunda cópia dos dados que saíram.
    const { rede, log } = montar();
    await rede.chamar('m1', 'https://api.clima.com/v1?chave=segredo&mundo=inteiro');
    expect(log[0].caminho).toBe('/v1');
    expect(JSON.stringify(log[0])).not.toContain('segredo');
  });

  it('falha de rede é registrada, e o erro chega ao mod', async () => {
    const log: RegistroDeChamada[] = [];
    const rede = new RedeDeMods({
      manifestoDe: () => MANIFESTO,
      hostsConsentidos: () => ['api.clima.com'],
      pedirConsentimento: async () => true,
      registrar: (l) => log.push(l),
      buscar: (async () => { throw new Error('servidor fora do ar'); }) as unknown as typeof fetch,
    });
    await expect(rede.chamar('m1', 'https://api.clima.com/x')).rejects.toThrow(/fora do ar/);
    expect(log[0].recusa).toContain('fora do ar');
  });
});

describe('caminhoDe', () => {
  it('devolve só o caminho', () => {
    expect(caminhoDe('https://x.com/a/b?c=d#e')).toBe('/a/b');
  });

  it('endereço inválido não estoura', () => {
    expect(caminhoDe('nem é url')).toBe('');
  });
});
