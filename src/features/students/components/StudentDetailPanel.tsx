import { Phone, MapPin, User, BookOpen, Pencil, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Student, Enrollment } from '@/types/student';
import StudentAvatar from './StudentAvatar';
import { GLASS } from '@/components/layouts/PortalLayout';
import { formatNationalId } from './studentDetailFormShared';

interface StudentDetailPanelProps {
  open: boolean;
  onClose: () => void;
  student: Student | null;
  enrollments: Enrollment[];
  onEdit: () => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'กำลังศึกษา',
  inactive: 'พักการศึกษา',
  graduated: 'จบการศึกษา',
  transferred: 'ย้ายออก',
};
const STATUS_COLOR: Record<string, string> = {
  active: '#10b981',
  inactive: '#f59e0b',
  graduated: '#6366f1',
  transferred: '#94a3b8',
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon size={14} className="text-black/30 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-[10px] text-black/35 uppercase tracking-wider">{label}</p>
        <p className="text-xs text-black/70 font-medium">{value}</p>
      </div>
    </div>
  );
}

export default function StudentDetailPanel({ open, onClose, student, enrollments, onEdit, onDelete, onToggleStatus }: StudentDetailPanelProps) {
  // Use early return but still keep hooks (if any) above
  if (!student) return null;
  
  const isActive = student.status === 'active';
  const statusColor = STATUS_COLOR[student.status] || '#94a3b8';

  const calcAge = (birthDate?: string) => {
    if (!birthDate) return undefined;
    const birth = new Date(birthDate);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    return `${age} ปี`;
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
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[110]"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-4 right-4 w-full max-w-md z-[120] rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl border border-white/50"
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
                <StudentAvatar 
                  photoURL={student.photoURL}
                  studentId={student.id}
                  name={student.firstName}
                  gender={student.gender}
                  className="w-20 h-20 rounded-[2rem] shadow-xl"
                />
                <div>
                  <h2 className="text-xl font-black text-slate-800 font-sukhumvit leading-tight">
                    {student.prefix}{student.firstName} {student.lastName}
                  </h2>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest font-sarabun">
                    รหัส: {student.studentCode}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-white shadow-sm"
                      style={{ background: statusColor }}
                    >
                      {STATUS_LABEL[student.status] || 'ไม่ทราบสถานะ'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions Row */}
              <div className="flex items-center gap-2 mt-6">
                <button
                  onClick={onEdit}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black shadow-lg hover:shadow-xl transition-all"
                >
                  <Pencil size={14} />
                  แก้ไขข้อมูล
                </button>
                <button
                  onClick={() => onToggleStatus(student.id)}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all ${
                    isActive ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  {isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`ลบ "${student.prefix}${student.firstName} ${student.lastName}" ออกจากระบบ?`)) {
                      onDelete(student.id);
                      onClose();
                    }
                  }}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-8 pb-8 scrollbar-hide space-y-6">
              {/* Personal Info */}
              <div className="space-y-4">
                <h3 className="text-[13px] font-black text-slate-700 font-sukhumvit uppercase tracking-tight">ข้อมูลส่วนตัว</h3>
                <div className="grid grid-cols-1 gap-1">
                  <InfoRow icon={User} label="เพศ" value={student.gender === 'male' ? 'ชาย' : 'หญิง'} />
                  <InfoRow icon={User} label="วันเกิด / อายุ" value={student.birthDate ? `${student.birthDate} (${calcAge(student.birthDate)})` : undefined} />
                  <InfoRow icon={User} label="เลขบัตรประชาชน" value={formatNationalId(student.nationalId)} />
                  <InfoRow icon={User} label="หมู่เลือด" value={student.bloodType} />
                  <InfoRow icon={User} label="สัญชาติ" value={student.nationality} />
                  <InfoRow icon={User} label="ศาสนา" value={student.religion} />
                  <InfoRow icon={MapPin} label="ที่อยู่" value={student.address} />
                </div>
              </div>

              {(student.guardianFirstName || student.guardianPhone) && (
                <div className="space-y-4">
                  <h3 className="text-[13px] font-black text-slate-700 font-sukhumvit uppercase tracking-tight">ข้อมูลผู้ปกครอง</h3>
                  <div className="grid grid-cols-1 gap-1">
                    <InfoRow icon={User} label="ชื่อผู้ปกครอง" value={`${student.guardianFirstName || ''} ${student.guardianLastName || ''}${student.guardianRelation ? ` (${student.guardianRelation})` : ''}`.trim()} />
                    <InfoRow icon={Phone} label="เบอร์โทร" value={student.guardianPhone} />
                  </div>
                </div>
              )}

              {/* Enrollment History */}
              <div className="space-y-4">
                <h3 className="text-[13px] font-black text-slate-700 font-sukhumvit uppercase tracking-tight flex items-center gap-2">
                  <BookOpen size={16} />
                  ประวัติการลงทะเบียน
                </h3>
                {!enrollments || enrollments.length === 0 ? (
                  <p className="text-xs text-slate-400 font-bold bg-white/30 py-6 rounded-2xl text-center border border-dashed border-slate-200">
                    ยังไม่มีประวัติการลงทะเบียน
                  </p>
                ) : (
                  <div className="space-y-3">
                    {enrollments.map(e => (
                      <div key={e.id} className="p-4 rounded-2xl bg-white/60 border border-white/80 flex items-center justify-between group hover:shadow-md transition-all">
                        <div>
                          <p className="text-[13px] font-black text-slate-800 font-sukhumvit">{e.className} · ภาคเรียนที่ {e.semester}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase">ปีการศึกษา {e.academicYearId}</p>
                        </div>
                        <span
                          className="text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm"
                          style={{
                            background: e.status === 'studying' ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)',
                            color: e.status === 'studying' ? '#10b981' : '#64748b',
                          }}
                        >
                          {e.status === 'studying' ? 'กำลังศึกษา' : e.status === 'graduated' ? 'จบการศึกษา' : 'ย้ายออก'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
