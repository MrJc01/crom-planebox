// Executa os scripts dos mods e distribui os eventos do jogo entre eles.
//
// O runtime é o lugar onde o isolamento vira concreto: compilar, chamar e falhar acontecem
// todos aqui, e nenhuma dessas três coisas pode escapar para o loop do jogo. Um mod quebrado
// deve produzir um log e sumir de cena — nunca uma tela preta.
//
// Orçamento de tempo: `tick` roda em todo frame, somando todos os mods. Um orçamento global por
// frame impede que dez mods razoáveis, juntos, façam o que um mod ruim faria sozinho.

import { ModPackage, ModScript } from './ModTypes';
import { compilarScriptDeMod } from './sandbox';
import { ModContext, ModEvent, ModHostBridge, buildModAPI } from './ModAPI';

/** Teto de tempo por frame para o conjunto de todos os `tick`, em milissegundos. */
export const TICK_BUDGET_MS = 4;

export interface ScriptLoadResult {
  scriptKey: string;
  ok: boolean;
  error?: string;
}

export class ModRuntime {
  private contexts = new Map<string, ModContext>();
  /**
   * Uma instância de `api` por script, reaproveitada em toda chamada dele.
   *
   * Precisa ser a MESMA: o handler registrado pelo script fecha sobre o `api` que recebeu na
   * compilação. Construir um novo a cada despacho fazia o runtime drenar um objeto vazio,
   * enquanto os blocos escritos ficavam presos no `api` original — ou seja, bloco colocado
   * dentro de um evento nunca chegava a ser salvo nem sincronizado.
   */
  private apis = new Map<string, Record<string, any>>();
  private host: ModHostBridge;
  /** Avisado a cada lote de blocos alterado por script, com o mod responsável. */
  public onBlocksChanged: (modId: string, changes: { x: number; y: number; z: number; blockType: number }[]) => void = () => {};
  /** Avisado quando um script é desligado por erros repetidos. */
  public onScriptDisabled: (modId: string, scriptKey: string, reason: string) => void = () => {};

  constructor(host: ModHostBridge) {
    this.host = host;
  }

  public getContext(modId: string): ModContext | undefined {
    return this.contexts.get(modId);
  }

  public get loadedCount(): number {
    return this.contexts.size;
  }

  /**
   * Carrega (ou recarrega) os scripts de um mod.
   *
   * Recarregar dispara `unload` antes de descartar o contexto anterior: é a chance de o mod
   * limpar o que criou. Sem isso, editar um script no editor acumularia handlers duplicados a
   * cada salvamento.
   */
  public loadMod(pkg: ModPackage): ScriptLoadResult[] {
    if (this.contexts.has(pkg.id)) this.unloadMod(pkg.id);

    const ctx = new ModContext(pkg);
    // Os segredos deste mod, para o log nunca guardá-los. Vem do host porque é ele quem conhece
    // o cofre; o runtime não deve nem saber de onde os valores saem.
    ctx.segredos = Object.values(this.host.modEnv(pkg.id).valores ?? {});
    this.contexts.set(pkg.id, ctx);

    const resultados: ScriptLoadResult[] = [];
    for (const script of pkg.scripts ?? []) {
      if (!script.enabled) continue;
      resultados.push(this.compile(ctx, script));
    }

    this.dispatchTo(ctx, 'load', {});
    return resultados;
  }

  /** Compila um script e roda seu corpo, que é onde os `api.on(...)` são registrados. */
  private apiFor(ctx: ModContext, scriptKey: string): Record<string, any> {
    const chave = `${ctx.mod.id}:${scriptKey}`;
    let api = this.apis.get(chave);
    if (!api) {
      api = buildModAPI(ctx, this.host, scriptKey);
      this.apis.set(chave, api);
    }
    return api;
  }

  private compile(ctx: ModContext, script: ModScript): ScriptLoadResult {
    // Descarta a instância anterior: recarregar precisa reiniciar o orçamento e o buffer.
    this.apis.delete(`${ctx.mod.id}:${script.key}`);
    const api = this.apiFor(ctx, script.key);
    try {
      // O escopo global é SOMBREADO — ver `src/mods/sandbox.ts`.
      //
      // O comentário que estava aqui afirmava que `new Function` com um parâmetro só impedia o
      // corpo de ver `window` e `globalThis`. Era falso: `new Function` isola do escopo LOCAL de
      // quem cria, e o corpo continua avaliado no escopo global, com `fetch`, `document`,
      // `localStorage` e `indexedDB` ao alcance. Num projeto onde estes scripts são escritos por
      // uma IA e rodam na mesma origem do cofre de chaves, isso não era um detalhe.
      compilarScriptDeMod(script.code)(api);
      this.flush(ctx, api);
      return { scriptKey: script.key, ok: true };
    } catch (err: any) {
      const msg = err?.message || String(err);
      ctx.log('error', `[${script.key}] falha ao carregar: ${msg}`);
      ctx.disabledScripts.set(script.key, msg);
      ctx.removeHandlersOf(script.key);
      this.onScriptDisabled(ctx.mod.id, script.key, msg);
      return { scriptKey: script.key, ok: false, error: msg };
    }
  }

  /** Recarrega um script só, sem tocar nos demais do mesmo mod. */
  public reloadScript(modId: string, scriptKey: string): ScriptLoadResult | null {
    const ctx = this.contexts.get(modId);
    if (!ctx) return null;
    const script = (ctx.mod.scripts ?? []).find((s) => s.key === scriptKey);
    if (!script) return null;

    ctx.removeHandlersOf(scriptKey);
    ctx.disabledScripts.delete(scriptKey);
    if (!script.enabled) return { scriptKey, ok: true };
    return this.compile(ctx, script);
  }

  public unloadMod(modId: string): void {
    const ctx = this.contexts.get(modId);
    if (!ctx) return;
    this.dispatchTo(ctx, 'unload', {});
    ctx.reset();
    this.contexts.delete(modId);
    for (const chave of Array.from(this.apis.keys())) {
      if (chave.startsWith(`${modId}:`)) this.apis.delete(chave);
    }
  }

  public unloadAll(): void {
    for (const id of Array.from(this.contexts.keys())) this.unloadMod(id);
  }

  /**
   * Distribui um evento para todos os mods carregados.
   * `tick` tem tratamento próprio (orçamento de tempo) e usa `tickAll`.
   */
  public dispatch(event: Exclude<ModEvent, 'tick'>, payload: any): void {
    for (const ctx of this.contexts.values()) this.dispatchTo(ctx, event, payload);
  }

  /**
   * `tick` de todos os mods, com orçamento global de tempo.
   * Ao estourar, os mods restantes são pulados **neste frame** — nunca desligados: um pico
   * isolado não deve punir um mod que costuma ser barato.
   */
  public tickAll(dt: number): void {
    if (this.contexts.size === 0) return;
    const limite = performance.now() + TICK_BUDGET_MS;

    for (const ctx of this.contexts.values()) {
      this.dispatchTo(ctx, 'tick', { dt });
      if (performance.now() > limite) break;
    }
  }

  private dispatchTo(ctx: ModContext, event: ModEvent, payload: any): void {
    const list = ctx.handlers.get(event);
    if (!list || list.length === 0) return;

    // Cópia da lista: um handler pode registrar ou remover outro durante o despacho.
    for (const { scriptKey, fn } of [...list]) {
      if (ctx.disabledScripts.has(scriptKey)) continue;

      const api = this.apiFor(ctx, scriptKey);
      try {
        fn.call(undefined, payload);
      } catch (err) {
        const desligou = ctx.recordError(scriptKey, err);
        if (desligou) {
          this.onScriptDisabled(ctx.mod.id, scriptKey, ctx.disabledScripts.get(scriptKey) ?? 'erro');
        }
      }
      this.flush(ctx, api);
    }
  }

  /** Recolhe os blocos que o handler alterou e avisa o host para persistir e sincronizar. */
  private flush(ctx: ModContext, api: Record<string, any>): void {
    const changes = api.__drain();
    if (changes.length > 0) this.onBlocksChanged(ctx.mod.id, changes);
  }

  /** Diagnóstico para a UI e para o agente: estado de cada mod carregado. */
  public describe(): {
    modId: string;
    scripts: { key: string; enabled: boolean; disabledReason?: string }[];
    handlers: Record<string, number>;
    logs: number;
    blocksPlaced: number;
  }[] {
    return Array.from(this.contexts.values()).map((ctx) => {
      const handlers: Record<string, number> = {};
      for (const [event, list] of ctx.handlers) {
        if (list.length > 0) handlers[event] = list.length;
      }
      return {
        modId: ctx.mod.id,
        scripts: (ctx.mod.scripts ?? []).map((s) => ({
          key: s.key,
          enabled: s.enabled && !ctx.disabledScripts.has(s.key),
          disabledReason: ctx.disabledScripts.get(s.key),
        })),
        handlers,
        logs: ctx.logs.length,
        blocksPlaced: ctx.placedBlocks.size,
      };
    });
  }

  /** Últimas linhas de log de um mod, para o editor e para a autocorreção do agente. */
  public getLogs(modId: string, limit = 40): { level: string; message: string; timestamp: number }[] {
    const ctx = this.contexts.get(modId);
    if (!ctx) return [];
    return ctx.logs.slice(-limit);
  }
}
