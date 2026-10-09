// src/features/teacherDashboard/components/HomeroomBehaviorTable.tsx
// ตารางสรุปคะแนนประเมินพฤติกรรมในห้อง (นักเรียน × รายวิชา) สำหรับครูประจำชั้น — อ่านอย่างเดียว
// ตัวคำนวณ/สีเดียวกับโหมด "ภาพรวมทุกวิชา" ในหน้าพฤติกรรมในห้องเรียน
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { HiArrowPath } from 'react-icons/hi2';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useClassroomBehaviorConfig } from '@/hooks/useClassroomBehaviorConfig';
import { useClassroomBehaviorRecords } from '@/hooks/useClassroomBehavior';
import { fetchStudentsByIds } from '@/lib/firestoreShared/fetchStudentsByIds';
import { AvgCell, DOT_COLOR, SortHead, StatusDot, nextSort, sortStudentsByBehavior, type SortKey, type SortState } from '@/features/classroomBehavior/components/BehaviorCells';
import {
  CLASSROOM_BEHAVIOR_LEVEL,
  classroomBehaviorAvg,
  classroomBehaviorOverall,
  subjectKey,
} from '@/types/classroomBehavior';
import type { ClassRoom } from '@/types/class';
import type { Student } from '@/types/student';
import { cn } from '@/lib/utils';

/** รายชื่อนักเรียนของห้อง — กติกาเดียวกับสมุดคะแนน: ใบลงทะเบียนของปี (ไม่มีก็ถอยไปไม่กรองปี) + ฟิลด์ห้องในเอกสารนักเรียน */
async function loadRoster(classId: string, year: string): Promise<Student[]> {
  const enrollSnap = await getDocs(query(
    collection(db, 'enrollments'),
    where('classId', '==', classId),
    where('academicYearId', '==', year),
  ));
  let enrollDocs = enrollSnap.docs;
  if (enrollDocs.length === 0) {
    enrollDocs = (await getDocs(query(collection(db, 'enrollments'), where('classId', '==', classId)))).docs;
  }
  const ids = new Set(enrollDocs.map((d) => String((d.data() as { studentId?: string }).studentId ?? '')).filter(Boolean));

  const [byClassId, byClassroomId] = await Promise.all([
    getDocs(query(collection(db, 'students'), where('classId', '==', classId))).catch(() => null),
    getDocs(query(collection(db, 'students'), where('classroomId', '==', classId))).catch(() => null),
  ]);
  [...(byClassId?.docs ?? []), ...(byClassroomId?.docs ?? [])].forEach((d) => ids.add(d.id));

  const students = await fetchStudentsByIds<Student>([...ids]);
  return students.sort((a, b) =>
    (a.studentCode ?? '').localeCompare(b.studentCode ?? '', undefined, { numeric: true }));
}

interface Props {
  classes: ClassRoom[];
  year: string;
  semester: 1 | 2;
}

export function HomeroomBehaviorTable({ classes, year, semester }: Props) {
  const sorted = useMemo(
    () => [...classes].sort((a, b) => a.className.localeCompare(b.className, 'th', { numeric: true })),
    [classes],
  );
  const [classId, setClassId] = useState('');
  const [sort, setSort] = useState<SortState>(null);
  const cls = sorted.find((c) => c.id === classId) ?? sorted[0] ?? null;

  const { excluded } = useClassroomBehaviorConfig();
  const curriculum = useCurriculum();

  const { data: students = [], isLoading: rosterLoading } = useQuery({
    queryKey: ['homeroomRoster', cls?.id, year],
    enabled: !!cls,
    staleTime: 5 * 60_000,
    queryFn: () => loadRoster(cls!.id, year),
  });

  const { records, loading: recordsLoading, reload } = useClassroomBehaviorRecords(
    cls ? { classId: cls.id, academicYearId: year, semester } : null,
  );

  // คอลัมน์ = วิชาของห้องในเทอมนี้ ตัดวิชากิจกรรมและวิชาที่ตั้งว่าไม่ต้องประเมิน
  const subjects = useMemo((): [string, string][] => {
    if (!cls) return [];
    const info = new Map(curriculum.subjects.map((s) => [s.id, s] as const));
    const out = new Map<string, string>();
    for (const ec of cls.enrolledCourses ?? []) {
      if (ec.semester != null && ec.semester !== semester) continue;
      const s = info.get(ec.subjectId);
      if (!s || s.category === 'activity' || excluded.has(subjectKey(s.name))) continue;
      out.set(ec.subjectId, s.name);
    }
    for (const r of records) {
      if (!out.has(r.subjectId) && !info.get(r.subjectId) && !excluded.has(subjectKey(r.subjectName))) {
        out.set(r.subjectId, r.subjectName);
      }
    }
    return [...out.entries()];
  }, [cls, semester, curriculum.subjects, records, excluded]);

  const stats = useMemo(() => {
    const ids = new Set(subjects.map(([sid]) => sid));
    const cell = new Map<string, number>();
    for (const r of records) if (ids.has(r.subjectId)) cell.set(`${r.studentId}|${r.subjectId}`, classroomBehaviorAvg(r));
    const perStudent = new Map<string, number[]>();
    const perSubject = new Map<string, number[]>();
    const all: number[] = [];
    for (const s of students) {
      for (const [sid] of subjects) {
        const v = cell.get(`${s.id}|${sid}`);
        if (v == null) continue;
        (perStudent.get(s.id) ?? perStudent.set(s.id, []).get(s.id)!).push(v);
        (perSubject.get(sid) ?? perSubject.set(sid, []).get(sid)!).push(v);
        all.push(v);
      }
    }
    return { perStudent, perSubject, all, cell };
  }, [records, students, subjects]);

  const sortedStudents = useMemo(
    () => sortStudentsByBehavior(students, sort, stats.cell, stats.perStudent),
    [students, sort, stats],
  );
  const onSort = (key: SortKey) => setSort((cur) => nextSort(cur, key));

  if (!cls) return null;
  const loading = rosterLoading || recordsLoading;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {sorted.length > 1 ? sorted.map((c) => (
            <Button
              key={c.id}
              size="xs"
              variant={c.id === cls.id ? 'default' : 'outline'}
              onClick={() => { setClassId(c.id); setSort(null); }}
            >
              {c.className}
            </Button>
          )) : (
            <span className="text-sm font-black">ห้องประจำชั้น {cls.className}</span>
          )}
        </div>
        <Button size="xs" variant="outline" onClick={reload} disabled={loading} aria-label="รีเฟรชคะแนน">
          <HiArrowPath className={cn('size-3.5', loading && 'animate-spin')} />
          รีเฟรช
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {([3, 2, 1] as const).map((sc) => (
          <span key={sc} className="inline-flex items-center gap-1.5">
            <span className={`size-3 rounded-full ${DOT_COLOR[sc]}`} />{CLASSROOM_BEHAVIOR_LEVEL[sc]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-muted-foreground/30" />ยังไม่ประเมิน
        </span>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : subjects.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">ห้องนี้ไม่มีรายวิชาที่ต้องประเมิน</p>
      ) : (
        // data-no-swipe: กันการปัดสไลด์ตอนเลื่อนตารางแนวนอน
        <div data-no-swipe className="overflow-x-auto rounded-2xl border border-border bg-card">
          <div className="min-w-max">
            <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              <span className="w-48"><SortHead label="นักเรียน" k="name" sort={sort} onSort={onSort} /></span>
              {subjects.map(([sid, name]) => (
                <span key={sid} className="flex w-32 justify-center">
                  <SortHead label={name} k={`s:${sid}`} sort={sort} onSort={onSort} className="max-w-full" />
                </span>
              ))}
              <span className="flex w-32 justify-center"><SortHead label="เฉลี่ย" k="avg" sort={sort} onSort={onSort} /></span>
            </div>
            {sortedStudents.map((s) => (
              <div key={s.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/40">
                <span className="w-48 truncate text-sm font-bold">{s.firstName} {s.lastName}</span>
                {subjects.map(([sid]) => {
                  const r = records.find((x) => x.studentId === s.id && x.subjectId === sid);
                  return (
                    <div key={sid} className="flex w-32 justify-center">
                      <StatusDot score={r ? classroomBehaviorOverall(r) : undefined} />
                    </div>
                  );
                })}
                <div className="flex w-32 justify-center">
                  <AvgCell values={stats.perStudent.get(s.id) ?? []} total={subjects.length} unit="วิชา" />
                </div>
              </div>
            ))}
            {students.length > 0 && (
              <div className="flex items-center gap-3 border-t border-border bg-muted/30 px-4 py-3">
                <span className="w-48 text-[10px] font-black uppercase tracking-wider text-muted-foreground">เฉลี่ยทั้งห้อง</span>
                {subjects.map(([sid]) => (
                  <div key={sid} className="flex w-32 justify-center">
                    <AvgCell values={stats.perSubject.get(sid) ?? []} total={students.length} unit="คน" />
                  </div>
                ))}
                <div className="flex w-32 justify-center">
                  <AvgCell values={stats.all} total={students.length * subjects.length} unit="รายการ" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
