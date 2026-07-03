import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  BookOpen, Zap, BarChart3, Users, ChevronDown, Search,
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
} from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import type { ClassRoom, EnrolledCourse } from '@/types/class';
import type { Department, Subject } from '@/types/curriculum';
import { CATEGORY_CONFIG } from '@/types/curriculum';
import { toast } from 'sonner';
import PasswordConfirmDialog from '@/features/auth/components/PasswordConfirmDialog';
import { logActivity } from '@/lib/activityLogger';

interface Props {
  classRoom: ClassRoom;
  cfg: { bg: string; color: string; label: string };
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
  const g = (group || '').toLowerCase();
  if (g.includes('thai') || g.includes('ภาษาไทย')) return 'ภาษาไทย';
  if (g.includes('math') || g.includes('คณิต')) return 'คณิตศาสตร์';
  if (g.includes('science') || g.includes('วิทยา')) return 'วิทยาศาสตร์';
  if (g.includes('social') || g.includes('สังคม')) return 'สังคมศึกษาฯ';
  if (g.includes('health') || g.includes('pe') || g.includes('สุขศึกษา')) return 'สุขศึกษาและพลศึกษา';
  if (g.includes('art') || g.includes('ศิลป')) return 'ศิลปะ';
  if (g.includes('career') || g.includes('งาน')) return 'การงานอาชีพ';
  if (g.includes('foreign') || g.includes('lang') || g.includes('ต่างประเทศ')) return 'ภาษาต่างประเทศ';
  if (g.includes('activity') || g.includes('กิจกรรม')) return 'กิจกรรมพัฒนาผู้เรียน';
  return group || 'อื่นๆ';
}

export default function ClassCourseTab({ classRoom, cfg }: Props) {
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

  const courseSummary = useMemo(() => {
    let total = 0;
    let basic = 0;
    let additional = 0;
    let activity = 0;

    classSubjects.forEach(s => {
      const cr = Number(s.credits || 0);
      const cat = (s.category || '').toLowerCase();

      total += cr;
      if (cat === 'core' || cat === 'basic' || cat.includes('พื้นฐาน')) {
        basic += cr;
      } else if (cat === 'added' || cat === 'additional' || cat.includes('เพิ่มเติม')) {
        additional += cr;
      } else if (cat === 'activity' || cat.includes('กิจกรรม')) {
        activity++;
      }
    });

    return { total, basic, additional, activity };
  }, [classSubjects]);

  const activeTeachers = useMemo(
    () => teachers.filter(t => t.status === 'active'),
    [teachers],
  );

  const hasAssignedTeachers = useMemo(
    () => Object.values(courseTeachers).some((ids) => ids.length > 0),
    [courseTeachers],
  );

  const setTeacherIds = async (subjectId: string, teacherIds: string[]) => {
    const nextTeachers = { ...courseTeachers, [subjectId]: teacherIds.slice(0, 2) };
    setCourseTeachers(nextTeachers);

    try {
      const current = classRoom.enrolledCourses ?? [];
      const keepOtherSemesters = current.filter(ec => ec.semester && ec.semester !== selectedSemester);
      const semesterSubjectIds = Array.from(new Set(classSubjects.map(s => s.id)));
      const forCurrentSemester: EnrolledCourse[] = semesterSubjectIds.flatMap((sid) => {
        const tids = (nextTeachers[sid] || []).filter(Boolean).slice(0, 2);
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
    <div className="flex flex-col gap-4 h-full font-sukhumvit">
      {headerPortalTarget && createPortal(
        <div className={`flex flex-wrap items-center justify-between gap-3.5 relative ${isTeacherPickerOpen ? 'z-50' : 'z-20'} w-full flex-1`}>
          {/* Left: Stats (Full-width on mobile, auto on desktop) */}
          <div className="w-full md:w-auto flex items-center justify-between md:justify-start gap-1.5">
            <div className="flex items-center justify-center flex-1 md:flex-initial gap-1 px-2.5 py-1 rounded-full bg-indigo-50/90 border border-indigo-100/60 shadow-sm">
              <BarChart3 size={12} className="text-indigo-500 shrink-0" />
              <span className="text-[11px] font-black text-indigo-700">{courseSummary.total.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-center flex-1 md:flex-initial gap-1 px-2.5 py-1 rounded-full bg-blue-50/90 border border-blue-100/60 shadow-sm">
              <BookOpen size={12} className="text-blue-500 shrink-0" />
              <span className="text-[11px] font-black text-blue-700">{courseSummary.basic.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-center flex-1 md:flex-initial gap-1 px-2.5 py-1 rounded-full bg-amber-50/90 border border-amber-100/60 shadow-sm">
              <Zap size={12} className="text-amber-500 shrink-0" />
              <span className="text-[11px] font-black text-amber-700">{courseSummary.additional.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-center flex-1 md:flex-initial gap-1 px-2.5 py-1 rounded-full bg-emerald-50/90 border border-emerald-100/60 shadow-sm">
              <Users size={12} className="text-emerald-500 shrink-0" />
              <span className="text-[11px] font-black text-emerald-700">{courseSummary.activity}</span>
            </div>
          </div>

          {/* Right: Term Selector & Zap stamp button (Full-width on mobile, auto on desktop) */}
          <div className="w-full md:w-auto flex items-center gap-2 justify-between md:justify-end">
            {/* ── Stamp Mode Integration ── */}
            <div className="flex-1 md:flex-initial flex items-center h-9 bg-white/70 border border-black/[0.06] p-0.5 rounded-full shadow-sm">
              {[1, 2].map((sem) => (
                <button
                  key={sem}
                  onClick={() => setSelectedSemester(sem as 1 | 2)}
                  className={`flex-1 md:flex-initial text-center h-8 px-4 rounded-full text-[10px] font-black transition-all ${selectedSemester === sem
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
        className="flex-1 min-h-0 flex flex-col relative z-10"
      >
        {/* Cards Grid Container */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-40">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-1.5 md:p-3">
            {classSubjects.map((subject, idx) => {
              const catCfg = CATEGORY_CONFIG[subject.category];
              const colors = getSubjectColors(subject.subjectGroup);
              const selectedTeacherIds = courseTeachers[subject.id] ?? [];
              const selectedTeachers = activeTeachers.filter(t => selectedTeacherIds.includes(t.id));
              return (
                <CourseCard
                  key={subject.id}
                  idx={idx + 1}
                  subject={subject}
                  catCfg={catCfg}
                  colors={colors}
                  cfg={cfg}
                  classRoom={classRoom}
                  teachers={activeTeachers}
                  rowIndex={idx}
                  selectedTeacherIds={selectedTeacherIds}
                  selectedTeachers={selectedTeachers}
                  isStampMode={isStampMode}
                  selectedStampTeacherId={selectedStampTeacherId}
                  onSelect={async (tid) => {
                    const current = courseTeachers[subject.id] ?? [];
                    if (!current.includes(tid) && current.length >= 2) {
                      toast.error('รายวิชานี้กำหนดครูได้สูงสุด 2 คน');
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

// ── Course Card ────────────────────────────────────────────────────────────────

interface CourseCardProps {
  idx: number;
  rowIndex: number;
  subject: Subject;
  catCfg: { label: string; color: string; bg: string };
  colors: string[];
  cfg: { bg: string; color: string };
  classRoom: ClassRoom;
  teachers: ReturnType<typeof useTeacherManager>['teachers'];
  selectedTeacherIds: string[];
  selectedTeachers: ReturnType<typeof useTeacherManager>['teachers'];
  isStampMode?: boolean;
  selectedStampTeacherId?: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}

function CourseCard({
  subject, colors, teachers,
  rowIndex, selectedTeacherIds, selectedTeachers, isStampMode, selectedStampTeacherId, onSelect, onClear
}: CourseCardProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = teachers.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const groupLabel = getGroupLabelThai(subject.subjectGroup);

  const isCurrentStampMatch = isStampMode && selectedStampTeacherId && selectedTeacherIds.includes(selectedStampTeacherId);

  return (
      <div
        onClick={() => {
          if (isStampMode && selectedStampTeacherId) {
            onSelect(selectedStampTeacherId);
          }
        }}
        className={`group relative flex flex-col justify-between p-3.5 rounded-2xl border border-slate-200 transition-all duration-200 cursor-pointer ${open ? 'z-40 bg-white shadow-lg border-blue-200 ring-2 ring-blue-500/5' : 'z-10'
          } ${isCurrentStampMatch
            ? 'bg-blue-50/80 border-blue-200 shadow-sm shadow-blue-100/50'
            : rowIndex % 2 === 0
              ? 'bg-white/90 hover:border-slate-200 hover:shadow-sm'
              : 'bg-white/60 hover:border-slate-200 hover:shadow-sm'
          }`}
      >
      {/* Top Section: Icon, Badges */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${colors[1]} 0%, ${colors[0]} 100%)`,
            }}
          >
            <SubjectIcon subjectGroup={subject.subjectGroup} size={16} />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-black font-mono tracking-tighter text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-black/[0.02] uppercase block w-max">
              {subject.code}
            </span>
          </div>
        </div>

        {/* Hour / Credit Badges */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {subject.hoursPerWeek || 0} คาบ
          </span>
          <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">
            {Number(subject.credits || 0).toFixed(1)} นก.
          </span>
        </div>
      </div>

      {/* Middle Section: Subject Name & Group */}
      <div className="my-2.5 min-w-0">
        <h3 className="text-[12.5px] font-black text-slate-800 leading-snug truncate" title={subject.name}>
          {subject.name}
        </h3>
        <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
          {groupLabel}
        </p>
      </div>

      {/* Bottom Section: Teacher Picker Dropdown */}
      <div className="flex items-center gap-2 pt-2.5 border-t border-black/[0.03]">
        {/* Avatar */}
        <div
          onDoubleClick={(e) => {
            if (selectedTeachers[0]) {
              e.stopPropagation();
              onSelect(selectedTeachers[0].id);
            }
          }}
          title="ดับเบิลคลิกเพื่อลบครูผู้สอน"
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden bg-slate-100 shadow-sm border border-black/[0.03]"
        >
          {selectedTeachers[0] ? (
            <img
              src={selectedTeachers[0].photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedTeachers[0].id}&backgroundColor=f8fafc`}
              alt="teacher"
              className="w-full h-full object-cover"
            />
          ) : (
            <Search size={14} className="text-slate-300" />
          )}
        </div>

        {/* Dropdown Input Wrapper */}
        <div className="relative flex-1 min-w-0">
          <div
            className={`group/teacher flex items-center gap-1 px-2 py-1 rounded-xl transition-all w-full text-left border relative ${open ? 'bg-white shadow-sm border-blue-500 ring-2 ring-blue-500/10' :
                selectedTeachers.length > 0
                  ? 'border-black/[0.06] hover:border-blue-400 bg-white/50'
                  : 'border-black/[0.03] hover:bg-blue-50/50 bg-transparent'
              }`}
          >
            <div className="flex-1 min-w-0">
              {open ? (
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหา..."
                  className="w-full bg-transparent text-[10px] font-bold outline-none placeholder:text-slate-400 text-slate-800 font-sarabun truncate py-0.5"
                  autoFocus
                />
              ) : (
                <div
                  onClick={() => { setOpen(true); setSearch(''); }}
                  className="w-full bg-transparent text-[10px] font-bold text-slate-800 font-sarabun truncate cursor-pointer py-0.5"
                >
                  {selectedTeachers.length > 0 ? selectedTeachers.map(t => t.name).join(', ') : 'เลือกครูผู้สอน...'}
                </div>
              )}
            </div>
            <ChevronDown
              size={10}
              className={`text-slate-300 transition-transform duration-300 shrink-0 ${open ? 'rotate-180 text-blue-500' : ''}`}
            />
          </div>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(''); }} />
              <div
                className="absolute bottom-full left-0 right-0 mb-1.5 z-50 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-200"
                style={{
                  background: 'white',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                }}
              >
                <div className="max-h-48 overflow-y-auto custom-scrollbar p-1 flex flex-col gap-0.5">
                  <button
                    onClick={() => { onClear(); setOpen(false); setSearch(''); }}
                    className={`w-full text-left px-2 py-1.5 rounded-md text-[9px] hover:bg-slate-50 transition-colors font-sarabun border border-transparent ${selectedTeacherIds.length === 0 ? 'text-blue-600 font-bold bg-blue-50/50 border-blue-100 shadow-sm' : 'text-slate-400'
                      }`}
                  >
                    — ไม่ระบุครูผู้สอน
                  </button>

                  {search.length > 0 ? (
                    <>
                      {filtered.map(t => (
                        <button
                          key={t.id}
                          onClick={() => { onSelect(t.id); setOpen(false); setSearch(''); }}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-[9.5px] bg-white border shadow-sm transition-all hover:border-blue-200 hover:shadow-md font-sarabun group/item ${selectedTeacherIds.includes(t.id) ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-black/[0.03]'
                            }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-5.5 h-5.5 rounded-full overflow-hidden bg-slate-100 shadow-inner flex-shrink-0">
                              <img
                                src={t.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${t.id}&backgroundColor=f8fafc`}
                                alt="teacher"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className={`truncate ${selectedTeacherIds.includes(t.id) ? 'text-blue-600 font-bold' : 'text-slate-700'}`}>
                              {t.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {selectedTeacherIds.includes(t.id) && (
                              <span className="px-1 py-0.5 rounded bg-blue-500 text-white text-[7px] font-black">
                                เลือก
                              </span>
                            )}
                            <span className="px-1 py-0.5 rounded bg-blue-50 text-blue-500 text-[6.5px] font-black tracking-wider">
                              {(t as any).personalId || t.id.slice(-4).toUpperCase()}
                            </span>
                          </div>
                        </button>
                      ))}
                      {filtered.length === 0 && (
                        <div className="px-3 py-6 text-center">
                          <p className="text-[9.5px] text-slate-400 font-sarabun">ไม่พบรายชื่อครู</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-6 px-4 text-center">
                      <Search size={14} className="mx-auto mb-1.5 text-slate-200" />
                      <p className="text-[10px] text-slate-400 font-sarabun">พิมพ์เพื่อค้นหาชื่อครู...</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
