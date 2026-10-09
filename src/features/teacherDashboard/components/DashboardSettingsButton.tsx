// src/features/teacherDashboard/components/DashboardSettingsButton.tsx
// ปุ่มเฟืองที่หัวหน้า + Drawer เลือกวิชาที่นำมาสรุปผลงาน (ตั้งค่ากลาง ใช้กับครูทุกคน)
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineCog6Tooth, HiXMark } from 'react-icons/hi2';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import { HEADER_ICON_BTN } from '@/lib/headerIconBtn';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useTeacherKpiSettings } from '@/hooks/useTeacherKpiSettings';
import { getSchedulesByYearSemesterStore } from '@/lib/firestoreShared/schedulesStore';
import { logActivity } from '@/lib/activityLogger';
import { cn } from '@/lib/utils';

const isActivity = (category?: string) => {
  const c = String(category ?? '').toLowerCase();
  return c === 'activity' || c.includes('กิจกรรม');
};

export function DashboardSettingsButton() {
  const { user } = useAuth();
  const { canDelete } = useMyPermissions();
  const { activeYear, activeSemester } = useActiveAcademicYear();
  const academicYearId = activeYear?.year ?? '';
  const semester = (activeSemester === 2 ? 2 : 1) as 1 | 2;
  const { settings, saveDashboardExcludedSubjects } = useTeacherKpiSettings(academicYearId, semester);
  const { subjects: curriculumSubjects } = useCurriculum();

  const schedulesStore = getSchedulesByYearSemesterStore(academicYearId, semester);
  const schedules = useSyncExternalStore(schedulesStore.subscribe, schedulesStore.getSnapshot, schedulesStore.getSnapshot);

  const [open, setOpen] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const [homeEl, setHomeEl] = useState<HTMLElement | null>(null);
  const [mobileEl, setMobileEl] = useState<HTMLElement | null>(null);
  const [isLgUp, setIsLgUp] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true));
  useEffect(() => {
    setHomeEl(document.getElementById('header-portal-home-actions'));
    setMobileEl(document.getElementById('header-portal-mobile-actions'));
    const onResize = () => setIsLgUp(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // วิชาที่มีในตารางสอนของภาคเรียนนี้ (ตัดวิชากิจกรรม — ถูกตัดอัตโนมัติอยู่แล้ว)
  const subjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    for (const e of schedules) {
      if (map.has(e.subjectId)) continue;
      const cs = curriculumSubjects.find((s) => s.id === e.subjectId || s.code === e.subjectId);
      if (isActivity(cs?.category)) continue;
      map.set(e.subjectId, { id: e.subjectId, name: e.subjectName, code: e.subjectCode });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'th') || a.code.localeCompare(b.code));
  }, [schedules, curriculumSubjects]);

  if (!canDelete('teacherDashboard')) return null; // เฉพาะระดับ full (sysadmin ผ่านอัตโนมัติ)

  const openDrawer = () => {
    setExcluded(new Set(settings.dashboardExcludedSubjectIds ?? []));
    setOpen(true);
  };

  const toggle = (id: string, include: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (include) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      const ids = [...excluded];
      await saveDashboardExcludedSubjects(ids, user?.uid);
      void logActivity({
        action: 'อัปเดตวิชาที่นำมาสรุปผลงานครู',
        category: 'academic',
        status: 'success',
        targetId: `${academicYearId}_${semester}`,
      });
      toast.success('บันทึกวิชาที่นำมาสรุปผลงานแล้ว');
      setOpen(false);
    } catch (err) {
      console.error('[DashboardSettingsButton] save failed', err);
      toast.error('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const button = (
    <button type="button" onClick={openDrawer} className={HEADER_ICON_BTN} title="เลือกวิชาที่นำมาสรุปผลงาน" aria-label="เลือกวิชาที่นำมาสรุปผลงาน">
      <HiOutlineCog6Tooth size={16} />
    </button>
  );

  return (
    <>
      {isLgUp && homeEl && createPortal(button, homeEl)}
      {!isLgUp && mobileEl && createPortal(button, mobileEl)}

      <Drawer open={open} onOpenChange={setOpen} direction="right">
        <DrawerContent
          className={cn(
            'flex h-dvh flex-col bg-transparent p-0 before:hidden',
            'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
            'sm:h-full sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md sm:p-2',
          )}
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden bg-card sm:rounded-4xl sm:border sm:border-border sm:shadow-xl">
            <DrawerHeader className="shrink-0 px-4 pb-2 pt-4">
              <div className="relative flex min-h-10 items-center justify-center">
                <div className="min-w-0 px-12 text-center">
                  <DrawerTitle className="text-base font-black">วิชาที่นำมาสรุปผลงาน</DrawerTitle>
                  <DrawerDescription className="text-xs text-muted-foreground">
                    ใช้กับครูทุกคน · ปีการศึกษา {academicYearId} ภาคเรียนที่ {semester}
                  </DrawerDescription>
                </div>
                <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                  <button type="button" onClick={() => setOpen(false)} className={DRAWER_HEADER_ICON_BTN} aria-label="ปิด">
                    <HiXMark className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </DrawerHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 scrollbar-hide">
              {subjects.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">ยังไม่มีวิชาในตารางสอนของภาคเรียนนี้</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {subjects.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-2xl bg-muted/40 px-4 py-3">
                      <Checkbox checked={!excluded.has(s.id)} onCheckedChange={(v) => toggle(s.id, v === true)} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{s.name}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">{s.code}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <DrawerFooter className="shrink-0 px-4 pb-4">
              <Button className="w-full" onClick={save} disabled={saving}>
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
