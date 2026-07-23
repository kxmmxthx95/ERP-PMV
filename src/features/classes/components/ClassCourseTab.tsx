import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  BookOpen, Zap, ChevronDown, Search,
  MoreHorizontal, UserMinus,
} from 'lucide-react';
import {
  HiOutlineLanguage,
  HiOutlineCalculator,
  HiOutlineBeaker,
  HiOutlineGlobeAsiaAustralia,
  HiOutlineHeart,
  HiOutlinePaintBrush,
  HiOutlineBriefcase,
  HiOutlineChatBubbleLeftRight,
  HiOutlineSparkles,
  HiOutlineBookOpen,
  HiPlus,
} from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import type { ClassRoom, EnrolledCourse } from '@/types/class';
import { SUBJECT_GROUP_CONFIG, type Department, type Subject, type SubjectGroupId } from '@/types/curriculum';
import { toast } from 'sonner';
import PasswordConfirmDialog from '@/features/auth/components/PasswordConfirmDialog';
import { logActivity } from '@/lib/activityLogger';
import { cn } from '@/lib/utils';

interface Props {
  classRoom: ClassRoom;
}

const THEME_COLORS: Record<string, string[]> = {
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

function getSubjectColors(subjectGroup?: string): string[] {
  const g = (subjectGroup || '').toLowerCase();
  if (g.includes('thai') || g.includes('ภาษาไทย')) return THEME_COLORS.rose;
  if (g.includes('math') || g.includes('คณิต')) return THEME_COLORS.blue;
  if (g.includes('science') || g.includes('วิทยา')) return THEME_COLORS.emerald;
  if (g.includes('social') || g.includes('สังคม')) return THEME_COLORS.orange;
  if (g.includes('health') || g.includes('pe') || g.includes('พลศึกษา')) return THEME_COLORS.red;
  if (g.includes('art') || g.includes('ศิลป')) return THEME_COLORS.purple;
  if (g.includes('career') || g.includes('งาน')) return THEME_COLORS.stone;
  if (g.includes('foreign') || g.includes('lang') || g.includes('ภาษา')) return THEME_COLORS.sky;
  return THEME_COLORS.gray;
}

function SubjectIcon({ subjectGroup, className, size = 18 }: { subjectGroup?: string; className?: string; size?: number }) {
  const g = (subjectGroup || '').toLowerCase();
  const props = { size, className: className || "text-white drop-shadow-sm" };

  if (g.includes('thai') || g.includes('ภาษาไทย')) return <HiOutlineLanguage {...props} />;
  if (g.includes('math') || g.includes('คณิต')) return <HiOutlineCalculator {...props} />;
  if (g.includes('science') || g.includes('วิทยา')) return <HiOutlineBeaker {...props} />;
  if (g.includes('social') || g.includes('สังคม')) return <HiOutlineGlobeAsiaAustralia {...props} />;
  if (g.includes('health') || g.includes('pe')) return <HiOutlineHeart {...props} />;
  if (g.includes('art') || g.includes('ศิลป')) return <HiOutlinePaintBrush {...props} />;
  if (g.includes('career') || g.includes('งาน')) return <HiOutlineBriefcase {...props} />;
  if (g.includes('foreign') || g.includes('lang') || g.includes('ภาษา')) return <HiOutlineChatBubbleLeftRight {...props} />;
  if (g.includes('activity') || g.includes('กิจกรรม')) return <HiOutlineSparkles {...props} />;
  return <HiOutlineBookOpen {...props} />;
}

function getGroupLabelThai(group?: string): string {
  if (!group) return SUBJECT_GROUP_CONFIG.other.name;

  const normalized = group.toLowerCase().trim();
  if (normalized in SUBJECT_GROUP_CONFIG) {
    return SUBJECT_GROUP_CONFIG[normalized as SubjectGroupId].name;
  }

  const g = normalized;
  if (g.includes('thai') || g.includes('ภาษาไทย')) return 'ภาษาไทย';
  if (g.includes('math') || g.includes('คณิต')) return 'คณิตศาสตร์';
  if (g.includes('science') || g.includes('วิทยา')) return 'วิทยาศาสตร์';
  if (g.includes('social') || g.includes('สังคม')) return 'สังคมศึกษาฯ';
  if (g.includes('health') || g.includes('pe') || g.includes('สุขศึกษา')) return 'สุขศึกษาและพลศึกษา';
  if (g.includes('art') || g.includes('ศิลป')) return 'ศิลปะ';
  if (g.includes('career') || g.includes('งาน')) return 'การงานอาชีพ';
  if (g.includes('foreign') || g.includes('lang') || g.includes('ต่างประเทศ')) return 'ภาษาต่างประเทศ';
  if (g.includes('activity') || g.includes('กิจกรรม')) return 'กิจกรรมพัฒนาผู้เรียน';
  return SUBJECT_GROUP_CONFIG.other.name;
}

const TABLE_SHELL = 'rounded-2xl border border-border bg-card overflow-hidden';
const TABLE_HEADER_CELL = 'text-[13px] font-black text-foreground font-sukhumvit whitespace-nowrap';
const COURSE_TABLE_GRID =
  'minmax(4.5rem, 0.75fr) minmax(0, 2fr) minmax(0, 1.1fr) minmax(3.5rem, 0.55fr) minmax(3.5rem, 0.55fr) minmax(0, 1.6fr)';
const MAX_COURSE_TEACHERS = 7;

export default function ClassCourseTab({ classRoom }: Props) {
  const { maps, subjects } = useCurriculum();
  const { versions, coursesByVersion, loadCoursesForVersion } = useCurriculumVersioned();
  const { year: activeSystemYear } = useActiveAcademicYear();
  const { teachers } = useTeacherManager();
  const { updateClass } = useClassroomManager();

  // Resolve the matching curriculum version for this classroom so we can
  // trigger the lazy course-load before the classSubjects memo runs.
  useEffect(() => {
    const academicYearId = classRoom.academicYearId || (classRoom as any).academicYear || activeSystemYear || '2568';
    const currentYearNum = parseInt(academicYearId);
    const classPackageId = (classRoom as any).curriculumPackageId || (classRoom as any).curriculumId;

    const isGradeMatch = (a?: string, b?: string) => {
      if (!a || !b) return true;
      const norm = (s: string) => s.trim().replace(/\s+/g, '').replace('ชั้น', '');
      const s1 = norm(a); const s2 = norm(b);
      return s1 === s2 || s1.includes(s2) || s2.includes(s1);
    };

    let target = versions.find(v => v.id === classPackageId);
    if (!target) {
      target = versions.find(v =>
        Number(v.year) === currentYearNum &&
        (isGradeMatch(v.assignedGrades?.[0], classRoom.gradeLevel) || !v.assignedGrades?.length)
      );
    }

    if (target && !coursesByVersion[target.id]) {
      loadCoursesForVersion(target.id);
    }
  }, [versions, coursesByVersion, classRoom, activeSystemYear, loadCoursesForVersion]);

  const initial = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const ec of classRoom.enrolledCourses ?? []) {
      if (!m[ec.subjectId]) m[ec.subjectId] = [];
      if (ec.teacherId && !m[ec.subjectId].includes(ec.teacherId)) {
        m[ec.subjectId].push(ec.teacherId);
      }
    }
    return m;
  }, [classRoom.enrolledCourses]);

  const [courseTeachers, setCourseTeachers] = useState<Record<string, string[]>>(initial);
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>((classRoom.semester || 1) as 1 | 2);
  const [isStampMode, setIsStampMode] = useState(false);
  const [selectedStampTeacherId, setSelectedStampTeacherId] = useState<string | null>(null);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [isTeacherPickerOpen, setIsTeacherPickerOpen] = useState(false);
  const [showClearTeachersModal, setShowClearTeachersModal] = useState(false);
  const [headerPortalTarget, setHeaderPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderPortalTarget(document.getElementById('course-header-portal'));
  }, []);

  useEffect(() => {
    const next: Record<string, string[]> = {};
    for (const ec of classRoom.enrolledCourses ?? []) {
      if (!ec.semester || ec.semester === selectedSemester) {
        if (!next[ec.subjectId]) next[ec.subjectId] = [];
        if (ec.teacherId && !next[ec.subjectId].includes(ec.teacherId)) {
          next[ec.subjectId].push(ec.teacherId);
        }
      }
    }
    setCourseTeachers(next);
  }, [classRoom.enrolledCourses, selectedSemester]);


  const classSubjects = useMemo((): Subject[] => {
    // 1. Resolve Department & Academic Year (same fallback as ClassStudentPanel)
    const dept = (classRoom.departmentId ||
      (classRoom.gradeLevel?.startsWith('อ') ? 'early' :
        classRoom.gradeLevel?.startsWith('ป') ? 'primary' : 'secondary')) as Department;

    const academicYearId = classRoom.academicYearId || (classRoom as any).academicYear || activeSystemYear || '2568';
    const currentYearNum = parseInt(academicYearId);
    const semester = selectedSemester;
    const semKey = semester === 1 ? 'semester1' : 'semester2';

    let curriculumSubjectIds: string[] = [];

    // Helper for robust grade matching
    const isGradeMatch = (curriculumGrade?: string, classroomGrade?: string) => {
      if (!curriculumGrade || !classroomGrade) return true;
      const normalize = (s: string) => s.trim().replace(/\s+/g, '').replace('ชั้น', '');
      const s1 = normalize(curriculumGrade);
      const s2 = normalize(classroomGrade);
      return s1 === s2 || s1.includes(s2) || s2.includes(s1);
    };

    // ── 2. Strategy A: Check Versioned Curriculum (Modern) ──
    // Priority: 1. curriculumPackageId from class, 2. Match by Year + Grade
    const classPackageId = (classRoom as any).curriculumPackageId || (classRoom as any).curriculumId;

    let activeVersion = versions.find(v => v.id === classPackageId);

    if (!activeVersion) {
      activeVersion = versions.find(v =>
        Number(v.year) === currentYearNum &&
        (isGradeMatch(v.assignedGrades?.[0], classRoom.gradeLevel) || !v.assignedGrades?.length)
      );
    }

    // ── Strategy A: Versioned Curriculum (Modern) → map CurriculumCourse directly to Subject shape ──
    if (activeVersion && coursesByVersion[activeVersion.id]) {
      const matchedCourses = coursesByVersion[activeVersion.id].filter(c =>
        isGradeMatch(c.gradeLevel, classRoom.gradeLevel) &&
        (Number(c.semester) === Number(semester) || !c.semester) &&
        !c.isRetired
      );

      if (matchedCourses.length > 0) {
        return matchedCourses
          .map(c => ({
            id: c.id,
            code: c.courseCode,
            name: c.courseName,
            credits: c.credit,
            hoursPerWeek: c.periodsPerWeek ?? 0,
            totalHours: c.totalHours ?? 0,
            department: (c.department || dept) as Department,
            gradeLevel: c.gradeLevel,
            subjectGroup: c.subjectGroup,
            category: (c.category === 'basic' ? 'core' : c.category === 'additional' ? 'added' : 'activity') as Subject['category'],
          } satisfies Subject))
          .sort((a, b) => (a.code || '').localeCompare(b.code || '', 'th', { numeric: true }));
      }
    }

    // ── Strategy B: Fallback to Curriculum Maps (Legacy) + subjects collection ──
    const ids = new Set<string>();
    for (const map of maps) {
      if (String(map.academicYear) === String(academicYearId)) {
        const sections = map.sections?.[dept] || {};
        const matchedGradeKey = Object.keys(sections).find(k => isGradeMatch(k, classRoom.gradeLevel));
        if (matchedGradeKey) {
          (sections[matchedGradeKey]?.[semKey] ?? []).forEach((id: string) => ids.add(id));
        }
      }
    }
    curriculumSubjectIds = Array.from(ids);

    const uniqueIds = Array.from(new Set(curriculumSubjectIds));
    return subjects
      .filter(s => uniqueIds.includes(s.id))
      .sort((a, b) => (a.code || '').localeCompare(b.code || '', 'th', { numeric: true }));
  }, [maps, subjects, versions, coursesByVersion, activeSystemYear, classRoom, selectedSemester]);

  const activeTeachers = useMemo(
    () => teachers.filter(t => t.status === 'active'),
    [teachers],
  );

  const hasAssignedTeachers = useMemo(
    () => Object.values(courseTeachers).some((ids) => ids.length > 0),
    [courseTeachers],
  );

  const setTeacherIds = async (subjectId: string, teacherIds: string[]) => {
    const nextTeachers = { ...courseTeachers, [subjectId]: teacherIds.slice(0, MAX_COURSE_TEACHERS) };
    setCourseTeachers(nextTeachers);

    try {
      const current = classRoom.enrolledCourses ?? [];
      const keepOtherSemesters = current.filter(ec => ec.semester && ec.semester !== selectedSemester);
      const semesterSubjectIds = Array.from(new Set(classSubjects.map(s => s.id)));
      const forCurrentSemester: EnrolledCourse[] = semesterSubjectIds.flatMap((sid) => {
        const tids = (nextTeachers[sid] || []).filter(Boolean).slice(0, MAX_COURSE_TEACHERS);
        if (tids.length === 0) {
          // Keep the subject enrolled, but explicitly mark as unassigned teacher.
          return [{ subjectId: sid, teacherId: '', semester: selectedSemester }];
        }
        return tids.map((tid) => ({ subjectId: sid, teacherId: tid, semester: selectedSemester }));
      });
      const enrolledCourses: EnrolledCourse[] = [...keepOtherSemesters, ...forCurrentSemester];
      await updateClass(classRoom.id, { enrolledCourses });
    } catch (e) {
      toast.error('บันทึกอัตโนมัติล้มเหลว');
      console.error('Auto-save failed:', e);
    }
  };

  const clearAllTeachers = async () => {
    const previousTeachers = courseTeachers;
    const clearedTeachers = Object.fromEntries(
      classSubjects.map((subject) => [subject.id, [] as string[]]),
    );
    setCourseTeachers(clearedTeachers);

    try {
      const current = classRoom.enrolledCourses ?? [];
      const keepOtherSemesters = current.filter(ec => ec.semester && ec.semester !== selectedSemester);
      const forCurrentSemester: EnrolledCourse[] = classSubjects.map((subject) => ({
        subjectId: subject.id,
        teacherId: '',
        semester: selectedSemester,
      }));
      await updateClass(classRoom.id, { enrolledCourses: [...keepOtherSemesters, ...forCurrentSemester] });
      await logActivity({
        action: 'clear_class_teachers',
        category: 'academic',
        status: 'success',
        targetId: classRoom.id,
        detail: `ล้างครูผู้สอนทั้งหมด เทอม ${selectedSemester} ห้อง ${classRoom.className}`,
        metadata: { semester: selectedSemester, subjectCount: classSubjects.length },
      });
      toast.success(`ล้างครูผู้สอน เทอม ${selectedSemester} เรียบร้อยแล้ว`);
    } catch (e) {
      setCourseTeachers(previousTeachers);
      toast.error('ล้างครูผู้สอนไม่สำเร็จ');
      console.error('Clear teachers failed:', e);
    }
  };

  if (classSubjects.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-52 gap-2 text-black/25 bg-white/40 rounded-2xl border border-black/5"
      >
        <BookOpen size={32} strokeWidth={1.5} className="opacity-30" />
        <p className="text-sm font-medium font-sukhumvit">ยังไม่มีรายวิชาในหลักสูตร</p>
        <p className="text-xs text-black/20 font-sarabun">กรุณาตั้งค่าหลักสูตรสำหรับ {classRoom.gradeLevel} ก่อน</p>
      </motion.div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 font-sukhumvit md:h-auto">
      {headerPortalTarget && createPortal(
        <div className={`relative flex w-full flex-1 flex-wrap items-center justify-end gap-3.5 ${isTeacherPickerOpen ? 'z-50' : 'z-20'}`}>
          <div className="flex w-full items-center justify-end gap-2 md:w-auto">
            {/* ── Stamp Mode Integration ── */}
            <div className="flex-1 md:flex-initial flex items-center h-9 bg-white/70 border border-black/[0.06] p-0.5 rounded-xl shadow-sm">
              {[1, 2].map((sem) => (
                <button
                  key={sem}
                  onClick={() => setSelectedSemester(sem as 1 | 2)}
                  className={`flex-1 md:flex-initial text-center h-8 px-4 rounded-lg text-[10px] font-black transition-all ${selectedSemester === sem
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-black/[0.04]'
                    }`}
                >
                  เทอม {sem}
                </button>
              ))}
            </div>

            {isStampMode && (
              <div className="relative">
                <button
                  onClick={() => setIsTeacherPickerOpen(!isTeacherPickerOpen)}
                  className="h-9 px-4 rounded-xl bg-blue-50 border border-blue-100 flex items-center gap-2.5 transition-all hover:bg-blue-100 group"
                >
                  <div className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold">
                    {selectedStampTeacherId ? teachers.find(t => t.id === selectedStampTeacherId)?.name.slice(0, 1) : '?'}
                  </div>
                  <span className="text-xs font-bold text-blue-600 font-sarabun">
                    {selectedStampTeacherId ? teachers.find(t => t.id === selectedStampTeacherId)?.name : 'เลือกครูที่จะสแตมป์'}
                  </span>
                  <MoreHorizontal size={14} className="text-blue-400 group-hover:text-blue-600" />
                </button>

                {isTeacherPickerOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsTeacherPickerOpen(false)} />
                    <div className="absolute top-full right-0 mt-2 z-50 w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-black/5 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      <div className="p-3 border-b border-black/5">
                        <input
                          autoFocus
                          placeholder="ค้นหาชื่อครู..."
                          value={teacherSearch}
                          onChange={e => setTeacherSearch(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 rounded-xl text-xs outline-none border border-transparent focus:border-blue-200 transition-all font-sarabun"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto py-1">
                        {teachers
                          .filter(t => t.name.toLowerCase().includes(teacherSearch.toLowerCase()))
                          .map(t => (
                            <button
                              key={t.id}
                              onClick={() => {
                                setSelectedStampTeacherId(t.id);
                                setIsTeacherPickerOpen(false);
                                setTeacherSearch('');
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-blue-50 transition-colors font-sarabun ${selectedStampTeacherId === t.id ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600'
                                }`}
                            >
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] text-white ${selectedStampTeacherId === t.id ? 'bg-blue-500' : 'bg-slate-300'}`}>
                                {t.name.slice(0, 1)}
                              </div>
                              <span>{t.name}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <Button
              onClick={() => setShowClearTeachersModal(true)}
              disabled={!hasAssignedTeachers}
              title="ล้างครูผู้สอนออกจากรายวิชาทั้งหมด"
              className={`w-9 h-9 p-0 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                hasAssignedTeachers
                  ? 'bg-white border border-rose-100 text-rose-500 hover:bg-rose-50 hover:border-rose-200'
                  : 'bg-white border border-black/5 text-slate-300 cursor-not-allowed'
              }`}
            >
              <UserMinus size={14} />
            </Button>

            <Button
              onClick={() => {
                setIsStampMode(!isStampMode);
                if (!isStampMode) setSelectedStampTeacherId(null);
              }}
              className={`w-9 h-9 p-0 rounded-xl flex items-center justify-center transition-all ${isStampMode
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 border-0'
                : 'bg-white border border-black/5 text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                }`}
            >
              <Zap size={14} className={isStampMode ? 'animate-pulse' : ''} />
            </Button>
          </div>
        </div>
        ,
        headerPortalTarget
      )}


      {/* Course list */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="relative z-10 flex min-h-0 flex-1 flex-col md:flex-none"
      >
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide pb-24 md:flex-none md:overflow-visible md:pb-0">
          <div className="flex flex-col gap-3">
            {/* Mobile */}
            <div className="flex flex-col gap-2.5 px-0.5 md:hidden">
              {classSubjects.map((subject, idx) => {
                const colors = getSubjectColors(subject.subjectGroup);
                const selectedTeacherIds = courseTeachers[subject.id] ?? [];
                const selectedTeachers = activeTeachers.filter(t => selectedTeacherIds.includes(t.id));
                return (
                  <CourseMobileCard
                    key={subject.id}
                    idx={idx}
                    subject={subject}
                    colors={colors}
                    teachers={activeTeachers}
                    selectedTeacherIds={selectedTeacherIds}
                    selectedTeachers={selectedTeachers}
                    isStampMode={isStampMode}
                    selectedStampTeacherId={selectedStampTeacherId}
                    onSelect={async (tid) => {
                      const current = courseTeachers[subject.id] ?? [];
                      if (!current.includes(tid) && current.length >= MAX_COURSE_TEACHERS) {
                        toast.error(`รายวิชานี้กำหนดครูได้สูงสุด ${MAX_COURSE_TEACHERS} คน`);
                        return;
                      }
                      const next = current.includes(tid) ? current.filter(id => id !== tid) : [...current, tid];
                      await setTeacherIds(subject.id, next);
                    }}
                    onClear={async () => setTeacherIds(subject.id, [])}
                  />
                );
              })}
            </div>

            {/* Desktop */}
            <div className={cn('hidden w-full md:block', TABLE_SHELL)}>
              <div
                className="grid w-full gap-3 border-b border-border bg-background px-4 py-3"
                style={{ gridTemplateColumns: COURSE_TABLE_GRID }}
              >
                <span className={TABLE_HEADER_CELL}>รหัส</span>
                <span className={TABLE_HEADER_CELL}>วิชา</span>
                <span className={TABLE_HEADER_CELL}>กลุ่มสาระ</span>
                <span className={cn(TABLE_HEADER_CELL, 'text-center')}>คาบ</span>
                <span className={cn(TABLE_HEADER_CELL, 'text-center')}>นก.</span>
                <span className={TABLE_HEADER_CELL}>ครูผู้สอน</span>
              </div>
              <div className="flex flex-col">
                {classSubjects.map((subject, idx) => {
                  const colors = getSubjectColors(subject.subjectGroup);
                  const selectedTeacherIds = courseTeachers[subject.id] ?? [];
                  const selectedTeachers = activeTeachers.filter(t => selectedTeacherIds.includes(t.id));
                  return (
                    <CourseTableRow
                      key={subject.id}
                      rowIndex={idx}
                      subject={subject}
                      colors={colors}
                      teachers={activeTeachers}
                      selectedTeacherIds={selectedTeacherIds}
                      selectedTeachers={selectedTeachers}
                      isStampMode={isStampMode}
                      selectedStampTeacherId={selectedStampTeacherId}
                      onSelect={async (tid) => {
                        const current = courseTeachers[subject.id] ?? [];
                        if (!current.includes(tid) && current.length >= MAX_COURSE_TEACHERS) {
                          toast.error(`รายวิชานี้กำหนดครูได้สูงสุด ${MAX_COURSE_TEACHERS} คน`);
                          return;
                        }
                        const next = current.includes(tid) ? current.filter(id => id !== tid) : [...current, tid];
                        await setTeacherIds(subject.id, next);
                      }}
                      onClear={async () => setTeacherIds(subject.id, [])}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

      </motion.div>

      <PasswordConfirmDialog
        open={showClearTeachersModal}
        onClose={() => setShowClearTeachersModal(false)}
        onVerified={clearAllTeachers}
        title="ล้างครูผู้สอนทั้งหมด"
        subtitle={`ยืนยันการล้างครูผู้สอนออกจากทุกรายวิชา เทอม ${selectedSemester} ห้อง ${classRoom.className}`}
        confirmLabel="ล้างครูผู้สอน"
      />
    </div>
  );
}

// ── Course table / mobile rows ────────────────────────────────────────────────

type CourseRowSharedProps = {
  subject: Subject;
  colors: string[];
  teachers: ReturnType<typeof useTeacherManager>['teachers'];
  selectedTeacherIds: string[];
  selectedTeachers: ReturnType<typeof useTeacherManager>['teachers'];
  isStampMode?: boolean;
  selectedStampTeacherId?: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
};

function CourseTeacherPicker({
  teachers,
  selectedTeacherIds,
  selectedTeachers,
  onSelect,
  onClear,
}: Pick<CourseRowSharedProps, 'teachers' | 'selectedTeacherIds' | 'selectedTeachers' | 'onSelect' | 'onClear'>) {
  const [open, setOpen] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [search, setSearch] = useState('');
  const canAddMore = selectedTeachers.length < MAX_COURSE_TEACHERS;

  const closePicker = () => {
    setOpen(false);
    setAddMode(false);
    setSearch('');
  };

  const openPicker = (mode: 'primary' | 'add') => {
    setAddMode(mode === 'add');
    setSearch('');
    setOpen(true);
  };

  const teacherPhoto = (teacherId: string, photoURL?: string) =>
    photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${teacherId}&backgroundColor=f8fafc`;

  const pickerTeachers = teachers.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (addMode) return !selectedTeacherIds.includes(t.id);
    return true;
  });

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {selectedTeachers.map((teacher) => (
        <div
          key={teacher.id}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onSelect(teacher.id);
          }}
          title={`${teacher.name} — ดับเบิลคลิกเพื่อนำออก`}
          className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted shadow-sm"
        >
          <img
            src={teacherPhoto(teacher.id, teacher.photoURL)}
            alt={teacher.name}
            className="h-full w-full object-cover"
          />
        </div>
      ))}

      {selectedTeachers.length === 0 && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted shadow-sm">
          <Search size={14} className="text-muted-foreground/40" />
        </div>
      )}

      <div className="relative min-w-0 flex-1">
        <div
          className={cn(
            'group/teacher relative flex w-full items-center gap-1 rounded-xl border px-2 py-1 text-left transition-all',
            open
              ? 'border-primary bg-card shadow-sm ring-2 ring-ring/10'
              : selectedTeachers.length > 0
                ? 'border-border bg-card/80 hover:border-primary/40'
                : 'border-border/60 bg-transparent hover:bg-muted/40',
          )}
        >
          <div className="min-w-0 flex-1">
            {open ? (
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={addMode ? 'ค้นหาครูเพิ่ม...' : 'ค้นหา...'}
                className="w-full truncate bg-transparent py-0.5 text-[11px] font-bold text-foreground outline-none placeholder:text-muted-foreground font-sarabun"
                autoFocus
              />
            ) : (
              <button
                type="button"
                onClick={() => openPicker('primary')}
                className="w-full truncate py-0.5 text-left text-[11px] font-bold text-foreground font-sukhumvit"
              >
                {selectedTeachers.length > 0 ? selectedTeachers.map(t => t.name).join(', ') : 'เลือกครูผู้สอน...'}
              </button>
            )}
          </div>
          <ChevronDown
            size={12}
            className={cn('shrink-0 text-muted-foreground transition-transform duration-300', open && 'rotate-180 text-primary')}
          />
        </div>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={closePicker} />
            <div className="absolute bottom-full left-0 right-0 z-50 mb-1.5 overflow-hidden rounded-xl border border-primary/20 bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-200">
              <div className="custom-scrollbar flex max-h-48 flex-col gap-0.5 overflow-y-auto p-1">
                {!addMode && (
                  <button
                    type="button"
                    onClick={() => { onClear(); closePicker(); }}
                    className={cn(
                      'w-full rounded-md border border-transparent px-2 py-1.5 text-left text-[10px] font-sarabun transition-colors hover:bg-muted/50',
                      selectedTeacherIds.length === 0 ? 'border-primary/20 bg-primary/5 font-bold text-primary' : 'text-muted-foreground',
                    )}
                  >
                    — ไม่ระบุครูผู้สอน
                  </button>
                )}

                {addMode && (
                  <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground font-sukhumvit">
                    เพิ่มครูผู้สอน ({selectedTeachers.length + 1}/{MAX_COURSE_TEACHERS})
                  </p>
                )}

                {search.length > 0 ? (
                  <>
                    {pickerTeachers.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { onSelect(t.id); closePicker(); }}
                        className={cn(
                          'group/item flex w-full items-center justify-between rounded-md border bg-card px-2 py-1 text-[10px] font-sarabun shadow-sm transition-all hover:border-primary/30 hover:shadow-md',
                          selectedTeacherIds.includes(t.id) ? 'border-primary ring-1 ring-primary/20' : 'border-border/60',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-muted shadow-inner">
                            <img
                              src={teacherPhoto(t.id, t.photoURL)}
                              alt={t.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <span className={cn('truncate', selectedTeacherIds.includes(t.id) ? 'font-bold text-primary' : 'text-foreground')}>
                            {t.name}
                          </span>
                        </div>
                        {selectedTeacherIds.includes(t.id) && (
                          <span className="shrink-0 rounded bg-primary px-1 py-0.5 text-[8px] font-black text-primary-foreground">
                            เลือก
                          </span>
                        )}
                      </button>
                    ))}
                    {pickerTeachers.length === 0 && (
                      <div className="px-3 py-6 text-center">
                        <p className="text-[10px] text-muted-foreground font-sarabun">ไม่พบรายชื่อครู</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="px-4 py-6 text-center">
                    <Search size={14} className="mx-auto mb-1.5 text-muted-foreground/30" />
                    <p className="text-[10px] text-muted-foreground font-sarabun">พิมพ์เพื่อค้นหาชื่อครู...</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {canAddMore && selectedTeachers.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openPicker('add');
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
          title="เพิ่มครูผู้สอน"
          aria-label="เพิ่มครูผู้สอน"
        >
          <HiPlus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function CourseTableRow({
  rowIndex,
  subject,
  colors,
  teachers,
  selectedTeacherIds,
  selectedTeachers,
  isStampMode,
  selectedStampTeacherId,
  onSelect,
  onClear,
}: CourseRowSharedProps & { rowIndex: number }) {
  const groupLabel = getGroupLabelThai(subject.subjectGroup);
  const isCurrentStampMatch = isStampMode && selectedStampTeacherId && selectedTeacherIds.includes(selectedStampTeacherId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: rowIndex * 0.015 }}
      onClick={() => {
        if (isStampMode && selectedStampTeacherId) onSelect(selectedStampTeacherId);
      }}
      className={cn(
        'grid w-full items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40',
        isStampMode && 'cursor-pointer',
        isCurrentStampMatch && 'bg-primary/5',
      )}
      style={{ gridTemplateColumns: COURSE_TABLE_GRID }}
    >
      <span className="truncate text-[13px] font-black text-foreground font-sukhumvit tabular-nums">
        {subject.code || '—'}
      </span>
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm"
          style={{ background: `linear-gradient(135deg, ${colors[1]} 0%, ${colors[0]} 100%)` }}
        >
          <SubjectIcon subjectGroup={subject.subjectGroup} size={16} />
        </div>
        <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit" title={subject.name}>
          {subject.name}
        </p>
      </div>
      <span className="truncate text-[13px] font-semibold text-muted-foreground font-sukhumvit">
        {groupLabel}
      </span>
      <span className="text-center text-[13px] font-semibold text-foreground font-sukhumvit tabular-nums">
        {subject.hoursPerWeek || 0}
      </span>
      <span className="text-center text-[13px] font-semibold text-foreground font-sukhumvit tabular-nums">
        {Number(subject.credits || 0).toFixed(1)}
      </span>
      <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
        <CourseTeacherPicker
          teachers={teachers}
          selectedTeacherIds={selectedTeacherIds}
          selectedTeachers={selectedTeachers}
          onSelect={onSelect}
          onClear={onClear}
        />
      </div>
    </motion.div>
  );
}

function CourseMobileCard({
  idx,
  subject,
  colors,
  teachers,
  selectedTeacherIds,
  selectedTeachers,
  isStampMode,
  selectedStampTeacherId,
  onSelect,
  onClear,
}: CourseRowSharedProps & { idx: number }) {
  const groupLabel = getGroupLabelThai(subject.subjectGroup);
  const isCurrentStampMatch = isStampMode && selectedStampTeacherId && selectedTeacherIds.includes(selectedStampTeacherId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.02 }}
      className="px-0.5 py-0.5"
    >
      <div
        onClick={() => {
          if (isStampMode && selectedStampTeacherId) onSelect(selectedStampTeacherId);
        }}
        className={cn(
          'rounded-2xl border border-border bg-card p-3',
          isStampMode && 'cursor-pointer',
          isCurrentStampMatch && 'bg-primary/5',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm"
              style={{ background: `linear-gradient(135deg, ${colors[1]} 0%, ${colors[0]} 100%)` }}
            >
              <SubjectIcon subjectGroup={subject.subjectGroup} size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black text-muted-foreground font-sukhumvit tabular-nums">
                {subject.code || '—'}
              </p>
              <p className="truncate text-[13px] font-bold text-foreground font-sukhumvit" title={subject.name}>
                {subject.name}
              </p>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground font-sukhumvit">
                {groupLabel}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground font-sukhumvit">
              {subject.hoursPerWeek || 0} คาบ
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary font-sukhumvit">
              {Number(subject.credits || 0).toFixed(1)} นก.
            </span>
          </div>
        </div>
        <div className="mt-2.5 border-t border-border pt-2" onClick={(e) => e.stopPropagation()}>
          <CourseTeacherPicker
            teachers={teachers}
            selectedTeacherIds={selectedTeacherIds}
            selectedTeachers={selectedTeachers}
            onSelect={onSelect}
            onClear={onClear}
          />
        </div>
      </div>
    </motion.div>
  );
}
