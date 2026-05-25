import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Trash2, Edit2, Search, MoreHorizontal, Phone, Mail, MapPin, BookOpen } from 'lucide-react';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import AddTeacherModal from './components/AddTeacherModal';

const DEPT_LABEL: Record<string, string> = {
  SECONDARY: 'มัธยมศึกษา',
  PRIMARY: 'ประถมศึกษา',
  KINDERGARTEN: 'ปฐมวัย',
  ACADEMIC: 'วิชาการ',
  ADMIN: 'บริหารงานทั่วไป',
  STUDENT_AFFAIRS: 'กิจการนักเรียน',
};

function formatDept(dept: string) {
  return DEPT_LABEL[dept?.toUpperCase()] || dept || '';
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
  const { coursesByVersion } = useCurriculumVersioned();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDept, setSelectedDept] = useState('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!selectedId && teachers.length > 0) {
      setSelectedId(teachers[0].id);
    }
  }, [teachers, selectedId]);

  const departments = useMemo(() => {
    const depts = new Set(teachers.map(t => t.department).filter(Boolean));
    return ['ทั้งหมด', ...Array.from(depts)];
  }, [teachers]);

  const filteredTeachers = useMemo(() => {
    let list = selectedDept === 'ทั้งหมด' ? teachers : teachers.filter(t => t.department === selectedDept);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => t.name?.toLowerCase().includes(q) || t.position?.toLowerCase().includes(q));
    }
    return list;
  }, [teachers, selectedDept, searchQuery]);

  const selectedTeacher = teachers.find(t => t.id === selectedId) || null;

  const teacherSubjects = useMemo(() => {
    if (!selectedTeacher) return [];
    const assignedLoads: any[] = [];
    const allVersionedCourses = Object.values(coursesByVersion).flat();
    const teacherIds = new Set(
      [selectedTeacher.id, selectedTeacher.userId]
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
    );

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
        category: vCourse.category,
        department: vCourse.department,
        subjectGroup: vCourse.subjectGroup || 'none',
      } as any;
    };

    classMgr.allClasses.forEach(cls => {
      (cls.enrolledCourses || []).forEach(ec => {
        if (!teacherIds.has(String(ec.teacherId || '').trim())) return;

        const subject = resolveSubject(ec.subjectId);
        if (subject) {
          assignedLoads.push({
            ...subject,
            id: `${cls.id}-${subject.id}`,
            originalSubjectId: subject.id,
            className: cls.className || cls.roomNumber || '-',
            workload: subject.credits || 0,
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
      });
    });

    return assignedLoads;
  }, [selectedTeacher, allSubjects, classMgr.allClasses, coursesByVersion]);

  return (
    <div className="flex h-full w-full bg-transparent overflow-hidden pb-4 gap-0 font-sukhumvit">

      {/* ── LEFT PANEL — Detail View ── */}
      <div className="flex-1 min-w-0 flex flex-col pr-4 overflow-hidden">
        <AnimatePresence mode="wait">
          {selectedTeacher ? (
            <motion.div
              key={selectedTeacher.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex flex-col h-full overflow-hidden"
            >
              {/* Apple Music Style Hero Header */}
              <div className="flex flex-col md:flex-row gap-8 p-2 shrink-0 items-start mb-8">
                <div className="w-48 h-48 md:w-56 md:h-56 rounded-xl overflow-hidden shadow-[0_8px_25px_-10px_rgba(0,0,0,0.25)] shrink-0 group relative transition-all duration-500 hover:shadow-[0_12px_30px_-12px_rgba(0,0,0,0.3)] hover:-translate-y-1">
                  <img
                    src={selectedTeacher.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedTeacher.id}`}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    alt={selectedTeacher.name}
                  />
                  <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors pointer-events-none" />
                </div>

                <div className="flex flex-col h-auto justify-center">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight mb-1">
                    {selectedTeacher.name}
                  </h2>
                  <p className="text-lg font-bold text-blue-600 mb-4">
                    {selectedTeacher.position || 'ครูผู้สอน'}
                  </p>

                  {/* Compact Info Rows under Position */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mb-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50 w-fit">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                        <MapPin size={12} className="text-slate-400" />
                      </div>
                      <span className="text-[12px] font-bold text-slate-600">{formatDept(selectedTeacher.department)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                        <Phone size={12} className="text-slate-400" />
                      </div>
                      <span className="text-[12px] font-bold text-slate-600">{selectedTeacher.phone || '-'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                        <Mail size={12} className="text-slate-400" />
                      </div>
                      <span className="text-[12px] font-bold text-slate-600 truncate max-w-[200px]">{selectedTeacher.email || '-'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setIsEditing(true); setModalOpen(true); }}
                      className="flex items-center gap-2 px-6 py-2 bg-[#f2f2f7] hover:bg-[#e5e5ea] text-blue-600 rounded-full transition-all font-bold text-[13px]"
                    >
                      <Edit2 size={15} strokeWidth={3} />
                      แก้ไขข้อมูล
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (confirm(`ลบรายชื่อ ${selectedTeacher.name}?`)) {
                          deleteTeacher(selectedTeacher.id);
                          setSelectedId(null);
                        }
                      }}
                      className="flex items-center gap-2 px-6 py-2 bg-[#fff1f2] hover:bg-[#ffe4e6] text-rose-600 rounded-full transition-all font-bold text-[13px]"
                    >
                      <Trash2 size={15} strokeWidth={3} />
                      ลบข้อมูล
                    </motion.button>
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-100/80 mb-6" />

              {/* Detail Content */}
              <div className="flex-1 overflow-y-auto scrollbar-hide pb-12 min-h-0 px-2">
                <div className="max-w-4xl">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <BookOpen size={14} className="text-blue-500" />
                    วิชาที่รับผิดชอบ
                  </h3>
                  
                  {teacherSubjects.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
                      <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                        <BookOpen size={20} className="text-slate-200" />
                      </div>
                      <p className="text-xs text-slate-400 font-bold">ยังไม่มีข้อมูลวิชาที่สอนในระบบ</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {teacherSubjects.map((subject, idx) => (
                        <motion.div
                          key={subject.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="group flex items-center gap-4 p-4 bg-white hover:bg-blue-50/50 border border-slate-100 hover:border-blue-100 rounded-2xl transition-all cursor-default shadow-sm hover:shadow-md"
                        >
                          <div className="w-10 h-10 rounded-xl bg-slate-50 group-hover:bg-blue-50 flex items-center justify-center shrink-0 transition-colors">
                            <span className="text-sm font-black text-slate-200 group-hover:text-blue-400 transition-colors">
                              {idx + 1}
                            </span>
                          </div>
                          <div className="flex-1 flex flex-col min-w-0">
                            <span className="text-[14px] font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                              {subject.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                {subject.code}
                              </span>
                              <span className="text-[10px] font-bold text-blue-500 bg-blue-50/50 px-1.5 py-0.5 rounded">
                                ห้อง {subject.className}
                              </span>
                            </div>
                          </div>
                          <button className="p-2 text-slate-200 hover:text-slate-400 transition-colors">
                            <MoreHorizontal size={16} />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-300">
              <Users size={64} className="opacity-10 mb-4" />
              <p className="text-sm font-black opacity-30 uppercase tracking-widest">เลือกครูเพื่อดูรายละเอียด</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* DIVIDER */}
      <div className="w-px bg-slate-200/80 shrink-0 self-stretch" />

      {/* ── RIGHT PANEL — Teacher List ── */}
      <div className="w-[20%] lg:w-[250px] xl:w-[320px] shrink-0 flex flex-col pl-4 pt-1">

        {/* Department Filter + Add Button */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 flex items-center bg-[#f2f2f7] rounded-full p-1 overflow-x-auto scrollbar-hide">
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="appearance-none pl-4 pr-6 py-1.5 bg-transparent text-blue-600 font-bold text-[12px] outline-none cursor-pointer w-full"
            >
              {departments.map(d => (
                <option key={d} value={d}>{formatDept(d) || d}</option>
              ))}
            </select>
          </div>
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { setIsEditing(false); setModalOpen(true); }}
            className="w-8 h-8 rounded-full bg-blue-600 text-white shadow-md flex items-center justify-center shrink-0 transition-all"
            title="เพิ่มครู"
          >
            <Plus size={15} strokeWidth={3} />
          </motion.button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input
              type="text"
              placeholder="ค้นหา..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white/70 backdrop-blur-md border border-slate-200 rounded-full text-[10px] font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all w-full outline-none placeholder:text-slate-400 shadow-sm"
            />
          </div>
        </div>

        <div className="h-px bg-slate-100/80 mb-2" />

        {/* Teacher List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col pt-1">
          <AnimatePresence>
            {filteredTeachers.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-slate-400 opacity-50 border-2 border-dashed border-slate-200 rounded-2xl">
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
                    className={`group relative flex items-center transition-all cursor-pointer mx-2 my-1.5 ${isActive
                        ? 'bg-blue-600 text-white rounded-2xl p-2.5 px-4 z-10'
                        : 'p-2 px-4 border-b border-slate-50/50 hover:bg-slate-50/80 rounded-xl'
                      }`}
                  >
                    <div className="flex-1 flex items-center gap-4 min-w-0">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-xl overflow-hidden shadow-sm shrink-0 transition-all duration-300 ${isActive ? 'bg-white p-0.5' : 'bg-slate-100 group-hover:scale-105'}`}>
                        <img
                          src={t.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${t.id}&backgroundColor=f8fafc`}
                          alt="avatar"
                          className="w-full h-full object-cover rounded-[10px]"
                        />
                      </div>

                      {/* Name & Position */}
                      <div className="flex-1 min-w-0">
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

        {/* Footer count */}
        <div className="pt-3 border-t border-slate-100 mt-2">
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest text-center">
            รวม {filteredTeachers.length} รายชื่อ
          </p>
        </div>
      </div>

      {/* ── Modal ── */}
      <AddTeacherModal
        open={modalOpen}
        editingTeacher={isEditing ? selectedTeacher : null}
        onClose={() => { setModalOpen(false); setIsEditing(false); }}
        onSubmit={addTeacher}
        onUpdate={updateTeacher}
        onDelete={deleteTeacher}
      />
    </div>
  );
}
