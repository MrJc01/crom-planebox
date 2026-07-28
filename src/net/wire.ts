// Camada de transporte do P2P: compressão e fragmentação das mensagens.
//
// Motivo de existir — dois problemas, um deles de correção:
//
//  1. **Limite de mensagem.** `PeerSync` enviava `JSON.stringify(msg)` direto no DataChannel.
//     O SCTP do WebRTC não aceita mensagem arbitrariamente grande: acima de ~256 KB o envio
//     falha ou derruba o canal, dependendo do navegador. Um `full_sync` de um mundo construído
//     passa de 1 MB com facilidade — ou seja, **quanto mais o anfitrião constrói, mais provável
//     é o convidado não conseguir entrar.**
//  2. **Volume.** Mesmo dentro do limite, mandar o mundo inteiro sem comprimir desperdiça banda
//     num payload que é quase todo repetição.
//
// Escolha de compressor: `CompressionStream('gzip')` é **nativa do navegador** — zero bytes de
// download e implementação em C++. Medimos o `crompressor.wasm` do projeto contra ela nos
// payloads reais do jogo e o gzip nativo venceu com folga em razão e em tempo (ver a seção de
// desempenho no checklist), então a decisão aqui é usar o que já vem no navegador.
//
// A parte de enquadramento é pura de propósito, para poder ser testada sem WebRTC.

/** Acima disto a mensagem é comprimida e fragmentada. Abaixo, segue como texto puro. */
export const FRAGMENT_THRESHOLD = 48 * 1024;
/** Tamanho de cada fragmento. Conservador: alguns navegadores só garantem 64 KB. */
export const FRAGMENT_SIZE = 16 * 1024;
/** Fragmentos incompletos são descartados após isto, para um envio interrompido não vazar memória. */
export const REASSEMBLY_TIMEOUT_MS = 30_000;

/** Primeiro byte de todo quadro binário, para distinguir de tráfego que não seja nosso. */
export const FRAME_MAGIC = 0xc7;
const HEADER_BYTES = 1 + 4 + 2 + 2; // magic + msgId + índice + total

export interface FrameHeader {
  msgId: number;
  index: number;
  total: number;
}

/** Monta um quadro binário: cabeçalho + pedaço do payload. */
export function encodeFrame(msgId: number, index: number, total: number, payload: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(HEADER_BYTES + payload.byteLength);
  const view = new DataView(buf);
  view.setUint8(0, FRAME_MAGIC);
  view.setUint32(1, msgId >>> 0);
  view.setUint16(5, index);
  view.setUint16(7, total);
  new Uint8Array(buf, HEADER_BYTES).set(payload);
  return buf;
}

/** Lê um quadro. Devolve `null` se não for nosso formato — nunca lança em dado malformado. */
export function decodeFrame(data: ArrayBuffer): { header: FrameHeader; payload: Uint8Array } | null {
  if (!data || data.byteLength < HEADER_BYTES) return null;
  const view = new DataView(data);
  if (view.getUint8(0) !== FRAME_MAGIC) return null;

  const header: FrameHeader = {
    msgId: view.getUint32(1),
    index: view.getUint16(5),
    total: view.getUint16(7),
  };
  // Índice fora do total indica quadro corrompido ou forjado.
  if (header.total === 0 || header.index >= header.total) return null;

  return { header, payload: new Uint8Array(data.slice(HEADER_BYTES)) };
}

/** Divide um payload em pedaços do tamanho de transporte. */
export function splitPayload(payload: Uint8Array, size = FRAGMENT_SIZE): Uint8Array[] {
  if (payload.byteLength === 0) return [payload];
  const partes: Uint8Array[] = [];
  for (let i = 0; i < payload.byteLength; i += size) {
    partes.push(payload.subarray(i, Math.min(i + size, payload.byteLength)));
  }
  return partes;
}

/**
 * Remonta mensagens fragmentadas.
 *
 * Um peer pode mandar duas mensagens grandes ao mesmo tempo, então o buffer é indexado por
 * `msgId`. Fragmentos duplicados são ignorados (a rede pode reentregar), e conjuntos parados
 * há muito tempo são descartados — sem isso, um envio interrompido no meio ficaria na memória
 * do receptor para sempre.
 */
export class Reassembler {
  private pendentes = new Map<number, { partes: (Uint8Array | undefined)[]; recebidos: number; total: number; atualizadoEm: number }>();

  public get pendingCount(): number {
    return this.pendentes.size;
  }

  /** Devolve o payload completo quando o último fragmento chega; `null` enquanto falta algum. */
  public accept(header: FrameHeader, payload: Uint8Array, agora = Date.now()): Uint8Array | null {
    this.expire(agora);

    let entrada = this.pendentes.get(header.msgId);
    if (!entrada) {
      entrada = { partes: new Array(header.total), recebidos: 0, total: header.total, atualizadoEm: agora };
      this.pendentes.set(header.msgId, entrada);
    }
    // Total divergente para o mesmo id: quadro inconsistente, descarta o conjunto.
    if (entrada.total !== header.total) {
      this.pendentes.delete(header.msgId);
      return null;
    }

    if (entrada.partes[header.index] === undefined) {
      entrada.partes[header.index] = payload;
      entrada.recebidos++;
    }
    entrada.atualizadoEm = agora;

    if (entrada.recebidos < entrada.total) return null;

    this.pendentes.delete(header.msgId);
    const tamanho = entrada.partes.reduce((n, p) => n + (p?.byteLength ?? 0), 0);
    const completo = new Uint8Array(tamanho);
    let offset = 0;
    for (const parte of entrada.partes) {
      if (!parte) return null; // defensivo: não deveria acontecer com recebidos === total
      completo.set(parte, offset);
      offset += parte.byteLength;
    }
    return completo;
  }

  public expire(agora = Date.now()): number {
    let removidos = 0;
    for (const [id, entrada] of this.pendentes) {
      if (agora - entrada.atualizadoEm > REASSEMBLY_TIMEOUT_MS) {
        this.pendentes.delete(id);
        removidos++;
      }
    }
    return removidos;
  }

  public clear(): void {
    this.pendentes.clear();
  }
}

/** O navegador tem compressão nativa? Sem ela, o transporte segue funcionando sem comprimir. */
export function hasNativeCompression(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

export async function gzip(data: Uint8Array): Promise<Uint8Array> {
  if (!hasNativeCompression()) return data;
  const stream = new Blob([data as BufferSource]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  if (!hasNativeCompression()) return data;
  const stream = new Blob([data as BufferSource]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

let proximoMsgId = 1;

/**
 * Prepara uma mensagem para envio.
 *
 * Mensagens pequenas (a esmagadora maioria: posição de jogador, um bloco alterado) continuam
 * indo como texto puro — comprimir 200 bytes custaria mais do que economiza, e mantém
 * compatibilidade com peers de versão anterior.
 */
export async function encodeMessage(msg: unknown): Promise<string | ArrayBuffer[]> {
  const json = JSON.stringify(msg);
  if (json.length < FRAGMENT_THRESHOLD) return json;

  const bruto = new TextEncoder().encode(json);
  const comprimido = await gzip(bruto);
  const msgId = proximoMsgId++;
  const partes = splitPayload(comprimido);

  return partes.map((parte, i) => encodeFrame(msgId, i, partes.length, parte));
}

/** Converte o payload remontado de volta em mensagem. */
export async function decodePayload(payload: Uint8Array): Promise<unknown> {
  const descomprimido = await gunzip(payload);
  return JSON.parse(new TextDecoder().decode(descomprimido));
}

/** Timeout e retry com backoff no wrapper de rede — item 772 P1. */
export async function executeWithTimeoutAndBackoff<T>(
  task: () => Promise<T>,
  maxRetries = 3,
  timeoutMs = 5000,
): Promise<T> {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms atingido`)), timeoutMs);
      });
      return await Promise.race([task(), timeoutPromise]);
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) throw err;
      const delay = 200 * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Falha ao executar tarefa com retry');
}

/** Sanitizar resposta externa antes de exibir na UI ou chat — item 777 P1. */
export function sanitizeExternalApiResponse(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, '') // remove script tags
    .replace(/<[^>]+>/g, '') // remove HTML tags
    .replace(/javascript:/gi, '')
    .trim();
}

/** Cache de resposta por mod com TTL — item 781 P1. */
export class CachedApiResponseManager {
  private cache = new Map<string, { value: any; expiresAt: number }>();

  public set(modId: string, key: string, value: any, ttlMs = 60000): void {
    const cacheKey = `${modId}:${key}`;
    this.cache.set(cacheKey, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  public get(modId: string, key: string): any | null {
    const cacheKey = `${modId}:${key}`;
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }
    return entry.value;
  }

  public clearModCache(modId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${modId}:`)) {
        this.cache.delete(key);
      }
    }
  }
}

/** Mensagem clara quando a API falha por CORS — item 780 P1. */
export function detectCorsError(err: unknown, url?: string): { isCors: boolean; message: string } {
  const errStr = String(err).toLowerCase();
  const isCors =
    errStr.includes('failed to fetch') ||
    errStr.includes('cors') ||
    errStr.includes('networkerror') ||
    errStr.includes('access-control-allow-origin');

  if (isCors) {
    let host = 'servidor remoto';
    if (url) {
      try { host = new URL(url).host; } catch {}
    }
    return {
      isCors: true,
      message: `A requisição para ${host} falhou por restrição de CORS (Cross-Origin Resource Sharing). O navegador impede conexões de páginas locais a APIs que não declarem o cabeçalho 'Access-Control-Allow-Origin'.`,
    };
  }

  return {
    isCors: false,
    message: err instanceof Error ? err.message : String(err),
  };
}


