import { GraduationCap, BookOpen, School } from 'lucide-react';
import { WIDGET_GLASS } from '../widgetStyles';

const STATS = [
  { label: 'นักเรียน', value: '1,248', icon: GraduationCap, color: '#6366f1' },
  { label: 'ครู', value: '87', icon: BookOpen, color: '#ec4899' },
  { label: 'ห้องเรียน', value: '42', icon: School, color: '#10b981' },
];

export default function SchoolStatWidget() {
  return (
    <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-3 w-full">
      <span className="font-bold text-sm text-slate-700">สถิติโรงเรียน</span>
      <div className="grid grid-cols-3 gap-2">
        {STATS.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex flex-col items-center gap-1 py-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${s.color}22` }}
              >
                <Icon size={16} style={{ color: s.color }} />
              </div>
              <span className="text-lg font-black text-slate-800">{s.value}</span>
              <span className="text-[10px] text-slate-400">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
