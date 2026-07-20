import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  HiOutlineCalendarDays,
  HiOutlineCog6Tooth,
  HiCheck,
} from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import { resolveTeacherFromAuth, buildTeacherIdentityKeys, matchesTeacherIdentity } from '@/lib/teachers/teacherIdentity';
import { resolveSubjectDetail } from '@/lib/teachers/resolveSubjectDetail';
import { useMicroSyllabus, useMicroSyllabusAll } from '@/hooks/useMicroSyllabus';
import { cn } from '@/lib/utils';
import { getLocalDateString } from '@/lib/dateUtils';
import { Skeleton } from '@/components/ui/skeleton';
import WeeklyTopicGrid from './components/WeeklyTopicGrid';
import LessonContentSettingsDrawer from './components/LessonContentSettingsDrawer';
import { MicroSyllabusSubjectSelect } from './components/MicroSyllabusSubjectSelect';
import { resolveSemesterDateRange, hasTopicContent } from './utils/teachingPlanCalendar';
import AdminTeacherPlanBrowser from './components/AdminTeacherPlanBrowser';
import type { MicroSyllabus, WeeklyTopic } from '@/types/microSyllabus';

const EMPTY_LESSON_OPTIONS: string[] = [];

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssignedSubject {
  subjectId: string;
  subjectName: string;
  classId: string;       // '' when not linked to a class
  className: string;     // 'ยังไม่ผูกห้องเรียน' when from teachingSubjectIds only
  syllabus: MicroSyllabus | null;
}

function stripThaiHonorific(name: string): string {
  return name.replace(/^(นาย|นางสาว|นาง|ดร\.?|ผศ\.?)\s*/i, '').replace(/\s+/g, ' ').trim();
}

function normalizeTeacherName(value: string): string {
  return stripThaiHonorific(value).toLowerCase();
}

// ── Assigned Subject Card (sidebar) ──────────────────────────────────────────

function TeachingPlanCalendarSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 px-1 py-3">
        <Skeleton className="h-8 w-8 rounded-xl bg-slate-100" />
        <Skeleton className="h-4 w-28 rounded-lg bg-slate-100" />
        <Skeleton className="h-8 w-8 rounded-xl bg-slate-100" />
      </div>
      <div className="grid grid-cols-7 gap-1 px-1 pt-1 pb-1">
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="mx-auto h-3 w-4 rounded bg-slate-50" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 px-1 pb-2">
        {Array.from({ length: 35 }, (_, index) => (
          <Skeleton key={index} className="min-h-[52px] rounded-xl bg-slate-100 lg:min-h-[80px]" />
        ))}
      </div>
      <div className="space-y-2 px-1 pb-2 lg:hidden">
        <Skeleton className="h-3 w-28 rounded bg-slate-50" />
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-20 rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

function AssignedSubjectCardSkeleton() {
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-3.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-[72%] rounded-lg bg-slate-100" />
          <Skeleton className="h-3 w-[34%] rounded-lg bg-slate-50" />
        </div>
        <Skeleton className="h-5 w-10 shrink-0 rounded-lg bg-slate-100" />
      </div>
      <Skeleton className="h-1 w-full rounded-full bg-slate-100" />
    </div>
  );
}

function AssignedSubjectsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <AssignedSubjectCardSkeleton key={index} />
      ))}
    </div>
  );
}

function AssignedSubjectCard({
  assignment,
  active,
  creating,
  onClick,
}: {
  assignment: AssignedSubject;
  active: boolean;
  creating: boolean;
  onClick: () => void;
}) {
  const { syllabus } = assignment;
  const completed = syllabus?.topics.filter(t => t.completedAt).length ?? 0;
  const planned = syllabus?.topics.filter((t) => hasTopicContent(t)).length ?? 0;
  const total = planned > 0 ? planned : (syllabus?.totalWeeks ?? 0);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const hasStarted = syllabus !== null;
  const barColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#6366f1';
  const noClass = assignment.classId === '';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={creating || noClass}
      className={cn(
        'w-full text-left rounded-2xl p-3.5 border transition-all disabled:opacity-50',
        noClass
          ? 'bg-slate-50 border-slate-200 cursor-not-allowed'
          : active
            ? 'bg-indigo-600 border-indigo-600 shadow-md'
            : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-black leading-tight truncate font-sukhumvit', active ? 'text-white' : noClass ? 'text-slate-400' : 'text-slate-800')}>
            {assignment.subjectName}
          </p>
          <p className={cn('text-[11px] mt-0.5 font-sarabun', active ? 'text-indigo-200' : noClass ? 'text-slate-300' : 'text-slate-400')}>
            {assignment.className}
          </p>
        </div>
        {noClass ? null : creating ? (
          <div className="w-4 h-4 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin shrink-0 mt-1" />
        ) : hasStarted ? (
          <span className={cn('text-[11px] font-black shrink-0 px-2 py-0.5 rounded-lg', active ? 'bg-white/20 text-white' : 'text-indigo-600 bg-indigo-50')}>
            {pct}%
          </span>
        ) : (
          <span className={cn('text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-lg', active ? 'bg-white/20 text-white' : 'text-slate-400 bg-slate-50')}>
            ยังไม่เริ่ม
          </span>
        )}
      </div>

      {!noClass && (
        <div className={cn('h-1 rounded-full overflow-hidden', active ? 'bg-indigo-500' : 'bg-slate-100')}>
          {hasStarted && (
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: active ? '#fff' : barColor }}
            />
          )}
        </div>
      )}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MicroSyllabusPage() {
  const { user, userData, role } = useAuth();
  const { activeYear, activeSemester } = useActiveAcademicYear();

  const isAdmin = role === 'admin' || role === 'sysadmin';
  const isTeacher = role === 'teacher';

  const displayName = userData?.firstName
    ? `${userData.prefix ?? ''}${userData.firstName} ${userData.lastName ?? ''}`.trim()
    : (user?.displayName ?? user?.email ?? 'ครูผู้สอน');

  const authUid = user?.uid ?? '';
  const departmentId = (userData as { departmentId?: string } | null)?.departmentId ?? 'secondary';

  // ── Data sources (aligned with TeacherDetailPanel / TeacherManager) ───────
  const { teachers, allSubjects } = useTeacherManager();
  const { allClasses } = useClassroomManager();
  const { versions, coursesByVersion, loadCoursesForVersion } = useCurriculumVersioned();

  // Resolve teacher profile (id OR userId OR display name — same sources as Teacher Manager)
  const myTeacher = useMemo(() => {
    const linked = resolveTeacherFromAuth(authUid, teachers);
    if (linked) return linked;

    const normalized = normalizeTeacherName(displayName);
    if (!normalized) return null;

    return teachers.find((t) => normalizeTeacherName(String(t.name || '')) === normalized) ?? null;
  }, [authUid, teachers, displayName]);
  const myIdentityKeys = useMemo(
    () => buildTeacherIdentityKeys(authUid, myTeacher),
    [authUid, myTeacher],
  );

  const canManageOwnPlans = isTeacher || myTeacher !== null;

  const yearClasses = useMemo(
    () => allClasses.filter((cls) => {
      if (!activeYear) return true;
      const yearKey = String(activeYear.year);
      return (
        String(cls.academicYearId ?? '') === yearKey
        || String((cls as { academicYear?: string }).academicYear ?? '') === yearKey
      );
    }),
    [allClasses, activeYear],
  );

  // Preload versioned curriculum courses (required to resolve enrolledCourses.subjectId)
  useEffect(() => {
    if (!yearClasses.length || !versions.length) return;

    const versionIds = new Set<string>();
    yearClasses.forEach((cls) => {
      const pkgId = cls.curriculumPackageId || (cls as { curriculumId?: string }).curriculumId;
      if (pkgId) versionIds.add(String(pkgId));
    });

    versionIds.forEach((versionId) => {
      if (!versions.some((v) => v.id === versionId)) return;
      if (!coursesByVersion[versionId]) {
        void loadCoursesForVersion(versionId);
      }
    });
  }, [yearClasses, versions, coursesByVersion, loadCoursesForVersion]);

  const pendingCurriculumLoads = useMemo(() => {
    const needed = new Set<string>();
    yearClasses.forEach((cls) => {
      const pkgId = cls.curriculumPackageId || (cls as { curriculumId?: string }).curriculumId;
      if (pkgId) needed.add(String(pkgId));
    });
    return [...needed].filter(
      (id) => versions.some((v) => v.id === id) && !coursesByVersion[id],
    );
  }, [yearClasses, versions, coursesByVersion]);

  // All versioned courses flat list (for name lookup)
  const allVersionedCourses = useMemo(
    () => Object.values(coursesByVersion).flat(),
    [coursesByVersion],
  );

  const resolveSubject = useMemo(
    () => (subjectId: string) => resolveSubjectDetail(subjectId, allSubjects, allVersionedCourses),
    [allSubjects, allVersionedCourses],
  );

  // ── Micro-syllabus hooks ──────────────────────────────────────────────────
  const teacherHook = useMicroSyllabus(canManageOwnPlans ? authUid : null);
  const adminHook = useMicroSyllabusAll(isAdmin);

  const { syllabi, loading: teacherLoading, createSyllabus, updateTopics, updateLessonOptions } = teacherHook;
  const { syllabi: allSyllabi, loading: adminLoading } = adminHook;

  const semesterRange = useMemo(
    () => resolveSemesterDateRange(activeYear?.year ?? '', activeSemester as 1 | 2),
    [activeYear?.year, activeSemester],
  );

  // ── Derive assignments — mirrors TeacherDetailPanel.realAssignments ───────
  const assignedSubjects = useMemo((): AssignedSubject[] => {
    if (!canManageOwnPlans || !activeYear) return [];

    const result: AssignedSubject[] = [];
    const seenKeys = new Set<string>(); // "classId-subjectId"
    const semester = activeSemester as 1 | 2 | undefined;

    // Step 1: From class enrolledCourses (aligned with useTeachingManager)
    for (const cls of yearClasses) {
      const className = cls.className || cls.roomNumber || '-';

      for (const ec of cls.enrolledCourses ?? []) {
        if (!matchesTeacherIdentity(ec.teacherId, myIdentityKeys)) continue;
        if (semester && ec.semester != null && ec.semester !== semester) continue;

        const key = `${cls.id}-${ec.subjectId}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const subject = resolveSubject(ec.subjectId);
        if (!subject) continue;

        const syllabus = syllabi.find(
          s =>
            (s.subjectId === subject.id && s.classId === cls.id) ||
            (s.subjectId === ec.subjectId && s.classId === cls.id) ||
            (s.subjectName === subject.name && s.className === className),
        ) ?? null;

        result.push({
          subjectId: subject.id,
          subjectName: subject.name,
          classId: cls.id,
          className,
          syllabus,
        });
      }
    }

    // Step 2: Subjects in teachingSubjectIds not linked to any class yet
    const coveredSubjectIds = new Set(result.map(r => r.subjectId));
    for (const subjectId of (myTeacher?.teachingSubjectIds ?? [])) {
      if (coveredSubjectIds.has(subjectId)) continue;
      const subject = resolveSubject(subjectId);
      if (!subject) continue;

      result.push({
        subjectId: subject.id,
        subjectName: subject.name,
        classId: '',
        className: 'ยังไม่ผูกห้องเรียน',
        syllabus: null,
      });
    }

    return result.sort((a, b) => {
      if (!a.classId && b.classId) return 1;
      if (a.classId && !b.classId) return -1;
      return a.className.localeCompare(b.className, 'th');
    });
  }, [yearClasses, myIdentityKeys, myTeacher, resolveSubject, syllabi, canManageOwnPlans, activeYear, activeSemester]);

  // ── Selection state ───────────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandledRef = useRef(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [lessonSettingsOpen, setLessonSettingsOpen] = useState(false);
  const [headerRightEl, setHeaderRightEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  const [reflectionPlanStatus, setReflectionPlanStatus] = useState<'on_plan' | 'off_plan'>('on_plan');
  const [reflectionOverview, setReflectionOverview] = useState<'good' | 'medium' | 'review'>('good');
  const [reflectionNotes, setReflectionNotes] = useState('');
  const [savingReflection, setSavingReflection] = useState(false);

  useEffect(() => {
    setHeaderRightEl(document.getElementById('header-portal-right-actions'));
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  const selectedAssignment = useMemo(
    () => assignedSubjects.find(a => `${a.subjectId}|${a.classId}` === selectedKey) ?? null,
    [assignedSubjects, selectedKey],
  );

  const selectedSyllabus = useMemo(() => {
    if (!selectedAssignment) return null;
    const syllabusId = selectedAssignment.syllabus?.id ?? pendingSelectId;
    if (syllabusId) {
      return syllabi.find((syllabus) => syllabus.id === syllabusId) ?? selectedAssignment.syllabus;
    }
    return null;
  }, [selectedAssignment, syllabi, pendingSelectId]);

  useEffect(() => {
    if (pendingSelectId && syllabi.find(s => s.id === pendingSelectId)) {
      setPendingSelectId(null);
    }
  }, [syllabi, pendingSelectId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectAssignment = async (assignment: AssignedSubject) => {
    if (!assignment.classId) return; // ยังไม่ผูกห้องเรียน — ไม่สร้างแผน
    const key = `${assignment.subjectId}|${assignment.classId}`;
    setSelectedKey(key);
    if (assignment.syllabus) return;

    if (!activeYear || !activeSemester) return;
    setCreatingKey(key);
    const gradeLevel = assignment.className.split('/')[0].trim();
    const newId = await createSyllabus({
      academicYearId: activeYear.year,
      semester: activeSemester as 1 | 2,
      departmentId,
      teacherId: authUid,
      teacherName: displayName,
      subjectId: assignment.subjectId,
      subjectName: assignment.subjectName,
      classId: assignment.classId,
      className: assignment.className,
      gradeLevel,
      totalWeeks: 20,
      topics: [],
    });
    setPendingSelectId(newId);
    setCreatingKey(null);
  };

  // Deep link from "งานประจำวันครู" widget: /portal/micro-syllabus?classId=&subjectId=
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    const classId = searchParams.get('classId');
    const subjectId = searchParams.get('subjectId');
    if (!classId || !subjectId) return;
    if (assignedSubjects.length === 0) return;
    const match = assignedSubjects.find((a) => a.classId === classId && a.subjectId === subjectId);
    if (!match) return;
    deepLinkHandledRef.current = true;
    void handleSelectAssignment(match);
    setSearchParams({}, { replace: true });
  }, [assignedSubjects, searchParams, setSearchParams]);

  const handleSaveTopics = async (topics: WeeklyTopic[]) => {
    if (!selectedSyllabus) return;
    await updateTopics(selectedSyllabus.id, topics);
  };

  const selectedLessonOptions = useMemo(
    () => selectedSyllabus?.lessonOptions ?? EMPTY_LESSON_OPTIONS,
    [selectedSyllabus?.lessonOptions],
  );

  const handleSaveLessonOptions = async (lessonOptions: string[]) => {
    if (!selectedSyllabus) return;
    await updateLessonOptions(selectedSyllabus.id, lessonOptions);
  };

  const handleSaveReflection = async () => {
    if (!selectedSyllabus) return;
    setSavingReflection(true);
    try {
      const today = getLocalDateString();
      const topicIndex = selectedSyllabus.topics.findIndex(t => t.date === today);
      const updatedTopics = [...selectedSyllabus.topics];

      if (topicIndex >= 0) {
        updatedTopics[topicIndex] = {
          ...updatedTopics[topicIndex],
          teachingReflection: {
            planStatus: reflectionPlanStatus,
            overview: reflectionOverview,
            additionalRequest: reflectionNotes || undefined,
            recordedAt: new Date().toISOString(),
          },
          completedAt: new Date().toISOString(),
        };
      } else {
        updatedTopics.push({
          weekNumber: Math.ceil(updatedTopics.length / 1),
          date: today,
          title: 'บันทึกหลังการสอน',
          teachingReflection: {
            planStatus: reflectionPlanStatus,
            overview: reflectionOverview,
            additionalRequest: reflectionNotes || undefined,
            recordedAt: new Date().toISOString(),
          },
          completedAt: new Date().toISOString(),
        } as WeeklyTopic);
      }

      await handleSaveTopics(updatedTopics);
      setReflectionPlanStatus('on_plan');
      setReflectionOverview('good');
      setReflectionNotes('');
      toast.success('บันทึกหลังการสอนเรียบร้อย');
    } catch {
      toast.error('บันทึกหลังการสอนไม่สำเร็จ');
    } finally {
      setSavingReflection(false);
    }
  };

  const handleBackToSubjects = () => {
    setSelectedKey(null);
    setPendingSelectId(null);
  };

  const selectableAssignments = useMemo(
    () => assignedSubjects.filter((assignment) => assignment.classId !== ''),
    [assignedSubjects],
  );

  const subjectSelectOptions = useMemo(
    () => selectableAssignments.map((assignment) => ({
      key: `${assignment.subjectId}|${assignment.classId}`,
      subjectName: assignment.subjectName,
      className: assignment.className,
    })),
    [selectableAssignments],
  );

  const handleSubjectSelectChange = (key: string) => {
    const assignment = selectableAssignments.find(
      (item) => `${item.subjectId}|${item.classId}` === key,
    );
    if (!assignment || key === selectedKey) return;
    void handleSelectAssignment(assignment);
  };

  // ── No active year ─────────────────────────────────────────────────────────
  if (!activeYear) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-bold text-slate-700 font-sukhumvit">กรุณาตั้งค่าปีการศึกษาก่อน</p>
        </div>
      </div>
    );
  }

  // ── Admin View (sysadmin / admin without linked teacher profile) ───────────
  if (isAdmin && !canManageOwnPlans) {
    return (
      <div className="w-full flex flex-col gap-5 pb-10">
        <MicroSyllabusSubjectSelect
          active={false}
          options={[]}
          selectedKey={null}
          onSelect={() => undefined}
          onBack={() => undefined}
        />
        {adminLoading ? (
          <AssignedSubjectsGridSkeleton count={9} />
        ) : (
          <AdminTeacherPlanBrowser
            teachers={teachers}
            syllabi={allSyllabi}
            semesterStart={semesterRange.start}
            semesterEnd={semesterRange.end}
          />
        )}
      </div>
    );
  }

  // ── Teacher View ──────────────────────────────────────────────────────────
  const lessonSettingsButton = (
    <button
      type="button"
      onClick={() => setLessonSettingsOpen(true)}
      title="ตั้งค่าเนื้อหาบทเรียน"
      className="flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-slate-600 hover:bg-black/[0.04] transition-all active:scale-95 pointer-events-auto"
    >
      <HiOutlineCog6Tooth size={18} />
    </button>
  );

  const headerLessonSettingsPortal = selectedSyllabus ? (
    <>
      {headerRightEl && createPortal(
        <div className="hidden lg:flex items-center gap-2">
          {lessonSettingsButton}
        </div>,
        headerRightEl,
      )}
      {headerMobileActionsEl && createPortal(
        <div className="flex items-center gap-1">
          {lessonSettingsButton}
        </div>,
        headerMobileActionsEl,
      )}
      <LessonContentSettingsDrawer
        open={lessonSettingsOpen}
        onClose={() => setLessonSettingsOpen(false)}
        lessonOptions={selectedLessonOptions}
        onSave={handleSaveLessonOptions}
        subjectName={selectedSyllabus.subjectName}
        className={selectedSyllabus.className}
      />
    </>
  ) : null;

  return (
    <div className="w-full flex flex-col gap-4 pb-10">
      {headerLessonSettingsPortal}
      <MicroSyllabusSubjectSelect
        active={Boolean(selectedSyllabus)}
        options={subjectSelectOptions}
        selectedKey={selectedKey}
        onSelect={handleSubjectSelectChange}
        onBack={handleBackToSubjects}
      />

      {/* Body */}
      {teacherLoading || pendingCurriculumLoads.length > 0 ? (
        selectedSyllabus ? (
          <TeachingPlanCalendarSkeleton />
        ) : (
          <AssignedSubjectsGridSkeleton count={9} />
        )
      ) : assignedSubjects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 gap-4"
        >
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 flex items-center justify-center">
            <HiOutlineCalendarDays size={28} className="text-indigo-400" />
          </div>
          <div className="text-center">
            <p className="font-black text-slate-700 font-sukhumvit">ยังไม่มีรายวิชาที่ได้รับมอบหมาย</p>
            <p className="text-sm text-slate-400 font-sarabun mt-1">
              ระบบจะแสดงรายวิชาจากระบบจัดการครูโดยอัตโนมัติ
            </p>
          </div>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          {selectedSyllabus ? (
            <motion.div
              key={selectedSyllabus.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              className="w-full min-w-0 flex flex-col gap-3"
            >
              {/* Teaching Reflection Form */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-black text-slate-800 font-sukhumvit mb-3">บันทึกหลังการสอนวันนี้</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 mb-1">แผนการสอน</label>
                      <select
                        value={reflectionPlanStatus}
                        onChange={(e) => setReflectionPlanStatus(e.target.value as 'on_plan' | 'off_plan')}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-white text-[12px] font-sukhumvit text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/30"
                      >
                        <option value="on_plan">ตามแผน</option>
                        <option value="off_plan">เบี่ยงเบน</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 mb-1">ผลการสอน</label>
                      <select
                        value={reflectionOverview}
                        onChange={(e) => setReflectionOverview(e.target.value as 'good' | 'medium' | 'review')}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-white text-[12px] font-sukhumvit text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/30"
                      >
                        <option value="good">ดี</option>
                        <option value="medium">ปานกลาง</option>
                        <option value="review">ต้องปรับปรุง</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-600 mb-1">หมายเหตุเพิ่มเติม</label>
                    <textarea
                      value={reflectionNotes}
                      onChange={(e) => setReflectionNotes(e.target.value)}
                      placeholder="ป้อนหมายเหตุ หากนักเรียนมีปัญหา ข้อเสนอแนะ ฯลฯ"
                      className="w-full h-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-sarabun text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={savingReflection}
                    onClick={() => void handleSaveReflection()}
                    className="w-full h-9 rounded-lg bg-blue-600 text-white text-[12px] font-black font-sukhumvit hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <HiCheck size={14} />
                    บันทึกหลังการสอน
                  </button>
                </div>
              </div>

              <WeeklyTopicGrid
                topics={selectedSyllabus.topics}
                lessonOptions={selectedLessonOptions}
                semesterStart={semesterRange.start}
                semesterEnd={semesterRange.end}
                onSave={handleSaveTopics}
                planContext={{
                  subjectId: selectedSyllabus.subjectId,
                  subjectName: selectedSyllabus.subjectName,
                  classId: selectedSyllabus.classId,
                  className: selectedSyllabus.className,
                  gradeLevel: selectedSyllabus.gradeLevel,
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="subject-cards"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
            >
              {assignedSubjects.map(a => {
                const key = `${a.subjectId}|${a.classId}`;
                return (
                  <AssignedSubjectCard
                    key={key}
                    assignment={a}
                    active={false}
                    creating={creatingKey === key}
                    onClick={() => handleSelectAssignment(a)}
                  />
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
