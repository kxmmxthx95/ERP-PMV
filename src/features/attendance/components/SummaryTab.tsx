import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { HiOutlineChartBar } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import type { AttendanceStatus, AttendanceRecord } from '@/types/teaching';
import type { Subject } from '@/types/curriculum';
import type { ClassRoom } from '@/types/class';

interface Props {
  mySubjects: Subject[];
  classes: ClassRoom[];
  attendance: AttendanceRecord[];
  getStudentsForClass: (classId: string) => { student: { id: string; studentCode: string; prefix: string; firstName: string; lastName: string } }[];
  /** When set with lockedClassId, pin the table to this pair. */
  lockedSubjectId?: string;
  lockedClassId?: string;
}

type StatusCounts = Record<'present' | 'absent' | 'late' | 'leave', number>;

const STATUS_COLS: { key: keyof StatusCounts; label: string; className: string }[] = [
  { key: 'present', label: 'มา', className: 'text-emerald-700' },
  { key: 'absent', label: 'ขาด', className: 'text-rose-700' },
  { key: 'late', label: 'สาย', className: 'text-amber-700' },
  { key: 'leave', label: 'ลา', className: 'text-sky-700' },
];

function countStatuses(map: Map<string, AttendanceStatus>, sessions: { date: string; period: number }[]): StatusCounts {
  const counts: StatusCounts = { present: 0, absent: 0, late: 0, leave: 0 };
  for (const s of sessions) {
    const st = map.get(`${s.date}|${s.period}`);
    if (!st) continue;
    if (st === 'present') counts.present += 1;
    else if (st === 'absent') counts.absent += 1;
    else if (st === 'late') counts.late += 1;
    else counts.leave += 1; // excused + leave
  }
  return counts;
}

export default function SummaryTab({
  mySubjects,
  classes,
  attendance,
  getStudentsForClass,
  lockedSubjectId,
  lockedClassId,
}: Props) {
  const [internalSubjectId] = useState(mySubjects[0]?.id ?? '');
  const [internalClassId] = useState(classes[0]?.id ?? '');

  const selectedSubjectId = lockedSubjectId ?? internalSubjectId;
  const selectedClassId = lockedClassId ?? internalClassId;

  const sessions = useMemo(() => {
    const seen = new Map<string, { date: string; period: number }>();
    attendance.forEach((r) => {
      if (r.subjectId === selectedSubjectId && r.classId === selectedClassId) {
        const key = `${r.date}|${r.period}`;
        if (!seen.has(key)) seen.set(key, { date: r.date, period: r.period });
      }
    });
    return [...seen.values()].sort((a, b) =>
      a.date !== b.date ? a.date.localeCompare(b.date) : a.period - b.period,
    );
  }, [attendance, selectedSubjectId, selectedClassId]);

  const students = useMemo(
    () => getStudentsForClass(selectedClassId),
    [getStudentsForClass, selectedClassId],
  );

  const attendanceMap = useMemo(() => {
    const m = new Map<string, Map<string, AttendanceStatus>>();
    attendance.forEach((r) => {
      if (r.subjectId === selectedSubjectId && r.classId === selectedClassId) {
        if (!m.has(r.studentId)) m.set(r.studentId, new Map());
        m.get(r.studentId)!.set(`${r.date}|${r.period}`, r.status);
      }
    });
    return m;
  }, [attendance, selectedSubjectId, selectedClassId]);

  const totalSessions = sessions.length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {students.length === 0 || totalSessions === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center text-muted-foreground">
            <HiOutlineChartBar size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-sukhumvit">
              {students.length === 0 ? 'ยังไม่มีนักเรียนในห้องนี้' : 'ยังไม่มีข้อมูลเช็คชื่อสำหรับวิชานี้'}
            </p>
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-white"
        >
          <table className="w-full min-w-[640px] border-collapse font-sukhumvit">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 bg-white px-5 py-4 text-left text-[10px] font-black uppercase tracking-wider text-foreground">
                  นักเรียน
                </th>
                {STATUS_COLS.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-4 text-center text-[10px] font-black uppercase tracking-wider text-foreground"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-wider text-foreground">
                  % การเข้าเรียน
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map(({ student }) => {
                const sMap = attendanceMap.get(student.id) ?? new Map<string, AttendanceStatus>();
                const counts = countStatuses(sMap, sessions);
                const attended = counts.present + counts.late;
                const pct = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;
                const fullName = `${student.prefix}${student.firstName} ${student.lastName}`;

                return (
                  <tr
                    key={student.id}
                    className="border-b border-border/60 transition-colors last:border-b-0 hover:bg-muted/30"
                  >
                    <td className="sticky left-0 z-10 bg-white px-5 py-4">
                      <div className="flex min-w-[200px] items-center gap-3">
                        <StudentAvatar
                          studentId={student.id}
                          name={fullName}
                          className="h-9 w-9 shrink-0 rounded-full"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black tracking-tight text-foreground">
                            {fullName}
                          </div>
                          <div className="text-[11px] font-bold text-muted-foreground">
                            {student.studentCode}
                          </div>
                        </div>
                      </div>
                    </td>

                    {STATUS_COLS.map((col) => (
                      <td key={col.key} className="px-3 py-4 text-center">
                        <span
                          className={cn(
                            'inline-flex min-w-8 items-center justify-center text-[12px] font-black tabular-nums',
                            col.className,
                            counts[col.key] === 0 && 'opacity-40',
                          )}
                        >
                          {counts[col.key]}
                        </span>
                      </td>
                    ))}

                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex flex-col items-end gap-0.5">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-black tabular-nums',
                            pct >= 80 && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                            pct >= 60 && pct < 80 && 'border-amber-200 bg-amber-50 text-amber-700',
                            pct < 60 && 'border-rose-200 bg-rose-50 text-rose-700',
                          )}
                        >
                          {pct}%
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
                          {attended}/{totalSessions}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}
