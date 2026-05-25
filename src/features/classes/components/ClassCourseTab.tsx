import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, Zap, BarChart3, Users, ChevronDown, Search,
  Languages, Calculator, Atom, Globe, HeartPulse, Palette, Briefcase, MessageSquare, Sparkles, MoreHorizontal
} from 'lucide-react';
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

  if (g.includes('thai') || g.includes('ภาษาไทย')) return <Languages {...props} />;
  if (g.includes('math') || g.includes('คณิต')) return <Calculator {...props} />;
  if (g.includes('science') || g.includes('วิทยา')) return <Atom {...props} />;
  if (g.includes('social') || g.includes('สังคม')) return <Globe {...props} />;
  if (g.includes('health') || g.includes('pe')) return <HeartPulse {...props} />;
  if (g.includes('art') || g.includes('ศิลป')) return <Palette {...props} />;
  if (g.includes('career') || g.includes('งาน')) return <Briefcase {...props} />;
  if (g.includes('foreign') || g.includes('lang') || g.includes('ภาษา')) return <MessageSquare {...props} />;
  if (g.includes('activity') || g.includes('กิจกรรม')) return <Sparkles {...props} />;
  return <BookOpen {...props} />;
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
    const m: Record<string, string> = {};
    for (const ec of classRoom.enrolledCourses ?? []) {
      m[ec.subjectId] = ec.teacherId;
    }
    return m;
  }, [classRoom.enrolledCourses]);

  const [courseTeachers, setCourseTeachers] = useState<Record<string, string>>(initial);
  const [isStampMode, setIsStampMode] = useState(false);
  const [selectedStampTeacherId, setSelectedStampTeacherId] = useState<string | null>(null);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [isTeacherPickerOpen, setIsTeacherPickerOpen] = useState(false);
  const classSubjects = useMemo((): Subject[] => {
    // 1. Resolve Department & Academic Year (same fallback as ClassStudentPanel)
    const dept = (classRoom.departmentId ||
      (classRoom.gradeLevel?.startsWith('อ') ? 'early' :
        classRoom.gradeLevel?.startsWith('ป') ? 'primary' : 'secondary')) as Department;

    const academicYearId = classRoom.academicYearId || (classRoom as any).academicYear || activeSystemYear || '2568';
    const currentYearNum = parseInt(academicYearId);
    const semester = classRoom.semester || 1;
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
  }, [maps, subjects, versions, coursesByVersion, activeSystemYear, classRoom]);

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

  const setTeacher = async (subjectId: string, teacherId: string) => {
    const nextTeachers = { ...courseTeachers, [subjectId]: teacherId };
    setCourseTeachers(nextTeachers);

    try {
      const enrolledCourses: EnrolledCourse[] = Object.entries(nextTeachers)
        .filter(([, tid]) => tid)
        .map(([sid, tid]) => ({ subjectId: sid, teacherId: tid }));
      await updateClass(classRoom.id, { enrolledCourses });
    } catch (e) {
      toast.error('บันทึกอัตโนมัติล้มเหลว');
      console.error('Auto-save failed:', e);
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
    <div className="flex flex-col gap-6 h-full">
      {/* ── Credit Summary Inline ── */}
      <div
        className={`flex flex-wrap items-center gap-x-8 gap-y-3 px-2 py-3 flex-shrink-0 relative ${isTeacherPickerOpen ? 'z-50' : 'z-20'}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-sm">
            <BarChart3 size={14} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5 font-sarabun">หน่วยกิตรวม</span>
            <span className="text-[14px] font-black text-slate-700 leading-none">{courseSummary.total.toFixed(1)}</span>
          </div>
        </div>

        <div className="w-px h-6 bg-black/[0.04] hidden md:block" />

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shadow-sm">
            <BookOpen size={14} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5 font-sarabun">วิชาพื้นฐาน</span>
            <span className="text-[14px] font-black text-slate-700 leading-none">{courseSummary.basic.toFixed(1)}</span>
          </div>
        </div>

        <div className="w-px h-6 bg-black/[0.04] hidden md:block" />

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500 shadow-sm">
            <Zap size={14} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5 font-sarabun">วิชาเพิ่มเติม</span>
            <span className="text-[14px] font-black text-slate-700 leading-none">{courseSummary.additional.toFixed(1)}</span>
          </div>
        </div>

        <div className="w-px h-6 bg-black/[0.04] hidden md:block" />

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 shadow-sm">
            <Users size={14} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5 font-sarabun">กิจกรรม</span>
            <span className="text-[14px] font-black text-slate-700 leading-none">{courseSummary.activity}</span>
          </div>
        </div>

        {/* ── Stamp Mode Integration ── */}
        <div className="ml-auto flex items-center gap-3">
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


      {/* Course list */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex-1 min-h-0 flex flex-col relative z-10"
      >
        {/* Header */}
        <div className="flex items-center px-6 py-3 border-b border-black/[0.05] bg-transparent sticky top-0 z-30">
          <div className="flex-1 min-w-0 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest font-sarabun">รายวิชา</div>
          <div className="w-72 shrink-0 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest font-sarabun">ผู้สอน</div>
          <div className="w-44 shrink-0 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest font-sarabun">กลุ่มสาระ</div>
          <div className="w-24 shrink-0 px-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest font-sarabun">คาบ</div>
          <div className="w-24 shrink-0 px-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest font-sarabun">หน่วยกิต</div>
        </div>

        {/* Rows */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col pb-40">
          {classSubjects.map((subject, idx) => {
            const catCfg = CATEGORY_CONFIG[subject.category];
            const colors = getSubjectColors(subject.subjectGroup);
            const selectedTeacherId = courseTeachers[subject.id] ?? '';
            const selectedTeacher = activeTeachers.find(t => t.id === selectedTeacherId);
            return (
              <CourseRow
                key={subject.id}
                idx={idx + 1}
                subject={subject}
                catCfg={catCfg}
                colors={colors}
                cfg={cfg}
                classRoom={classRoom}
                teachers={activeTeachers}
                selectedTeacherId={selectedTeacherId}
                selectedTeacher={selectedTeacher}
                isStampMode={isStampMode}
                selectedStampTeacherId={selectedStampTeacherId}
                onSelect={tid => setTeacher(subject.id, tid)}
              />
            );
          })}
        </div>

      </motion.div>
    </div>
  );
}

// ── Course Row ────────────────────────────────────────────────────────────────

interface CourseRowProps {
  idx: number;
  subject: Subject;
  catCfg: { label: string; color: string; bg: string };
  colors: string[];
  cfg: { bg: string; color: string };
  classRoom: ClassRoom;
  teachers: ReturnType<typeof useTeacherManager>['teachers'];
  selectedTeacherId: string;
  selectedTeacher: ReturnType<typeof useTeacherManager>['teachers'][number] | undefined;
  isStampMode?: boolean;
  selectedStampTeacherId?: string | null;
  onSelect: (id: string) => void;
}

function CourseRow({
  subject, colors, teachers,
  selectedTeacherId, selectedTeacher, isStampMode, selectedStampTeacherId, onSelect
}: CourseRowProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = teachers.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const groupLabel = getGroupLabelThai(subject.subjectGroup);

  const isCurrentStampMatch = isStampMode && selectedStampTeacherId && selectedTeacherId === selectedStampTeacherId;

  return (
    <div
      onClick={() => {
        if (isStampMode && selectedStampTeacherId) {
          onSelect(selectedStampTeacherId);
        }
      }}
      className={`group flex items-center px-6 py-2 border-b border-black/[0.03] hover:bg-slate-50/50 transition-all ${open ? 'z-50 bg-white/80 backdrop-blur-sm' : 'z-0'
        } relative ${isCurrentStampMatch ? 'bg-blue-50/40 ring-1 ring-blue-100/50 z-10' : ''
        }`}
    >
      {/* Subject Info (Song) */}
      <div className="flex-1 min-w-0 px-4 flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${colors[1]} 0%, ${colors[0]} 100%)`,
          }}
        >
          <SubjectIcon subjectGroup={subject.subjectGroup} />
        </div>
        <div className="flex flex-col min-w-0">
          <p className="text-[14px] font-bold text-slate-900 truncate leading-tight mb-1">
            {subject.name}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-tighter">
              {subject.code}
            </span>
          </div>
        </div>
      </div>

      {/* Teacher (Artist) */}
      <div className="w-72 shrink-0 px-6 relative flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-slate-100 shadow-sm border border-black/[0.03]">
          {selectedTeacher ? (
            <img
              src={selectedTeacher.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedTeacher.id}&backgroundColor=f8fafc`}
              alt="teacher"
              className="w-full h-full object-cover"
            />
          ) : (
            <Search size={18} className="text-slate-300" />
          )}
        </div>

        <div
          className={`group/teacher flex items-center gap-2 px-3 py-1.5 rounded-full transition-all flex-1 text-left border relative ${open ? 'bg-white shadow-sm border-blue-500 ring-2 ring-blue-500/10' :
              selectedTeacher
                ? 'border-black/[0.06] hover:border-blue-400'
                : 'border-black/[0.03] hover:bg-blue-50/50'
            }`}
        >
          <div className="flex-1 min-w-0">
            <input
              value={open ? search : (selectedTeacher?.name || '')}
              onChange={(e) => {
                setSearch(e.target.value);
                if (!open) setOpen(true);
              }}
              onFocus={() => {
                setOpen(true);
                setSearch('');
              }}
              placeholder="ค้นหาชื่อครู..."
              className="w-full bg-transparent text-[11px] font-bold outline-none placeholder:text-slate-300 text-slate-700 font-sarabun truncate"
            />
          </div>
          <ChevronDown
            size={12}
            className={`text-slate-300 transition-transform duration-300 ${open ? 'rotate-180 text-blue-500' : ''}`}
          />

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(''); }} />
              <div
                className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200"
                style={{
                  background: 'white',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                }}
              >
                <div className="max-h-56 overflow-y-auto custom-scrollbar p-1 flex flex-col gap-0.5">
                  <button
                    onClick={() => { onSelect(''); setOpen(false); setSearch(''); }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-[9px] hover:bg-slate-50 transition-colors font-sarabun border border-transparent ${!selectedTeacherId ? 'text-blue-600 font-bold bg-blue-50/50 border-blue-100 shadow-sm' : 'text-slate-400'}`}
                  >
                    — ไม่ระบุครูผู้สอน
                  </button>

                  {search.length > 0 ? (
                    <>
                      {filtered.map(t => (
                        <button
                          key={t.id}
                          onClick={() => { onSelect(t.id); setOpen(false); setSearch(''); }}
                          className={`w-full flex items-center justify-between px-2.5 py-1 rounded-md text-[10px] bg-white border shadow-sm transition-all hover:border-blue-200 hover:shadow-md font-sarabun group/item ${t.id === selectedTeacherId ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-black/[0.03]'
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-100 shadow-inner flex-shrink-0">
                              <img
                                src={t.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${t.id}&backgroundColor=f8fafc`}
                                alt="teacher"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className={`font-medium ${t.id === selectedTeacherId ? 'text-blue-600 font-bold' : 'text-slate-700'}`}>{t.name}</span>
                          </div>
                          <span className="px-1 py-0.5 rounded bg-blue-50 text-blue-500 text-[7px] font-black tracking-wider">
                            {(t as any).personalId || t.id.slice(-5).toUpperCase()}
                          </span>
                        </button>
                      ))}
                      {filtered.length === 0 && (
                        <div className="px-3 py-6 text-center">
                          <p className="text-[10px] text-slate-400 font-sarabun">ไม่พบรายชื่อครู</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-8 px-4 text-center">
                      <Search size={18} className="mx-auto mb-2 text-slate-200" />
                      <p className="text-[11px] text-slate-400 font-sarabun">พิมพ์เพื่อค้นหาชื่อครู...</p>
                    </div>
                  )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>

      {/* Group (Album) */}
      <div className="w-44 shrink-0 px-6">
        <p className="text-[13px] text-slate-500 font-sarabun truncate">
          {groupLabel}
        </p>
      </div>

      {/* Periods */}
      <div className="w-24 shrink-0 px-4 text-center">
        <p className="text-[14px] font-bold text-slate-600 font-sarabun">
          {subject.hoursPerWeek || 0}
        </p>
      </div>

      {/* Credits (Time) */}
      <div className="w-24 shrink-0 px-4 text-center">
        <p className="text-[14px] font-bold text-slate-700 font-sarabun">
          {Number(subject.credits || 0).toFixed(1)}
        </p>
      </div>

    </div>
  );
}
