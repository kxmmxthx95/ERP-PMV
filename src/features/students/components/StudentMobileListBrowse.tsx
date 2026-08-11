import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HiAcademicCap, HiChevronDown, HiHomeModern } from 'react-icons/hi2';
import DeptCoverFlow from '@/components/DeptCoverFlow';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { GRADE_LEVEL_ORDER, type ClassRoom } from '@/types/class';
import { cn } from '@/lib/utils';

type Props = {
  selectedDept: string;
  gradeOptions: string[];
  yearClassrooms: ClassRoom[];
  studentCountsByDept: Partial<Record<Department, number>>;
  onSelectDept: (dept: Department) => void;
  onSelectRoom: (grade: string, classId: string) => void;
  /** Default: all departments */
  departments?: Department[];
};

function sortRooms(a: ClassRoom, b: ClassRoom) {
  return String(a.roomNumber || a.className).localeCompare(
    String(b.roomNumber || b.className),
    undefined,
    { numeric: true },
  );
}

export default function StudentMobileListBrowse({
  selectedDept,
  gradeOptions,
  yearClassrooms,
  studentCountsByDept,
  onSelectDept,
  onSelectRoom,
  departments,
}: Props) {
  const [expandedGrade, setExpandedGrade] = useState<string | null>(null);

  const sortedGrades = useMemo(
    () =>
      [...gradeOptions].sort(
        (a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99),
      ),
    [gradeOptions],
  );

  const roomsByGrade = useMemo(() => {
    const map = new Map<string, ClassRoom[]>();
    if (!selectedDept) return map;
    yearClassrooms
      .filter((c) => c.departmentId === selectedDept && c.gradeLevel)
      .forEach((c) => {
        const grade = String(c.gradeLevel);
        const list = map.get(grade) ?? [];
        list.push(c);
        map.set(grade, list);
      });
    map.forEach((rooms) => rooms.sort(sortRooms));
    return map;
  }, [yearClassrooms, selectedDept]);

  const roomCountByGrade = useMemo(() => {
    const counts = new Map<string, number>();
    roomsByGrade.forEach((rooms, grade) => {
      counts.set(
        grade,
        rooms.reduce((sum, r) => sum + (r.studentCount ?? 0), 0),
      );
    });
    return counts;
  }, [roomsByGrade]);

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
            <DeptCoverFlow
              title="จัดการนักเรียน"
              subtitle="เลือกแผนกวิชาเพื่อดูรายชื่อนักเรียนในแต่ละสายการเรียน"
              countLabel="คน"
              selectHint="ดูรายชื่อนักเรียน"
              counts={studentCountsByDept}
              departments={departments}
              onSelectDept={onSelectDept}
            />
          </motion.div>
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
                แตะชั้นเพื่อดูห้องเรียน
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
                    const rooms = roomsByGrade.get(grade) ?? [];
                    const studentCount = roomCountByGrade.get(grade) ?? 0;

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
                              {rooms.length} ห้อง
                              {studentCount > 0 ? ` · ${studentCount} คน` : ''}
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
                              className="overflow-hidden"
                            >
                              <div className="border-t border-border px-3 pb-3 pt-1">
                                {rooms.length === 0 ? (
                                  <p className="px-1 py-3 text-center text-[11px] font-bold text-muted-foreground">
                                    ไม่พบห้องเรียน
                                  </p>
                                ) : (
                                  <div className="flex flex-col gap-1.5 pt-2">
                                    {rooms.map((room) => {
                                      const studentCount = room.studentCount ?? 0;
                                      const roomMeta = [
                                        studentCount > 0 ? `${studentCount} นักเรียน` : null,
                                        room.track || null,
                                      ]
                                        .filter(Boolean)
                                        .join(' · ');

                                      return (
                                      <button
                                        key={room.id}
                                        type="button"
                                        onClick={() => onSelectRoom(grade, room.id)}
                                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 active:scale-[0.99]"
                                      >
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card">
                                          <HiHomeModern className="h-4 w-4 text-muted-foreground" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate text-[13px] font-black text-foreground">
                                            {room.className}
                                          </span>
                                          {roomMeta ? (
                                            <span className="block text-[10px] font-bold text-muted-foreground">
                                              {roomMeta}
                                            </span>
                                          ) : null}
                                        </span>
                                      </button>
                                      );
                                    })}
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
