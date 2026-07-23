// Ponte com o CROMPRESSOR (github.com/MrJc01/crompressor) compilado para WASM.
// Comprime os saves em modo Archive (lossless: SHA-256 igual após round-trip).
// Se o WASM não estiver disponível, cai para saves sem compressão ("raw").

declare global {
  interface Window {
    Go: new () => { importObject: WebAssembly.Imports; run(inst: WebAssembly.Instance): Promise<void> };
    cromPack?: (data: Uint8Array) => { ok: boolean; data?: Uint8Array; error?: string };
    cromUnpack?: (data: Uint8Array) => { ok: boolean; data?: Uint8Array; error?: string };
  }
}

let ready = false;
let loading: Promise<boolean> | null = null;

export function cromAvailable(): boolean { return ready; }

export function loadCrom(): Promise<boolean> {
  if (loading) return loading;
  loading = (async () => {
    try {
      // wasm_exec.js do toolchain Go define window.Go
      await new Promise<void>((res, rej) => {
        const s = document.createElement('script');
        s.src = '/crom/wasm_exec.js';
        s.onload = () => res();
        s.onerror = () => rej(new Error('wasm_exec.js não encontrado'));
        document.head.appendChild(s);
      });
      const go = new window.Go();
      const resp = await fetch('/crom/crompressor.wasm');
      if (!resp.ok) throw new Error('crompressor.wasm não encontrado');
      const { instance } = await WebAssembly.instantiateStreaming(resp, go.importObject);
      void go.run(instance); // roda para sempre (mantém as funções exportadas vivas)
      // espera as funções aparecerem
      for (let i = 0; i < 50 && !window.cromPack; i++) {
        await new Promise((r) => setTimeout(r, 20));
      }
      ready = !!window.cromPack;
      if (ready) console.log('[crom] crompressor WASM pronto');
      return ready;
    } catch (e) {
      console.warn('[crom] WASM indisponível, saves sem compressão:', e);
      return false;
    }
  })();
  return loading;
}

export function cromPack(data: Uint8Array): Uint8Array | null {
  if (!ready || !window.cromPack) return null;
  const r = window.cromPack(data);
  if (!r.ok || !r.data) { console.warn('[crom] pack falhou:', r.error); return null; }
  return r.data;
}

export function cromUnpack(data: Uint8Array): Uint8Array | null {
  if (!ready || !window.cromUnpack) return null;
  const r = window.cromUnpack(data);
  if (!r.ok || !r.data) { console.warn('[crom] unpack falhou:', r.error); return null; }
  return r.data;
}
