import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { HiChevronDown, HiChevronUp, HiChevronUpDown } from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTeachingManager } from '@/hooks/useTeachingManager';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import { useClassroomBehaviorConfig } from '@/hooks/useClassroomBehaviorConfig';
import { useClassroomBehaviorRecords, saveClassroomBehaviorBatch } from '@/hooks/useClassroomBehavior';
import { resolveStudentByAuthUser } from '@/lib/resolveStudentProfile';
import { studentIdentityKeys } from '@/lib/students/studentIdentity';
import { matchesTeacherIdentity } from '@/lib/teachers/teacherIdentity';
import { logActivity } from '@/lib/activityLogger';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import ClassroomBehaviorSettings from './ClassroomBehaviorSettings';
import { AvgCell, DOT_COLOR, StatusDot } from './components/BehaviorCells';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import {
  CLASSROOM_BEHAVIOR_CRITERIA,
  CLASSROOM_BEHAVIOR_LEVEL,
  classroomBehaviorDocId,
  classroomBehaviorAvg,
  classroomBehaviorOverall,
  subjectKey,
  type ClassroomBehaviorRecord,
  type ClassroomBehaviorScore,
  type ClassroomBehaviorScores,
} from '@/types/classroomBehavior';
import type { Student } from '@/types/student';

const SCORES: ClassroomBehaviorScore[] = [3, 2, 1];
const SCORE_VARIANT = { 3: 'success', 2: 'warning', 1: 'destructive' } as const;
const GRID = 'grid gap-3 px-4 py-3 items-center border-b border-border last:border-b-0 hover:bg-muted/40 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_5rem]';

type Draft = Partial<ClassroomBehaviorScores>;

function LevelBadge({ score }: { score?: ClassroomBehaviorScore }) {
  if (!score) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <Button size="xs" variant={SCORE_VARIANT[score]} className="pointer-events-none">
      {CLASSROOM_BEHAVIOR_LEVEL[score]}
    </Button>
  );
}

type SortKey = 'name' | 'avg' | `s:${string}`;
type SortState = { key: SortKey; dir: 'asc' | 'desc' } | null;

function SortHead({ label, k, sort, onSort, className }: {
  label: string;
  k: SortKey;
  sort: SortState;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort?.key === k;
  const Icon = !active ? HiChevronUpDown : sort.dir === 'asc' ? HiChevronUp : HiChevronDown;
  return (
    <button
      type="button"
      title={label}
      onClick={() => onSort(k)}
      className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground ${active ? 'text-foreground' : ''} ${className ?? ''}`}
    >
      <span className="truncate">{label}</span>
      <Icon className="size-3 shrink-0" />
    </button>
  );
}

function ScorePicker({ value, onChange, disabled }: {
  value?: ClassroomBehaviorScore;
  onChange: (v: ClassroomBehaviorScore) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {SCORES.map((s) => (
        <Button
          key={s}
          size="xs"
          disabled={disabled}
          variant={value === s ? SCORE_VARIANT[s] : 'outline'}
          onClick={() => onChange(s)}
        >
          {CLASSROOM_BEHAVIOR_LEVEL[s]}
        </Button>
      ))}
    </div>
  );
}

/* ───────────────────────── Student: read own results ───────────────────────── */
function StudentView({ year, semester }: { year: string; semester: 1 | 2 }) {
  const { user, userData } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    resolveStudentByAuthUser(user.uid, {
      email: user.email ?? undefined,
      studentCode: (userData as { studentCode?: string } | null)?.studentCode,
    }).then(setStudent).finally(() => setResolved(true));
  }, [user?.uid, user?.email, userData]);

  const keys = useMemo(
    () => (student ? [...studentIdentityKeys(student)].slice(0, 30) : []),
    [student],
  );
  const { records: allRecords, loading } = useClassroomBehaviorRecords(
    keys.length ? { studentId: keys, academicYearId: year, semester } : null,
  );
  const { excluded } = useClassroomBehaviorConfig();
  const records = useMemo(() => allRecords.filter((r) => !excluded.has(subjectKey(r.subjectName))), [allRecords, excluded]);

  if (!resolved || loading) return <p className="py-10 text-center text-sm text-muted-foreground">กำลังโหลด...</p>;
  if (!records.length) return <p className="py-10 text-center text-sm font-bold text-muted-foreground">ยังไม่มีผลการประเมิน</p>;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {records.map((r) => (
        <div key={r.id} className="flex flex-col gap-2 px-4 py-3 border-b border-border last:border-b-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black truncate">{r.subjectName}</p>
            <LevelBadge score={classroomBehaviorOverall(r)} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {CLASSROOM_BEHAVIOR_CRITERIA.map((c) => (
              <span key={c.key}>{c.label}: <b className="text-foreground">{CLASSROOM_BEHAVIOR_LEVEL[r[c.key]]}</b></span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────── Teacher / homeroom / admin ───────────────────── */
function StaffView({ year, semester }: { year: string; semester: 1 | 2 }) {
  const { user, role } = useAuth();
  const { canEdit } = useMyPermissions();
  const canViewAll = role === 'admin' || role === 'sysadmin';
  const mgr = useTeachingManager(user?.uid ?? '', canViewAll);
  const { excluded } = useClassroomBehaviorConfig();
  const curriculum = useCurriculum();
  const { coursesByVersion, loadCoursesForVersion } = useCurriculumVersioned();

  const [classId, setClassId] = useState('');
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [pending, setPending] = useState<{ rows: ClassroomBehaviorRecord[]; deleteIds: string[]; incomplete: number; conflicts: number } | null>(null);
  const [mode, setMode] = useState<'rate' | 'overview'>('rate');
  const [sort, setSort] = useState<SortState>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);

  const classes = useMemo(() => {
    const list = canViewAll
      ? mgr.yearClasses
      : mgr.yearClasses.filter((c) =>
          (c.enrolledCourses ?? []).some((ec) => matchesTeacherIdentity(ec.teacherId, mgr.teacherIdentityKeys))
          || (c.homeroomTeacherIds ?? []).some((id) => mgr.teacherIdentityKeys.has(id)));
    return [...list].sort((a, b) => a.className.localeCompare(b.className, 'th', { numeric: true }));
  }, [mgr.yearClasses, mgr.teacherIdentityKeys, canViewAll]);

  const cls = classes.find((c) => c.id === classId) ?? null;
  const isHomeroom = !!cls && (cls.homeroomTeacherIds ?? []).some((id) => mgr.teacherIdentityKeys.has(id));
  const canOverview = canViewAll || isHomeroom;
  const editable = canEdit('classroomBehavior');

  const subjects = useMemo(() => {
    if (!cls) return [];
    const ids = new Set<string>();
    for (const ec of cls.enrolledCourses ?? []) {
      if (ec.semester != null && ec.semester !== semester) continue;
      if (canViewAll || matchesTeacherIdentity(ec.teacherId, mgr.teacherIdentityKeys)) ids.add(ec.subjectId);
    }
    return [...ids]
      .map((id) => mgr.mySubjects.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => !!s && s.category !== 'activity' && !excluded.has(subjectKey(s.name)))
      .map((s) => ({ id: s.id, name: s.name }));
  }, [cls, semester, canViewAll, mgr.teacherIdentityKeys, mgr.mySubjects, excluded]);

  useEffect(() => {
    if (cls?.curriculumPackageId) loadCoursesForVersion(cls.curriculumPackageId);
  }, [cls?.curriculumPackageId, loadCoursesForVersion]);

  // Selected subjects, in list order; the first one prefills the grid.
  const selected = useMemo(() => subjects.filter((s) => subjectIds.includes(s.id)), [subjects, subjectIds]);
  const primaryId = selected[0]?.id ?? '';
  const toggleSubject = (id: string) =>
    setSubjectIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const students = useMemo(
    () => (cls && mgr.isRosterDataLoaded
      ? mgr.getStudentsForClass(cls.id).map((x) => x.student)
        .sort((a, b) => (a.studentCode ?? '').localeCompare(b.studentCode ?? '', undefined, { numeric: true }))
      : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cls?.id, mgr.isRosterDataLoaded, mgr.getStudentsForClass],
  );

  const overview = mode === 'overview' && canOverview;
  const { records, loading, reload } = useClassroomBehaviorRecords(
    cls && (overview || selected.length)
      ? { classId: cls.id, academicYearId: year, semester }
      : null,
  );

  // Reset drafts from the primary subject's saved records whenever the loaded set or primary subject changes
  useEffect(() => {
    const next: Record<string, Draft> = {};
    for (const r of records) {
      if (r.subjectId === primaryId) next[r.studentId] = { responsibility: r.responsibility, participation: r.participation, effort: r.effort };
    }
    setDrafts(next);
  }, [records, primaryId]);

  // Clicking the selected level again clears it
  const setScore = (studentId: string, key: keyof ClassroomBehaviorScores, v: ClassroomBehaviorScore) =>
    setDrafts((d) => ({ ...d, [studentId]: { ...d[studentId], [key]: d[studentId]?.[key] === v ? undefined : v } }));

  const commit = async (p: NonNullable<typeof pending>) => {
    if (!cls) return;
    setSaving(true);
    try {
      await saveClassroomBehaviorBatch(p.rows, p.deleteIds);
      logActivity({ action: 'classroom_behavior_save', category: 'academic', targetId: `${cls.id}_${subjectIds.join(',')}`, detail: `บันทึก ${p.rows.length} ลบ ${p.deleteIds.length}` });
      toast.success(`บันทึก ${p.rows.length} รายการ${p.deleteIds.length ? ` ล้างผล ${p.deleteIds.length} รายการ` : ''}${p.incomplete ? ` (ข้าม ${p.incomplete} คนที่ยังไม่ครบ)` : ''}`);
      reload();
    } catch {
      toast.error('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!cls) return;
    const rows: ClassroomBehaviorRecord[] = [];
    const deleteIds: string[] = [];
    let incomplete = 0;
    let conflicts = 0;
    for (const s of students) {
      const d = drafts[s.id];
      const complete = !!(d?.responsibility && d.participation && d.effort);
      const partial = !complete && !!(d && (d.responsibility || d.participation || d.effort));
      if (partial) incomplete++;
      for (const sub of selected) {
        const id = classroomBehaviorDocId({ academicYearId: year, semester, classId: cls.id, subjectId: sub.id, studentId: s.id });
        const old = records.find((r) => r.id === id);
        if (!complete) {
          if (!partial && old) deleteIds.push(id); // fully cleared → remove saved result
          continue;
        }
        if (old && (old.responsibility !== d!.responsibility || old.participation !== d!.participation || old.effort !== d!.effort)) conflicts++;
        rows.push({
          id,
          studentId: s.id,
          studentName: `${s.prefix ?? ''}${s.firstName} ${s.lastName}`,
          studentCode: s.studentCode ?? '',
          classId: cls.id,
          className: cls.className,
          subjectId: sub.id,
          subjectName: sub.name,
          teacherId: user?.uid ?? '',
          departmentId: cls.departmentId,
          academicYearId: year,
          semester,
          responsibility: d!.responsibility!,
          participation: d!.participation!,
          effort: d!.effort!,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    if (!rows.length && !deleteIds.length) { toast.error('ยังไม่ได้ประเมินนักเรียนคนใดครบ 3 เกณฑ์'); return; }
    const p = { rows, deleteIds, incomplete, conflicts };
    // Several subjects at once: confirm before overwriting or deleting saved results
    if (selected.length > 1 && (conflicts > 0 || deleteIds.length > 0)) setPending(p);
    else void commit(p);
  };

  // Overview columns = every non-activity subject the class takes this semester (rated or not).
  const subjectsInOverview = useMemo((): [string, string][] => {
    if (!cls) return [];
    const info = new Map<string, { name: string; activity: boolean }>();
    for (const v of Object.values(coursesByVersion).flat()) {
      info.set(v.id, { name: v.courseName, activity: v.category !== 'basic' && v.category !== 'additional' });
    }
    for (const sub of [...curriculum.subjects, ...mgr.mySubjects]) {
      info.set(sub.id, { name: sub.name, activity: sub.category === 'activity' });
    }
    const out = new Map<string, string>();
    for (const ec of cls.enrolledCourses ?? []) {
      if (ec.semester != null && ec.semester !== semester) continue;
      const i = info.get(ec.subjectId);
      if (i && !i.activity && !excluded.has(subjectKey(i.name))) out.set(ec.subjectId, i.name);
    }
    // legacy records for subjects no longer resolvable
    for (const r of records) if (!out.has(r.subjectId) && !info.get(r.subjectId)?.activity && !excluded.has(subjectKey(r.subjectName))) out.set(r.subjectId, r.subjectName);
    return [...out.entries()];
  }, [cls, semester, coursesByVersion, curriculum.subjects, mgr.mySubjects, records, excluded]);

  // Averages (equal weight per subject; unrated subjects/students skipped)
  const overviewStats = useMemo(() => {
    const subjectIdSet = new Set(subjectsInOverview.map(([sid]) => sid));
    const cell = new Map<string, number>(); // `${studentId}|${subjectId}` → avg
    for (const r of records) if (subjectIdSet.has(r.subjectId)) cell.set(`${r.studentId}|${r.subjectId}`, classroomBehaviorAvg(r));
    const perStudent = new Map<string, number[]>();
    const perSubject = new Map<string, number[]>();
    const all: number[] = [];
    for (const s of students) {
      for (const [sid] of subjectsInOverview) {
        const v = cell.get(`${s.id}|${sid}`);
        if (v == null) continue;
        (perStudent.get(s.id) ?? perStudent.set(s.id, []).get(s.id)!).push(v);
        (perSubject.get(sid) ?? perSubject.set(sid, []).get(sid)!).push(v);
        all.push(v);
      }
    }
    return { perStudent, perSubject, all, cell };
  }, [records, students, subjectsInOverview]);

  // Header sort: asc → desc → back to roster order. Unrated always last.
  const onSort = (key: SortKey) =>
    setSort((cur) => (cur?.key !== key ? { key, dir: 'asc' } : cur.dir === 'asc' ? { key, dir: 'desc' } : null));

  const sortedStudents = useMemo(() => {
    if (!sort) return students;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const valueOf = (id: string): number | null => {
      if (sort.key === 'avg') {
        const v = overviewStats.perStudent.get(id);
        return v?.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      }
      return overviewStats.cell.get(`${id}|${sort.key.slice(2)}`) ?? null;
    };
    return [...students].sort((a, b) => {
      if (sort.key === 'name') {
        return dir * `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'th');
      }
      const va = valueOf(a.id);
      const vb = valueOf(b.id);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return dir * (va - vb);
    });
  }, [students, sort, overviewStats]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect className="w-44" value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectIds([]); setSort(null); }}>
          <option value="">เลือกห้อง</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.className}</option>)}
        </NativeSelect>
        {canOverview && cls && (
          <Button variant="outline" onClick={() => setMode(overview ? 'rate' : 'overview')}>
            {overview ? 'กลับไปกรอก' : 'ภาพรวมทุกวิชา'}
          </Button>
        )}
      </div>

      {cls && !overview && (
        <div className="flex flex-wrap items-center gap-2">
          {subjects.map((sub) => (
            <Button key={sub.id} size="sm" variant={subjectIds.includes(sub.id) ? 'default' : 'outline'} onClick={() => toggleSubject(sub.id)}>
              {sub.name}
            </Button>
          ))}
          {subjects.length > 1 && (
            <Button size="sm" variant="ghost" onClick={() => setSubjectIds(subjectIds.length === subjects.length ? [] : subjects.map((x) => x.id))}>
              {subjectIds.length === subjects.length ? 'ล้างที่เลือก' : 'เลือกทั้งหมด'}
            </Button>
          )}
          {!subjects.length && <span className="text-sm text-muted-foreground">ไม่มีวิชาที่ประเมินได้ในห้องนี้</span>}
        </div>
      )}

      {!cls && <p className="py-10 text-center text-sm font-bold text-muted-foreground">เลือกห้องเพื่อเริ่มประเมิน</p>}
      {cls && loading && <p className="py-6 text-center text-sm text-muted-foreground">กำลังโหลด...</p>}

      {/* Overview: homeroom/admin, read-only, level per subject */}
      {cls && overview && !loading && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {([3, 2, 1] as const).map((sc) => (
            <span key={sc} className="inline-flex items-center gap-1.5"><span className={`size-3 rounded-full ${DOT_COLOR[sc]}`} />{CLASSROOM_BEHAVIOR_LEVEL[sc]}</span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-muted-foreground/30" />ยังไม่ประเมิน</span>
        </div>
      )}
      {cls && overview && !loading && (
        <div className="rounded-2xl border border-border bg-card overflow-x-auto">
          <div className="min-w-max">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              <span className="w-48"><SortHead label="นักเรียน" k="name" sort={sort} onSort={onSort} /></span>
              {subjectsInOverview.map(([sid, name]) => (
                <span key={sid} className="flex w-32 justify-center">
                  <SortHead label={name} k={`s:${sid}`} sort={sort} onSort={onSort} className="max-w-full" />
                </span>
              ))}
              <span className="flex w-32 justify-center"><SortHead label="เฉลี่ย" k="avg" sort={sort} onSort={onSort} /></span>
            </div>
            {sortedStudents.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/40">
                <span className="w-48 text-sm font-bold truncate">{s.firstName} {s.lastName}</span>
                {subjectsInOverview.map(([sid]) => {
                  const r = records.find((x) => x.studentId === s.id && x.subjectId === sid);
                  return (
                    <div key={sid} className="flex w-32 justify-center">
                      <StatusDot score={r ? classroomBehaviorOverall(r) : undefined} />
                    </div>
                  );
                })}
                <div className="flex w-32 justify-center">
                  <AvgCell values={overviewStats.perStudent.get(s.id) ?? []} total={subjectsInOverview.length} unit="วิชา" />
                </div>
              </div>
            ))}
            {subjectsInOverview.length > 0 && students.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 border-t border-border bg-muted/30">
                <span className="w-48 text-[10px] font-black uppercase tracking-wider text-muted-foreground">เฉลี่ยทั้งห้อง</span>
                {subjectsInOverview.map(([sid]) => (
                  <div key={sid} className="flex w-32 justify-center">
                    <AvgCell values={overviewStats.perSubject.get(sid) ?? []} total={students.length} unit="คน" />
                  </div>
                ))}
                <div className="flex w-32 justify-center">
                  <AvgCell values={overviewStats.all} total={students.length * subjectsInOverview.length} unit="รายการ" />
                </div>
              </div>
            )}
            {!subjectsInOverview.length && <p className="py-8 text-center text-sm text-muted-foreground">ห้องนี้ไม่มีรายวิชา</p>}
          </div>
        </div>
      )}

      {/* Rate: table */}
      {cls && !overview && selected.length > 0 && !loading && (
        <>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className={`${GRID} hidden md:grid text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-muted/30`}>
              <span>นักเรียน</span>
              {CLASSROOM_BEHAVIOR_CRITERIA.map((c) => <span key={c.key}>{c.label}</span>)}
              <span>สรุป</span>
            </div>
            {students.map((s) => {
              const d = drafts[s.id] ?? {};
              const complete = d.responsibility && d.participation && d.effort;
              return (
                <div key={s.id} className={GRID}>
                  <div className="flex items-center gap-3 min-w-0">
                    <StudentAvatar photoURL={s.photoURL} studentId={s.id} name={s.firstName} gender={s.gender as 'male' | 'female' | undefined} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{s.prefix}{s.firstName} {s.lastName}</p>
                      <p className="text-xs text-muted-foreground">{s.studentCode}</p>
                    </div>
                  </div>
                  {CLASSROOM_BEHAVIOR_CRITERIA.map((c) => (
                    <div key={c.key} className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground md:hidden">{c.label}</span>
                      <ScorePicker value={d[c.key]} disabled={!editable} onChange={(v) => setScore(s.id, c.key, v)} />
                    </div>
                  ))}
                  <LevelBadge score={complete ? classroomBehaviorOverall(d as ClassroomBehaviorScores) : undefined} />
                </div>
              );
            })}
            {!students.length && <p className="py-8 text-center text-sm text-muted-foreground">ไม่พบรายชื่อนักเรียน</p>}
          </div>
          {editable && (
            <Button className="w-full" disabled={saving || !students.length} onClick={handleSave}>
              {saving ? 'กำลังบันทึก...' : selected.length > 1 ? `บันทึกลง ${selected.length} วิชา` : 'บันทึก'}
            </Button>
          )}
        </>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.deleteIds.length ? 'เขียนทับ/ลบผลที่บันทึกไว้?' : 'เขียนทับผลที่บันทึกไว้?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.conflicts ? `มี ${pending.conflicts} รายการที่มีผลประเมินเดิมต่างจากที่กรอก จะถูกเขียนทับ` : ''}
              {pending?.conflicts && pending.deleteIds.length ? ' และ ' : ''}
              {pending?.deleteIds.length ? `มี ${pending.deleteIds.length} รายการที่ล้างผลจนว่าง ผลเดิมจะถูกลบ` : ''}
              {' '}ในวิชาที่เลือก
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => { const p = pending; setPending(null); if (p) void commit(p); }}>
              ยืนยันและบันทึก
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ClassroomBehaviorPage() {
  const { role } = useAuth();
  const { canDelete } = useMyPermissions();
  const { year, activeSemester, isLoaded } = useActiveAcademicYear();
  // Header slots live in PortalLayout, already mounted when this lazy page renders
  const [rightEl] = useState(() => document.getElementById('header-portal-right-actions'));
  const [mobileEl] = useState(() => document.getElementById('header-portal-mobile-actions'));
  // Settings gear in the main portal header: `full` level only (sysadmin always)
  const showGear = role !== 'student' && canDelete('classroomBehavior');

  if (!isLoaded || !year) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-700">
        กรุณาตั้งค่าปีการศึกษาก่อน
      </div>
    );
  }
  const semester = (activeSemester as 1 | 2) ?? 1;
  const yearId = String(year);

  return (
    <div className="flex flex-1 flex-col min-h-0 gap-4 pb-24 font-sukhumvit">
      {showGear && rightEl && createPortal(<ClassroomBehaviorSettings />, rightEl)}
      {showGear && mobileEl && createPortal(<ClassroomBehaviorSettings />, mobileEl)}
      {role === 'student'
        ? <StudentView year={yearId} semester={semester} />
        : <StaffView year={yearId} semester={semester} />}
    </div>
  );
}
