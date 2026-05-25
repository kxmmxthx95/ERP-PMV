// src/hooks/useSetQuestions.ts
// Manages questions inside ONE question set via subcollection.
// Subscribes only when a set is actively open — no global reads.
//
// Firestore path: question_sets/{setId}/questions/{questionId}
import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { QUESTION_SETS_COL } from '@/hooks/useQuestionSetBank';
import type { Question, NewQuestion } from '@/types/questionBank';

function questionsCol(setId: string) {
  return collection(db, QUESTION_SETS_COL, setId, 'questions');
}

function questionDoc(setId: string, questionId: string) {
  return doc(db, QUESTION_SETS_COL, setId, 'questions', questionId);
}

export function useSetQuestions(setId: string | null) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!setId) {
      setQuestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsub = onSnapshot(
      questionsCol(setId),
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, setId, ...d.data() } as Question))
          .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
        setQuestions(rows);
        setIsLoading(false);
      },
      (err) => {
        console.error('[useSetQuestions]', err.message);
        setIsLoading(false);
      },
    );

    return () => {
      unsub();
      setQuestions([]);
    };
  }, [setId]);

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const addQuestion = async (
    data: NewQuestion,
    onCountChange: (delta: number) => Promise<void>,
  ): Promise<string> => {
    if (!setId) throw new Error('No setId');
    const now = Date.now();
    const payload: Omit<Question, 'id'> = {
      ...data,
      setId,
      orderIndex: data.orderIndex ?? questions.length,
      createdBy: user?.uid ?? 'unknown',
      createdByName: user?.displayName ?? user?.email ?? '',
      createdAt: now,
      updatedAt: now,
    };

    const sanitized = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined),
    );

    try {
      const ref = await addDoc(questionsCol(setId), sanitized as never);
      // Update parent set's questionCount
      await onCountChange(1);
      toast.success('เพิ่มข้อสอบเรียบร้อยแล้ว');
      return ref.id;
    } catch (e) {
      console.error('[addQuestion]', e);
      toast.error('ไม่สามารถเพิ่มข้อสอบได้');
      throw e;
    }
  };

  const updateQuestion = async (questionId: string, patch: Partial<Question>) => {
    if (!setId) return;
    const sanitized = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    try {
      await updateDoc(questionDoc(setId, questionId), {
        ...sanitized,
        updatedAt: Date.now(),
      } as never);
      toast.success('บันทึกข้อสอบเรียบร้อยแล้ว');
    } catch (e) {
      console.error('[updateQuestion]', e);
      toast.error('ไม่สามารถบันทึกข้อสอบได้');
      throw e;
    }
  };

  const deleteQuestion = async (
    questionId: string,
    onCountChange: (delta: number) => Promise<void>,
  ) => {
    if (!setId) return;
    try {
      await deleteDoc(questionDoc(setId, questionId));
      await onCountChange(-1);
      toast.success('ลบข้อสอบออกจากชุดเรียบร้อยแล้ว');
    } catch (e) {
      console.error('[deleteQuestion]', e);
      toast.error('ไม่สามารถลบข้อสอบได้');
      throw e;
    }
  };

  // Reorder all questions at once using a batch write
  const reorderQuestions = async (orderedIds: string[]) => {
    if (!setId) return;
    const batch = writeBatch(db);
    orderedIds.forEach((qId, idx) => {
      batch.update(questionDoc(setId, qId), { orderIndex: idx, updatedAt: Date.now() });
    });
    try {
      await batch.commit();
    } catch (e) {
      console.error('[reorderQuestions]', e);
      toast.error('ไม่สามารถจัดลำดับข้อสอบได้');
      throw e;
    }
  };

  const duplicateQuestion = async (
    questionId: string,
    onCountChange: (delta: number) => Promise<void>,
  ) => {
    const src = questions.find((q) => q.id === questionId);
    if (!src || !setId) return;
    const { id: _id, createdAt: _ca, updatedAt: _ua, orderIndex: _oi, ...rest } = src;
    return addQuestion(
      { ...rest, orderIndex: questions.length } as NewQuestion,
      onCountChange,
    );
  };

  const bulkAddQuestions = async (
    dataList: NewQuestion[],
    onCountChange: (delta: number) => Promise<void>,
  ) => {
    if (!setId || dataList.length === 0) return;
    const batch = writeBatch(db);
    const now = Date.now();
    
    dataList.forEach((data, index) => {
      const qRef = doc(questionsCol(setId));
      const payload: Omit<Question, 'id'> = {
        ...data,
        setId,
        orderIndex: questions.length + index,
        createdBy: user?.uid ?? 'unknown',
        createdByName: user?.displayName ?? user?.email ?? '',
        createdAt: now,
        updatedAt: now,
      };

      const sanitized = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== undefined),
      );
      batch.set(qRef, sanitized);
    });

    try {
      await batch.commit();
      await onCountChange(dataList.length);
      toast.success(`นำเข้าข้อสอบ ${dataList.length} ข้อเรียบร้อยแล้ว`);
    } catch (e) {
      console.error('[bulkAddQuestions]', e);
      toast.error('ไม่สามารถนำเข้าข้อสอบได้');
      throw e;
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = questions.length;
    const easy = questions.filter((q) => q.difficulty === 'easy').length;
    const medium = questions.filter((q) => q.difficulty === 'medium').length;
    const hard = questions.filter((q) => q.difficulty === 'hard').length;
    const mc = questions.filter((q) => q.type === 'multiple_choice').length;
    const essay = questions.filter((q) => q.type === 'essay').length;
    return { total, easy, medium, hard, mc, essay };
  }, [questions]);

  return {
    isLoading,
    questions,
    stats,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    duplicateQuestion,
    reorderQuestions,
    bulkAddQuestions,
  };
}
