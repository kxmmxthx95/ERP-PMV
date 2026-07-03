// src/features/home/widgets/LeaveWidget.tsx
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, ChevronRight, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  useMyLeaveRequests,
  useLeaveRequestsSince,
  useStudentLeaveRequests,
} from '@/hooks/useLeaveRequests';
import { getLocalDateString } from '@/lib/dateUtils';
import type { LeaveRequest } from '@/types/leave';
import {
  WIDGET_CARD,
  WIDGET_GLASS,
  WIDGET_STAT_CELL,
  WIDGET_STAT_LABEL,
  WIDGET_STAT_VALUE,
} from '../widgetStyles';

function StatGrid({
  items,
}: {
  items: { label: string; value: number; color: string }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
      {items.map(s => (
        <div key={s.label} className={WIDGET_STAT_CELL}>
          <span className={`${WIDGET_STAT_VALUE} ${s.color}`}>{s.value}</span>
          <span className={WIDGET_STAT_LABEL}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Requester view (student / staff) ─────────────────────────────────────────
function MyLeaveWidget() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const uid = user?.uid ?? '';
  const requesterType = role === 'student' ? 'student' : 'staff';
  const { requests } = useMyLeaveRequests(uid, requesterType);

  const pending = requests.filter(r => r.status === 'pending').length;

  return (
    <div style={WIDGET_GLASS} className={WIDGET_CARD}>
      <div className="flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <span className="font-bold text-sm text-slate-700 truncate">การลาของฉัน</span>
        </div>
        {pending > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 font-bold flex items-center gap-1 shrink-0">
            <Clock size={10} /> {pending} รอ
          </span>
        )}
      </div>

      <StatGrid
        items={[
          { label: 'ทั้งหมด', value: requests.length, color: 'text-slate-700' },
          { label: 'อนุมัติ', value: requests.filter(r => r.status === 'approved').length, color: 'text-emerald-600' },
          { label: 'รอพิจารณา', value: pending, color: 'text-amber-500' },
        ]}
      />

      <div className="mt-auto flex gap-2 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/portal/leave?action=new')}
          className="flex-1 py-2 rounded-full bg-orange-500 text-white text-xs font-black flex items-center justify-center gap-1 hover:bg-orange-600 transition-all active:scale-[0.98]"
        >
          <Plus size={12} /> ยื่นลา
        </button>
        <button
          type="button"
          onClick={() => navigate('/portal/leave')}
          className="flex-1 py-2 rounded-full bg-white/60 text-slate-600 text-xs font-black flex items-center justify-center gap-1 hover:bg-white transition-all active:scale-[0.98]"
        >
          ดูทั้งหมด <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Approver view (teacher / admin) ──────────────────────────────────────────
function ApproverLeaveWidgetContent({ requests }: { requests: LeaveRequest[] }) {
  const navigate = useNavigate();

  const pending = requests.filter(r => r.status === 'pending');
  const approved = requests.filter(r => r.status === 'approved').length;
  const rejected = requests.filter(r => r.status === 'rejected').length;

  return (
    <div style={WIDGET_GLASS} className={WIDGET_CARD}>
      <div className="flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <span className="font-bold text-sm text-slate-700 truncate">คำขอลา</span>
        </div>
        {pending.length > 0 && (
          <motion.span
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 font-bold flex items-center gap-1 shrink-0"
          >
            <Clock size={10} /> {pending.length} รอ
          </motion.span>
        )}
      </div>

      <StatGrid
        items={[
          { label: 'รอพิจารณา', value: pending.length, color: 'text-amber-500' },
          { label: 'อนุมัติ', value: approved, color: 'text-emerald-600' },
          { label: 'ปฏิเสธ', value: rejected, color: 'text-red-500' },
        ]}
      />

      <button
        type="button"
        onClick={() => navigate('/portal/leave')}
        className="mt-auto w-full py-2 rounded-full bg-blue-500 text-white text-xs font-black flex items-center justify-center gap-1.5 hover:bg-blue-600 transition-all active:scale-[0.98] shrink-0"
      >
        จัดการคำขอลา <ChevronRight size={12} />
      </button>
    </div>
  );
}

function AdminLeaveApproverWidget() {
  const sinceDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return getLocalDateString(d);
  }, []);
  const { requests } = useLeaveRequestsSince(sinceDate);
  return <ApproverLeaveWidgetContent requests={requests} />;
}

function TeacherLeaveApproverWidget() {
  const sinceDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return getLocalDateString(d);
  }, []);
  const { requests } = useStudentLeaveRequests(sinceDate);
  return <ApproverLeaveWidgetContent requests={requests} />;
}

export default function LeaveWidget() {
  const { role } = useAuth();
  if (role === 'admin' || role === 'sysadmin') {
    return <AdminLeaveApproverWidget />;
  }
  if (role === 'teacher') {
    return <TeacherLeaveApproverWidget />;
  }
  return <MyLeaveWidget />;
}
