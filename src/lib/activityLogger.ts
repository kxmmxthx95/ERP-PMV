import {
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';

export type LogStatus = 'success' | 'warning' | 'error';
export type LogCategory = 'user' | 'system' | 'security' | 'academic' | 'data';

export interface LogEntry {
  action: string;
  status: LogStatus;
  category: LogCategory;
  user: string;
  uid: string | null;
  email: string | null;
  detail: string;
  route: string;
  targetId: string;
  metadata: Record<string, unknown>;
  timestamp: string; // ISO string
}

type LogEventInput = {
  action: string;
  status?: LogStatus;
  category?: LogCategory;
  route?: string;
  targetId?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
  actorEmail?: string;
  actorUid?: string;
  actorName?: string;
};

function safeUserLabel(): string {
  const state = useAuthStore.getState();
  return (
    state.userData?.name
    || state.userData?.displayName
    || auth.currentUser?.email
    || 'Unknown User'
  );
}

function shouldSkipDuplicate(action: string, route?: string) {
  const key = `usage_log_last_${action}_${route ?? '-'}`;
  const now = Date.now();
  const raw = localStorage.getItem(key);
  const last = raw ? Number(raw) : 0;
  if (Number.isFinite(last) && now - last < 30_000) return true;
  localStorage.setItem(key, String(now));
  return false;
}

// Document ID: "uid_YYYY-MM-DD"  e.g. "abc123_2026-05-11"
function getDailyDocId(uid: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${uid}_${today}`;
}

export async function logActivity(event: LogEventInput): Promise<void> {
  try {
    const uid = event.actorUid ?? auth.currentUser?.uid ?? null;
    const email = event.actorEmail ?? auth.currentUser?.email ?? null;
    const user = event.actorName ?? safeUserLabel();
    const status = event.status ?? 'success';
    const category = event.category ?? 'user';

    if (!uid && event.action !== 'login_failed') return;
    if (event.action.startsWith('page_view') && shouldSkipDuplicate(event.action, event.route)) return;

    const entry: LogEntry = {
      action: event.action,
      status,
      category,
      user,
      uid,
      email,
      detail: event.detail ?? '',
      route: event.route ?? '',
      targetId: event.targetId ?? '',
      metadata: event.metadata ?? {},
      timestamp: new Date().toISOString(),
    };

    const safeUid = uid ?? 'anonymous';
    const docId = getDailyDocId(safeUid);
    const docRef = doc(db, 'daily_logs', docId);
    const today = new Date().toISOString().slice(0, 10);

    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, {
        entries: arrayUnion(entry),
        updatedAt: serverTimestamp(),
        count: (snap.data().count ?? 0) + 1,
      });
    } else {
      await setDoc(docRef, {
        uid: safeUid,
        email,
        user,
        date: today,
        entries: [entry],
        count: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Non-blocking logging
  }
}
