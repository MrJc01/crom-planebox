// StructuredLog — substitui os `console.log` soltos por entradas estruturadas — item 1576 P1.
//
// Problema: hoje os logs são frases soltas (`console.log('↺ Desfeito...')`). Um roteiro
// automatizado não consegue filtrar por subsistema, nível ou timestamp. Este módulo padroniza
// o formato sem exigir que cada chamada mude de uma vez — o logger aceita a mesma string e
// acrescenta os campos que faltam.
//
// O logger é puro: não acessa `Date.now()` diretamente (recebe como parâmetro), para os testes
// serem determinísticos.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLogEntry {
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Nível de severidade. */
  level: LogLevel;
  /** Subsistema que emitiu (ex: 'UndoManager', 'ModService', 'Wire'). */
  subsystem: string;
  /** Mensagem legível. */
  message: string;
  /** Dados opcionais serializáveis. */
  data?: Record<string, unknown>;
}

/**
 * Logger estruturado. Cada instância é vinculada a um subsistema.
 *
 * Exemplo de uso:
 * ```ts
 * const log = new StructuredLogger('UndoManager');
 * log.info('Desfeito lote', { count: 5 });
 * // → { timestamp: '...', level: 'info', subsystem: 'UndoManager', message: 'Desfeito lote', data: { count: 5 } }
 * ```
 */
export class StructuredLogger {
  private entries: StructuredLogEntry[] = [];
  private maxEntries: number;

  /**
   * @param subsystem Nome do subsistema (aparece em toda entrada).
   * @param maxEntries Limite de entradas em memória. As mais antigas são descartadas.
   * @param nowFn Função que retorna o timestamp atual (para testes).
   */
  constructor(
    public readonly subsystem: string,
    maxEntries = 1000,
    private nowFn: () => number = () => Date.now(),
  ) {
    this.maxEntries = maxEntries;
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): StructuredLogEntry {
    const entry: StructuredLogEntry = {
      timestamp: new Date(this.nowFn()).toISOString(),
      level,
      subsystem: this.subsystem,
      message,
      data,
    };

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    return entry;
  }

  public debug(message: string, data?: Record<string, unknown>): StructuredLogEntry {
    return this.log('debug', message, data);
  }

  public info(message: string, data?: Record<string, unknown>): StructuredLogEntry {
    return this.log('info', message, data);
  }

  public warn(message: string, data?: Record<string, unknown>): StructuredLogEntry {
    return this.log('warn', message, data);
  }

  public error(message: string, data?: Record<string, unknown>): StructuredLogEntry {
    return this.log('error', message, data);
  }

  /** Todas as entradas registradas (até `maxEntries`). */
  public getEntries(): readonly StructuredLogEntry[] {
    return this.entries;
  }

  /** Filtra entradas por nível. */
  public getByLevel(level: LogLevel): StructuredLogEntry[] {
    return this.entries.filter((e) => e.level === level);
  }

  /** Limpa o buffer. */
  public clear(): void {
    this.entries = [];
  }

  /** Número de entradas no buffer. */
  public get count(): number {
    return this.entries.length;
  }
}
