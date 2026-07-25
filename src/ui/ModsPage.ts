// Página de Mods: ver, ativar, versionar e exportar as modificações do mundo.
//
// Versionamento, rollback e quarentena já existiam, mas só a IA os alcançava — para voltar uma
// versão era preciso pedir a ela. Uma informação que o usuário precisa ter à mão não pode
// depender de uma conversa.
//
// A página é deliberadamente densa: mostra tudo de um mod numa tela só, porque o caso de uso é
// diagnóstico ("por que este bloco sumiu?"), e diagnóstico com navegação em camadas é pior.

import { UIScreen } from './UIManager';
import { ModService } from '../mods/ModService';
import { ModRuntime } from '../mods/ModRuntime';
import { ModPackage } from '../mods/ModTypes';

export class ModsPage implements UIScreen {
  readonly id = 'mods-page';
  public isOpen = false;

  private root: HTMLDivElement;
  private lista: HTMLDivElement;
  private detalhe: HTMLDivElement;
  private selecionado: string | null = null;

  /** Abrir o editor num script deste mod. Ligado pelo `main`. */
  public onOpenEditor: (modId: string, scriptKey?: string) => void = () => {};
  public onChanged: () => void = () => {};

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
      position: fixed; inset: 0; z-index: 62; display: none;
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
    titulo.textContent = '🧩 Mods deste mundo';
    titulo.style.cssText = 'margin:0; font-size:21px; font-weight:700;';

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
    detalhe.style.cssText = 'flex:1; overflow-y:auto; min-width:0;';

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
      padding:8px 13px; font-size:13px; cursor:pointer; white-space:nowrap;
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
        border:1px solid ${ativo ? '#334155' : 'transparent'}; border-radius:8px;
        padding:9px 11px; color:#e2e8f0; cursor:pointer; display:flex; flex-direction:column; gap:3px;
      `;

      const nome = document.createElement('span');
      nome.textContent = mod.name;
      nome.style.cssText = 'font-size:13px; font-weight:600;';

      const sub = document.createElement('span');
      const estado = mod.quarantined ? '⚠️ isolado' : mod.enabled ? 'ativo' : 'desligado';
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
      dica.textContent = 'Selecione um mod à esquerda para ver o conteúdo, o histórico de versões e o que ele colocou no mundo.';
      dica.style.cssText = 'font-size:13px; color:#64748b; line-height:1.6;';
      this.detalhe.appendChild(dica);
      return;
    }

    // Quarentena primeiro: é a informação que explica "por que meu mod sumiu".
    if (mod.quarantined) {
      const aviso = document.createElement('div');
      aviso.style.cssText = `
        background:rgba(251,191,36,0.1); border:1px solid #a16207; border-radius:10px;
        padding:12px 14px; margin-bottom:14px; font-size:13px; line-height:1.55;
      `;
      aviso.innerHTML = `<strong>⚠️ Este mod foi isolado automaticamente.</strong><br>` +
        `Ele falhou ao ser aplicado e foi desligado para o mundo poder carregar. Motivo:<br>` +
        `<code style="color:#fbbf24">${escapar(mod.quarantineReason ?? 'desconhecido')}</code>`;
      this.detalhe.appendChild(aviso);
    }

    this.detalhe.appendChild(this.blocoCabecalho(mod));
    this.detalhe.appendChild(this.blocoConteudo(mod));
    this.detalhe.appendChild(await this.blocoVersoes(mod));
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
      // Destrutivo e irreversível: confirmação explícita, dizendo o que será apagado.
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
        if (estado && !estado.enabled && estado.disabledReason) return `${s.key} — ⚠️ ${estado.disabledReason}`;
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
    // O download sai do navegador direto: nada de servidor, coerente com o resto do projeto.
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mod.id}.crommod.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private importar(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const arquivo = input.files?.[0];
      if (!arquivo) return;
      try {
        const r = await this.mods.importMod(JSON.parse(await arquivo.text()));
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

/** Escapa texto que veio de erro de runtime ou de mod importado, antes de ir para innerHTML. */
function escapar(texto: string): string {
  const d = document.createElement('div');
  d.textContent = texto;
  return d.innerHTML;
}
