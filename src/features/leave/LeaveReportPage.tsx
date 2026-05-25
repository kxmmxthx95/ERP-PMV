import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import LeaveHeaderTabs from './components/LeaveHeaderTabs';
import { CheckCircle2, ClipboardList, Clock, Download, XCircle } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import {
  countDays,
  formatDate,
  useAllLeaveRequests,
  useMyLeaveRequests,
  useStudentLeaveRequests,
} from '@/hooks/useLeaveRequests';
import type { LeaveRequest, LeaveStatus, LeaveType, RequesterType } from '@/types/leave';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';

type StatusFilter = 'all' | LeaveStatus;
type TypeFilter = 'all' | LeaveType;
type RequesterFilter = 'all' | RequesterType;

const STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: 'รอพิจารณา',
  approved: 'อนุมัติ',
  rejected: 'ไม่อนุมัติ',
};

const TYPE_LABEL: Record<LeaveType, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจ',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function defaultStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function leaveOverlapsRange(req: LeaveRequest, startDate: string, endDate: string) {
  return req.endDate >= startDate && req.startDate <= endDate;
}

function toCsv(requests: LeaveRequest[]) {
  const header = ['วันที่เริ่ม', 'วันที่สิ้นสุด', 'จำนวนวัน', 'ผู้ขอ', 'ประเภทผู้ขอ', 'ประเภทการลา', 'สถานะ', 'เหตุผล', 'ผู้อนุมัติ'];
  const rows = requests.map((r) => [
    r.startDate,
    r.endDate,
    String(countDays(r.startDate, r.endDate)),
    r.requesterName,
    r.requesterType === 'student' ? 'นักเรียน' : 'บุคลากร',
    TYPE_LABEL[r.leaveType],
    STATUS_LABEL[r.status],
    (r.reason || '').replaceAll('\n', ' '),
    r.approverName || '-',
  ]);
  return [header, ...rows]
    .map((cols) => cols.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))
    .join('\n');
}

export default function LeaveReportPage() {
  const { user, role } = useAuth();
  const { activeYear } = useActiveAcademicYear();

  const isAdmin = role === 'admin' || role === 'sysadmin';
  const isTeacher = role === 'teacher';
  const requesterType: RequesterType = role === 'student' ? 'student' : 'staff';

  const myHook = useMyLeaveRequests(user?.uid ?? '', requesterType);
  const studentHook = useStudentLeaveRequests();
  const adminHook = useAllLeaveRequests();

  const sourceRequests = isAdmin ? adminHook.requests : isTeacher ? studentHook.requests : myHook.requests;
  const loading = isAdmin ? adminHook.loading : isTeacher ? studentHook.loading : myHook.loading;

  const [startDate, setStartDate] = useState(activeYear?.startDate || defaultStartIso());
  const [endDate, setEndDate] = useState(activeYear?.endDate || todayIso());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [requesterFilter, setRequesterFilter] = useState<RequesterFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [requesterNameById, setRequesterNameById] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    const loadUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        if (!mounted) return;
        const map: Record<string, string> = {};
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const fullName = String(data.name ?? data.displayName ?? '').trim();
          const fallback = String(data.email ?? '').trim();
          const label = fullName || fallback;
          if (label) map[docSnap.id] = label;
        });
        setRequesterNameById(map);
      } catch {
        if (mounted) setRequesterNameById({});
      }
    };
    void loadUsers();
    return () => { mounted = false; };
  }, []);

  const getRequesterDisplayName = useCallback((request: LeaveRequest): string => {
    const resolved = requesterNameById[request.requesterId];
    if (resolved) return resolved;
    return request.requesterName || request.requesterId;
  }, [requesterNameById]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return sourceRequests.filter((r) => {
      const displayName = getRequesterDisplayName(r).toLowerCase();
      if (!leaveOverlapsRange(r, startDate, endDate)) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && r.leaveType !== typeFilter) return false;
      if (requesterFilter !== 'all' && r.requesterType !== requesterFilter) return false;
      if (!q) return true;
      return (
        displayName.includes(q) ||
        r.requesterName.toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q)
      );
    });
  }, [sourceRequests, startDate, endDate, statusFilter, typeFilter, requesterFilter, keyword, getRequesterDisplayName]);

  const summary = useMemo(() => ({
    total: filtered.length,
    approved: filtered.filter((r) => r.status === 'approved').length,
    pending: filtered.filter((r) => r.status === 'pending').length,
    rejected: filtered.filter((r) => r.status === 'rejected').length,
    days: filtered.reduce((sum, r) => sum + countDays(r.startDate, r.endDate), 0),
  }), [filtered]);

  const downloadCsv = useCallback(() => {
    const csvRows = filtered.map((r) => ({ ...r, requesterName: getRequesterDisplayName(r) }));
    const csv = toCsv(csvRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leave-report-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, getRequesterDisplayName, startDate, endDate]);

  const headerCenterPortal = useMemo(() => {
    const el = document.getElementById('header-portal-center');
    if (!el) return null;
    return createPortal(<LeaveHeaderTabs />, el);
  }, []);

  const headerActionsPortal = useMemo(() => {
    const el = document.getElementById('header-portal-right-actions');
    if (!el) return null;
    return createPortal(
      <div className="flex items-center gap-2">
        <button
          onClick={downloadCsv}
          className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-all active:scale-95 shadow-sm"
          title="ส่งออก CSV"
        >
          <Download size={16} />
        </button>
      </div>,
      el
    );
  }, [downloadCsv]);

  return (
    <div className="flex h-full min-h-0 w-full max-w-[1200px] mx-auto flex-col gap-4 pb-10">
      {headerCenterPortal}
      {headerActionsPortal}

      <div className="mb-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300"
          />
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="pending">รอพิจารณา</option>
            <option value="approved">อนุมัติ</option>
            <option value="rejected">ไม่อนุมัติ</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300"
          >
            <option value="all">ทุกประเภทลา</option>
            <option value="sick">ลาป่วย</option>
            <option value="personal">ลากิจ</option>
          </select>

          {(isAdmin || isTeacher) && (
            <select
              value={requesterFilter}
              onChange={(e) => setRequesterFilter(e.target.value as RequesterFilter)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300"
            >
              <option value="all">ทุกประเภทผู้ขอ</option>
              <option value="staff">บุคลากร</option>
              <option value="student">นักเรียน</option>
            </select>
          )}

          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="ค้นหาชื่อ/เหตุผล"
            className={cn(
              "h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300",
              (isAdmin || isTeacher) ? "" : "lg:col-span-2"
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'คำขอทั้งหมด', value: summary.total, icon: ClipboardList, color: 'text-slate-600', bg: 'bg-slate-50/50' },
          { label: 'อนุมัติ', value: summary.approved, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50/50' },
          { label: 'รอพิจารณา', value: summary.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50/50' },
          { label: 'ไม่อนุมัติ', value: summary.rejected, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50/50' },
        ].map((item) => (
          <div key={item.label} className="rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-sm p-5 flex flex-col items-center text-center transition-all hover:shadow-md">
            <div className={cn("mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100", item.color)}>
              <item.icon size={18} strokeWidth={2.5} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
            <p className={cn("mt-1 text-2xl font-black tabular-nums", item.color)}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 rounded-[2.5rem] border-2 border-slate-100 bg-white/90 p-6 shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex h-52 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center gap-2 text-slate-400">
            <ClipboardList size={30} />
            <p className="text-sm font-bold">ไม่พบข้อมูลการลาตามเงื่อนไขที่เลือก</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[860px] border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-2">ผู้ขอ</th>
                  <th className="px-3 py-2">ประเภท</th>
                  <th className="px-3 py-2">ช่วงวันที่</th>
                  <th className="px-3 py-2">จำนวนวัน</th>
                  <th className="px-3 py-2">สถานะ</th>
                  <th className="px-3 py-2">เหตุผล</th>
                  <th className="px-3 py-2">ผู้อนุมัติ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="group">
                    <td className="rounded-l-3xl border-y border-l border-slate-100 bg-white px-5 py-4">
                      <div className="text-sm font-black text-slate-800">{getRequesterDisplayName(r)}</div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {r.requesterType === 'student' ? 'นักเรียน' : 'บุคลากร'}
                      </div>
                    </td>
                    <td className="border-y border-slate-100 bg-white px-5 py-4">
                      <div className="inline-flex rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-600 uppercase">
                        {TYPE_LABEL[r.leaveType]}
                      </div>
                    </td>
                    <td className="border-y border-slate-100 bg-white px-5 py-4">
                      <div className="text-sm font-bold text-slate-600">{formatDate(r.startDate)} - {formatDate(r.endDate)}</div>
                    </td>
                    <td className="border-y border-slate-100 bg-white px-5 py-4">
                      <div className="text-sm font-black text-blue-700">{countDays(r.startDate, r.endDate)} วัน</div>
                    </td>
                    <td className="border-y border-slate-100 bg-white px-5 py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase",
                        r.status === 'approved' ? "bg-emerald-50 text-emerald-600" :
                        r.status === 'rejected' ? "bg-rose-50 text-rose-600" :
                        "bg-amber-50 text-amber-600"
                      )}>
                        <div className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          r.status === 'approved' ? "bg-emerald-500" :
                          r.status === 'rejected' ? "bg-rose-500" :
                          "bg-amber-500"
                        )} />
                        {STATUS_LABEL[r.status]}
                      </div>
                    </td>
                    <td className="border-y border-slate-100 bg-white px-5 py-4">
                      <div className="max-w-xs truncate text-sm font-medium text-slate-500">{r.reason || '-'}</div>
                    </td>
                    <td className="rounded-r-3xl border-y border-r border-slate-100 bg-white px-5 py-4">
                      <div className="text-sm font-bold text-slate-600">{r.approverName || '-'}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
