import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HiAcademicCap } from 'react-icons/hi2';
import DeptCoverFlow from '@/components/DeptCoverFlow';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { GRADE_LEVEL_ORDER } from '@/types/class';
import { cn } from '@/lib/utils';

type Props = {
  filterDepartment: Department | 'all';
  filterGradeLevel: string;
  gradeOptions: string[];
  gradeRoomCounts: Record<string, number>;
  roomCountsByDept: Partial<Record<Department, number>>;
  canShowSubjectGroups: boolean;
  onSelectDept: (dept: Department) => void;
  onSelectGrade: (grade: string) => void;
  subjectGroupNav: ReactNode;
  prependContent?: ReactNode;
  /** Default: all departments */
  departments?: Department[];
};

export default function ExamMobileBrowse({
  filterDepartment,
  filterGradeLevel,
  gradeOptions,
  gradeRoomCounts,
  roomCountsByDept,
  canShowSubjectGroups,
  onSelectDept,
  onSelectGrade,
  subjectGroupNav,
  prependContent,
  departments,
}: Props) {
  const selectedDept = filterDepartment === 'all' ? '' : filterDepartment;

  const sortedGrades = [...gradeOptions].sort(
    (a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99),
  );

  const deptLabel = selectedDept
    ? DEPARTMENT_CONFIG[selectedDept as Department]?.label ?? selectedDept
    : '';

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden font-sukhumvit">
      {selectedDept ? prependContent : null}
      <AnimatePresence mode="wait" initial={false}>
        {!selectedDept ? (
          <motion.div
            key="dept-cover"
            className="flex h-full min-h-0 w-full flex-col"
            initial={{ opacity: 1, x: 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -48 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          >
            <DeptCoverFlow
              title="ห้องสอบออนไลน์"
              subtitle="เลือกแผนกวิชาเพื่อดูห้องสอบในแต่ละสายการเรียน"
              countLabel="ห้อง"
              selectHint="ดูห้องสอบ"
              counts={roomCountsByDept}
              departments={departments}
              onSelectDept={onSelectDept}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`browse-${selectedDept}`}
            className="flex h-full min-h-0 w-full flex-col overflow-hidden"
            initial={{ opacity: 0, x: 56 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 56 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="shrink-0 px-4 pb-3 pt-2 text-center">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                {deptLabel}
              </p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-foreground">
                {canShowSubjectGroups ? 'เลือกกลุ่มสาระ' : 'เลือกระดับชั้น'}
              </h2>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scrollbar-hide px-4 pb-6">
              {!canShowSubjectGroups ? (
                <section>
                  {sortedGrades.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12px] font-bold text-muted-foreground">
                      ไม่พบระดับชั้นในแผนกนี้
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {sortedGrades.map((grade) => {
                        const active = filterGradeLevel === grade;
                        const count = gradeRoomCounts[grade] ?? 0;
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
                            <HiAcademicCap className={cn('h-4 w-4', active ? 'text-background' : 'text-muted-foreground')} />
                            <span className="text-[13px] font-black font-sukhumvit leading-none">{grade}</span>
                            <span
                              className={cn(
                                'text-[10px] font-bold',
                                active ? 'text-background/75' : 'text-muted-foreground',
                              )}
                            >
                              {count.toLocaleString('th-TH')} ห้อง
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              ) : null}

              {canShowSubjectGroups ? subjectGroupNav : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
