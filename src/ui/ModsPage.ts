// Página de Mods: ver, ativar, versionar e exportar as modificações do mundo.
// Migrada para o componente Tabs (Item 1149).

import { CAMADA } from './theme';
import { UIScreen } from './UIManager';
import { ModService } from '../mods/ModService';
import { ModRuntime } from '../mods/ModRuntime';
import { descreverEnv, resolverEnv } from '../mods/ModEnv';
import { ModPackage } from '../mods/ModTypes';
import { Tabs } from './Tabs';
import { WorldRepository } from '../storage/WorldRepository';
import { ModConsentRecord, ModNetLogRecord } from '../storage/Database';

export class ModsPage implements UIScreen {
  readonly id = 'mods-page';
  public isOpen = false;

  private root: HTMLDivElement;

  /** Raiz no DOM, para a armadilha de foco do `UIManager` prender o Tab aqui dentro. */
  public get raiz(): HTMLElement { return this.root; }
  private lista: HTMLDivElement;
  private detalhe: HTMLDivElement;
  private selecionado: string | null = null;

  /** Abrir o editor num script deste mod. Ligado pelo `main`. */
  public onOpenEditor: (modId: string, scriptKey?: string) => void = () => {};
  /**
   * Mundo atual, para ler e revogar consentimentos de rede.
   *
   * Ligado pelo `main` e não guardado aqui: o mundo muda durante a sessão, e uma cópia guardada
   * mostraria as permissões do mundo anterior — que é o pior tipo de erro nesta tela, porque parece
   * informação correta.
   */
  public worldIdAtual: () => string | null = () => null;
  /** O `main` regrava o espelho em memória depois de uma revogação. */
  public onConsentimentosMudaram: () => void = () => {};
  public onChanged: () => void = () => {};

  /**
   * Aba do painel de detalhes que o jogador escolheu por último.
   *
   * ## Por que isto precisa existir
   *
   * `renderDetalhe` constrói um `Tabs` novo a cada chamada, e `render()` é chamado por sete
   * ações diferentes — ligar um mod, apagar, recarregar, trocar de mod. Sem guardar a escolha
   * fora do componente, cada uma dessas ações jogava o jogador de volta na primeira aba: ele
   * abria "Versões", clicava em qualquer coisa, e estava em "Geral" de novo. Era isso o
   * "menus confusos" do relato.
   *
   * A alternativa seria manter um `Tabs` vivo e só trocar o conteúdo. Fica pior: os painéis
   * guardam estado do mod anterior, e a montagem preguiçosa passaria a mostrar dados de outro
   * mod até a aba ser reativada.
   *
   * Um id desconhecido é seguro: `Tabs.ir` cai na primeira aba em vez de deixar a tela em branco.
   */
  private abaDetalhe = 'general';

  /**
   * O que o mod pede, o que o jogador concedeu, e o que ele de fato fez.
   *
   * ## Por que as três coisas na mesma tela
   *
   * Separadas, cada uma responde meia pergunta. "Este mod pede acesso a `api.x.com`" não diz se
   * alguém autorizou; "você autorizou `api.x.com`" não diz se o mod usou. Juntas, a tela responde a
   * pergunta que o jogador realmente tem: **este mod está fazendo o que disse que faria?**
   *
   * É a diferença entre uma lista de permissões e uma prestação de contas. A primeira se lê uma vez
   * e nunca mais; a segunda tem motivo para ser reaberta.
   */
  private async blocoCapacidades(mod: ModPackage): Promise<HTMLElement> {
    const caixa = document.createElement('div');
    caixa.style.cssText = 'display:flex; flex-direction:column; gap:16px;';

    const rede = mod.capacidades?.rede;
    if (!rede || rede.hosts.length === 0) {
      const nada = document.createElement('p');
      nada.style.cssText = 'font-size:13px; color:#94a3b8; line-height:1.6; margin:0;';
      // O caso mais comum, e vale dizer que é bom: a maioria dos mods não precisa de rede.
      nada.textContent =
        'Este mod não pede acesso à rede. Ele não consegue falar com nenhum endereço externo — '
        + 'não há o que autorizar nem o que revogar.';
      caixa.appendChild(nada);
      return caixa;
    }

    const worldId = this.worldIdAtual();
    const concedidos: ModConsentRecord[] = worldId
      ? (await WorldRepository.getConsents(worldId)).filter((c) => c.modId === mod.id)
      : [];

    const motivo = document.createElement('div');
    motivo.style.cssText = 'font-size:13px; color:#cbd5e1; line-height:1.6;';
    motivo.innerHTML = `<strong style="color:#f1f5f9;">Motivo declarado pelo autor:</strong> ${esc(rede.motivo)}`;
    caixa.appendChild(motivo);

    if (rede.envia) {
      const alerta = document.createElement('div');
      alerta.style.cssText = 'padding:10px 12px; border-radius:9px; background:rgba(239,68,68,0.10); '
        + 'border:1px solid rgba(239,68,68,0.35); color:#fca5a5; font-size:12px; line-height:1.5;';
      alerta.innerHTML = 'Este mod declara que <strong>envia dados</strong>, além de ler.';
      caixa.appendChild(alerta);
    }

    for (const host of rede.hosts) {
      const concedido = concedidos.find((c) => c.host === host || c.host === host.replace(/^\./, ''));
      const linha = document.createElement('div');
      linha.style.cssText = 'display:flex; align-items:center; gap:12px; padding:11px 13px; '
        + 'background:rgba(30,41,59,0.55); border:1px solid rgba(255,255,255,0.08); border-radius:10px;';

      const texto = document.createElement('div');
      texto.style.cssText = 'flex:1; min-width:0;';
      texto.innerHTML =
        `<div style="font-family:monospace; font-size:13px; color:#e2e8f0; word-break:break-all;">${esc(host)}</div>`
        + `<div style="font-size:11px; margin-top:3px; color:${concedido ? '#4ade80' : '#64748b'};">`
        + (concedido
          ? `Autorizado em ${new Date(concedido.grantedAt).toLocaleDateString()}`
          : 'Ainda não autorizado — o mod será barrado até você permitir')
        + '</div>';
      linha.appendChild(texto);

      if (concedido && worldId) {
        const revogar = document.createElement('button');
        revogar.textContent = 'Revogar';
        revogar.style.cssText = 'background:transparent; border:1px solid #7f1d1d; color:#fca5a5; '
          + 'padding:7px 13px; border-radius:8px; cursor:pointer; font-size:12px; flex:0 0 auto;';
        revogar.onclick = async () => {
          await WorldRepository.revokeConsent(worldId, mod.id, concedido.host);
          // O espelho em memória precisa ser regravado, senão a revogação só valeria na próxima vez
          // que o mundo abrisse — e o jogador teria clicado em "revogar" sem revogar nada.
          this.onConsentimentosMudaram();
          this.render();
        };
        linha.appendChild(revogar);
      }
      caixa.appendChild(linha);
    }

    caixa.appendChild(await this.blocoAuditoria(mod.id, worldId));
    return caixa;
  }

  /** As últimas chamadas de rede deste mod — item 768 posto na mão do jogador. */
  private async blocoAuditoria(modId: string, worldId: string | null): Promise<HTMLElement> {
    const caixa = document.createElement('div');
    caixa.style.cssText = 'display:flex; flex-direction:column; gap:8px; margin-top:4px;';

    const titulo = document.createElement('h4');
    titulo.style.cssText = 'margin:0; font-size:13px; color:#94a3b8;';
    titulo.textContent = 'Últimas chamadas';
    caixa.appendChild(titulo);

    const linhas = worldId ? await WorldRepository.getModNetLog(worldId, modId, 25) : [];
    if (linhas.length === 0) {
      const vazio = document.createElement('p');
      vazio.style.cssText = 'font-size:12px; color:#64748b; margin:0;';
      vazio.textContent = 'Este mod ainda não tentou nenhuma chamada de rede.';
      caixa.appendChild(vazio);
      return caixa;
    }

    for (const l of linhas as ModNetLogRecord[]) {
      const item = document.createElement('div');
      const barrada = !!l.recusa;
      item.style.cssText = `display:flex; gap:10px; align-items:baseline; font-size:11.5px;
        padding:7px 10px; border-radius:7px; background:rgba(15,23,42,0.6);
        border-left:3px solid ${barrada ? '#ef4444' : '#4ade80'};`;
      item.innerHTML =
        `<span style="color:#64748b; font-family:monospace;">${new Date(l.quando).toLocaleTimeString()}</span>`
        + `<span style="color:#cbd5e1; font-family:monospace; flex:1; min-width:0; word-break:break-all;">`
        + `${esc(l.metodo)} ${esc(l.host)}${esc(l.caminho)}</span>`
        // A recusa aparece com o motivo, porque é a linha que vale a pena investigar. Um log que
        // só mostra o que deu certo responde à pergunta errada.
        + `<span style="color:${barrada ? '#fca5a5' : '#94a3b8'}; flex:0 0 auto;">`
        + `${barrada ? esc(l.recusa!) : `${l.status} · ${formatarBytes(l.bytes)}`}</span>`;
      caixa.appendChild(item);
    }
    return caixa;
  }

  constructor(private mods: ModService, private runtime: ModRuntime) {
    const { root, lista, detalhe } = this.montarDom();
    this.root = root;
    this.lista = lista;
    this.detalhe = detalhe;
    document.body.appendChild(this.root);
  }

  private montarDom() {
    const root = document.createElement('div');
    root.id = 'mods-page';
    root.style.cssText = `
      position: fixed; inset: 0; z-index: ${CAMADA.tela}; display: none;
      background: rgba(2,6,23,0.94); backdrop-filter: blur(6px);
      color: #e2e8f0; font-family: system-ui, sans-serif;
      align-items: center; justify-content: center; padding: 24px; box-sizing: border-box;
    `;

    const painel = document.createElement('div');
    painel.style.cssText = `
      display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 1040px;
      height: 100%; background: #0b1220; border: 1px solid #1e293b; border-radius: 16px;
      padding: 22px; box-sizing: border-box; overflow: hidden;
    `;

    const cabecalho = document.createElement('div');
    cabecalho.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:12px;';

    const titulo = document.createElement('h2');
    titulo.textContent = 'Mods deste mundo';
    titulo.style.cssText = 'margin:0; font-size:21px; font-weight:700; color:#38bdf8;';

    const acoes = document.createElement('div');
    acoes.style.cssText = 'display:flex; gap:8px;';

    const importar = this.botao('Importar mod', '#1e293b');
    importar.onclick = () => this.importar();

    const fechar = this.botao('Fechar (Esc)', '#1e293b');
    fechar.onclick = () => this.close();

    acoes.append(importar, fechar);
    cabecalho.append(titulo, acoes);

    const corpo = document.createElement('div');
    corpo.style.cssText = 'display:flex; gap:16px; flex:1; min-height:0;';

    const lista = document.createElement('div');
    lista.style.cssText = `
      width: 260px; min-width: 220px; overflow-y: auto; display:flex; flex-direction:column; gap:6px;
      border-right: 1px solid #1e293b; padding-right: 12px;
    `;

    const detalhe = document.createElement('div');
    detalhe.style.cssText = 'flex:1; display:flex; flex-direction:column; min-width:0; overflow:hidden;';

    corpo.append(lista, detalhe);
    painel.append(cabecalho, corpo);
    root.appendChild(painel);
    return { root, lista, detalhe };
  }

  private botao(texto: string, fundo: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = texto;
    b.style.cssText = `
      background:${fundo}; border:1px solid #334155; border-radius:8px; color:#e2e8f0;
      padding:8px 13px; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap;
    `;
    return b;
  }

  private renderLista(): void {
    this.lista.innerHTML = '';
    const mods = this.mods.getMods();

    if (mods.length === 0) {
      const vazio = document.createElement('p');
      vazio.textContent = 'Nenhum mod ainda. Peça à IA no chat para criar uma modificação, ou importe um.';
      vazio.style.cssText = 'font-size:13px; color:#64748b; line-height:1.5;';
      this.lista.appendChild(vazio);
      return;
    }

    for (const mod of mods) {
      const item = document.createElement('button');
      const ativo = mod.id === this.selecionado;
      item.style.cssText = `
        text-align:left; background:${ativo ? '#1e293b' : 'transparent'};
        border:1px solid ${ativo ? '#38bdf8' : 'transparent'}; border-radius:8px;
        padding:9px 11px; color:#e2e8f0; cursor:pointer; display:flex; flex-direction:column; gap:3px;
      `;

      const nome = document.createElement('span');
      nome.textContent = mod.name;
      nome.style.cssText = 'font-size:13px; font-weight:600;';

      const sub = document.createElement('span');
      const estado = mod.quarantined ? 'isolado' : mod.enabled ? 'ativo' : 'desligado';
      sub.textContent = `${estado} · rev ${mod.revision} · ${(mod.blocks ?? []).length} bloco(s)`;
      sub.style.cssText = `font-size:11px; color:${mod.quarantined ? '#fbbf24' : '#64748b'};`;

      item.append(nome, sub);
      item.onclick = () => { this.selecionado = mod.id; this.render(); };
      this.lista.appendChild(item);
    }
  }

  private async renderDetalhe(): Promise<void> {
    this.detalhe.innerHTML = '';
    const mod = this.selecionado ? this.mods.getMod(this.selecionado) : undefined;

    if (!mod) {
      const dica = document.createElement('p');
      dica.textContent = 'Selecione um mod à esquerda para ver o conteúdo, o histórico de versões e as configurações.';
      dica.style.cssText = 'font-size:13px; color:#64748b; line-height:1.6;';
      this.detalhe.appendChild(dica);
      return;
    }

    // Usar a estrutura Tabs para organizar a aba de detalhes do Mod selecionado
    const modTabs = new Tabs();

    // Aba 1: Geral & Conteúdo
    modTabs.adicionar({
      id: 'general',
      titulo: 'Geral & Conteúdo',
      icone: 'mundo',
      montar: (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:14px; overflow-y:auto; height:100%;';
        if (mod.quarantined) {
          const aviso = document.createElement('div');
          aviso.style.cssText = `
            background:rgba(251,191,36,0.1); border:1px solid #a16207; border-radius:10px;
            padding:12px 14px; font-size:13px; line-height:1.55;
          `;
          aviso.innerHTML = `<strong>Este mod foi isolado automaticamente.</strong><br>` +
            `Ele falhou ao ser aplicado e foi desligado para o mundo poder carregar. Motivo:<br>` +
            `<code style="color:#fbbf24">${escapar(mod.quarantineReason ?? 'desconhecido')}</code>`;
          container.appendChild(aviso);
        }
        container.appendChild(this.blocoCabecalho(mod));
        container.appendChild(this.blocoConteudo(mod));
      },
    });

    // Aba 2: Configuração mod.env
    modTabs.adicionar({
      id: 'env',
      titulo: 'mod.env',
      icone: 'chat',
      emblema: () => mod.env?.chaves.length || 0,
      montar: (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:14px; overflow-y:auto; height:100%;';
        container.appendChild(this.blocoEnv(mod));
      },
    });

    // Aba 3: Histórico de Versões
    // Aba de capacidades — itens 769, 770 e 1399.
    modTabs.adicionar({
      id: 'capacidades',
      titulo: 'Capacidades',
      icone: 'chave',
      emblema: () => mod.capacidades?.rede?.hosts.length ?? 0,
      montar: async (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:14px; overflow-y:auto; height:100%;';
        container.appendChild(await this.blocoCapacidades(mod));
      },
    });

    modTabs.adicionar({
      id: 'revisions',
      titulo: 'Versões',
      icone: 'engrenagem',
      montar: async (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:14px; overflow-y:auto; height:100%;';
        container.appendChild(await this.blocoVersoes(mod));
      },
    });

    // Aba 4: Scripts de Voxel
    modTabs.adicionar({
      id: 'scripts',
      titulo: 'Scripts',
      icone: 'codigo',
      emblema: () => mod.scripts?.length || 0,
      montar: (container) => {
        container.style.cssText = 'display:flex; flex-direction:column; gap:10px; overflow-y:auto; height:100%;';
        const h = document.createElement('h4');
        h.textContent = 'Scripts de Voxel cadastrados neste mod';
        h.style.cssText = 'margin:0 0 6px; font-size:14px;';
        container.appendChild(h);

        const scripts = mod.scripts ?? [];
        if (scripts.length === 0) {
          const vazio = document.createElement('p');
          vazio.textContent = 'Nenhum script registrado neste mod.';
          vazio.style.cssText = 'font-size:12px; color:#64748b;';
          container.appendChild(vazio);
          return;
        }

        for (const s of scripts) {
          const card = document.createElement('div');
          card.style.cssText = 'background:#0f172a; border:1px solid #1e293b; border-radius:8px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between;';
          card.innerHTML = `
            <div>
              <div style="font-size:13px; font-weight:700; color:#38bdf8;">${s.key}</div>
              <div style="font-size:11px; color:#64748b;">${s.enabled ? 'Ativo' : 'Desativado'}</div>
            </div>
          `;
          const editBtn = this.botao('Editar Código', '#2563eb');
          editBtn.onclick = () => this.onOpenEditor(mod.id, s.key);
          card.appendChild(editBtn);
          container.appendChild(card);
        }
      },
    });

    modTabs.onTrocou = (id) => { this.abaDetalhe = id; };
    this.detalhe.appendChild(modTabs.raiz);
    // Reabre onde o jogador estava, e não sempre na primeira.
    modTabs.iniciar(this.abaDetalhe);
  }

  private blocoCabecalho(mod: ModPackage): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:16px;';

    const h = document.createElement('h3');
    h.textContent = mod.name;
    h.style.cssText = 'margin:0 0 4px; font-size:18px;';

    const meta = document.createElement('p');
    meta.textContent = `${mod.id} · revisão ${mod.revision}${mod.description ? ` · ${mod.description}` : ''}`;
    meta.style.cssText = 'margin:0 0 12px; font-size:12px; color:#64748b;';

    const acoes = document.createElement('div');
    acoes.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap;';

    const alternar = this.botao(mod.enabled ? 'Desligar' : 'Ligar', mod.enabled ? '#1e293b' : '#2563eb');
    alternar.onclick = async () => {
      await this.mods.setEnabled(mod.id, !mod.enabled);
      this.onChanged();
      this.render();
    };

    const editar = this.botao('Abrir no editor', '#2563eb');
    editar.onclick = () => this.onOpenEditor(mod.id, (mod.scripts ?? [])[0]?.key);

    const exportar = this.botao('Exportar', '#1e293b');
    exportar.onclick = () => this.exportar(mod);

    const remover = this.botao('Remover', '#7f1d1d');
    remover.onclick = async () => {
      if (!confirm(`Remover o mod "${mod.name}"?\n\nOs blocos que ele colocou no mundo também serão apagados. Isto não pode ser desfeito.`)) return;
      const r = await this.mods.deleteMod(mod.id);
      alert(r.message);
      this.selecionado = null;
      this.onChanged();
      this.render();
    };

    acoes.append(alternar, editar, exportar, remover);
    wrap.append(h, meta, acoes);
    return wrap;
  }

  private blocoEnv(mod: ModPackage): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:18px;';
    if (!mod.env || mod.env.chaves.length === 0) {
      const texto = document.createElement('p');
      texto.textContent = 'Este mod não possui chaves mod.env declaradas.';
      texto.style.cssText = 'font-size:12px; color:#64748b;';
      wrap.appendChild(texto);
      return wrap;
    }

    const resolvido = resolverEnv(
      mod.env,
      this.mods.vault.valoresDe(mod.id),
      this.mods.vault.globaisComDerivadas(),
    );
    const descricoes = descreverEnv(mod.env, resolvido);

    const titulo = document.createElement('h4');
    titulo.textContent = 'mod.env — configuração e chaves';
    titulo.style.cssText = 'margin:0 0 4px; font-size:14px;';

    const nota = document.createElement('p');
    nota.textContent =
      'Estes valores ficam só neste computador. Não são exportados nem enviados para outros jogadores.';
    nota.style.cssText = 'margin:0 0 10px; font-size:11px; color:#64748b;';
    wrap.append(titulo, nota);

    if (resolvido.faltando.length > 0) {
      const aviso = document.createElement('div');
      aviso.textContent = `Faltam chaves obrigatórias: ${resolvido.faltando.join(', ')}. O mod não carrega sem elas.`;
      aviso.style.cssText =
        'background:rgba(180,83,9,0.2); border:1px solid #b45309; color:#fbbf24;' +
        'padding:8px 10px; border-radius:8px; font-size:12px; margin-bottom:10px;';
      wrap.appendChild(aviso);
    }

    if (!this.mods.vault.disponivel) {
      const aviso = document.createElement('div');
      aviso.textContent =
        'Sem armazenamento persistente neste navegador: as chaves valem só até fechar a aba.';
      aviso.style.cssText =
        'background:rgba(30,41,59,0.6); border:1px solid #475569; color:#94a3b8;' +
        'padding:8px 10px; border-radius:8px; font-size:12px; margin-bottom:10px;';
      wrap.appendChild(aviso);
    }

    for (const c of descricoes) {
      const linha = document.createElement('div');
      linha.style.cssText = 'margin-bottom:10px;';

      const rotulo = document.createElement('label');
      rotulo.textContent = c.nome + (c.obrigatoria ? ' *' : '');
      rotulo.style.cssText = `display:block; font-size:12px; font-weight:700; margin-bottom:2px; color:${
        c.obrigatoria && !c.preenchida ? '#fbbf24' : '#e2e8f0'
      };`;

      const ajuda = document.createElement('div');
      ajuda.textContent = c.descricao;
      ajuda.style.cssText = 'font-size:11px; color:#64748b; margin-bottom:4px;';

      const campo = document.createElement('input');
      campo.type = c.sensivel ? 'password' : 'text';
      campo.value = c.sensivel ? '' : (this.mods.vault.valoresDe(mod.id)[c.nome] ?? '');
      campo.placeholder = c.sensivel && c.preenchida
        ? '(preenchida — digite para substituir)'
        : c.preenchida ? '' : 'vazio';
      campo.style.cssText =
        'width:100%; box-sizing:border-box; background:rgba(15,23,42,0.7);' +
        'border:1px solid rgba(255,255,255,0.15); border-radius:6px; padding:7px 9px;' +
        'color:white; font-size:12px; font-family:monospace;';

      campo.onchange = async () => {
        const v = campo.value.trim();
        if (c.sensivel && v === '') return;
        await this.mods.vault.definir(mod.id, c.nome, v);
        this.render();
      };

      linha.append(rotulo, ajuda, campo);

      if (c.sensivel && c.preenchida) {
        const limpar = document.createElement('button');
        limpar.textContent = 'Apagar esta chave';
        limpar.style.cssText =
          'margin-top:4px; background:none; border:none; color:#f87171; font-size:11px; cursor:pointer; padding:0;';
        limpar.onclick = async () => {
          await this.mods.vault.definir(mod.id, c.nome, '');
          this.render();
        };
        linha.appendChild(limpar);
      }

      wrap.appendChild(linha);
    }

    return wrap;
  }

  private blocoConteudo(mod: ModPackage): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:18px;';

    const grade = document.createElement('div');
    grade.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px;';

    const runtimeInfo = this.runtime.describe().find((d) => d.modId === mod.id);

    grade.appendChild(this.cartao('Blocos', (mod.blocks ?? []).map((b) => `${b.name} (${b.key} · id ${b.blockId})`)));
    grade.appendChild(this.cartao('Criaturas', (mod.entities ?? []).map((e) => `${e.name} (${e.key})`)));
    grade.appendChild(this.cartao('Estruturas', (mod.structures ?? []).map((s) => `${s.name} — ${s.blocks.length} blocos`)));
    grade.appendChild(this.cartao(
      'Scripts',
      (mod.scripts ?? []).map((s) => {
        const estado = runtimeInfo?.scripts.find((x) => x.key === s.key);
        if (estado && !estado.enabled && estado.disabledReason) return `${s.key} — ${estado.disabledReason}`;
        return `${s.key}${s.enabled ? '' : ' (desligado)'}`;
      }),
    ));

    if (runtimeInfo) {
      const eventos = Object.entries(runtimeInfo.handlers).map(([e, n]) => `${e} × ${n}`);
      grade.appendChild(this.cartao('Eventos escutados', eventos));
    }

    wrap.appendChild(grade);
    return wrap;
  }

  private cartao(titulo: string, itens: string[]): HTMLElement {
    const c = document.createElement('div');
    c.style.cssText = 'background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:11px 13px;';

    const h = document.createElement('div');
    h.textContent = `${titulo} (${itens.length})`;
    h.style.cssText = 'font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; margin-bottom:7px;';
    c.appendChild(h);

    if (itens.length === 0) {
      const vazio = document.createElement('div');
      vazio.textContent = '—';
      vazio.style.cssText = 'font-size:12px; color:#475569;';
      c.appendChild(vazio);
      return c;
    }

    for (const item of itens) {
      const linha = document.createElement('div');
      linha.textContent = item;
      linha.style.cssText = 'font-size:12px; color:#cbd5e1; line-height:1.6; word-break:break-word;';
      c.appendChild(linha);
    }
    return c;
  }

  private async blocoVersoes(mod: ModPackage): Promise<HTMLElement> {
    const wrap = document.createElement('div');
    const h = document.createElement('div');
    h.textContent = 'Histórico de versões';
    h.style.cssText = 'font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; margin-bottom:8px;';
    wrap.appendChild(h);

    const revisoes = await this.mods.listRevisions(mod.id);
    if (revisoes.length === 0) {
      const vazio = document.createElement('p');
      vazio.textContent = 'Ainda não há versões anteriores — este mod não foi alterado desde que foi criado.';
      vazio.style.cssText = 'font-size:12px; color:#475569;';
      wrap.appendChild(vazio);
      return wrap;
    }

    for (const rev of revisoes) {
      const linha = document.createElement('div');
      linha.style.cssText = `
        display:flex; align-items:center; justify-content:space-between; gap:10px;
        background:#0f172a; border:1px solid #1e293b; border-radius:8px;
        padding:8px 11px; margin-bottom:6px;
      `;

      const texto = document.createElement('div');
      texto.style.cssText = 'font-size:12px; color:#cbd5e1; min-width:0;';
      texto.innerHTML = `<strong>rev ${rev.revision}</strong> — ${escapar(rev.summary)}<br>` +
        `<span style="color:#475569">${new Date(rev.createdAt).toLocaleString()}</span>`;

      const voltar = this.botao(`Voltar para ${rev.revision}`, '#1e293b');
      voltar.onclick = async () => {
        if (!confirm(`Voltar o mod para a revisão ${rev.revision}?\n\nO estado atual é salvo como uma versão nova antes, então dá para desfazer.`)) return;
        const r = await this.mods.rollbackMod(mod.id, rev.revision);
        alert(r.message);
        this.onChanged();
        this.render();
      };

      linha.append(texto, voltar);
      wrap.appendChild(linha);
    }
    return wrap;
  }

  private exportar(mod: ModPackage): void {
    const pkg = this.mods.exportMod(mod.id);
    if (!pkg) return;
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mod.id}.crommod.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Mostra o manifesto do mod antes de instalar para confirmação explícita — item 1409 P1.
   * Também avisa que biomas de mods exigem explorar novos chunks — item 1422 P1.
   */
  public previewManifestBeforeImport(pkg: ModPackage): boolean {
    const biomesCount = pkg.biomes?.length ?? 0;
    const biomeNotice = biomesCount > 0 ? '\n\n[AVISO] Este mod inclui biomas novos. Eles só aparecerão em chunks virgens ainda não explorados no mapa.' : '';
    const permissions = (pkg as any).permissions ?? ['storage', 'custom_blocks'];
    return confirm(
      `Deseja instalar o mod "${pkg.name}" (id: ${pkg.id})?\n\nPermissões declaradas: ${permissions.join(', ')}${biomeNotice}`
    );
  }

  private importar(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const arquivo = input.files?.[0];
      if (!arquivo) return;
      try {
        const pkg = JSON.parse(await arquivo.text());
        if (!this.previewManifestBeforeImport(pkg)) return;
        const r = await this.mods.importMod(pkg);
        alert(r.message);
        this.onChanged();
        this.render();
      } catch (err: any) {
        alert(`Não foi possível importar: ${err?.message || err}`);
      }
    };
    input.click();
  }

  public render(): void {
    if (!this.isOpen) return;
    const mods = this.mods.getMods();
    if (this.selecionado && !mods.some((m) => m.id === this.selecionado)) this.selecionado = null;
    if (!this.selecionado && mods.length > 0) this.selecionado = mods[0].id;

    this.renderLista();
    void this.renderDetalhe();
  }

  public open(): void {
    this.isOpen = true;
    this.root.style.display = 'flex';
    this.render();
  }

  public close(): void {
    this.isOpen = false;
    this.root.style.display = 'none';
  }
}

function escapar(texto: string): string {
  const d = document.createElement('div');
  d.textContent = texto;
  return d.innerHTML;
}

/** Texto vindo de um pacote de mod, que pode ter sido escrito por qualquer um. */
function esc(texto: string): string {
  const d = document.createElement('div');
  d.textContent = String(texto);
  return d.innerHTML;
}

function formatarBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
