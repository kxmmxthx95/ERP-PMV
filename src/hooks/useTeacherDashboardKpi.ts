// src/hooks/useTeacherDashboardKpi.ts
// KPI ของครูคนปัจจุบันแบบ realtime — listener ทุกตัว scope เฉพาะข้อมูลของครูคนนี้
// (ต่างจาก useTeacherKpi ที่คำนวณทั้งโรงเรียนแบบ one-shot)
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { collection, collectionGroup, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardWindow } from '@/hooks/useDashboardWindow';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useMyLeaveRequests } from '@/hooks/useLeaveRequests';
import { useTeacherKpiSettings } from '@/hooks/useTeacherKpiSettings';
import type { StaffAttendanceRecord } from '@/hooks/useStaffAttendance';
import { getSchedulesByYearSemesterStore } from '@/lib/firestoreShared/schedulesStore';
import {
  approvedLeaveDates,
  computeTeacherDashboard,
  type SessionLite,
} from '@/lib/teacherDashboard/computeTeacherDashboard';
import { resolveCanonicalTeacherId } from '@/lib/teachers/teacherIdentity';

export type { SessionLite };

export function useTeacherDashboardKpi() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const { isLoaded, academicYearId, semester, today, range, workingDays, baseDays } = useDashboardWindow();
  const { teachers, loading: teachersLoading } = useTeachersCollection();
  const { subjects: curriculumSubjects } = useCurriculum();
  const { settings } = useTeacherKpiSettings(academicYearId, semester);

  const teacher = useMemo(
    () => teachers.find((t) => t.userId === uid || t.id === uid) ?? null,
    [teachers, uid],
  );

  const schedulesStore = getSchedulesByYearSemesterStore(academicYearId, semester);
  const schedules = useSyncExternalStore(schedulesStore.subscribe, schedulesStore.getSnapshot, schedulesStore.getSnapshot);

  const effectiveStart = range.from;
  const throughDate = range.to;
  const rollCallEnd = range.rollCallEnd;

  // วันที่ครูลา (อนุมัติแล้ว) ไม่นำมาคิดเช็คชื่อรายวิชา — store เฉพาะใบลาของครูคนนี้
  const { requests: myLeaves } = useMyLeaveRequests(uid, 'staff');
  const leaveDates = useMemo(() => approvedLeaveDates(myLeaves), [myLeaves]);
  // คาบที่เช็คชื่อแล้ว — realtime เฉพาะของครูคนนี้ (teacherId อาจเป็น id เอกสารครูหรือ auth uid)
  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [sessionsReady, setSessionsReady] = useState(false);
  const teacherDocId = teacher?.id ?? '';
  useEffect(() => {
    if (!academicYearId || !uid || teachersLoading) return;
    const ids = Array.from(new Set([uid, teacherDocId].filter(Boolean)));
    return onSnapshot(
      query(
        collection(db, 'class_sessions'),
        where('academicYearId', '==', academicYearId),
        where('semester', '==', semester),
        where('teacherId', 'in', ids),
      ),
      (snap) => {
        setSessions(snap.docs.map((d) => d.data() as SessionLite));
        setSessionsReady(true);
      },
      (err) => console.error('[useTeacherDashboardKpi] class_sessions', err),
    );
  }, [academicYearId, semester, uid, teacherDocId, teachersLoading]);

  // ลงเวลาปฏิบัติงานของตัวเอง — realtime
  const [attendanceRecords, setAttendanceRecords] = useState<StaffAttendanceRecord[]>([]);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collectionGroup(db, 'entries'), where('userId', '==', uid)),
      (snap) => {
        setAttendanceRecords(snap.docs
          .filter((d) => d.ref.parent.parent?.parent?.id === 'staff_attendance_by_date')
          .map((d) => {
            const data = d.data() as Omit<StaffAttendanceRecord, 'id'>;
            return { ...data, id: d.id, userId: data.userId || uid, date: data.date || (d.ref.parent.parent?.id ?? '') };
          }));
      },
      (err) => console.error('[useTeacherDashboardKpi] staff entries', err),
    );
  }, [uid]);

  const mySchedule = useMemo(
    () => (teacher ? schedules.filter((e) => resolveCanonicalTeacherId(e.teacherId, teachers) === teacher.id) : []),
    [teacher, teachers, schedules],
  );

  const computed = useMemo(() => {
    if (!teacher || !effectiveStart) return null;
    return computeTeacherDashboard({
      teacher,
      schedule: mySchedule,
      sessions,
      attendanceRecords,
      leaveDates,
      range,
      workingDays,
      baseTeachingDays: baseDays,
      excludedSubjectIds: settings.excludedSubjectsByTeacher?.[teacher.id] ?? [],
      hiddenForAll: new Set(settings.dashboardExcludedSubjectIds ?? []),
      curriculumSubjects,
    });
  }, [teacher, effectiveStart, mySchedule, sessions, attendanceRecords, leaveDates, range, workingDays, baseDays, settings, curriculumSubjects]);

  return {
    row: computed?.row ?? null,
    teacherId: teacher?.id,
    range: { from: effectiveStart, to: throughDate },
    rollCallRange: { from: effectiveStart, to: rollCallEnd },
    mySchedule,
    sessions,
    teachingDays: computed?.teachingDays ?? [],
    today,
    attendanceSummary: computed?.attendanceSummary ?? { present: 0, late: 0, absent: 0, leave: 0, total: 0 },
    isLoading: !isLoaded || teachersLoading || !sessionsReady,
  };
}
