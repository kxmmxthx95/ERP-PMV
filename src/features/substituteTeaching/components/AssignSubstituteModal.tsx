import { useState } from 'react';
import { HiMagnifyingGlass, HiUserPlus, HiBell, HiCheck, HiXMark } from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useDailySchedules, type SubstitutionScope } from '@/hooks/useDailySchedules';
import { useNotification } from '@/hooks/useNotification';
import { logActivity } from '@/lib/activityLogger';
import { invalidateSubstitutionsCache } from '@/lib/attendance/substituteAssignments';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import { cn } from '@/lib/utils';
import { subjectColorByName } from '@/features/schedule/constants/colors';
import { SubSubjectGroupBadge } from '@/components/school/SubSubjectGroupBadge';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import type { SchoolDay } from '@/types/schedule';
import type { TeacherProfile } from '@/types/teacher';

const DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh flex-col bg-transparent p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md sm:p-2',
);

const DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-col overflow-hidden bg-card',
  'sm:rounded-2xl sm:border sm:border-border sm:shadow-xl',
);

const FORM_INPUT =
  'h-10 rounded-xl border-none bg-slate-50/70 px-4 text-xs font-bold focus-visible:bg-slate-50/90 focus-visible:ring-2 focus-visible:ring-slate-900/20';

const FORM_LABEL = 'pl-1 text-[10px] font-black uppercase tracking-wider text-slate-600';

interface AssignSubstituteModalProps {
  open: boolean;
  scope: SubstitutionScope;
  date: string;
  day: SchoolDay;
  classId: string;
  className?: string;
  period?: number;
  subjectId?: string;
  subjectName?: string;
  subjectCode?: string;
  originalTeacherId: string;
  originalTeacherName: string;
  allTeachers: TeacherProfile[];
  busyTeacherIds: string[];
  academicYearId: string;
  semester: 1 | 2;
  currentUserId: string;
  onClose: () => void;
  onAssigned?: () => void;
}

export default function AssignSubstituteModal({
  open,
  scope,
  date,
  day,
  classId,
  className,
  period,
  subjectId,
  subjectName,
  subjectCode,
  originalTeacherId,
  originalTeacherName,
  allTeachers,
  busyTeacherIds,
  academicYearId,
  semester,
  currentUserId,
  onClose,
  onAssigned,
}: AssignSubstituteModalProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendNotif, setSendNotif] = useState(true);

  const { addSubstitution } = useDailySchedules(academicYearId, semester);
  const { sendSystemNotification } = useNotification();

  const availableTeachers = allTeachers.filter(t =>
    !busyTeacherIds.includes(t.id) && t.id !== originalTeacherId,
  );

  const filtered = availableTeachers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const isRollCall = scope === 'rollcall';
  const color = !isRollCall ? subjectColorByName(subjectName || '') : null;

  const handleSave = async () => {
    if (!selectedId) return;
    const sub = allTeachers.find(t => t.id === selectedId);
    if (!sub) return;

    setSaving(true);
    try {
      const recordId = await addSubstitution({
        date,
        dayOfWeek: day,
        scope,
        classId,
        ...(className ? { classLabel: className } : {}),
        ...(scope === 'period' ? { period, subjectId, subjectName, subjectCode } : {}),
        originalTeacherId,
        originalTeacherName,
        substituteTeacherId: sub.id,
        substituteTeacherName: sub.name,
        reason,
        academicYearId,
        semester,
        createdBy: currentUserId,
      });
      invalidateSubstitutionsCache(academicYearId, semester, date);

      if (sendNotif) {
        const body = isRollCall
          ? `${sub.name} รอยืนยันเช็คชื่อเข้าแถวแทน ${className ?? classId} วันที่ ${date}`
          : `${sub.name} รอยืนยันสอนแทน ${subjectName} คาบที่ ${period} วันที่ ${date}`;
        await sendSystemNotification({
          title: 'รอการยืนยันสอนแทน',
          body,
          type: 'announcement',
          targetRoles: ['teacher', 'admin'],
          targetUIDs: [originalTeacherId, sub.id],
        });
      }

      void logActivity({
        action: 'assign_substitute_teacher',
        category: 'academic',
        status: 'success',
        targetId: recordId,
        detail: isRollCall
          ? `มอบหมาย ${sub.name} เช็คชื่อเข้าแถวแทน ${originalTeacherName} วันที่ ${date}`
          : `มอบหมาย ${sub.name} สอนแทน ${originalTeacherName} วิชา ${subjectName} คาบที่ ${period} วันที่ ${date}`,
        metadata: { scope, classId, date, period, originalTeacherId, substituteTeacherId: sub.id },
      });

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setSaving(false);
        onAssigned?.();
        onClose();
      }, 1200);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  const headerBg = color?.bg ?? '#eef2ff';
  const headerBorder = color?.border ?? 'rgba(99,102,241,0.20)';

  return (
    <Drawer open={open} onOpenChange={(next) => { if (!next) onClose(); }} direction="right">
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <div className={DRAWER_PANEL_CLASS}>
          <DrawerHeader
            className="px-4 pb-3 pt-4 sm:pt-6"
            style={{ background: headerBg, borderBottom: `1.5px solid ${headerBorder}` }}
          >
            <div className="relative flex min-h-10 items-center justify-center">
              <div className="min-w-0 w-full px-10 text-center">
                <DrawerTitle className="text-lg font-black tracking-tight leading-tight">
                  {isRollCall ? (className ?? classId) : subjectName}
                </DrawerTitle>
                <DrawerDescription className="mt-0.5 text-[11px] font-bold text-muted-foreground">
                  {isRollCall ? `เข้าแถวเช้า · ${date}` : `คาบ ${period} · ${date}`}
                </DrawerDescription>
              </div>
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                <button
                  type="button"
                  onClick={onClose}
                  className={DRAWER_HEADER_ICON_BTN}
                  aria-label="ปิด"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              </div>
            </div>
          </DrawerHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <div className="relative">
                <HiMagnifyingGlass
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={13}
                />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="พิมพ์ชื่อครู..."
                  className={cn(FORM_INPUT, 'pl-8')}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 pb-2 scrollbar-hide">
              {filtered.map(t => {
                const active = selectedId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
                      active
                        ? 'border-primary bg-primary shadow-md'
                        : 'border-border bg-card hover:bg-muted',
                    )}
                  >
                    <Avatar className={cn('shrink-0', active ? 'after:border-white/30' : '')}>
                      {t.photoURL && <AvatarImage src={t.photoURL} alt={t.name} />}
                      <AvatarFallback
                        className={cn(
                          'text-[12px] font-black',
                          active ? 'bg-white/20 text-primary-foreground' : 'bg-primary/10 text-primary',
                        )}
                      >
                        {t.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-[11px] font-bold', active ? 'text-primary-foreground' : 'text-foreground')}>
                        {t.name}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <SubSubjectGroupBadge
                          department={t.department}
                          label={DEPARTMENT_CONFIG[t.department].label}
                          className="w-fit truncate-none"
                          maxWidth="none"
                        />
                        {t.position && (
                          <p className={cn('truncate text-[9px]', active ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                            {t.position}
                          </p>
                        )}
                      </div>
                    </div>
                    {active && <HiUserPlus size={14} className="shrink-0 text-primary-foreground/80" />}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-[10px] italic text-muted-foreground">ไม่พบครูที่ว่าง</p>
                </div>
              )}
            </div>

            <div className="space-y-4 border-t border-border px-4 pt-6 pb-5">
              <div className="space-y-1">
                <label className={FORM_LABEL}>เหตุผล</label>
                <Input
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="เช่น ลาป่วย, ธุรกิจ..."
                  className={FORM_INPUT}
                />
              </div>

              <Label className="mt-3 flex items-center gap-2 pb-1 text-[10px] font-bold text-muted-foreground">
                <Switch checked={sendNotif} onCheckedChange={setSendNotif} />
                <HiBell size={11} className={sendNotif ? 'text-primary' : 'text-muted-foreground'} />
                ส่งแจ้งเตือนให้ครูทั้งสองฝ่าย
              </Label>
            </div>

            <DrawerFooter className="border-t border-border px-6 pt-4 pb-6 sm:px-8 sm:pb-8">
              <Button
                type="button"
                onClick={handleSave}
                disabled={!selectedId || saving}
                className="h-10 w-full rounded-xl font-bold"
              >
                {saved ? (
                  <><HiCheck size={14} /> บันทึกสำเร็จ</>
                ) : saving ? (
                  <span className="animate-pulse">กำลังบันทึก...</span>
                ) : (
                  'ยืนยันมอบหมาย'
                )}
              </Button>
            </DrawerFooter>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
