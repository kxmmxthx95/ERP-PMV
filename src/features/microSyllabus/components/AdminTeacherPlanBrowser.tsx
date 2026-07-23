import { useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HiAcademicCap, HiArrowLeft, HiHomeModern, HiOutlineUserGroup } from 'react-icons/hi2';
import GradeBookClassSidebar from '@/features/grades/components/GradeBookClassSidebar';
import SidebarCollapseButton from '@/features/grades/components/SidebarCollapseButton';
import { Button } from '@/components/ui/button';
import { buildTeacherIdentityKeys } from '@/lib/teachers/teacherIdentity';
import { cn } from '@/lib/utils';
import { DEPARTMENT_CONFIG, type Department, type SubjectCategory } from '@/types/curriculum';
import type { MicroSyllabus } from '@/types/microSyllabus';
import type { TeacherProfile } from '@/types/teacher';
import type { ClassRoom } from '@/types/class';
import { GRADE_LEVEL_ORDER } from '@/types/class';
import type { ScheduleEntry } from '@/types/schedule';
import type { CalendarEvent } from '@/types/calendar';
import type { ClassSettingsMap } from '@/lib/firestoreShared/classSettingsStore';
import type { DeptSemesterSettings } from '@/lib/firestoreShared/deptSemestersStore';
import { computeSyllabusPct, type SyllabusProgressContext } from '../utils/teachingPlanCalendar';
import AdminProgressView from './AdminProgressView';
import WeeklyTopicGrid from './WeeklyTopicGrid';

type BrowseMode = 'class' | 'teacher';

interface Props {
  teachers: TeacherProfile[];
  syllabi: MicroSyllabus[];
  semesterStart: string;
  semesterEnd: string;
  subjectCategoryByKey?: ReadonlyMap<string, SubjectCategory>;
  classesById: Map<string, ClassRoom>;
  scheduleEntries: ScheduleEntry[];
  calendarEvents: CalendarEvent[];
  classSettingsMap: ClassSettingsMap;
  deptSemesterSettings: DeptSemesterSettings | null;
  yearBE: string;
  semester: 1 | 2;
  academicYear?: { startDate?: string; endDate?: string } | null;
}

interface TeacherPlanEntry {
  id: string;
  name: string;
  photoURL?: string;
  syllabi: MicroSyllabus[];
  avgPct: number;
}

const AVATAR_COLORS: CSSProperties[] = [
  { background: 'rgba(99,102,241,0.15)', color: '#4338ca' },
  { background: 'rgba(236,72,153,0.15)', color: '#be185d' },
  { background: 'rgba(16,185,129,0.15)', color: '#047857' },
  { background: 'rgba(249,115,22,0.15)', color: '#c2410c' },
  { background: 'rgba(20,184,166,0.15)', color: '#0f766e' },
  { background: 'rgba(168,85,247,0.15)', color: '#7c3aed' },
];

function stripThaiHonorific(name: string): string {
  return name.replace(/^(นาย|นางสาว|นาง|ดร\.?|ผศ\.?)\s*/i, '').replace(/\s+/g, ' ').trim();
}

function normalizeTeacherName(value: string): string {
  return stripThaiHonorific(value).toLowerCase();
}

function avatarColor(name: string): CSSProperties {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function matchesTeacherSyllabus(syllabus: MicroSyllabus, teacher: TeacherProfile): boolean {
  const keys = buildTeacherIdentityKeys(teacher.userId ?? '', teacher);
  if (keys.has(syllabus.teacherId)) return true;
  return normalizeTeacherName(syllabus.teacherName) === normalizeTeacherName(teacher.name);
}

function syllabusInDepartment(syllabus: MicroSyllabus, dept: Department): boolean {
  if (syllabus.departmentId === dept) return true;
  return DEPARTMENT_CONFIG[dept].grades.includes(syllabus.gradeLevel);
}

function computeAvgPct(items: MicroSyllabus[], ctx: SyllabusProgressContext): number {
  if (items.length === 0) return 0;
  const pcts = items.map((s) => computeSyllabusPct(s, ctx).pct);
  return Math.round(pcts.reduce((sum, pct) => sum + pct, 0) / pcts.length);
}

function buildTeacherEntries(
  teachers: TeacherProfile[],
  syllabi: MicroSyllabus[],
  ctx: SyllabusProgressContext,
): TeacherPlanEntry[] {
  const matchedSyllabusIds = new Set<string>();
  const entries: TeacherPlanEntry[] = [];

  const activeTeachers = teachers
    .filter((t) => t.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));

  for (const teacher of activeTeachers) {
    const teacherSyllabi = syllabi.filter((s) => {
      if (!matchesTeacherSyllabus(s, teacher)) return false;
      matchedSyllabusIds.add(s.id);
      return true;
    });

    entries.push({
      id: teacher.id,
      name: teacher.name,
      photoURL: teacher.photoURL,
      syllabi: teacherSyllabi,
      avgPct: computeAvgPct(teacherSyllabi, ctx),
    });
  }

  const orphanGroups = new Map<string, MicroSyllabus[]>();
  for (const syllabus of syllabi) {
    if (matchedSyllabusIds.has(syllabus.id)) continue;
    const key = `${syllabus.teacherId}|${normalizeTeacherName(syllabus.teacherName)}`;
    const group = orphanGroups.get(key) ?? [];
    group.push(syllabus);
    orphanGroups.set(key, group);
  }

  for (const [key, group] of orphanGroups) {
    entries.push({
      id: `orphan:${key}`,
      name: group[0]?.teacherName || 'ครูไม่ระบุ',
      syllabi: group,
      avgPct: computeAvgPct(group, ctx),
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

function TeacherPlanCard({
  entry,
  active,
  onClick,
}: {
  entry: TeacherPlanEntry;
  active: boolean;
  onClick: () => void;
}) {
  const hasPlans = entry.syllabi.length > 0;
  const initial = entry.name.charAt(0) || '?';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
        active
          ? 'border-foreground bg-foreground text-background shadow-sm'
          : 'border-border bg-card text-foreground hover:bg-muted/50',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-[13px] font-black',
          active ? 'bg-background/15 text-background' : '',
        )}
        style={active ? undefined : avatarColor(entry.name)}
      >
        {entry.photoURL ? (
          <img src={entry.photoURL} alt={entry.name} className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-black font-sukhumvit leading-tight">{entry.name}</p>
        <p
          className={cn(
            'mt-0.5 text-[10px] font-bold',
            active ? 'text-background/75' : 'text-muted-foreground',
          )}
        >
          {hasPlans ? `${entry.syllabi.length} วิชา · ${entry.avgPct}%` : 'ยังไม่มีแผน'}
        </p>
      </div>
    </button>
  );
}

export default function AdminTeacherPlanBrowser({
  teachers,
  syllabi,
  semesterStart,
  semesterEnd,
  subjectCategoryByKey,
  classesById,
  scheduleEntries,
  calendarEvents,
  classSettingsMap,
  deptSemesterSettings,
  yearBE,
  semester,
  academicYear,
}: Props) {
  const [filterDepartment, setFilterDepartment] = useState('');
  const [browseMode, setBrowseMode] = useState<BrowseMode>('class');
  const [filterGradeLevel, setFilterGradeLevel] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedSyllabusId, setSelectedSyllabusId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const yearClasses = useMemo(() => Array.from(classesById.values()), [classesById]);

  const availableGrades = useMemo(() => {
    if (!filterDepartment) return [];
    const grades = new Set<string>();
    yearClasses
      .filter((c) => c.departmentId === filterDepartment)
      .forEach((c) => {
        if (c.gradeLevel) grades.add(c.gradeLevel);
      });
    return Array.from(grades).sort(
      (a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99),
    );
  }, [yearClasses, filterDepartment]);

  const classOptions = useMemo(() => {
    if (!filterDepartment || !filterGradeLevel) return [];
    return yearClasses
      .filter((c) => c.departmentId === filterDepartment && c.gradeLevel === filterGradeLevel)
      .slice()
      .sort((a, b) =>
        (a.roomNumber || a.className).localeCompare(b.roomNumber || b.className, undefined, {
          numeric: true,
        }),
      );
  }, [yearClasses, filterDepartment, filterGradeLevel]);

  const selectedClass = useMemo(
    () => classesById.get(selectedClassId) ?? null,
    [classesById, selectedClassId],
  );

  const progressCtx = useMemo<SyllabusProgressContext>(
    () => ({
      classesById,
      scheduleEntries,
      calendarEvents,
      classSettingsMap,
      deptSemesterSettings,
      yearBE,
      semester,
      academicYear,
    }),
    [
      classesById,
      scheduleEntries,
      calendarEvents,
      classSettingsMap,
      deptSemesterSettings,
      yearBE,
      semester,
      academicYear,
    ],
  );

  const teacherEntries = useMemo(() => {
    if (!filterDepartment || browseMode !== 'teacher') return [];
    const dept = filterDepartment as Department;
    const deptTeachers = teachers.filter((t) => t.department === dept);
    const deptSyllabi = syllabi.filter((s) => syllabusInDepartment(s, dept));
    return buildTeacherEntries(deptTeachers, deptSyllabi, progressCtx);
  }, [teachers, syllabi, filterDepartment, browseMode, progressCtx]);

  const selectedTeacher = useMemo(
    () => teacherEntries.find((e) => e.id === selectedTeacherId) ?? null,
    [teacherEntries, selectedTeacherId],
  );

  const classSyllabi = useMemo(() => {
    if (!selectedClassId) return [];
    return syllabi.filter((s) => s.classId === selectedClassId);
  }, [syllabi, selectedClassId]);

  const listSyllabi = browseMode === 'class' ? classSyllabi : (selectedTeacher?.syllabi ?? []);

  const selectedSyllabus = useMemo(
    () => listSyllabi.find((s) => s.id === selectedSyllabusId) ?? null,
    [listSyllabi, selectedSyllabusId],
  );

  const hasRightSelection =
    browseMode === 'class' ? !!selectedClassId : !!selectedTeacherId;

  const handleSelectDept = (dept: Department) => {
    setFilterDepartment(dept);
    setFilterGradeLevel('');
    setSelectedClassId('');
    setSelectedTeacherId(null);
    setSelectedSyllabusId(null);
  };

  const handleBrowseMode = (mode: BrowseMode) => {
    setBrowseMode(mode);
    setFilterGradeLevel('');
    setSelectedClassId('');
    setSelectedTeacherId(null);
    setSelectedSyllabusId(null);
  };

  const handleSelectGrade = (level: string) => {
    setFilterGradeLevel(level);
    setSelectedClassId('');
    setSelectedSyllabusId(null);
  };

  const handleSelectClass = (classId: string) => {
    setSelectedClassId(classId);
    setSelectedSyllabusId(null);
  };

  const modeToggle = filterDepartment ? (
    <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border bg-muted/40 p-1">
      {(
        [
          { id: 'class' as const, label: 'รายชั้น' },
          { id: 'teacher' as const, label: 'รายครู' },
        ] as const
      ).map((opt) => {
        const active = browseMode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleBrowseMode(opt.id)}
            className={cn(
              'rounded-xl px-2 py-2 text-[11px] font-black font-sukhumvit transition-all',
              active
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  ) : null;

  const collapsedModeRail = filterDepartment ? (
    <>
      <div className="flex w-full flex-col items-center gap-1.5 border-t border-border pt-2">
        {(
          [
            { id: 'class' as const, label: 'รายชั้น', Icon: HiAcademicCap },
            { id: 'teacher' as const, label: 'รายครู', Icon: HiOutlineUserGroup },
          ] as const
        ).map((opt) => {
          const active = browseMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleBrowseMode(opt.id)}
              title={opt.label}
              aria-label={opt.label}
              aria-pressed={active}
              className={cn(
                'flex size-11 items-center justify-center rounded-xl border transition-all',
                active
                  ? 'border-foreground bg-foreground text-background shadow-sm'
                  : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
              )}
            >
              <opt.Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      {browseMode === 'class' && availableGrades.length > 0 ? (
        <div className="flex max-h-[min(40vh,20rem)] w-full flex-col items-center gap-2 overflow-y-auto overscroll-y-contain scrollbar-hide border-t border-border px-1.5 py-2">
          {availableGrades.map((grade) => {
            const active = filterGradeLevel === grade;
            return (
              <button
                key={grade}
                type="button"
                onClick={() => handleSelectGrade(grade)}
                title={grade}
                aria-label={grade}
                aria-pressed={active}
                className={cn(
                  'flex size-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border transition-all',
                  active
                    ? 'border-2 border-foreground bg-foreground text-background'
                    : 'border border-border bg-muted/40 text-foreground hover:bg-muted',
                )}
              >
                <HiAcademicCap className="h-3.5 w-3.5" />
                <span className="text-[9px] font-black font-sukhumvit leading-none">{grade}</span>
              </button>
            );
          })}

          {filterGradeLevel && classOptions.length > 0
            ? classOptions.map((room) => {
                const active = selectedClassId === room.id;
                const label = room.roomNumber || room.className;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => handleSelectClass(room.id)}
                    title={room.className}
                    aria-label={room.className}
                    aria-pressed={active}
                    className={cn(
                      'flex size-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border transition-all',
                      active
                        ? 'border-2 border-foreground bg-foreground text-background'
                        : 'border border-border bg-card text-foreground hover:bg-muted/50',
                    )}
                  >
                    <HiHomeModern className="h-3.5 w-3.5" />
                    <span className="max-w-full truncate px-0.5 text-[9px] font-black font-sukhumvit leading-none">
                      {label}
                    </span>
                  </button>
                );
              })
            : null}
        </div>
      ) : null}

      {browseMode === 'teacher' && teacherEntries.length > 0 ? (
        <div className="flex max-h-[min(40vh,20rem)] w-full flex-col items-center gap-2 overflow-y-auto overscroll-y-contain scrollbar-hide border-t border-border px-1.5 py-2">
          {teacherEntries.map((entry) => {
            const active = selectedTeacherId === entry.id;
            const initial = entry.name.charAt(0) || '?';
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setSelectedTeacherId(entry.id);
                  setSelectedSyllabusId(null);
                }}
                title={entry.name}
                aria-label={entry.name}
                aria-pressed={active}
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[13px] font-black transition-all',
                  active
                    ? 'border-2 border-foreground'
                    : 'border border-border hover:opacity-90',
                  active && !entry.photoURL && 'bg-foreground text-background',
                )}
                style={entry.photoURL || active ? undefined : avatarColor(entry.name)}
              >
                {entry.photoURL ? (
                  <img src={entry.photoURL} alt="" className="h-full w-full object-cover" />
                ) : (
                  initial
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  ) : null;

  const teacherList =
    browseMode === 'teacher' && filterDepartment ? (
      <div className="flex flex-col gap-2 pb-1">
        {teacherEntries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-[12px] font-bold text-muted-foreground">
            ไม่พบครูในแผนกนี้
          </div>
        ) : (
          teacherEntries.map((entry) => (
            <TeacherPlanCard
              key={entry.id}
              entry={entry}
              active={selectedTeacherId === entry.id}
              onClick={() => {
                setSelectedTeacherId(entry.id);
                setSelectedSyllabusId(null);
              }}
            />
          ))
        )}
      </div>
    ) : null;

  const emptyHint = !filterDepartment
    ? 'เลือกแผนกจากแถบด้านซ้าย'
    : browseMode === 'class'
      ? !filterGradeLevel
        ? 'เลือกระดับชั้นเพื่อดูห้องเรียน'
        : 'เลือกห้องเรียนเพื่อดูแผนการสอน'
      : 'เลือกครูเพื่อดูแผนการสอน';

  return (
    <div className="flex h-full min-h-0 max-h-full w-full flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch">
        <div
          className={cn(
            'flex min-h-0 w-full shrink-0 flex-col overflow-hidden lg:h-auto lg:max-h-full',
            sidebarCollapsed ? 'lg:w-20 xl:w-20' : 'lg:w-[280px] xl:w-[300px]',
            hasRightSelection ? 'hidden lg:flex' : 'flex min-h-0 flex-1 lg:flex-none',
          )}
        >
          <GradeBookClassSidebar
            selectedDept={filterDepartment}
            selectedGrade={filterGradeLevel}
            selectedClassId={selectedClassId}
            gradeOptions={availableGrades}
            classOptions={classOptions}
            onSelectDept={handleSelectDept}
            onSelectGrade={handleSelectGrade}
            onSelectClass={handleSelectClass}
            afterDept={modeToggle}
            showGradeRoomNav={browseMode === 'class'}
            collapsed={sidebarCollapsed}
            collapsedExtra={collapsedModeRail}
            headerAction={(
              <SidebarCollapseButton
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed((v) => !v)}
              />
            )}
          >
            {teacherList}
          </GradeBookClassSidebar>
        </div>

        <div
          className={cn(
            'relative flex min-h-0 flex-1 basis-0 flex-col overflow-hidden rounded-2xl border border-border bg-card px-2 pb-2 sm:px-2.5 sm:pb-2.5',
            !hasRightSelection && 'hidden lg:flex',
          )}
        >
          {selectedSyllabus && (
            <div className="mb-3 flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-9 gap-1.5 rounded-xl px-3 text-[12px] font-bold"
                onClick={() => setSelectedSyllabusId(null)}
              >
                <HiArrowLeft className="h-4 w-4" />
                รายวิชา
              </Button>
              <p className="min-w-0 truncate font-sukhumvit text-[13px] font-black text-foreground">
                {selectedSyllabus.subjectName}
                {selectedSyllabus.className ? ` · ${selectedSyllabus.className}` : ''}
              </p>
            </div>
          )}

          {!hasRightSelection && !selectedSyllabus ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center">
              {browseMode === 'teacher' ? (
                <HiOutlineUserGroup className="h-8 w-8 text-muted-foreground/40" />
              ) : (
                <HiAcademicCap className="h-8 w-8 text-muted-foreground/40" />
              )}
              <p className="font-sukhumvit text-[13px] font-black text-muted-foreground">
                {emptyHint}
              </p>
            </div>
          ) : (
            <div
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain scrollbar-hide"
              onWheel={(e) => e.stopPropagation()}
            >
              <AnimatePresence mode="popLayout">
                {selectedSyllabus ? (
                  <motion.div
                    key={selectedSyllabus.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    className="flex w-full flex-col gap-3"
                  >
                    <WeeklyTopicGrid
                      topics={selectedSyllabus.topics}
                      semesterStart={semesterStart}
                      semesterEnd={semesterEnd}
                      onSave={async () => {}}
                      readOnly
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key={browseMode === 'class' ? selectedClassId : selectedTeacherId}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    className="flex w-full flex-col gap-4"
                  >
                    {listSyllabi.length > 0 ? (
                      <AdminProgressView
                        syllabi={listSyllabi}
                        subjectCategoryByKey={subjectCategoryByKey}
                        onSelect={(syllabus) => setSelectedSyllabusId(syllabus.id)}
                        progressCtx={progressCtx}
                      />
                    ) : (
                      <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
                        <p className="font-sukhumvit text-sm font-bold text-muted-foreground">
                          {browseMode === 'class'
                            ? `ห้อง ${selectedClass?.className ?? ''} ยังไม่มีแผนการสอน`
                            : `${selectedTeacher?.name ?? 'ครูท่านนี้'} ยังไม่ได้กรอกแผนการสอน`}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
