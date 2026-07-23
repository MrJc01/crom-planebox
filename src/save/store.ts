// Persistência local (IndexedDB) do save comprimido.

const DB_NAME = 'crom-quadrado';
const STORE = 'saves';
const LOD_STORE = 'lod';

export interface StoredSave {
  format: 'crom' | 'raw';
  data: ArrayBuffer;
  originalSize: number;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(LOD_STORE)) db.createObjectStore(LOD_STORE);
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => { dbPromise = null; rej(req.error); };
  });
  return dbPromise;
}

// ---- cache de tiles de LOD (comprimidos com crompressor quando disponível) ----

export interface StoredTile {
  format: 'crom' | 'raw';
  data: ArrayBuffer;
}

export async function putLodTile(key: string, tile: StoredTile): Promise<void> {
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(LOD_STORE, 'readwrite');
    tx.objectStore(LOD_STORE).put(tile, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

export async function getLodTile(key: string): Promise<StoredTile | null> {
  const db = await openDb();
  const out = await new Promise<StoredTile | null>((res, rej) => {
    const tx = db.transaction(LOD_STORE, 'readonly');
    const req = tx.objectStore(LOD_STORE).get(key);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror = () => rej(req.error);
  });
  db.close();
  return out;
}

export async function putSave(save: StoredSave): Promise<void> {
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(save, 'world');
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

export async function getSave(): Promise<StoredSave | null> {
  const db = await openDb();
  const out = await new Promise<StoredSave | null>((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('world');
    req.onsuccess = () => res(req.result ?? null);
    req.onerror = () => rej(req.error);
  });
  db.close();
  return out;
}
