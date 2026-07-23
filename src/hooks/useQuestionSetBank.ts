// src/hooks/useQuestionSetBank.ts
// Manages question_sets collection (metadata only — no question content).
// Questions live in subcollection: question_sets/{setId}/questions/
import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import type { SubjectGroupId } from '@/types/curriculum';
import type { NewQuestionSet, QuestionSet } from '@/types/questionBank';
import { generateQuestionSetCode } from '@/features/questionBank/utils/questionSetCode';
import { deleteQuestionSetPdfStorage } from '@/lib/questionSetStorage';

export const QUESTION_SETS_COL = 'question_sets';

function creatorDisplayNameFromAuth(
  user: { displayName?: string | null; email?: string | null } | null | undefined,
  userData: Record<string, unknown> | null | undefined,
): string {
  const fromData = [
    userData?.name,
    userData?.displayName,
    userData?.fullName,
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .find(Boolean);
  if (fromData) return fromData;
  const fromAuth = user?.displayName?.trim();
  if (fromAuth) return fromAuth;
  return '';
}

export interface QuestionSetFilters {
  search?: string;
  subjectGroup?: SubjectGroupId | 'all';
  subSubjectGroup?: string | 'all';
  department?: string | 'all';
  gradeLevel?: string | 'all';
}

export function useQuestionSetBank() {
  const { user, userData } = useAuth();
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to question_sets collection (metadata only — lightweight)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, QUESTION_SETS_COL),
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as QuestionSet))
          .sort((a, b) => b.createdAt - a.createdAt);
        setQuestionSets(rows);
        setIsLoading(false);
      },
      (err) => {
        console.error('[useQuestionSetBank]', err.message);
        setIsLoading(false);
      },
    );
    return () => unsub();
  }, []);

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const addQuestionSet = async (data: NewQuestionSet) => {
    const now = Date.now();
    const setCode = generateQuestionSetCode(
      {
        curriculumYear: data.curriculumYear,
        department: data.department,
        gradeLevel: data.gradeLevel,
        subjectGroup: data.subjectGroup,
        subSubjectGroup: data.subSubjectGroup,
      },
      questionSets,
    );
    const payload: Omit<QuestionSet, 'id'> = {
      ...data,
      setCode,
      questionCount: 0,
      isPublished: data.isPublished ?? false,
      createdBy: user?.uid ?? 'unknown',
      createdByName: creatorDisplayNameFromAuth(user, userData),
      createdAt: now,
      updatedAt: now,
    };

    const sanitized = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined),
    );

    try {
      const ref = await addDoc(collection(db, QUESTION_SETS_COL), sanitized as never);
      toast.success('สร้างชุดข้อสอบเรียบร้อยแล้ว');
      return ref.id;
    } catch (e) {
      console.error('[addQuestionSet]', e);
      toast.error('ไม่สามารถสร้างชุดข้อสอบได้');
      throw e;
    }
  };

  const updateQuestionSet = async (id: string, patch: Partial<QuestionSet>) => {
    const sanitized = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    try {
      await updateDoc(doc(db, QUESTION_SETS_COL, id), {
        ...sanitized,
        updatedAt: Date.now(),
      } as never);
      toast.success('บันทึกชุดข้อสอบเรียบร้อยแล้ว');
    } catch (e) {
      console.error('[updateQuestionSet]', e);
      toast.error('ไม่สามารถบันทึกชุดข้อสอบได้');
      throw e;
    }
  };

  const setQuestionSetPublished = async (id: string, isPublished: boolean) => {
    try {
      await updateDoc(doc(db, QUESTION_SETS_COL, id), {
        isPublished,
        updatedAt: Date.now(),
      } as never);
      toast.success(isPublished ? 'เปิดให้นักเรียนเห็นแล้ว' : 'ปิดไม่ให้นักเรียนเห็นแล้ว');
    } catch (e) {
      console.error('[setQuestionSetPublished]', e);
      toast.error('ไม่สามารถเปลี่ยนสถานะการเผยแพร่ได้');
      throw e;
    }
  };

  const deleteQuestionSet = async (target: string | Pick<QuestionSet, 'id' | 'examPdfUrl'>) => {
    const id = typeof target === 'string' ? target : target.id;
    const examPdfUrl =
      typeof target === 'string'
        ? questionSets.find((s) => s.id === id)?.examPdfUrl
        : target.examPdfUrl;

    // Note: subcollection questions are NOT auto-deleted by Firestore client SDK.
    // For production, use a Cloud Function trigger to cascade-delete.
    try {
      await deleteQuestionSetPdfStorage(id, examPdfUrl);
    } catch (storageErr) {
      console.error('[deleteQuestionSet] storage cleanup failed', storageErr);
      toast.error('ลบไฟล์ PDF บน Storage ไม่สำเร็จ — ลองอีกครั้ง');
      throw storageErr;
    }

    try {
      await deleteDoc(doc(db, QUESTION_SETS_COL, id));
      toast.success('ลบชุดข้อสอบเรียบร้อยแล้ว');
    } catch (e) {
      console.error('[deleteQuestionSet]', e);
      toast.error('ไม่สามารถลบชุดข้อสอบได้');
      throw e;
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const filterQuestionSets = (filters: QuestionSetFilters) => {
    return questionSets.filter((set) => {
      if (
        filters.subjectGroup &&
        filters.subjectGroup !== 'all' &&
        set.subjectGroup !== filters.subjectGroup
      ) return false;

      if (
        filters.subSubjectGroup &&
        filters.subSubjectGroup !== 'all' &&
        set.subSubjectGroup !== filters.subSubjectGroup
      ) return false;

      if (
        filters.department &&
        filters.department !== 'all' &&
        set.department !== filters.department
      ) return false;

      if (
        filters.gradeLevel &&
        filters.gradeLevel !== 'all' &&
        set.gradeLevel !== filters.gradeLevel
      ) return false;

      if (filters.search) {
        const s = filters.search.toLowerCase();
        const inTitle = set.title.toLowerCase().includes(s);
        const inDesc = (set.description ?? '').toLowerCase().includes(s);
        const inCode = (set.setCode ?? '').toLowerCase().includes(s);
        if (!inTitle && !inDesc && !inCode) return false;
      }
      return true;
    }).sort((a, b) => a.title.localeCompare(b.title, 'th', { sensitivity: 'base' }));
  };

  const stats = useMemo(() => {
    const total = questionSets.length;
    const published = questionSets.filter((s) => s.isPublished).length;
    const draft = total - published;
    const totalQuestions = questionSets.reduce((sum, s) => sum + (s.questionCount ?? 0), 0);
    return { total, published, draft, totalQuestions };
  }, [questionSets]);

  const addQuestionSetsBulk = async (items: NewQuestionSet[]) => {
    if (items.length === 0) return [] as string[];

    const accumulated = [...questionSets];
    const createdIds: string[] = [];
    const now = Date.now();
    const uid = user?.uid ?? 'unknown';
    const displayName = creatorDisplayNameFromAuth(user, userData);

    try {
      for (const data of items) {
        const setCode = generateQuestionSetCode(
          {
            curriculumYear: data.curriculumYear,
            department: data.department,
            gradeLevel: data.gradeLevel,
            subjectGroup: data.subjectGroup,
            subSubjectGroup: data.subSubjectGroup,
          },
          accumulated,
        );

        const payload: Omit<QuestionSet, 'id'> = {
          ...data,
          setCode,
          questionCount: 0,
          isPublished: data.isPublished ?? false,
          createdBy: uid,
          createdByName: displayName,
          createdAt: now,
          updatedAt: now,
        };

        const sanitized = Object.fromEntries(
          Object.entries(payload).filter(([, v]) => v !== undefined),
        );

        const ref = await addDoc(collection(db, QUESTION_SETS_COL), sanitized as never);
        const created: QuestionSet = { id: ref.id, ...(sanitized as Omit<QuestionSet, 'id'>) };
        accumulated.push(created);
        createdIds.push(ref.id);
      }

      toast.success(`นำเข้า ${createdIds.length} ชุดข้อสอบเรียบร้อยแล้ว`);
      return createdIds;
    } catch (e) {
      console.error('[addQuestionSetsBulk]', e);
      toast.error('นำเข้าชุดข้อสอบไม่สำเร็จ');
      throw e;
    }
  };

  return {
    isLoading,
    questionSets,
    stats,
    addQuestionSet,
    addQuestionSetsBulk,
    updateQuestionSet,
    setQuestionSetPublished,
    deleteQuestionSet,
    filterQuestionSets,
  };
}
