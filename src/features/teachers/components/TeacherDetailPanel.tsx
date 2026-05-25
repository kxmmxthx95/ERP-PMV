import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Briefcase, Phone, Mail, Save, BookOpen, Trash2, Camera, BriefcaseBusiness } from 'lucide-react';
import type { TeacherProfile } from '@/types/teacher';
import type { Subject } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import { GLASS } from '@/components/layouts/PortalLayout';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';

const PREFIXES = ['นาย', 'นาง', 'นางสาว', 'ดร.', 'มาสเตอร์', 'มิส'];
const POSITIONS = ['ครูบรรจุ', 'ครูอัตราจ้าง', 'ครูพิเศษ'];

interface TeacherDetailPanelProps {
  open: boolean;
  teacher: TeacherProfile | null;
  allSubjects: Subject[];
  onClose: () => void;
  onUpdate: (data: Partial<TeacherProfile>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type TeacherAssignment = Pick<Subject, 'id' | 'name' | 'code' | 'credits'> & {
  className: string;
};

export default function TeacherDetailPanel({
  open,
  teacher,
  allSubjects,
  onClose,
  onUpdate,
  onDelete,
}: TeacherDetailPanelProps) {
  const classMgr = useClassroomManager();
  const { coursesByVersion } = useCurriculumVersioned();
  const [activeTab, setActiveTab] = useState<'profile' | 'workload'>('profile');
  const [formData, setFormData] = useState<Partial<TeacherProfile>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Sync form data when teacher changes
  useEffect(() => {
    if (teacher) {
      let p = teacher.prefix || '';
      let fn = teacher.firstName || '';
      let ln = teacher.lastName || '';

      if (!fn && teacher.name) {
        const parts = teacher.name.split(' ');
        const firstPart = parts[0] || '';
        const foundPrefix = PREFIXES.find(pref => firstPart.startsWith(pref));
        if (foundPrefix) {
          p = foundPrefix;
          fn = firstPart.replace(foundPrefix, '').trim();
        } else {
          fn = firstPart;
        }
        ln = parts.slice(1).join(' ');
      }

      setFormData({
        prefix: p,
        firstName: fn,
        lastName: ln,
        phone: teacher.phone,
        department: teacher.department,
        email: teacher.email,
        photoURL: teacher.photoURL,
        position: teacher.position || 'ครูบรรจุ',
      });
    }
  }, [teacher]);

  const realAssignments = useMemo(() => {
    if (!teacher) return [];

    const loads: TeacherAssignment[] = [];
    const allVersionedCourses = Object.values(coursesByVersion).flat();
    const teacherIds = new Set(
      [teacher.id, teacher.userId]
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
    );
    const seenClassSubjectKeys = new Set<string>();

    const resolveSubject = (subjectId: string) => {
      const repoSubject = allSubjects.find(s => s.id === subjectId);
      if (repoSubject) return repoSubject;

      const vCourse = allVersionedCourses.find(vc => vc.id === subjectId);
      if (!vCourse) return null;

      return {
        id: vCourse.id,
        name: vCourse.courseName,
        code: vCourse.courseCode,
        credits: vCourse.credit || 0,
      };
    };

    classMgr.allClasses.forEach(cls => {
      (cls.enrolledCourses || []).forEach(ec => {
        if (!teacherIds.has(String(ec.teacherId || '').trim())) return;

        const classSubjectKey = `${cls.id}-${ec.subjectId}`;
        if (seenClassSubjectKeys.has(classSubjectKey)) return;
        seenClassSubjectKeys.add(classSubjectKey);

        const subject = resolveSubject(ec.subjectId);
        if (!subject) return;

        loads.push({
          ...subject,
          className: cls.className || cls.roomNumber || '-',
        });
      });
    });

    const coveredSubjectIds = new Set(loads.map(s => String(s.id)));
    (teacher.teachingSubjectIds || []).forEach((subjectId) => {
      if (coveredSubjectIds.has(String(subjectId))) return;
      const subject = resolveSubject(subjectId);
      if (!subject) return;

      loads.push({
        ...subject,
        className: 'ยังไม่ผูกห้องเรียน',
      });
    });

    return loads;
  }, [teacher, allSubjects, classMgr.allClasses, coursesByVersion]);

  const deptCfg = teacher
    ? DEPARTMENT_CONFIG[teacher.department as keyof typeof DEPARTMENT_CONFIG]
    : null;

  if (!teacher) return null;

  const tabs = [
    { id: 'profile', label: 'ข้อมูลส่วนตัว', icon: User },
    { id: 'workload', label: 'ภาระงานสอน', icon: Briefcase },
  ] as const;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const fullName = `${formData.prefix || ''}${formData.firstName || ''} ${formData.lastName || ''}`.trim();
      await onUpdate({
        ...formData,
        name: fullName
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[110]"
          />

          {/* Centered Modal Container */}
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-white/50 rounded-[3rem]"
              style={GLASS}
            >
              {/* Header Area */}
              <div className="relative p-8 pb-4">
                <button
                  onClick={onClose}
                  className="absolute top-6 right-6 p-2 rounded-full bg-black/5 hover:bg-black/10 transition-colors"
                >
                  <X size={20} className="text-slate-500" />
                </button>

                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg overflow-hidden">
                    {formData.photoURL ? (
                       <img src={formData.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                       <span className="text-xl font-black">{teacher.name.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800 font-sukhumvit leading-tight">
                      {teacher.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[10px] font-black text-blue-600 border border-blue-100 shadow-sm">
                        {deptCfg?.label || 'ไม่ระบุแผนก'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div className="px-8 flex items-center gap-1 mb-4">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-black transition-all ${
                      activeTab === tab.id
                        ? 'bg-slate-900 text-white shadow-lg'
                        : 'text-slate-500 hover:bg-white/50'
                    }`}
                  >
                    <tab.icon size={14} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-8 pb-8 scrollbar-hide">
                <AnimatePresence mode="wait">
                  {activeTab === 'profile' ? (
                    <motion.div
                      key="profile"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      {/* Name Fields Stacked */}
                      <div className="space-y-4">
                        <div className="relative">
                          <Select 
                            value={formData.prefix} 
                            onValueChange={(val) => setFormData({ ...formData, prefix: val })}
                          >
                            <SelectTrigger className="w-full h-[46px] rounded-2xl bg-white/50 border-white/80 text-sm font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-inset focus:ring-blue-400 transition-all outline-none">
                              <SelectValue placeholder="คำนำหน้า" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-white/50 backdrop-blur-xl">
                              {PREFIXES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="relative">
                          <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="ชื่อ"
                            value={formData.firstName || ''}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            className="w-full h-[46px] bg-white/50 border border-white/80 rounded-2xl pl-10 pr-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 transition-all font-sukhumvit shadow-sm"
                          />
                        </div>
                      </div>

                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                           <span className="text-[10px] font-black text-slate-300">LN</span>
                        </div>
                        <input
                          type="text"
                          placeholder="นามสกุล"
                          value={formData.lastName || ''}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          className="w-full h-[46px] bg-white/50 border border-white/80 rounded-2xl pl-10 pr-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 transition-all font-sukhumvit shadow-sm"
                        />
                      </div>

                      <div className="relative">
                        <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="เบอร์โทรศัพท์"
                          value={formData.phone || ''}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full h-[46px] bg-white/50 border border-white/80 rounded-2xl pl-10 pr-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 transition-all font-sukhumvit shadow-sm"
                        />
                      </div>

                      <div className="relative">
                        <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="email"
                          placeholder="อีเมล"
                          value={formData.email || ''}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full h-[46px] bg-white/50 border border-white/80 rounded-2xl pl-10 pr-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 transition-all font-sukhumvit shadow-sm"
                        />
                      </div>

                      {/* Photo URL */}
                      <div className="relative">
                        <Camera size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="URL รูปถ่าย"
                          value={formData.photoURL || ''}
                          onChange={(e) => setFormData({ ...formData, photoURL: e.target.value })}
                          className="w-full h-[46px] bg-white/50 border border-white/80 rounded-2xl pl-10 pr-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 transition-all font-sukhumvit shadow-sm"
                        />
                      </div>

                      {/* Position */}
                      <div className="relative">
                        <BriefcaseBusiness size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                        <Select 
                          value={formData.position} 
                          onValueChange={(val) => setFormData({ ...formData, position: val })}
                        >
                          <SelectTrigger className="w-full h-[46px] rounded-2xl bg-white/50 border-white/80 pl-10 text-sm font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-inset focus:ring-blue-400 transition-all outline-none">
                            <SelectValue placeholder="ตำแหน่ง" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-white/50 backdrop-blur-xl">
                            {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Department Switcher */}
                      <div className="flex p-1.5 bg-white/30 rounded-2xl border border-white/50 shadow-inner">
                        {(['early', 'primary', 'secondary'] as const).map((dept) => (
                          <button
                            key={dept}
                            type="button"
                            onClick={() => setFormData({ ...formData, department: dept })}
                            className={`flex-1 py-2 rounded-xl text-[11px] font-black transition-all ${
                              formData.department === dept
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            {DEPARTMENT_CONFIG[dept].label}
                          </button>
                        ))}
                      </div>

                      <div className="pt-4 flex justify-between items-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (teacher && window.confirm('ยืนยันการลบข้อมูลครู?')) {
                              onDelete(teacher.id);
                            }
                          }}
                          className="p-3.5 rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all active:scale-95 shadow-sm"
                        >
                          <Trash2 size={20} />
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="px-8 bg-blue-600 text-white rounded-2xl h-10 flex items-center justify-center gap-2 font-black text-[11px] shadow-lg hover:shadow-xl hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          <Save size={16} />
                          {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="workload"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[13px] font-black text-slate-700 font-sukhumvit uppercase tracking-tight">รายวิชาที่รับผิดชอบ</h3>
                        <span className="text-[11px] font-bold text-slate-400">{realAssignments.length} วิชา</span>
                      </div>

                      {realAssignments.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400 bg-white/30 rounded-3xl border border-dashed border-slate-300">
                          <BookOpen size={32} className="mb-2 opacity-20" />
                          <p className="text-xs font-bold font-sukhumvit uppercase tracking-widest">ยังไม่มีภาระงานสอน</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          {realAssignments.map((assignment, idx) => (
                            <div
                              key={`${assignment.id}-${idx}`}
                              className="p-4 rounded-2xl bg-white/60 border border-white/80 flex items-center gap-4 hover:shadow-md transition-all group"
                            >
                              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <BookOpen size={18} />
                              </div>
                              <div className="flex-1">
                                <p className="text-[13px] font-black text-slate-800 leading-tight font-sukhumvit">{assignment.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shadow-inner">
                                    {assignment.code}
                                  </span>
                                  <span className="text-[10px] font-bold text-blue-500 font-sukhumvit bg-blue-50 px-1.5 py-0.5 rounded">
                                    ห้อง {assignment.className}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
