// Painel de diagnóstico (F3): onde o frame está indo, de verdade.
//
// Toda a otimização das rodadas anteriores foi medida em bancada. Isso indica a ordem de
// grandeza, mas não prova nada sobre o frame real — o navegador tem GC, JIT e composição que a
// bancada não reproduz. Sem este painel, "está travado" e "está rápido" continuam sendo opinião.
//
// O painel só mede quando está aberto: instrumentar custa, e ninguém deve pagar por uma
// medição que não pediu.

import { CAMADA, CORES, FONTE_MONO } from './theme';
import { profiler } from '../core/profiler';

export interface FontesDiagnostico {
  chunksCarregados: () => number;
  chunksSujos: () => number;
  malhasEmVoo: () => number;
  filaLuz: () => number;
  entidades: () => number;
  hostis: () => number;
  vozesAudio: () => number;
  modsCarregados: () => number;
  rede: () => { enviados: number; recebidos: number; papel: string; peers: number };
  posicao: () => { x: number; y: number; z: number };
  cacheRotas: () => { hits: number; misses: number; hitRate: number };
  /** Mistura de biomas sob o jogador, e a fase da lua — o ambiente é difícil de conferir a olho. */
  ambiente: () => { bioma: string; clima: string; estacao: string; fase: string; noiteEscura: boolean };
  /** Semente do mundo — exibida e copiável (item 114). */
  semente?: () => number | string;
}

export class DebugPanel {
  private raiz: HTMLDivElement;
  private timer = 0;
  public aberto = false;

  constructor(private fontes: FontesDiagnostico) {
    this.raiz = document.createElement('div');
    this.raiz.id = 'debug-panel';
    this.raiz.style.cssText = `
      position: fixed; top: 10px; left: 10px; z-index: ${CAMADA.depuracao}; display: none;
      background: rgba(2,6,23,0.86); border: 1px solid ${CORES.borda}; border-radius: 8px;
      padding: 10px 13px; color: ${CORES.texto}; font-family: ${FONTE_MONO};
      font-size: 11.5px; line-height: 1.55; pointer-events: none;
      min-width: 300px; max-height: 88vh; overflow: hidden; white-space: pre;
    `;
    document.body.appendChild(this.raiz);
  }

  public alternar(): void {
    this.aberto = !this.aberto;
    this.raiz.style.display = this.aberto ? 'block' : 'none';
    profiler.habilitado = this.aberto;

    if (this.aberto) {
      profiler.reset();
      // 4 Hz: o painel precisa ser legível, não acompanhar cada frame. Redesenhar a 60 Hz
      // colocaria o próprio diagnóstico entre os custos que ele deveria estar medindo.
      this.timer = window.setInterval(() => this.render(), 250);
    } else {
      clearInterval(this.timer);
    }
  }

  private render(): void {
    const f = profiler.frameStats();
    const sistemas = profiler.snapshot();
    const rede = this.fontes.rede();
    const p = this.fontes.posicao();
    const rotas = this.fontes.cacheRotas();

    const linhas: string[] = [];

    // O orçamento de 16,7 ms é o que separa 60 fps de engasgo — deixá-lo explícito evita a
    // interpretação otimista de um número solto.
    const cor = f.media < 8 ? CORES.sucesso : f.media < 16.7 ? CORES.aviso : '#f87171';
    linhas.push(`<span style="color:${cor}">FRAME  ${f.media.toFixed(2)} ms   pico ${f.pico.toFixed(1)} ms   (~${f.fps.toFixed(0)} fps)</span>`);
    linhas.push(`orçamento 60 fps = 16.7 ms`);
    linhas.push('');

    if (sistemas.length > 0) {
      linhas.push('ONDE O FRAME VAI');
      for (const s of sistemas.slice(0, 10)) {
        const barra = '█'.repeat(Math.min(18, Math.round(s.ms * 3)));
        linhas.push(`  ${s.rotulo.padEnd(11)} ${s.ms.toFixed(2).padStart(6)} ms  ${barra}`);
      }
      linhas.push('');
    }

    linhas.push('MUNDO');
    linhas.push(`  chunks ${this.fontes.chunksCarregados()}  sujos ${this.fontes.chunksSujos()}  malhas em voo ${this.fontes.malhasEmVoo()}`);
    linhas.push(`  fila de luz ${this.fontes.filaLuz()}`);
    if (this.fontes.semente) {
      linhas.push(`  semente ${this.fontes.semente()}`);
    }
    linhas.push(`  pos ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`);
    const amb = this.fontes.ambiente();
    linhas.push(`  bioma ${amb.bioma}`);
    linhas.push(`  clima ${amb.clima}`);
    linhas.push(`  estação ${amb.estacao}`);
    linhas.push(`  lua ${amb.fase}${amb.noiteEscura ? ' (noite escura)' : ''}`);
    linhas.push('');

    linhas.push('SIMULAÇÃO');
    linhas.push(`  entidades ${this.fontes.entidades()}  hostis ${this.fontes.hostis()}`);
    linhas.push(`  mods ${this.fontes.modsCarregados()}  vozes ${this.fontes.vozesAudio()}`);
    linhas.push(`  cache de rotas ${(rotas.hitRate * 100).toFixed(0)}% (${rotas.hits}/${rotas.hits + rotas.misses})`);
    linhas.push('');

    linhas.push('REDE');
    linhas.push(`  ${rede.papel}  peers ${rede.peers}`);
    linhas.push(`  enviado ${(rede.enviados / 1024).toFixed(1)} KB  recebido ${(rede.recebidos / 1024).toFixed(1)} KB`);

    const mem = (performance as any).memory;
    if (mem?.usedJSHeapSize) {
      linhas.push('');
      linhas.push(`MEMÓRIA  ${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB de ${(mem.jsHeapSizeLimit / 1048576).toFixed(0)} MB`);
    }

    this.raiz.innerHTML = linhas.join('\n');
  }

  /** Copia a semente do mundo para a área de transferência — item 114. */
  public static async copySeedToClipboard(seed: number | string): Promise<boolean> {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(String(seed));
        return true;
      }
    } catch {
      // fallback
    }
    return false;
  }
}
