import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  Firestore,
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

let firestoreInstance: Firestore | null = null;

export function getFirestoreDb(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;

  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    let config: any = null;

    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        console.warn('[Firestore] Error reading config file, using fallback config');
      }
    } else if (process.env.FIREBASE_CONFIG) {
      try {
        config = JSON.parse(process.env.FIREBASE_CONFIG);
      } catch (e) {
        console.warn('[Firestore] Error parsing FIREBASE_CONFIG env');
      }
    }

    if (!config) {
      // Dedicated Firestore database for CAST Inspect (Cloudflare & Cloud Edition)
      config = {
        projectId: 'dark-forge-wcjpc',
        appId: '1:665970472995:web:c735e580267e5f66ca5996',
        apiKey: 'AIzaSyBcesdLO6fgKml_leAGhsnAh7ATy8Cz2yY',
        authDomain: 'dark-forge-wcjpc.firebaseapp.com',
        firestoreDatabaseId: 'ai-studio-cloudcastinspect-7edd1d9f-b3d0-4277-9e76-ef5604c7dfe2',
        storageBucket: 'dark-forge-wcjpc.firebasestorage.app',
        messagingSenderId: '665970472995',
      };
    }

    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    const dbId = config.firestoreDatabaseId || '(default)';
    firestoreInstance = initializeFirestore(app, {}, dbId);
    console.log(`[Firestore] Connected to database: ${dbId}`);
    return firestoreInstance;
  } catch (err: any) {
    console.error('[Firestore] Initialization error:', err.message);
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function loadCollectionFromFirestore<T>(collectionName: string): Promise<T[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  try {
    const fetchPromise = getDocs(collection(db, collectionName)).then((snapshot) =>
      snapshot.docs.map((d) => d.data() as T)
    );
    return await withTimeout(fetchPromise, 8000, []);
  } catch (err: any) {
    console.warn(`[Firestore] Failed to read collection ${collectionName}:`, err.message);
    return [];
  }
}

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

export async function saveDocumentToFirestore(
  collectionName: string,
  docId: string,
  data: any
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    const cleaned = cleanForFirestore(data);
    const savePromise = setDoc(doc(db, collectionName, docId), cleaned, { merge: true });
    await withTimeout(savePromise, 8000, undefined);
  } catch (err: any) {
    console.error(`[Firestore] Failed to write to ${collectionName}/${docId}:`, err.message);
  }
}

export async function deleteDocumentFromFirestore(
  collectionName: string,
  docId: string
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    const deletePromise = deleteDoc(doc(db, collectionName, docId));
    await withTimeout(deletePromise, 8000, undefined);
  } catch (err: any) {
    console.error(`[Firestore] Failed to delete from ${collectionName}/${docId}:`, err.message);
  }
}
