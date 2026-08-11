import { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SchoolDay } from '@/types/schedule';

/** period = มอบหมายคาบสอนหนึ่งคาบ, rollcall = มอบหมายเช็คชื่อเข้าแถวเช้าของห้องประจำชั้น */
export type SubstitutionScope = 'period' | 'rollcall';

export type SubstitutionStatus = 'pending' | 'approved' | 'rejected';

export interface SubstitutionRecord {
  id: string;
  date: string;                // "YYYY-MM-DD" — วันที่เฉพาะ ไม่ใช่ recurring รายสัปดาห์
  dayOfWeek: SchoolDay;
  scope: SubstitutionScope;
  period?: number;              // required เมื่อ scope === 'period'
  classId: string;
  classLabel?: string;          // ชื่อห้องที่อ่านง่าย เช่น "ม.1/1" — ใช้แสดงผล/แจ้งเตือนแทน classId
  subjectId?: string;           // required เมื่อ scope === 'period'
  subjectName?: string;
  subjectCode?: string;
  originalTeacherId: string;
  originalTeacherName: string;
  substituteTeacherId: string;
  substituteTeacherName: string;
  reason?: string;
  status: SubstitutionStatus;
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
    data: Omit<SubstitutionRecord, 'id' | 'createdAt' | 'status'>,
  ): Promise<string> => {
    const ref = await addDoc(collection(db, 'daily_schedules'), {
      ...data,
      status: 'pending' satisfies SubstitutionStatus,
      createdAt: Timestamp.now(),
    });
    return ref.id;
  };

  const updateSubstitution = async (id: string, patch: Partial<SubstitutionRecord>) => {
    await updateDoc(doc(db, 'daily_schedules', id), patch);
  };

  const respondToSubstitution = async (id: string, status: 'approved' | 'rejected') => {
    await updateDoc(doc(db, 'daily_schedules', id), { status });
  };

  const deleteSubstitution = async (id: string) => {
    await deleteDoc(doc(db, 'daily_schedules', id));
  };

  const getSubstitutionsForSlot = (date: string, period: number, classId: string) =>
    substitutions.filter(s => s.scope === 'period' && s.date === date && s.period === period && s.classId === classId);

  return { substitutions, loading, addSubstitution, updateSubstitution, respondToSubstitution, deleteSubstitution, getSubstitutionsForSlot };
}
