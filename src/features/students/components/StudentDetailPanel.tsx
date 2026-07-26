import { Phone, MapPin, User, BookOpen, Pencil, Trash2, X } from 'lucide-react';
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
            <div className="relative px-8 pt-10 pb-4">
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
              <div className="flex items-center justify-center gap-3 mt-6">
                {/* 1. Add/Import Button */}
                <button
                  onClick={onEdit}
                  title="แก้ไขข้อมูล"
                  className="w-11 h-11 rounded-full flex items-center justify-center bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all cursor-pointer"
                >
                  <Pencil size={18} />
                </button>

                {/* 2. Toggle Status / Sync Button */}
                <button
                  onClick={() => onToggleStatus(student.id)}
                  title={isActive ? 'พักการเรียน' : 'เปิดสถานะ'}
                  className={`w-11 h-11 rounded-full flex items-center justify-center border shadow-sm transition-all cursor-pointer ${
                    isActive ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {isActive ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.656 48.656 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3M4.5 12a48.564 48.564 0 00.138 3.662 4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l-3 3m3-3l3-3" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  )}
                </button>

                {/* 3. Delete Button */}
                <button
                  onClick={() => {
                    if (confirm(`ลบ "${student.prefix}${student.firstName} ${student.lastName}" ออกจากระบบ?`)) {
                      onDelete(student.id);
                      onClose();
                    }
                  }}
                  title="ลบข้อมูล"
                  className="w-11 h-11 rounded-full flex items-center justify-center bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 shadow-sm transition-all cursor-pointer"
                >
                  <Trash2 size={18} />
                </button>

                {/* 4. LINE OA Button */}
                <button
                  onClick={() => window.open('https://lin.ee/QKGIt0J', '_blank', 'noopener,noreferrer')}
                  title="เชื่อมต่อ LINE"
                  className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#06c755] hover:bg-[#05b34c] text-white shadow-sm transition-all cursor-pointer"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 5.58 2 10.02c0 2.22 1.09 4.22 2.87 5.61-.17.6-.62 2.45-.71 2.8-.1.43.14.42.3.31.13-.09 2.11-1.43 2.95-2.01.81.23 1.67.35 2.59.35 5.52 0 10-3.58 10-8.02S17.52 2 12 2zm-4.66 11.23H5.85c-.2 0-.37-.17-.37-.37V7.16c0-.2.17-.37.37-.37.2 0 .37.17.37.37v4.97h1.49c.2 0 .37.17.37.37s-.17.36-.37.36zm1.74-.37c0 .2-.17.37-.37.37s-.37-.17-.37-.37V7.16c0-.2.17-.37.37-.37s.37.17.37.37v4.96c0 .01 0 .01 0 0zm4.27 0c0 .1-.04.19-.11.26-.07.07-.16.11-.26.11h-1.63c-.09 0-.17-.03-.23-.09-.07-.07-.1-.15-.1-.24v-4.9c0-.1.04-.19.11-.26.07-.07.16-.11.26-.11h1.6c.1 0 .19.04.26.11.07.07.11.16.11.26.01.2 0 .2-.19.2h-1.41v1.65h1.36c.2 0 .37.17.37.37s-.17.37-.37.37h-1.36v1.65h1.41c.2 0 .37.17.37.37v.01zm3.89-2.19c.14.15.21.32.21.52v2.04c0 .2-.17.37-.37.37s-.37-.17-.37-.37v-2.01c0-.09-.03-.17-.09-.23a.35.35 0 00-.25-.09h-1.04v2.33c0 .2-.17.37-.37.37s-.37-.17-.37-.37V7.16c0-.2.17-.37.37-.37.2 0 .37.17.37.37v1.89h1.04c.2 0 .37.07.51.21l1.19 1.25.13-.15V7.16c0-.2.17-.37.37-.37s.37.17.37.37v2.04c0 .2-.07.38-.21.52l-1.34 1.41 1.4 1.48c.1.1.15.22.15.35 0 .29-.24.52-.53.52-.14 0-.27-.06-.37-.16l-1.44-1.52.01-.01z" />
                  </svg>
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
