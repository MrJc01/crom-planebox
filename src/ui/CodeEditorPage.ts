// Editor de código dos mods: árvore de arquivos, edição com destaque de sintaxe e console.
//
// É a tela que torna a manutenção em tempo real viável — editar o comportamento do jogo com o
// mundo aberto, salvar, e ver o resultado sem reiniciar.
//
// Sobre a biblioteca: o Monaco é literalmente o editor do VSCode, mas pesa ~5 MB e seria o maior
// componente de um produto que hoje entrega 853 KB. O CodeMirror 6 dá numeração, destaque,
// dobra e autocomplete em uma fração disso, e é carregado por `import()` dinâmico — quem nunca
// abre o editor não paga nada no boot.
//
// Salvar gera uma revisão do mod e recarrega o script na hora. Recarregar dispara `unload` antes,
// para o mod limpar o que criou; sem isso, cada salvamento acumularia handlers duplicados.

import { CAMADA } from './theme';
import { UIScreen } from './UIManager';
import { ModService } from '../mods/ModService';
import { ModRuntime } from '../mods/ModRuntime';
import { ModPackage } from '../mods/ModTypes';

const MODELO_INICIAL = `// Script novo. A API é injetada como \`api\` — não existe window, fetch nem setTimeout.
// Eventos: load, unload, tick, blockPlaced, blockBroken, playerDamaged, entityDeath, dayPhase

api.on('load', () => {
  api.console.log('mod carregado');
});

api.on('blockBroken', ({ x, y, z, block }) => {
  // Ex.: acende uma tocha onde o jogador quebrou um bloco durante a noite
  if (!api.time.isNight()) return;
  api.world.setBlock(x, y + 1, z, api.B.TORCH);
});
`;

export class CodeEditorPage implements UIScreen {
  readonly id = 'code-editor';
  public isOpen = false;

  private root: HTMLDivElement;

  /** Raiz no DOM, para a armadilha de foco do `UIManager` prender o Tab aqui dentro. */
  public get raiz(): HTMLElement { return this.root; }
  private arvore: HTMLDivElement;
  private area: HTMLDivElement;
  private console: HTMLDivElement;
  private statusEl: HTMLSpanElement;

  private modId: string | null = null;
  private scriptKey: string | null = null;
  private editorView: any = null;
  /** `textarea` de reserva, usada se o CodeMirror não carregar. */
  private fallback: HTMLTextAreaElement | null = null;
  private carregandoEditor: Promise<void> | null = null;

  public onChanged: () => void = () => {};

  constructor(private mods: ModService, private runtime: ModRuntime) {
    const partes = this.montarDom();
    this.root = partes.root;
    this.arvore = partes.arvore;
    this.area = partes.area;
    this.console = partes.console;
    this.statusEl = partes.status;
    document.body.appendChild(this.root);
  }

  private montarDom() {
    const root = document.createElement('div');
    root.id = 'code-editor';
    root.style.cssText = `
      position: fixed; inset: 0; z-index: ${CAMADA.tela}; display: none;
      background: rgba(2,6,23,0.96); color:#e2e8f0;
      font-family: system-ui, sans-serif; padding: 20px; box-sizing: border-box;
    `;

    const painel = document.createElement('div');
    painel.style.cssText = `
      display:flex; flex-direction:column; height:100%; gap:12px;
      background:#0b1220; border:1px solid #1e293b; border-radius:14px; padding:16px; box-sizing:border-box;
    `;

    const topo = document.createElement('div');
    topo.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:12px;';

    const titulo = document.createElement('h2');
    titulo.textContent = 'Editor de código';
    titulo.style.cssText = 'margin:0; font-size:18px; font-weight:700;';

    const status = document.createElement('span');
    status.style.cssText = 'font-size:12px; color:#64748b; flex:1; text-align:center;';

    const acoes = document.createElement('div');
    acoes.style.cssText = 'display:flex; gap:8px;';

    const salvar = this.botao('Salvar e recarregar (Ctrl+S)', '#2563eb');
    salvar.onclick = () => void this.salvar();

    const novo = this.botao('Novo script', '#1e293b');
    novo.onclick = () => void this.novoScript();

    const fechar = this.botao('Fechar (Esc)', '#1e293b');
    fechar.onclick = () => this.close();

    acoes.append(salvar, novo, fechar);
    topo.append(titulo, status, acoes);

    const corpo = document.createElement('div');
    corpo.style.cssText = 'display:flex; gap:12px; flex:1; min-height:0;';

    const arvore = document.createElement('div');
    arvore.style.cssText = `
      width:220px; min-width:180px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;
      border-right:1px solid #1e293b; padding-right:10px;
    `;

    const direita = document.createElement('div');
    direita.style.cssText = 'flex:1; display:flex; flex-direction:column; gap:10px; min-width:0;';

    const area = document.createElement('div');
    area.style.cssText = `
      flex:1; min-height:0; border:1px solid #1e293b; border-radius:10px; overflow:hidden; background:#0f172a;
    `;

    const consoleEl = document.createElement('div');
    consoleEl.style.cssText = `
      height:132px; overflow-y:auto; background:#0f172a; border:1px solid #1e293b;
      border-radius:10px; padding:9px 11px; font-family:ui-monospace,monospace; font-size:11.5px; line-height:1.55;
    `;

    direita.append(area, consoleEl);
    corpo.append(arvore, direita);
    painel.append(topo, corpo);
    root.appendChild(painel);

    // Ctrl+S salva, como em qualquer editor. `capture` para chegar antes do handler do jogo.
    root.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        void this.salvar();
      }
    }, true);

    return { root, arvore, area, console: consoleEl, status };
  }

  private botao(texto: string, fundo: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = texto;
    b.style.cssText = `
      background:${fundo}; border:1px solid #334155; border-radius:8px; color:#e2e8f0;
      padding:7px 12px; font-size:12.5px; cursor:pointer; white-space:nowrap;
    `;
    return b;
  }

  /**
   * Carrega o CodeMirror sob demanda. Se falhar (offline, bloqueio), cai para um `textarea`
   * simples — perder o destaque de sintaxe é aceitável; não poder editar não é.
   */
  private async garantirEditor(): Promise<void> {
    if (this.editorView || this.fallback) return;
    if (this.carregandoEditor) return this.carregandoEditor;

    this.carregandoEditor = (async () => {
      try {
        const [{ EditorView, basicSetup }, { javascript }, { oneDark }] = await Promise.all([
          import('codemirror'),
          import('@codemirror/lang-javascript'),
          import('@codemirror/theme-one-dark'),
        ]);
        this.editorView = new EditorView({
          doc: '',
          extensions: [basicSetup, javascript(), oneDark, EditorView.lineWrapping],
          parent: this.area,
        });
      } catch (err) {
        console.warn('[CodeEditor] CodeMirror indisponível, usando editor simples:', err);
        const ta = document.createElement('textarea');
        ta.spellcheck = false;
        ta.style.cssText = `
          width:100%; height:100%; border:none; outline:none; resize:none;
          background:#0f172a; color:#e2e8f0; font-family:ui-monospace,monospace;
          font-size:13px; line-height:1.6; padding:10px; box-sizing:border-box;
        `;
        this.area.appendChild(ta);
        this.fallback = ta;
      }
    })();

    return this.carregandoEditor;
  }

  private getCodigo(): string {
    if (this.editorView) return this.editorView.state.doc.toString();
    return this.fallback?.value ?? '';
  }

  private setCodigo(codigo: string): void {
    if (this.editorView) {
      this.editorView.dispatch({
        changes: { from: 0, to: this.editorView.state.doc.length, insert: codigo },
      });
      return;
    }
    if (this.fallback) this.fallback.value = codigo;
  }

  private renderArvore(): void {
    this.arvore.innerHTML = '';
    const mods = this.mods.getMods();

    for (const mod of mods) {
      const cab = document.createElement('div');
      cab.textContent = mod.name;
      cab.style.cssText = 'font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:#64748b; margin:8px 0 3px;';
      this.arvore.appendChild(cab);

      const scripts = mod.scripts ?? [];
      if (scripts.length === 0) {
        const vazio = document.createElement('div');
        vazio.textContent = 'sem scripts';
        vazio.style.cssText = 'font-size:11.5px; color:#475569; padding:2px 8px;';
        this.arvore.appendChild(vazio);
      }

      for (const s of scripts) {
        const ativo = mod.id === this.modId && s.key === this.scriptKey;
        const item = document.createElement('button');
        item.textContent = `${s.key}.js${s.enabled ? '' : ' (off)'}`;
        item.style.cssText = `
          text-align:left; background:${ativo ? '#1e293b' : 'transparent'};
          border:1px solid ${ativo ? '#334155' : 'transparent'}; border-radius:6px;
          padding:5px 9px; color:#cbd5e1; cursor:pointer; font-size:12.5px;
          font-family:ui-monospace,monospace;
        `;
        item.onclick = () => void this.abrir(mod.id, s.key);
        this.arvore.appendChild(item);
      }
    }
  }

  private renderConsole(): void {
    this.console.innerHTML = '';
    if (!this.modId) return;

    const linhas = this.runtime.getLogs(this.modId, 60);
    if (linhas.length === 0) {
      const vazio = document.createElement('div');
      vazio.textContent = '— sem saída —';
      vazio.style.cssText = 'color:#475569;';
      this.console.appendChild(vazio);
      return;
    }

    for (const l of linhas) {
      const cor = l.level === 'error' ? '#f87171' : l.level === 'warn' ? '#fbbf24' : '#94a3b8';
      const linha = document.createElement('div');
      linha.textContent = l.message;
      linha.style.cssText = `color:${cor};`;
      this.console.appendChild(linha);
    }
    this.console.scrollTop = this.console.scrollHeight;
  }

  public async abrir(modId: string, scriptKey?: string): Promise<void> {
    await this.garantirEditor();

    const mod = this.mods.getMod(modId);
    if (!mod) return;

    this.modId = modId;
    const scripts = mod.scripts ?? [];
    this.scriptKey = scriptKey ?? scripts[0]?.key ?? null;

    const script = scripts.find((s) => s.key === this.scriptKey);
    this.setCodigo(script?.code ?? MODELO_INICIAL);
    this.statusEl.textContent = this.scriptKey
      ? `${mod.name} › ${this.scriptKey}.js (revisão ${mod.revision})`
      : `${mod.name} — nenhum script ainda`;

    this.renderArvore();
    this.renderConsole();
  }

  private async novoScript(): Promise<void> {
    const mod = this.modId ? this.mods.getMod(this.modId) : this.mods.getMods()[0];
    if (!mod) {
      alert('Crie um mod antes — pelo chat da IA ou pela página de Mods.');
      return;
    }
    const chave = prompt('Nome do script (ex.: clima, criaturas):', 'main');
    if (!chave) return;

    const r = await this.mods.setScript(mod.id, { key: chave, code: MODELO_INICIAL });
    if (!r.ok) { alert(r.message); return; }

    this.recarregar(mod.id);
    await this.abrir(mod.id, r.details?.key ?? chave);
    this.onChanged();
  }

  private async salvar(): Promise<void> {
    if (!this.modId || !this.scriptKey) {
      alert('Nenhum script aberto. Use "Novo script".');
      return;
    }

    const r = await this.mods.setScript(this.modId, { key: this.scriptKey, code: this.getCodigo() });
    if (!r.ok) { this.statusEl.textContent = `${r.message}`; return; }

    // Recarrega já: o valor do editor é ver o efeito sem reiniciar o mundo.
    const resultados = await this.recarregar(this.modId);
    const falhou = resultados.find((x) => !x.ok);

    this.statusEl.textContent = falhou
      ? `${this.scriptKey}.js não carregou: ${falhou.error}`
      : `salvo e recarregado — revisão ${r.details?.revision}`;

    this.renderArvore();
    this.renderConsole();
    this.onChanged();
  }

  private async recarregar(modId: string): Promise<{ scriptKey: string; ok: boolean; error?: string }[]> {
    const mod = this.mods.getMod(modId);
    if (!mod) return [];
    return this.runtime.loadMod(mod as ModPackage);
  }

  public open(): void {
    this.isOpen = true;
    this.root.style.display = 'block';
    void this.garantirEditor().then(() => {
      const alvo = this.modId ?? this.mods.getMods()[0]?.id;
      if (alvo) void this.abrir(alvo, this.scriptKey ?? undefined);
      else this.statusEl.textContent = 'Nenhum mod neste mundo ainda.';
      this.renderArvore();
    });
    // O console acompanha o script rodando: sem isto, ver o efeito de um `tick` exigiria
    // fechar e abrir a tela.
    this.timerConsole = window.setInterval(() => this.renderConsole(), 700);
  }

  private timerConsole = 0;

  public close(): void {
    this.isOpen = false;
    this.root.style.display = 'none';
    clearInterval(this.timerConsole);
  }
}
