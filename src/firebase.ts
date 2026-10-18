import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use the dedicated databaseId if provided by Firebase provisioning
export const db = initializeFirestore(
  app,
  {},
  (firebaseConfig as any).firestoreDatabaseId || '(default)'
);
export const auth = getAuth(app);

export default app;
