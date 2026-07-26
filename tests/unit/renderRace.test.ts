// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

/**
 * A corrida que causava "clico numa aba e aparece a outra".
 *
 * `PauseMenu.renderBody` é assíncrona: limpa o corpo e depois espera (duas abas leem do banco).
 * Dois cliques seguidos disparavam dois desenhos — o segundo limpava, o primeiro voltava do
 * `await` e desenhava por cima. Nenhum erro no console: as duas rodaram exatamente como escritas.
 *
 * Este arquivo reproduz o padrão em miniatura, com e sem a correção, para fixar a diferença.
 * Testar o `PauseMenu` inteiro exigiria banco, mundo e rede; o que importa aqui é o padrão.
 */

/** Reprodução do defeito: sem guarda, o desenho lento vence o rápido. */
class SemGuarda {
  readonly corpo = document.createElement('div');
  async desenhar(id: string, atraso: number): Promise<void> {
    this.corpo.innerHTML = '';
    await new Promise((r) => setTimeout(r, atraso));
    this.corpo.appendChild(Object.assign(document.createElement('p'), { textContent: id }));
  }
}

/** A correção: cada desenho anota a geração em que começou e desiste se outro começou depois. */
class ComGuarda {
  readonly corpo = document.createElement('div');
  private geracao = 0;
  ativa = '';

  async desenhar(id: string, atraso: number): Promise<void> {
    const minha = ++this.geracao;
    this.ativa = id;
    this.corpo.innerHTML = '';

    const rascunho = document.createElement('div');
    await new Promise((r) => setTimeout(r, atraso));
    rascunho.appendChild(Object.assign(document.createElement('p'), { textContent: id }));

    if (minha !== this.geracao || this.ativa !== id) return;
    this.corpo.innerHTML = '';
    while (rascunho.firstChild) this.corpo.appendChild(rascunho.firstChild);
  }
}

describe('corrida de desenho assíncrono', () => {
  it('CRÍTICO: sem guarda, a aba lenta sobrescreve a que o jogador escolheu', () => {
    // Este teste PRECISA falhar no comportamento antigo — é ele que documenta o defeito.
    const tela = new SemGuarda();
    const lenta = tela.desenhar('mundo', 30); // clicou primeiro, carrega devagar
    const rapida = tela.desenhar('atalhos', 0); // clicou depois, é instantânea

    return Promise.all([lenta, rapida]).then(() => {
      // O defeito é PIOR do que "aparece a errada": o conteúdo das DUAS fica no DOM.
      // A rápida desenha, a lenta volta do `await` e ANEXA por cima sem limpar — porque quem
      // limpou foi a chamada dela, antes de esperar. É literalmente "clico numa coisa e abre
      // outra", com as duas na tela ao mesmo tempo.
      expect(tela.corpo.children.length).toBe(2);
      expect(tela.corpo.textContent).toBe('atalhosmundo');
    });
  });

  it('CRÍTICO: com guarda, vence sempre a última escolha do jogador', async () => {
    const tela = new ComGuarda();
    const lenta = tela.desenhar('mundo', 30);
    const rapida = tela.desenhar('atalhos', 0);
    await Promise.all([lenta, rapida]);

    expect(tela.corpo.textContent).toBe('atalhos');
  });

  it('CRÍTICO: nunca há conteúdo de duas abas ao mesmo tempo', () => {
    const tela = new ComGuarda();
    const promessas = [
      tela.desenhar('a', 20),
      tela.desenhar('b', 5),
      tela.desenhar('c', 12),
      tela.desenhar('d', 0),
    ];
    return Promise.all(promessas).then(() => {
      expect(tela.corpo.children.length).toBe(1);
      expect(tela.corpo.textContent).toBe('d');
    });
  });

  it('uma sequência longa de trocas converge para a última', async () => {
    const tela = new ComGuarda();
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    await Promise.all(ids.map((id, i) => tela.desenhar(id, (ids.length - i) * 3)));
    expect(tela.corpo.textContent).toBe('h');
    expect(tela.corpo.children.length).toBe(1);
  });

  it('um desenho só continua funcionando normalmente', async () => {
    const tela = new ComGuarda();
    await tela.desenhar('sozinha', 5);
    expect(tela.corpo.textContent).toBe('sozinha');
  });
});
