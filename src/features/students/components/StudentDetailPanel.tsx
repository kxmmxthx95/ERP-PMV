import { Phone, MapPin, User, BookOpen, Pencil, Trash2, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Student, Enrollment } from '@/types/student';

interface StudentDetailPanelProps {
  student: Student;
  enrollments: Enrollment[];
  onEdit: () => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
}

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.80)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(0,0,0,0.06)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
};

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

export default function StudentDetailPanel({ student, enrollments, onEdit, onDelete, onToggleStatus }: StudentDetailPanelProps) {
  const isActive = student.status === 'active';
  const statusColor = STATUS_COLOR[student.status];

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
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="h-full overflow-y-auto space-y-4"
    >
      {/* ── Profile Card ── */}
      <div className="rounded-2xl p-5" style={glassCard}>
        <div className="flex items-start justify-between gap-3">
          {/* Avatar + name */}
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
              style={{
                background: student.gender === 'male'
                  ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                  : 'linear-gradient(135deg, #ec4899, #f43f5e)',
              }}
            >
              {student.firstName.charAt(0)}
            </div>
            <div>
              <h2 className="text-base font-bold text-black/85">
                {student.prefix}{student.firstName} {student.lastName}
              </h2>
              {(student.firstNameEn || student.lastNameEn) && (
                <p className="text-xs text-black/40">{student.firstNameEn} {student.lastNameEn}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-medium text-black/50">รหัส {student.studentCode}</span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                  style={{ background: statusColor }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                  {STATUS_LABEL[student.status]}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => onToggleStatus(student.id)}
              title={isActive ? 'พักการศึกษา' : 'คืนสถานะ'}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-black/40 hover:text-black/70 hover:bg-black/06 transition-colors"
            >
              {isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
            </button>
            <button
              onClick={onEdit}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-black/40 hover:text-black/70 hover:bg-black/06 transition-colors"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => {
                if (confirm(`ลบ "${student.prefix}${student.firstName} ${student.lastName}" ออกจากระบบ?`)) {
                  onDelete(student.id);
                }
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Personal Info ── */}
      <div className="rounded-2xl p-4" style={glassCard}>
        <h3 className="text-[11px] font-bold text-black/40 uppercase tracking-widest mb-3">ข้อมูลส่วนตัว</h3>
        <div className="divide-y divide-black/04">
          <InfoRow icon={User} label="เพศ" value={student.gender === 'male' ? 'ชาย' : 'หญิง'} />
          <InfoRow icon={User} label="วันเกิด / อายุ" value={student.birthDate ? `${student.birthDate} (${calcAge(student.birthDate)})` : undefined} />
          <InfoRow icon={User} label="หมู่เลือด" value={student.bloodType} />
          <InfoRow icon={User} label="สัญชาติ" value={student.nationality} />
          <InfoRow icon={User} label="ศาสนา" value={student.religion} />
          <InfoRow icon={MapPin} label="ที่อยู่" value={student.address} />
          {student.allergies && (
            <div className="flex items-start gap-2.5 py-1.5">
              <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-black/35 uppercase tracking-wider">ประวัติแพ้</p>
                <p className="text-xs text-amber-600 font-medium">{student.allergies}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Guardian Info ── */}
      {(student.guardianName || student.guardianPhone) && (
        <div className="rounded-2xl p-4" style={glassCard}>
          <h3 className="text-[11px] font-bold text-black/40 uppercase tracking-widest mb-3">ข้อมูลผู้ปกครอง</h3>
          <div className="divide-y divide-black/04">
            <InfoRow icon={User} label="ชื่อผู้ปกครอง" value={`${student.guardianName}${student.guardianRelation ? ` (${student.guardianRelation})` : ''}`} />
            <InfoRow icon={Phone} label="เบอร์โทร" value={student.guardianPhone} />
          </div>
        </div>
      )}

      {/* ── Enrollment History ── */}
      <div className="rounded-2xl p-4" style={glassCard}>
        <h3 className="text-[11px] font-bold text-black/40 uppercase tracking-widest mb-3 flex items-center gap-2">
          <BookOpen size={13} />
          ประวัติการลงทะเบียน
        </h3>
        {enrollments.length === 0 ? (
          <p className="text-xs text-black/30 text-center py-4">ยังไม่มีประวัติการลงทะเบียน</p>
        ) : (
          <div className="space-y-2">
            {enrollments.map(e => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-black/04 last:border-0">
                <div>
                  <p className="text-xs font-semibold text-black/75">{e.className} · ภาคเรียนที่ {e.semester}</p>
                  <p className="text-[10px] text-black/40">ปีการศึกษา {e.academicYearId} · ลงทะเบียน {e.enrolledAt}</p>
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: e.status === 'studying' ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.15)',
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
    </motion.div>
  );
}
