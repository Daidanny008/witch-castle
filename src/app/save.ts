import { content } from "../content";
import { migrate, type GameState } from "../sim";

const DB_NAME = "witch-castle";
const STORE = "saves";
const KEY = "current";
const BACKUP_KEY = "witch-castle:save";
const FORMAT = "witch-castle-save";

export interface SaveEnvelope {
  format: typeof FORMAT;
  savedAt: number; // wall-clock ms, only used to pick the newest copy
  state: GameState;
}

function envelope(state: GameState): SaveEnvelope {
  return { format: FORMAT, savedAt: Date.now(), state };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(): Promise<SaveEnvelope | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result as SaveEnvelope | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(env: SaveEnvelope): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(env, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function readBackup(): SaveEnvelope | undefined {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    return raw ? (JSON.parse(raw) as SaveEnvelope) : undefined;
  } catch {
    return undefined;
  }
}

/** Saves to IndexedDB and a synchronous localStorage copy (which survives a tab closing mid-write). */
export async function save(state: GameState): Promise<void> {
  const env = envelope(state);
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(env));
  } catch {
    // Storage full or blocked; IndexedDB below is the main copy.
  }
  try {
    await idbPut(env);
  } catch {
    // IndexedDB unavailable (for example some private windows); the localStorage copy remains.
  }
}

/** Synchronous save for page-hide, when async work may be cut off. */
export function saveNow(state: GameState): void {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(envelope(state)));
  } catch {
    // Nothing more we can do while the page is closing.
  }
  void idbPut(envelope(state)).catch(() => {});
}

export interface LoadResult {
  state?: GameState;
  /** Set when a save existed but couldn't be loaded. A copy was kept under `keptAs`. */
  problem?: string;
  keptAs?: string;
}

/**
 * Loads the newest valid save from either store. If saves exist but none can be loaded, a copy of the
 * newest is kept under its own key before a new game starts, so it is never silently overwritten.
 */
export async function load(): Promise<LoadResult> {
  let fromDb: SaveEnvelope | undefined;
  try {
    fromDb = await idbGet();
  } catch {
    fromDb = undefined;
  }
  const candidates = [fromDb, readBackup()].filter((e): e is SaveEnvelope => e?.format === FORMAT);
  candidates.sort((a, b) => b.savedAt - a.savedAt);
  let firstError = "";
  for (const c of candidates) {
    try {
      return { state: migrate(c.state, content) };
    } catch (e) {
      firstError ||= e instanceof Error ? e.message : String(e);
    }
  }
  if (candidates.length === 0) return {};
  const keptAs = `witch-castle:unloadable:${new Date().toISOString()}`;
  try {
    localStorage.setItem(keptAs, JSON.stringify(candidates[0]));
  } catch {
    // Storage full: nothing more we can do.
  }
  return { problem: firstError, keptAs };
}

export async function clearSave(): Promise<void> {
  try {
    localStorage.removeItem(BACKUP_KEY);
  } catch {
    // ignore
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

/** Asks the browser not to evict our storage when space runs low. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export function exportSave(state: GameState): string {
  return JSON.stringify(envelope(state), null, 2);
}

export function importSave(text: string): GameState {
  const parsed = JSON.parse(text) as Partial<SaveEnvelope>;
  if (parsed.format !== FORMAT) throw new Error("That file isn't a Witch Castle save.");
  return migrate(parsed.state, content);
}
