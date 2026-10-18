import {
  getPendingInspectionsIDB,
  removePendingInspectionIDB,
  countPendingInspectionsIDB,
  saveMetaIDB,
  getMetaIDB,
  cacheInspectionsIDB,
} from './indexedDb';
import { FirestoreService } from './firestoreSync';
import { Inspection } from '../types';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastSyncError: string | null;
}

let syncStatus: SyncStatus = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncTime: null,
  lastSyncError: null,
};

type StatusListener = (status: SyncStatus) => void;
const listeners = new Set<StatusListener>();

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener({ ...syncStatus });
    } catch (err) {
      console.error('Error in sync listener:', err);
    }
  }
}

/**
 * Subscribe to sync engine status updates
 */
export function subscribeSyncStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  // Emit current state immediately
  listener({ ...syncStatus });
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

/**
 * Trigger manual or automatic synchronization of pending IndexedDB inspections
 * with Firestore and the central backend.
 */
export async function syncPendingToFirestore(): Promise<{
  successCount: number;
  failedCount: number;
}> {
  if (syncStatus.isSyncing) {
    return { successCount: 0, failedCount: 0 };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    syncStatus.isOnline = false;
    notifyListeners();
    return { successCount: 0, failedCount: 0 };
  }

  syncStatus.isSyncing = true;
  syncStatus.lastSyncError = null;
  notifyListeners();

  let successCount = 0;
  let failedCount = 0;

  try {
    const pendingInspections = await getPendingInspectionsIDB();
    syncStatus.pendingCount = pendingInspections.length;
    notifyListeners();

    if (pendingInspections.length === 0) {
      syncStatus.isSyncing = false;
      notifyListeners();
      return { successCount: 0, failedCount: 0 };
    }

    console.log(`[SyncEngine] Iniciando sincronização de ${pendingInspections.length} vistorias offline com Firestore...`);

    for (const inspection of pendingInspections) {
      try {
        const payloadToSync: Inspection = {
          ...inspection,
          syncStatus: 'synced',
        };

        // 1. Sync directly to Firebase Firestore
        const firestoreOk = await FirestoreService.saveInspectionToFirestore(payloadToSync);
        if (!firestoreOk) {
          throw new Error('Falha ao gravar vistoria no Firestore.');
        }

        // 2. Also sync to central server database API (for local backups & reporting)
        try {
          await fetch('/api/inspections', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-company-id': inspection.companyId,
            },
            body: JSON.stringify(payloadToSync),
          });
        } catch (serverErr) {
          console.warn('[SyncEngine] Aviso: sincronizado com Firestore, API local indisponível no momento:', serverErr);
        }

        // 3. Remove from pending queue in IndexedDB
        await removePendingInspectionIDB(inspection.id);

        // 4. Update cached version with synced status
        await cacheInspectionsIDB([payloadToSync]);

        successCount++;
        syncStatus.pendingCount = Math.max(0, syncStatus.pendingCount - 1);
        notifyListeners();
      } catch (itemErr: any) {
        console.error(`[SyncEngine] Erro ao sincronizar vistoria ${inspection.id}:`, itemErr);
        failedCount++;
        syncStatus.lastSyncError = itemErr.message || 'Erro de sincronização';
      }
    }

    const now = new Date().toISOString();
    syncStatus.lastSyncTime = now;
    await saveMetaIDB('lastSyncTime', now);
  } catch (err: any) {
    console.error('[SyncEngine] Falha geral no processo de sincronização:', err);
    syncStatus.lastSyncError = err.message || 'Falha na conexão com o Firestore.';
  } finally {
    // Re-check exact count in IndexedDB
    syncStatus.pendingCount = await countPendingInspectionsIDB();
    syncStatus.isSyncing = false;
    notifyListeners();
  }

  return { successCount, failedCount };
}

/**
 * Initialize the synchronization engine and lifecycle listeners
 */
let isInitialized = false;
export function initSyncEngine() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // Load previous metadata
  getMetaIDB('lastSyncTime').then((time) => {
    if (time) syncStatus.lastSyncTime = time;
  });
  countPendingInspectionsIDB().then((cnt) => {
    syncStatus.pendingCount = cnt;
    notifyListeners();
  });

  // Reconnection event listener: Restabeleceu conexão -> sincroniza automaticamente
  window.addEventListener('online', () => {
    console.log('[SyncEngine] Conexão com a internet restabelecida! Executando sincronização com Firestore...');
    syncStatus.isOnline = true;
    notifyListeners();
    syncPendingToFirestore();
  });

  // Disconnection event listener
  window.addEventListener('offline', () => {
    console.log('[SyncEngine] Dispositivo desconectado da internet. Ativando modo offline (IndexedDB).');
    syncStatus.isOnline = false;
    notifyListeners();
  });

  // Background interval check (every 25 seconds) to sync pending items if online
  setInterval(async () => {
    if (navigator.onLine) {
      const count = await countPendingInspectionsIDB();
      syncStatus.pendingCount = count;
      if (count > 0 && !syncStatus.isSyncing) {
        syncPendingToFirestore();
      } else {
        notifyListeners();
      }
    }
  }, 25000);

  // Initial check if online on startup
  if (navigator.onLine) {
    setTimeout(() => {
      syncPendingToFirestore();
    }, 1500);
  }
}
