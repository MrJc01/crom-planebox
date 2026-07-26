// Hub de navegação: a porta única para tudo que não é jogar.
//
// O problema que ele resolve: as telas foram nascendo uma a uma, cada uma com seu atalho de
// tecla (F4 personagem, F5 câmera, F6 mods, F7 editor…). Quem não leu a documentação não
// descobre nenhuma delas, e não há lugar nenhum que mostre o que existe. Os atalhos continuam
// funcionando para quem já os conhece — mas deixam de ser o **único** caminho.
//
// O hub também concentra o que antes não tinha casa: opções de áudio (o sistema já suportava
// volume por canal, mas nada expunha), lista de atalhos e o retorno ao menu inicial.

import { CAMADA, CORES, FONTE, botao, cartao, deslizante, montarTela, rotulo } from './theme';
import { NomeIcone, icone } from './icons';
import { UIScreen } from './UIManager';
import { AudioChannel, AudioSystem } from '../audio/AudioSystem';

export interface DestinoMenu {
  id: string;
  /** Ícone do conjunto de `icons.ts`. Não é emoji: ver o cabeçalho daquele arquivo. */
  icone: NomeIcone;
  titulo: string;
  descricao: string;
  atalho?: string;
  acao: () => void;
}

export class GameMenu implements UIScreen {
  readonly id = 'game-menu';
  public isOpen = false;

  private raiz: HTMLDivElement;
  private corpo: HTMLDivElement;
  private destinos: DestinoMenu[] = [];

  /** Fechar o hub e voltar ao jogo. */
  public onRetomar: () => void = () => {};
  /** Sair da partida e voltar à tela inicial. */
  public onSairParaMenuInicial: () => void = () => {};

  constructor(private audio: AudioSystem) {
    const tela = montarTela('game-menu', 'Menu', CAMADA.hub);
    this.raiz = tela.raiz;
    this.corpo = tela.corpo;

    const retomar = botao('Voltar ao jogo (Esc)', 'primario');
    retomar.onclick = () => this.onRetomar();
    tela.acoes.appendChild(retomar);

    document.body.appendChild(this.raiz);
  }

  /** Registra um destino. Chamado pelo `main` para cada tela existente. */
  public registrar(destino: DestinoMenu): void {
    this.destinos.push(destino);
  }

  private render(): void {
    this.corpo.innerHTML = '';

    const grade = document.createElement('div');
    grade.style.cssText = `
      display: grid; grid-template-columns: repeat(auto-fit, minmax(232px, 1fr));
      gap: 10px; margin-bottom: 22px;
    `;

    for (const d of this.destinos) {
      const item = document.createElement('button');
      item.style.cssText = `
        text-align: left; background: ${CORES.fundoElevado};
        border: 1px solid ${CORES.borda}; border-radius: 12px;
        padding: 14px 15px; color: ${CORES.texto}; cursor: pointer;
        display: flex; flex-direction: column; gap: 4px; font-family: ${FONTE};
        transition: border-color .12s, background .12s;
      `;
      // Âmbar no hover, não azul: azul é a cor de ação (botão que executa), âmbar é a de estado
      // (o que está em foco). Misturar os dois papéis é o que deixa a tela ilegível de longe.
      item.addEventListener('mouseenter', () => {
        item.style.borderColor = CORES.aviso;
        item.style.background = CORES.avisoFraco;
      });
      item.addEventListener('mouseleave', () => {
        item.style.borderColor = CORES.borda;
        item.style.background = CORES.fundoElevado;
      });

      const topo = document.createElement('div');
      topo.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px;';

      const nome = document.createElement('span');
      nome.style.cssText = 'display:flex; align-items:center; gap:10px; font-size:14px; font-weight:600;';
      // O ícone herda a cor do texto (`currentColor`), então o realce do item no hover acerta os
      // dois de uma vez, sem regra extra.
      nome.append(icone(d.icone, 19));
      const t = document.createElement('span');
      t.textContent = d.titulo;
      nome.append(t);
      topo.appendChild(nome);

      // O atalho aparece ao lado do destino: é assim que ele deixa de ser conhecimento oculto.
      if (d.atalho) {
        const tecla = document.createElement('span');
        tecla.textContent = d.atalho;
        tecla.style.cssText = `
          font-size:11px; color:${CORES.textoApagado}; border:1px solid ${CORES.borda};
          border-radius:5px; padding:1px 6px; font-family:${FONTE};
        `;
        topo.appendChild(tecla);
      }

      const desc = document.createElement('span');
      desc.textContent = d.descricao;
      desc.style.cssText = `font-size:12px; color:${CORES.textoFraco}; line-height:1.45;`;

      item.append(topo, desc);
      item.onclick = () => d.acao();
      grade.appendChild(item);
    }

    this.corpo.append(rotulo('Ir para'), grade);
    this.corpo.append(this.blocoAudio(), this.blocoAtalhos(), this.blocoSair());
  }

  /** Volume por canal — o `AudioSystem` já suportava, mas nada na interface expunha. */
  private blocoAudio(): HTMLElement {
    const bloco = document.createElement('div');
    bloco.style.cssText = 'margin-bottom:22px;';
    bloco.appendChild(rotulo('Áudio'));

    const c = cartao();
    const canais: { canal: AudioChannel; nome: string }[] = [
      { canal: 'master', nome: 'Geral' },
      { canal: 'sfx', nome: 'Efeitos' },
      { canal: 'ambient', nome: 'Ambiente' },
      { canal: 'music', nome: 'Música' },
      { canal: 'ui', nome: 'Interface' },
    ];
    for (const { canal, nome } of canais) {
      c.appendChild(deslizante(nome, this.audio.getVolume(canal), (v) => this.audio.setVolume(canal, v)));
    }

    const silenciar = botao(this.audio.habilitado ? 'Silenciar tudo' : 'Reativar som', 'secundario');
    silenciar.onclick = () => {
      this.audio.setHabilitado(!this.audio.habilitado);
      silenciar.textContent = this.audio.habilitado ? 'Silenciar tudo' : 'Reativar som';
    };
    c.appendChild(silenciar);

    bloco.appendChild(c);
    return bloco;
  }

  private blocoAtalhos(): HTMLElement {
    const bloco = document.createElement('div');
    bloco.style.cssText = 'margin-bottom:22px;';
    bloco.appendChild(rotulo('Atalhos'));

    const c = cartao();
    const grade = document.createElement('div');
    grade.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:6px 18px;';

    const atalhos: [string, string][] = [
      ['Esc', 'Abrir este menu / voltar'],
      ['F5', 'Primeira ↔ terceira pessoa'],
      ['F4', 'Customizar personagem'],
      ['F6', 'Mods do mundo'],
      ['F7', 'Editor de código'],
      ['F', 'Comer o item selecionado'],
      ['T', 'Conversar com a IA'],
      ['E', 'Inventário'],
      ['F3', 'Diagnóstico: onde o frame está indo'],
      ['Clique', 'Retomar o controle da câmera'],
    ];
    for (const [tecla, oque] of atalhos) {
      const linha = document.createElement('div');
      linha.style.cssText = 'display:flex; gap:9px; align-items:baseline; font-size:12.5px;';
      linha.innerHTML =
        `<span style="min-width:46px; color:${CORES.textoApagado}; border:1px solid ${CORES.borda};` +
        `border-radius:5px; padding:1px 6px; text-align:center; font-size:11px;">${tecla}</span>` +
        `<span style="color:${CORES.textoFraco};">${oque}</span>`;
      grade.appendChild(linha);
    }

    c.appendChild(grade);
    bloco.appendChild(c);
    return bloco;
  }

  private blocoSair(): HTMLElement {
    const bloco = document.createElement('div');
    const sair = botao('Sair para a tela inicial', 'perigo');
    sair.onclick = () => {
      // O mundo é salvo continuamente, então sair não perde progresso — mas confirmar evita
      // o clique acidental num botão que interrompe a partida.
      if (confirm('Sair para a tela inicial? O mundo já está salvo.')) this.onSairParaMenuInicial();
    };
    bloco.appendChild(sair);
    return bloco;
  }

  public open(): void {
    this.isOpen = true;
    this.render(); // re-renderiza para refletir volumes e mods atuais
    this.raiz.style.display = 'flex';
  }

  public close(): void {
    this.isOpen = false;
    this.raiz.style.display = 'none';
  }
}
