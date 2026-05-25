import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  CreateFeedbackInput,
  FeedbackStatus,
  StudentFeedback,
} from '@/types/feedback';

const FEEDBACK_COL = 'student_feedback';
const ANON_LIMIT_COL = 'feedback_anonymous_limits';

function mapFeedback(id: string, raw: Record<string, unknown>): StudentFeedback {
  const statusRaw = raw.status;
  const status: FeedbackStatus =
    statusRaw === 'in_progress' || statusRaw === 'resolved' ? statusRaw : 'new';

  const modeRaw = raw.mode;
  const mode = modeRaw === 'anonymous' ? 'anonymous' : 'identified';

  const categoryRaw = raw.category;
  const category =
    categoryRaw === 'academic' || categoryRaw === 'facilities' || categoryRaw === 'cafeteria'
      ? categoryRaw
      : 'general';

  return {
    id,
    mode,
    category,
    message: typeof raw.message === 'string' ? raw.message : '',
    status,
    gradeLevel: typeof raw.gradeLevel === 'string' ? raw.gradeLevel : 'ไม่ระบุ',
    department: typeof raw.department === 'string' ? raw.department : 'ไม่ระบุ',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    studentId: typeof raw.studentId === 'string' ? raw.studentId : null,
    studentName: typeof raw.studentName === 'string' ? raw.studentName : null,
    adminNote: typeof raw.adminNote === 'string' ? raw.adminNote : null,
  };
}

function byDateDesc(a: StudentFeedback, b: StudentFeedback) {
  const aSec = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
  const bSec = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
  return bSec - aSec;
}

export function useFeedbackStream() {
  const [items, setItems] = useState<StudentFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, FEEDBACK_COL), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs.map((d) => mapFeedback(d.id, d.data() as Record<string, unknown>));
        setItems(mapped);
        setLoading(false);
      },
      () => {
        setItems([]);
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  return { items, loading };
}

export function useVisibleFeedbackTimeline(role?: string, canViewAll?: boolean) {
  const { items, loading } = useFeedbackStream();

  const visibleItems = useMemo(() => {
    if (canViewAll || role === 'admin' || role === 'sysadmin') return items;
    return items.filter((f) => f.status !== 'new');
  }, [canViewAll, items, role]);

  return { items: visibleItems, loading };
}

export function useMyIdentifiedFeedback(userId?: string) {
  const { items, loading } = useFeedbackStream();
  const mine = useMemo(() => {
    if (!userId) return [];
    return items.filter((f) => f.studentId === userId).sort(byDateDesc);
  }, [items, userId]);
  return { items: mine, loading };
}

export function useFeedbackActions() {
  const createFeedback = useCallback(async (userId: string, input: CreateFeedbackInput) => {
    const newRef = doc(collection(db, FEEDBACK_COL));
    const nowDay = new Date().toISOString().slice(0, 10);

    await runTransaction(db, async (tx) => {
      if (input.mode === 'anonymous') {
        const limitRef = doc(db, ANON_LIMIT_COL, `${userId}_${nowDay}`);
        const limitSnap = await tx.get(limitRef);
        if (limitSnap.exists()) {
          throw new Error('วันนี้คุณส่งความคิดเห็นแบบไม่ระบุตัวตนไปแล้ว 1 ครั้ง');
        }

        tx.set(limitRef, {
          dayKey: nowDay,
          createdAt: serverTimestamp(),
        });

        tx.set(newRef, {
          mode: 'anonymous',
          category: input.category,
          message: input.message.trim(),
          gradeLevel: input.gradeLevel || 'ไม่ระบุ',
          department: input.department || 'ไม่ระบุ',
          status: 'new',
          adminNote: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return;
      }

      tx.set(newRef, {
        mode: 'identified',
        category: input.category,
        message: input.message.trim(),
        gradeLevel: input.gradeLevel || 'ไม่ระบุ',
        department: input.department || 'ไม่ระบุ',
        studentId: userId,
        studentName: input.studentName ?? null,
        status: 'new',
        adminNote: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }, []);

  const updateFeedbackStatus = useCallback(async (feedbackId: string, status: FeedbackStatus, adminNote?: string) => {
    const targetRef = doc(db, FEEDBACK_COL, feedbackId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(targetRef);
      if (!snap.exists()) return;
      tx.update(targetRef, {
        status,
        adminNote: adminNote?.trim() || null,
        updatedAt: serverTimestamp(),
      });
    });
  }, []);

  return { createFeedback, updateFeedbackStatus };
}
