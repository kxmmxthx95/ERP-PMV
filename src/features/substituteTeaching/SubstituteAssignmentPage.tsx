import { useMemo, useState } from 'react';
import { HiUserPlus, HiXMark, HiCalendarDays, HiAcademicCap, HiCheck } from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useSchedule } from '@/hooks/useSchedule';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import { useHomeroomClassesForUser } from '@/hooks/useYearClassesHomeroom';
import { useDailySchedules, type SubstitutionRecord } from '@/hooks/useDailySchedules';
import { resolveTeacherFromAuth, buildTeacherIdentityKeys, matchesTeacherIdentity } from '@/lib/teachers/teacherIdentity';
import { filterTeacherEntriesForSchoolDay, scheduleEntryMatchesTeacher } from '@/features/schedule/utils/syncScheduleTeachers';
import { invalidateSubstitutionsCache } from '@/lib/attendance/substituteAssignments';
import { getLocalDateString } from '@/lib/dateUtils';
import { subjectColorByName } from '@/features/schedule/constants/colors';
import AssignSubstituteModal from './components/AssignSubstituteModal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GLASS } from '@/components/layouts/PortalLayout';
import { SubSubjectGroupBadge } from '@/components/school/SubSubjectGroupBadge';
import { cn } from '@/lib/utils';
import { DEPARTMENT_CONFIG, SUBJECT_GROUP_CONFIG, type SubjectGroupId } from '@/types/curriculum';
import type { ScheduleEntry, SchoolDay } from '@/types/schedule';
import type { TeacherProfile } from '@/types/teacher';

function TeacherMiniAvatar({
  teacher,
  name,
  tone,
}: {
  teacher: TeacherProfile | null;
  name: string;
  tone: 'original' | 'substitute';
}) {
  const initial = (name || '?').charAt(0);
  return (
    <Avatar
      className={cn(
        'size-9 ring-2 ring-background',
        tone === 'original' ? 'z-0' : 'z-10 -ml-2',
      )}
      title={name}
    >
      {teacher?.photoURL && <AvatarImage src={teacher.photoURL} alt={name} />}
      <AvatarFallback
        className={cn(
          'text-[10px] font-black',
          tone === 'original'
            ? 'bg-destructive/15 text-destructive'
            : 'bg-emerald-500/15 text-emerald-700',
        )}
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}

const STATUS_LABEL: Record<SubstitutionRecord['status'], string> = {
  pending: 'รอยืนยัน',
  approved: 'ยืนยันแล้ว',
  rejected: 'ปฏิเสธแล้ว',
};

const STATUS_STYLE: Record<SubstitutionRecord['status'], string> = {
  pending: 'bg-amber-50 text-amber-600',
  approved: 'bg-emerald-50 text-emerald-600',
  rejected: 'bg-destructive/10 text-destructive',
};

function SubstitutionStatusBadge({ status }: { status: SubstitutionRecord['status'] }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold font-sukhumvit ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

type ModalState =
  | { open: false }
  | {
      open: true;
      scope: 'period';
      entry: ScheduleEntry;
      busyTeacherIds: string[];
    }
  | {
      open: true;
      scope: 'rollcall';
      classId: string;
      className: string;
      busyTeacherIds: string[];
    };

function dateToSchoolDay(dateStr: string): SchoolDay | null {
  const day = new Date(`${dateStr}T12:00:00`).getDay();
  return day >= 1 && day <= 5 ? (day as SchoolDay) : null;
}

export default function SubstituteAssignmentPage() {
  const { user, role } = useAuth();
  const { year, activeSemester, isLoaded } = useActiveAcademicYear();
  const { entries, classes } = useSchedule();
  const { teachers, loading: loadingTeachers } = useTeachersCollection();
  const { homeRoomClasses, loading: loadingHomeroom } = useHomeroomClassesForUser(year ?? undefined, user?.uid);
  const semester = (activeSemester ?? 1) as 1 | 2;
  const { substitutions, deleteSubstitution, respondToSubstitution } = useDailySchedules(year ?? null, semester);
  /** admin/sysadmin ดูรายการมอบหมายของครูทุกคน */
  const isAdminViewer = role === 'admin' || role === 'sysadmin';

  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [activeTab, setActiveTab] = useState<'assign' | 'list'>('assign');

  const teacherProfile = useMemo(
    () => (user?.uid ? resolveTeacherFromAuth(user.uid, teachers) : null),
    [teachers, user?.uid],
  );
  const teacherLookupId = user?.uid ?? teacherProfile?.id ?? '';
  const originalTeacherName = teacherProfile?.name ?? user?.displayName ?? 'ครู';
  // สอนแทนอาจถูกบันทึกด้วย teachers/{id} หรือ auth uid ปนกัน — เทียบด้วยชุด identity ทั้งหมดของฉัน
  const identityKeys = useMemo(
    () => buildTeacherIdentityKeys(user?.uid ?? '', teacherProfile),
    [user?.uid, teacherProfile],
  );

  const schoolDay = useMemo(() => dateToSchoolDay(selectedDate), [selectedDate]);

  const myEntriesForDate = useMemo((): ScheduleEntry[] => {
    if (!schoolDay || !year || !teacherLookupId) return [];
    return filterTeacherEntriesForSchoolDay(entries, teacherLookupId, year, semester, schoolDay, teachers, teachers);
  }, [entries, schoolDay, year, semester, teacherLookupId, teachers]);

  const substitutionsForDate = useMemo(
    () => substitutions.filter(s => s.date === selectedDate),
    [substitutions, selectedDate],
  );

  const periodSubstitutionByEntry = useMemo(() => {
    const map = new Map<string, SubstitutionRecord>();
    substitutionsForDate
      .filter(s => s.scope === 'period')
      .forEach(s => map.set(`${s.classId}|${s.period}`, s));
    return map;
  }, [substitutionsForDate]);

  const rollCallSubstitutionByClass = useMemo(() => {
    const map = new Map<string, SubstitutionRecord>();
    substitutionsForDate
      .filter(s => s.scope === 'rollcall')
      .forEach(s => map.set(s.classId, s));
    return map;
  }, [substitutionsForDate]);

  function computeBusyTeacherIds(day: SchoolDay, period: number): string[] {
    if (!year) return [];
    const slotEntries = entries.filter(e => e.day === day && e.period === period);
    const busyByEntries = teachers
      .filter(t => slotEntries.some(e => scheduleEntryMatchesTeacher(e, t.id, year, semester, teachers, teachers)))
      .map(t => t.id);
    const busyBySubstitution = substitutionsForDate
      .filter(s => s.scope === 'period' && s.period === period)
      .map(s => s.substituteTeacherId);
    return [...new Set([...busyByEntries, ...busyBySubstitution])];
  }

  function openPeriodModal(entry: ScheduleEntry) {
    // กันส่งคำขอซ้ำ — คาบนี้มีคำขออยู่แล้ว (ไม่ว่าจะรอยืนยัน/ยืนยันแล้ว/ปฏิเสธแล้ว) ต้องยกเลิกก่อนถึงจะส่งใหม่ได้
    if (periodSubstitutionByEntry.get(`${entry.classId}|${entry.period}`)) return;
    setModal({ open: true, scope: 'period', entry, busyTeacherIds: computeBusyTeacherIds(entry.day, entry.period) });
  }

  function openRollCallModal(classId: string, className: string) {
    if (!schoolDay) return;
    if (rollCallSubstitutionByClass.get(classId)) return;
    // ครูที่ไม่ว่างในการเช็คชื่อเข้าแถวแทน = ครูที่มีคาบสอนในคาบแรกของวันนั้น
    const busyByEntries = teachers
      .filter(t => entries.some(e =>
        e.day === schoolDay && e.period === 1
        && scheduleEntryMatchesTeacher(e, t.id, year ?? '', semester, teachers, teachers),
      ))
      .map(t => t.id);
    const busyBySubstitution = substitutionsForDate
      .filter(s => s.scope === 'rollcall')
      .map(s => s.substituteTeacherId);
    setModal({
      open: true,
      scope: 'rollcall',
      classId,
      className,
      busyTeacherIds: [...new Set([...busyByEntries, ...busyBySubstitution])],
    });
  }

  async function handleCancel(record: SubstitutionRecord) {
    if (!year) return;
    if (!window.confirm(`ยกเลิกมอบหมาย "${record.substituteTeacherName}" สำหรับวันที่ ${record.date}?`)) return;
    await deleteSubstitution(record.id);
    invalidateSubstitutionsCache(year, semester, record.date);
  }

  async function handleRespond(record: SubstitutionRecord, response: 'approved' | 'rejected') {
    await respondToSubstitution(record.id, response);
    if (year) invalidateSubstitutionsCache(year, semester, record.date);
  }

  const pendingForMe = useMemo(
    () => substitutions.filter(s => matchesTeacherIdentity(s.substituteTeacherId, identityKeys) && (s.status ?? 'approved') === 'pending'),
    [substitutions, identityKeys],
  );

  const myList = useMemo(() => {
    const isPendingForMe = (s: SubstitutionRecord) =>
      matchesTeacherIdentity(s.substituteTeacherId, identityKeys) && (s.status ?? 'approved') === 'pending';
    const filtered = isAdminViewer
      ? substitutions
      : substitutions.filter(
          (s) =>
            matchesTeacherIdentity(s.originalTeacherId, identityKeys)
            || matchesTeacherIdentity(s.substituteTeacherId, identityKeys),
        );
    return [...filtered].sort((a, b) => {
      const aPending = isPendingForMe(a);
      const bPending = isPendingForMe(b);
      if (aPending !== bPending) return aPending ? -1 : 1;
      return b.date.localeCompare(a.date);
    });
  }, [substitutions, identityKeys, isAdminViewer]);

  const loading = !isLoaded || loadingTeachers || loadingHomeroom;

  return (
    <div className="flex flex-col gap-4 p-3 sm:p-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'assign' | 'list')}>
        <TabsList className="rounded-xl">
          <TabsTrigger
            value="assign"
            className="rounded-lg hover:bg-transparent hover:text-foreground/60 data-active:bg-foreground data-active:text-background data-active:hover:bg-foreground data-active:hover:text-background dark:hover:text-muted-foreground"
          >
            มอบหมาย
          </TabsTrigger>
          <TabsTrigger
            value="list"
            className="rounded-lg hover:bg-transparent hover:text-foreground/60 data-active:bg-foreground data-active:text-background data-active:hover:bg-foreground data-active:hover:text-background dark:hover:text-muted-foreground"
          >
            รายการ
            {pendingForMe.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-black text-destructive-foreground">
                {pendingForMe.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === 'list' ? (
        <div className="flex flex-col gap-2">
          {myList.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-slate-400 font-sarabun">ยังไม่มีรายการ</p>
          ) : (
            myList.map((record) => {
              const isIncoming = matchesTeacherIdentity(record.substituteTeacherId, identityKeys);
              const isPending = isIncoming && (record.status ?? 'approved') === 'pending';
              const canCancel =
                isAdminViewer
                || matchesTeacherIdentity(record.originalTeacherId, identityKeys);
              const originalTeacher = resolveTeacherFromAuth(record.originalTeacherId, teachers);
              const substituteTeacher = resolveTeacherFromAuth(record.substituteTeacherId, teachers);
              return (
                <div key={record.id} className="flex items-center gap-3 rounded-lg p-3" style={GLASS}>
                  <div className="flex shrink-0 items-center" aria-hidden>
                    <TeacherMiniAvatar
                      teacher={originalTeacher}
                      name={record.originalTeacherName}
                      tone="original"
                    />
                    <TeacherMiniAvatar
                      teacher={substituteTeacher}
                      name={record.substituteTeacherName}
                      tone="substitute"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-black text-slate-800 font-sukhumvit">
                      {record.scope === 'rollcall' ? 'เช็คชื่อเข้าแถวเช้า' : record.subjectName}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 font-sukhumvit">
                      {record.scope === 'period' ? `คาบ ${record.period} · ` : ''}
                      {record.date}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] font-sukhumvit">
                      <span className="font-bold text-destructive">{record.originalTeacherName}</span>
                      <span className="mx-1 text-muted-foreground">→</span>
                      <span className="font-bold text-emerald-600">{record.substituteTeacherName}</span>
                    </p>
                  </div>
                  {isPending ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        className="rounded-full text-muted-foreground hover:text-destructive"
                        onClick={() => handleRespond(record, 'rejected')}
                        title="ปฏิเสธ"
                        aria-label="ปฏิเสธ"
                      >
                        <HiXMark size={14} />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        onClick={() => handleRespond(record, 'approved')}
                        title="ยืนยัน"
                        aria-label="ยืนยัน"
                      >
                        <HiCheck size={14} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <SubstitutionStatusBadge status={record.status ?? 'approved'} />
                      {canCancel && (record.status ?? 'approved') !== 'rejected' && (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="rounded-full text-muted-foreground hover:text-destructive"
                          onClick={() => handleCancel(record)}
                          title="ยกเลิกมอบหมาย"
                          aria-label="ยกเลิกมอบหมาย"
                        >
                          <HiXMark size={14} />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
      <>
      <div className="flex flex-wrap items-center gap-3 rounded-lg p-4" style={GLASS}>
        <HiCalendarDays className="h-5 w-5 shrink-0 text-slate-500" />
        <Label htmlFor="substitute-date" className="text-[12px] font-black text-slate-600 font-sukhumvit">
          เลือกวันที่ต้องการหาครูสอนแทน
        </Label>
        <Input
          id="substitute-date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-auto text-[13px] font-bold"
        />
      </div>

      {loading ? (
        <div className="py-16 text-center text-[12px] text-slate-400 font-sarabun">กำลังโหลดข้อมูล...</div>
      ) : !schoolDay ? (
        <div className="rounded-lg px-4 py-10 text-center text-[12px] text-slate-400 font-sarabun border border-dashed border-slate-200 bg-white/60">
          วันที่เลือกเป็นวันหยุด ไม่มีคาบสอน
        </div>
      ) : (
        <>
          {/* คาบสอนของฉันในวันนี้ */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-foreground font-sukhumvit px-1">
              คาบสอนของฉัน
            </p>
            {myEntriesForDate.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-slate-400 font-sarabun">ไม่มีคาบสอนในวันที่เลือก</p>
            ) : (
              <div className="flex flex-col gap-2">
                {myEntriesForDate.map((entry) => {
                  const existing = periodSubstitutionByEntry.get(`${entry.classId}|${entry.period}`);
                  const color = subjectColorByName(entry.subjectName || '', entry.subjectGroup);
                  const cls = classes.find((c) => c.id === entry.classId);
                  const deptCfg = cls ? DEPARTMENT_CONFIG[cls.department] : undefined;
                  const groupCfg = entry.subjectGroup
                    ? SUBJECT_GROUP_CONFIG[entry.subjectGroup as SubjectGroupId]
                    : undefined;
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 rounded-lg p-3"
                      style={GLASS}
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-black"
                        style={{ background: color.bg, color: color.text }}
                      >
                        {entry.period}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-black text-slate-800 font-sukhumvit">{entry.subjectName}</p>
                        <div className="mt-1 flex flex-col gap-1">
                          <div className="flex flex-nowrap items-center gap-1">
                            {deptCfg && cls && (
                              <SubSubjectGroupBadge
                                maxWidth="70px"
                                label={deptCfg.label}
                                department={cls.department}
                              />
                            )}
                            {cls && (
                              <SubSubjectGroupBadge
                                maxWidth="70px"
                                label={cls.label}
                                gradeLevel={cls.gradeLevel}
                              />
                            )}
                          </div>
                          {groupCfg && (
                            <SubSubjectGroupBadge
                              className="w-fit truncate-none"
                              maxWidth="none"
                              label={groupCfg.name}
                              subjectGroupId={entry.subjectGroup}
                            />
                          )}
                        </div>
                      </div>
                      {existing ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] font-bold text-slate-600 font-sukhumvit">{existing.substituteTeacherName}</span>
                            <SubstitutionStatusBadge status={existing.status ?? 'approved'} />
                          </div>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="rounded-full text-muted-foreground hover:text-destructive"
                            onClick={() => handleCancel(existing)}
                            title="ยกเลิกมอบหมาย"
                            aria-label="ยกเลิกมอบหมาย"
                          >
                            <HiXMark size={14} />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => openPeriodModal(entry)}
                          title="หาครูสอนแทน"
                          aria-label="หาครูสอนแทน"
                        >
                          <HiUserPlus size={14} />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* เช็คชื่อเข้าแถวเช้า (เฉพาะห้องที่เป็นครูประจำชั้น) */}
          {homeRoomClasses.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-foreground font-sukhumvit px-1">
                เช็คชื่อเข้าแถวเช้า (ห้องประจำชั้น)
              </p>
              <div className="flex flex-col gap-2">
                {homeRoomClasses.map((cls) => {
                  const className = (cls as { className?: string }).className || (cls as { label?: string }).label || cls.id;
                  const existing = rollCallSubstitutionByClass.get(cls.id);
                  return (
                    <div key={cls.id} className="flex items-center gap-3 rounded-lg p-3" style={GLASS}>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <HiAcademicCap size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-black text-slate-800 font-sukhumvit">{className}</p>
                        <p className="truncate text-[11px] text-slate-500 font-sukhumvit">เข้าแถวเช้า</p>
                      </div>
                      {existing ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] font-bold text-slate-600 font-sukhumvit">{existing.substituteTeacherName}</span>
                            <SubstitutionStatusBadge status={existing.status ?? 'approved'} />
                          </div>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="rounded-full text-muted-foreground hover:text-destructive"
                            onClick={() => handleCancel(existing)}
                            title="ยกเลิกมอบหมาย"
                            aria-label="ยกเลิกมอบหมาย"
                          >
                            <HiXMark size={14} />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => openRollCallModal(cls.id, className)}
                          title="หาครูเช็คชื่อแทน"
                          aria-label="หาครูเช็คชื่อแทน"
                        >
                          <HiUserPlus size={14} />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
      </>
      )}

      {modal.open && year && (
        <AssignSubstituteModal
          open
          scope={modal.scope}
          date={selectedDate}
          day={schoolDay as SchoolDay}
          classId={modal.scope === 'period' ? modal.entry.classId : modal.classId}
          className={
            modal.scope === 'rollcall'
              ? modal.className
              : classes.find((c) => c.id === modal.entry.classId)?.label
          }
          period={modal.scope === 'period' ? modal.entry.period : undefined}
          subjectId={modal.scope === 'period' ? modal.entry.subjectId : undefined}
          subjectName={modal.scope === 'period' ? modal.entry.subjectName : undefined}
          subjectCode={modal.scope === 'period' ? modal.entry.subjectCode : undefined}
          originalTeacherId={teacherLookupId}
          originalTeacherName={originalTeacherName}
          allTeachers={teachers}
          busyTeacherIds={modal.busyTeacherIds}
          academicYearId={year}
          semester={semester}
          currentUserId={user?.uid ?? ''}
          onClose={() => setModal({ open: false })}
          onAssigned={() => setModal({ open: false })}
        />
      )}
    </div>
  );
}
