import { Phone, MapPin, User, BookOpen, Pencil, Trash2, Mail, AlertCircle, Hash } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Student, Enrollment } from '@/types/student';
import { checkStudentCompletion } from '@/utils/studentValidation';

interface StudentDetailViewProps {
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
    <div className="flex items-start gap-3 py-2 border-b border-slate-50">
      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
        <Icon size={14} className="text-slate-400" />
      </div>
      <div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
        <p className="text-[13px] text-slate-700 font-bold">{value}</p>
      </div>
    </div>
  );
}

export default function StudentDetailView({ student, enrollments, onEdit, onDelete, onToggleStatus }: StudentDetailViewProps) {
  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-300">
        <User size={64} className="opacity-10 mb-4" />
        <p className="text-sm font-black opacity-30 uppercase tracking-widest">เลือกนักเรียนเพื่อดูรายละเอียด</p>
      </div>
    );
  }

  const isActive = student.status === 'active';
  const statusColor = STATUS_COLOR[student.status] || '#94a3b8';
  const completion = checkStudentCompletion(student);

  const calcAge = (birthDate?: string) => {
    if (!birthDate) return undefined;
    const birth = new Date(birthDate);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    return `${age} ปี`;
  };

  return (
    <motion.div
      key={student.id}
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full overflow-hidden"
    >
      {/* Header Area (Apple Style) */}
      <div className="flex gap-8 p-6 shrink-0 items-start">
        <div className="w-48 h-48 md:w-56 md:h-56 rounded-2xl overflow-hidden shadow-[0_8px_25px_-10px_rgba(0,0,0,0.25)] shrink-0 group relative">
          <img
            src={student.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id}`}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            alt={student.firstName}
          />
          <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
        </div>

        <div className="flex flex-col h-48 md:h-56 justify-center">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight mb-1">
            {student.prefix}{student.firstName} {student.lastName}
          </h1>
          <p className="text-lg font-bold text-blue-600 mb-1">
            รหัส: {student.studentCode}
          </p>
          <div className="flex items-center gap-2 mb-6">
            <span
              className="px-3 py-0.5 rounded-full text-[11px] font-black text-white shadow-sm"
              style={{ background: statusColor }}
            >
              {STATUS_LABEL[student.status] || 'ไม่ทราบสถานะ'}
            </span>
            {!completion.isComplete && (
              <div className="flex items-center gap-1 bg-rose-50 text-rose-600 px-3 py-0.5 rounded-full text-[11px] font-black border border-rose-100 shadow-sm animate-pulse">
                <AlertCircle size={12} />
                <span>ข้อมูลไม่ครบ</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onEdit}
              className="flex items-center gap-2 px-6 py-2 bg-[#f2f2f7] hover:bg-[#e5e5ea] text-blue-600 rounded-full transition-all font-bold text-[13px]"
            >
              <Pencil size={15} strokeWidth={3} />
              แก้ไขข้อมูล
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onToggleStatus(student.id)}
              className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all font-bold text-[13px] ${isActive ? 'bg-[#f2f2f7] hover:bg-[#e5e5ea] text-blue-600' : 'bg-rose-50 hover:bg-rose-100 text-rose-600'}`}
            >
              <div className={`w-9 h-5 rounded-full p-0.5 flex transition-colors ${isActive ? 'bg-blue-500 justify-end' : 'bg-rose-500 justify-start'}`}>
                <motion.div
                  layout
                  className="w-4 h-4 bg-white rounded-full shadow-sm"
                />
              </div>
              {isActive ? 'พักการเรียน' : 'เปิดสถานะ'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (confirm(`คุณต้องการลบรายชื่อ ${student.prefix}${student.firstName} ใช่หรือไม่?`)) {
                  onDelete(student.id);
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

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-6 pb-12 scrollbar-hide space-y-8 min-h-0 border-t border-slate-100 pt-8">
        <div className="grid grid-cols-2 gap-12">
          {/* Column 1: Info */}
          <div className="space-y-6">
            <div>
              <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-tight mb-4">ข้อมูลส่วนตัว</h3>
              <div className="flex flex-col">
                <InfoRow icon={User} label="เพศ" value={student.gender === 'male' ? 'ชาย' : 'หญิง'} />
                <InfoRow icon={User} label="วันเกิด / อายุ" value={student.birthDate ? `${student.birthDate} (${calcAge(student.birthDate)})` : undefined} />
                <InfoRow icon={Phone} label="เบอร์โทรศัพท์" value={student.phone} />
                <InfoRow icon={Mail} label="อีเมล" value={student.email} />
                <InfoRow icon={MapPin} label="ที่อยู่" value={student.address} />
                <InfoRow icon={Hash} label="Firebase ID" value={student.id} />
              </div>
            </div>

            {(student.guardianFirstName || student.guardianPhone) && (
              <div>
                <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-tight mb-4">ข้อมูลผู้ปกครอง</h3>
                <div className="flex flex-col">
                  <InfoRow icon={User} label="ชื่อผู้ปกครอง" value={`${student.guardianPrefix || ''}${student.guardianFirstName} ${student.guardianLastName || ''}${student.guardianRelation ? ` (${student.guardianRelation})` : ''}`} />
                  <InfoRow icon={Phone} label="เบอร์โทร" value={student.guardianPhone} />
                </div>
              </div>
            )}
          </div>

          {/* Column 2: Enrollment History */}
          <div className="space-y-6">
            <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-tight mb-4 flex items-center gap-2">
              <BookOpen size={18} />
              ประวัติการศึกษา
            </h3>
            {!enrollments || enrollments.length === 0 ? (
              <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-400 font-bold">ยังไม่มีประวัติการลงทะเบียน</p>
              </div>
            ) : (
              <div className="space-y-3">
                {enrollments.map(e => (
                  <div key={e.id} className="group p-4 rounded-xl bg-white border border-slate-100 flex items-center justify-between hover:shadow-sm transition-all">
                    <div>
                      <p className="text-[13px] font-black text-slate-800">{e.className} · ภาคเรียน {e.semester}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">ปีการศึกษา {e.academicYearId}</p>
                    </div>
                    <span
                      className="text-[10px] font-black px-2.5 py-1 rounded-full"
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
      </div>
    </motion.div>
  );
}
