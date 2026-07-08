/**
 * repoCache.ts — IndexedDB-backed cache for GitScape repo analysis results.
 *
 * Replaces the old localStorage approach which was limited to ~5 MB.
 * IndexedDB has no practical size limit, making it suitable for large digests.
 *
 * DB: "gitscape-db"  |  Store: "repo-outputs"  |  Key: repoUrl (string)
 *
 * Memory-leak guards:
 *   - CACHE_TTL_MS: entries older than this are evicted on read
 *   - sweepStaleEntries(): removes all expired entries (call once per session)
 *   - QuotaExceededError is caught on writes — cache miss is always safe to recover from
 */

import { CachedRepoOutput } from "../types";

const DB_NAME = "gitscape-db";
const STORE_NAME = "repo-outputs";
const DB_VERSION = 1;

/** Entries older than this are considered stale and evicted on read. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

/**
 * Retrieve cached output for a repo URL.
 * Returns null if not found or if the entry has exceeded CACHE_TTL_MS.
 * Stale entries are evicted lazily on read.
 */
export async function getCachedRepo(repoUrl: string): Promise<CachedRepoOutput | null> {
  try {
    const db = await openDB();
    const result: CachedRepoOutput | null = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(repoUrl);
      req.onsuccess = () => resolve((req.result as CachedRepoOutput) ?? null);
      req.onerror = () => reject(req.error);
    });
    if (!result) return null;
    // Lazy TTL eviction: stale entry → delete and return null
    if (Date.now() - result.timestamp > CACHE_TTL_MS) {
      deleteCachedRepo(repoUrl); // fire-and-forget
      return null;
    }
    return result;
  } catch (e) {
    console.warn("[repoCache] getCachedRepo failed:", e);
    return null;
  }
}

/**
 * Persist repo analysis output. Fire-and-forget — never throws.
 * Handles QuotaExceededError gracefully (cache miss on next read is safe).
 */
export async function setCachedRepo(repoUrl: string, data: CachedRepoOutput): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const record = { ...data, repoUrl };
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e: any) {
    if (e?.name === "QuotaExceededError") {
      // Disk quota hit — sweep stale entries and silently continue
      console.warn("[repoCache] QuotaExceededError — sweeping stale entries.");
      await sweepStaleEntries();
    } else {
      console.warn("[repoCache] setCachedRepo failed:", e);
    }
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

/**
 * Remove all entries whose timestamp is older than CACHE_TTL_MS.
 * Safe to call at session startup instead of clearCache() — preserves
 * recent results across tabs while evicting genuinely stale data.
 */
export async function sweepStaleEntries(): Promise<void> {
  try {
    const db = await openDB();
    const cutoff = Date.now() - CACHE_TTL_MS;

    // Collect keys of stale entries via the timestamp index
    const staleKeys: string[] = await new Promise((resolve, reject) => {
      const keys: string[] = [];
      const tx = db.transaction(STORE_NAME, "readonly");
      const index = tx.objectStore(STORE_NAME).index("timestamp");
      const range = IDBKeyRange.upperBound(cutoff); // timestamp <= cutoff → stale
      const req = index.openKeyCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          keys.push(cursor.primaryKey as string);
          cursor.continue();
        } else {
          resolve(keys);
        }
      };
      req.onerror = () => reject(req.error);
    });

    // Delete each stale entry
    for (const key of staleKeys) {
      await deleteCachedRepo(key);
    }

    if (staleKeys.length > 0) {
      console.info(`[repoCache] Swept ${staleKeys.length} stale cache entries.`);
    }
  } catch (e) {
    console.warn("[repoCache] sweepStaleEntries failed:", e);
  }
}
