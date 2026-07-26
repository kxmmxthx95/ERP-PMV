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

          <div className="flex items-center gap-3 bg-[#f2f2f7]/80 backdrop-blur-md rounded-full p-1.5 border border-slate-200/40 w-fit">
            {/* 1. Add/Import Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onEdit}
              title="แก้ไขข้อมูล"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-all cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </motion.button>

            {/* 2. Edit Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onEdit}
              title="แก้ไขข้อมูล"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-all cursor-pointer"
            >
              <Pencil size={16} />
            </motion.button>

            {/* 3. Toggle Status / Sync Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onToggleStatus(student.id)}
              title={isActive ? 'พักการเรียน' : 'เปิดสถานะ'}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-all cursor-pointer ${
                isActive ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-white text-slate-400 hover:bg-slate-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </motion.button>

            {/* 4. Delete Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (confirm(`คุณต้องการลบรายชื่อ ${student.prefix}${student.firstName} ใช่หรือไม่?`)) {
                  onDelete(student.id);
                }
              }}
              title="ลบข้อมูล"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-rose-500 hover:bg-rose-50 shadow-sm transition-all cursor-pointer"
            >
              <Trash2 size={16} />
            </motion.button>

            {/* 5. LINE OA Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.open('https://lin.ee/QKGIt0J', '_blank', 'noopener,noreferrer')}
              title="เชื่อมต่อ LINE"
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#06c755] hover:bg-[#05b34c] text-white shadow-sm transition-all cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 5.58 2 10.02c0 2.22 1.09 4.22 2.87 5.61-.17.6-.62 2.45-.71 2.8-.1.43.14.42.3.31.13-.09 2.11-1.43 2.95-2.01.81.23 1.67.35 2.59.35 5.52 0 10-3.58 10-8.02S17.52 2 12 2zm-4.66 11.23H5.85c-.2 0-.37-.17-.37-.37V7.16c0-.2.17-.37.37-.37.2 0 .37.17.37.37v4.97h1.49c.2 0 .37.17.37.37s-.17.36-.37.36zm1.74-.37c0 .2-.17.37-.37.37s-.37-.17-.37-.37V7.16c0-.2.17-.37.37-.37s.37.17.37.37v4.96c0 .01 0 .01 0 0zm4.27 0c0 .1-.04.19-.11.26-.07.07-.16.11-.26.11h-1.63c-.09 0-.17-.03-.23-.09-.07-.07-.1-.15-.1-.24v-4.9c0-.1.04-.19.11-.26.07-.07.16-.11.26-.11h1.6c.1 0 .19.04.26.11.07.07.11.16.11.26.01.2 0 .2-.19.2h-1.41v1.65h1.36c.2 0 .37.17.37.37s-.17.37-.37.37h-1.36v1.65h1.41c.2 0 .37.17.37.37v.01zm3.89-2.19c.14.15.21.32.21.52v2.04c0 .2-.17.37-.37.37s-.37-.17-.37-.37v-2.01c0-.09-.03-.17-.09-.23a.35.35 0 00-.25-.09h-1.04v2.33c0 .2-.17.37-.37.37s-.37-.17-.37-.37V7.16c0-.2.17-.37.37-.37.2 0 .37.17.37.37v1.89h1.04c.2 0 .37.07.51.21l1.19 1.25.13-.15V7.16c0-.2.17-.37.37-.37s.37.17.37.37v2.04c0 .2-.07.38-.21.52l-1.34 1.41 1.4 1.48c.1.1.15.22.15.35 0 .29-.24.52-.53.52-.14 0-.27-.06-.37-.16l-1.44-1.52.01-.01z" />
              </svg>
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
