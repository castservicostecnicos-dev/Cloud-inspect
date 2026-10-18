import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db as firestoreDb, auth } from '../firebase';
import { Company, User, Condominium, InspectionTemplate, Inspection } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Strips undefined properties recursively to conform to Firestore data model rules.
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === undefined) return undefined as any;
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => cleanForFirestore(item)) as any;
  }
  if (data instanceof Date) return data.toISOString() as any;
  if (data && typeof data === 'object' && (data as any).constructor?.name === 'FieldValue') {
    return data;
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      cleaned[key] = cleanForFirestore(value);
    }
  }
  return cleaned as T;
}

/**
 * Sync / Backup collections directly to Firebase Firestore
 * to ensure persistent storage across deploys and container rebuilds.
 */

export const FirestoreService = {
  // Sync full database state to Firestore
  async pushFullStateToFirestore(data: {
    companies?: Company[];
    users?: User[];
    condominiums?: Condominium[];
    templates?: InspectionTemplate[];
    inspections?: Inspection[];
  }) {
    try {
      // 1. Companies
      if (data.companies) {
        for (const comp of data.companies) {
          const path = `companies/${comp.id}`;
          try {
            await setDoc(doc(firestoreDb, 'companies', comp.id), cleanForFirestore({
              ...comp,
              updatedAt: serverTimestamp(),
            }), { merge: true });
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, path);
          }
        }
      }

      // 2. Users
      if (data.users) {
        for (const u of data.users) {
          const path = `users/${u.id}`;
          try {
            await setDoc(doc(firestoreDb, 'users', u.id), cleanForFirestore({
              ...u,
              updatedAt: serverTimestamp(),
            }), { merge: true });
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, path);
          }
        }
      }

      // 3. Condominiums
      if (data.condominiums) {
        for (const cond of data.condominiums) {
          const path = `condominiums/${cond.id}`;
          try {
            await setDoc(doc(firestoreDb, 'condominiums', cond.id), cleanForFirestore({
              ...cond,
              updatedAt: serverTimestamp(),
            }), { merge: true });
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, path);
          }
        }
      }

      // 4. Templates
      if (data.templates) {
        for (const tmpl of data.templates) {
          const path = `templates/${tmpl.id}`;
          try {
            await setDoc(doc(firestoreDb, 'templates', tmpl.id), cleanForFirestore({
              ...tmpl,
              updatedAt: serverTimestamp(),
            }), { merge: true });
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, path);
          }
        }
      }

      // 5. Inspections
      if (data.inspections) {
        for (const insp of data.inspections) {
          const path = `inspections/${insp.id}`;
          try {
            await setDoc(doc(firestoreDb, 'inspections', insp.id), cleanForFirestore({
              ...insp,
              updatedAt: serverTimestamp(),
            }), { merge: true });
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, path);
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Erro ao sincronizar com Firestore:', error);
      throw error;
    }
  },

  // Pull all data from Firestore
  async pullFullStateFromFirestore() {
    try {
      const companiesSnap = await getDocs(collection(firestoreDb, 'companies'));
      const companies = companiesSnap.docs.map((d) => d.data() as Company);

      const usersSnap = await getDocs(collection(firestoreDb, 'users'));
      const users = usersSnap.docs.map((d) => d.data() as User);

      const condsSnap = await getDocs(collection(firestoreDb, 'condominiums'));
      const condominiums = condsSnap.docs.map((d) => d.data() as Condominium);

      const tmplsSnap = await getDocs(collection(firestoreDb, 'templates'));
      const templates = tmplsSnap.docs.map((d) => d.data() as InspectionTemplate);

      const inspsSnap = await getDocs(collection(firestoreDb, 'inspections'));
      const inspections = inspsSnap.docs.map((d) => d.data() as Inspection);

      return {
        companies,
        users,
        condominiums,
        templates,
        inspections,
      };
    } catch (error) {
      console.error('Erro ao baixar dados do Firestore:', error);
      handleFirestoreError(error, OperationType.GET, 'all');
    }
  },

  // Clear templates and inspections in Firestore
  async clearTemplatesAndInspectionsInFirestore() {
    try {
      const tmplsSnap = await getDocs(collection(firestoreDb, 'templates'));
      for (const d of tmplsSnap.docs) {
        await deleteDoc(d.ref);
      }

      const inspsSnap = await getDocs(collection(firestoreDb, 'inspections'));
      for (const d of inspsSnap.docs) {
        await deleteDoc(d.ref);
      }

      return { success: true };
    } catch (error) {
      console.error('Erro ao limpar modelos e vistorias no Firestore:', error);
      handleFirestoreError(error, OperationType.DELETE, 'templates_and_inspections');
    }
  },

  // Save single inspection directly to Firestore
  async saveInspectionToFirestore(inspection: Inspection) {
    try {
      const cleaned = cleanForFirestore({
        ...inspection,
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(firestoreDb, 'inspections', inspection.id), cleaned, { merge: true });
      return true;
    } catch (err) {
      console.error('Falha ao salvar vistoria no Firestore:', err);
      return false;
    }
  },
};

