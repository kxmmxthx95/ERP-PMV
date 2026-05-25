import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  query, where, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import type { LessonPlan, NewLessonPlan, LessonPlanStatus } from '@/types/lessonPlan';

export function useLessonPlan(teacherId: string, departmentId?: string) {
  const { activeYear, activeSemester } = useActiveAcademicYear();
  const [plans, setPlans]     = useState<LessonPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!activeYear || !activeSemester || !teacherId) {
      setPlans([]);
      setLoading(false);
      return;
    }

    const constraints = [
      where('academicYearId', '==', activeYear.year),
      where('semester', '==', activeSemester),
      where('teacherId', '==', teacherId),
    ];

    if (departmentId) {
      constraints.push(where('departmentId', '==', departmentId));
    }

    const q = query(
      collection(db, 'lesson_plans'),
      ...constraints,
      orderBy('weekNumber', 'asc'),
    );

    const unsub = onSnapshot(
      q,
      snap => {
        setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() }) as LessonPlan));
        setLoading(false);
      },
      err => {
        console.error('useLessonPlan:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, [activeYear, activeSemester, teacherId, departmentId]);

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const createPlan = async (data: NewLessonPlan) => {
    const now = new Date().toISOString();
    await addDoc(collection(db, 'lesson_plans'), {
      ...data,
      status: 'draft' as LessonPlanStatus,
      createdAt: now,
      updatedAt: now,
    });
  };

  const updatePlan = async (id: string, data: Partial<LessonPlan>) => {
    await updateDoc(doc(db, 'lesson_plans', id), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  };

  const deletePlan = async (id: string) => {
    await deleteDoc(doc(db, 'lesson_plans', id));
  };

  const submitPlan = (id: string) => updatePlan(id, { status: 'submitted' });
  const approvePlan = (id: string) => updatePlan(id, { status: 'approved' });
  const revertToDraft = (id: string) => updatePlan(id, { status: 'draft' });

  return {
    plans,
    loading,
    error,
    createPlan,
    updatePlan,
    deletePlan,
    submitPlan,
    approvePlan,
    revertToDraft,
  };
}
