import type { AttendanceStatus } from '@/types/teaching';

export type StudentSubjectAttendanceRow = {
  key: string;
  date: string;
  period: number;
  status: AttendanceStatus;
  note?: string;
};

type ClassSessionDoc = {
  id: string;
  date?: string;
  period?: number;
  attendance?: Array<{ studentId: string; status: AttendanceStatus; note?: string }>;
};

type ScheduleSlot = {
  day: number;
  period: number;
};

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function enumerateScheduleDates(rangeStart: string, rangeEnd: string, dayOfWeek: number): string[] {
  if (!rangeStart || !rangeEnd) return [];

  const dates: string[] = [];
  const cursor = new Date(`${rangeStart}T12:00:00`);
  const end = new Date(`${rangeEnd}T12:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return [];

  while (cursor <= end) {
    const dow = cursor.getDay() === 0 ? 7 : cursor.getDay();
    if (dow === dayOfWeek) {
      dates.push(toLocalDateString(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function summarizeStudentSubjectAttendance(rows: StudentSubjectAttendanceRow[]) {
  const presentLike = rows.filter((row) => row.status === 'present' || row.status === 'late').length;
  const counts: Partial<Record<AttendanceStatus, number>> = {};
  rows.forEach((row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  });
  const pct = rows.length > 0 ? Math.round((presentLike / rows.length) * 100) : null;
  return { total: rows.length, presentLike, pct, counts };
}

export function buildStudentSubjectAttendanceHistory({
  studentId,
  sessions,
  scheduleSlots,
  rangeStart,
  rangeEnd,
  academicYearId,
}: {
  studentId: string;
  sessions: ClassSessionDoc[];
  scheduleSlots: ScheduleSlot[];
  rangeStart: string;
  rangeEnd: string;
  academicYearId?: string;
}): StudentSubjectAttendanceRow[] {
  const today = toLocalDateString(new Date());
  const effectiveEnd = rangeEnd && rangeEnd < today ? rangeEnd : today;
  const effectiveStart = rangeStart || (() => {
    const be = Number(academicYearId);
    if (!Number.isFinite(be) || be <= 2400) return '';
    return `${be - 543}-05-01`;
  })();
  const sessionKeySet = new Set<string>();
  const rows: StudentSubjectAttendanceRow[] = [];

  sessions.forEach((session) => {
    const date = session.date ?? '';
    const period = session.period ?? 0;
    if (!date || !period) return;
    if (effectiveStart && date < effectiveStart) return;
    if (effectiveEnd && date > effectiveEnd) return;

    const entry = (session.attendance ?? []).find((item) => item.studentId === studentId);
    const key = `${date}|${period}`;
    sessionKeySet.add(key);
    rows.push({
      key: session.id,
      date,
      period,
      status: entry?.status ?? 'absent',
      note: entry?.note,
    });
  });

  scheduleSlots.forEach((slot) => {
    if (!slot.day || !slot.period || !effectiveStart) return;
    enumerateScheduleDates(effectiveStart, effectiveEnd, slot.day).forEach((date) => {
      const key = `${date}|${slot.period}`;
      if (sessionKeySet.has(key)) return;
      sessionKeySet.add(key);
      rows.push({
        key: `missing_${date}_${slot.period}`,
        date,
        period: slot.period,
        status: 'absent',
      });
    });
  });

  rows.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.period - a.period;
  });

  return rows;
}

export function calcStudentSubjectAttendancePct(
  studentId: string,
  subjectId: string,
  semester: 1 | 2,
  sessions: ClassSessionDoc[],
  scheduleSlots: ScheduleSlot[],
  rangeStart: string,
  rangeEnd: string,
  academicYearId?: string,
): number | null {
  const scopedSessions = sessions.filter((session) => {
    const data = session as ClassSessionDoc & { subjectId?: string; semester?: 1 | 2 };
    return data.subjectId === subjectId && (data.semester ?? 1) === semester;
  });

  const scopedSlots = scheduleSlots.filter(Boolean);
  if (scopedSessions.length === 0 && scopedSlots.length === 0) return null;

  const rows = buildStudentSubjectAttendanceHistory({
    studentId,
    sessions: scopedSessions,
    scheduleSlots: scopedSlots,
    rangeStart,
    rangeEnd,
    academicYearId,
  });

  return summarizeStudentSubjectAttendance(rows).pct;
}
