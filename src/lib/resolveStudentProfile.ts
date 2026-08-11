import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Student } from '@/types/student';

export type ResolveStudentHints = {
  studentCode?: string;
  email?: string;
};

function toStudent(id: string, data: Record<string, unknown>): Student {
  return { id, ...data } as Student;
}

// Every home-page widget resolves its own student profile independently (up to 5
// sequential reads each on fallback). Cache by authUid so N widgets mounting together
// share one resolution instead of firing N in parallel — TTL matches useExamRoom's
// studentCtxCache convention.
const RESOLVE_CACHE_TTL_MS = 5 * 60 * 1000;
const resolveCache = new Map<string, { at: number; promise: Promise<Student | null> }>();

/**
 * Resolve a student profile for the logged-in user.
 * Student records may use Firestore auto IDs while auth accounts use Firebase UIDs.
 */
export function resolveStudentByAuthUser(
  authUid: string,
  hints?: ResolveStudentHints,
): Promise<Student | null> {
  const cached = resolveCache.get(authUid);
  if (cached && Date.now() - cached.at < RESOLVE_CACHE_TTL_MS) {
    return cached.promise;
  }
  const promise = resolveStudentByAuthUserUncached(authUid, hints);
  resolveCache.set(authUid, { at: Date.now(), promise });
  promise.catch(() => resolveCache.delete(authUid));
  return promise;
}

async function resolveStudentByAuthUserUncached(
  authUid: string,
  hints?: ResolveStudentHints,
): Promise<Student | null> {
  const directSnap = await getDoc(doc(db, 'students', authUid));
  if (directSnap.exists()) {
    return toStudent(directSnap.id, directSnap.data() as Record<string, unknown>);
  }

  const byAuthUidSnap = await getDocs(
    query(collection(db, 'students'), where('authUid', '==', authUid), limit(1)),
  );
  if (!byAuthUidSnap.empty) {
    const first = byAuthUidSnap.docs[0];
    return toStudent(first.id, first.data() as Record<string, unknown>);
  }

  const byUserIdSnap = await getDocs(
    query(collection(db, 'students'), where('userId', '==', authUid), limit(1)),
  );
  if (!byUserIdSnap.empty) {
    const first = byUserIdSnap.docs[0];
    return toStudent(first.id, first.data() as Record<string, unknown>);
  }

  const studentCode = hints?.studentCode?.trim();
  if (studentCode) {
    const byCodeSnap = await getDocs(
      query(collection(db, 'students'), where('studentCode', '==', studentCode), limit(1)),
    );
    if (!byCodeSnap.empty) {
      const first = byCodeSnap.docs[0];
      return toStudent(first.id, first.data() as Record<string, unknown>);
    }
  }

  const email = hints?.email?.trim().toLowerCase();
  if (email) {
    const byEmailSnap = await getDocs(
      query(collection(db, 'students'), where('email', '==', email), limit(1)),
    );
    if (!byEmailSnap.empty) {
      const first = byEmailSnap.docs[0];
      return toStudent(first.id, first.data() as Record<string, unknown>);
    }
  }

  return null;
}
