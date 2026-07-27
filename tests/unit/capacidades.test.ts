// Manifesto de capacidades de um mod — itens 761 a 768 e 775.
//
// Até o item 358, um invólucro de `fetch` seria decoração: o script rodava neste reino e pegava o
// `fetch` de verdade pela fuga do construtor. Com os scripts no Worker e o global de lá esvaziado,
// **não existe `fetch` para alcançar** — a única rede possível atravessa a ponte, e uma checagem na
// ponte é uma checagem de verdade.

import { describe, it, expect } from 'vitest';
import {
  MAX_BYTES_DE_RESPOSTA,
  VERSAO_DO_MANIFESTO,
  enviaDados,
  hostCasa,
  motivoDeRecusaDeEsquema,
  podeChamar,
  validarManifesto,
} from '../../src/mods/capacidades';

describe('casamento de host', () => {
  it('CRÍTICO: host exato casa, e só ele', () => {
    expect(hostCasa('api.exemplo.com', 'api.exemplo.com')).toBe(true);
    expect(hostCasa('outro.exemplo.com', 'api.exemplo.com')).toBe(false);
  });

  it('CRÍTICO: `exemplo.com` NÃO libera `exemplo.com.atacante.net`', () => {
    // O ataque clássico e barato contra casamento por conteúdo: qualquer pessoa registra
    // `exemplo.com.atacante.net` em cinco minutos, e uma allowlist ingênua o aceitaria como se
    // fosse o host declarado.
    expect(hostCasa('exemplo.com.atacante.net', 'exemplo.com')).toBe(false);
    expect(hostCasa('exemplo.com.atacante.net', '.exemplo.com')).toBe(false);
  });

  it('CRÍTICO: `.exemplo.com` NÃO libera `naoexemplo.com`', () => {
    // O ponto inicial obrigatório é exatamente o que impede isto. Sem ele, um sufixo casaria com
    // qualquer domínio que termine com as mesmas letras.
    expect(hostCasa('naoexemplo.com', '.exemplo.com')).toBe(false);
  });

  it('`.exemplo.com` libera subdomínio e o próprio domínio', () => {
    expect(hostCasa('api.exemplo.com', '.exemplo.com')).toBe(true);
    expect(hostCasa('a.b.exemplo.com', '.exemplo.com')).toBe(true);
    expect(hostCasa('exemplo.com', '.exemplo.com')).toBe(true);
  });

  it('não distingue maiúsculas — o DNS não distingue', () => {
    expect(hostCasa('API.Exemplo.COM', 'api.exemplo.com')).toBe(true);
  });

  it('entrada vazia não casa com nada', () => {
    // Um host vazio numa lista mal preenchida não pode virar "libera tudo".
    expect(hostCasa('qualquer.com', '')).toBe(false);
    expect(hostCasa('qualquer.com', '   ')).toBe(false);
  });
});

describe('esquema', () => {
  it('CRÍTICO: http remoto é recusado', () => {
    // Interceptável e alterável por qualquer um no caminho — e a resposta vira entrada de um script.
    expect(motivoDeRecusaDeEsquema(new URL('http://exemplo.com'))).toMatch(/https/);
  });

  it('https passa', () => {
    expect(motivoDeRecusaDeEsquema(new URL('https://exemplo.com'))).toBeNull();
  });

  it('http em localhost passa — a exceção nomeada', () => {
    // Um modelo de linguagem local, ou o relay deste projeto, vivem em `http://localhost`. Recusar
    // isso empurraria quem desenvolve a desligar a checagem inteira, que é bem pior.
    expect(motivoDeRecusaDeEsquema(new URL('http://localhost:8787/x'))).toBeNull();
    expect(motivoDeRecusaDeEsquema(new URL('http://127.0.0.1:1234'))).toBeNull();
  });

  it('CRÍTICO: esquemas exóticos são recusados', () => {
    // `file:` leria o disco; `data:` faria o mod fabricar a própria resposta e tratá-la como vinda
    // de fora, o que confunde a auditoria.
    for (const u of ['file:///etc/passwd', 'data:text/plain,oi', 'blob:https://x/y']) {
      expect(motivoDeRecusaDeEsquema(new URL(u)), u).toBeTruthy();
    }
  });
});

describe('podeChamar', () => {
  const hosts = ['api.clima.com', '.exemplo.com'];

  it('CRÍTICO: host autorizado passa', () => {
    expect(podeChamar('https://api.clima.com/v1/agora', hosts).permitido).toBe(true);
  });

  it('CRÍTICO: host não declarado é recusado, dizendo qual', () => {
    // Quem lê a mensagem é o autor do mod tentando descobrir o que declarar.
    const r = podeChamar('https://outro.net/x', hosts);
    expect(r.permitido).toBe(false);
    expect(r.motivo).toContain('outro.net');
  });

  it('endereço inválido não estoura', () => {
    expect(podeChamar('nao é uma url', hosts)).toMatchObject({ permitido: false });
  });

  it('lista vazia recusa tudo — o padrão seguro', () => {
    // É o estado de um mod que não declarou rede: nada passa, sem precisar de regra própria.
    expect(podeChamar('https://api.clima.com/x', []).permitido).toBe(false);
  });

  it('devolve o host normalizado, para a auditoria', () => {
    expect(podeChamar('https://API.Clima.com/x', hosts).host).toBe('api.clima.com');
  });
});

describe('dados de saída — item 775', () => {
  it('CRÍTICO: GET sem corpo não envia', () => {
    expect(enviaDados('GET', undefined)).toBe(false);
    expect(enviaDados(undefined, undefined)).toBe(false);
  });

  it('CRÍTICO: corpo é envio, qualquer que seja o verbo', () => {
    expect(enviaDados('GET', '{"mundo":"inteiro"}')).toBe(true);
  });

  it('CRÍTICO: POST é envio mesmo sem corpo', () => {
    // A permissão de falar com um endereço não é a mesma coisa que a permissão de contar coisas
    // para ele: um mod com "ler o clima" não deveria conseguir fazer POST para o mesmo host.
    expect(enviaDados('POST', undefined)).toBe(true);
    expect(enviaDados('put', undefined)).toBe(true);
  });

  it('corpo vazio não conta como envio', () => {
    expect(enviaDados('GET', '')).toBe(false);
    expect(enviaDados('GET', null)).toBe(false);
  });
});

describe('validação do manifesto', () => {
  const valido = {
    versao: VERSAO_DO_MANIFESTO,
    rede: { hosts: ['api.clima.com'], motivo: 'buscar a previsão do tempo da cidade do jogador' },
  };

  it('manifesto válido não tem erro', () => {
    expect(validarManifesto(valido)).toEqual([]);
  });

  it('CRÍTICO: manifesto sem versão é INVÁLIDO, não "versão 1"', () => {
    // Tratar a ausência como a versão atual concederia por engano tudo o que a versão atual permite
    // a um manifesto escrito antes de essas permissões existirem.
    expect(validarManifesto({ rede: valido.rede }).join(' ')).toMatch(/versao/);
  });

  it('CRÍTICO: curinga é recusado', () => {
    // O pedido que mais aparece e o único que não dá para conceder: uma allowlist que permite tudo
    // é uma allowlist que não existe, e o jogador estaria consentindo com o vazio.
    const erros = validarManifesto({ ...valido, rede: { ...valido.rede, hosts: ['*'] } });
    expect(erros.join(' ')).toMatch(/curinga/);
  });

  it('CRÍTICO: motivo vazio ou curto demais é recusado', () => {
    // Sem motivo legível, a tela vira "este mod quer acessar a internet: sim/não" — a pergunta que
    // treina o jogador a clicar sim.
    expect(validarManifesto({ ...valido, rede: { hosts: ['x.com'], motivo: 'api' } }).join(' '))
      .toMatch(/motivo/);
  });

  it('lista de hosts vazia é recusada', () => {
    expect(validarManifesto({ ...valido, rede: { hosts: [], motivo: valido.rede.motivo } }).join(' '))
      .toMatch(/hosts/);
  });

  it('caminho no lugar de host é apontado', () => {
    const erros = validarManifesto({ ...valido, rede: { ...valido.rede, hosts: ['api.com/v1'] } });
    expect(erros.join(' ')).toMatch(/host/);
  });

  it('mod sem rede declarada é válido — e é o caso comum', () => {
    // A maioria dos mods não precisa de rede. Exigir uma seção vazia seria cerimônia sem ganho.
    expect(validarManifesto({ versao: VERSAO_DO_MANIFESTO })).toEqual([]);
  });

  it('manifesto ausente não estoura', () => {
    expect(validarManifesto(undefined).length).toBeGreaterThan(0);
    expect(validarManifesto(null).length).toBeGreaterThan(0);
    expect(validarManifesto('texto').length).toBeGreaterThan(0);
  });
});

describe('tetos', () => {
  it('resposta tem limite de tamanho', () => {
    // Sem teto, um mod pedindo um arquivo de um gigabyte trava a aba — e o host seria um dos
    // declarados, então nenhuma outra regra o impediria.
    expect(MAX_BYTES_DE_RESPOSTA).toBeGreaterThan(100_000);
    expect(MAX_BYTES_DE_RESPOSTA).toBeLessThanOrEqual(8 * 1024 * 1024);
  });
});
