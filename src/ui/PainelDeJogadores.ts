// A lista de jogadores, mostrada enquanto o [Tab] está pressionado — item 1497.
//
// ## Por que segurar e não alternar
//
// A lista é uma consulta, não uma tela: o jogador quer saber quem está por perto sem parar de
// jogar. Alternar exigiria fechá-la, e o custo de esquecer aberto é um painel tampando o mundo
// justamente quando algo acontece. Segurar torna impossível esquecer.
//
// É também por isso que ela **não bloqueia** — não passa pelo `UIManager`. Uma tela bloqueante
// solta o ponteiro, pausa a entrada e devolve o foco ao fechar; para uma consulta de dois segundos,
// isso é o triplo do custo do benefício.
//
// ## Por que ela não decide nada
//
// Recebe as linhas prontas de `listaDeJogadores.ts` e desenha. A ordem, a distância e o resumo do
// sono são regras, e regra em arquivo de DOM é regra que nenhum teste alcança.

import { LinhaDeJogador, distanciaLegivel, resumoDeSono } from '../net/listaDeJogadores';
import { CAMADA, CORES, RAIO } from './theme';
import { icone_svg } from './icons';

export class PainelDeJogadores {
  private caixa: HTMLDivElement;
  private lista: HTMLDivElement;
  private cabecalho: HTMLDivElement;

  /** O jogador clicou num nome — silenciar ou voltar a ouvir. */
  public onAlternarSilencio: (id: string) => void = () => {};

  public get visivel(): boolean {
    return this.caixa.style.display !== 'none';
  }

  constructor() {
    this.caixa = document.createElement('div');
    this.caixa.style.cssText = `
      position: absolute; top: 64px; left: 50%; transform: translateX(-50%);
      display: none; min-width: 300px; max-width: 420px;
      background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(10px);
      border: 1px solid ${CORES.borda}; border-radius: ${RAIO.md};
      padding: 12px 14px; z-index: ${CAMADA.dica};
      font-family: system-ui, sans-serif; color: ${CORES.texto};
      box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    `;

    this.cabecalho = document.createElement('div');
    this.cabecalho.style.cssText = `
      display:flex; align-items:center; gap:7px; font-size:12px; font-weight:700;
      color:${CORES.textoFraco}; text-transform:uppercase; letter-spacing:0.04em;
      margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid ${CORES.borda};
    `;
    this.caixa.appendChild(this.cabecalho);

    this.lista = document.createElement('div');
    this.lista.style.cssText = 'display:flex; flex-direction:column; gap:2px;';
    this.caixa.appendChild(this.lista);

    document.body.appendChild(this.caixa);
  }

  public mostrar(linhas: LinhaDeJogador[]): void {
    this.desenhar(linhas);
    this.caixa.style.display = 'block';
  }

  public esconder(): void {
    this.caixa.style.display = 'none';
  }

  /** Redesenha só se já estiver aberto — chamado a cada quadro enquanto o Tab está pressionado. */
  public atualizar(linhas: LinhaDeJogador[]): void {
    if (this.visivel) this.desenhar(linhas);
  }

  private desenhar(linhas: LinhaDeJogador[]): void {
    const sono = resumoDeSono(linhas);
    this.cabecalho.innerHTML =
      `${icone_svg('rede', 14)}<span>${linhas.length} ${linhas.length === 1 ? 'jogador' : 'jogadores'}</span>`
      + (sono ? `<span style="margin-left:auto; color:${CORES.textoApagado}; text-transform:none;">${sono}</span>` : '');

    this.lista.innerHTML = '';
    for (const l of linhas) {
      const linha = document.createElement('div');
      linha.style.cssText = `
        display:flex; align-items:center; gap:8px; padding:5px 6px;
        border-radius:${RAIO.sm}; font-size:13px;
        ${l.euMesmo ? '' : 'cursor:pointer;'}
        ${l.silenciado ? `color:${CORES.textoApagado};` : ''}
      `;

      const nome = document.createElement('span');
      nome.textContent = l.nome + (l.euMesmo ? ' (você)' : '');
      nome.style.cssText = `flex:1; ${l.silenciado ? 'text-decoration:line-through;' : ''}`;
      linha.appendChild(nome);

      // Ícones em vez de emoji, e só quando o estado é verdadeiro: uma coluna de ícones apagados
      // pesa tanto quanto uma de acesos e não informa nada.
      if (l.dormindo) {
        const s = document.createElement('span');
        s.title = 'Dormindo';
        s.style.cssText = `display:inline-flex; color:${CORES.textoApagado};`;
        s.innerHTML = icone_svg('historico', 14);
        linha.appendChild(s);
      }
      if (l.silenciado) {
        const s = document.createElement('span');
        s.title = 'Silenciado — clique para voltar a ouvir';
        s.style.cssText = `display:inline-flex; color:${CORES.textoApagado};`;
        s.innerHTML = icone_svg('aviso', 14);
        linha.appendChild(s);
      }

      const dist = document.createElement('span');
      dist.textContent = l.euMesmo ? '' : distanciaLegivel(l.distancia);
      dist.style.cssText = `min-width:52px; text-align:right; color:${CORES.textoApagado}; font-family:monospace; font-size:11px;`;
      linha.appendChild(dist);

      if (!l.euMesmo) {
        linha.addEventListener('mouseenter', () => { linha.style.background = 'rgba(255,255,255,0.06)'; });
        linha.addEventListener('mouseleave', () => { linha.style.background = 'transparent'; });
        linha.addEventListener('click', () => this.onAlternarSilencio(l.id));
      }

      this.lista.appendChild(linha);
    }

    const dica = document.createElement('div');
    dica.style.cssText = `margin-top:10px; padding-top:8px; border-top:1px solid ${CORES.borda}; font-size:11px; color:${CORES.textoApagado};`;
    dica.textContent = linhas.length > 1
      ? 'Clique num nome para silenciar ou voltar a ouvir.'
      : 'Você está sozinho neste mundo.';
    this.lista.appendChild(dica);
  }
}
