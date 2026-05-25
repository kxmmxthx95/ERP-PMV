import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle2, UserCheck, UserX, Clock, FileCheck, Save, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTeachingManager } from '@/hooks/useTeachingManager';
import { useAllLeaveRequests } from '@/hooks/useLeaveRequests';
import type { AttendanceStatus, NewAttendanceRecord } from '@/types/teaching';
import type { Department } from '@/types/curriculum';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacherId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  period: number;
}

const STATUS_CYCLE: AttendanceStatus[] = ['present', 'late', 'absent', 'leave'];

const STATUS_MAP: Record<AttendanceStatus, { label: string; color: string; bg: string; icon: LucideIcon }> = {
  present: { label: 'มาเรียน', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: UserCheck },
  late: { label: 'สาย', color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
  absent: { label: 'ขาด', color: 'text-rose-600', bg: 'bg-rose-50', icon: UserX },
  leave: { label: 'ลา', color: 'text-blue-600', bg: 'bg-blue-50', icon: FileCheck },
  excused: { label: 'ลา (มีเหตุผล)', color: 'text-blue-600', bg: 'bg-blue-50', icon: FileCheck },
};

interface ModalStudent {
  id: string;
  code: string;
  name: string;
  status: AttendanceStatus;
  hasLeave: boolean;
  leaveReason?: string;
}

function getIdentityCandidates(student: { id?: string; userId?: string; uid?: string; authUid?: string }): string[] {
  return [...new Set([student.id, student.userId, student.uid, student.authUid]
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean))];
}

function normalizeThaiName(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

export default function AttendanceModal({
  isOpen, onClose, teacherId, classId, className, subjectId, subjectName, period
}: AttendanceModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const { getStudentsForClass, getAttendanceForSession, saveAttendanceSession, activeYearStr, semester, classes } = useTeachingManager(teacherId);
  const { requests: leaveRequests } = useAllLeaveRequests();
  
  const [students, setStudents] = useState<ModalStudent[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  // Load students and merge with attendance/leaves
  useEffect(() => {
    if (!isOpen) return;

    const classStudents = getStudentsForClass(classId);
    const existingAttendance = getAttendanceForSession(subjectId, classId, today, period);
    const attMap = new Map(existingAttendance.map(a => [a.studentId, a.status]));

    // Filter approved leaves for today
    const activeLeaves = leaveRequests.filter(r => 
      r.requesterType === 'student' &&
      r.status === 'approved' && 
      today >= r.startDate && 
      today <= r.endDate
    );

    const initialData = classStudents.map(({ student }) => {
      const existingStatus = attMap.get(student.id);
      const candidateIds = getIdentityCandidates(student);
      const studentFullName = `${student.prefix}${student.firstName}${student.lastName}`;
      const leave = activeLeaves.find(l =>
        candidateIds.includes(l.requesterId)
        || (typeof l.requesterStudentCode === 'string' && l.requesterStudentCode === student.studentCode)
        || normalizeThaiName(l.requesterName) === normalizeThaiName(studentFullName)
      );
      
      return {
        id: student.id,
        code: student.studentCode,
        name: `${student.prefix}${student.firstName} ${student.lastName}`,
        status: existingStatus || (leave ? 'leave' : 'present'),
        hasLeave: !!leave,
        leaveReason: leave?.reason
      };
    });

    setStudents(initialData);
  // ตั้งใจรีเฟรชเมื่อเปิด modal, เปลี่ยนห้อง, หรือมีการเปลี่ยนแปลงคำขอลา
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, classId, leaveRequests]);

  const cycleStatus = (id: string) => {
    setStudents(prev => prev.map(s => {
      if (s.id !== id) return s;
      const curIdx = STATUS_CYCLE.indexOf(s.status);
      const nextIdx = (curIdx + 1) % STATUS_CYCLE.length;
      return { ...s, status: STATUS_CYCLE[nextIdx] };
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const currentClass = classes.find(c => c.id === classId);
    const departmentId = currentClass?.departmentId || 'secondary';

    const records: NewAttendanceRecord[] = students.map(s => ({
      studentId: s.id,
      studentName: s.name,
      studentCode: s.code,
      subjectId,
      subjectName,
      classId,
      className,
      teacherId,
      departmentId: departmentId as Department,
      academicYearId: activeYearStr,
      semester,
      date: today,
      period,
      status: s.status,
      note: s.hasLeave ? `ลา: ${s.leaveReason}` : ''
    }));

    try {
      await saveAttendanceSession(records);
      onClose();
    } catch (error) {
      console.error('Failed to save attendance:', error);
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.includes(search) || s.code.includes(search)
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const stats = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = { 
      present: 0, late: 0, absent: 0, excused: 0, leave: 0 
    };
    students.forEach(s => {
      const status = s.status as AttendanceStatus;
      counts[status]++;
    });
    return counts;
  }, [students]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 leading-tight">เช็กชื่อเข้าเรียน: {className}</h2>
              <p className="text-xs font-bold text-slate-400">{subjectName} · คาบที่ {period}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Stats */}
        <div className="px-6 py-4 flex flex-col gap-4 border-b border-slate-100">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="ค้นหาชื่อหรือรหัสนักเรียน..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-11 pl-11 pr-4 rounded-2xl bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-0 text-sm font-medium transition-all"
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {Object.entries(STATUS_MAP).map(([key, cfg]) => (
              <div key={key} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${cfg.bg} border-current/10 ${cfg.color} shrink-0`}>
                <cfg.icon size={14} />
                <span className="text-[11px] font-black">{cfg.label}: {stats[key as AttendanceStatus]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Student List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/30">
          {paginatedStudents.length > 0 ? (
            paginatedStudents.map((s, idx) => {
              const status = s.status as AttendanceStatus;
              const cfg = STATUS_MAP[status];
              const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + idx;
              
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.01 }}
                  onClick={() => cycleStatus(s.id)}
                  className={`group flex items-center gap-4 p-3 rounded-2xl cursor-pointer select-none transition-all ${
                    s.status === 'present' ? 'bg-white hover:bg-emerald-50/30' : 'bg-white shadow-sm'
                  } border border-slate-100 hover:border-slate-200 active:scale-[0.98]`}
                >
                  <div className="w-8 text-[11px] font-black text-slate-300 text-center">{globalIdx + 1}</div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-slate-800 truncate">{s.name}</p>
                    <p className="text-[10px] font-bold text-slate-400">{s.code}</p>
                  </div>

                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${cfg.bg} ${cfg.color}`}>
                    <cfg.icon size={16} />
                    <span className="text-xs font-black">{cfg.label}</span>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Search size={40} className="mb-4 opacity-20" />
              <p className="text-sm font-bold">ไม่พบรายชื่อที่ค้นหา</p>
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-3 bg-white border-t border-slate-100 flex items-center justify-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition-colors"
            >
              <motion.span whileTap={{ x: -2 }}>&larr;</motion.span>
            </button>
            
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                // Show first, last, and current page with neighbors
                if (
                  pageNum === 1 || 
                  pageNum === totalPages || 
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${
                        currentPage === pageNum 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                          : 'text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                }
                if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                  return <span key={pageNum} className="text-slate-300 px-1">...</span>;
                }
                return null;
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition-colors"
            >
              <motion.span whileTap={{ x: 2 }}>&rarr;</motion.span>
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="p-6 bg-white border-t border-slate-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black flex items-center justify-center gap-3 shadow-xl shadow-slate-200 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save size={18} />
                บันทึกการเช็กชื่อ ({students.length} คน)
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
