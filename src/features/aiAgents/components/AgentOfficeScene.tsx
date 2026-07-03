import { cn } from '@/lib/utils';
import { aiAgentTheme, aiOfficeFloorBg } from '../aiAgentTheme';
import { OFFICE_AGENT_ZONES, OFFICE_FURNITURE, OFFICE_WALL_INSET } from '../data/officeRoomLayout';
import type { AiAgent } from '../types';

/** Simple 12×16 pixel-style character using CSS grid */
function PixelAgent({ agent, selected }: { agent: AiAgent; selected: boolean }) {
  return (
    <div className="relative flex flex-col items-center">
      {selected && (
        <div className="absolute -inset-3 border-2 border-[#0056FF] rounded-2xl pointer-events-none shadow-[0_0_0_4px_rgba(0,86,255,0.12)]" />
      )}
      <div
        className="grid gap-0"
        style={{
          gridTemplateColumns: 'repeat(12, 4px)',
          gridTemplateRows: 'repeat(16, 4px)',
          imageRendering: 'pixelated',
        }}
      >
        {buildPixelGrid(agent).map((color, i) => (
          <div
            key={i}
            style={{
              width: 4,
              height: 4,
              backgroundColor: color ?? 'transparent',
            }}
          />
        ))}
      </div>
      <span className="mt-1 text-[8px] font-black text-slate-700 tracking-wide max-w-[72px] truncate">
        {agent.name}
      </span>
    </div>
  );
}

function buildPixelGrid(agent: AiAgent): (string | null)[] {
  const skin = agent.skinTone;
  const shirt = agent.shirtColor;
  const hair = '#2d2d2d';
  const pants = '#334155';
  const shoes = '#1e293b';
  const rows: (string | null)[][] = [
    [null, null, null, hair, hair, hair, hair, hair, hair, null, null, null],
    [null, null, hair, hair, hair, hair, hair, hair, hair, hair, null, null],
    [null, null, skin, skin, skin, skin, skin, skin, skin, skin, null, null],
    [null, skin, skin, '#fff', skin, skin, skin, skin, '#fff', skin, skin, null],
    [null, skin, skin, skin, skin, skin, skin, skin, skin, skin, skin, null],
    [null, null, skin, skin, skin, skin, skin, skin, skin, skin, null, null],
    [null, null, null, shirt, shirt, shirt, shirt, shirt, shirt, null, null, null],
    [null, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, null],
    [null, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, null],
    [null, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, null],
    [null, null, shirt, shirt, shirt, shirt, shirt, shirt, shirt, shirt, null, null],
    [null, null, pants, pants, pants, null, null, pants, pants, pants, null, null],
    [null, pants, pants, pants, pants, null, null, pants, pants, pants, pants, null],
    [null, pants, pants, pants, pants, null, null, pants, pants, pants, pants, null],
    [null, shoes, shoes, null, null, null, null, null, null, shoes, shoes, null],
    [null, shoes, shoes, null, null, null, null, null, null, shoes, shoes, null],
  ];
  return rows.flat();
}

function TopDownFurniture({ item }: { item: typeof OFFICE_FURNITURE[number] }) {
  const base = 'absolute pointer-events-none';

  if (item.id.startsWith('desk')) {
    return (
      <div
        className={cn(base, 'rounded-lg border border-black/12 bg-white/95 shadow-sm')}
        style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%` }}
        title={item.label}
      >
        <div className="absolute inset-x-[18%] top-[12%] h-[22%] rounded-sm bg-slate-100 border border-black/8" />
      </div>
    );
  }

  if (item.id.startsWith('monitor')) {
    return (
      <div
        className={cn(base, 'rounded-sm border border-slate-300 bg-slate-800 shadow-sm')}
        style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%` }}
        title={item.label}
      >
        <div className="absolute inset-[2px] rounded-[2px] bg-sky-100/90" />
      </div>
    );
  }

  if (item.id === 'meeting') {
    return (
      <div
        className={cn(base, 'rounded-2xl border border-amber-300/70 bg-amber-100/90 shadow-sm')}
        style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%` }}
        title={item.label}
      >
        <div className="absolute inset-[18%] rounded-xl border border-amber-200/80 bg-amber-50/60" />
      </div>
    );
  }

  if (item.id === 'cabinet') {
    return (
      <div
        className={cn(base, 'rounded-xl border border-amber-200/90 bg-amber-50 shadow-sm flex flex-col gap-[14%] p-[10%]')}
        style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%` }}
        title={item.label}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[18%] rounded-sm bg-amber-100/80 border border-amber-200/60" />
        ))}
      </div>
    );
  }

  if (item.id === 'kpi-board') {
    return (
      <div
        className={cn(base, 'rounded-xl border border-black/10 bg-white/95 shadow-sm flex items-end justify-center pb-1')}
        style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%` }}
        title={item.label}
      >
        <span className="text-[6px] text-emerald-600 font-mono font-bold tracking-tight">▁▂▄█ KPI</span>
      </div>
    );
  }

  if (item.id.startsWith('plant')) {
    return (
      <div
        className={cn(base, 'rounded-full border border-emerald-200/90 bg-emerald-100 shadow-sm')}
        style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%` }}
        title={item.label}
      >
        <div className="absolute inset-[22%] rounded-full bg-emerald-400/50" />
      </div>
    );
  }

  if (item.id === 'cooler') {
    return (
      <div
        className={cn(base, 'rounded-lg border border-sky-200/90 bg-sky-50 shadow-sm')}
        style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%` }}
        title={item.label}
      >
        <div className="absolute inset-x-[20%] top-[8%] h-[28%] rounded-sm bg-sky-200/70" />
        <div className="absolute inset-x-[28%] bottom-[12%] h-[18%] rounded-full bg-sky-300/60" />
      </div>
    );
  }

  if (item.id === 'sofa') {
    return (
      <div
        className={cn(base, 'rounded-2xl border border-violet-200/80 bg-violet-100/90 shadow-sm')}
        style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%` }}
        title={item.label}
      >
        <div className="absolute inset-y-[18%] left-[8%] right-[8%] rounded-xl bg-violet-200/50" />
      </div>
    );
  }

  return null;
}

interface Props {
  agents: AiAgent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function AgentOfficeScene({ agents, selectedId, onSelect }: Props) {
  return (
    <div className={`relative flex-1 min-h-0 h-full overflow-hidden ${aiAgentTheme.panel}`}>
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 rounded-full border border-black/10 bg-white/95 px-2.5 py-1 shadow-sm">
        <span className="text-[8px] font-black tracking-[0.18em] text-[#0056FF] uppercase">Top-Down View</span>
      </div>

      <div
        className="absolute inset-3 sm:inset-4 rounded-2xl overflow-hidden border-[6px] border-slate-300/90 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.5),0_8px_24px_rgba(15,23,42,0.08)]"
        style={{
          background: 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)',
        }}
      >
        <div
          className="absolute rounded-xl overflow-hidden"
          style={{
            top: `${OFFICE_WALL_INSET.top}%`,
            left: `${OFFICE_WALL_INSET.left}%`,
            right: `${OFFICE_WALL_INSET.right}%`,
            bottom: `${OFFICE_WALL_INSET.bottom}%`,
          }}
        >
          <div className="absolute inset-0" style={{ background: aiOfficeFloorBg }} />
          <div className="absolute inset-0 shadow-[inset_0_0_48px_rgba(15,23,42,0.06)] pointer-events-none" />

          {OFFICE_FURNITURE.map((item) => (
            <TopDownFurniture key={item.id} item={item} />
          ))}

          {agents.map((agent) => {
            const zone = OFFICE_AGENT_ZONES[agent.id] ?? agent.position;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => onSelect(agent.id)}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 active:scale-95 z-10"
                style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
              >
                <PixelAgent agent={agent} selected={selectedId === agent.id} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
