import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, ChevronDown, Settings2, RefreshCw, BookOpen, AlertCircle, ClipboardList,
  ArrowLeft, Users, TrendingUp, Monitor, Link2, Link2Off,
} from 'lucide-react';
import { HiBookOpen, HiAdjustmentsHorizontal, HiClipboardDocumentList, HiCalendarDays, HiBars3 } from 'react-icons/hi2';
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
import GradeConfigPanel from './components/GradeConfigPanel';
import StudentGradeBookPanel from './components/StudentGradeBookPanel';
import { GLASS } from '@/components/layouts/PortalLayout';
import { cn } from '@/lib/utils';
import type { GradeWeightConfig } from '@/types/grades';
import { CATEGORY_CONFIG, DEPARTMENT_CONFIG, type Department, type Subject } from '@/types/curriculum';
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
import type { Exam, ExamScore, ExamType } from '@/types/teaching';
import type { ExamRoom, ExamAttempt } from '@/types/exam';

type Tab = 'table' | 'config' | 'exams' | 'attendance';

const GRADE_BOOK_MENU = {
  label: 'สมุดคะแนน',
  icon: GraduationCap,
};

const GRADE_BOOK_TAB_CONFIG: Record<Tab, { label: string; icon: IconType }> = {
  table: { label: 'ตารางคะแนนรวม', icon: HiBookOpen },
  config: { label: 'ตั้งค่าเกรด', icon: HiAdjustmentsHorizontal },
  exams: { label: 'คะแนนการสอบ', icon: HiClipboardDocumentList },
  attendance: { label: 'การเข้าเรียน', icon: HiCalendarDays },
};

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

function SelectField({
  label, value, onChange, children, disabled = false,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="h-[50px] text-[10px] font-black text-slate-500 uppercase tracking-widest font-sukhumvit">{label}</label>
      )}
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          className="w-full min-w-0 h-9 sm:h-10 rounded-2xl sm:rounded-3xl pl-2 sm:pl-3 pr-6 sm:pr-8 text-[10px] sm:text-xs font-medium font-sarabun appearance-none outline-none disabled:opacity-50 disabled:cursor-not-allowed truncate"
          style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(200,180,255,0.4)' }}
        >
          {children}
        </select>
        <ChevronDown size={12} className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

export default function GradeBookPage() {
  const { user, role } = useAuth();
  const { year: academicYear, activeSemester, activeYear } = useActiveAcademicYear();
  const canViewAllSubjects = role === 'admin' || role === 'sysadmin';
  const teachingMgr = useTeachingManager(user?.uid ?? '', canViewAllSubjects);
  const gradeBook = useGradeBook();
  const curriculum = useCurriculum();
  const { coursesByVersion, loadCoursesForVersion, versions } = useCurriculumVersioned();

  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterGradeLevel, setFilterGradeLevel] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>((activeSemester as 1 | 2) ?? 1);

  const [activeTab, setActiveTab] = useState<Tab>('table');

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
  const [mobileTabMenuOpen, setMobileTabMenuOpen] = useState(false);
  const [semesterMenuOpen, setSemesterMenuOpen] = useState(false);

  const handleBackFromSubject = useCallback(() => {
    setSelectedSubjectId('');
    setSelectedExamId('');
    setSelectedOnlineRoomId('');
    if (role === 'teacher') setSelectedClassId('');
  }, [role]);

  useEffect(() => {
    setHeaderCenterMobileEl(document.getElementById('header-portal-center-mobile'));
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
    setHeaderMobileBackEl(document.getElementById('header-portal-mobile-back'));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      setIsMdOrBelow(!mq.matches);
      setMobileTabMenuOpen(false);
      setSemesterMenuOpen(false);
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    setMobileTabMenuOpen(false);
    setSemesterMenuOpen(false);
  }, [activeTab, selectedSubjectId]);

  useEffect(() => {
    const defaultBack = document.getElementById('portal-default-mobile-back');
    if (!defaultBack) return;
    defaultBack.style.display = isMdOrBelow && selectedSubjectId ? 'none' : '';
  }, [isMdOrBelow, selectedSubjectId]);

  // Preload versioned curriculum courses so subject names resolve on teacher cards
  useEffect(() => {
    const classSource = role === 'teacher' ? teachingMgr.yearClasses : teachingMgr.classes;
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
  }, [teachingMgr.classes, teachingMgr.yearClasses, role, versions, coursesByVersion, loadCoursesForVersion]);

  const availableClasses = useMemo(() => {
    const all = role === 'teacher' ? teachingMgr.yearClasses : teachingMgr.classes;
    if (role === 'teacher' && teachingMgr.teacherIdentityKeys.size > 0) {
      return all.filter(c =>
        (c.enrolledCourses ?? []).some(ec =>
          matchesTeacherIdentity(ec.teacherId, teachingMgr.teacherIdentityKeys),
        ),
      );
    }
    return all;
  }, [teachingMgr.classes, teachingMgr.yearClasses, teachingMgr.teacherIdentityKeys, role]);

  const availableDepartments = useMemo(() => {
    const depts = new Set<string>();
    availableClasses.forEach(c => c.departmentId && depts.add(c.departmentId));
    return Array.from(depts);
  }, [availableClasses]);

  const availableGrades = useMemo(() => {
    if (!filterDepartment) return [];
    const grades = new Set<string>();
    availableClasses
      .filter(c => c.departmentId === filterDepartment)
      .forEach(c => c.gradeLevel && grades.add(c.gradeLevel));
    return Array.from(grades).sort((a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99));
  }, [availableClasses, filterDepartment]);

  const filteredClasses = useMemo(() => {
    if (!filterDepartment || !filterGradeLevel) return [];
    return availableClasses.filter(c => c.departmentId === filterDepartment && c.gradeLevel === filterGradeLevel);
  }, [availableClasses, filterDepartment, filterGradeLevel]);

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
        role !== 'teacher' ||
        matchesTeacherIdentity(ec.teacherId, teachingMgr.teacherIdentityKeys);
      if (passSemester && passTeacher) byId.add(ec.subjectId);
    });

    return Array.from(byId)
      .map(id => subjectById.get(id))
      .filter((s): s is Subject => Boolean(s))
      .sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name, 'th'));
  }, [selectedClass, selectedSemester, role, teachingMgr.teacherIdentityKeys, subjectById]);

  const selectedSubject = useMemo(
    () => availableSubjects.find(s => s.id === selectedSubjectId) ?? null,
    [availableSubjects, selectedSubjectId],
  );

  // For teacher role: one card per (class, subject) teaching assignment
  const myTeachingCards = useMemo(() => {
    if (role !== 'teacher') return [];
    const cards: Array<{
      classId: string;
      className: string;
      gradeLevel: string;
      departmentId: string;
      subjectId: string;
      subjectName: string;
      subjectCode: string;
      credits: number;
      category: string;
      studentCount: number;
    }> = [];
    const seenKeys = new Set<string>();
    for (const cls of availableClasses) {
      for (const ec of (cls.enrolledCourses ?? [])) {
        if (!matchesTeacherIdentity(ec.teacherId, teachingMgr.teacherIdentityKeys)) continue;
        if (ec.semester != null && ec.semester !== selectedSemester) continue;
        const subject = subjectById.get(ec.subjectId);
        if (!subject) continue;
        const key = `${cls.id}_${ec.subjectId}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        cards.push({
          classId: cls.id,
          className: cls.className,
          gradeLevel: cls.gradeLevel ?? '',
          departmentId: cls.departmentId ?? '',
          subjectId: ec.subjectId,
          subjectName: subject.name,
          subjectCode: subject.code ?? '',
          credits: subject.credits,
          category: subject.category,
          studentCount: teachingMgr.getStudentsForClass(cls.id).length,
        });
      }
    }
    return cards.sort((a, b) => {
      const ga = GRADE_LEVEL_ORDER[a.gradeLevel] ?? 99;
      const gb = GRADE_LEVEL_ORDER[b.gradeLevel] ?? 99;
      if (ga !== gb) return ga - gb;
      if (a.className !== b.className) return a.className.localeCompare(b.className, 'th');
      return a.subjectCode.localeCompare(b.subjectCode);
    });
  }, [availableClasses, teachingMgr, role, selectedSemester, subjectById]);

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
    return onlineRooms.map(room => {
      const attempts = onlineAttemptsByRoomId[room.id] ?? [];
      const gradedAttempts = attempts.filter(a => resolveAttemptTotalScore(a) !== null);
      const classStudentCount = teachingMgr.getStudentsForClass(room.classId ?? '').length;
      const totalCount = attempts.length > 0 ? attempts.length : classStudentCount;
      const avg = gradedAttempts.length > 0
        ? Math.round((gradedAttempts.reduce((s, a) => s + (a.score as number), 0) / gradedAttempts.length) * 10) / 10
        : null;
      const maxScore = room.totalPoints ?? 100;
      return { ...room, gradedCount: gradedAttempts.length, totalCount, avgScore: avg, maxScore };
    });
  }, [onlineRooms, onlineAttemptsByRoomId, teachingMgr]);

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
        status: att?.status ?? null,
        score: resolveAttemptTotalScore(att),
        scorePercent: scorePercent !== null ? Math.round(scorePercent) : null,
        round: att?.round ?? null,
      };
    });
  }, [selectedOnlineRoomId, selectedClassId, teachingMgr, onlineAttemptsByRoomId, onlineRooms]);

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
  const showMobileTabSwitcher = Boolean(selectedSubjectId);
  const showMobileSemesterButton = isMdOrBelow && !selectedSubjectId;

  const mobileBackPortal = isMdOrBelow && selectedSubjectId && headerMobileBackEl && createPortal(
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
    <div className="pointer-events-auto relative flex items-center gap-1.5 lg:hidden">
      {showMobileSemesterButton && (
        <>
          <button
            type="button"
            onClick={() => {
              setSemesterMenuOpen((open) => !open);
              setMobileTabMenuOpen(false);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
            title={`ภาคเรียนที่ ${selectedSemester}`}
            aria-label="เลือกภาคเรียน"
            aria-expanded={semesterMenuOpen}
          >
            <span className="font-sukhumvit text-[11px] font-black tabular-nums">{selectedSemester}</span>
          </button>

          {semesterMenuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-[90]"
                aria-label="ปิดเมนูภาคเรียน"
                onClick={() => setSemesterMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-[100] mt-1.5 w-44 rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
                {[1, 2].map((sem) => {
                  const isActive = selectedSemester === sem;
                  return (
                    <button
                      key={sem}
                      type="button"
                      onClick={() => {
                        setSelectedSemester(sem as 1 | 2);
                        setSemesterMenuOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center rounded-xl px-3 py-2.5 text-left font-sukhumvit text-[12px] font-bold transition-colors',
                        isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      ภาคเรียนที่ {sem}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {selectedSubjectId && (
        <>
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={handleReload}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
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
                setSemesterMenuOpen(false);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
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
    <div className="flex flex-col gap-4 h-full">
      {mobileHeaderPortal}
      {mobileBackPortal}
      {mobileActionsPortal}
      {selectedClassId && selectedSubjectId && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="hidden md:flex rounded-xl p-4 flex-col gap-3 shrink-0"
          style={GLASS}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleBackFromSubject}
              className="w-9 h-9 flex items-center justify-center rounded-2xl bg-white/60 text-slate-500 hover:bg-white/80 transition-colors shadow-sm shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="hidden md:flex gap-1 p-1 rounded-2xl" style={{ background: 'rgba(241,245,249,0.8)' }}>
              {([
                { key: 'table' as Tab, icon: <BookOpen size={11} />, label: 'ตารางคะแนนรวม' },
                { key: 'config' as Tab, icon: <Settings2 size={11} />, label: 'ตั้งค่าเกรด' },
                { key: 'exams' as Tab, icon: <ClipboardList size={11} />, label: 'คะแนนการสอบ' },
                { key: 'attendance' as Tab, icon: <HiCalendarDays size={11} />, label: 'การเข้าเรียน' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold font-sukhumvit transition-all"
                  style={{
                    background: activeTab === tab.key ? '#0f172a' : 'transparent',
                    color: activeTab === tab.key ? '#fff' : '#64748b',
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={handleReload}
              className="ml-auto w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors shrink-0"
            >
              <RefreshCw size={13} />
            </motion.button>
          </div>
        </motion.div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide space-y-3">
        {role !== 'teacher' && !selectedSubjectId && (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-1 sm:gap-2 min-w-0">
            <SelectField
              value={filterDepartment}
              onChange={v => {
                setFilterDepartment(v);
                setFilterGradeLevel('');
                setSelectedClassId('');
                setSelectedSubjectId('');
                setSelectedExamId('');
              }}
            >
              <option value="">— เลือกแผนก —</option>
              {availableDepartments.map(d => (
                <option key={d} value={d}>{DEPARTMENT_CONFIG[d as Department]?.label ?? d}</option>
              ))}
            </SelectField>

            <SelectField
              value={filterGradeLevel}
              disabled={!filterDepartment}
              onChange={v => {
                setFilterGradeLevel(v);
                setSelectedClassId('');
                setSelectedSubjectId('');
                setSelectedExamId('');
              }}
            >
              <option value="">— เลือกระดับชั้น —</option>
              {availableGrades.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </SelectField>

            <SelectField
              value={selectedClassId}
              disabled={!filterDepartment || !filterGradeLevel}
              onChange={v => {
                setSelectedClassId(v);
                setSelectedSubjectId('');
                setSelectedExamId('');
              }}
            >
              <option value="">— เลือกห้องเรียน —</option>
              {filteredClasses.map(c => (
                <option key={c.id} value={c.id}>{c.className}</option>
              ))}
            </SelectField>

            <div className="hidden md:block">
            <SelectField
              value={String(selectedSemester)}
              onChange={v => setSelectedSemester(Number(v) as 1 | 2)}
            >
              <option value="1">ภาคเรียนที่ 1</option>
              <option value="2">ภาคเรียนที่ 2</option>
            </SelectField>
            </div>
          </div>
        )}

        {role !== 'teacher' && selectedClassId && !selectedSubjectId && (
          <div className="flex flex-col gap-2">
              {availableSubjects.length === 0 ? (
                <div className="rounded-2xl px-4 py-3 text-[12px] text-slate-400 font-sarabun border border-dashed border-slate-200 bg-white/60">
                  ยังไม่มีรายวิชาที่ลงทะเบียนสำหรับภาคเรียนที่ {selectedSemester}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {availableSubjects.map(subject => {
                    const isActive = selectedSubjectId === subject.id;
                    const cat = CATEGORY_CONFIG[subject.category];
                    return (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => {
                          setSelectedSubjectId(subject.id);
                          setSelectedExamId('');
                        }}
                        className="text-left rounded-2xl p-3 border transition-all"
                        style={{
                          background: isActive ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.8)',
                          borderColor: isActive ? 'rgba(15,23,42,0.95)' : 'rgba(226,232,240,0.9)',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-[9px] font-bold px-2 py-0.5 rounded-lg font-sukhumvit"
                            style={{ background: isActive ? 'rgba(255,255,255,0.12)' : cat.bg, color: isActive ? '#fff' : cat.color }}
                          >
                            {cat.label}
                          </span>
                          {subject.code && (
                            <span className={`text-[10px] font-sarabun ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                              {subject.code}
                            </span>
                          )}
                        </div>
                        <p className={`text-[12px] font-bold font-sukhumvit line-clamp-2 ${isActive ? 'text-white' : 'text-slate-800'}`}>
                          {subject.name}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
          </div>
        )}

        {role === 'teacher' && !selectedSubjectId && (
          <div className="hidden md:flex items-center gap-2 flex-wrap">
            {[1, 2].map(sem => (
              <button
                key={sem}
                type="button"
                onClick={() => setSelectedSemester(sem as 1 | 2)}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold font-sukhumvit transition-all"
                style={{
                  background: selectedSemester === sem ? '#0f172a' : 'rgba(241,245,249,0.8)',
                  color: selectedSemester === sem ? '#fff' : '#64748b',
                }}
              >
                ภาคเรียนที่ {sem}
              </button>
            ))}
          </div>
        )}

        {/* ── Teacher: subject card grid ── */}
        {role === 'teacher' && !selectedSubjectId ? (
          myTeachingCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <GraduationCap size={28} className="text-slate-300" />
              <p className="text-[13px] text-slate-400 font-sarabun">ยังไม่มีรายวิชาที่ได้รับมอบหมายสำหรับภาคเรียนที่ {selectedSemester}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myTeachingCards.map(card => {
                const cat = CATEGORY_CONFIG[card.category as keyof typeof CATEGORY_CONFIG] ?? { label: card.category, bg: '#f1f5f9', color: '#64748b' };
                return (
                  <motion.button
                    key={`${card.classId}_${card.subjectId}`}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedClassId(card.classId);
                      setSelectedSubjectId(card.subjectId);
                      setSelectedExamId('');
                      setSelectedOnlineRoomId('');
                    }}
                    className="text-left rounded-[1.5rem] p-4 border transition-all flex flex-col gap-3"
                    style={{
                      background: 'rgba(255,255,255,0.88)',
                      borderColor: 'rgba(226,232,240,0.9)',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                    }}
                  >
                    {/* Category + code row */}
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-lg font-sukhumvit"
                        style={{ background: cat.bg, color: cat.color }}
                      >
                        {cat.label}
                      </span>
                      {card.subjectCode && (
                        <span className="text-[10px] font-sarabun text-slate-400">{card.subjectCode}</span>
                      )}
                      <span
                        className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full font-sukhumvit"
                        style={{ background: 'rgba(124,58,237,0.08)', color: '#7c3aed' }}
                      >
                        เทอม {selectedSemester}
                      </span>
                    </div>

                    {/* Subject name */}
                    <p className="text-[14px] font-black text-slate-800 font-sukhumvit line-clamp-2 leading-snug">
                      {card.subjectName}
                    </p>

                    {/* Class info */}
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-slate-700 font-sukhumvit">{card.className}</span>
                        <span className="text-[10px] text-slate-400 font-sarabun">{card.gradeLevel}</span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )
        ) : !filterDepartment && role !== 'teacher' ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm font-sarabun">เริ่มจากเลือกแผนกก่อน</div>
        ) : !filterGradeLevel && role !== 'teacher' ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm font-sarabun">เลือกระดับชั้นเพื่อไป Step ถัดไป</div>
        ) : !selectedClassId && role !== 'teacher' ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm font-sarabun">เลือกห้องเรียนเพื่อแสดงรายวิชา</div>
        ) : !selectedSubjectId ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm font-sarabun">เลือกวิชาเพื่อดูการสอบและคะแนนนักเรียน</div>
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
                  <div className="py-10 text-center text-[12px] text-slate-400 font-sarabun">กำลังโหลดการสอบ...</div>
                ) : examError ? (
                  <div className="py-10 text-center text-[12px] text-rose-500 font-sarabun">{examError}</div>
                ) : (
                  <>
                    {/* ── ส่วน: ห้องสอบออนไลน์ ── */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-black text-slate-700 font-sukhumvit">ห้องสอบออนไลน์</p>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full font-sukhumvit"
                          style={{ background: 'rgba(124,58,237,0.08)', color: '#7c3aed' }}>
                          เก็บคะแนนอัตโนมัติ
                        </span>
                      </div>
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
                            const pct = room.totalCount > 0
                              ? Math.round((room.gradedCount / room.totalCount) * 100) : 0;
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
                                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                                      <div className="flex items-center gap-1 text-[10px] font-sarabun text-slate-500">
                                        <Users size={10} /><span>{room.gradedCount}/{room.totalCount} คน</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-[10px] font-sarabun text-slate-500">
                                        <TrendingUp size={10} /><span>เฉลี่ย {room.avgScore ?? '-'}</span>
                                      </div>
                                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                        <div className="h-full rounded-full transition-all"
                                          style={{ width: `${pct}%`, background: '#7c3aed' }} />
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
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
                <button
                  onClick={() => setSelectedOnlineRoomId('')}
                  className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold font-sukhumvit text-slate-600 bg-white/80 border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft size={12} />กลับรายการสอบ
                </button>

                <div className="rounded-[1.5rem] p-4 flex flex-col gap-3"
                  style={{ ...GLASS, background: 'rgba(255,255,255,0.82)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Monitor size={13} className="text-violet-500 shrink-0" />
                      <p className="text-[13px] font-black text-slate-800 font-sukhumvit line-clamp-1">
                        {selectedOnlineRoom.title}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400 font-sarabun shrink-0">
                      {selectedOnlineRoomRows.length} คน
                    </span>
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-slate-100">
                    <div className="grid grid-cols-[2rem_1fr_6rem_6rem] gap-2 px-4 py-2 bg-slate-50">
                      <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit">#</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit">นักเรียน</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit text-center">สถานะ</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit text-center">คะแนน (%)</span>
                    </div>
                    <div className="divide-y divide-slate-100 bg-white/80">
                      {selectedOnlineRoomRows.map((row, idx) => (
                        <div key={row.studentId} className="grid grid-cols-[2rem_1fr_6rem_6rem] gap-2 px-4 py-2.5 items-center">
                          <span className="text-[10px] font-bold text-slate-400 font-sukhumvit">{idx + 1}</span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-800 font-sukhumvit truncate">{row.studentName}</p>
                            <p className="text-[9px] text-slate-400 font-sarabun">{row.studentCode}</p>
                          </div>
                          <span className="text-center">
                            {row.status === 'graded' ? (
                              <span className="text-[9px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full font-sukhumvit">ตรวจแล้ว</span>
                            ) : row.status === 'submitted' ? (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-sukhumvit">ส่งแล้ว</span>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-sukhumvit">ไม่มีข้อมูล</span>
                            )}
                          </span>
                          <span className="text-center text-[11px] font-black text-slate-700 font-sukhumvit">
                            {row.scorePercent !== null
                              ? `${row.scorePercent}%`
                              : '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* ── Manual exam detail (เดิม) ── */
              <motion.div key="exam-detail"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
              >
                <button
                  onClick={() => setSelectedExamId('')}
                  className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold font-sukhumvit text-slate-600 bg-white/80 border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft size={12} />กลับรายการสอบ
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
                      className="rounded-[1.5rem] p-4"
                      style={{ ...GLASS, background: 'rgba(255,255,255,0.82)' }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <p className="text-[13px] font-black text-slate-800 font-sukhumvit">
                          คะแนนนักเรียน: {selectedExam.title}
                        </p>
                        <span className="text-[11px] text-slate-400 font-sarabun">{selectedExamRows.length} คน</span>
                      </div>
                      <div className="rounded-2xl overflow-hidden border border-slate-100">
                        <div className="grid grid-cols-[2rem_1fr_6rem_6rem] gap-2 px-4 py-2 bg-slate-50">
                          <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit">#</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit">นักเรียน</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit text-center">สถานะ</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit text-center">คะแนน (%)</span>
                        </div>
                        <div className="divide-y divide-slate-100 bg-white/80">
                          {selectedExamRows.map((row, idx) => (
                            <div key={row.studentId} className="grid grid-cols-[2rem_1fr_6rem_6rem] gap-2 px-4 py-2.5 items-center">
                              <span className="text-[10px] font-bold text-slate-400 font-sukhumvit">{idx + 1}</span>
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-slate-800 font-sukhumvit truncate">{row.studentName}</p>
                                <p className="text-[9px] text-slate-400 font-sarabun">{row.studentCode}</p>
                              </div>
                              <span className="text-center">
                                {row.absent ? (
                                  <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-sukhumvit">ขาดสอบ</span>
                                ) : (
                                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-sukhumvit">เข้าสอบ</span>
                                )}
                              </span>
                              <span className="text-center text-[11px] font-black text-slate-700 font-sukhumvit">
                                {typeof row.score === 'number'
                                  ? `${Math.round(rawPointsToPercent(row.score, selectedExam.maxScore))}%`
                                  : '-'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        ) : activeTab === 'attendance' ? (
          /* ── Attendance Tab ── */
          gradeBook.isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
                <p className="text-[12px] text-slate-400 font-sarabun">กำลังโหลดข้อมูลคะแนนรวม...</p>
              </div>
            </div>
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
                yearStartDate={activeYear?.startDate ?? ''}
                yearEndDate={activeYear?.endDate ?? ''}
              />
            )
          )
        ) : (
          /* ── Table & Config Tabs ── */
          <>
            {/* Grade book */}
            {gradeBook.isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
                  <p className="text-[12px] text-slate-400 font-sarabun">กำลังโหลดข้อมูลคะแนนรวม...</p>
                </div>
              </div>
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
                        yearStartDate={activeYear?.startDate ?? ''}
                        yearEndDate={activeYear?.endDate ?? ''}
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
  );
}
