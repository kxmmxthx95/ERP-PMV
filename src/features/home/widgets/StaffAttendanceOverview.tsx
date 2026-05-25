import { Users } from 'lucide-react';
import { WIDGET_GLASS } from '../widgetStyles';

const MOCK = { present: 38, absent: 4, late: 2, total: 44 };

export default function StaffAttendanceOverview() {
  const presentPct = Math.round((MOCK.present / MOCK.total) * 100);

  return (
    <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-3 w-full">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-emerald-400/20 flex items-center justify-center">
          <Users size={16} className="text-emerald-600" />
        </div>
        <span className="font-bold text-sm text-slate-700">การมาทำงานวันนี้</span>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <span className="text-3xl font-black text-slate-800">{MOCK.present}</span>
          <span className="text-sm text-slate-400 ml-1">/ {MOCK.total} คน</span>
        </div>
        <span className="text-lg font-bold text-emerald-500">{presentPct}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all"
          style={{ width: `${presentPct}%` }}
        />
      </div>

      <div className="flex gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
          ขาด {MOCK.absent}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          สาย {MOCK.late}
        </span>
      </div>
    </div>
  );
}
