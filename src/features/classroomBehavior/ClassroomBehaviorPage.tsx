import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTeachingManager } from '@/hooks/useTeachingManager';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import { useClassroomBehaviorRecords, saveClassroomBehaviorBatch } from '@/hooks/useClassroomBehavior';
import { resolveStudentByAuthUser } from '@/lib/resolveStudentProfile';
import { studentIdentityKeys } from '@/lib/students/studentIdentity';
import { matchesTeacherIdentity } from '@/lib/teachers/teacherIdentity';
import { logActivity } from '@/lib/activityLogger';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import {
  CLASSROOM_BEHAVIOR_CRITERIA,
  CLASSROOM_BEHAVIOR_LEVEL,
  classroomBehaviorDocId,
  classroomBehaviorOverall,
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

const DOT_COLOR = { 3: 'bg-success', 2: 'bg-warning', 1: 'bg-destructive' } as const;

/** Traffic-light status dot; grey = not rated yet. */
function StatusDot({ score }: { score?: ClassroomBehaviorScore }) {
  const label = score ? CLASSROOM_BEHAVIOR_LEVEL[score] : 'ยังไม่ประเมิน';
  return (
    <span title={label} className="inline-flex">
      <span className={`size-4 rounded-full ${score ? DOT_COLOR[score] : 'bg-muted-foreground/30'}`} />
      <span className="sr-only">{label}</span>
    </span>
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
  const { records, loading } = useClassroomBehaviorRecords(
    keys.length ? { studentId: keys, academicYearId: year, semester } : null,
  );

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
  const curriculum = useCurriculum();
  const { coursesByVersion, loadCoursesForVersion } = useCurriculumVersioned();

  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [mode, setMode] = useState<'rate' | 'overview'>('rate');
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
      .filter((s): s is NonNullable<typeof s> => !!s && s.category !== 'activity')
      .map((s) => ({ id: s.id, name: s.name }));
  }, [cls, semester, canViewAll, mgr.teacherIdentityKeys, mgr.mySubjects]);

  useEffect(() => {
    if (cls?.curriculumPackageId) loadCoursesForVersion(cls.curriculumPackageId);
  }, [cls?.curriculumPackageId, loadCoursesForVersion]);

  const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? '';
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
    cls && (overview || subjectId)
      ? { classId: cls.id, academicYearId: year, semester, ...(overview ? {} : { subjectId }) }
      : null,
  );

  // Reset drafts from saved records whenever the loaded set changes
  useEffect(() => {
    const next: Record<string, Draft> = {};
    for (const r of records) next[r.studentId] = { responsibility: r.responsibility, participation: r.participation, effort: r.effort };
    setDrafts(next);
  }, [records]);

  const setScore = (studentId: string, key: keyof ClassroomBehaviorScores, v: ClassroomBehaviorScore) =>
    setDrafts((d) => ({ ...d, [studentId]: { ...d[studentId], [key]: v } }));

  const handleSave = async () => {
    if (!cls) return;
    const rows: ClassroomBehaviorRecord[] = [];
    let incomplete = 0;
    for (const s of students) {
      const d = drafts[s.id];
      if (!d?.responsibility || !d.participation || !d.effort) { if (d && (d.responsibility || d.participation || d.effort)) incomplete++; continue; }
      rows.push({
        id: classroomBehaviorDocId({ academicYearId: year, semester, classId: cls.id, subjectId, studentId: s.id }),
        studentId: s.id,
        studentName: `${s.prefix ?? ''}${s.firstName} ${s.lastName}`,
        studentCode: s.studentCode ?? '',
        classId: cls.id,
        className: cls.className,
        subjectId,
        subjectName,
        teacherId: user?.uid ?? '',
        departmentId: cls.departmentId,
        academicYearId: year,
        semester,
        responsibility: d.responsibility,
        participation: d.participation,
        effort: d.effort,
        updatedAt: new Date().toISOString(),
      });
    }
    if (!rows.length) { toast.error('ยังไม่ได้ประเมินนักเรียนคนใดครบ 3 เกณฑ์'); return; }
    setSaving(true);
    try {
      await saveClassroomBehaviorBatch(rows);
      logActivity({ action: 'classroom_behavior_save', category: 'academic', targetId: `${cls.id}_${subjectId}`, detail: `${rows.length} คน` });
      toast.success(`บันทึก ${rows.length} คน${incomplete ? ` (ข้าม ${incomplete} คนที่ยังไม่ครบ)` : ''}`);
      reload();
    } catch {
      toast.error('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
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
      if (i && !i.activity) out.set(ec.subjectId, i.name);
    }
    // legacy records for subjects no longer resolvable
    for (const r of records) if (!out.has(r.subjectId) && !info.get(r.subjectId)?.activity) out.set(r.subjectId, r.subjectName);
    return [...out.entries()];
  }, [cls, semester, coursesByVersion, curriculum.subjects, mgr.mySubjects, records]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect className="w-44" value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectId(''); }}>
          <option value="">เลือกห้อง</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.className}</option>)}
        </NativeSelect>
        {!overview && (
          <NativeSelect className="w-64" value={subjectId} disabled={!cls} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">เลือกวิชา</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </NativeSelect>
        )}
        {canOverview && cls && (
          <Button variant="outline" onClick={() => setMode(overview ? 'rate' : 'overview')}>
            {overview ? 'กลับไปกรอก' : 'ภาพรวมทุกวิชา'}
          </Button>
        )}
      </div>

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
              <span className="w-48">นักเรียน</span>
              {subjectsInOverview.map(([sid, name]) => <span key={sid} className="w-32 truncate text-center" title={name}>{name}</span>)}
            </div>
            {students.map((s) => (
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
              </div>
            ))}
            {!subjectsInOverview.length && <p className="py-8 text-center text-sm text-muted-foreground">ห้องนี้ไม่มีรายวิชา</p>}
          </div>
        </div>
      )}

      {/* Rate: table */}
      {cls && !overview && subjectId && !loading && (
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
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export default function ClassroomBehaviorPage() {
  const { role } = useAuth();
  const { year, activeSemester, isLoaded } = useActiveAcademicYear();

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
      {role === 'student'
        ? <StudentView year={yearId} semester={semester} />
        : <StaffView year={yearId} semester={semester} />}
    </div>
  );
}
