// src/lib/teacherDashboard/computeTeacherDashboard.ts
// สูตรสรุปผลงานครูหนึ่งคน (ฟังก์ชันบริสุทธิ์) — หน้าครู (realtime) และตารางแอดมิน (one-shot) เรียกชุดเดียวกัน
// เพื่อให้ตัวเลขตรงกันโดยโครงสร้าง
import { countExpectedSessions } from '@/hooks/useTeacherKpi';
import { isTimestampAtOrAfterNoon, type StaffAttendanceRecord } from '@/hooks/useStaffAttendance';
import { buildCheckInHistoryRows, summarizeCheckInHistory } from '@/lib/staffAttendance/checkInHistory';
import { filterOutNonTeachingDays } from '@/lib/teacherKpi/semesterDates';
import type { CalendarEvent } from '@/types/calendar';
import type { Subject, Department } from '@/types/curriculum';
import type { ScheduleEntry } from '@/types/schedule';
import type { LeaveRequest } from '@/types/leave';
import type { TeacherKpiRow, TeacherSubjectKpi } from '@/types/teacherKpi';

export interface SessionLite {
  date: string;
  subjectId: string;
  teacherId?: string;
  classId?: string;
  period?: number;
}

export interface DashboardRange {
  from: string;        // เริ่มนับ (1 ก.ค.)
  to: string;          // เวลาปฏิบัติงานนับถึง
  rollCallEnd: string; // เช็คชื่อรายวิชานับถึง (2 ต.ค.)
}

/**
 * ช่วงเก็บค่า — ponytail: ฮาร์ดโค้ดเดือน (เริ่ม 1 ก.ค. · เช็คชื่อถึง 2 ต.ค. · เวลาปฏิบัติงานถึง 31 ต.ค.)
 * ย้ายไปเป็นค่าตั้งใน Firestore ถ้าต้องเปลี่ยนบ่อย
 */
export function resolveDashboardRange(semesterRange: { startDate: string; endDate: string }, today: string): DashboardRange {
  const year = semesterRange.startDate.slice(0, 4);
  if (!year) return { from: '', to: '', rollCallEnd: '' };
  const to = [today, semesterRange.endDate, `${year}-10-31`].filter(Boolean).reduce((a, b) => (b < a ? b : a));
  const rollCallEnd = `${year}-10-02` < to ? `${year}-10-02` : to;
  return { from: `${year}-07-01`, to, rollCallEnd };
}

/** วันที่ลาที่อนุมัติแล้ว (กระจายช่วงวันเป็นรายวัน) */
export function approvedLeaveDates(requests: Pick<LeaveRequest, 'status' | 'startDate' | 'endDate'>[]): Set<string> {
  const out = new Set<string>();
  for (const req of requests) {
    if (req.status !== 'approved') continue;
    const cursor = new Date(`${req.startDate}T12:00:00`);
    const end = new Date(`${req.endDate}T12:00:00`);
    for (; cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      out.add(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
    }
  }
  return out;
}

/** วันทำงานที่ "มีการเรียนจริง" ก่อนหักวันลารายคน: ตัดวันสอบ/กิจกรรม และไม่เกินวันสิ้นสุดเช็คชื่อ */
export function baseTeachingDays(workingDays: string[], calendarEvents: CalendarEvent[], rollCallEnd: string): string[] {
  return filterOutNonTeachingDays(workingDays, calendarEvents).filter((d) => d <= rollCallEnd);
}

export interface TeacherLite {
  id: string;
  userId?: string | null;
  name: string;
  photoURL?: string;
  department: Department;
  position?: string;
  teachingSubjectIds?: string[];
}

export interface ComputeInput {
  teacher: TeacherLite;
  schedule: ScheduleEntry[];       // ตารางสอนของครูคนนี้
  sessions: SessionLite[];         // คาบที่เช็คแล้วของครูคนนี้
  attendanceRecords: StaffAttendanceRecord[];
  leaveDates: Set<string>;
  range: DashboardRange;
  workingDays: string[];
  baseTeachingDays: string[];
  excludedSubjectIds: string[];    // "ไม่นำมาคิด" รายครู (หน้า KPI)
  hiddenForAll: Set<string>;       // sysadmin เอาออกทุกคน
  curriculumSubjects: Subject[];
}

const isActivityCategory = (cat: unknown) => {
  const c = String(cat ?? '').toLowerCase();
  return c === 'activity' || c.includes('กิจกรรม');
};

export function computeTeacherDashboard(input: ComputeInput) {
  const { teacher, schedule, sessions, attendanceRecords, leaveDates, range, workingDays, curriculumSubjects } = input;

  // วันที่มีการเรียนจริงของครูคนนี้ = ฐาน หักวันลา
  const teachingDays = input.baseTeachingDays.filter((d) => !leaveDates.has(d));
  const teachingDaySet = new Set(teachingDays);

  const attended = new Set(
    attendanceRecords
      .filter((r) => r.date >= range.from && r.date <= range.to && r.checkInTime && !isTimestampAtOrAfterNoon(r.checkInTime))
      .map((r) => r.date),
  );
  const attendedDays = workingDays.filter((d) => attended.has(d)).length;
  const attendanceRate = workingDays.length > 0 ? Math.round((attendedDays / workingDays.length) * 1000) / 10 : null;

  const bySubject = new Map<string, ScheduleEntry[]>();
  schedule.forEach((s) => bySubject.set(s.subjectId, [...(bySubject.get(s.subjectId) ?? []), s]));

  const doneBySubject = new Map<string, number>();
  sessions.forEach((s) => {
    if (s.date < range.from || s.date > range.rollCallEnd || !teachingDaySet.has(s.date)) return;
    doneBySubject.set(s.subjectId, (doneBySubject.get(s.subjectId) ?? 0) + 1);
  });

  const findSubject = (id: string) => curriculumSubjects.find((x) => x.id === id || x.code === id);
  const subjectBreakdown: TeacherSubjectKpi[] = Array.from(
    new Set([...(teacher.teachingSubjectIds ?? []), ...bySubject.keys()]),
  )
    .filter((subjectId) => !input.hiddenForAll.has(subjectId) && !isActivityCategory(findSubject(subjectId)?.category))
    .map((subjectId) => {
      const entries = bySubject.get(subjectId);
      const expected = entries ? countExpectedSessions(entries, teachingDays) : 0;
      const completed = doneBySubject.get(subjectId) ?? 0;
      const cs = findSubject(subjectId);
      return {
        subjectId,
        subjectName: entries?.[0].subjectName ?? cs?.name ?? subjectId,
        subjectCode: entries?.[0].subjectCode ?? cs?.code,
        rate: expected > 0 ? Math.min(100, Math.round((completed / expected) * 1000) / 10) : null,
        completedSessions: completed,
        expectedSessions: expected,
        excluded: input.excludedSubjectIds.includes(subjectId),
        inSchedule: !!entries,
      };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'th'));

  const included = subjectBreakdown.filter((s) => !s.excluded);
  const expectedSessions = included.reduce((n, s) => n + s.expectedSessions, 0);
  const completedSessions = included.reduce((n, s) => n + s.completedSessions, 0);

  const row: TeacherKpiRow = {
    teacherId: teacher.id,
    userId: teacher.userId ?? null,
    name: teacher.name,
    photoURL: teacher.photoURL,
    department: teacher.department,
    position: teacher.position,
    attendanceRate,
    attendedDays,
    workingDays: workingDays.length,
    rollCallRate: expectedSessions > 0 ? Math.min(100, Math.round((completedSessions / expectedSessions) * 1000) / 10) : null,
    completedSessions,
    expectedSessions,
    subjectBreakdown,
  };

  const attendanceSummary = summarizeCheckInHistory(
    buildCheckInHistoryRows(attendanceRecords, range.from, range.to, new Set()),
  );

  return { row, attendanceSummary, teachingDays };
}
