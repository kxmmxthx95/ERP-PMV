// src/features/home/widgets/LeaveWidget.tsx
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, Clock, Check, X, ChevronRight, Plus, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  useMyLeaveRequests,
  useApproverLeaveRequests,
  useAllLeaveRequests,
  useStudentLeaveRequests,
  formatDate,
  countDays,
} from '@/hooks/useLeaveRequests';
import type { LeaveRequest, LeaveStatus } from '@/types/leave';
import { WIDGET_GLASS } from '../widgetStyles';

const STATUS_DOT: Record<LeaveStatus, { color: string; label: string }> = {
  pending:  { color: 'bg-amber-400',   label: 'รอพิจารณา' },
  approved: { color: 'bg-emerald-400', label: 'อนุมัติ' },
  rejected: { color: 'bg-red-400',     label: 'ไม่อนุมัติ' },
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจ',
};

function RequestRow({ req }: { req: LeaveRequest }) {
  const s = STATUS_DOT[req.status];
  const days = countDays(req.startDate, req.endDate);
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/40">
      <span className={`w-2 h-2 rounded-full shrink-0 ${s.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 truncate">
          {LEAVE_TYPE_LABEL[req.leaveType] ?? req.leaveType}
        </p>
        <p className="text-[10px] text-slate-400">{formatDate(req.startDate)} · {days} วัน</p>
      </div>
      <span className="text-[10px] font-semibold text-slate-400 shrink-0">{s.label}</span>
    </div>
  );
}

// ── Requester view (student / staff) ─────────────────────────────────────────
function MyLeaveWidget() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const uid = user?.uid ?? '';
  const requesterType = role === 'student' ? 'student' : 'staff';
  const { requests, loading } = useMyLeaveRequests(uid, requesterType);

  const pending  = requests.filter(r => r.status === 'pending').length;
  const recent   = requests.slice(0, 3);

  return (
    <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-3 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-400/20 flex items-center justify-center">
            <ClipboardList size={15} className="text-orange-500" />
          </div>
          <span className="font-bold text-sm text-slate-700">การลาของฉัน</span>
        </div>
        {pending > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 font-bold flex items-center gap-1">
            <Clock size={10} /> {pending} รอ
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'ทั้งหมด',    value: requests.length,                          color: 'text-slate-700' },
          { label: 'อนุมัติ',   value: requests.filter(r => r.status === 'approved').length, color: 'text-emerald-600' },
          { label: 'รอพิจารณา', value: pending,                                   color: 'text-amber-500' },
        ].map(s => (
          <div key={s.label} className="flex flex-col items-center py-2 rounded-xl bg-white/40">
            <span className={`text-lg font-black tabular-nums ${s.color}`}>{s.value}</span>
            <span className="text-[10px] text-slate-400">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Recent list */}
      <div className="flex flex-col gap-1.5">
        {loading ? (
          <div className="text-center py-3 text-xs text-slate-400">กำลังโหลด...</div>
        ) : recent.length === 0 ? (
          <div className="text-center py-3 text-xs text-slate-400">ยังไม่มีคำขอลา</div>
        ) : (
          recent.map(r => <RequestRow key={r.id} req={r} />)
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => navigate('/portal/leave?action=new')}
          className="flex-1 py-2.5 rounded-full bg-orange-500 text-white text-xs font-black flex items-center justify-center gap-1 hover:bg-orange-600 transition-all active:scale-[0.98]"
        >
          <Plus size={12} /> ยื่นลา
        </button>
        <button
          onClick={() => navigate('/portal/leave')}
          className="flex-1 py-2.5 rounded-full bg-white/60 text-slate-600 text-xs font-black flex items-center justify-center gap-1 hover:bg-white hover:shadow-sm transition-all active:scale-[0.98]"
        >
          ดูทั้งหมด <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Approver view (teacher / admin) ──────────────────────────────────────────
function ApproverLeaveWidget() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const uid = user?.uid ?? '';

  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin' || role === 'sysadmin';

  // Use student hook for teachers, all hook for admins, or specific approver hook for others
  const studentHook = useStudentLeaveRequests();
  const adminHook = useAllLeaveRequests();
  const approverHook = useApproverLeaveRequests(uid);

  const { requests, loading } = isAdmin ? adminHook : (isTeacher ? studentHook : approverHook);

  const pending = requests.filter(r => r.status === 'pending');
  const approved = requests.filter(r => r.status === 'approved').length;
  const rejected = requests.filter(r => r.status === 'rejected').length;
  const recent   = pending.slice(0, 3);

  return (
    <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-3 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-400/20 flex items-center justify-center">
            <ClipboardList size={15} className="text-orange-500" />
          </div>
          <span className="font-bold text-sm text-slate-700">คำขอลา</span>
        </div>
        {pending.length > 0 && (
          <motion.span
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 font-bold flex items-center gap-1"
          >
            <Clock size={10} /> {pending.length} รอ
          </motion.span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'รอพิจารณา', value: pending.length, color: 'text-amber-500',   Icon: Clock },
          { label: 'อนุมัติ',   value: approved,        color: 'text-emerald-600', Icon: Check },
          { label: 'ปฏิเสธ',   value: rejected,        color: 'text-red-500',     Icon: X },
        ].map(s => (
          <div key={s.label} className="flex flex-col items-center py-2 rounded-xl bg-white/40">
            <span className={`text-lg font-black tabular-nums ${s.color}`}>{s.value}</span>
            <span className="text-[10px] text-slate-400">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Pending preview */}
      <div className="flex flex-col gap-1.5">
        {loading ? (
          <div className="text-center py-3 text-xs text-slate-400">กำลังโหลด...</div>
        ) : recent.length === 0 ? (
          <div className="text-center py-3 text-xs text-slate-400">ไม่มีคำขอลาที่รอดำเนินการ</div>
        ) : (
          recent.map(r => (
            <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/40 hover:bg-white/60 transition-colors cursor-pointer group">
              {/* Avatar / Photo */}
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center border border-white shadow-sm">
                  {r.requesterPhotoUrl ? (
                    <img src={r.requesterPhotoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={16} className="text-slate-400" />
                  )}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${STATUS_DOT[r.status].color}`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 truncate group-hover:text-orange-600 transition-colors">
                  {r.requesterName || 'ไม่ระบุชื่อ'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {LEAVE_TYPE_LABEL[r.leaveType]} · {formatDate(r.startDate)}
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold text-slate-400">
                  {STATUS_DOT[r.status].label}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={() => navigate('/portal/leave')}
        className="w-full py-2.5 rounded-full bg-orange-500 text-white text-xs font-black flex items-center justify-center gap-1.5 hover:bg-orange-600 transition-all active:scale-[0.98]"
      >
        จัดการคำขอลา <ChevronRight size={12} />
      </button>
    </div>
  );
}

// ── Exported widget — auto-switches by role ───────────────────────────────────
export default function LeaveWidget() {
  const { role } = useAuth();
  if (role === 'teacher' || role === 'admin' || role === 'sysadmin') {
    return <ApproverLeaveWidget />;
  }
  return <MyLeaveWidget />;
}
