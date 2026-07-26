import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiMagnifyingGlass, HiUserPlus, HiUserMinus } from 'react-icons/hi2';
import { useStudentManager } from '@/hooks/useStudentManager';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import ClassAddStudentModal from './ClassAddStudentModal';
import type { ClassRoom } from '@/types/class';
import { toast } from 'sonner';

interface Props {
  classRoom: ClassRoom;
  cfg: { bg: string; color: string; label: string };
}

const containerAnim = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const rowAnim = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } };

export default function ClassStudentTab({ classRoom, cfg }: Props) {
  const { students, enrollments, updateEnrollment } = useStudentManager(classRoom.academicYearId);
  const { teachers } = useTeacherManager();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');

  const currentTeacherIds = useMemo(() => {
    return classRoom.homeroomTeacherIds?.length
      ? classRoom.homeroomTeacherIds
      : classRoom.homeroomTeacherId ? [classRoom.homeroomTeacherId] : [];
  }, [classRoom.homeroomTeacherIds, classRoom.homeroomTeacherId]);

  const activeTeachers = useMemo(() => {
    return teachers.filter(t => currentTeacherIds.includes(t.id));
  }, [teachers, currentTeacherIds]);

  const classEnrollments = useMemo(() =>
    enrollments.filter(
      e => e.classId === classRoom.id &&
        e.academicYearId === classRoom.academicYearId &&
        e.semester === classRoom.semester,
    ),
    [enrollments, classRoom],
  );

  const classStudents = useMemo(() => {
    const ids = new Set(classEnrollments.map(e => e.studentId));
    return students
      .filter(s => ids.has(s.id))
      .filter(s => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const fullName = `${s.prefix}${s.firstName} ${s.lastName}`.toLowerCase();
        return fullName.includes(q) || s.studentCode.includes(q);
      })
      .sort((a, b) => a.studentCode.localeCompare(b.studentCode));
  }, [students, classEnrollments, search]);

  const handleRemove = async (studentId: string, name: string) => {
    const enrollment = classEnrollments.find(e => e.studentId === studentId);
    if (!enrollment) return;
    if (!window.confirm(`ย้าย ${name} ออกจากห้อง ${classRoom.className}?`)) return;
    try {
      await updateEnrollment(enrollment.id, { classId: '', className: '' });
      toast.success(`ย้าย ${name} ออกจากห้องแล้ว`);
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full font-sukhumvit">

      {/* ── Action bar ── */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* Search input (tab shape) */}
        <div className="flex items-center h-9 gap-2 px-3 rounded-xl bg-white/80 border border-black/[0.07] shadow-sm flex-1 max-w-xs">
          <HiMagnifyingGlass className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ หรือรหัสนักเรียน..."
            className="flex-1 bg-transparent border-none outline-none text-[11px] font-bold text-slate-700 placeholder:text-slate-300"
          />
        </div>

        <div className="flex-1" />

        {/* Add student button */}
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 h-9 px-4 rounded-2xl bg-slate-900 text-white text-[11px] font-black shadow-sm hover:bg-slate-700 active:scale-95 transition-all whitespace-nowrap"
        >
          <HiUserPlus className="w-3.5 h-3.5" />
          จัดรายชื่อนักเรียน
        </button>
      </div>

      {/* ── Homeroom Teacher Bar ── */}
      {activeTeachers.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/60 border border-black/[0.04] shadow-sm backdrop-blur-sm">
          <div className="flex -space-x-2 overflow-hidden shrink-0">
            {activeTeachers.map(t => (
              <div key={t.id} className="relative group/avatar">
                {t.photoURL ? (
                  <img
                    src={t.photoURL}
                    alt={t.name}
                    className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-black text-slate-600">
                    {t.name.charAt(0)}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">ครูประจำชั้น</p>
            <p className="text-[12px] font-bold text-slate-700 truncate mt-0.5">
              {activeTeachers.map(t => t.name).join(' & ')}
            </p>
          </div>
        </div>
      )}

      {/* ── Student list ── */}
      <AnimatePresence mode="wait">
        {classStudents.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-52 gap-3 bg-white/60 rounded-3xl border border-black/[0.05] shadow-sm"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <HiUserPlus className="w-6 h-6 text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-bold text-slate-400">ยังไม่มีนักเรียนในห้องนี้</p>
              <p className="text-[11px] text-slate-300 mt-0.5">กด "จัดรายชื่อนักเรียน" เพื่อเพิ่ม</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden bg-white/80 border border-black/[0.05] shadow-sm backdrop-blur-sm"
          >
            {/* Table header */}
            <div
              className="grid items-center px-4 py-2.5 border-b border-black/[0.05] flex-shrink-0 bg-slate-50/80"
              style={{ gridTemplateColumns: '3rem 1fr 9rem 7rem 4rem' }}
            >
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ชื่อ-นามสกุล</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">รหัส</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">เพศ</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">★</span>
            </div>

            {/* Rows */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
              <motion.div
                variants={containerAnim}
                initial="hidden"
                animate="show"
                className="flex flex-col gap-3 px-3 pb-4 pt-2"
              >
                {classStudents.map((s, idx) => (
                  <motion.div
                    key={s.id}
                    variants={rowAnim}
                    className="grid items-center gap-0 border border-black/[0.05] rounded-2xl bg-white shadow-[0_4px_12px_rgba(15,23,42,0.08)] px-4 py-3 transition-colors group"
                    style={{ gridTemplateColumns: '3rem 1fr 9rem 7rem 4rem' }}
                  >
                    {/* # */}
                    <span className="text-[11px] font-bold text-slate-300">{idx + 1}</span>

                    {/* Name + avatar */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      {s.photoURL ? (
                        <img
                          src={s.photoURL}
                          alt={`${s.prefix}${s.firstName} ${s.lastName}`}
                          className="w-7 h-7 rounded-full object-cover shrink-0 shadow-sm border border-black/[0.05]"
                        />
                      ) : (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 shadow-sm"
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          {s.firstName.charAt(0)}
                        </div>
                      )}
                        <p className="text-[12px] font-bold text-slate-700 truncate">
                          {s.firstName} {s.lastName}
                        </p>
                    </div>

                    {/* Student code */}
                    <span className="text-[11px] font-bold text-slate-400">{s.studentCode}</span>

                    {/* Gender / prefix badge */}
                    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full w-fit ${
                      s.prefix === 'เด็กชาย' || s.prefix === 'นาย'
                        ? 'bg-blue-50 text-blue-500'
                        : 'bg-rose-50 text-rose-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        s.prefix === 'เด็กชาย' || s.prefix === 'นาย'
                          ? 'bg-blue-400'
                          : 'bg-rose-400'
                      }`} />
                      {s.prefix === 'เด็กชาย' || s.prefix === 'นาย' ? 'ชาย' : 'หญิง'}
                    </span>

                    {/* Remove button */}
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleRemove(s.id, `${s.prefix}${s.firstName} ${s.lastName}`)}
                        title="ย้ายออกจากห้อง"
                        className="w-7 h-7 flex items-center justify-center rounded-full text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-50 transition-all"
                      >
                        <HiUserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-black/[0.05] flex items-center justify-between flex-shrink-0 bg-slate-50/60">
              <span className="text-[10px] font-bold text-slate-400">
                แสดง {classStudents.length} รายชื่อ
                {search && ` (กรองจาก ${classEnrollments.length} คนทั้งหมด)`}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                ความจุ: {classRoom.studentCount}/{classRoom.maxStudents} คน
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ClassAddStudentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        targetClass={classRoom}
      />
    </div>
  );
}
