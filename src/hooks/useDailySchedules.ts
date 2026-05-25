import { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SchoolDay } from '@/types/schedule';

export interface SubstitutionRecord {
  id: string;
  date: string;                // "YYYY-MM-DD"
  dayOfWeek: SchoolDay;
  period: number;
  classId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  originalTeacherId: string;
  originalTeacherName: string;
  substituteTeacherId: string;
  substituteTeacherName: string;
  reason?: string;
  academicYearId: string;
  semester: 1 | 2;
  createdAt: Timestamp;
  createdBy: string;
}

export function useDailySchedules(academicYearId: string | null, semester: 1 | 2 | null) {
  const [substitutions, setSubstitutions] = useState<SubstitutionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!academicYearId || !semester) return;
    setLoading(true);
    const q = query(
      collection(db, 'daily_schedules'),
      where('academicYearId', '==', academicYearId),
      where('semester', '==', semester),
    );
    const unsub = onSnapshot(q, {
      next: (snap) => {
        setSubstitutions(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubstitutionRecord)));
        setLoading(false);
      },
      error: (_err) => {
        console.error('Daily schedule listener error (handled):', _err);
      }
    });
    return unsub;
  }, [academicYearId, semester]);

  const addSubstitution = async (
    data: Omit<SubstitutionRecord, 'id' | 'createdAt'>,
  ) => {
    await addDoc(collection(db, 'daily_schedules'), {
      ...data,
      createdAt: Timestamp.now(),
    });
  };

  const updateSubstitution = async (id: string, patch: Partial<SubstitutionRecord>) => {
    await updateDoc(doc(db, 'daily_schedules', id), patch);
  };

  const getSubstitutionsForSlot = (date: string, period: number, classId: string) =>
    substitutions.filter(s => s.date === date && s.period === period && s.classId === classId);

  return { substitutions, loading, addSubstitution, updateSubstitution, getSubstitutionsForSlot };
}
