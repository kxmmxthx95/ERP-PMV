import { useQuery, useMutation } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { getDoc, doc, getDocs, query, collection, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getLocalDateString } from '@/lib/dateUtils';
import { getTodayRollCallSessionsStore } from '@/lib/firestoreShared/morningRollCallStore';
import type { MorningRollCallSession, NewMorningRollCall } from '@/types/morningRollCall';

const noopSubscribe = () => () => {};
// ค่าอ้างอิงเดียวคงที่ ห้ามสร้าง [] ใหม่ทุกครั้ง ไม่งั้น useSyncExternalStore วน re-render ไม่จบ
const EMPTY_SESSIONS: readonly MorningRollCallSession[] = [];
const emptySessions = () => EMPTY_SESSIONS;

function generateDocId(date: string, classId: string): string {
  return `${date}_${classId.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

export function useTodayRollCallSessions(academicYearId: string | undefined) {
  const today = getLocalDateString();
  const store = academicYearId ? getTodayRollCallSessionsStore(academicYearId, today) : null;
  const sessions = useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store ? store.getSnapshot : emptySessions,
    store ? store.getSnapshot : emptySessions,
  );
  const loading = academicYearId ? !store?.getReady() : false;
  return { sessions, loading, today };
}

export function useMorningRollCall(classId: string | null, date: string | null) {
  return useQuery({
    queryKey: ['morningRollCall', classId, date],
    queryFn: async () => {
      if (!classId || !date) return null;
      const docId = generateDocId(date, classId);
      const ref = doc(db, 'morning_rollcall', docId);
      const snap = await getDoc(ref);
      return snap.exists() ? (snap.data() as MorningRollCallSession) : null;
    },
    enabled: !!classId && !!date,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTodayMorningRollCall(classId: string | null) {
  const today = getLocalDateString();
  return useMorningRollCall(classId, today);
}

/** Strip undefined values and UI-only fields (e.g. enrollmentIndex) that Firestore rejects. */
function cleanAttendanceForFirestore(
  attendance: NewMorningRollCall['attendance'],
): NewMorningRollCall['attendance'] {
  return attendance.map((a) => {
    const { studentId, studentName, studentCode, status, note, photoURL, gender } = a as typeof a & { enrollmentIndex?: unknown };
    const row: Record<string, unknown> = { studentId, studentName, studentCode, status };
    if (note !== undefined) row.note = note;
    if (photoURL !== undefined) row.photoURL = photoURL;
    if (gender !== undefined) row.gender = gender;
    return row as unknown as NewMorningRollCall['attendance'][number];
  });
}

export function useSaveMorningRollCall() {
  return useMutation({
    mutationFn: async (newData: NewMorningRollCall) => {
      const docId = generateDocId(newData.date, newData.classId);
      const batch = writeBatch(db);
      const ref = doc(db, 'morning_rollcall', docId);

      const attendance = cleanAttendanceForFirestore(newData.attendance);

      const summary = {
        present: attendance.filter(a => a.status === 'present').length,
        absent: attendance.filter(a => a.status === 'absent').length,
        late: attendance.filter(a => a.status === 'late').length,
        leave: attendance.filter(a => a.status === 'leave').length,
      };

      const presentIds = attendance.filter(a => a.status === 'present').map(a => a.studentId);
      const absentIds = attendance.filter(a => a.status === 'absent').map(a => a.studentId);
      const lateIds = attendance.filter(a => a.status === 'late').map(a => a.studentId);
      const leaveIds = attendance.filter(a => a.status === 'leave').map(a => a.studentId);

      const now = new Date().toISOString();
      const sessionData: MorningRollCallSession = {
        id: docId,
        ...newData,
        attendance,
        summary,
        presentStudentIds: presentIds,
        absentStudentIds: absentIds,
        lateStudentIds: lateIds,
        leaveStudentIds: leaveIds,
        totalStudents: attendance.length,
        createdAt: now,
        updatedAt: now,
      };

      batch.set(ref, sessionData, { merge: true });
      await batch.commit();
      return sessionData;
    },
  });
}

export async function getTodayAllClassRollCalls(academicYearId: string): Promise<MorningRollCallSession[]> {
  const today = getLocalDateString();
  const q = query(
    collection(db, 'morning_rollcall'),
    where('date', '==', today),
    where('academicYearId', '==', academicYearId),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as MorningRollCallSession);
}

export async function getClassRollCallsByAcademicYear(
  classId: string,
  academicYearId: string,
): Promise<MorningRollCallSession[]> {
  const q = query(
    collection(db, 'morning_rollcall'),
    where('classId', '==', classId),
    where('academicYearId', '==', academicYearId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => d.data() as MorningRollCallSession)
    .sort((a, b) => a.date.localeCompare(b.date));
}
