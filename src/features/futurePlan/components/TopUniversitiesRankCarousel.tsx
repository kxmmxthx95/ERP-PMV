import { useState } from 'react';
import type { UniversityRankEntry } from '@/features/futurePlan/utils/futurePlanAdminStats';
import { UniversityLogo } from '@/features/futurePlan/components/UniversityLogo';
import { cn } from '@/lib/utils';

const RANKS = [1, 2, 3] as const;
type ChoiceRank = (typeof RANKS)[number];

function TopUniversityList({ entries }: { entries: UniversityRankEntry[] }) {
  const maxCount = entries[0]?.count ?? 1;

  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีข้อมูล</p>;
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry, index) => (
        <li key={entry.key} className="flex items-center gap-3">
          <div className="relative shrink-0">
            <UniversityLogo
              domain={entry.domain}
              label={entry.name}
              size="md"
              className="size-9 rounded-lg"
            />
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[9px] font-black leading-none ring-1 ring-white',
                index === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500',
              )}
            >
              {index + 1}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{entry.name}</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#0056FF]"
                style={{ width: `${(entry.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
          <span className="shrink-0 text-sm font-black text-[#0056FF] tabular-nums">
            {entry.count}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function TopUniversitiesRankCarousel({
  topByRank,
}: {
  topByRank: Record<ChoiceRank, UniversityRankEntry[]>;
}) {
  const [activeRank, setActiveRank] = useState<ChoiceRank>(1);
  const hasAnyData = RANKS.some((rank) => topByRank[rank].length > 0);

  if (!hasAnyData) {
    return <p className="py-6 text-center text-sm text-slate-400">ยังไม่มีข้อมูลมหาวิทยาลัย</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p
          className={cn(
            'text-xs font-black',
            activeRank === 1 ? 'text-amber-700' : 'text-[#0056FF]',
          )}
        >
          อันดับ {activeRank}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {RANKS.map((rank) => (
            <button
              key={rank}
              type="button"
              onClick={() => setActiveRank(rank)}
              aria-pressed={activeRank === rank}
              aria-label={`ดูมหาวิทยาลัยอันดับที่ ${rank}`}
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-xs font-black transition-all',
                activeRank === rank
                  ? cn(
                      'shadow-sm',
                      rank === 1 ? 'bg-amber-500 text-white' : 'bg-[#0056FF] text-white',
                    )
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600',
              )}
            >
              {rank}
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
        <TopUniversityList entries={topByRank[activeRank]} />
      </section>
    </div>
  );
}
