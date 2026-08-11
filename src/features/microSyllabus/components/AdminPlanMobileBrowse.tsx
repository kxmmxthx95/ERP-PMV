import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HiAcademicCap, HiChevronDown, HiHomeModern, HiOutlineUserGroup } from 'react-icons/hi2';
import DeptCoverFlow from '@/components/DeptCoverFlow';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import { GRADE_LEVEL_ORDER, type ClassRoom } from '@/types/class';
import { cn } from '@/lib/utils';

export type AdminPlanBrowseMode = 'class' | 'teacher';

export type AdminPlanTeacherEntry = {
  id: string;
  name: string;
  photoURL?: string;
  planCount: number;
  avgPct: number;
};

type Props = {
  selectedDept: string;
  browseMode: AdminPlanBrowseMode;
  gradeOptions: string[];
  yearClasses: ClassRoom[];
  teacherEntries: AdminPlanTeacherEntry[];
  planCountsByDept: Partial<Record<Department, number>>;
  onSelectDept: (dept: Department) => void;
  onBrowseMode: (mode: AdminPlanBrowseMode) => void;
  onSelectClass: (classId: string, gradeLevel: string) => void;
  onSelectTeacher: (teacherId: string) => void;
  departments?: Department[];
};

const AVATAR_COLORS: CSSProperties[] = [
  { background: 'rgba(99,102,241,0.15)', color: '#4338ca' },
  { background: 'rgba(236,72,153,0.15)', color: '#be185d' },
  { background: 'rgba(16,185,129,0.15)', color: '#047857' },
  { background: 'rgba(249,115,22,0.15)', color: '#c2410c' },
  { background: 'rgba(20,184,166,0.15)', color: '#0f766e' },
  { background: 'rgba(168,85,247,0.15)', color: '#7c3aed' },
];

function avatarColor(name: string): CSSProperties {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export default function AdminPlanMobileBrowse({
  selectedDept,
  browseMode,
  gradeOptions,
  yearClasses,
  teacherEntries,
  planCountsByDept,
  onSelectDept,
  onBrowseMode,
  onSelectClass,
  onSelectTeacher,
  departments,
}: Props) {
  const [expandedGrade, setExpandedGrade] = useState<string | null>(null);

  useEffect(() => {
    setExpandedGrade(null);
  }, [selectedDept, browseMode]);

  const sortedGrades = useMemo(
    () =>
      [...gradeOptions].sort(
        (a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99),
      ),
    [gradeOptions],
  );

  const classesByGrade = useMemo(() => {
    const map = new Map<string, ClassRoom[]>();
    if (!selectedDept) return map;
    yearClasses
      .filter((c) => c.departmentId === selectedDept && c.gradeLevel)
      .forEach((room) => {
        const grade = String(room.gradeLevel);
        const list = map.get(grade) ?? [];
        list.push(room);
        map.set(grade, list);
      });
    for (const [grade, list] of map) {
      list.sort((a, b) =>
        (a.roomNumber || a.className).localeCompare(b.roomNumber || b.className, undefined, {
          numeric: true,
        }),
      );
      map.set(grade, list);
    }
    return map;
  }, [yearClasses, selectedDept]);

  const modeToggle = (
    <div className="mx-4 mb-3 grid grid-cols-2 gap-1.5 rounded-2xl border border-border bg-muted/40 p-1">
      {(
        [
          { id: 'class' as const, label: 'รายชั้น', Icon: HiAcademicCap },
          { id: 'teacher' as const, label: 'รายครู', Icon: HiOutlineUserGroup },
        ] as const
      ).map((opt) => {
        const active = browseMode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onBrowseMode(opt.id)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-black font-sukhumvit transition-all',
              active
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <opt.Icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );

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
              title="แผนการสอน"
              subtitle="เลือกแผนกวิชาเพื่อดูแผนการสอนของครูในแต่ละสาย"
              countLabel="แผน"
              selectHint="ดูแผนการสอน"
              counts={planCountsByDept}
              departments={departments}
              onSelectDept={onSelectDept}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`browse-${selectedDept}-${browseMode}`}
            className="flex h-full min-h-0 w-full flex-col overflow-hidden"
            initial={{ opacity: 0, x: 56 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 56 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="shrink-0 px-4 pb-2 pt-2 text-center">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                {DEPARTMENT_CONFIG[selectedDept as Department]?.label ?? selectedDept}
              </p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-foreground">
                {browseMode === 'class' ? 'เลือกระดับชั้น' : 'เลือกครู'}
              </h2>
            </div>

            {modeToggle}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scrollbar-hide px-4 pb-6">
              {browseMode === 'class' ? (
                sortedGrades.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12px] font-bold text-muted-foreground">
                    ไม่พบระดับชั้นในแผนกนี้
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {sortedGrades.map((grade, i) => {
                      const expanded = expandedGrade === grade;
                      const rooms = classesByGrade.get(grade) ?? [];
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
                                className="min-w-0 overflow-hidden"
                              >
                                <div className="border-t border-border px-3 pb-3 pt-2">
                                  {rooms.length === 0 ? (
                                    <p className="py-4 text-center text-[11px] font-bold text-muted-foreground">
                                      ไม่มีห้องในชั้นนี้
                                    </p>
                                  ) : (
                                    <div className="flex flex-col gap-1.5">
                                      {rooms.map((room) => (
                                        <button
                                          key={room.id}
                                          type="button"
                                          onClick={() => onSelectClass(room.id, grade)}
                                          className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                                        >
                                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                            <HiHomeModern className="h-4 w-4" />
                                          </span>
                                          <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[13px] font-black text-foreground">
                                              {room.className}
                                            </span>
                                            <span className="block text-[10px] font-bold text-muted-foreground">
                                              ห้อง {room.roomNumber || '—'}
                                            </span>
                                          </span>
                                        </button>
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
                )
              ) : teacherEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12px] font-bold text-muted-foreground">
                  ไม่พบครูในแผนกนี้
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {teacherEntries.map((entry) => {
                    const initial = entry.name.charAt(0) || '?';
                    const hasPlans = entry.planCount > 0;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => onSelectTeacher(entry.id)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[14px] font-black"
                          style={entry.photoURL ? undefined : avatarColor(entry.name)}
                        >
                          {entry.photoURL ? (
                            <img src={entry.photoURL} alt="" className="h-full w-full object-cover" />
                          ) : (
                            initial
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-black text-foreground">{entry.name}</p>
                          <p className="mt-0.5 text-[10px] font-bold text-muted-foreground">
                            {hasPlans ? `${entry.planCount} วิชา · ${entry.avgPct}%` : 'ยังไม่มีแผน'}
                          </p>
                        </div>
                      </button>
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
