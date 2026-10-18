import { Inspection } from '../types';

const DB_NAME = 'cast_inspect_offline_db';
const DB_VERSION = 1;

const STORE_PENDING = 'pending_inspections';
const STORE_CACHED = 'cached_inspections';
const STORE_META = 'offline_meta';

// Helper to open IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB não é suportado neste ambiente.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store for inspections created/edited offline waiting to be synced to Firestore
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        const pendingStore = db.createObjectStore(STORE_PENDING, { keyPath: 'id' });
        pendingStore.createIndex('companyId', 'companyId', { unique: false });
        pendingStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Store for locally cached inspections to allow offline viewing & drafting
      if (!db.objectStoreNames.contains(STORE_CACHED)) {
        const cachedStore = db.createObjectStore(STORE_CACHED, { keyPath: 'id' });
        cachedStore.createIndex('companyId', 'companyId', { unique: false });
      }

      // Store for metadata (last sync time, sync flags, counters)
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Erro ao abrir o banco IndexedDB.'));
    };
  });
}

/**
 * Save an inspection to the offline pending queue in IndexedDB
 */
export async function savePendingInspectionIDB(inspection: Inspection): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PENDING, STORE_CACHED], 'readwrite');
    const pendingStore = tx.objectStore(STORE_PENDING);
    const cachedStore = tx.objectStore(STORE_CACHED);

    const dataToSave = {
      ...inspection,
      syncStatus: 'pending_sync' as const,
      offlineSavedAt: new Date().toISOString(),
    };

    pendingStore.put(dataToSave);
    cachedStore.put(dataToSave);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Get all pending offline inspections awaiting Firestore synchronization
 */
export async function getPendingInspectionsIDB(): Promise<Inspection[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readonly');
    const store = tx.objectStore(STORE_PENDING);
    const request = store.getAll();

    request.onsuccess = () => {
      db.close();
      resolve((request.result as Inspection[]) || []);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Count how many inspections are waiting in the offline queue
 */
export async function countPendingInspectionsIDB(): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, 'readonly');
      const store = tx.objectStore(STORE_PENDING);
      const request = store.count();

      request.onsuccess = () => {
        db.close();
        resolve(request.result || 0);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch {
    return 0;
  }
}

/**
 * Remove an inspection from the pending queue after successful sync to Firestore
 */
export async function removePendingInspectionIDB(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite');
    const store = tx.objectStore(STORE_PENDING);
    store.delete(id);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Cache inspections locally in IndexedDB for offline access
 */
export async function cacheInspectionsIDB(inspections: Inspection[]): Promise<void> {
  if (!inspections || inspections.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHED, 'readwrite');
    const store = tx.objectStore(STORE_CACHED);

    for (const insp of inspections) {
      store.put(insp);
    }

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Get all cached inspections (optionally filtered by company)
 */
export async function getCachedInspectionsIDB(companyId?: string): Promise<Inspection[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CACHED, 'readonly');
      const store = tx.objectStore(STORE_CACHED);
      const request = store.getAll();

      request.onsuccess = () => {
        db.close();
        let list = (request.result as Inspection[]) || [];
        if (companyId) {
          list = list.filter((i) => i.companyId === companyId);
        }
        resolve(list);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (err) {
    console.error('Erro ao ler cache do IndexedDB:', err);
    return [];
  }
}

/**
 * Clear all pending inspections from IndexedDB
 */
export async function clearPendingInspectionsIDB(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite');
    const store = tx.objectStore(STORE_PENDING);
    store.clear();

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Save meta value (e.g., lastSyncTime)
 */
export async function saveMetaIDB(key: string, value: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    const store = tx.objectStore(STORE_META);
    store.put({ key, value, timestamp: new Date().toISOString() });

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Read meta value
 */
export async function getMetaIDB(key: string): Promise<any> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const request = store.get(key);

      request.onsuccess = () => {
        db.close();
        resolve(request.result?.value ?? null);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch {
    return null;
  }
}
