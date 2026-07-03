import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, MoreHorizontal, Phone, Mail, MapPin, BookOpen, Search, ChevronLeft, RotateCcw } from 'lucide-react';
import {
  HiPencil, HiTrash, HiPlus, HiCheck, HiXMark, HiArrowPathRoundedSquare,
  HiOutlineLanguage, HiOutlineCalculator, HiOutlineBeaker, HiOutlineGlobeAsiaAustralia,
  HiOutlineHeart, HiOutlinePaintBrush, HiOutlineBriefcase, HiOutlineChatBubbleLeftRight,
  HiOutlineSparkles, HiOutlineBookOpen
} from 'react-icons/hi2';

const SUBJECT_CATEGORY_STYLE = {
  basic: { bg: 'bg-sky-50', text: 'text-sky-600', dot: 'bg-sky-400', label: 'พื้นฐาน' },
  additional: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400', label: 'เพิ่มเติม' },
  activity: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400', label: 'กิจกรรม' },
} as const;

const SUBJECT_THEME_COLORS: Record<string, string[]> = {
  blue: ['#3b82f6', '#60a5fa', '#2563eb'],
  emerald: ['#10b981', '#34d399', '#059669'],
  sky: ['#0ea5e9', '#38bdf8', '#0284c7'],
  rose: ['#f43f5e', '#fb7185', '#e11d48'],
  orange: ['#f97316', '#fb923c', '#ea580c'],
  purple: ['#a855f7', '#c084fc', '#9333ea'],
  red: ['#ef4444', '#f87171', '#dc2626'],
  stone: ['#78716c', '#a8a29e', '#57534e'],
  gray: ['#6b7280', '#9ca3af', '#4b5563'],
};

function getSubjectCardColors(subjectGroup?: string): string[] {
  const g = (subjectGroup || '').toLowerCase();
  if (g.includes('thai') || g.includes('ภาษาไทย')) return SUBJECT_THEME_COLORS.rose;
  if (g.includes('math') || g.includes('คณิต')) return SUBJECT_THEME_COLORS.blue;
  if (g.includes('science') || g.includes('วิทยา')) return SUBJECT_THEME_COLORS.emerald;
  if (g.includes('social') || g.includes('สังคม')) return SUBJECT_THEME_COLORS.orange;
  if (g.includes('health') || g.includes('pe') || g.includes('พลศึกษา') || g.includes('สุขศึกษา')) return SUBJECT_THEME_COLORS.red;
  if (g.includes('art') || g.includes('ศิลป')) return SUBJECT_THEME_COLORS.purple;
  if (g.includes('career') || g.includes('งาน')) return SUBJECT_THEME_COLORS.stone;
  if (g.includes('foreign') || g.includes('lang') || g.includes('ภาษา') || g.includes('ต่างประเทศ')) return SUBJECT_THEME_COLORS.sky;
  return SUBJECT_THEME_COLORS.gray;
}

function SubjectCardIcon({ subjectGroup, className, size = 18 }: { subjectGroup?: string; className?: string; size?: number }) {
  const g = (subjectGroup || '').toLowerCase();
  const props = { size, className: className || "text-white drop-shadow-sm" };

  if (g.includes('thai') || g.includes('ภาษาไทย')) return <HiOutlineLanguage {...props} />;
  if (g.includes('math') || g.includes('คณิต')) return <HiOutlineCalculator {...props} />;
  if (g.includes('science') || g.includes('วิทยา')) return <HiOutlineBeaker {...props} />;
  if (g.includes('social') || g.includes('สังคม')) return <HiOutlineGlobeAsiaAustralia {...props} />;
  if (g.includes('health') || g.includes('pe') || g.includes('สุขศึกษา') || g.includes('พลศึกษา')) return <HiOutlineHeart {...props} />;
  if (g.includes('art') || g.includes('ศิลป')) return <HiOutlinePaintBrush {...props} />;
  if (g.includes('career') || g.includes('งาน')) return <HiOutlineBriefcase {...props} />;
  if (g.includes('foreign') || g.includes('lang') || g.includes('ต่างประเทศ') || g.includes('ภาษา')) return <HiOutlineChatBubbleLeftRight {...props} />;
  if (g.includes('activity') || g.includes('กิจกรรม')) return <HiOutlineSparkles {...props} />;
  return <HiOutlineBookOpen {...props} />;
}
import { toast } from 'sonner';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { SUBJECT_GROUP_CONFIG } from '@/types/curriculum';
import type { Department, Subject } from '@/types/curriculum';
import type { ClassRoom, EnrolledCourse } from '@/types/class';
import AddTeacherModal from './components/AddTeacherModal';
import TeacherFilterCapsule from './components/TeacherFilterCapsule';
import TeacherTransferModal, { swapHomeroomTeacherIds } from './components/TeacherTransferModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const DEPT_LABEL: Record<string, string> = {
  SECONDARY: 'มัธยมศึกษา',
  PRIMARY: 'ประถมศึกษา',
  EARLY: 'ปฐมวัย',
  KINDERGARTEN: 'ปฐมวัย',
  ACADEMIC: 'วิชาการ',
  ADMIN: 'บริหารงานทั่วไป',
  STUDENT_AFFAIRS: 'กิจการนักเรียน',
};

function formatDept(dept: string) {
  return DEPT_LABEL[dept?.toUpperCase()] || dept || '';
}

function normalizeDepartment(dept?: string | null) {
  const value = String(dept || '').trim().toLowerCase();
  if (value === 'kindergarten' || value === 'preschool') return 'early';
  return value;
}

function normalizeLoose(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function inferGradeLevel(rawGrade?: string, className?: string) {
  const direct = String(rawGrade || '').trim();
  if (direct) return direct;
  const fromClassName = String(className || '').trim();
  const match = fromClassName.match(/(?:^|\s)(อ\.\d|ป\.\d|ม\.\d)/);
  return match?.[1] || '';
}

function getClassRoom(cls: { roomNumber?: string; className?: string }) {
  const room = String(cls.roomNumber || '').trim();
  if (room) return room;
  const match = String(cls.className || '').match(/\/\s*([0-9]+)$/);
  return match?.[1] || '';
}

function resolveSubjectDetail(
  subjectId: string,
  allSubjects: { id: string; code?: string; name?: string; gradeLevel?: string; subjectGroup?: string; category?: string; department?: string; semester?: number; credits?: number; hoursPerWeek?: number }[],
  allVersionedCourses: { id: string; courseCode?: string; courseName?: string; gradeLevel?: string; subjectGroup?: string; category?: string; department?: string; semester?: number; credit?: number; periodsPerWeek?: number }[],
) {
  const repo = allSubjects.find((s) => s.id === subjectId || s.code === subjectId);
  if (repo) {
    return {
      ...repo,
      periodsPerWeek: repo.hoursPerWeek ?? 0,
    };
  }

  const vc = allVersionedCourses.find((c) => c.id === subjectId || c.courseCode === subjectId);
  if (!vc) return null;

  return {
    id: vc.id,
    code: vc.courseCode,
    name: vc.courseName,
    gradeLevel: vc.gradeLevel,
    subjectGroup: vc.subjectGroup,
    category: vc.category === 'basic' ? 'core' : vc.category === 'additional' ? 'added' : vc.category,
    department: vc.department,
    semester: vc.semester,
    credits: vc.credit || 0,
    periodsPerWeek: vc.periodsPerWeek ?? 0,
  };
}

function isGradeMatch(curriculumGrade?: string, classroomGrade?: string) {
  if (!curriculumGrade || !classroomGrade) return true;
  const normalize = (s: string) => s.trim().replace(/\s+/g, '').replace('ชั้น', '');
  const s1 = normalize(curriculumGrade);
  const s2 = normalize(classroomGrade);
  return s1 === s2 || s1.includes(s2) || s2.includes(s1);
}

/** Same subject resolution as ClassCourseTab — curriculum package for the class + semester */
function getRegisteredClassSubjects(
  classRoom: ClassRoom,
  semester: 1 | 2,
  versions: { id: string; year?: number; assignedGrades?: string[] }[],
  coursesByVersion: Record<string, { id: string; courseCode?: string; courseName?: string; gradeLevel?: string; subjectGroup?: string; category?: string; department?: string; semester?: number; credit?: number; periodsPerWeek?: number; totalHours?: number; isRetired?: boolean }[]>,
  maps: { academicYear?: string | number; sections?: Record<string, Record<string, { semester1?: string[]; semester2?: string[] }>> }[],
  subjects: Subject[],
  activeSystemYear?: string | null,
): Subject[] {
  const dept = (classRoom.departmentId ||
    (classRoom.gradeLevel?.startsWith('อ') ? 'early' :
      classRoom.gradeLevel?.startsWith('ป') ? 'primary' : 'secondary')) as Department;

  const academicYearId = classRoom.academicYearId || (classRoom as ClassRoom & { academicYear?: string }).academicYear || activeSystemYear || '2568';
  const currentYearNum = parseInt(String(academicYearId), 10);
  const semKey = semester === 1 ? 'semester1' : 'semester2';
  const classPackageId = (classRoom as ClassRoom & { curriculumPackageId?: string; curriculumId?: string }).curriculumPackageId
    || (classRoom as ClassRoom & { curriculumId?: string }).curriculumId;

  let activeVersion = versions.find((v) => v.id === classPackageId);
  if (!activeVersion) {
    activeVersion = versions.find((v) =>
      Number(v.year) === currentYearNum &&
      (isGradeMatch(v.assignedGrades?.[0], classRoom.gradeLevel) || !v.assignedGrades?.length),
    );
  }

  if (activeVersion && coursesByVersion[activeVersion.id]) {
    const matchedCourses = coursesByVersion[activeVersion.id].filter((c) =>
      isGradeMatch(c.gradeLevel, classRoom.gradeLevel) &&
      (Number(c.semester) === Number(semester) || !c.semester) &&
      !c.isRetired,
    );

    if (matchedCourses.length > 0) {
      return matchedCourses
        .map((c) => ({
          id: c.id,
          code: c.courseCode || '',
          name: c.courseName || '',
          credits: c.credit ?? 0,
          hoursPerWeek: c.periodsPerWeek ?? 0,
          totalHours: c.totalHours ?? 0,
          department: (c.department || dept) as Department,
          gradeLevel: c.gradeLevel,
          subjectGroup: c.subjectGroup,
          category: (c.category === 'basic' ? 'core' : c.category === 'additional' ? 'added' : 'activity') as Subject['category'],
        }) satisfies Subject)
        .sort((a, b) => (a.code || '').localeCompare(b.code || '', 'th', { numeric: true }));
    }
  }

  const ids = new Set<string>();
  for (const map of maps) {
    if (String(map.academicYear) === String(academicYearId)) {
      const sections = map.sections?.[dept] || {};
      const matchedGradeKey = Object.keys(sections).find((k) => isGradeMatch(k, classRoom.gradeLevel));
      if (matchedGradeKey) {
        (sections[matchedGradeKey]?.[semKey] ?? []).forEach((id: string) => ids.add(id));
      }
    }
  }

  return subjects
    .filter((s) => ids.has(s.id))
    .sort((a, b) => (a.code || '').localeCompare(b.code || '', 'th', { numeric: true }));
}

function getCategoryThaiLabel(category?: string) {
  const c = String(category || '').trim().toLowerCase();
  if (c === 'core' || c === 'basic') return 'วิชาพื้นฐาน';
  if (c === 'added' || c === 'additional') return 'วิชาเพิ่มเติม';
  if (c === 'elective') return 'วิชาเลือก';
  if (c === 'activity') return 'กิจกรรม';
  return category || 'ไม่ระบุ';
}

function getSubjectGroupThaiLabel(group?: string) {
  const g = String(group || '').trim();
  const key = g.toLowerCase() as keyof typeof SUBJECT_GROUP_CONFIG;
  if (SUBJECT_GROUP_CONFIG[key]?.name) return SUBJECT_GROUP_CONFIG[key].name;
  if (g === 'none') return 'ไม่ระบุ';
  return g || 'ไม่ระบุ';
}



export default function TeacherManager() {
  const {
    teachers,
    addTeacher,
    updateTeacher,
    deleteTeacher,
    allSubjects,
  } = useTeacherManager();

  const classMgr = useClassroomManager();
  const { updateClass } = classMgr;
  const { versions, coursesByVersion, loadCoursesForVersion } = useCurriculumVersioned();
  const { maps, subjects: curriculumSubjects } = useCurriculum();
  const { year: activeSystemYear } = useActiveAcademicYear();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDept, setSelectedDept] = useState('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isMdOrBelow, setIsMdOrBelow] = useState(() => window.innerWidth < 1024);
  const [isSubjectDrawerOpen, setIsSubjectDrawerOpen] = useState(false);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [drawerGradeFilter, setDrawerGradeFilter] = useState('all');
  const [drawerRoomFilter, setDrawerRoomFilter] = useState('all');
  const [drawerSemesterFilter, setDrawerSemesterFilter] = useState<'all' | '1' | '2'>('all');
  const [drawerGroupFilter, setDrawerGroupFilter] = useState('all');
  const [drawerCategoryFilter, setDrawerCategoryFilter] = useState('all');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const targetId = isMdOrBelow ? 'header-portal-center-mobile' : 'header-portal-filters';
    setPortalTarget(document.getElementById(targetId));
  }, [isMdOrBelow]);

  useEffect(() => {
    const handleResize = () => setIsMdOrBelow(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ensure versioned curriculum courses are loaded so assigned subject cards can resolve properly.
  useEffect(() => {
    if (!classMgr.allClasses.length || !versions.length) return;

    const versionIds = new Set<string>();
    classMgr.allClasses.forEach((cls) => {
      const pkgId = (cls as any).curriculumPackageId || (cls as any).curriculumId;
      if (pkgId) versionIds.add(String(pkgId));
    });

    versionIds.forEach((versionId) => {
      const exists = versions.some(v => v.id === versionId);
      if (!exists) return;
      if (!coursesByVersion[versionId]) {
        loadCoursesForVersion(versionId);
      }
    });
  }, [classMgr.allClasses, versions, coursesByVersion, loadCoursesForVersion]);

  const departments = useMemo(() => ['ทั้งหมด', 'early', 'primary', 'secondary'], []);

  const isFilterActive = selectedDept !== 'ทั้งหมด' || searchQuery.trim().length > 0;

  const filteredTeachers = useMemo(() => {
    if (!isFilterActive) return [];

    const selected = normalizeDepartment(selectedDept);
    let list = selectedDept === 'ทั้งหมด'
      ? teachers
      : teachers.filter((t) => normalizeDepartment(t.department) === selected);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => t.name?.toLowerCase().includes(q) || t.position?.toLowerCase().includes(q));
    }
    return list;
  }, [teachers, selectedDept, searchQuery, isFilterActive]);

  useEffect(() => {
    if (isFilterActive && !isMdOrBelow) {
      if (filteredTeachers.length > 0) {
        const isCurrentTeacherInFilter = filteredTeachers.some(t => t.id === selectedId);
        if (!isCurrentTeacherInFilter) {
          setSelectedId(filteredTeachers[0].id);
        }
      } else {
        setSelectedId(null);
      }
    }
  }, [isFilterActive, filteredTeachers, selectedId, isMdOrBelow]);

  const selectedTeacher = teachers.find(t => t.id === selectedId) || null;

  useEffect(() => {
    if (!isSubjectDrawerOpen) return;
    setSubjectSearchQuery('');
    setDrawerGradeFilter('all');
    setDrawerRoomFilter('all');
    setDrawerSemesterFilter('all');
    setDrawerGroupFilter('all');
    setDrawerCategoryFilter('all');
  }, [isSubjectDrawerOpen, selectedTeacher?.id]);

  const capsuleElement = (
    <TeacherFilterCapsule
      departments={departments}
      selectedDept={selectedDept}
      onDepartmentChange={setSelectedDept}
      onAdd={() => { setIsEditing(false); setModalOpen(true); }}
      searchTerm={searchQuery}
      onSearchChange={setSearchQuery}
      isSearchMode={isSearchMode}
      onSearchModeChange={setIsSearchMode}
    />
  );

  const teacherSubjects = useMemo(() => {
    if (!selectedTeacher) return [];
    const assignedLoads: any[] = [];
    const allVersionedCourses = Object.values(coursesByVersion).flat();
    const teacherIds = new Set(
      [selectedTeacher.id, selectedTeacher.userId]
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
    );
    const seenClassSubjectKeys = new Set<string>();

    const resolveSubject = (subjectId: string) =>
      resolveSubjectDetail(subjectId, allSubjects, allVersionedCourses);

    classMgr.allClasses.forEach(cls => {
      (cls.enrolledCourses || []).forEach(ec => {
        if (!teacherIds.has(String(ec.teacherId || '').trim())) return;

        const classSubjectKey = `${cls.id}-${ec.subjectId}`;
        if (seenClassSubjectKeys.has(classSubjectKey)) return;
        seenClassSubjectKeys.add(classSubjectKey);

        const subject = resolveSubject(ec.subjectId);
        if (subject) {
          assignedLoads.push({
            ...subject,
            id: `${cls.id}-${subject.id}`,
            originalSubjectId: subject.id,
            className: cls.className || cls.roomNumber || '-',
            workload: subject.credits || 0,
            periodsPerWeek: subject.periodsPerWeek ?? 0,
          });
        }
      });
    });

    // Fallback: include direct teacher assignments even if not yet stamped to any class
    const coveredSubjectIds = new Set(
      assignedLoads.map(s => String(s.originalSubjectId || s.id)),
    );
    (selectedTeacher.teachingSubjectIds || []).forEach((subjectId) => {
      if (coveredSubjectIds.has(String(subjectId))) return;
      const subject = resolveSubject(subjectId);
      if (!subject) return;
      assignedLoads.push({
        ...subject,
        id: `direct-${subject.id}`,
        originalSubjectId: subject.id,
        className: 'ยังไม่ผูกห้องเรียน',
        workload: subject.credits || 0,
        periodsPerWeek: subject.periodsPerWeek ?? 0,
      });
    });

    return assignedLoads;
  }, [selectedTeacher, allSubjects, classMgr.allClasses, coursesByVersion]);

  const weeklyPeriodsSummary = useMemo(
    () => teacherSubjects.reduce((sum, subject) => sum + Number(subject.periodsPerWeek ?? 0), 0),
    [teacherSubjects],
  );

  const handleTransferHomeroom = useCallback(async ({
    classIds,
    incomingTeacherId,
  }: {
    classIds: string[];
    incomingTeacherId: string;
  }) => {
    if (!selectedTeacher) return;
    const incomingTeacher = teachers.find((t) => t.id === incomingTeacherId);
    if (!incomingTeacher) throw new Error('Incoming teacher not found');

    for (const classId of classIds) {
      const cls = classMgr.allClasses.find((c) => c.id === classId);
      if (!cls) continue;

      const currentIds = cls.homeroomTeacherIds?.length
        ? cls.homeroomTeacherIds
        : cls.homeroomTeacherId
          ? [cls.homeroomTeacherId]
          : [];

      const nextIds = swapHomeroomTeacherIds(currentIds, selectedTeacher, incomingTeacher);
      await updateClass(classId, {
        homeroomTeacherIds: nextIds,
        homeroomTeacherId: nextIds[0] ?? '',
      });
    }
  }, [selectedTeacher, teachers, classMgr.allClasses, updateClass]);

  const drawerClasses = classMgr.allClasses || [];

  const selectedDrawerClass = useMemo(() => {
    if (drawerGradeFilter === 'all' || drawerRoomFilter === 'all') return null;
    return drawerClasses.find((cls) =>
      normalizeLoose(inferGradeLevel(cls.gradeLevel, cls.className)) === normalizeLoose(drawerGradeFilter) &&
      getClassRoom(cls) === drawerRoomFilter,
    ) ?? null;
  }, [drawerClasses, drawerGradeFilter, drawerRoomFilter]);

  const enrolledDrawerSubjects = useMemo(() => {
    if (!selectedDrawerClass) return [];

    const semesters: (1 | 2)[] = drawerSemesterFilter === 'all' ? [1, 2] : [Number(drawerSemesterFilter) as 1 | 2];
    const enrolled = selectedDrawerClass.enrolledCourses ?? [];
    const rows: {
      id: string;
      originalSubjectId: string;
      classId: string;
      code: string;
      name: string;
      gradeLevel: string;
      className: string;
      roomNumber: string;
      subjectGroup: string;
      category: string;
      semester: 1 | 2;
      enrolledTeacherIds: string[];
    }[] = [];

    for (const sem of semesters) {
      const classSubjects = getRegisteredClassSubjects(
        selectedDrawerClass,
        sem,
        versions,
        coursesByVersion,
        maps,
        curriculumSubjects,
        activeSystemYear,
      );

      for (const subject of classSubjects) {
        const teacherIds = enrolled
          .filter((ec) => ec.subjectId === subject.id && ec.semester === sem && ec.teacherId)
          .map((ec) => String(ec.teacherId).trim())
          .filter((tid, idx, arr) => tid && arr.indexOf(tid) === idx);

        rows.push({
          id: `${selectedDrawerClass.id}-${subject.id}-${sem}`,
          originalSubjectId: subject.id,
          classId: selectedDrawerClass.id,
          code: subject.code || subject.id,
          name: subject.name || 'Unknown Subject',
          gradeLevel: inferGradeLevel(selectedDrawerClass.gradeLevel, selectedDrawerClass.className),
          className: String(selectedDrawerClass.className || '').trim(),
          roomNumber: getClassRoom(selectedDrawerClass),
          subjectGroup: subject.subjectGroup || 'other',
          category: subject.category || 'core',
          semester: sem,
          enrolledTeacherIds: teacherIds,
        });
      }
    }

    return rows.sort((a, b) =>
      String(a.code || '').localeCompare(String(b.code || ''), 'th', { numeric: true }),
    );
  }, [
    selectedDrawerClass,
    drawerSemesterFilter,
    versions,
    coursesByVersion,
    maps,
    curriculumSubjects,
    activeSystemYear,
  ]);

  const availableDrawerGrades = useMemo(
    () => Array.from(new Set(
      drawerClasses
        .map((cls) => inferGradeLevel(cls.gradeLevel, cls.className))
        .filter(Boolean),
    )).sort((a, b) => a.localeCompare(b, 'th', { numeric: true })),
    [drawerClasses],
  );

  const availableDrawerRooms = useMemo(() => {
    const targetGrade = normalizeLoose(drawerGradeFilter);
    return Array.from(new Set(
      drawerClasses
        .filter((cls) => drawerGradeFilter === 'all' || normalizeLoose(inferGradeLevel(cls.gradeLevel, cls.className)) === targetGrade)
        .map((cls) => getClassRoom(cls))
        .filter(Boolean),
    )).sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
  }, [drawerClasses, drawerGradeFilter]);

  const availableDrawerGroups = useMemo(
    () => Array.from(new Set(enrolledDrawerSubjects.map((s: any) => String(s.subjectGroup || '').trim()).filter(Boolean))).sort(),
    [enrolledDrawerSubjects],
  );

  const availableDrawerCategories = useMemo(
    () => Array.from(new Set(enrolledDrawerSubjects.map((s: any) => String(s.category || '').trim()).filter(Boolean))).sort(),
    [enrolledDrawerSubjects],
  );

  const drawerSubjects = useMemo(() => {
    if (!selectedDrawerClass) return [];

    const q = subjectSearchQuery.trim().toLowerCase();
    return enrolledDrawerSubjects.filter((s: any) => {
      const groupPass = drawerGroupFilter === 'all' || normalizeLoose(s.subjectGroup) === normalizeLoose(drawerGroupFilter);
      const categoryPass = drawerCategoryFilter === 'all' || normalizeLoose(s.category) === normalizeLoose(drawerCategoryFilter);
      const semesterPass =
        drawerSemesterFilter === 'all' ||
        String(s.semester) === drawerSemesterFilter;
      const textPass = !q ||
        String(s.name || '').toLowerCase().includes(q) ||
        String(s.code || '').toLowerCase().includes(q);
      return groupPass && categoryPass && semesterPass && textPass;
    });
  }, [
    selectedDrawerClass,
    enrolledDrawerSubjects,
    drawerGroupFilter,
    drawerCategoryFilter,
    drawerSemesterFilter,
    subjectSearchQuery,
  ]);

  const handleToggleDrawerSubject = useCallback(async (subject: {
    originalSubjectId: string;
    semester: 1 | 2;
    enrolledTeacherIds: string[];
  }) => {
    if (!selectedTeacher || !selectedDrawerClass) return;

    const semester = subject.semester;

    const subjectId = subject.originalSubjectId;
    const teacherKeys = new Set(
      [selectedTeacher.id, selectedTeacher.userId].filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
    );
    const canonicalTeacherId = selectedTeacher.userId || selectedTeacher.id;
    const isCurrentlyAssigned = subject.enrolledTeacherIds.some((tid) => teacherKeys.has(tid));

    const current = selectedDrawerClass.enrolledCourses ?? [];
    const keepOthers = current.filter(
      (ec) => !(ec.subjectId === subjectId && ec.semester === semester),
    );

    const otherTeacherIds = current
      .filter((ec) => ec.subjectId === subjectId && ec.semester === semester && ec.teacherId && !teacherKeys.has(ec.teacherId))
      .map((ec) => ec.teacherId!)
      .slice(0, 2);

    let nextTeacherIds: string[];
    if (isCurrentlyAssigned) {
      nextTeacherIds = otherTeacherIds;
    } else if (otherTeacherIds.length >= 2) {
      toast.error('วิชานี้มีครูครบ 2 คนแล้ว');
      return;
    } else {
      nextTeacherIds = [...otherTeacherIds, canonicalTeacherId];
    }

    const forThisSubject: EnrolledCourse[] = nextTeacherIds.length === 0
      ? [{ subjectId, teacherId: '', semester: semester as 1 | 2 }]
      : nextTeacherIds.map((teacherId) => ({ subjectId, teacherId, semester: semester as 1 | 2 }));

    try {
      await updateClass(selectedDrawerClass.id, {
        enrolledCourses: [...keepOthers, ...forThisSubject],
      });
    } catch (error) {
      console.error('Failed to assign subject from drawer:', error);
      toast.error('บันทึกการมอบหมายวิชาล้มเหลว');
    }
  }, [selectedTeacher, selectedDrawerClass, updateClass]);

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {portalTarget && createPortal(
        capsuleElement,
        portalTarget
      )}

      <div className="flex h-full w-full bg-transparent pb-4 gap-4 font-sukhumvit flex-1 overflow-visible">

        {/* ── LEFT PANEL — Detail View ── */}
        {(!isMdOrBelow || selectedId !== null) && (
          <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-visible bg-transparent border-0 p-0 shadow-none">
        <AnimatePresence mode="wait">
          {!isFilterActive ? (
            <div className="flex-1 flex flex-col items-center justify-center rounded-3xl lg:rounded-[2rem] bg-white/70 lg:bg-white/30 backdrop-blur-xl border border-white/50 lg:border-white/70 p-6 text-slate-300">
              <Search size={64} className="opacity-10 mb-4" />
              <p className="text-sm font-black opacity-30 uppercase tracking-widest">เลือกตัวกรองเพื่อเริ่มต้น</p>
            </div>
          ) : selectedTeacher ? (
            <motion.div
              key={selectedTeacher.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex flex-col gap-4 h-full min-h-0 overflow-visible"
            >
              {/* CARD 1: ข้อมูลส่วนตัว (Personal Info) */}
              <div className="relative rounded-3xl lg:rounded-[2rem] bg-white/70 lg:bg-white/30 backdrop-blur-xl border border-white/50 lg:border-white/70 p-4 md:p-6 shadow-lg shadow-black/[0.02] shrink-0">
                {/* Mobile Back Button: Absolute position in the top-right corner, icon only */}
                {isMdOrBelow && (
                  <button
                    onClick={() => setSelectedId(null)}
                    className="absolute top-3.5 right-3.5 w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 bg-white/60 backdrop-blur-md border border-slate-200/60 shadow-sm rounded-full transition-all active:scale-95 cursor-pointer z-20"
                    title="กลับรายชื่อครู"
                  >
                    <ChevronLeft size={16} strokeWidth={3} />
                  </button>
                )}
                {/* Apple Music Style Hero Header */}
                <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-start">
                  
                  {/* Top section on mobile: Image + Name/Position + Edit/Delete side-by-side */}
                  <div className="flex md:contents gap-3.5 items-center w-full">
                    {/* Profile Image */}
                    <div className="w-16 h-16 md:w-48 md:h-48 rounded-full md:rounded-xl overflow-hidden shadow-[0_8px_25px_-10px_rgba(0,0,0,0.25)] shrink-0 group relative transition-all duration-500 hover:shadow-[0_12px_30px_-12px_rgba(0,0,0,0.3)] hover:-translate-y-1">
                      <img
                        src={selectedTeacher.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedTeacher.id}`}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        alt={selectedTeacher.name}
                      />
                      <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors pointer-events-none" />
                    </div>

                    {/* Name, Position, and Buttons stacked vertically on mobile but side-by-side with photo */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h2 className="text-base md:text-2xl font-bold text-slate-900 tracking-tight leading-snug mb-0.5 md:mb-1">
                        {selectedTeacher.name}
                      </h2>
                      <p className="text-[12px] md:text-lg font-bold text-blue-600 mb-1.5 md:mb-4">
                        {selectedTeacher.position || 'ครูผู้สอน'}
                      </p>

                      {/* Action Buttons — icon only, white background */}
                      <div className="flex items-center gap-1.5">
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setIsSubjectDrawerOpen(true)}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/60 bg-white/80 text-blue-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-blue-700 shrink-0 cursor-pointer"
                          title="เพิ่มรายวิชา"
                          aria-label="เพิ่มรายวิชา"
                        >
                          <HiPlus className="h-4 w-4" />
                        </motion.button>

                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { setIsEditing(true); setModalOpen(true); }}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/60 bg-white/80 text-slate-500 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-slate-800 shrink-0"
                          title="แก้ไขข้อมูล"
                          aria-label="แก้ไขข้อมูล"
                        >
                          <HiPencil className="h-4 w-4" />
                        </motion.button>

                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setTransferModalOpen(true)}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/60 bg-white/80 text-slate-500 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-indigo-600 shrink-0"
                          title="โอนสิทธิ์การทำงาน"
                          aria-label="โอนสิทธิ์การทำงาน"
                        >
                          <HiArrowPathRoundedSquare className="h-4 w-4" />
                        </motion.button>

                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setDeleteConfirmOpen(true)}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/60 bg-white/80 text-slate-500 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-rose-600 shrink-0"
                          title="ลบข้อมูล"
                          aria-label="ลบข้อมูล"
                        >
                          <HiTrash className="h-4 w-4" />
                        </motion.button>
                      </div>
                    </div>
                  </div>

                  {/* Compact Info Rows (under profile card on mobile, next to it on desktop) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-2 md:mt-0 bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50 w-full md:w-fit self-stretch md:self-auto shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                        <MapPin size={11} className="text-slate-400" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-600">{formatDept(selectedTeacher.department)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                        <Phone size={11} className="text-slate-400" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-600">{selectedTeacher.phone || '-'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                        <Mail size={11} className="text-slate-400" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 truncate max-w-[220px]">{selectedTeacher.email || '-'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 shadow-sm">
                        <BookOpen size={11} className="text-indigo-500" />
                      </div>
                      <span className="text-[11px] font-black text-indigo-700">
                        {weeklyPeriodsSummary} คาบ/สัปดาห์
                        {teacherSubjects.length > 0 && (
                          <span className="font-bold text-indigo-400"> · {teacherSubjects.length} วิชา</span>
                        )}
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* CARD 2: รายวิชาที่ได้รับมอบหมาย (Assigned Subjects) */}
              <div className="flex-1 min-h-0 flex flex-col bg-transparent md:bg-white/70 lg:bg-white/30 backdrop-blur-none md:backdrop-blur-xl border-0 md:border md:border-white/50 lg:border-white/70 p-0 md:p-6 shadow-none md:shadow-lg md:shadow-black/[0.02] rounded-none md:rounded-3xl lg:rounded-[2rem] overflow-hidden">
                <h3 className="hidden md:flex text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.18em] md:tracking-[0.2em] mb-2.5 md:mb-4 items-center gap-1.5 md:gap-2 shrink-0">
                  <BookOpen size={14} className="text-blue-500" />
                  วิชาที่รับผิดชอบ
                </h3>
                
                <div className="flex-1 overflow-y-auto scrollbar-hide pb-2 min-h-0">
                  {teacherSubjects.length === 0 ? (
                    <div className="min-h-[180px] p-6 text-center flex flex-col items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-slate-100/60 flex items-center justify-center mx-auto mb-2">
                        <BookOpen size={20} className="text-slate-200" />
                      </div>
                      <p className="text-[11px] text-slate-400 font-bold">ยังไม่มีข้อมูลวิชาที่สอนในระบบ</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                      {teacherSubjects.map((subject, idx) => {
                        const colors = getSubjectCardColors(subject.subjectGroup);
                        const catStyle = SUBJECT_CATEGORY_STYLE[subject.category as keyof typeof SUBJECT_CATEGORY_STYLE] || SUBJECT_CATEGORY_STYLE.basic;

                        return (
                          <motion.div
                            key={subject.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(idx * 0.02, 0.24) }}
                            className="group flex items-center gap-2.5 p-2.5 bg-white hover:bg-slate-50 border border-slate-100 hover:border-blue-200 rounded-xl transition-all cursor-default shadow-sm hover:shadow-md"
                          >
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm transition-all"
                              style={{
                                background: `linear-gradient(135deg, ${colors[1]} 0%, ${colors[0]} 100%)`,
                              }}
                            >
                              <SubjectCardIcon subjectGroup={subject.subjectGroup} size={16} />
                            </div>

                            <div className="flex-1 flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                                <span className="text-[11px] md:text-[12px] font-bold text-slate-800 transition-colors group-hover:text-blue-600 truncate">
                                  {subject.name}
                                </span>
                                <span className={`inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${catStyle.bg} ${catStyle.text}`}>
                                  <span className={`w-1 h-1 rounded-full ${catStyle.dot}`} />
                                  {catStyle.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded uppercase tracking-tighter truncate max-w-[72px]">
                                  {subject.code}
                                </span>
                                <span className="text-[9px] font-bold text-blue-500 bg-blue-50/50 px-1.5 py-0.5 rounded truncate">
                                  {subject.className}
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100/50">
                              <span className="text-[8px] text-blue-600 font-bold">คาบ</span>
                              <span className="text-[11px] font-black text-blue-800">{Number(subject.periodsPerWeek ?? 0)}</span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center rounded-3xl lg:rounded-[2rem] bg-white/70 lg:bg-white/30 backdrop-blur-xl border border-white/50 lg:border-white/70 p-6 text-slate-300">
              <Users size={64} className="opacity-10 mb-4" />
              <p className="text-sm font-black opacity-30 uppercase tracking-widest">เลือกครูเพื่อดูรายละเอียด</p>
            </div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* ── RIGHT PANEL — Teacher List ── */}
      {(!isMdOrBelow || selectedId === null) && (
        <div className="w-full lg:w-[250px] xl:w-[320px] shrink-0 flex flex-col bg-transparent lg:bg-white/30 backdrop-blur-none lg:backdrop-blur-xl border-0 lg:border lg:border-white/70 p-0 lg:p-3 shadow-none lg:shadow-lg lg:shadow-black/[0.02] rounded-none lg:rounded-[2rem]">

        {/* Teacher List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col pt-1">
          <AnimatePresence>
            {!isFilterActive ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 rounded-2xl">
                <Search size={28} className="mb-3 opacity-30" />
                <span className="text-xs font-bold text-center px-2">เลือกตัวกรองเพื่อดูรายชื่อครู</span>
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-slate-400 opacity-50 rounded-2xl border border-slate-200/80 bg-white/65">
                <Search size={22} className="mb-2" />
                <span className="text-xs font-bold">ไม่พบรายชื่อ</span>
              </div>
            ) : (
              filteredTeachers.map((t) => {
                const isActive = selectedId === t.id;
                return (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedId(t.id)}
                    className={`group relative flex items-center transition-all cursor-pointer mx-1 my-1.5 ${isActive
                        ? 'bg-blue-600 text-white rounded-2xl p-2.5 pl-1.5 pr-4 z-10 border border-blue-500 shadow-md shadow-blue-500/10'
                        : 'p-2 pl-1.5 pr-4 bg-white/70 border border-slate-200/70 hover:bg-slate-50/90 rounded-xl'
                      }`}
                  >
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-xl overflow-hidden shadow-sm shrink-0 transition-all duration-300 ${isActive ? 'bg-white p-0.5' : 'bg-slate-100 group-hover:scale-105'}`}>
                        <img
                          src={t.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${t.id}&backgroundColor=f8fafc`}
                          alt="avatar"
                          className="w-full h-full object-cover rounded-[10px]"
                        />
                      </div>

                      {/* Name & Position */}
                      <div className="flex-1 flex flex-col min-w-0">
                        <h4 className={`text-[13px] font-bold truncate tracking-tight block ${isActive ? 'text-white' : 'text-slate-900'}`}>
                          {t.name}
                        </h4>
                        <p className={`text-[10px] font-medium tracking-tight ${isActive ? 'text-blue-100/70' : 'text-slate-400'}`}>
                          {t.position || 'ครูผู้สอน'} · {formatDept(t.department)}
                        </p>
                      </div>

                      {/* Right side - Simplified for Minimalist Look */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isActive ? null : (
                          <MoreHorizontal size={14} className="text-slate-300 group-hover:text-slate-400" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
      )}

        {/* ── Modal ── */}
        <AddTeacherModal
          open={modalOpen}
          editingTeacher={isEditing ? selectedTeacher : null}
          onClose={() => { setModalOpen(false); setIsEditing(false); }}
          onSubmit={addTeacher}
          onUpdate={updateTeacher}
          onDelete={deleteTeacher}
        />

        <TeacherTransferModal
          open={transferModalOpen}
          outgoingTeacher={selectedTeacher}
          teachers={teachers}
          classes={classMgr.allClasses}
          onClose={() => setTransferModalOpen(false)}
          onTransferHomeroom={handleTransferHomeroom}
        />

        {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isSubjectDrawerOpen && selectedTeacher && (
            <>
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSubjectDrawerOpen(false)}
                className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-[2px]"
                aria-label="ปิด"
              />

              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                className="fixed inset-y-0 right-0 z-[130] flex h-full w-full max-w-full flex-col bg-white shadow-2xl"
              >
                {(() => {
                  const isRoomStepComplete = drawerGradeFilter !== 'all' && drawerRoomFilter !== 'all';
                  return (
                    <>
                      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 md:px-6">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                            เพิ่มรายวิชา
                          </p>
                          <h3 className="truncate text-base font-black text-slate-800 md:text-lg">
                            {selectedTeacher.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSubjectSearchQuery('');
                              setDrawerGradeFilter('all');
                              setDrawerRoomFilter('all');
                              setDrawerSemesterFilter('all');
                              setDrawerGroupFilter('all');
                              setDrawerCategoryFilter('all');
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                            title="ล้างตัวกรอง"
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsSubjectDrawerOpen(false)}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                            title="ปิด"
                          >
                            <HiXMark className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex min-h-0 flex-1 flex-col px-4 py-4 md:px-6">
                        <input
                          value={subjectSearchQuery}
                          onChange={(e) => setSubjectSearchQuery(e.target.value)}
                          placeholder="ค้นหารหัสหรือชื่อวิชา..."
                          disabled={!isRoomStepComplete}
                          className="mb-3 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                        />

                        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                          <select
                            value={drawerGradeFilter}
                            onChange={(e) => {
                              setDrawerGradeFilter(e.target.value);
                              setDrawerRoomFilter('all');
                            }}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700"
                          >
                            <option value="all">เลือก ระดับชั้น</option>
                            {availableDrawerGrades.map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>

                          <select
                            value={drawerRoomFilter}
                            onChange={(e) => setDrawerRoomFilter(e.target.value)}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700"
                          >
                            <option value="all">ทุกห้อง</option>
                            {availableDrawerRooms.map((r) => (
                              <option key={r} value={r}>ห้อง {r}</option>
                            ))}
                          </select>

                          <select
                            value={drawerSemesterFilter}
                            onChange={(e) => setDrawerSemesterFilter(e.target.value as 'all' | '1' | '2')}
                            disabled={!isRoomStepComplete}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="all">ทุกเทอม</option>
                            <option value="1">เทอม 1</option>
                            <option value="2">เทอม 2</option>
                          </select>

                          <select
                            value={drawerGroupFilter}
                            onChange={(e) => setDrawerGroupFilter(e.target.value)}
                            disabled={!isRoomStepComplete}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="all">ทุกกลุ่มสาระ</option>
                            {availableDrawerGroups.map((g) => (
                              <option key={g} value={g}>{getSubjectGroupThaiLabel(g)}</option>
                            ))}
                          </select>

                          <select
                            value={drawerCategoryFilter}
                            onChange={(e) => setDrawerCategoryFilter(e.target.value)}
                            disabled={!isRoomStepComplete}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="all">ทุกหมวดวิชา</option>
                            {availableDrawerCategories.map((c) => (
                              <option key={c} value={c}>{getCategoryThaiLabel(c)}</option>
                            ))}
                          </select>
                        </div>

                        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 pb-4">
                          {drawerSubjects.map((subject: any) => {
                            const teacherKeys = new Set(
                              [selectedTeacher.id, selectedTeacher.userId].filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
                            );
                            const isSelected = (subject.enrolledTeacherIds || []).some((tid: string) => teacherKeys.has(tid));
                            const colors = getSubjectCardColors(subject.subjectGroup);
                            const catStyle = SUBJECT_CATEGORY_STYLE[subject.category as keyof typeof SUBJECT_CATEGORY_STYLE] || SUBJECT_CATEGORY_STYLE.basic;
                            return (
                              <button
                                key={subject.id}
                                type="button"
                                onClick={() => handleToggleDrawerSubject(subject)}
                                className={`w-full rounded-2xl border p-3 text-left transition-all ${
                                  isSelected
                                    ? 'border-blue-200 bg-blue-50/70'
                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                                    style={{ background: `linear-gradient(135deg, ${colors[1]} 0%, ${colors[0]} 100%)` }}
                                  >
                                    <SubjectCardIcon subjectGroup={subject.subjectGroup} />
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                      <p className="truncate text-[13px] font-bold text-slate-800">{subject.name}</p>
                                      {isSelected && (
                                        <span className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white shadow-sm">
                                          มอบหมายแล้ว
                                        </span>
                                      )}
                                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${catStyle.bg} ${catStyle.text}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
                                        {catStyle.label}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                        {subject.code || '-'}
                                      </span>
                                      {subject.gradeLevel && (
                                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                          {subject.gradeLevel}
                                        </span>
                                      )}
                                      {subject.semester && (
                                        <span className="text-[11px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
                                          เทอม {subject.semester}
                                        </span>
                                      )}
                                      {subject.className && (
                                        <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
                                          ห้อง {subject.className}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <span className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300'}`}>
                                    <HiCheck className="h-4 w-4" />
                                  </span>
                                </div>
                              </button>
                            );
                          })}

                          {drawerSubjects.length === 0 && (
                            <p className="py-10 text-center text-xs font-semibold text-slate-400">
                              {(!isRoomStepComplete)
                                ? 'กรุณาเลือกระดับชั้นและห้องก่อนแสดงรายวิชา'
                                : selectedDrawerClass && enrolledDrawerSubjects.length === 0
                                  ? 'ยังไม่มีรายวิชาในหลักสูตรสำหรับห้องนี้ กรุณาตั้งค่าที่เมนูจัดการห้องเรียน'
                                  : 'ไม่พบรายวิชาตามเงื่อนไขที่เลือก'}
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
        )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-sm rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-2xl backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogMedia className="mb-1 bg-rose-50 text-rose-500">
              <HiTrash className="size-8" />
            </AlertDialogMedia>
            <AlertDialogTitle className="text-lg font-bold text-slate-800">
              ยืนยันการลบข้อมูล
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500">
              คุณต้องการลบรายชื่อ{' '}
              <span className="font-bold text-slate-800">{selectedTeacher?.name}</span>{' '}
              ออกจากระบบหรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 gap-2 sm:gap-2">
            <AlertDialogCancel className="h-11 flex-1 rounded-2xl border-slate-200 font-bold text-slate-600">
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 flex-1 rounded-2xl bg-rose-600 font-bold text-white hover:bg-rose-700"
              onClick={async () => {
                if (!selectedTeacher) return;
                try {
                  await deleteTeacher(selectedTeacher.id);
                  setSelectedId(null);
                  toast.success('ลบข้อมูลครูเรียบร้อยแล้ว');
                } catch {
                  toast.error('ไม่สามารถลบข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
                }
              }}
            >
              ลบข้อมูล
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
