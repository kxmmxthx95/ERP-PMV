import { EVENT_TYPE_CONFIG } from '@/types/calendar';
import { ALL_TYPES, glassCard } from '../constants';

export default function EventLegend() {
  return (
    <div className="rounded-3xl p-5" style={glassCard}>
      <p className="text-[11px] font-bold text-black/35 uppercase tracking-wider mb-3">ประเภทกิจกรรม</p>
      <div className="space-y-2.5">
        {ALL_TYPES.map(type => {
          const cfg = EVENT_TYPE_CONFIG[type];
          return (
            <div key={type} className="flex items-center gap-3">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.glow}` }}
              />
              <span className="text-xs text-black/55 font-medium">{cfg.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
