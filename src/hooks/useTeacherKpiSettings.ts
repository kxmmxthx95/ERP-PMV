// src/hooks/useTeacherKpiSettings.ts
import { useCallback } from 'react';
import { useSyncExternalStore } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  getTeacherKpiSettingsStore,
  teacherKpiSettingsDocId,
} from '@/lib/firestoreShared/teacherKpiSettingsStore';

export function useTeacherKpiSettings(academicYearId: string, semester: 1 | 2) {
  const store = getTeacherKpiSettingsStore(academicYearId, semester);
  const settings = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const saveStartDate = useCallback(async (startDate: string, updatedBy?: string) => {
    const key = teacherKpiSettingsDocId(academicYearId, semester);
    // merge: true — ห้ามเขียนทับ excludedSubjectsByTeacher ของครูคนอื่นที่ตั้งไว้ก่อนหน้า
    await setDoc(doc(db, 'teacher_kpi_settings', key), {
      academicYearId,
      semester,
      startDate,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy ?? null,
    }, { merge: true });
  }, [academicYearId, semester]);

  const saveExcludedSubjects = useCallback(async (teacherId: string, subjectIds: string[], updatedBy?: string) => {
    const key = teacherKpiSettingsDocId(academicYearId, semester);
    await setDoc(doc(db, 'teacher_kpi_settings', key), {
      academicYearId,
      semester,
      excludedSubjectsByTeacher: { [teacherId]: subjectIds },
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy ?? null,
    }, { mergeFields: [`excludedSubjectsByTeacher.${teacherId}`, 'academicYearId', 'semester', 'updatedAt', 'updatedBy'] });
  }, [academicYearId, semester]);

  return { settings, saveStartDate, saveExcludedSubjects };
}
