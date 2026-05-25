import { EVENT_TYPE_CONFIG } from '@/types/calendar';
import { ALL_TYPES, glassCard } from '../constants';

export default function EventLegend() {
  return (
    <div
      className="rounded-[2rem] p-5"
      style={glassCard}
    >
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3.5 font-sukhumvit">
        ประเภทกิจกรรม
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {ALL_TYPES.map(type => {
          const cfg = EVENT_TYPE_CONFIG[type];
          return (
            <div key={type} className="flex items-center gap-2.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{
                  background: cfg.color,
                  boxShadow: `0 0 6px ${cfg.glow}`,
                }}
              />
              <span className="text-[11px] text-slate-500 font-medium font-sarabun truncate">{cfg.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
