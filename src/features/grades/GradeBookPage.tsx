import { useState, useMemo, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, RefreshCw, AlertCircle,
  ArrowLeft, Link2, Link2Off,
} from 'lucide-react';
import {
  HiBookOpen, HiAdjustmentsHorizontal, HiClipboardDocumentList, HiCalendarDays,
  HiBars3, HiOutlineFunnel, HiChevronRight, HiArrowLeft,
  HiAcademicCap,
} from 'react-icons/hi2';
import type { IconType } from 'react-icons';
import { toast } from 'sonner';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTeachingManager } from '@/hooks/useTeachingManager';
import { useGradeBook, mergeOnlineExamScores } from '@/hooks/useGradeBook';
import { rawPointsToPercent, averagePercentScores } from '@/types/grades';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import GradeTable from './components/GradeTable';
import ExamRoomScoreTable, { type ExamRoomScoreRow } from './components/ExamRoomScoreTable';
import GradeConfigPanel from './components/GradeConfigPanel';
import StudentGradeBookPanel from './components/StudentGradeBookPanel';
import AttendanceDateRangeFilter, { type AttendanceDateRange } from './components/AttendanceDateRangeFilter';
import {
  SubjectFolderCard,
  SubjectFolderCardsGridSkeleton,
} from '@/components/SubjectFolderCard';
import GradeBookClassSidebar from './components/GradeBookClassSidebar';
import SidebarCollapseButton from './components/SidebarCollapseButton';
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { GLASS } from '@/components/layouts/PortalLayout';
import { cn } from '@/lib/utils';
import { getLocalDateString } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { HEADER_ICON_BTN, HEADER_ICON_BTN_GROUP } from '@/lib/headerIconBtn';
import {
  DEFAULT_COLOR_ID,
  GRADE_BOOK_FOLDER_COLOR_KEY,
  loadFolderCardColors,
  saveFolderCardColors,
  type FolderCardColorId,
} from '@/lib/subjectFolderCardColors';
import { getClassesByYearStore } from '@/lib/firestoreShared/studentSummaryStore';
import { teachersCollectionStore } from '@/lib/firestoreShared/teachersStore';
import {
  ExamFilterShowResultsButton,
  ExamMobileFilterDrawer,
} from '@/features/exam/components/ExamMobileFilterMenuButton';
import type { GradeWeightConfig } from '@/types/grades';
import { type Department, type Subject } from '@/types/curriculum';
import { GRADE_LEVEL_ORDER } from '@/types/class';
import { matchesTeacherIdentity } from '@/lib/teachers/teacherIdentity';
import {
  buildStudentIdentityLookup,
  enrichStudentIdentityLookupFromAttempts,
  findAttemptForStudent,
  resolveCanonicalStudentId,
  scoreCollectionTypeToGradeField,
} from '@/lib/students/studentIdentity';
import { attemptScorePercent, getBestPercentByStudent } from '@/lib/exam/examRoomScoring';
import { resolveAttemptTotalScore } from '@/lib/exam/manualEssayGrading';
import { PORTAL_MENU_TITLES } from '@/lib/portalMenu';
import type { Exam, ExamScore, ExamType } from '@/types/teaching';
import type { ExamRoom, ExamAttempt } from '@/types/exam';

type Tab = 'table' | 'config' | 'exams' | 'attendance';

const GRADE_BOOK_FEATURE_TITLE = PORTAL_MENU_TITLES['/portal/grades'];

const GRADE_BOOK_MENU = {
  label: GRADE_BOOK_FEATURE_TITLE,
  icon: GraduationCap,
};

const GRADE_BOOK_TAB_CONFIG: Record<Tab, { label: string; icon: IconType }> = {
  table: { label: 'ตารางคะแนนรวม', icon: HiBookOpen },
  config: { label: 'ตั้งค่าเกรด', icon: HiAdjustmentsHorizontal },
  exams: { label: 'คะแนนการสอบ', icon: HiClipboardDocumentList },
  attendance: { label: 'การเข้าเรียน', icon: HiCalendarDays },
};

function GradeBookMobileRowSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-[72%] rounded bg-muted" />
            <Skeleton className="h-3.5 w-[40%] rounded bg-muted/70" />
          </div>
        </div>
        <Skeleton className="h-6 w-14 shrink-0 rounded-full bg-muted/70" />
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-border pt-2.5">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-[80%] rounded bg-muted/60" />
            <Skeleton className="h-4 w-10 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
        <Skeleton className="h-3 w-12 rounded bg-muted/60" />
        <Skeleton className="h-4 w-10 rounded bg-muted" />
      </div>
    </div>
  );
}

function GradeBookTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="กำลังโหลดตารางคะแนน">
      <div className="flex flex-col gap-2.5 px-0.5 md:hidden">
        {Array.from({ length: Math.min(rows, 6) }, (_, i) => (
          <GradeBookMobileRowSkeleton key={i} />
        ))}
      </div>
      <div className="hidden rounded-2xl border border-border bg-card md:block">
        <Skeleton className="h-11 rounded-none border-b border-border bg-muted/60" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
            <Skeleton className="h-4 w-14 shrink-0 rounded bg-muted" />
            <Skeleton className="h-9 w-9 shrink-0 rounded-full bg-muted" />
            <Skeleton className="h-4 min-w-0 flex-1 rounded bg-muted" />
            <Skeleton className="h-4 w-10 rounded bg-muted/70" />
            <Skeleton className="h-4 w-10 rounded bg-muted/70" />
            <Skeleton className="h-4 w-10 rounded bg-muted/70" />
            <Skeleton className="h-6 w-12 rounded-full bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

function GradeConfigPanelSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="กำลังโหลดตั้งค่าเกรด">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-[70%] rounded bg-muted/60" />
              <Skeleton className="h-10 w-full rounded-xl bg-muted" />
            </div>
          ))}
        </div>
        <Skeleton className="h-2 w-full rounded-full bg-muted" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-36 rounded bg-muted/60" />
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <Skeleton className="h-11 rounded-none border-b border-border bg-muted/40" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="mx-4 my-3 h-9 rounded-xl bg-muted/70" />
          ))}
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-xl bg-muted" />
    </div>
  );
}

function ExamCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

/** Whether online exam room scores should flow into the grade table. */
function shouldSyncExamRoomScores(room: ExamRoom): boolean {
  if (room.settings?.scoreCollectionLinked === false) return false;
  if (room.settings?.scoreCollectionEnabled === true) return true;
  if (room.settings?.scoreCollectionEnabled === false) return false;
  return (
    (room.settings?.gradeBookSubjects?.length ?? 0) > 0
    || !!room.settings?.gradeBookSubjectId
  );
}

function mapRosterStudentsForGradeBook(
  classId: string,
  getStudentsForClass: ReturnType<typeof useTeachingManager>['getStudentsForClass'],
) {
  return getStudentsForClass(classId).map(({ student }) => ({
    studentId: student.id,
    studentName: `${student.prefix}${student.firstName} ${student.lastName}`,
    studentCode: student.studentCode ?? '',
    photoURL: student.photoURL,
    gender: student.gender as 'male' | 'female' | undefined,
    authUid: student.authUid,
    userId: student.userId,
    email: student.email,
  }));
}

const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  midterm: 'กลางภาค',
  final: 'ปลายภาค',
  quiz: 'เก็บคะแนน',
  makeup: 'แก้ตัว',
};

const EXAM_TYPE_COLOR: Record<ExamType, { text: string; bg: string }> = {
  midterm: { text: '#e11d48', bg: '#ffe4e6' },
  final: { text: '#7c3aed', bg: '#f3e8ff' },
  quiz: { text: '#d97706', bg: '#fef3c7' },
  makeup: { text: '#059669', bg: '#d1fae5' },
};

export default function GradeBookPage() {
  const { user, role } = useAuth();
  const { year: academicYear, activeSemester, activeYear } = useActiveAcademicYear();
  const canViewAllSubjects = role === 'admin' || role === 'sysadmin';
  const teachingMgr = useTeachingManager(user?.uid ?? '', canViewAllSubjects);
  const gradeBook = useGradeBook();
  const curriculum = useCurriculum();
  const {
    coursesByVersion,
    loadCoursesForVersion,
    versions,
    isLoading: curriculumVersionsLoading,
  } = useCurriculumVersioned();

  const yearId = academicYear ? String(academicYear) : '';
  const classesStore = getClassesByYearStore(yearId || '_');
  const classesReady = useSyncExternalStore(
    classesStore.subscribe,
    classesStore.getReady,
    () => true,
  );
  const teachersReady = useSyncExternalStore(
    teachersCollectionStore.subscribe,
    teachersCollectionStore.getReady,
    () => true,
  );

  // showPersonalSubjectFolders scopes class/subject data to the teacher's own assignments
  // (teacher, or admin linked as teacher). Sidebar UI itself is shared with pure admin/sysadmin.
  const showPersonalSubjectFolders =
    role === 'teacher' || teachingMgr.currentTeacher != null;
  // Sidebar (dept → grade → room) drives class selection for everyone, admin and teacher alike.
  const showAdminClassBrowser = canViewAllSubjects || showPersonalSubjectFolders;

  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterGradeLevel, setFilterGradeLevel] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>((activeSemester as 1 | 2) ?? 1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>('table');
  const [attendanceDateRange, setAttendanceDateRange] = useState<AttendanceDateRange>(() => ({
    from: '',
    to: getLocalDateString(),
  }));

  const [examLoading, setExamLoading] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [subjectExams, setSubjectExams] = useState<Exam[]>([]);
  const [examScoresByExamId, setExamScoresByExamId] = useState<Record<string, ExamScore[]>>({});
  const [selectedExamId, setSelectedExamId] = useState('');

  // ── Online exam rooms (exam_rooms collection) ─────────────────────────────
  const [onlineRooms, setOnlineRooms] = useState<ExamRoom[]>([]);
  const [onlineAttemptsByRoomId, setOnlineAttemptsByRoomId] = useState<Record<string, ExamAttempt[]>>({});
  const [selectedOnlineRoomId, setSelectedOnlineRoomId] = useState('');
  const [togglingScoreLinkRoomId, setTogglingScoreLinkRoomId] = useState<string | null>(null);
  const [isMdOrBelow, setIsMdOrBelow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  );
  const [headerCenterMobileEl, setHeaderCenterMobileEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);
  const [headerMobileBackEl, setHeaderMobileBackEl] = useState<HTMLElement | null>(null);
  const [headerRightActionsEl, setHeaderRightActionsEl] = useState<HTMLElement | null>(null);
  const [breadcrumbExtraEl, setBreadcrumbExtraEl] = useState<HTMLElement | null>(null);
  const [breadcrumbPageEl, setBreadcrumbPageEl] = useState<HTMLElement | null>(null);
  const [mobileTabMenuOpen, setMobileTabMenuOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [folderColors, setFolderColors] = useState<Record<string, FolderCardColorId>>(() =>
    loadFolderCardColors(GRADE_BOOK_FOLDER_COLOR_KEY),
  );

  const handleBackFromSubject = useCallback(() => {
    setSelectedSubjectId('');
    setSelectedExamId('');
    setSelectedOnlineRoomId('');
  }, []);

  // Personal folders: header back steps out of subject view → subject grid.
  // Admin class browser: portal back goes to menu (sidebar handles class nav).
  useEffect(() => {
    if (!showPersonalSubjectFolders || !selectedSubjectId) return;

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
      handleBackFromSubject();
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [showPersonalSubjectFolders, selectedSubjectId, handleBackFromSubject]);

  const setFolderColor = useCallback((key: string, id: FolderCardColorId) => {
    setFolderColors((prev) => {
      const next = { ...prev, [key]: id };
      saveFolderCardColors(next, GRADE_BOOK_FOLDER_COLOR_KEY);
      return next;
    });
  }, []);

  useEffect(() => {
    setHeaderCenterMobileEl(document.getElementById('header-portal-center-mobile'));
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
    setHeaderMobileBackEl(document.getElementById('header-portal-mobile-back'));
    setHeaderRightActionsEl(document.getElementById('header-portal-right-actions'));
    setBreadcrumbExtraEl(document.getElementById('header-portal-breadcrumb-extra'));
    setBreadcrumbPageEl(document.getElementById('header-portal-breadcrumb-page'));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      setIsMdOrBelow(!mq.matches);
      setMobileTabMenuOpen(false);
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    setMobileTabMenuOpen(false);
  }, [activeTab, selectedSubjectId]);

  useEffect(() => {
    const defaultBack = document.getElementById('portal-default-mobile-back');
    if (!defaultBack) return;
    defaultBack.style.display = isMdOrBelow && showPersonalSubjectFolders && selectedSubjectId ? 'none' : '';
  }, [isMdOrBelow, showPersonalSubjectFolders, selectedSubjectId]);

  // Preload versioned curriculum courses so subject names resolve on teacher cards
  useEffect(() => {
    const classSource = showPersonalSubjectFolders ? teachingMgr.yearClasses : teachingMgr.classes;
    const versionIds = new Set<string>();
    for (const cls of classSource) {
      const pkgId = cls.curriculumPackageId ?? (cls as { curriculumId?: string }).curriculumId;
      if (pkgId) versionIds.add(String(pkgId));
    }
    versionIds.forEach(versionId => {
      if (!versions.some(v => v.id === versionId)) return;
      if (!coursesByVersion[versionId]) {
        loadCoursesForVersion(versionId);
      }
    });
  }, [teachingMgr.classes, teachingMgr.yearClasses, showPersonalSubjectFolders, versions, coursesByVersion, loadCoursesForVersion]);

  const pendingCurriculumLoads = useMemo(() => {
    const classSource = showPersonalSubjectFolders ? teachingMgr.yearClasses : teachingMgr.classes;
    const needed = new Set<string>();
    for (const cls of classSource) {
      const pkgId = cls.curriculumPackageId ?? (cls as { curriculumId?: string }).curriculumId;
      if (pkgId) needed.add(String(pkgId));
    }
    return [...needed].filter(
      (id) => versions.some((v) => v.id === id) && !coursesByVersion[id],
    );
  }, [teachingMgr.yearClasses, teachingMgr.classes, showPersonalSubjectFolders, versions, coursesByVersion]);

  const isSubjectGridLoading =
    !classesReady
    || curriculumVersionsLoading
    || pendingCurriculumLoads.length > 0
    || (showPersonalSubjectFolders && !teachersReady);

  const availableClasses = useMemo(() => {
    const all = showPersonalSubjectFolders ? teachingMgr.yearClasses : teachingMgr.classes;
    if (showPersonalSubjectFolders && teachingMgr.teacherIdentityKeys.size > 0) {
      return all.filter(c =>
        (c.enrolledCourses ?? []).some(ec =>
          matchesTeacherIdentity(ec.teacherId, teachingMgr.teacherIdentityKeys),
        ),
      );
    }
    return all;
  }, [teachingMgr.classes, teachingMgr.yearClasses, teachingMgr.teacherIdentityKeys, showPersonalSubjectFolders]);

  const availableGrades = useMemo(() => {
    if (!filterDepartment) return [];
    const grades = new Set<string>();
    availableClasses
      .filter(c => c.departmentId === filterDepartment)
      .forEach(c => c.gradeLevel && grades.add(c.gradeLevel));
    return Array.from(grades).sort((a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99));
  }, [availableClasses, filterDepartment]);

  const classOptions = useMemo(() => {
    if (!filterDepartment || !filterGradeLevel) return [];
    return availableClasses
      .filter((c) => c.departmentId === filterDepartment && c.gradeLevel === filterGradeLevel)
      .slice()
      .sort((a, b) =>
        (a.roomNumber || a.className).localeCompare(b.roomNumber || b.className, undefined, { numeric: true }),
      );
  }, [availableClasses, filterDepartment, filterGradeLevel]);

  const handleSelectDept = useCallback((dept: Department) => {
    setFilterDepartment(dept);
    setFilterGradeLevel('');
    setSelectedClassId('');
    setSelectedSubjectId('');
    setSelectedExamId('');
    setSelectedOnlineRoomId('');
  }, []);

  const handleSelectGrade = useCallback((level: string) => {
    setFilterGradeLevel(level);
    setSelectedClassId('');
    setSelectedSubjectId('');
    setSelectedExamId('');
    setSelectedOnlineRoomId('');
  }, []);

  const handleSelectClass = useCallback((classId: string) => {
    setSelectedClassId(classId);
    setSelectedSubjectId('');
    setSelectedExamId('');
    setSelectedOnlineRoomId('');
  }, []);

  const selectedClass = useMemo(
    () => availableClasses.find(c => c.id === selectedClassId) ?? null,
    [availableClasses, selectedClassId],
  );

  const allVersionedCourses = useMemo(
    () => Object.values(coursesByVersion).flat(),
    [coursesByVersion],
  );

  const subjectById = useMemo(() => {
    const m = new Map<string, Subject>();

    curriculum.subjects.forEach(s => m.set(s.id, s));

    allVersionedCourses.forEach(v => {
      if (m.has(v.id)) return;
      const department = v.department === 'early' || v.department === 'primary' || v.department === 'secondary'
        ? v.department
        : 'secondary';
      const category = v.category === 'basic' ? 'core' : v.category === 'additional' ? 'added' : 'activity';
      m.set(v.id, {
        id: v.id,
        code: v.courseCode ?? '',
        name: v.courseName,
        credits: v.credit || 0,
        hoursPerWeek: v.periodsPerWeek ?? 1,
        totalHours: v.totalHours ?? (v.periodsPerWeek ?? 1) * 18,
        department,
        category,
        subjectGroup: v.subjectGroup,
        gradeLevel: v.gradeLevel,
      });
    });

    teachingMgr.mySubjects.forEach(s => {
      if (!m.has(s.id)) m.set(s.id, s);
    });

    return m;
  }, [curriculum.subjects, allVersionedCourses, teachingMgr.mySubjects]);

  const availableSubjects = useMemo(() => {
    if (!selectedClass) return [];
    const byId = new Set<string>();

    (selectedClass.enrolledCourses ?? []).forEach(ec => {
      const passSemester = ec.semester == null || ec.semester === selectedSemester;
      const passTeacher =
        !showPersonalSubjectFolders ||
        matchesTeacherIdentity(ec.teacherId, teachingMgr.teacherIdentityKeys);
      if (passSemester && passTeacher) byId.add(ec.subjectId);
    });

    return Array.from(byId)
      .map(id => subjectById.get(id))
      .filter((s): s is Subject => Boolean(s))
      .sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name, 'th'));
  }, [selectedClass, selectedSemester, showPersonalSubjectFolders, teachingMgr.teacherIdentityKeys, subjectById]);

  const selectedSubject = useMemo(
    () => availableSubjects.find(s => s.id === selectedSubjectId) ?? null,
    [availableSubjects, selectedSubjectId],
  );

  const breadcrumbSubjectLabel = selectedSubject && selectedClass
    ? `${selectedSubject.name} · ${selectedClass.className}`
    : selectedSubject
      ? selectedSubject.name
      : null;

  const selectedExam = useMemo(
    () => subjectExams.find(ex => ex.id === selectedExamId) ?? null,
    [subjectExams, selectedExamId],
  );

  const selectedExamRows = useMemo(() => {
    if (!selectedClassId || !selectedExamId) return [];
    const students = teachingMgr.getStudentsForClass(selectedClassId).map(({ student }) => ({
      studentId: student.id,
      studentName: `${student.prefix}${student.firstName} ${student.lastName}`,
      studentCode: student.studentCode ?? '',
      photoURL: student.photoURL,
      gender: student.gender,
    }));
    const scoreMap = new Map((examScoresByExamId[selectedExamId] ?? []).map(sc => [sc.studentId, sc]));
    return students.map(st => {
      const score = scoreMap.get(st.studentId);
      return {
        ...st,
        absent: score?.absent ?? false,
        score: score?.score,
        note: score?.note ?? '',
      };
    });
  }, [selectedClassId, selectedExamId, teachingMgr, examScoresByExamId]);

  const examRoomScoreTableRows = useMemo((): ExamRoomScoreRow[] => {
    if (!selectedExam) return [];
    return selectedExamRows.map((row) => ({
      studentId: row.studentId,
      studentName: row.studentName,
      studentCode: row.studentCode,
      photoURL: row.photoURL,
      gender: row.gender,
      status: row.absent ? 'absent' : 'present',
      scorePercent: typeof row.score === 'number'
        ? Math.round(rawPointsToPercent(row.score, selectedExam.maxScore))
        : null,
    }));
  }, [selectedExamRows, selectedExam]);

  const examCards = useMemo(() => {
    return subjectExams.map(exam => {
      const scores = examScoresByExamId[exam.id] ?? [];
      const gradedScores = scores.filter(s => !s.absent && typeof s.score === 'number').map(s => s.score as number);
      const avg = gradedScores.length > 0
        ? Math.round((gradedScores.reduce((sum, n) => sum + n, 0) / gradedScores.length) * 10) / 10
        : null;
      const classStudentCount = teachingMgr.getStudentsForClass(exam.classId).length;
      const totalCount = scores.length > 0 ? scores.length : classStudentCount;
      return {
        ...exam,
        gradedCount: gradedScores.length,
        totalCount,
        avgScore: avg,
      };
    });
  }, [subjectExams, examScoresByExamId, teachingMgr]);

  // computed: online exam room cards
  const onlineRoomCards = useMemo(() => {
    return onlineRooms.map(room => ({
      ...room,
      maxScore: room.totalPoints ?? 100,
    }));
  }, [onlineRooms]);

  // computed: rows for selected online room detail
  const selectedOnlineRoom = useMemo(
    () => onlineRoomCards.find(r => r.id === selectedOnlineRoomId) ?? null,
    [onlineRoomCards, selectedOnlineRoomId],
  );

  const selectedOnlineRoomRows = useMemo(() => {
    if (!selectedOnlineRoomId || !selectedClassId) return [];
    const room = onlineRooms.find(r => r.id === selectedOnlineRoomId) ?? null;
    const classStudents = teachingMgr.getStudentsForClass(selectedClassId);
    const attempts = onlineAttemptsByRoomId[selectedOnlineRoomId] ?? [];
    const identityLookup = enrichStudentIdentityLookupFromAttempts(
      buildStudentIdentityLookup(classStudents),
      classStudents,
      attempts,
    );
    const attByCanonical = new Map<string, ExamAttempt>();
    attempts.forEach((att) => {
      const canonicalId = resolveCanonicalStudentId(att.studentId, identityLookup);
      const prev = attByCanonical.get(canonicalId);
      if (!prev) {
        attByCanonical.set(canonicalId, att);
        return;
      }
      const prevStamp = Number(prev.submittedAt ?? prev.lastSavedAt ?? prev.startedAt ?? 0);
      const nextStamp = Number(att.submittedAt ?? att.lastSavedAt ?? att.startedAt ?? 0);
      if (nextStamp >= prevStamp) attByCanonical.set(canonicalId, att);
    });

    return classStudents.map(({ student }) => {
      const att = attByCanonical.get(student.id) ?? findAttemptForStudent(attempts, student);
      const scorePercent = att && room ? attemptScorePercent(room, att) : null;
      return {
        studentId: student.id,
        studentName: `${student.prefix}${student.firstName} ${student.lastName}`,
        studentCode: student.studentCode ?? '',
        photoURL: student.photoURL,
        gender: student.gender,
        status: att?.status ?? null,
        score: resolveAttemptTotalScore(att),
        scorePercent: scorePercent !== null ? Math.round(scorePercent) : null,
        round: att?.round ?? null,
      };
    });
  }, [selectedOnlineRoomId, selectedClassId, teachingMgr, onlineAttemptsByRoomId, onlineRooms]);

  const onlineRoomScoreTableRows = useMemo((): ExamRoomScoreRow[] => {
    return selectedOnlineRoomRows.map((row) => ({
      studentId: row.studentId,
      studentName: row.studentName,
      studentCode: row.studentCode,
      photoURL: row.photoURL,
      gender: row.gender,
      status: row.status === 'graded'
        ? 'graded'
        : row.status === 'submitted'
          ? 'submitted'
          : 'none',
      scorePercent: row.scorePercent,
    }));
  }, [selectedOnlineRoomRows]);

  const classRosterKey = useMemo(() => {
    if (!selectedClassId) return '';
    return teachingMgr.getStudentsForClass(selectedClassId)
      .map(({ student }) => student.id)
      .sort()
      .join('|');
  }, [selectedClassId, teachingMgr]);

  const onlineExamScoreSync = useMemo(() => {
    if (!selectedClassId) {
      return {
        byStudent: new Map<string, { classworkScore: number | null; midtermScore: number | null; finalScore: number | null }>(),
        linkedFields: { classwork: false, midterm: false, final: false },
      };
    }

    const classStudents = teachingMgr.getStudentsForClass(selectedClassId);
    const byStudent = new Map<string, { classworkScore: number | null; midtermScore: number | null; finalScore: number | null }>();
    const linkedFields = { classwork: false, midterm: false, final: false };

    const classworkPctsByStudent = new Map<string, number[]>();

    classStudents.forEach(({ student }) => {
      byStudent.set(student.id, { classworkScore: null, midtermScore: null, finalScore: null });
    });

    onlineRooms.forEach(room => {
      if (!shouldSyncExamRoomScores(room)) return;

      const collectionType = room.settings?.scoreCollectionType
        ?? room.settings?.gradeBookScoreType
        ?? 'classwork';
      const field = scoreCollectionTypeToGradeField(collectionType);
      if (field === 'classworkScore') linkedFields.classwork = true;
      if (field === 'midtermScore') linkedFields.midterm = true;
      if (field === 'finalScore') linkedFields.final = true;

      const attempts = onlineAttemptsByRoomId[room.id] ?? [];
      const bestPercents = getBestPercentByStudent(room, attempts, classStudents);

      bestPercents.forEach((pct, studentId) => {
        const entry = byStudent.get(studentId);
        if (!entry) return;

        if (field === 'classworkScore') {
          const pcts = classworkPctsByStudent.get(studentId) ?? [];
          pcts.push(pct);
          classworkPctsByStudent.set(studentId, pcts);
        } else if (field === 'midtermScore') {
          entry.midtermScore = entry.midtermScore !== null
            ? Math.max(entry.midtermScore, pct)
            : pct;
        } else {
          entry.finalScore = entry.finalScore !== null
            ? Math.max(entry.finalScore, pct)
            : pct;
        }
      });
    });

    classworkPctsByStudent.forEach((pcts, studentId) => {
      const entry = byStudent.get(studentId);
      if (!entry) return;
      entry.classworkScore = averagePercentScores(pcts);
    });

    return { byStudent, linkedFields };
  }, [selectedClassId, classRosterKey, onlineRooms, onlineAttemptsByRoomId, teachingMgr]);

  const displaySummaries = useMemo(() => {
    if (!gradeBook.config || gradeBook.summaries.length === 0) return gradeBook.summaries;
    return mergeOnlineExamScores(
      gradeBook.summaries,
      gradeBook.config,
      onlineExamScoreSync.byStudent,
      onlineExamScoreSync.linkedFields,
    );
  }, [gradeBook.summaries, gradeBook.config, onlineExamScoreSync]);

  const prevClassSelectionRef = useRef({ classId: '', semester: selectedSemester });

  useEffect(() => {
    if (!selectedClassId) {
      prevClassSelectionRef.current = { classId: '', semester: selectedSemester };
      return;
    }

    const prev = prevClassSelectionRef.current;
    const semesterChanged = prev.semester !== selectedSemester;
    const classChanged = prev.classId !== '' && prev.classId !== selectedClassId;

    prevClassSelectionRef.current = { classId: selectedClassId, semester: selectedSemester };

    if (semesterChanged || classChanged) {
      setSelectedSubjectId('');
      setSelectedExamId('');
      setSelectedOnlineRoomId('');
      setActiveTab('table');
    }
  }, [selectedSemester, selectedClassId]);

  // reset tab เมื่อเปลี่ยนวิชา
  useEffect(() => {
    setSelectedExamId('');
    setSelectedOnlineRoomId('');
    setActiveTab('table');
  }, [selectedSubjectId]);

  const handleToggleOnlineRoomScoreLink = useCallback(async (
    room: (typeof onlineRoomCards)[number],
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!selectedSubjectId) return;

    const isLinked = room.settings?.scoreCollectionLinked !== false;
    const nextLinked = !isLinked;

    setTogglingScoreLinkRoomId(room.id);
    try {
      const nextSettings = {
        ...(room.settings ?? {}),
        scoreCollectionLinked: nextLinked,
        ...(nextLinked ? { scoreCollectionEnabled: true } : {}),
      };

      await updateDoc(doc(db, 'exam_rooms', room.id), { settings: nextSettings });

      const updatedRoom: ExamRoom = { ...room, settings: nextSettings };
      setOnlineRooms(prev => prev.map(r => (r.id === room.id ? updatedRoom : r)));

      toast.success(nextLinked
        ? 'เชื่อมต่อคะแนนกับห้องสอบนี้แล้ว'
        : 'ยกเลิกการเชื่อมต่อคะแนนจากห้องสอบนี้แล้ว');
    } catch (err) {
      console.error(err);
      toast.error(nextLinked
        ? 'ไม่สามารถเชื่อมต่อคะแนนได้'
        : 'ไม่สามารถยกเลิกการเชื่อมต่อคะแนนได้');
    } finally {
      setTogglingScoreLinkRoomId(null);
    }
  }, [selectedSubjectId]);

  // Load versioned courses when a class with a curriculumPackageId is selected
  useEffect(() => {
    if (!selectedClass?.curriculumPackageId) return;
    loadCoursesForVersion(selectedClass.curriculumPackageId);
  }, [selectedClass?.curriculumPackageId, loadCoursesForVersion]);

  useEffect(() => {
    if (!selectedClassId || !selectedSubjectId || !academicYear) return;
    if (!selectedClass || !selectedSubject) return;
    if (!teachingMgr.isRosterDataLoaded) return;

    const students = mapRosterStudentsForGradeBook(selectedClassId, teachingMgr.getStudentsForClass);

    const departmentId = (selectedClass.departmentId ?? 'secondary') as Department;

    gradeBook.loadGradeBook({
      subjectId: selectedSubjectId,
      subjectName: selectedSubject.name,
      subjectCode: selectedSubject.code ?? '',
      classId: selectedClassId,
      className: selectedClass.className,
      teacherId: user?.uid ?? '',
      departmentId,
      academicYearId: String(academicYear),
      semester: selectedSemester,
      students,
    });
  }, [
    selectedClassId,
    selectedSubjectId,
    selectedSemester,
    academicYear,
    selectedClass,
    selectedSubject,
    user?.uid,
    teachingMgr,
    teachingMgr.isRosterDataLoaded,
    gradeBook,
    classRosterKey,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadExams = async () => {
      if (!selectedClassId || !selectedSubjectId || !academicYear) {
        setSubjectExams([]);
        setExamScoresByExamId({});
        setSelectedExamId('');
        setOnlineRooms([]);
        setOnlineAttemptsByRoomId({});
        setSelectedOnlineRoomId('');
        setExamError(null);
        return;
      }

      setExamLoading(true);
      setExamError(null);

      try {
        const exams: Exam[] = [];
        const scoresMap: Record<string, ExamScore[]> = {};


        // ── 2. exam_rooms collection (online exam) ─────────────────────────
        // ยิง 2 query พร้อมกัน: by classId และ by gradeLevel (ห้องสอบอาจผูกแค่ระดับชั้น)
        // กรองวิชาใน client เพราะ gradeBookSubjectId อยู่ใน nested settings field
        const selectedGradeLevel = selectedClass?.gradeLevel ?? '';
        const [roomsByClass, roomsByGrade] = await Promise.all([
          getDocs(query(
            collection(db, 'exam_rooms'),
            where('classId', '==', selectedClassId),
            where('academicYearId', '==', String(academicYear)),
            where('semester', '==', selectedSemester),
          )),
          selectedGradeLevel
            ? getDocs(query(
                collection(db, 'exam_rooms'),
                where('gradeLevel', '==', selectedGradeLevel),
                where('academicYearId', '==', String(academicYear)),
                where('semester', '==', selectedSemester),
              ))
            : Promise.resolve(null),
        ]);
        // merge และ dedup ด้วย id
        const roomsSnapDocs = [
          ...roomsByClass.docs,
          ...(roomsByGrade?.docs.filter(d => !roomsByClass.docs.some(c => c.id === d.id)) ?? []),
        ];
        const roomsSnap = { docs: roomsSnapDocs };

        const normalizeTs = (val: unknown): number => {
          if (typeof val === 'number') return val;
          if (val && typeof (val as { toMillis?: () => number }).toMillis === 'function')
            return (val as { toMillis: () => number }).toMillis();
          if (val && typeof (val as { seconds?: number }).seconds === 'number')
            return (val as { seconds: number; nanoseconds?: number }).seconds * 1000 + ((val as { nanoseconds?: number }).nanoseconds ?? 0) / 1e6;
          return 0;
        };

        const rooms = roomsSnap.docs
          .map(d => {
            const raw = d.data();
            return {
              ...raw,
              id: d.id,
              startTime: normalizeTs(raw.startTime),
              endTime: normalizeTs(raw.endTime),
              createdAt: normalizeTs(raw.createdAt),
            } as ExamRoom;
          })
          .filter(r => {
            // ตรวจสอบการผูกวิชา (priority): gradeBookSubjects > gradeBookSubjectId > subjectId
            const linked = r.settings?.gradeBookSubjects ?? [];
            if (linked.length > 0) {
              // มีการผูกวิชาแบบ array → ตรวจว่า subjectId ตรง
              return linked.some(s => s.subjectId === selectedSubjectId);
            }
            if (r.settings?.gradeBookSubjectId) {
              // มีการผูกวิชาแบบ single field → ตรวจ field นั้น
              return r.settings.gradeBookSubjectId === selectedSubjectId;
            }
            // ไม่มีการผูกวิชาผ่าน settings → fallback: ตรวจ subjectId ตรงๆ
            // (แสดงที่เปิดเก็บคะแนน หรือเคยเชื่อมแล้วยกเลิก — การ์ดยังคงแสดง)
            if (r.subjectId === selectedSubjectId) {
              return r.settings?.scoreCollectionEnabled === true
                || r.settings?.scoreCollectionLinked === false;
            }
            return false;
          })
          .sort((a, b) => b.createdAt - a.createdAt);

        const attemptsMap: Record<string, ExamAttempt[]> = {};

        await Promise.all(rooms.map(async (room) => {
          const attSnap = await getDocs(query(
            collection(db, 'exam_rooms', room.id, 'attempts'),
            where('status', 'in', ['submitted', 'graded']),
          ));
          attSnap.docs.forEach(d => {
            const raw = d.data();
            const att = {
              ...raw,
              id: d.id,
              roomId: room.id,
              startedAt: normalizeTs(raw.startedAt),
              submittedAt: raw.submittedAt ? normalizeTs(raw.submittedAt) : null,
              lastSavedAt: normalizeTs(raw.lastSavedAt),
            } as ExamAttempt;
            if (!attemptsMap[room.id]) attemptsMap[room.id] = [];
            attemptsMap[room.id].push(att);
          });
        }));

        if (cancelled) return;
        setSubjectExams(exams);
        setExamScoresByExamId(scoresMap);
        setSelectedExamId(prev => (prev && exams.some(e => e.id === prev) ? prev : ''));
        setOnlineRooms(rooms);
        setOnlineAttemptsByRoomId(attemptsMap);
        setSelectedOnlineRoomId('');
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setSubjectExams([]);
        setExamScoresByExamId({});
        setSelectedExamId('');
        setOnlineRooms([]);
        setOnlineAttemptsByRoomId({});
        setSelectedOnlineRoomId('');
        setExamError('ไม่สามารถโหลดรายการการสอบได้');
      } finally {
        if (!cancelled) setExamLoading(false);
      }
    };

    loadExams();
    return () => { cancelled = true; };
  }, [selectedClassId, selectedSubjectId, selectedSemester, academicYear]);

  const handleReload = () => {
    if (!selectedClass || !selectedSubject || !academicYear) return;
    gradeBook.invalidateCache();
    const students = mapRosterStudentsForGradeBook(selectedClassId, teachingMgr.getStudentsForClass);
    gradeBook.loadGradeBook({
      subjectId: selectedSubjectId,
      subjectName: selectedSubject.name,
      subjectCode: selectedSubject.code ?? '',
      classId: selectedClassId,
      className: selectedClass.className,
      teacherId: user?.uid ?? '',
      departmentId: (selectedClass.departmentId ?? 'secondary') as Department,
      academicYearId: String(academicYear),
      semester: selectedSemester,
      students,
    });
  };

  if (!academicYear) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-3 rounded-2xl border border-amber-200">
          <AlertCircle size={16} />
          <p className="text-sm font-sarabun">กรุณาตั้งค่าปีการศึกษาก่อนใช้งาน</p>
        </div>
      </div>
    );
  }

  if (role === 'student') {
    return <StudentGradeBookPanel />;
  }

  const activeTabConfig = GRADE_BOOK_TAB_CONFIG[activeTab];
  const ActiveTabIcon = activeTabConfig.icon;
  const gradeBookMatchesSelection = Boolean(
    gradeBook.config
    && gradeBook.config.classId === selectedClassId
    && gradeBook.config.subjectId === selectedSubjectId
    && gradeBook.config.semester === selectedSemester
    && String(gradeBook.config.academicYearId) === String(academicYear),
  );
  const isGradeBookContentLoading = Boolean(
    selectedSubjectId
    && activeTab !== 'exams'
    && !gradeBook.error
    && (
      gradeBook.isLoading
      || !teachingMgr.isRosterDataLoaded
      || !gradeBookMatchesSelection
    ),
  );
  const showMobileTabSwitcher = Boolean(selectedSubjectId);
  const attendanceDateFilter = activeTab === 'attendance' && selectedSubjectId ? (
    <AttendanceDateRangeFilter
      yearStartDate={activeYear?.startDate ?? ''}
      yearEndDate={activeYear?.endDate ?? ''}
      onRangeChange={setAttendanceDateRange}
    />
  ) : null;
  const showClassFilterButton = showAdminClassBrowser && !selectedSubjectId;
  const showFilterButton = showClassFilterButton;
  const defaultSemester = (activeSemester as 1 | 2) ?? 1;
  const hasActiveFilters = selectedSemester !== defaultSemester;

  const openFilterDrawer = () => {
    setFilterDrawerOpen(true);
    setMobileTabMenuOpen(false);
  };

  const filterTriggerButton = (
    <button
      type="button"
      onClick={openFilterDrawer}
      className={HEADER_ICON_BTN}
      title="ตัวกรอง"
      aria-label="ตัวกรอง"
    >
      <HiOutlineFunnel size={16} />
      {hasActiveFilters && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" aria-hidden />
      )}
    </button>
  );

  const mobileBackPortal = isMdOrBelow && showPersonalSubjectFolders && selectedSubjectId && headerMobileBackEl && createPortal(
    <button
      type="button"
      onClick={handleBackFromSubject}
      className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
      title="กลับ"
      aria-label="กลับ"
    >
      <ArrowLeft size={18} />
    </button>,
    headerMobileBackEl,
  );

  const mobileActionsPortal = isMdOrBelow && headerMobileActionsEl && createPortal(
    <div className={cn('pointer-events-auto relative flex lg:hidden', HEADER_ICON_BTN_GROUP)}>
      {showFilterButton && filterTriggerButton}

      {selectedSubjectId && (
        <>
          {attendanceDateFilter}

          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={handleReload}
            className={HEADER_ICON_BTN}
            title="โหลดข้อมูลใหม่"
            aria-label="โหลดข้อมูลใหม่"
          >
            <RefreshCw size={15} />
          </motion.button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMobileTabMenuOpen((open) => !open);
              }}
              className={HEADER_ICON_BTN}
              title="เมนูแท็บ"
              aria-label="เปิดเมนูแท็บ"
              aria-expanded={mobileTabMenuOpen}
            >
              <HiBars3 className="h-4 w-4" />
            </button>

            {mobileTabMenuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[90]"
                  aria-label="ปิดเมนูแท็บ"
                  onClick={() => setMobileTabMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-[100] mt-1.5 w-52 rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
                  <p className="px-3 py-1.5 font-sukhumvit text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {GRADE_BOOK_MENU.label}
                  </p>
                  {(Object.entries(GRADE_BOOK_TAB_CONFIG) as [Tab, typeof GRADE_BOOK_TAB_CONFIG[Tab]][]).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    const isActive = activeTab === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveTab(key)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-sukhumvit text-[13px] font-bold transition-colors',
                          isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50',
                        )}
                      >
                        <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-400')} />
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>,
    headerMobileActionsEl,
  );

  const desktopFilterPortal = !isMdOrBelow && headerRightActionsEl && createPortal(
    <div className={cn('pointer-events-auto hidden lg:flex', HEADER_ICON_BTN_GROUP)}>
      {showFilterButton && filterTriggerButton}
    </div>,
    headerRightActionsEl,
  );

  const mobileHeaderPortal = isMdOrBelow && headerCenterMobileEl && createPortal(
    <div className="pointer-events-auto flex min-w-0 max-w-[calc(100vw-112px)] items-center justify-center lg:hidden">
      {showMobileTabSwitcher ? (
        <div className="flex min-w-0 items-center gap-1.5 text-black/80">
          <ActiveTabIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-sukhumvit text-[12px] font-black">
            {activeTabConfig.label}
          </span>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-1.5 text-black/80">
          <GraduationCap size={14} className="shrink-0" />
          <span className="truncate font-sukhumvit text-[12px] font-black">
            {GRADE_BOOK_MENU.label}
          </span>
        </div>
      )}
    </div>,
    headerCenterMobileEl,
  );

  return (
    <div
      className={cn(
        'flex min-h-0 w-full flex-1 flex-col overflow-hidden font-sukhumvit',
        'h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)]',
      )}
    >
      {mobileHeaderPortal}
      {mobileBackPortal}
      {mobileActionsPortal}
      {desktopFilterPortal}
      {breadcrumbPageEl && breadcrumbSubjectLabel && createPortal(
        <BreadcrumbLink asChild>
          <button
            type="button"
            onClick={handleBackFromSubject}
            className="font-black text-slate-500 transition-colors hover:text-slate-800"
            title="กลับไปเลือกรายวิชา"
          >
            {GRADE_BOOK_FEATURE_TITLE}
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

      {showFilterButton && (
        <ExamMobileFilterDrawer
          open={filterDrawerOpen}
          onOpenChange={setFilterDrawerOpen}
          direction="right"
          title="ตัวกรองภาคเรียน"
          description="เลือกภาคเรียน"
          footer={<ExamFilterShowResultsButton onClick={() => setFilterDrawerOpen(false)} />}
        >
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">ภาคเรียน</p>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2].map((sem) => (
                  <Button
                    key={sem}
                    type="button"
                    variant={selectedSemester === sem ? 'default' : 'outline'}
                    className="h-11 justify-start px-4"
                    onClick={() => setSelectedSemester(sem as 1 | 2)}
                  >
                    ภาคเรียนที่ {sem}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </ExamMobileFilterDrawer>
      )}

      <div
        className={cn(
          'flex min-h-0 flex-1',
          showAdminClassBrowser
            ? 'flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch'
            : 'flex-col overflow-hidden',
        )}
      >
        {showAdminClassBrowser && (
          <div
            className={cn(
              'flex min-h-0 w-full shrink-0 flex-col overflow-hidden lg:h-auto lg:max-h-full',
              sidebarCollapsed ? 'lg:w-20 xl:w-20' : 'lg:w-[280px] xl:w-[300px]',
              selectedClassId ? 'hidden lg:flex' : 'flex min-h-0 flex-1 lg:flex-none',
            )}
          >
            {!classesReady ? (
              <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto overscroll-y-contain scrollbar-hide rounded-2xl border border-border bg-card p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full shrink-0 rounded-2xl" />
                ))}
              </div>
            ) : (
              <GradeBookClassSidebar
                selectedDept={filterDepartment}
                selectedGrade={filterGradeLevel}
                selectedClassId={selectedClassId}
                gradeOptions={availableGrades}
                classOptions={classOptions}
                onSelectDept={handleSelectDept}
                onSelectGrade={handleSelectGrade}
                onSelectClass={handleSelectClass}
                collapsed={sidebarCollapsed}
                headerAction={(
                  <SidebarCollapseButton
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed((v) => !v)}
                  />
                )}
              />
            )}
          </div>
        )}

        <div
          className={cn(
            'relative flex min-h-0 flex-1 basis-0 flex-col overflow-hidden',
            showAdminClassBrowser && 'px-2 pb-2 sm:px-2.5 sm:pb-2.5',
            showAdminClassBrowser && selectedSubjectId && 'rounded-2xl border border-border bg-card',
            showAdminClassBrowser && !selectedClassId && 'hidden lg:flex',
          )}
        >
          {selectedClassId && selectedSubjectId && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-2 hidden min-h-[3.25rem] w-full shrink-0 items-center justify-between gap-2 border-b border-border px-0 pb-2 pt-2 sm:pt-2.5 lg:flex"
            >
              <div className="flex flex-wrap items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={handleBackFromSubject}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/70 bg-white text-slate-600 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all hover:bg-slate-50 active:scale-95 cursor-pointer mr-1.5"
                  title="กลับไปหน้าวิชา"
                  aria-label="กลับไปหน้าวิชา"
                >
                  <ArrowLeft size={13} strokeWidth={2.5} />
                </button>

                <div className="flex gap-1 rounded-xl bg-slate-100 p-0.5 border border-slate-200/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                  {(Object.entries(GRADE_BOOK_TAB_CONFIG) as [Tab, typeof GRADE_BOOK_TAB_CONFIG[Tab]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key)}
                      className={cn(
                        'rounded-lg px-3.5 py-1.5 text-[11px] font-black font-sukhumvit transition-all duration-200 cursor-pointer',
                        activeTab === key
                          ? 'bg-[#1e1e24] text-white shadow-sm font-black'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/30',
                      )}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>

                {attendanceDateFilter}

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={handleReload}
                  className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-muted/80"
                >
                  <RefreshCw size={13} />
                </motion.button>
              </div>
            </motion.div>
          )}

          <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto overscroll-y-contain scrollbar-hide">
        {showAdminClassBrowser && selectedClassId && !selectedSubjectId && (
          <div className="flex flex-col gap-2">
              {isSubjectGridLoading ? (
                <SubjectFolderCardsGridSkeleton count={6} />
              ) : availableSubjects.length === 0 ? (
                <div className="rounded-2xl px-4 py-3 text-[12px] text-slate-400 font-sarabun border border-dashed border-slate-200 bg-white/60">
                  ยังไม่มีรายวิชาที่ลงทะเบียนสำหรับภาคเรียนที่ {selectedSemester}
                </div>
              ) : (
                <div className="grid w-full grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 xl:grid-cols-4">
                  {availableSubjects.map(subject => {
                    const key = `${selectedClassId}|${subject.id}`;
                    return (
                      <SubjectFolderCard
                        key={subject.id}
                        title={subject.name}
                        subtitle={selectedClass?.className ?? ''}
                        meta={
                          subject.code ? (
                            <p className="pt-0.5 text-[10px] font-bold text-muted-foreground">{subject.code}</p>
                          ) : undefined
                        }
                        colorId={folderColors[key] ?? DEFAULT_COLOR_ID}
                        onColorChange={(id) => setFolderColor(key, id)}
                        onClick={() => {
                          setSelectedSubjectId(subject.id);
                          setSelectedExamId('');
                        }}
                        showPaper
                      />
                    );
                  })}
                </div>
              )}
          </div>
        )}

        {showAdminClassBrowser && !selectedClassId ? (
          <div className="flex min-h-full w-full flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center">
            <HiAcademicCap className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-[13px] font-black text-muted-foreground font-sukhumvit">
              {!filterDepartment
                ? 'เลือกแผนกจากแถบด้านซ้าย'
                : !filterGradeLevel
                  ? 'เลือกระดับชั้นเพื่อดูห้องเรียน'
                  : 'เลือกห้องเรียนเพื่อดูรายวิชา'}
            </p>
          </div>
        ) : !selectedSubjectId ? (
          null
        ) : activeTab === 'exams' ? (
          /* ── Exams Tab ── */
          <AnimatePresence mode="wait">
            {!selectedExamId && !selectedOnlineRoomId ? (
              /* ── Grid view: รายการสอบทั้งหมด ── */
              <motion.div key="exam-grid"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-4"
              >
                {examLoading ? (
                  <ExamCardsSkeleton count={4} />
                ) : examError ? (
                  <div className="py-10 text-center text-[12px] text-rose-500 font-sarabun">{examError}</div>
                ) : (
                  <>
                    {/* ── ส่วน: ห้องสอบออนไลน์ ── */}
                    <div className="flex flex-col gap-3">
                      {onlineRoomCards.length === 0 ? (
                        <p className="text-[11px] text-slate-400 font-sarabun py-4 text-center">
                          ยังไม่มีห้องสอบออนไลน์สำหรับวิชานี้
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                          {onlineRoomCards.map(room => {
                            const scoreEnabled = room.settings?.scoreCollectionEnabled === true;
                            const scoreTypeCfg: Record<string, { label: string; color: string; bg: string }> = {
                              classwork: { label: 'เก็บคะแนน', color: '#d97706', bg: '#fef3c7' },
                              quiz:      { label: 'ทดสอบย่อย', color: '#d97706', bg: '#fef3c7' },
                              midterm:   { label: 'กลางภาค',   color: '#e11d48', bg: '#ffe4e6' },
                              final:     { label: 'ปลายภาค',   color: '#7c3aed', bg: '#f3e8ff' },
                            };
                            const scoreType = room.settings?.scoreCollectionType ?? 'classwork';
                            const typeCfg = scoreTypeCfg[scoreType] ?? scoreTypeCfg.classwork;
                            const isTogglingScoreLink = togglingScoreLinkRoomId === room.id;
                            const isScoreLinked = room.settings?.scoreCollectionLinked !== false;
                            return (
                              <div key={room.id} className="relative">
                              <motion.div
                                role={scoreEnabled ? 'button' : undefined}
                                tabIndex={scoreEnabled ? 0 : undefined}
                                whileHover={{ scale: scoreEnabled ? 1.01 : 1 }}
                                whileTap={{ scale: scoreEnabled ? 0.98 : 1 }}
                                onClick={() => scoreEnabled && setSelectedOnlineRoomId(room.id)}
                                onKeyDown={(e) => {
                                  if (!scoreEnabled) return;
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setSelectedOnlineRoomId(room.id);
                                  }
                                }}
                                className="w-full text-left rounded-2xl p-4 border transition-all flex flex-col gap-2"
                                style={{
                                  background: scoreEnabled ? 'rgba(255,255,255,0.92)' : 'rgba(248,250,252,0.7)',
                                  borderColor: scoreEnabled ? 'rgba(226,232,240,0.9)' : 'rgba(226,232,240,0.5)',
                                  cursor: scoreEnabled ? 'pointer' : 'default',
                                  opacity: scoreEnabled ? 1 : 0.72,
                                }}
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  {scoreEnabled ? (
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg font-sukhumvit"
                                      style={{ background: typeCfg.bg, color: typeCfg.color }}>
                                      {typeCfg.label}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg font-sukhumvit"
                                      style={{ background: 'rgba(148,163,184,0.12)', color: '#94a3b8' }}>
                                      ยังไม่เปิดเก็บคะแนน
                                    </span>
                                  )}
                                </div>
                                <p className="text-[13px] font-black text-slate-800 font-sukhumvit line-clamp-2">{room.title}</p>
                                {scoreEnabled ? (
                                  <>
                                    <p className="text-[10px] text-slate-400 font-sarabun">
                                      {room.maxScore} คะแนน · รอบที่ {room.completedRounds}/{room.settings?.maxAttempts === 0 ? '∞' : (room.settings?.maxAttempts ?? 1)}
                                    </p>
                                    <div className="flex items-center justify-end pt-1 border-t border-slate-100">
                                      <button
                                        type="button"
                                        onClick={(e) => handleToggleOnlineRoomScoreLink(room, e)}
                                        disabled={isTogglingScoreLink}
                                        title={isScoreLinked
                                          ? 'ยกเลิกการเชื่อมต่อคะแนนจากห้องสอบนี้'
                                          : 'เชื่อมต่อคะแนนกับห้องสอบนี้'}
                                        className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center border transition-all hover:opacity-80 disabled:opacity-40"
                                        style={isScoreLinked
                                          ? {
                                              background: 'rgba(225,29,72,0.08)',
                                              borderColor: 'rgba(225,29,72,0.22)',
                                              color: '#e11d48',
                                            }
                                          : {
                                              background: 'rgba(5,150,105,0.1)',
                                              borderColor: 'rgba(5,150,105,0.25)',
                                              color: '#059669',
                                            }}
                                      >
                                        {isTogglingScoreLink ? (
                                          <div className={`w-3.5 h-3.5 border-2 rounded-full animate-spin ${isScoreLinked ? 'border-rose-300 border-t-rose-600' : 'border-emerald-300 border-t-emerald-600'}`} />
                                        ) : isScoreLinked ? (
                                          <Link2Off size={14} strokeWidth={2.5} />
                                        ) : (
                                          <Link2 size={14} strokeWidth={2.5} />
                                        )}
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-[10px] text-slate-400 font-sarabun">
                                    เปิด "นำคะแนนไปใช้" ในห้องสอบเพื่อแสดงผลที่นี่
                                  </p>
                                )}
                              </motion.div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            ) : selectedOnlineRoomId && selectedOnlineRoom ? (
              /* ── Online room detail ── */
              <motion.div key="online-detail"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
              >
                <div className="flex items-center gap-2 px-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedOnlineRoomId('')}
                    className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
                    aria-label="กลับรายการสอบ"
                    title="กลับรายการสอบ"
                  >
                    <HiArrowLeft size={16} />
                  </button>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <p className="line-clamp-1 text-[13px] font-black text-foreground font-sukhumvit">
                      {selectedOnlineRoom.title}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground font-sarabun">
                    {onlineRoomScoreTableRows.length} คน
                  </span>
                </div>
                <ExamRoomScoreTable rows={onlineRoomScoreTableRows} />
              </motion.div>
            ) : (
              /* ── Manual exam detail (เดิม) ── */
              <motion.div key="exam-detail"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
              >
                <button
                  type="button"
                  onClick={() => setSelectedExamId('')}
                  className="self-start flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
                  aria-label="กลับรายการสอบ"
                  title="กลับรายการสอบ"
                >
                  <HiArrowLeft size={16} />
                </button>

                {examCards.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-[1.5rem] p-4"
                    style={{ ...GLASS, background: 'rgba(255,255,255,0.78)' }}>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sukhumvit mb-2">เลือกการสอบ</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {examCards.map(exam => {
                        const active = selectedExamId === exam.id;
                        const cfg = EXAM_TYPE_COLOR[exam.type];
                        return (
                          <button key={exam.id}
                            onClick={() => setSelectedExamId(active ? '' : exam.id)}
                            className="shrink-0 text-left rounded-2xl px-3 py-2.5 border transition-all min-w-[160px]"
                            style={{
                              background: active ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.88)',
                              borderColor: active ? 'rgba(15,23,42,0.95)' : 'rgba(226,232,240,0.9)',
                            }}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md font-sukhumvit"
                                style={{ background: active ? 'rgba(255,255,255,0.12)' : cfg.bg, color: active ? '#fff' : cfg.text }}>
                                {EXAM_TYPE_LABEL[exam.type]}
                              </span>
                            </div>
                            <p className={`text-[11px] font-bold font-sukhumvit line-clamp-1 ${active ? 'text-white' : 'text-slate-800'}`}>
                              {exam.title}
                            </p>
                            <p className={`text-[9px] font-sarabun mt-0.5 ${active ? 'text-white/60' : 'text-slate-400'}`}>
                              {exam.examDate} · {exam.gradedCount}/{exam.totalCount} คน
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                <AnimatePresence>
                  {selectedExam && (
                    <motion.div key={selectedExam.id}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      className="flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between gap-2 px-0.5">
                        <p className="text-[13px] font-black text-foreground font-sukhumvit">
                          คะแนนนักเรียน: {selectedExam.title}
                        </p>
                        <span className="text-[11px] text-muted-foreground font-sarabun">
                          {examRoomScoreTableRows.length} คน
                        </span>
                      </div>
                      <ExamRoomScoreTable rows={examRoomScoreTableRows} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        ) : activeTab === 'attendance' ? (
          /* ── Attendance Tab ── */
          isGradeBookContentLoading ? (
            <GradeBookTableSkeleton />
          ) : gradeBook.error ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex items-center gap-2 text-rose-500 bg-rose-50 px-4 py-3 rounded-2xl border border-rose-200">
                <AlertCircle size={15} />
                <p className="text-sm font-sarabun">{gradeBook.error}</p>
              </div>
            </div>
          ) : (
            gradeBook.config && (
              <GradeTable
                summaries={displaySummaries}
                config={gradeBook.config}
                view="attendance"
                attendanceDateRange={attendanceDateRange}
              />
            )
          )
        ) : (
          /* ── Table & Config Tabs ── */
          <>
            {/* Grade book */}
            {isGradeBookContentLoading ? (
              activeTab === 'config' ? <GradeConfigPanelSkeleton /> : <GradeBookTableSkeleton />
            ) : gradeBook.error ? (
              <div className="flex items-center justify-center h-32">
                <div className="flex items-center gap-2 text-rose-500 bg-rose-50 px-4 py-3 rounded-2xl border border-rose-200">
                  <AlertCircle size={15} />
                  <p className="text-sm font-sarabun">{gradeBook.error}</p>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {activeTab === 'table' ? (
                  <motion.div key="table"
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                    {gradeBook.config && (
                      <GradeTable
                        summaries={displaySummaries}
                        config={gradeBook.config}
                        showAsPercentage
                      />
                    )}
                  </motion.div>
                ) : (
                  <motion.div key="config"
                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                    {gradeBook.config && (
                      <GradeConfigPanel
                        config={gradeBook.config}
                        onSave={async (updated: GradeWeightConfig) => {
                          await gradeBook.saveConfig(updated);
                          gradeBook.recalculate(updated);
                        }}
                        onRecalculate={gradeBook.recalculate}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
