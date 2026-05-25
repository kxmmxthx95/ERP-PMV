import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, Search, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStudentManager } from '@/hooks/useStudentManager';
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
const rowAnim = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
};

export default function ClassStudentTab({ classRoom, cfg }: Props) {
  const { students, enrollments, updateEnrollment } = useStudentManager(classRoom.academicYearId);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');

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
    <div className="flex flex-col gap-3 h-full">
      {/* Actions row */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ หรือรหัสนักเรียน..."
            className="pl-8 h-9 text-[11px] rounded-xl bg-white/60 border-white/80 focus-visible:ring-1 focus-visible:ring-slate-300 backdrop-blur"
          />
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="h-9 gap-1.5 px-3 text-xs font-semibold text-white rounded-xl bg-[#1e1e1e] hover:bg-[#2a2a2a] border-0 flex-shrink-0"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
        >
          <UserPlus size={13} />
          จัดรายชื่อนักเรียน
        </Button>
      </div>

      {/* List */}
      {classStudents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-52 gap-2 text-black/25 bg-white/40 rounded-2xl border border-black/5"
        >
          <Users size={32} strokeWidth={1.5} className="opacity-30" />
          <p className="text-sm font-medium">ยังไม่มีนักเรียนในห้องนี้</p>
          <p className="text-xs text-black/20">กด "จัดรายชื่อนักเรียน" เพื่อเพิ่ม</p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl overflow-hidden flex-1 min-h-0 flex flex-col"
          style={glassCard}
        >
          {/* Table header */}
          <div
            className="grid items-center px-4 py-2.5 border-b border-black/[0.04] flex-shrink-0"
            style={{ gridTemplateColumns: '3rem 1fr 8rem 7rem 4rem', background: 'rgba(0,0,0,0.02)' }}
          >
            <span className="text-[10px] font-bold text-black/35 uppercase tracking-wider">#</span>
            <span className="text-[10px] font-bold text-black/35 uppercase tracking-wider">ชื่อ-นามสกุล</span>
            <span className="text-[10px] font-bold text-black/35 uppercase tracking-wider">รหัสนักเรียน</span>
            <span className="text-[10px] font-bold text-black/35 uppercase tracking-wider">สถานะ</span>
            <span className="text-[10px] font-bold text-black/35 uppercase tracking-wider text-center">จัดการ</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
            <AnimatePresence>
              <motion.div
                variants={containerAnim}
                initial="hidden"
                animate="show"
                className="divide-y divide-black/[0.03]"
              >
                {classStudents.map((s, idx) => (
                  <motion.div
                    key={s.id}
                    variants={rowAnim}
                    className="grid items-center px-4 py-2.5 hover:bg-black/[0.015] transition-colors"
                    style={{ gridTemplateColumns: '3rem 1fr 8rem 7rem 4rem' }}
                  >
                    <span className="text-[11px] text-black/30 font-medium">{idx + 1}</span>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {s.firstName.charAt(0)}
                      </div>
                      <p className="text-xs font-semibold text-black/75 truncate">
                        {s.prefix}{s.firstName} {s.lastName}
                      </p>
                    </div>
                    <span className="text-[11px] text-black/45 font-medium">{s.studentCode}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md w-fit ${
                      s.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      {s.status === 'active' ? 'กำลังศึกษา' : 'ไม่ใช้งาน'}
                    </span>
                    <div className="flex justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(s.id, `${s.prefix}${s.firstName} ${s.lastName}`)}
                        className="h-7 w-7 text-black/30 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="ย้ายออกจากห้อง"
                      >
                        <UserMinus size={13} />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-black/[0.04] flex items-center justify-between flex-shrink-0" style={{ background: 'rgba(0,0,0,0.015)' }}>
            <span className="text-[10px] text-black/30 font-medium">
              แสดง {classStudents.length} รายชื่อ
              {search && ` (กรองจาก ${classEnrollments.length} คนทั้งหมด)`}
            </span>
            <span className="text-[10px] text-black/30">
              ความจุ: {classRoom.studentCount}/{classRoom.maxStudents} คน
            </span>
          </div>
        </motion.div>
      )}

      <ClassAddStudentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        targetClass={classRoom}
      />
    </div>
  );
}
