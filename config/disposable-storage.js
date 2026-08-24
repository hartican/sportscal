(function attachDisposableStorage(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_DISPOSABLE_STORAGE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildDisposableStorage(){
  "use strict";

  const DB_NAME = "nothingsport-disposable-v1";
  const STORE_NAME = "entries";
  const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const DEFAULT_MAX_ENTRIES = 64;
  const FLUSH_DELAY_MS = 2000;

  function clone(value){
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function createStore({ indexedDB = globalThis.indexedDB, now = () => Date.now() } = {}){
    const memory = new Map();
    const pending = new Map();
    let timer = null;
    let databasePromise = null;

    function database(){
      if (databasePromise) return databasePromise;
      if (!indexedDB?.open) return Promise.resolve(null);
      databasePromise = new Promise(resolve => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "key" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      });
      return databasePromise;
    }

    async function flush(){
      if (timer !== null){
        clearTimeout(timer);
        timer = null;
      }
      if (!pending.size) return true;
      const db = await database();
      if (!db){
        pending.clear();
        return false;
      }
      const entries = Array.from(pending.values());
      pending.clear();
      return new Promise(resolve => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        entries.forEach(entry => store.put(entry));
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
        transaction.onabort = () => resolve(false);
      });
    }

    function scheduleFlush(){
      if (timer !== null) return;
      timer = setTimeout(() => { void flush(); }, FLUSH_DELAY_MS);
    }

    function set(key, value, { ttlMs = DEFAULT_TTL_MS } = {}){
      const record = {
        key: String(key),
        value: clone(value),
        updatedAt: now(),
        expiresAt: now() + Math.max(60_000, Number(ttlMs) || DEFAULT_TTL_MS),
      };
      memory.set(record.key, record);
      pending.set(record.key, record);
      scheduleFlush();
      return clone(value);
    }

    function initial(key, fallback){
      const record = memory.get(String(key));
      if (!record || record.expiresAt <= now()) return clone(fallback);
      return clone(record.value);
    }

    async function hydrate(key, fallback){
      const db = await database();
      if (!db) return initial(key, fallback);
      const record = await new Promise(resolve => {
        const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(String(key));
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
      if (!record || record.expiresAt <= now()) return initial(key, fallback);
      memory.set(String(key), record);
      return clone(record.value);
    }

    async function evictExpired({ maxEntries = DEFAULT_MAX_ENTRIES } = {}){
      const db = await database();
      if (!db) return 0;
      const records = await new Promise(resolve => {
        const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
      const expired = records.filter(record => record.expiresAt <= now());
      const retained = records
        .filter(record => record.expiresAt > now())
        .sort((first, second) => Number(second.updatedAt || 0) - Number(first.updatedAt || 0));
      const leastRecentlyUsed = retained.slice(Math.max(0, Number(maxEntries) || 0));
      const removals = [...expired, ...leastRecentlyUsed];
      if (!removals.length) return 0;
      await new Promise(resolve => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        removals.forEach(record => transaction.objectStore(STORE_NAME).delete(record.key));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      });
      removals.forEach(record => memory.delete(record.key));
      return removals.length;
    }

    return Object.freeze({ initial, hydrate, set, flush, evictExpired });
  }

  return Object.freeze({ DB_NAME, STORE_NAME, DEFAULT_TTL_MS, DEFAULT_MAX_ENTRIES, FLUSH_DELAY_MS, createStore });
});
