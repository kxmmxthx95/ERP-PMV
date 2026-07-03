import { getApp, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/** ต้องตรงกับ VITE_FIRESTORE_DATABASE_ID ในแอป (default: pmv1) */
const DEFAULT_DATABASE_ID = "pmv1";

let cachedDb: Firestore | null = null;

function ensureAdminApp() {
  try {
    getApp();
  } catch {
    initializeApp();
  }
}

export function getFirestoreDatabaseId(): string {
  const databaseId = (process.env.FIRESTORE_DATABASE_ID ?? DEFAULT_DATABASE_ID).trim();
  return databaseId && databaseId !== "(default)" ? databaseId : "(default)";
}

export function getAdminFirestore(): Firestore {
  if (cachedDb) return cachedDb;

  ensureAdminApp();
  const app = getApp();
  const databaseId = getFirestoreDatabaseId();
  cachedDb =
    databaseId !== "(default)"
      ? getFirestore(app, databaseId)
      : getFirestore(app);

  return cachedDb;
}
