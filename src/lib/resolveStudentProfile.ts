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

/**
 * Resolve a student profile for the logged-in user.
 * Student records may use Firestore auto IDs while auth accounts use Firebase UIDs.
 */
export async function resolveStudentByAuthUser(
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
