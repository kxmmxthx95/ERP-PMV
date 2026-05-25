// src/features/home/widgets/DailyAttendanceSummaryWidget.tsx
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, RefreshCw, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDailyAttendanceSummary } from '@/hooks/useDailyAttendanceSummary';
import { WIDGET_GLASS } from '../widgetStyles';

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function DonutChart({ 
  present, 
  late, 
  leave,
  total, 
  size = 84 
}: { 
  present: number; 
  late: number; 
  leave: number;
  total: number;
  size?: number;
}) {
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  
  const presentPct = total > 0 ? (present / total) * 100 : 0;
  const latePct = total > 0 ? (late / total) * 100 : 0;
  const leavePct = total > 0 ? (leave / total) * 100 : 0;
  
  const presentDash = (presentPct * circumference) / 100;
  const lateDash = (latePct * circumference) / 100;
  const leaveDash = (leavePct * circumference) / 100;
  const combinedPct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
  
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* Total Background */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#f1f5f9"
          strokeWidth={8}
        />
        {/* Leave (Violet) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#8b5cf6"
          strokeWidth={8}
          strokeDasharray={`${presentDash + lateDash + leaveDash} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
        {/* Late (Orange) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#f59e0b"
          strokeWidth={8}
          strokeDasharray={`${presentDash + lateDash} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
        {/* Present (Green) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#10b981"
          strokeWidth={8}
          strokeDasharray={`${presentDash} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[18px] font-black leading-none text-slate-800">
          {combinedPct}%
        </span>
      </div>
    </div>
  );
}

export default function DailyAttendanceSummaryWidget() {
  const navigate = useNavigate();
  const { summaries, today, loading, refresh } = useDailyAttendanceSummary(7);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Trend: compare today vs yesterday
  const yesterday = summaries[summaries.length - 2];
  const trend =
    today && yesterday && yesterday.presentPct > 0
      ? today.presentPct - yesterday.presentPct
      : null;

  const TrendIcon =
    trend === null ? Minus
    : trend > 0   ? TrendingUp
    : trend < 0   ? TrendingDown
    : Minus;

  const trendColor =
    trend === null ? 'text-slate-400'
    : trend > 0   ? 'text-emerald-500'
    : trend < 0   ? 'text-red-500'
    : 'text-slate-400';

  return (
    <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-5 w-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <p className="font-bold text-sm text-slate-700">สรุปการเข้างานรายวัน</p>
            <p className="text-[10px] text-slate-400">บุคลากรในโรงเรียน</p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
          title="รีเฟรช"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Today summary card (Clickable) */}
      {today && (
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/portal/staff-attendance')}
          className="relative overflow-hidden rounded-3xl p-2 flex items-center gap-5 group"
        >
          {/* Donut Chart on the Left */}
          <div className="shrink-0">
            <DonutChart 
              present={today.present} 
              late={today.late} 
              leave={today.leave}
              total={today.total} 
            />
          </div>

          <div className="flex-1 text-left">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              วันนี้ · {fmtDate(todayStr)}
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-800 tabular-nums">
                {today.present + today.late}
              </span>
              <span className="text-sm font-bold text-slate-400">/ {today.total} คน</span>
            </div>
            
    <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-bold">
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span className="text-emerald-600">มา {today.present}</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        <span className="text-amber-500">สาย {today.late}</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
        <span className="text-violet-500">ลา {today.leave}</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
        <span className="text-red-500">ขาด {today.absent}</span>
      </div>
    </div>
          </div>

          <div className="flex flex-col items-end justify-between self-stretch">
            <div className={`flex items-center gap-1 text-[10px] font-black ${trendColor} bg-white/50 px-2 py-0.5 rounded-full border border-white/80 shadow-sm`}>
              <TrendIcon size={10} />
              {trend !== null ? `${Math.abs(trend)}%` : '—'}
            </div>
            <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-slate-300 group-hover:text-blue-500 group-hover:bg-white transition-all duration-300">
              <ChevronRight size={18} />
            </div>
          </div>
        </motion.button>
      )}

    </div>
  );
}
