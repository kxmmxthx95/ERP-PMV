import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HiAcademicCap, HiChevronDown } from 'react-icons/hi2';
import DeptCoverFlow from '@/components/DeptCoverFlow';
import ClassCard from '@/features/classes/components/ClassCard';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { GRADE_LEVEL_ORDER, type ClassRoomCard } from '@/types/class';
import { cn } from '@/lib/utils';

type Props = {
  selectedDept: string;
  gradeOptions: string[];
  classCards: ClassRoomCard[];
  classCountsByDept: Partial<Record<Department, number>>;
  onSelectDept: (dept: Department) => void;
  onSelectClass: (classId: string) => void;
  coverTitle?: string;
  coverSubtitle?: string;
  /** Default: all departments */
  departments?: Department[];
};

function deptOfCard(card: ClassRoomCard): string {
  return String(card.classRoom.departmentId || card.classRoom.department || '');
}

export default function ClassMobileBrowse({
  selectedDept,
  gradeOptions,
  classCards,
  classCountsByDept,
  onSelectDept,
  onSelectClass,
  coverTitle = 'จัดการห้องเรียน',
  coverSubtitle = 'เลือกแผนกวิชาเพื่อดูและจัดการห้องเรียนในแต่ละสายการเรียน',
  departments,
}: Props) {
  const [expandedGrade, setExpandedGrade] = useState<string | null>(null);

  useEffect(() => {
    setExpandedGrade(null);
  }, [selectedDept]);

  const sortedGrades = useMemo(
    () =>
      [...gradeOptions].sort(
        (a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99),
      ),
    [gradeOptions],
  );

  const cardsByGrade = useMemo(() => {
    const map = new Map<string, ClassRoomCard[]>();
    if (!selectedDept) return map;
    classCards
      .filter((card) => deptOfCard(card) === selectedDept && card.classRoom.gradeLevel)
      .forEach((card) => {
        const grade = String(card.classRoom.gradeLevel);
        const list = map.get(grade) ?? [];
        list.push(card);
        map.set(grade, list);
      });
    return map;
  }, [classCards, selectedDept]);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden font-sukhumvit">
      <AnimatePresence mode="wait" initial={false}>
        {!selectedDept ? (
          departments?.length === 0 ? (
            <div className="flex h-full min-h-0 flex-col items-center justify-center px-6 text-center">
              <p className="text-[13px] font-black text-muted-foreground font-sukhumvit">
                ไม่พบแผนกสังกัดของบัญชีนี้
              </p>
              <p className="mt-1 text-[11px] font-bold text-muted-foreground/80">
                กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดแผนกวิชา
              </p>
            </div>
          ) : (
          <motion.div
            key="dept-cover"
            className="flex h-full min-h-0 w-full flex-col"
            initial={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -48 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          >
            <DeptCoverFlow
              title={coverTitle}
              subtitle={coverSubtitle}
              countLabel="ห้อง"
              selectHint="ดูห้องเรียน"
              counts={classCountsByDept}
              departments={departments}
              onSelectDept={onSelectDept}
            />
          </motion.div>
          )
        ) : (
          <motion.div
            key={`grades-${selectedDept}`}
            className="flex h-full min-h-0 w-full flex-col overflow-hidden"
            initial={{ opacity: 0, x: 56 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 56 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="shrink-0 px-4 pb-3 pt-2 text-center">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                {DEPARTMENT_CONFIG[selectedDept as Department]?.label ?? selectedDept}
              </p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-foreground">
                เลือกระดับชั้น
              </h2>
              <p className="mt-1 text-[11px] font-bold text-muted-foreground">
                แตะชั้นเพื่อดูห้องเรียน · เลื่อนเมื่อมีมากกว่า 1 ห้อง
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide px-4 pb-6">
              {sortedGrades.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12px] font-bold text-muted-foreground">
                  ไม่พบระดับชั้นในแผนกนี้
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {sortedGrades.map((grade, i) => {
                    const expanded = expandedGrade === grade;
                    const cards = cardsByGrade.get(grade) ?? [];

                    return (
                      <motion.div
                        key={grade}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.25 }}
                        className={cn(
                          'overflow-hidden rounded-2xl border transition-colors',
                          expanded ? 'border-foreground bg-card shadow-sm' : 'border-border bg-card',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedGrade(expanded ? null : grade)}
                          aria-expanded={expanded}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                        >
                          <span
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                              expanded ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
                            )}
                          >
                            <HiAcademicCap className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px] font-black text-foreground">{grade}</span>
                            <span className="block text-[11px] font-bold text-muted-foreground">
                              {cards.length} ห้อง
                            </span>
                          </span>
                          <HiChevronDown
                            className={cn(
                              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300',
                              expanded && 'rotate-180',
                            )}
                          />
                        </button>

                        <AnimatePresence initial={false}>
                          {expanded ? (
                            <motion.div
                              key={`rooms-${grade}`}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                              className="min-w-0 overflow-x-visible overflow-y-hidden"
                            >
                              <div className="min-w-0 border-t border-border px-3 pb-4 pt-3">
                                {cards.length === 0 ? (
                                  <p className="px-1 py-3 text-center text-[11px] font-bold text-muted-foreground">
                                    ไม่พบห้องเรียน
                                  </p>
                                ) : cards.length === 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => onSelectClass(cards[0].classRoom.id)}
                                    className="w-full text-left"
                                    aria-label={cards[0].classRoom.className}
                                  >
                                    <ClassCard card={cards[0]} fill />
                                  </button>
                                ) : (
                                  <div className="flex w-full min-w-0 snap-x snap-mandatory overflow-x-auto overscroll-x-contain scrollbar-hide touch-pan-x">
                                    {cards.map((card) => (
                                      <div
                                        key={card.classRoom.id}
                                        className="box-border w-full shrink-0 grow-0 basis-full snap-center snap-always"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => onSelectClass(card.classRoom.id)}
                                          className="block w-full text-left"
                                          aria-label={card.classRoom.className}
                                        >
                                          <ClassCard card={card} fill />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
