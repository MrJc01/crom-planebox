// Voz entre quem está no mesmo mundo — itens 927 a 932.
//
// A `RTCPeerConnection` já existe: é por ela que os blocos e as criaturas viajam. Voz é uma trilha
// de mídia na mesma conexão — sem servidor de voz, sem upload, sem terceiro no caminho.
//
// O microfone é a capacidade mais invasiva que um jogo de navegador pode pedir, e é isso que faz
// destes testes uma lista de garantias e não uma lista de recursos.

import { describe, it, expect, vi } from 'vitest';
import { VozP2P, motivoLegivel } from '../../src/net/VozP2P';

/** Trilha de mentira que registra `enabled` e `stop()`, que é o que os testes precisam ver. */
function trilhaFalsa() {
  return { kind: 'audio', enabled: true, parada: false, stop() { this.parada = true; } };
}

function montar(over: { semTrilha?: boolean; falhar?: unknown } = {}) {
  const trilha = trilhaFalsa();
  const stream = {
    getAudioTracks: () => (over.semTrilha ? [] : [trilha]),
    getTracks: () => (over.semTrilha ? [] : [trilha]),
  } as unknown as MediaStream;

  const chamadas = { pedidos: 0, publicados: 0, despublicados: 0 };
  const voz = new VozP2P({
    pedirMicrofone: async () => {
      chamadas.pedidos++;
      if (over.falhar) throw over.falhar;
      return stream;
    },
    publicar: () => { chamadas.publicados++; return 2; },
    despublicar: () => { chamadas.despublicados++; },
    temPares: () => true,
  });

  const falhas: string[] = [];
  voz.aoFalhar = (m) => falhas.push(m);
  return { voz, trilha, chamadas, falhas };
}

describe('desligado por padrão — item 927', () => {
  it('CRÍTICO: nasce sem microfone e sem transmitir', () => {
    const { voz } = montar();
    expect(voz.estado).toMatchObject({ armado: false, transmitindo: false });
  });

  it('CRÍTICO: construir NÃO pede o microfone — item 930', () => {
    // Pedir no boot faria o navegador mostrar o pedido de permissão antes de o jogador ter qualquer
    // contexto do porquê. A resposta a um pedido sem contexto é "não" — ou, pior, um "sim" que ele
    // não entendeu.
    const { chamadas } = montar();
    expect(chamadas.pedidos).toBe(0);
  });

  it('o dispositivo só é pedido ao alternar', async () => {
    const { voz, chamadas } = montar();
    await voz.alternarMicrofone();
    expect(chamadas.pedidos).toBe(1);
  });
});

describe('armar não é falar — o modo apertar', () => {
  it('CRÍTICO: no modo apertar, ligar o microfone NÃO transmite', async () => {
    // Nascer transmitindo faria o jogador ser ouvido no instante em que ligou o microfone, antes de
    // apertar nada — exatamente o acidente que push-to-talk existe para evitar.
    const { voz, trilha } = montar();
    await voz.alternarMicrofone();
    expect(voz.estado.armado).toBe(true);
    expect(voz.estado.transmitindo).toBe(false);
    expect(trilha.enabled).toBe(false);
  });

  it('CRÍTICO: a tecla liga e desliga a transmissão — item 928', () => {
    const { voz, trilha } = montar();
    return voz.alternarMicrofone().then(() => {
      voz.definirTecla(true);
      expect(voz.estado.transmitindo).toBe(true);
      expect(trilha.enabled).toBe(true);

      voz.definirTecla(false);
      expect(voz.estado.transmitindo).toBe(false);
      expect(trilha.enabled).toBe(false);
    });
  });

  it('CRÍTICO: a tecla NÃO reabre o dispositivo a cada aperto', async () => {
    // Pedir o dispositivo a cada aperto custaria centenas de milissegundos, e a primeira sílaba se
    // perderia sempre. Por isso a trilha vive armada e o que muda é `enabled`.
    const { voz, chamadas, trilha } = montar();
    await voz.alternarMicrofone();
    for (let i = 0; i < 10; i++) { voz.definirTecla(true); voz.definirTecla(false); }
    expect(chamadas.pedidos).toBe(1);
    expect(trilha.parada).toBe(false);
  });

  it('a tecla sem microfone armado não faz nada', () => {
    const { voz } = montar();
    voz.definirTecla(true);
    expect(voz.estado.transmitindo).toBe(false);
  });
});

describe('modo alternado', () => {
  it('ligar o microfone já transmite', async () => {
    const { voz, trilha } = montar();
    voz.definirModo('alternar');
    await voz.alternarMicrofone();
    expect(voz.estado.transmitindo).toBe(true);
    expect(trilha.enabled).toBe(true);
  });

  it('CRÍTICO: trocar para "apertar" com o microfone aberto emudece na hora', async () => {
    // Quem escolheu apertar não espera continuar sendo ouvido só porque estava no outro modo um
    // segundo atrás.
    const { voz, trilha } = montar();
    voz.definirModo('alternar');
    await voz.alternarMicrofone();
    voz.definirModo('apertar');
    expect(voz.estado.transmitindo).toBe(false);
    expect(trilha.enabled).toBe(false);
  });

  it('trocar para "apertar" com a tecla já pressionada mantém a transmissão', () => {
    const { voz } = montar();
    voz.definirModo('alternar');
    return voz.alternarMicrofone().then(() => {
      voz.definirTecla(true);
      voz.definirModo('apertar');
      expect(voz.estado.transmitindo).toBe(true);
    });
  });
});

describe('desligar solta o dispositivo de verdade — item 929', () => {
  it('CRÍTICO: `stop()` é chamado em cada trilha', async () => {
    // É `stop()` que apaga o indicador de gravação do sistema. Só marcar `enabled = false` deixaria
    // o navegador mostrando "esta aba está usando o microfone" para sempre — e um jogador que
    // clicou em desligar e continua vendo o indicador conclui, com razão, que o botão mente.
    const { voz, trilha } = montar();
    await voz.alternarMicrofone();
    await voz.alternarMicrofone();
    expect(trilha.parada).toBe(true);
    expect(voz.estado).toMatchObject({ armado: false, transmitindo: false });
  });

  it('CRÍTICO: a trilha sai das conexões ao desligar — item 932', async () => {
    const { voz, chamadas } = montar();
    await voz.alternarMicrofone();
    await voz.alternarMicrofone();
    expect(chamadas.despublicados).toBe(1);
  });

  it('desarmar duas vezes não estoura nem despublica duas vezes', async () => {
    const { voz, chamadas } = montar();
    await voz.alternarMicrofone();
    voz.desarmar();
    voz.desarmar();
    expect(chamadas.despublicados).toBe(1);
  });
});

describe('a trilha entra na conexão que já existe — item 931', () => {
  it('CRÍTICO: publicar acontece ao armar, e conta os pares alcançados', async () => {
    const { voz, chamadas } = montar();
    await voz.alternarMicrofone();
    expect(chamadas.publicados).toBe(1);
    expect(voz.estado.paresAlcancados).toBe(2);
  });
});

describe('o indicador nunca fica desatualizado', () => {
  it('CRÍTICO: toda mudança de estado avisa', async () => {
    // Um jogo que capta áudio sem mostrar é indistinguível de um que grava escondido. A única forma
    // de o jogador confiar é a informação estar sempre lá — e ela só está se cada transição avisar.
    const { voz } = montar();
    const estados: boolean[] = [];
    voz.aoMudar = (e) => estados.push(e.transmitindo);

    await voz.alternarMicrofone();
    voz.definirTecla(true);
    voz.definirTecla(false);
    voz.desarmar();

    expect(estados).toEqual([false, true, false, false]);
  });
});

describe('falhas dizem o que fazer', () => {
  it('CRÍTICO: permissão negada não deixa o estado "armado"', async () => {
    const { voz, falhas } = montar({ falhar: Object.assign(new Error('x'), { name: 'NotAllowedError' }) });
    await voz.alternarMicrofone();
    expect(voz.estado.armado).toBe(false);
    expect(falhas[0]).toMatch(/permissão/i);
  });

  it('CRÍTICO: stream sem trilha de áudio é tratado como falha', async () => {
    // Um dispositivo que responde e não entrega nada. Tratar como sucesso deixaria o indicador
    // aceso sobre um microfone que não capta.
    const { voz, falhas } = montar({ semTrilha: true });
    await voz.alternarMicrofone();
    expect(voz.estado.armado).toBe(false);
    expect(falhas[0]).toMatch(/microfone/i);
  });

  it('cada erro do navegador vira uma frase acionável', () => {
    expect(motivoLegivel({ name: 'NotFoundError' })).toMatch(/nenhum microfone/i);
    expect(motivoLegivel({ name: 'NotReadableError' })).toMatch(/outro programa/i);
    expect(motivoLegivel(new Error('coisa estranha'))).toBe('coisa estranha');
  });
});
