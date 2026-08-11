import { HiAcademicCap } from 'react-icons/hi2';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { GRADE_LEVEL_ORDER } from '@/types/class';
import { cn } from '@/lib/utils';

type Props = {
  department: Department;
  gradeOptions: string[];
  gradeVersionCounts: Record<string, number>;
  selectedGrade: string;
  onSelectGrade: (grade: string) => void;
};

export default function CurriculumMobileGradeBrowse({
  department,
  gradeOptions,
  gradeVersionCounts,
  selectedGrade,
  onSelectGrade,
}: Props) {
  const sortedGrades = [...gradeOptions].sort(
    (a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99),
  );

  const deptLabel = DEPARTMENT_CONFIG[department]?.label ?? department;

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden font-sukhumvit">
      <div className="shrink-0 px-4 pb-3 pt-2 text-center">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          {deptLabel}
        </p>
        <h2 className="mt-1 text-lg font-black tracking-tight text-foreground">
          เลือกระดับชั้น
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scrollbar-hide px-4 pb-6">
        {sortedGrades.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12px] font-bold text-muted-foreground">
            ไม่พบระดับชั้นในแผนกนี้
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {sortedGrades.map((grade) => {
              const active = selectedGrade === grade;
              const count = gradeVersionCounts[grade] ?? 0;
              return (
                <button
                  key={grade}
                  type="button"
                  onClick={() => onSelectGrade(grade)}
                  className={cn(
                    'flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 transition-all',
                    active
                      ? 'border-foreground bg-foreground text-background shadow-sm'
                      : 'border-border bg-card text-foreground hover:bg-muted/50',
                  )}
                >
                  <HiAcademicCap
                    className={cn('h-4 w-4', active ? 'text-background' : 'text-muted-foreground')}
                  />
                  <span className="text-[13px] font-black font-sukhumvit leading-none">{grade}</span>
                  <span
                    className={cn(
                      'text-[10px] font-bold',
                      active ? 'text-background/75' : 'text-muted-foreground',
                    )}
                  >
                    {count.toLocaleString('th-TH')} หลักสูตร
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
