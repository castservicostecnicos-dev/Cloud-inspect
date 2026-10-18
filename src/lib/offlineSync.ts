import { Inspection } from '../types';
import {
  savePendingInspectionIDB,
  getPendingInspectionsIDB,
  removePendingInspectionIDB,
  cacheInspectionsIDB,
  getCachedInspectionsIDB,
  countPendingInspectionsIDB,
} from './indexedDb';
import { syncPendingToFirestore, subscribeSyncStatus, getSyncStatus, SyncStatus } from './syncEngine';

export type { SyncStatus };
export { subscribeSyncStatus, getSyncStatus, syncPendingToFirestore };

/**
 * Save an inspection to IndexedDB pending queue
 */
export async function savePendingInspection(inspection: Inspection): Promise<void> {
  try {
    await savePendingInspectionIDB(inspection);
  } catch (err) {
    console.error('Falha ao salvar no IndexedDB, tentando fallback:', err);
    // Fallback to localStorage if IndexedDB fails
    try {
      const raw = localStorage.getItem('cast_inspect_pending_sync');
      const list = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex((i: Inspection) => i.id === inspection.id);
      if (idx >= 0) list[idx] = inspection;
      else list.push(inspection);
      localStorage.setItem('cast_inspect_pending_sync', JSON.stringify(list));
    } catch (lsErr) {
      console.error('Fallback localStorage também falhou:', lsErr);
    }
  }
}

/**
 * Get all pending inspections from IndexedDB
 */
export async function getPendingInspections(): Promise<Inspection[]> {
  try {
    return await getPendingInspectionsIDB();
  } catch (err) {
    console.error('Erro ao ler pending inspections do IndexedDB:', err);
    try {
      const raw = localStorage.getItem('cast_inspect_pending_sync');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

/**
 * Remove an inspection from pending in IndexedDB
 */
export async function removePendingInspection(inspectionId: string): Promise<void> {
  try {
    await removePendingInspectionIDB(inspectionId);
  } catch (err) {
    console.error('Erro ao remover do IndexedDB:', err);
  }
}

/**
 * Cache inspections in IndexedDB
 */
export async function cacheInspectionLocally(inspection: Inspection): Promise<void> {
  try {
    await cacheInspectionsIDB([inspection]);
  } catch (err) {
    console.error('Erro ao armazenar em cache no IndexedDB:', err);
  }
}

/**
 * Get cached inspections from IndexedDB
 */
export async function getCachedInspections(companyId?: string): Promise<Inspection[]> {
  try {
    return await getCachedInspectionsIDB(companyId);
  } catch (err) {
    console.error('Erro ao ler cache do IndexedDB:', err);
    return [];
  }
}

/**
 * Count pending items in IndexedDB
 */
export async function getPendingCount(): Promise<number> {
  return await countPendingInspectionsIDB();
}
