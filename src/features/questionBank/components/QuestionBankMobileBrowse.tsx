import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HiAcademicCap, HiOutlineUserGroup } from 'react-icons/hi2';
import DeptCoverFlow from '@/components/DeptCoverFlow';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { GRADE_LEVEL_ORDER } from '@/types/class';
import { cn } from '@/lib/utils';

type Props = {
  selectedDept: string;
  browseMode: 'grade' | 'teacher';
  selectedGrade: string;
  selectedTeacherId: string | null;
  gradeOptions: string[];
  gradeSetCounts: Record<string, number>;
  setCountsByDept: Partial<Record<Department, number>>;
  isStudentView: boolean;
  showTeacherBrowse: boolean;
  canShowSubjectGroups: boolean;
  onSelectDept: (dept: Department) => void;
  onBrowseMode: (mode: 'grade' | 'teacher') => void;
  onSelectGrade: (grade: string) => void;
  subjectGroupNav: ReactNode;
  teacherList: ReactNode;
  /** Default: all departments */
  departments?: Department[];
};

export default function QuestionBankMobileBrowse({
  selectedDept,
  browseMode,
  selectedGrade,
  selectedTeacherId,
  gradeOptions,
  gradeSetCounts,
  setCountsByDept,
  isStudentView,
  showTeacherBrowse,
  canShowSubjectGroups,
  onSelectDept,
  onBrowseMode,
  onSelectGrade,
  subjectGroupNav,
  teacherList,
  departments,
}: Props) {
  const sortedGrades = [...gradeOptions].sort(
    (a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99),
  );

  const deptLabel = selectedDept
    ? DEPARTMENT_CONFIG[selectedDept as Department]?.label ?? selectedDept
    : '';

  const modeTabs = (
    [
      { id: 'grade' as const, label: 'รายชั้น', Icon: HiAcademicCap },
      { id: 'teacher' as const, label: 'รายครู', Icon: HiOutlineUserGroup },
    ] as const
  ).filter((tab) => showTeacherBrowse && !(isStudentView && tab.id === 'teacher'));

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden font-sukhumvit">
      <AnimatePresence mode="wait" initial={false}>
        {!selectedDept ? (
          <motion.div
            key="dept-cover"
            className="flex h-full min-h-0 w-full flex-col"
            initial={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -48 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          >
            {departments && departments.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                <p className="font-sukhumvit text-[13px] font-black text-muted-foreground">
                  ยังไม่ระบุแผนกสังกัดในโปรไฟล์
                </p>
                <p className="text-[11px] font-bold text-muted-foreground/80">
                  ติดต่อผู้ดูแลระบบเพื่อตั้งค่าแผนกในโปรไฟล์ครูหรือผู้ใช้
                </p>
              </div>
            ) : (
              <DeptCoverFlow
                title="คลังข้อสอบ"
                subtitle="เลือกแผนกวิชาเพื่อดูชุดข้อสอบในแต่ละสายการเรียน"
                countLabel="ชุด"
                selectHint="ดูชุดข้อสอบ"
                counts={setCountsByDept}
                departments={departments}
                onSelectDept={onSelectDept}
              />
            )}
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
                เลือกวิธีดูชุดข้อสอบ
              </h2>
            </div>

            {!isStudentView && modeTabs.length > 1 ? (
              <div className="shrink-0 px-4 pb-3">
                <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border bg-muted/40 p-1">
                  {modeTabs.map((tab) => {
                    const active = browseMode === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => onBrowseMode(tab.id)}
                        className={cn(
                          'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[12px] font-black transition-all',
                          active
                            ? 'bg-foreground text-background shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <tab.Icon className="h-4 w-4 shrink-0" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scrollbar-hide px-4 pb-6">
              {browseMode === 'grade' && !canShowSubjectGroups ? (
                <section>
                  <p className="mb-2 px-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    ระดับชั้น
                  </p>
                  {sortedGrades.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12px] font-bold text-muted-foreground">
                      ไม่พบระดับชั้นในแผนกนี้
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {sortedGrades.map((grade) => {
                        const active = selectedGrade === grade;
                        const count = gradeSetCounts[grade] ?? 0;
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
                              {count.toLocaleString('th-TH')} ชุด
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              ) : null}

              {browseMode === 'teacher' && !selectedTeacherId ? teacherList : null}

              {canShowSubjectGroups ? subjectGroupNav : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
