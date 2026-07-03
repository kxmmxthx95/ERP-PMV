import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

/** ฐานข้อมูล Firestore หลักของโปรเจกต — ต้องตรงกับ Firebase Console และ FIRESTORE_DATABASE_ID ใน functions */
export const FIRESTORE_DATABASE_ID = 'pmv1';

const configuredDatabaseId = (import.meta.env.VITE_FIRESTORE_DATABASE_ID || FIRESTORE_DATABASE_ID).trim();
const useNamedDatabase = configuredDatabaseId.length > 0 && configuredDatabaseId !== '(default)';

// long polling สำหรับ named database (pmv1) — ไม่ใช้ memoryLocalCache เพื่อให้ getDocs อ่าน network ได้เสมอ
const firestoreSettings = {
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: false,
};

export const auth = getAuth(app);
export const db = useNamedDatabase
  ? initializeFirestore(app, firestoreSettings, configuredDatabaseId)
  : initializeFirestore(app, firestoreSettings);

if (import.meta.env.DEV) {
  console.info('[firebase] Firestore:', useNamedDatabase ? configuredDatabaseId : '(default)');
}
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
export const functions = getFunctions(app, "asia-southeast1");

export default app;
