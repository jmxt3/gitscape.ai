/**
 * repoCache.ts — IndexedDB-backed cache for GitScape repo analysis results.
 *
 * Replaces the old localStorage approach which was limited to ~5 MB.
 * IndexedDB has no practical size limit, making it suitable for large digests.
 *
 * DB: "gitscape-db"  |  Store: "repo-outputs"  |  Key: repoUrl (string)
 */

import { CachedRepoOutput } from "../types";

const DB_NAME = "gitscape-db";
const STORE_NAME = "repo-outputs";
const DB_VERSION = 1;

// ─── Open / upgrade ───────────────────────────────────────────────────────────

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "repoUrl" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      _dbPromise = null; // allow retry
      reject(req.error);
    };
  });
  return _dbPromise;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Retrieve cached output for a repo URL. Returns null if not found. */
export async function getCachedRepo(repoUrl: string): Promise<CachedRepoOutput | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(repoUrl);
      req.onsuccess = () => resolve((req.result as CachedRepoOutput) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("[repoCache] getCachedRepo failed:", e);
    return null;
  }
}

/** Persist repo analysis output. Fire-and-forget — never throws. */
export async function setCachedRepo(repoUrl: string, data: CachedRepoOutput): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      // Store with repoUrl as the explicit key path field
      const record = { ...data, repoUrl };
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[repoCache] setCachedRepo failed:", e);
  }
}

/** Remove cached entry for a specific repo URL. */
export async function deleteCachedRepo(repoUrl: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(repoUrl);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[repoCache] deleteCachedRepo failed:", e);
  }
}

/** Clear all cached entries in the store. */
export async function clearCache(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[repoCache] clearCache failed:", e);
  }
}
