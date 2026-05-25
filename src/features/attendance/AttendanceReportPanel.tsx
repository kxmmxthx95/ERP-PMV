import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import {
  Download, RefreshCw, TrendingUp, Users, Clock, UserX, CalendarDays, ChevronDown,
} from 'lucide-react';
import { useAttendanceMonthly } from '@/hooks/useAttendanceMonthly';
import { useAllLeaveRequests } from '@/hooks/useLeaveRequests';
import type { LeaveRequest } from '@/types/leave';

// ── Helpers ───────────────────────────────────────────────────────────────────
const GLASS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

function getMonthRange(offset = 0): { from: string; to: string; label: string } {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  const y = d.getFullYear();
  const m = d.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const label = d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  return { from, to, label };
}

const RATE_COLOR = (rate: number) =>
  rate >= 90 ? '#059669' : rate >= 75 ? '#f59e0b' : '#e11d48';

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, color, icon: Icon,
}: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ElementType;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{ ...GLASS, borderLeft: `4px solid ${color}` }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-black/40 font-medium truncate">{label}</p>
        <p className="text-xl font-black" style={{ color }}>{value}</p>
        {sub && <p className="text-[10px] text-black/30">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AttendanceReportPanel() {
  const [monthOffset, setMonthOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [deptFilter, setDeptFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'rate' | 'name' | 'absent'>('rate');

  const { staffSummaries, dailyAggregates, loading, fetch } = useAttendanceMonthly();
  const { requests: leaveRequests } = useAllLeaveRequests();

  const monthRange = useMemo(() => getMonthRange(monthOffset), [monthOffset]);

  // Build leaveMap: userId → Set<date>
  const leaveMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    (leaveRequests as LeaveRequest[])
      .filter(r => r.status === 'approved')
      .forEach(r => {
        const cur = new Date(`${r.startDate}T12:00:00`);
        const end = new Date(`${r.endDate}T12:00:00`);
        while (cur <= end) {
          const d = cur.toISOString().slice(0, 10);
          if (!map.has(r.requesterId)) map.set(r.requesterId, new Set());
          map.get(r.requesterId)!.add(d);
          cur.setDate(cur.getDate() + 1);
        }
      });
    return map;
  }, [leaveRequests]);

  const { from, to } = useCustom && customFrom && customTo
    ? { from: customFrom, to: customTo }
    : monthRange;

  useEffect(() => {
    void fetch(from, to, leaveMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  // Filter + sort summaries
  const filtered = useMemo(() => {
    let list = staffSummaries;
    if (deptFilter !== 'all') list = list.filter(s => s.department === deptFilter);
    return [...list].sort((a, b) => {
      if (sortBy === 'rate') return b.attendanceRate - a.attendanceRate;
      if (sortBy === 'absent') return b.absent - a.absent;
      return a.displayName.localeCompare(b.displayName, 'th');
    });
  }, [staffSummaries, deptFilter, sortBy]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = staffSummaries.length;
    if (total === 0) return { avgRate: 0, perfectCount: 0, atRiskCount: 0, totalAbsent: 0 };
    return {
      avgRate: Math.round(staffSummaries.reduce((s, r) => s + r.attendanceRate, 0) / total),
      perfectCount: staffSummaries.filter(r => r.attendanceRate === 100).length,
      atRiskCount: staffSummaries.filter(r => r.attendanceRate < 75).length,
      totalAbsent: staffSummaries.reduce((s, r) => s + r.absent, 0),
    };
  }, [staffSummaries]);

  const departments = useMemo(() => {
    const s = new Set(staffSummaries.map(r => r.department).filter(Boolean) as string[]);
    return [...s].sort();
  }, [staffSummaries]);

  // Chart data: daily trend
  const trendData = useMemo(() => dailyAggregates.map(d => ({
    date: d.date.slice(5),
    มา: d.present,
    สาย: d.late,
    ขาด: d.absent,
  })), [dailyAggregates]);

  // Chart data: top absent staff
  const topAbsentData = useMemo(() =>
    [...staffSummaries]
      .sort((a, b) => b.absent - a.absent)
      .slice(0, 8)
      .map(s => ({
        name: s.displayName.split(' ')[0],
        ขาด: s.absent,
        สาย: s.late,
      })),
    [staffSummaries],
  );

  const handleExport = () => {
    const header = ['ชื่อ', 'แผนก', 'มาตรงเวลา', 'มาสาย', 'ขาดงาน', 'ลา', 'วันทำงาน', '% เข้างาน'];
    const rows = filtered.map(s => [
      s.displayName, s.department ?? '-',
      s.present, s.late, s.absent, s.leave, s.total, `${s.attendanceRate}%`,
    ]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── Controls ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        style={GLASS} className="rounded-2xl p-4 flex flex-wrap items-end gap-3"
      >
        {/* Month picker */}
        <div className="flex flex-col gap-1">
          <p className="text-[10px] text-black/40 font-bold uppercase tracking-wider">ช่วงเวลา</p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setMonthOffset(p => p - 1); setUseCustom(false); }}
              className="w-8 h-8 rounded-lg border border-black/10 flex items-center justify-center text-black/50 hover:bg-black/5"
            >‹</button>
            <div
              className="px-3 h-8 flex items-center text-xs font-bold text-black/70 border border-black/10 rounded-lg cursor-pointer hover:bg-black/5 min-w-[120px] justify-center"
              onClick={() => { setMonthOffset(0); setUseCustom(false); }}
            >
              {useCustom ? `${customFrom} – ${customTo}` : monthRange.label}
            </div>
            <button
              onClick={() => { setMonthOffset(p => p + 1); setUseCustom(false); }}
              disabled={monthOffset >= 0}
              className="w-8 h-8 rounded-lg border border-black/10 flex items-center justify-center text-black/50 hover:bg-black/5 disabled:opacity-30"
            >›</button>
          </div>
        </div>

        {/* Custom range */}
        <div className="flex flex-col gap-1">
          <p className="text-[10px] text-black/40 font-bold uppercase tracking-wider">กำหนดเอง</p>
          <div className="flex items-center gap-1.5">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="h-8 rounded-lg border border-black/10 px-2 text-xs focus:outline-none" />
            <span className="text-black/30 text-xs">—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="h-8 rounded-lg border border-black/10 px-2 text-xs focus:outline-none" />
            <button
              disabled={!customFrom || !customTo}
              onClick={() => setUseCustom(true)}
              className="h-8 px-3 rounded-lg bg-blue-500 text-white text-xs font-bold disabled:opacity-30 hover:bg-blue-600"
            >ค้นหา</button>
          </div>
        </div>

        {/* Dept filter */}
        <div className="flex flex-col gap-1">
          <p className="text-[10px] text-black/40 font-bold uppercase tracking-wider">แผนก</p>
          <div className="relative">
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="h-8 pl-3 pr-7 rounded-lg border border-black/10 text-xs bg-white/70 appearance-none focus:outline-none"
            >
              <option value="all">ทั้งหมด</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-black/30 pointer-events-none" />
          </div>
        </div>

        {/* Sort */}
        <div className="flex flex-col gap-1">
          <p className="text-[10px] text-black/40 font-bold uppercase tracking-wider">เรียงตาม</p>
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="h-8 pl-3 pr-7 rounded-lg border border-black/10 text-xs bg-white/70 appearance-none focus:outline-none"
            >
              <option value="rate">% เข้างาน</option>
              <option value="absent">ขาดงานมากสุด</option>
              <option value="name">ชื่อ</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-black/30 pointer-events-none" />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => fetch(from, to, leaveMap)}
            className="h-8 w-8 rounded-lg border border-black/10 flex items-center justify-center text-black/40 hover:bg-black/5"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExport}
            className="h-8 px-3 rounded-lg bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-600"
          >
            <Download size={13} /> ส่งออก CSV
          </button>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <StatCard label="เข้างานเฉลี่ย" value={`${stats.avgRate}%`}
              sub="ของบุคลากรทั้งหมด" color="#3b82f6" icon={TrendingUp} />
            <StatCard label="เข้างานครบ 100%" value={stats.perfectCount}
              sub="คน" color="#059669" icon={Users} />
            <StatCard label="เสี่ยง (< 75%)" value={stats.atRiskCount}
              sub="คน ต้องติดตาม" color="#e11d48" icon={UserX} />
            <StatCard label="รวมขาดงาน" value={stats.totalAbsent}
              sub="ครั้ง ในช่วงนี้" color="#f59e0b" icon={Clock} />
          </motion.div>

          {/* ── Charts row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily trend */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              style={GLASS} className="rounded-2xl p-5"
            >
              <p className="text-sm font-bold text-black/70 mb-4 flex items-center gap-2">
                <CalendarDays size={16} className="text-blue-500" />
                แนวโน้มรายวัน
              </p>
              {trendData.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-black/20 text-sm">ไม่มีข้อมูล</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="มา" stroke="#059669" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="สาย" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="ขาด" stroke="#e11d48" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </motion.div>

            {/* Top absent bar chart */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              style={GLASS} className="rounded-2xl p-5"
            >
              <p className="text-sm font-bold text-black/70 mb-4 flex items-center gap-2">
                <UserX size={16} className="text-rose-500" />
                ขาดงานสูงสุด 8 อันดับ
              </p>
              {topAbsentData.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-black/20 text-sm">ไม่มีข้อมูล</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topAbsentData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#64748b' }} width={64} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="ขาด" fill="#fca5a5" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="สาย" fill="#fcd34d" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </motion.div>
          </div>

          {/* ── Staff Table ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={GLASS} className="rounded-2xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-black/[0.05] flex items-center justify-between">
              <p className="text-sm font-bold text-black/70">รายละเอียดรายบุคคล</p>
              <p className="text-xs text-black/30">{filtered.length} คน</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-black/[0.02] border-b border-black/[0.05]">
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-black/35 uppercase tracking-wider">#</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-black/35 uppercase tracking-wider">ชื่อ</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-black/35 uppercase tracking-wider">แผนก</th>
                    <th className="px-5 py-3 text-center text-[10px] font-bold text-emerald-600 uppercase tracking-wider">มาตรงเวลา</th>
                    <th className="px-5 py-3 text-center text-[10px] font-bold text-amber-600 uppercase tracking-wider">มาสาย</th>
                    <th className="px-5 py-3 text-center text-[10px] font-bold text-rose-600 uppercase tracking-wider">ขาดงาน</th>
                    <th className="px-5 py-3 text-center text-[10px] font-bold text-violet-600 uppercase tracking-wider">ลา</th>
                    <th className="px-5 py-3 text-center text-[10px] font-bold text-black/35 uppercase tracking-wider">% เข้างาน</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-black/20">ไม่มีข้อมูล</td>
                    </tr>
                  ) : filtered.map((s, i) => {
                    const rate = s.attendanceRate;
                    const rateColor = RATE_COLOR(rate);
                    return (
                      <tr key={s.userId} className={`border-b border-black/[0.04] hover:bg-black/[0.015] ${i % 2 === 0 ? '' : 'bg-black/[0.01]'}`}>
                        <td className="px-5 py-3 text-black/25">{i + 1}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            {s.photoURL
                              ? <img src={s.photoURL} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                              : (
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                  {s.displayName[0]}
                                </div>
                              )}
                            <span className="font-medium text-black/70 truncate max-w-[140px]">{s.displayName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-black/40">{s.department ?? '—'}</td>
                        <td className="px-5 py-3 text-center font-bold text-emerald-600">{s.present}</td>
                        <td className="px-5 py-3 text-center font-bold text-amber-600">{s.late}</td>
                        <td className="px-5 py-3 text-center font-bold text-rose-600">{s.absent}</td>
                        <td className="px-5 py-3 text-center font-bold text-violet-600">{s.leave}</td>
                        <td className="px-5 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="flex-1 max-w-[60px] h-1.5 rounded-full bg-black/10 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${rate}%`, background: rateColor }}
                              />
                            </div>
                            <span className="font-black text-[11px] min-w-[36px] text-right" style={{ color: rateColor }}>
                              {rate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
