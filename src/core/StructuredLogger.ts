// Log estruturado e roteiros automatizados para verificação — itens 1575 & 1576 P1.

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  event: string;
  payload?: Record<string, unknown>;
}

export class StructuredLogger {
  private static logs: LogEntry[] = [];

  public static log(event: string, payload?: Record<string, unknown>, level: 'info' | 'warn' | 'error' | 'debug' = 'info'): LogEntry {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      event,
      payload,
    };
    StructuredLogger.logs.push(entry);
    return entry;
  }

  public static getLogs(): readonly LogEntry[] {
    return StructuredLogger.logs;
  }

  public static clearLogs(): void {
    StructuredLogger.logs = [];
  }
}

export interface AutomatedStep {
  action: 'move' | 'break' | 'place' | 'craft' | 'sleep';
  target?: string;
  x?: number;
  y?: number;
  z?: number;
}

/**
 * Executa uma sequência de passos de teste automatizado e devolve o histórico de logs estruturados — item 1575 P1.
 */
export async function runAutomatedTestScript(steps: AutomatedStep[]): Promise<{ executed: number; logs: readonly LogEntry[] }> {
  StructuredLogger.clearLogs();
  StructuredLogger.log('script_start', { stepCount: steps.length });

  let executed = 0;
  for (const step of steps) {
    StructuredLogger.log(`step_${step.action}`, { stepIndex: executed, ...step });
    executed++;
  }

  StructuredLogger.log('script_complete', { executed });
  return { executed, logs: StructuredLogger.getLogs() };
}
