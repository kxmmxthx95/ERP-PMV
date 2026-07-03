import { useMemo } from 'react';
import { HiOutlineChevronRight } from 'react-icons/hi2';
import type { StudentFuturePlan, UniversityChoice } from '@/types/futurePlan';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import { UniversityLogo } from '@/features/futurePlan/components/UniversityLogo';
import { cn } from '@/lib/utils';

function rankChoicesForPlan(plan: StudentFuturePlan): UniversityChoice[] {
  if (plan.planType !== 'continue') return [];

  const byRank = new Map(
    (plan.universityChoices ?? [])
      .filter((c) => c.rank >= 1 && c.rank <= 3)
      .map((c) => [c.rank, c]),
  );

  return [1, 2, 3].map(
    (rank) =>
      byRank.get(rank) ?? {
        rank,
        universityName: '',
        faculty: '',
      },
  );
}

function RankUniversityLogo({ choice }: { choice: UniversityChoice }) {
  const hasSelection = Boolean(choice.universityName.trim());

  return (
    <div
      className={cn(
        'relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border',
        hasSelection ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50',
      )}
      title={hasSelection ? choice.universityName : `อันดับ ${choice.rank}`}
    >
      {hasSelection ? (
        <UniversityLogo
          domain={choice.universityDomain}
          label={choice.universityName}
          size="sm"
          className="size-8 rounded-lg"
        />
      ) : (
        <span className="text-[10px] font-bold text-slate-300">{choice.rank}</span>
      )}
      <span
        className={cn(
          'absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full text-[8px] font-black leading-none',
          choice.rank === 1
            ? 'bg-amber-100 text-amber-700 ring-1 ring-white'
            : 'bg-slate-100 text-slate-500 ring-1 ring-white',
        )}
      >
        {choice.rank}
      </span>
    </div>
  );
}

export function FuturePlanAdminStudentCard({
  plan,
  onClick,
}: {
  plan: StudentFuturePlan;
  onClick: () => void;
}) {
  const rankChoices = useMemo(() => rankChoicesForPlan(plan), [plan]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-left shadow-sm transition-colors hover:bg-slate-50/60"
    >
      <StudentAvatar
        photoURL={plan.photoURL}
        studentId={plan.studentId}
        name={plan.studentName}
        gender={plan.gender}
        className="size-10 shrink-0 rounded-lg border border-white shadow-sm"
      />

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold text-slate-900">{plan.studentName}</h3>
        <p className="truncate text-xs text-slate-500">
          {plan.studentCode ? `รหัส ${plan.studentCode}` : 'ไม่มีรหัสนักเรียน'}
        </p>
      </div>

      {rankChoices.length > 0 && (
        <div className="flex shrink-0 items-center gap-1">
          {rankChoices.map((choice) => (
            <RankUniversityLogo key={choice.rank} choice={choice} />
          ))}
        </div>
      )}

      <span className="flex size-6 shrink-0 items-center justify-center text-slate-400">
        <HiOutlineChevronRight size={14} />
      </span>
    </button>
  );
}
