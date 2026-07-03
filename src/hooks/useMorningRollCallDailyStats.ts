import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import type { MorningRollCallSession } from '@/types/morningRollCall';
import type { Department } from '@/types/curriculum';

export interface MorningRollCallDailyAggregate {
  date: string;
  present: number;
  late: number;
  absent: number;
  leave: number;
  totalStudents: number;
  sessions: number;
  attendanceRate: number;
}

export interface MorningRollCallPeriodStats {
  present: number;
  late: number;
  absent: number;
  leave: number;
  totalStudents: number;
  sessions: number;
  schoolDays: number;
  avgAttendanceRate: number;
}

export interface MorningRollCallDepartmentAggregate {
  departmentId: Department;
  present: number;
  late: number;
  absent: number;
  leave: number;
  totalStudents: number;
  attendanceRate: number;
}

function matchesAcademicYear(session: MorningRollCallSession, year: string, yearId?: string): boolean {
  const sessionYear = String(session.academicYearId ?? '').trim();
  if (!sessionYear) return true;
  return sessionYear === year || (!!yearId && sessionYear === yearId);
}

function normalizeSession(raw: MorningRollCallSession): MorningRollCallSession {
  const attendance = raw.attendance ?? [];
  const summary = raw.summary ?? {
    present: attendance.filter((a) => a.status === 'present').length,
    absent: attendance.filter((a) => a.status === 'absent').length,
    late: attendance.filter((a) => a.status === 'late').length,
    leave: attendance.filter((a) => a.status === 'leave').length,
  };
  const totalStudents = typeof raw.totalStudents === 'number' ? raw.totalStudents : attendance.length;
  return { ...raw, summary, totalStudents };
}

function aggregateSessions(sessions: MorningRollCallSession[]) {
  const byDate = new Map<string, MorningRollCallDailyAggregate>();

  for (const session of sessions) {
    const existing = byDate.get(session.date) ?? {
      date: session.date,
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      totalStudents: 0,
      sessions: 0,
      attendanceRate: 0,
    };

    existing.present += session.summary.present;
    existing.late += session.summary.late;
    existing.absent += session.summary.absent;
    existing.leave += session.summary.leave;
    existing.totalStudents += session.totalStudents;
    existing.sessions += 1;
    byDate.set(session.date, existing);
  }

  const dailyAggregates = [...byDate.values()]
    .map((row) => {
      const attended = row.present + row.late;
      const attendanceRate = row.totalStudents > 0
        ? Math.round((attended / row.totalStudents) * 100)
        : 0;
      return { ...row, attendanceRate };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const periodTotals = dailyAggregates.reduce(
    (acc, row) => ({
      present: acc.present + row.present,
      late: acc.late + row.late,
      absent: acc.absent + row.absent,
      leave: acc.leave + row.leave,
      totalStudents: acc.totalStudents + row.totalStudents,
      sessions: acc.sessions + row.sessions,
    }),
    { present: 0, late: 0, absent: 0, leave: 0, totalStudents: 0, sessions: 0 },
  );

  const avgAttendanceRate = periodTotals.totalStudents > 0
    ? Math.round(((periodTotals.present + periodTotals.late) / periodTotals.totalStudents) * 100)
    : 0;

  const periodStats: MorningRollCallPeriodStats = {
    ...periodTotals,
    schoolDays: dailyAggregates.length,
    avgAttendanceRate,
  };

  const byDept = new Map<Department, MorningRollCallDepartmentAggregate>();
  for (const session of sessions) {
    const dept = session.departmentId as Department;
    if (!dept) continue;
    const existing = byDept.get(dept) ?? {
      departmentId: dept,
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      totalStudents: 0,
      attendanceRate: 0,
    };
    existing.present += session.summary.present;
    existing.late += session.summary.late;
    existing.absent += session.summary.absent;
    existing.leave += session.summary.leave;
    existing.totalStudents += session.totalStudents;
    byDept.set(dept, existing);
  }

  const departmentAggregates = [...byDept.values()]
    .map((row) => {
      const attended = row.present + row.late;
      return {
        ...row,
        attendanceRate: row.totalStudents > 0
          ? Math.round((attended / row.totalStudents) * 100)
          : 0,
      };
    })
    .sort((a, b) => a.departmentId.localeCompare(b.departmentId));

  return { dailyAggregates, periodStats, departmentAggregates };
}

export function useMorningRollCallDailyStats(
  from: string,
  to: string,
  departmentFilter: Department | 'all' = 'all',
) {
  const { year, activeYear } = useActiveAcademicYear();

  return useQuery({
    queryKey: ['morningRollCallDailyStats', year, activeYear?.id, from, to, departmentFilter],
    queryFn: async () => {
      if (!year) {
        return {
          sessions: [] as MorningRollCallSession[],
          dailyAggregates: [] as MorningRollCallDailyAggregate[],
          periodStats: {
            present: 0,
            late: 0,
            absent: 0,
            leave: 0,
            totalStudents: 0,
            sessions: 0,
            schoolDays: 0,
            avgAttendanceRate: 0,
          } satisfies MorningRollCallPeriodStats,
          departmentAggregates: [] as MorningRollCallDepartmentAggregate[],
        };
      }

      // Query by date range only — avoids composite index requirement on academicYearId+date.
      // Filter academic year and department client-side (same pattern as ReportControlCenter).
      const q = query(
        collection(db, 'morning_rollcall'),
        where('date', '>=', from),
        where('date', '<=', to),
      );
      const snap = await getDocs(q);
      let sessions = snap.docs
        .map((d) => normalizeSession(d.data() as MorningRollCallSession))
        .filter((s) => matchesAcademicYear(s, year, activeYear?.id));

      if (departmentFilter !== 'all') {
        sessions = sessions.filter((s) => String(s.departmentId) === departmentFilter);
      }

      const { dailyAggregates, periodStats, departmentAggregates } = aggregateSessions(sessions);
      return { sessions, dailyAggregates, periodStats, departmentAggregates };
    },
    enabled: !!year && !!from && !!to && from <= to,
    staleTime: 5 * 60 * 1000,
  });
}
