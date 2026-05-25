import { useQuery, useMutation } from '@tanstack/react-query';
import { getDoc, doc, getDocs, query, collection, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { MorningRollCallSession, NewMorningRollCall } from '@/types/morningRollCall';

function generateDocId(date: string, classId: string): string {
  return `${date}_${classId.replace(/[^a-zA-Z0-9]/g, '_')}`;
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
  const today = new Date().toISOString().split('T')[0];
  return useMorningRollCall(classId, today);
}

export function useSaveMorningRollCall() {
  return useMutation({
    mutationFn: async (newData: NewMorningRollCall) => {
      const docId = generateDocId(newData.date, newData.classId);
      const batch = writeBatch(db);
      const ref = doc(db, 'morning_rollcall', docId);

      const summary = {
        present: newData.attendance.filter(a => a.status === 'present').length,
        absent: newData.attendance.filter(a => a.status === 'absent').length,
        late: newData.attendance.filter(a => a.status === 'late').length,
        leave: newData.attendance.filter(a => a.status === 'leave').length,
      };

      const presentIds = newData.attendance.filter(a => a.status === 'present').map(a => a.studentId);
      const absentIds = newData.attendance.filter(a => a.status === 'absent').map(a => a.studentId);
      const lateIds = newData.attendance.filter(a => a.status === 'late').map(a => a.studentId);
      const leaveIds = newData.attendance.filter(a => a.status === 'leave').map(a => a.studentId);

      const now = new Date().toISOString();
      const sessionData: MorningRollCallSession = {
        id: docId,
        ...newData,
        summary,
        presentStudentIds: presentIds,
        absentStudentIds: absentIds,
        lateStudentIds: lateIds,
        leaveStudentIds: leaveIds,
        totalStudents: newData.attendance.length,
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
  const today = new Date().toISOString().split('T')[0];
  const q = query(
    collection(db, 'morning_rollcall'),
    where('date', '==', today),
    where('academicYearId', '==', academicYearId),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as MorningRollCallSession);
}
