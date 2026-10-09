// src/hooks/useAllTeachersDashboard.ts
// สรุปผลงานครูทุกคนสำหรับแอดมิน — ดึงข้อมูลดิบครั้งเดียว (cache 5 นาที, ไม่มี listener) แล้วคำนวณด้วยสูตรเดียวกับหน้าครู
import { useMemo, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useDashboardWindow } from '@/hooks/useDashboardWindow';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useTeacherKpiSettings } from '@/hooks/useTeacherKpiSettings';
import type { StaffAttendanceRecord } from '@/hooks/useStaffAttendance';
import { getSchedulesByYearSemesterStore } from '@/lib/firestoreShared/schedulesStore';
import { resolveCanonicalTeacherId } from '@/lib/teachers/teacherIdentity';
import {
  approvedLeaveDates,
  computeTeacherDashboard,
  type SessionLite,
} from '@/lib/teacherDashboard/computeTeacherDashboard';
import type { LeaveRequest } from '@/types/leave';
import type { TeacherKpiRow } from '@/types/teacherKpi';

const DAY_CHUNK = 15;

interface RawData {
  sessions: SessionLite[];
  attendanceByUser: Map<string, StaffAttendanceRecord[]>;
  leavesByUser: Map<string, LeaveRequest[]>;
}

export interface AdminTeacherRow {
  row: TeacherKpiRow;
  late: number;
  absent: number;
}

export function useAllTeachersDashboard(enabled: boolean) {
  const { academicYearId, semester, range, workingDays, baseDays } = useDashboardWindow();
  const { teachers, loading: teachersLoading } = useTeachersCollection();
  const { subjects: curriculumSubjects } = useCurriculum();
  const { settings } = useTeacherKpiSettings(academicYearId, semester);
  const schedulesStore = getSchedulesByYearSemesterStore(academicYearId, semester);
  const schedules = useSyncExternalStore(schedulesStore.subscribe, schedulesStore.getSnapshot, schedulesStore.getSnapshot);

  const ready = enabled && !!academicYearId && !!range.from && workingDays.length > 0;
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['allTeachersDashboard', academicYearId, semester, range.from, range.to, workingDays.length],
    enabled: ready,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RawData> => {
      const [sessionsSnap, leaveSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'class_sessions'),
          where('academicYearId', '==', academicYearId),
          where('semester', '==', semester),
        )),
        getDocs(query(
          collection(db, 'leave_requests'),
          where('requesterType', '==', 'staff'),
          where('status', '==', 'approved'),
        )),
      ]);

      // บันทึกเข้างานรายวัน (โครงสร้างเดียวกับ useTeacherKpi: staff_attendance_by_date/{date}/entries)
      const attendanceByUser = new Map<string, StaffAttendanceRecord[]>();
      for (let i = 0; i < workingDays.length; i += DAY_CHUNK) {
        const results = await Promise.all(
          workingDays.slice(i, i + DAY_CHUNK).map((date) =>
            getDocs(collection(db, 'staff_attendance_by_date', date, 'entries'))
              .then((snap) => ({ date, docs: snap.docs }))
              .catch((): { date: string; docs: QueryDocumentSnapshot<DocumentData>[] } => ({ date, docs: [] })),
          ),
        );
        for (const { date, docs } of results) {
          for (const d of docs) {
            const rec = d.data() as Omit<StaffAttendanceRecord, 'id'>;
            const userId = rec.userId || d.id;
            const list = attendanceByUser.get(userId) ?? [];
            list.push({ ...rec, id: d.id, userId, date: rec.date || date });
            attendanceByUser.set(userId, list);
          }
        }
      }

      const leavesByUser = new Map<string, LeaveRequest[]>();
      leaveSnap.docs.forEach((d) => {
        const req = { id: d.id, ...d.data() } as LeaveRequest;
        const list = leavesByUser.get(req.requesterId) ?? [];
        list.push(req);
        leavesByUser.set(req.requesterId, list);
      });

      return {
        sessions: sessionsSnap.docs.map((d) => d.data() as SessionLite),
        attendanceByUser,
        leavesByUser,
      };
    },
  });

  const rows = useMemo<AdminTeacherRow[]>(() => {
    if (!data) return [];
    const sessionsByTeacher = new Map<string, SessionLite[]>();
    for (const s of data.sessions) {
      const id = resolveCanonicalTeacherId(s.teacherId, teachers);
      if (!id) continue;
      (sessionsByTeacher.get(id) ?? sessionsByTeacher.set(id, []).get(id)!).push(s);
    }
    const scheduleByTeacher = new Map<string, typeof schedules>();
    for (const e of schedules) {
      const id = resolveCanonicalTeacherId(e.teacherId, teachers);
      if (!id) continue;
      (scheduleByTeacher.get(id) ?? scheduleByTeacher.set(id, []).get(id)!).push(e);
    }
    const hiddenForAll = new Set(settings.dashboardExcludedSubjectIds ?? []);

    return teachers.map((teacher) => {
      const uid = teacher.userId ?? '';
      const { row, attendanceSummary } = computeTeacherDashboard({
        teacher,
        schedule: scheduleByTeacher.get(teacher.id) ?? [],
        sessions: sessionsByTeacher.get(teacher.id) ?? [],
        attendanceRecords: uid ? data.attendanceByUser.get(uid) ?? [] : [],
        leaveDates: approvedLeaveDates(uid ? data.leavesByUser.get(uid) ?? [] : []),
        range,
        workingDays,
        baseTeachingDays: baseDays,
        excludedSubjectIds: settings.excludedSubjectsByTeacher?.[teacher.id] ?? [],
        hiddenForAll,
        curriculumSubjects,
      });
      // ครูที่ไม่มี userId ผูกไว้ไม่มีข้อมูลเข้างาน → ไม่แสดง % เวลาปฏิบัติงาน
      return {
        row: uid ? row : { ...row, attendanceRate: null, attendedDays: 0 },
        late: attendanceSummary.late,
        absent: attendanceSummary.absent,
      };
    });
  }, [data, teachers, schedules, settings, range, workingDays, baseDays, curriculumSubjects]);

  return {
    rows,
    range,
    loading: enabled && (teachersLoading || (ready && isFetching && !data)),
    refreshing: isFetching,
    reload: () => void refetch(),
  };
}
