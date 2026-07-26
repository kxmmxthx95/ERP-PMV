import { lazy, Suspense, useState, useMemo, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiArrowLeft,
  HiChevronRight,
  HiOutlineCalendarDays,
  HiOutlineCog6Tooth,
} from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useSchedule } from '@/hooks/useSchedule';
import { useThaiHolidays } from '@/features/calendar/hooks/useThaiHolidays';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import { resolveTeacherFromAuth, buildTeacherIdentityKeys, matchesTeacherIdentity } from '@/lib/teachers/teacherIdentity';
import { resolveSubjectDetail } from '@/lib/teachers/resolveSubjectDetail';
import { useMicroSyllabus, useMicroSyllabusAll } from '@/hooks/useMicroSyllabus';
import { cn } from '@/lib/utils';
import { HEADER_ICON_BTN, HEADER_ICON_BTN_GROUP } from '@/lib/headerIconBtn';
import { deptSemestersStore } from '@/lib/firestoreShared/deptSemestersStore';
import { getClassesByYearStore, getTeachingClassesStore } from '@/lib/firestoreShared/studentSummaryStore';
import { getClassSettingsBundleStore } from '@/lib/firestoreShared/classSettingsStore';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  SubjectFolderCard,
  SubjectFolderCardsGridSkeleton,
} from '@/components/SubjectFolderCard';
import {
  DEFAULT_COLOR_ID,
  loadFolderCardColors,
  saveFolderCardColors,
  type FolderCardColorId,
} from './utils/folderCardColor';
import { MicroSyllabusSubjectSelect, MICRO_SYLLABUS_FEATURE_TITLE } from './components/MicroSyllabusSubjectSelect';
import {
  resolveSemesterDateRange,
  hasTopicContent,
  departmentToSemesterKey,
  filterScheduleForClassSubject,
  buildTeachingSlotsBySchoolDay,
  countScheduledTeachingDays,
  nonTeachingPeriodsFor,
} from './utils/teachingPlanCalendar';
import type { MicroSyllabus, WeeklyTopic } from '@/types/microSyllabus';
import type { ClassRoom } from '@/types/class';
import { GRADE_LEVEL_ORDER } from '@/types/class';
import type { Department, SubjectCategory } from '@/types/curriculum';
import GradeBookClassSidebar from '@/features/grades/components/GradeBookClassSidebar';

// bundle-dynamic: heavy calendar / admin browser only when needed
const WeeklyTopicGrid = lazy(() => import('./components/WeeklyTopicGrid'));
const AdminTeacherPlanBrowser = lazy(() => import('./components/AdminTeacherPlanBrowser'));
const LessonContentSettingsDrawer = lazy(() => import('./components/LessonContentSettingsDrawer'));

function normalizeSubjectCategory(raw?: string): SubjectCategory {
  if (raw === 'basic' || raw === 'core') return 'core';
  if (raw === 'additional' || raw === 'added') return 'added';
  if (raw === 'elective') return 'elective';
  if (raw === 'activity') return 'activity';
  return 'core';
}

const EMPTY_LESSON_OPTIONS: string[] = [];

const noopSubscribeClasses = () => () => {};
// ค่าอ้างอิงเดียวคงที่ ห้ามสร้าง [] ใหม่ทุกครั้ง ไม่งั้น useSyncExternalStore วน re-render ไม่จบ
const EMPTY_CLASS_ROWS: { id: string; [key: string]: unknown }[] = [];
const getEmptyClassRows = () => EMPTY_CLASS_ROWS;

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssignedSubject {
  subjectId: string;
  subjectName: string;
  classId: string;       // '' when not linked to a class
  className: string;     // 'ยังไม่ผูกห้องเรียน' when from teachingSubjectIds only
  syllabus: MicroSyllabus | null;
  /** จำนวนวันสอนจริงตาม schedule ตลอดเทอม (ตัดวันหยุด/สอบออก) — ตัวหารความคืบหน้า */
  totalScheduledDays: number;
  /** จำนวนวันที่ setup แผนแล้ว + อยู่ในช่วงเทอมของห้องนี้จริง — ตัวเศษความคืบหน้า */
  completedDays: number;
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
    <div
      className="flex h-full min-h-0 w-full flex-col max-lg:overflow-y-auto"
      aria-busy="true"
      aria-label="กำลังโหลดตาราง"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-1 pb-1.5 pt-0">
        <Skeleton className="h-8 w-8 rounded-xl bg-slate-100" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-28 rounded-lg bg-slate-100" />
          <Skeleton className="h-6 w-12 rounded-xl bg-slate-100" />
        </div>
        <Skeleton className="h-8 w-8 rounded-xl bg-slate-100" />
      </div>
      <div className="grid shrink-0 grid-cols-7 px-1 pb-1 pt-0">
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="mx-auto h-3 w-4 rounded bg-slate-50" />
        ))}
      </div>
      <div className="grid shrink-0 grid-cols-7 gap-1 px-1 pb-2 max-lg:auto-rows-[minmax(52px,auto)] lg:min-h-0 lg:flex-1 lg:auto-rows-fr">
        {Array.from({ length: 35 }, (_, index) => (
          <Skeleton
            key={index}
            className="min-h-[52px] rounded-xl bg-slate-100 lg:h-full lg:min-h-[80px]"
          />
        ))}
      </div>
      <div className="space-y-2 px-1 pb-2 lg:hidden">
        <Skeleton className="h-3 w-28 rounded bg-slate-50" />
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-16 rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

function AssignedSubjectsGridSkeleton({ count = 6 }: { count?: number }) {
  return <SubjectFolderCardsGridSkeleton count={count} />;
}

function AssignedSubjectCard({
  assignment,
  active,
  creating,
  colorId,
  onColorChange,
  onClick,
}: {
  assignment: AssignedSubject;
  active: boolean;
  creating: boolean;
  colorId: FolderCardColorId;
  onColorChange: (id: FolderCardColorId) => void;
  onClick: () => void;
}) {
  const { syllabus, totalScheduledDays, completedDays } = assignment;
  const pct = totalScheduledDays > 0 ? Math.round((completedDays / totalScheduledDays) * 100) : 0;
  const hasStarted = syllabus !== null;
  const noClass = assignment.classId === '';

  const meta = !noClass && !creating
    ? hasStarted
      ? (
        <p
          className={cn(
            'pt-0.5 text-[11px] font-black',
            pct >= 80
              ? 'text-emerald-600'
              : pct >= 50
                ? 'text-amber-500'
                : pct > 0
                  ? 'text-sky-600'
                  : 'text-rose-500',
          )}
        >
          {pct}%
        </p>
      )
      : (
        <p className="pt-0.5 text-[10px] font-bold text-muted-foreground">ยังไม่เริ่ม</p>
      )
    : undefined;

  return (
    <SubjectFolderCard
      title={assignment.subjectName}
      subtitle={assignment.className}
      meta={meta}
      colorId={colorId}
      onColorChange={onColorChange}
      onClick={onClick}
      active={active}
      disabled={creating || noClass}
      busy={creating}
      showPaper={completedDays > 0}
    />
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MicroSyllabusPage() {
  const { user, userData, role } = useAuth();
  const { activeYear, activeSemester } = useActiveAcademicYear();
  const { events: calendarEvents } = useAcademicCalendar(role ?? undefined);
  // activeYear.year เป็น พ.ศ. (เช่น 2569) — Google Calendar API ต้องใช้ปี ค.ศ.
  const { holidays: thaiHolidays } = useThaiHolidays(
    activeYear?.year ? parseInt(activeYear.year, 10) - 543 : new Date().getFullYear(),
  );
  const deptSemesterSettings = useSyncExternalStore(
    deptSemestersStore.subscribe,
    deptSemestersStore.getSnapshot,
    deptSemestersStore.getSnapshot,
  );

  // Merge Thai holidays into calendar events for teaching plan calculations
  const allCalendarEvents = useMemo(
    () => {
      const merged = [
        ...calendarEvents,
        ...thaiHolidays.filter((h) => !calendarEvents.some((e) => e.id === h.id)),
      ];
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[allCalendarEvents] merged', {
          calendarEventsCount: calendarEvents.length,
          thaiHolidaysCount: thaiHolidays.length,
          mergedCount: merged.length,
          thaiHolidaysSample: thaiHolidays.slice(0, 3).map((h) => ({ id: h.id, title: h.title, startDate: h.startDate })),
        });
      }
      return merged;
    },
    [calendarEvents, thaiHolidays],
  );

  const isAdmin = role === 'admin' || role === 'sysadmin';
  const isTeacher = role === 'teacher';

  const displayName = userData?.firstName
    ? `${userData.prefix ?? ''}${userData.firstName} ${userData.lastName ?? ''}`.trim()
    : (user?.displayName ?? user?.email ?? 'ครูผู้สอน');

  const authUid = user?.uid ?? '';
  const departmentId = (userData as { departmentId?: string } | null)?.departmentId ?? 'secondary';

  // ── Data sources (aligned with TeacherDetailPanel / TeacherManager) ───────
  const { teachers, allSubjects } = useTeacherManager();
  const yearId = activeYear?.year ?? '';
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
  const showAdminBrowser = isAdmin && !canManageOwnPlans;

  // ครูเห็นแค่ห้องที่ตัวเองสอน (teacherIds ที่ sync จาก enrolledCourses) — admin browser ต้อง
  // เห็นทุกห้อง (concurrency ต่ำกว่ามาก ยอมรับได้) ไม่ต้องโหลดทั้งโรงเรียนทุกครั้งที่ครูเปิดหน้า
  const myIdentityKeysList = useMemo(() => [...myIdentityKeys], [myIdentityKeys]);
  const scopedClassesStore = !showAdminBrowser && yearId && myIdentityKeysList.length > 0
    ? getTeachingClassesStore(yearId, myIdentityKeysList)
    : null;
  const fullClassesStore = showAdminBrowser
    ? getClassesByYearStore(yearId || '_')
    : null;
  const scopedRawClasses = useSyncExternalStore(
    scopedClassesStore?.subscribe ?? noopSubscribeClasses,
    scopedClassesStore ? scopedClassesStore.getSnapshot : getEmptyClassRows,
    scopedClassesStore ? scopedClassesStore.getSnapshot : getEmptyClassRows,
  );
  const fullRawClasses = useSyncExternalStore(
    fullClassesStore?.subscribe ?? noopSubscribeClasses,
    fullClassesStore ? fullClassesStore.getSnapshot : getEmptyClassRows,
    fullClassesStore ? fullClassesStore.getSnapshot : getEmptyClassRows,
  );
  const rawClasses = showAdminBrowser ? fullRawClasses : scopedRawClasses;
  const allClasses = useMemo(
    () => rawClasses.map((d) => ({ id: d.id, ...(d as Record<string, unknown>) } as ClassRoom)),
    [rawClasses],
  );

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

  // ── Schedule data — for "จำนวนวันสอนจริงตาม schedule" progress denominator ──
  // includeClasses: false — allClasses ด้านบนมี getClassesByYearStore ของตัวเองแล้ว ไม่ต้องเปิดซ้ำ
  const { entries: scheduleEntries } = useSchedule({ includeClasses: false });
  const yearClassIds = useMemo(() => yearClasses.map((c) => c.id), [yearClasses]);
  const classesById = useMemo(
    () => new Map(yearClasses.map((cls) => [cls.id, cls])),
    [yearClasses],
  );
  // ครูแต่ละคนสอนแค่บางห้อง — เปิด class-settings listener เฉพาะห้องที่สอนจริง ไม่ใช่ทั้งโรงเรียน
  // (เดิมส่ง yearClassIds ทั้งหมดเข้าไปทุกครั้งที่ครูเปิดหน้า กินโควต้าคูณจำนวนห้อง×จำนวนครูที่ออนไลน์)
  // หน้า admin browser ยังต้องเห็นทุกห้อง เลยคงสโคปเดิมไว้เฉพาะกรณีนั้น (แอดมินออนไลน์พร้อมกันน้อยกว่ามาก)
  const myClassIds = useMemo(() => {
    if (!canManageOwnPlans) return [] as string[];
    const ids = new Set<string>();
    for (const cls of yearClasses) {
      for (const ec of cls.enrolledCourses ?? []) {
        if (matchesTeacherIdentity(ec.teacherId, myIdentityKeys)) {
          ids.add(cls.id);
          break;
        }
      }
    }
    return [...ids];
  }, [yearClasses, myIdentityKeys, canManageOwnPlans]);
  const classSettingsScopeIds = showAdminBrowser ? yearClassIds : myClassIds;
  const classSettingsStore = getClassSettingsBundleStore(classSettingsScopeIds);
  const classSettingsMap = useSyncExternalStore(
    classSettingsStore.subscribe,
    classSettingsStore.getSnapshot,
    classSettingsStore.getSnapshot,
  );

  // Preload versioned curriculum courses in parallel (async-parallel)
  useEffect(() => {
    if (!yearClasses.length || !versions.length) return;

    const toLoad: string[] = [];
    const seen = new Set<string>();
    for (const cls of yearClasses) {
      const pkgId = cls.curriculumPackageId || (cls as { curriculumId?: string }).curriculumId;
      if (!pkgId) continue;
      const versionId = String(pkgId);
      if (seen.has(versionId)) continue;
      seen.add(versionId);
      if (!versions.some((v) => v.id === versionId)) continue;
      if (!coursesByVersion[versionId]) toLoad.push(versionId);
    }

    if (toLoad.length === 0) return;
    void Promise.all(toLoad.map((id) => loadCoursesForVersion(id)));
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

  const subjectCategoryByKey = useMemo(() => {
    const map = new Map<string, SubjectCategory>();
    const add = (key: string | undefined, category: string | undefined) => {
      if (!key?.trim()) return;
      const cat = normalizeSubjectCategory(category);
      map.set(key, cat);
      map.set(key.trim().toLowerCase(), cat);
    };
    for (const s of allSubjects) {
      add(s.id, s.category);
      add(s.code, s.category);
      add(s.name, s.category);
    }
    for (const c of allVersionedCourses) {
      add(c.id, c.category);
      add(c.courseCode, c.category);
      add(c.courseName, c.category);
    }
    return map;
  }, [allSubjects, allVersionedCourses]);

  // ── Micro-syllabus hooks ──────────────────────────────────────────────────
  const teacherHook = useMicroSyllabus(canManageOwnPlans ? authUid : null);
  // Only fetch all syllabi for admin browser — skip when teaching own plans
  const adminHook = useMicroSyllabusAll(showAdminBrowser);

  const { syllabi, loading: teacherLoading, createSyllabus, updateTopics, updateLessonOptions } = teacherHook;
  const { syllabi: allSyllabi, loading: adminLoading } = adminHook;

  const semesterRange = useMemo(
    () =>
      resolveSemesterDateRange(
        activeYear?.year ?? '',
        (activeSemester as 1 | 2) || 1,
        activeYear,
        allCalendarEvents,
        deptSemesterSettings,
        isTeacher ? departmentToSemesterKey(departmentId) : undefined,
      ),
    [activeYear, activeSemester, allCalendarEvents, deptSemesterSettings, isTeacher, departmentId],
  );

  // js-index-maps: O(1) syllabus lookup instead of .find in nested loops
  const syllabusLookup = useMemo(() => {
    const byClassSubject = new Map<string, MicroSyllabus>();
    const byClassNameSubjectName = new Map<string, MicroSyllabus>();
    for (const s of syllabi) {
      byClassSubject.set(`${s.classId}|${s.subjectId}`, s);
      byClassNameSubjectName.set(`${s.className}|${s.subjectName}`, s);
    }
    return { byClassSubject, byClassNameSubjectName };
  }, [syllabi]);

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

        const syllabus =
          syllabusLookup.byClassSubject.get(`${cls.id}|${subject.id}`)
          ?? syllabusLookup.byClassSubject.get(`${cls.id}|${ec.subjectId}`)
          ?? syllabusLookup.byClassNameSubjectName.get(`${className}|${subject.name}`)
          ?? null;

        // ช่วงเทอมของ "ห้องนี้" จริง (แผนกห้องอาจต่างจากแผนกของครูผู้สอน)
        const classSemesterRange = resolveSemesterDateRange(
          activeYear.year,
          semester ?? 1,
          activeYear,
          allCalendarEvents,
          deptSemesterSettings,
          departmentToSemesterKey(cls.departmentId),
        );

        const nonTeachingPeriods = nonTeachingPeriodsFor(cls.id, classSettingsMap);
        const classSubjectSchedule = filterScheduleForClassSubject(
          scheduleEntries,
          cls.id,
          subject.id,
          activeYear.year,
          semester ?? 1,
          subject.name,
          nonTeachingPeriods,
        );
        const teachingSlots = buildTeachingSlotsBySchoolDay(classSubjectSchedule);
        const totalScheduledDays = countScheduledTeachingDays(
          classSemesterRange.start,
          classSemesterRange.end,
          teachingSlots,
          allCalendarEvents,
        );
        const completedDays = syllabus?.topics.filter((t) =>
          (hasTopicContent(t) || t.isNoTeaching || t.isTeachingClosed)
          && (!t.date || (t.date >= classSemesterRange.start && t.date <= classSemesterRange.end)),
        ).length ?? 0;

        if (import.meta.env.DEV && syllabus) {
          const outOfRange = syllabus.topics.filter((t) =>
            (hasTopicContent(t) || t.isNoTeaching || t.isTeachingClosed)
            && t.date && (t.date < classSemesterRange.start || t.date > classSemesterRange.end),
          );
          const notCounted = syllabus.topics.filter((t) =>
            !(hasTopicContent(t) || t.isNoTeaching || t.isTeachingClosed)
            || Boolean(t.date && (t.date < classSemesterRange.start || t.date > classSemesterRange.end)),
          );
          const scheduledDaysOfWeek = [...teachingSlots.keys()];
          // eslint-disable-next-line no-console
          console.debug(`[teachingPlanProgress] ${subject.name} · ${className}`, {
            classDeptId: cls.departmentId,
            classSemesterRange,
            scheduledDaysOfWeek,
            totalScheduledDays,
            completedDays,
            pct: totalScheduledDays > 0 ? Math.round((completedDays / totalScheduledDays) * 100) : 0,
            topicsCount: syllabus.topics.length,
            outOfRangeStampedDates: outOfRange.map((t) => t.date),
            notCounted: notCounted.map((t) => ({
              date: t.date,
              weekNumber: t.weekNumber,
              hasContent: hasTopicContent(t),
              lesson: t.lesson,
              title: t.title,
              details: t.details,
              isQuizDay: t.isQuizDay,
              isTeachingClosed: t.isTeachingClosed,
              isNoTeaching: t.isNoTeaching,
              completedAt: t.completedAt,
            })),
          });
        }

        result.push({
          subjectId: subject.id,
          subjectName: subject.name,
          classId: cls.id,
          className,
          syllabus,
          totalScheduledDays,
          completedDays,
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
        totalScheduledDays: 0,
        completedDays: 0,
      });
    }

    return result.sort((a, b) => {
      if (!a.classId && b.classId) return 1;
      if (a.classId && !b.classId) return -1;
      return a.className.localeCompare(b.className, 'th');
    });
  }, [
    yearClasses,
    myIdentityKeys,
    myTeacher,
    resolveSubject,
    syllabusLookup,
    canManageOwnPlans,
    activeYear,
    activeSemester,
    scheduleEntries,
    classSettingsMap,
    deptSemesterSettings,
    allCalendarEvents,
  ]);

  // ── Selection state ───────────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandledRef = useRef(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [folderColors, setFolderColors] = useState<Record<string, FolderCardColorId>>(() => loadFolderCardColors());
  const [lessonSettingsOpen, setLessonSettingsOpen] = useState(false);
  const [headerRightEl, setHeaderRightEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  const [breadcrumbExtraEl, setBreadcrumbExtraEl] = useState<HTMLElement | null>(null);
  const [breadcrumbPageEl, setBreadcrumbPageEl] = useState<HTMLElement | null>(null);

  // ── Sidebar browse state (teacher view: แผนก -> ชั้น -> ห้อง) ──────────────
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterGradeLevel, setFilterGradeLevel] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');

  const availableGrades = useMemo(() => {
    if (!filterDepartment) return [];
    const grades = new Set<string>();
    yearClasses
      .filter((c) => c.departmentId === filterDepartment)
      .forEach((c) => { if (c.gradeLevel) grades.add(c.gradeLevel); });
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

  const selectedClassRoom = useMemo(
    () => classesById.get(selectedClassId) ?? null,
    [classesById, selectedClassId],
  );

  useEffect(() => {
    setHeaderRightEl(document.getElementById('header-portal-right-actions'));
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
    setBreadcrumbExtraEl(document.getElementById('header-portal-breadcrumb-extra'));
    setBreadcrumbPageEl(document.getElementById('header-portal-breadcrumb-page'));
  }, []);

  const selectedAssignment = useMemo(
    () => assignedSubjects.find(a => `${a.subjectId}|${a.classId}` === selectedKey) ?? null,
    [assignedSubjects, selectedKey],
  );

  const breadcrumbSubjectLabel = selectedAssignment
    ? `${selectedAssignment.subjectName} · ${selectedAssignment.className}`
    : null;

  // ห้องที่เลือกจาก sidebar -> วิชาที่ครูสอนในห้องนั้น (การ์ดโฟลเดอร์ฝั่งขวา)
  const roomAssignedSubjects = useMemo(
    () => (selectedClassId ? assignedSubjects.filter((a) => a.classId === selectedClassId) : []),
    [assignedSubjects, selectedClassId],
  );
  const hasRoomSelection = !!selectedClassId;

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

  // ช่วงเทอมของ "ห้องที่กำลังเปิดดูอยู่" จริง — แผนกห้องอาจต่างจากแผนกของครูผู้สอน
  const selectedSemesterRange = useMemo(() => {
    if (!activeYear) return semesterRange;
    const classId = selectedSyllabus?.classId || selectedAssignment?.classId;
    const cls = classId ? yearClasses.find((c) => c.id === classId) : undefined;
    const deptKey = departmentToSemesterKey(cls?.departmentId ?? selectedSyllabus?.departmentId);
    return resolveSemesterDateRange(
      activeYear.year,
      (activeSemester as 1 | 2) || 1,
      activeYear,
      calendarEvents,
      deptSemesterSettings,
      deptKey,
    );
  }, [
    activeYear,
    activeSemester,
    calendarEvents,
    deptSemesterSettings,
    selectedSyllabus,
    selectedAssignment,
    yearClasses,
    semesterRange,
  ]);

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

  const handleSidebarSelectDept = (dept: Department) => {
    setFilterDepartment(dept);
    setFilterGradeLevel('');
    setSelectedClassId('');
  };

  const handleSidebarSelectGrade = (level: string) => {
    setFilterGradeLevel(level);
    setSelectedClassId('');
  };

  const handleSidebarSelectClass = (classId: string) => {
    setSelectedClassId(classId);
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
    const cls = classesById.get(classId);
    if (cls) {
      setFilterDepartment(cls.departmentId);
      setFilterGradeLevel(cls.gradeLevel);
      setSelectedClassId(classId);
    }
    void handleSelectAssignment(match);
    setSearchParams({}, { replace: true });
  }, [assignedSubjects, searchParams, setSearchParams, classesById]);

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
    const cls = classesById.get(assignment.classId);
    if (cls) {
      setFilterDepartment(cls.departmentId);
      setFilterGradeLevel(cls.gradeLevel);
      setSelectedClassId(assignment.classId);
    }
    void handleSelectAssignment(assignment);
  };

  const handleBackToSubjectList = useCallback(() => {
    setSelectedKey(null);
    setPendingSelectId(null);
    setCreatingKey(null);
  }, []);

  // Header back (desktop กลับไปเมนู / mobile กลับเมนู) → subject list when a plan is open
  useEffect(() => {
    if (showAdminBrowser || !selectedKey) return;

    const isPortalBackButton = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      const btn = target.closest('button');
      if (!btn) return false;
      if (btn.id === 'portal-default-mobile-back') return true;
      const title = btn.getAttribute('title') ?? '';
      const label = btn.getAttribute('aria-label') ?? '';
      return title === 'กลับไปเมนู' || title === 'กลับเมนู' || label === 'กลับไปเมนู';
    };

    const onClick = (e: MouseEvent) => {
      if (!isPortalBackButton(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      handleBackToSubjectList();
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [showAdminBrowser, selectedKey, handleBackToSubjectList]);

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
  if (showAdminBrowser) {
    return (
      <div
        className={cn(
          'flex min-h-0 w-full flex-1 flex-col overflow-hidden font-sukhumvit',
          'h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)]',
        )}
      >
        {adminLoading ? (
          <AssignedSubjectsGridSkeleton count={9} />
        ) : (
          <Suspense fallback={<AssignedSubjectsGridSkeleton count={9} />}>
            <AdminTeacherPlanBrowser
              teachers={teachers}
              syllabi={allSyllabi}
              semesterStart={semesterRange.start}
              semesterEnd={semesterRange.end}
              subjectCategoryByKey={subjectCategoryByKey}
              classesById={classesById}
              scheduleEntries={scheduleEntries}
              calendarEvents={allCalendarEvents}
              classSettingsMap={classSettingsMap}
              deptSemesterSettings={deptSemesterSettings}
              yearBE={activeYear?.year ?? ''}
              semester={(activeSemester as 1 | 2) ?? 1}
              academicYear={activeYear}
            />
          </Suspense>
        )}
      </div>
    );
  }

  // ── Teacher View ──────────────────────────────────────────────────────────
  const lessonSettingsButton = (
    <button
      type="button"
      onClick={() => setLessonSettingsOpen(true)}
      className={HEADER_ICON_BTN}
      title="ตั้งค่าเนื้อหาบทเรียน"
      aria-label="ตั้งค่าเนื้อหาบทเรียน"
    >
      <HiOutlineCog6Tooth size={16} />
    </button>
  );

  const headerLessonSettingsPortal = selectedSyllabus ? (
    <>
      {headerRightEl && createPortal(
        <div className={cn('hidden lg:flex pointer-events-auto', HEADER_ICON_BTN_GROUP)}>
          {lessonSettingsButton}
        </div>,
        headerRightEl,
      )}
      {headerMobileActionsEl && createPortal(
        <div className={cn('flex pointer-events-auto', HEADER_ICON_BTN_GROUP)}>
          {lessonSettingsButton}
        </div>,
        headerMobileActionsEl,
      )}
      <Suspense fallback={null}>
        <LessonContentSettingsDrawer
          open={lessonSettingsOpen}
          onClose={() => setLessonSettingsOpen(false)}
          lessonOptions={selectedLessonOptions}
          onSave={handleSaveLessonOptions}
          subjectName={selectedSyllabus.subjectName}
          className={selectedSyllabus.className}
        />
      </Suspense>
    </>
  ) : null;

  return (
    <div
      className={cn(
        'flex min-h-0 w-full flex-1 flex-col overflow-hidden font-sukhumvit',
        'h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)]',
      )}
    >
      {headerLessonSettingsPortal}
      {breadcrumbPageEl && breadcrumbSubjectLabel && createPortal(
        <BreadcrumbLink asChild>
          <button
            type="button"
            onClick={handleBackToSubjectList}
            className="font-black text-slate-500 transition-colors hover:text-slate-800"
            title="กลับไปเลือกรายวิชา"
          >
            {MICRO_SYLLABUS_FEATURE_TITLE}
          </button>
        </BreadcrumbLink>,
        breadcrumbPageEl,
      )}
      {breadcrumbExtraEl && breadcrumbSubjectLabel && createPortal(
        <>
          <BreadcrumbSeparator className="[&>svg]:size-3.5 text-slate-300">
            <HiChevronRight />
          </BreadcrumbSeparator>
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage
              className="max-w-[220px] truncate font-black text-slate-800"
              title={breadcrumbSubjectLabel}
            >
              {breadcrumbSubjectLabel}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </>,
        breadcrumbExtraEl,
      )}
      <div className="shrink-0">
        <MicroSyllabusSubjectSelect
          active={Boolean(selectedSyllabus)}
          options={subjectSelectOptions}
          selectedKey={selectedKey}
          onSelect={handleSubjectSelectChange}
        />
      </div>

      {/* Body */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
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
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch">
          <div
            className={cn(
              'flex min-h-0 w-full shrink-0 flex-col overflow-hidden lg:h-auto lg:max-h-full lg:w-[280px] xl:w-[300px]',
              hasRoomSelection ? 'hidden lg:flex' : 'flex min-h-0 flex-1 lg:flex-none',
            )}
          >
            <GradeBookClassSidebar
              selectedDept={filterDepartment}
              selectedGrade={filterGradeLevel}
              selectedClassId={selectedClassId}
              gradeOptions={availableGrades}
              classOptions={classOptions}
              onSelectDept={handleSidebarSelectDept}
              onSelectGrade={handleSidebarSelectGrade}
              onSelectClass={handleSidebarSelectClass}
            />
          </div>

          <div
            className={cn(
              'relative flex min-h-0 flex-1 basis-0 flex-col overflow-hidden',
              !hasRoomSelection && 'hidden lg:flex',
            )}
          >
            {selectedSyllabus && (
              <div className="relative mb-3 flex min-h-[3.25rem] shrink-0 items-center justify-center border-b border-border px-0 pb-3 pt-2 sm:pt-2.5">
                <div className="absolute left-0">
                  <Button
                    type="button"
                    variant="secondary"
                    className="size-9 shrink-0 rounded-xl p-0 flex items-center justify-center"
                    onClick={handleBackToSubjectList}
                    title="กลับไปโฟลเดอร์วิชา"
                    aria-label="กลับไปโฟลเดอร์วิชา"
                  >
                    <HiArrowLeft className="h-4 w-4" />
                  </Button>
                </div>
                <p className="max-w-[70%] truncate font-sukhumvit text-[13px] font-black text-foreground text-center">
                  {selectedSyllabus.subjectName}
                  {selectedSyllabus.className ? ` · ${selectedSyllabus.className}` : ''}
                </p>
              </div>
            )}
            <AnimatePresence mode="wait">
              {selectedSyllabus ? (
                <motion.div
                  key={selectedSyllabus.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-3"
                >
                  <Suspense fallback={<TeachingPlanCalendarSkeleton />}>
                    <WeeklyTopicGrid
                      topics={selectedSyllabus.topics}
                      lessonOptions={selectedLessonOptions}
                      semesterStart={selectedSemesterRange.start}
                      semesterEnd={selectedSemesterRange.end}
                      onSave={handleSaveTopics}
                      planContext={{
                        subjectId: selectedSyllabus.subjectId,
                        subjectName: selectedSyllabus.subjectName,
                        classId: selectedSyllabus.classId,
                        className: selectedSyllabus.className,
                        gradeLevel: selectedSyllabus.gradeLevel,
                      }}
                    />
                  </Suspense>
                </motion.div>
              ) : hasRoomSelection ? (
                roomAssignedSubjects.length > 0 ? (
                  <motion.div
                    key={`room-${selectedClassId}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="grid w-full grid-cols-2 gap-x-3 gap-y-5 overflow-y-auto overscroll-y-contain scrollbar-hide sm:grid-cols-3 xl:grid-cols-4"
                  >
                    {roomAssignedSubjects.map(a => {
                      const key = `${a.subjectId}|${a.classId}`;
                      return (
                        <AssignedSubjectCard
                          key={key}
                          assignment={a}
                          active={false}
                          creating={creatingKey === key}
                          colorId={folderColors[key] ?? DEFAULT_COLOR_ID}
                          onColorChange={(id) => {
                            setFolderColors((prev) => {
                              const next = { ...prev, [key]: id };
                              saveFolderCardColors(next);
                              return next;
                            });
                          }}
                          onClick={() => handleSelectAssignment(a)}
                        />
                      );
                    })}
                  </motion.div>
                ) : (
                  <motion.div
                    key={`room-empty-${selectedClassId}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center"
                  >
                    <HiOutlineCalendarDays className="h-8 w-8 text-muted-foreground/40" />
                    <p className="font-sukhumvit text-[13px] font-black text-muted-foreground">
                      ห้อง {selectedClassRoom?.className ?? ''} ยังไม่มีวิชาที่ได้รับมอบหมาย
                    </p>
                  </motion.div>
                )
              ) : (
                <motion.div
                  key="pick-room-hint"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center"
                >
                  <HiOutlineCalendarDays className="h-8 w-8 text-muted-foreground/40" />
                  <p className="font-sukhumvit text-[13px] font-black text-muted-foreground">
                    เลือกห้องเรียนจากแถบด้านซ้ายเพื่อดูแผนการสอน
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
