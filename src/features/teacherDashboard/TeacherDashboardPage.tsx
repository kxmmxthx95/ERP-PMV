// src/features/teacherDashboard/TeacherDashboardPage.tsx
import { useEffect, useState } from 'react';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { IndeterminateProgress } from '@/components/ui/progress';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTeacherDashboardKpi } from '@/hooks/useTeacherDashboardKpi';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useAllTeachersDashboard } from '@/hooks/useAllTeachersDashboard';
import { AdminTeacherSummaryTable } from './components/AdminTeacherSummaryTable';
import { useHomeroomClassesForUser } from '@/hooks/useYearClassesHomeroom';
import { HomeroomBehaviorTable } from './components/HomeroomBehaviorTable';
import { DashboardSettingsButton } from './components/DashboardSettingsButton';
import { SubjectAttendanceCalendarDrawer } from './components/SubjectAttendanceCalendarDrawer';
import { KpiBulletBar } from '@/features/teacherKpi/components/KpiBulletBar';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';

function formatThaiDate(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3 } }),
};

export default function TeacherDashboardPage() {
  const { activeYear, activeSemester } = useActiveAcademicYear();
  const { row: me, range, rollCallRange, mySchedule, sessions, teachingDays, today, attendanceSummary: attendance, isLoading: kpiLoading } = useTeacherDashboardKpi();
  const [calendarSubjectId, setCalendarSubjectId] = useState<string | null>(null);
  const { user } = useAuth();
  const { canDelete } = useMyPermissions();
  const isAdmin = canDelete('teacherDashboard'); // ระดับ full: เห็นภาพรวมครูทั้งหมด (sysadmin ผ่านอัตโนมัติ)
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('all');
  const { homeRoomClasses } = useHomeroomClassesForUser(activeYear?.year, user?.uid);
  const isHomeroom = homeRoomClasses.length > 0;
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [slide, setSlide] = useState(0);
  // ลำดับสไลด์: รายวิชา → พฤติกรรมห้อง (ครูประจำชั้น)
  const slideIds = ['subjects', ...(isHomeroom ? ['behavior'] : [])];
  const slideKey = slideIds.join('|');
  // สไลด์ที่เคยปัดมาดูแล้ว — โหลดข้อมูลหนักเมื่อปัดมาดูครั้งแรกเท่านั้น
  const [visited, setVisited] = useState<Set<string>>(() => new Set(['subjects']));

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => {
      const i = carouselApi.selectedScrollSnap();
      setSlide(i);
      const id = slideKey.split('|')[i];
      if (id) setVisited((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    };
    carouselApi.on('select', onSelect);
    return () => { carouselApi.off('select', onSelect); };
  }, [carouselApi, slideKey]);

  // แอดมินเห็นตารางครูทั้งหมดเป็นค่าเริ่มต้น · ถ้าไม่มีแถวครูผูกบัญชี ไม่มีมุมมอง "ของฉัน" ให้สลับไป
  const showAdmin = isAdmin && (viewMode === 'all' || (!kpiLoading && !me));
  const allTeachers = useAllTeachersDashboard(showAdmin);

  const modeToggle = isAdmin && me ? (
    <div className="flex gap-1.5">
      <Button size="xs" variant={showAdmin ? 'default' : 'outline'} onClick={() => setViewMode('all')}>ภาพรวมครูทั้งหมด</Button>
      <Button size="xs" variant={showAdmin ? 'outline' : 'default'} onClick={() => setViewMode('mine')}>ของฉัน</Button>
    </div>
  ) : null;

  if (!activeYear) {
    return <p className="p-6 text-sm text-muted-foreground">กรุณาตั้งค่าปีการศึกษาก่อน</p>;
  }
  if (showAdmin) {
    return (
      <div className="flex w-full flex-col gap-4 pb-6">
        <DashboardSettingsButton />
        {modeToggle}
        <AdminTeacherSummaryTable
          rows={allTeachers.rows}
          loading={allTeachers.loading}
          refreshing={allTeachers.refreshing}
          onReload={allTeachers.reload}
          range={allTeachers.range}
        />
      </div>
    );
  }
  if (kpiLoading) return <IndeterminateProgress />;
  if (!me) {
    return <p className="p-6 text-sm text-muted-foreground">ไม่พบข้อมูลครูที่ผูกกับบัญชีนี้</p>;
  }

  // บรรทัดแรก = คำนำหน้า+ชื่อ · บรรทัดสอง = นามสกุล (แยกที่ช่องว่างแรก)
  const [firstName, ...rest] = me.name.trim().split(/\s+/);
  const lastName = rest.join(' ');

  const subjectCards = (
    <div className="grid auto-rows-min grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {me.subjectBreakdown.filter((x) => !x.excluded).map((x) => (
        <div
          key={x.subjectId}
          role="button"
          tabIndex={0}
          onClick={() => setCalendarSubjectId(x.subjectId)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCalendarSubjectId(x.subjectId); }}
          className="flex cursor-pointer flex-col gap-3 rounded-2xl bg-muted/40 p-5 transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="min-w-0">
            <p className="truncate text-base font-black">{x.subjectName}</p>
            <p className="truncate text-xs text-muted-foreground">{x.subjectCode}</p>
          </div>
          <div className="flex items-end justify-between gap-2">
            <p className="text-4xl font-black tabular-nums leading-none">
              {x.rate === null ? '—' : `${x.rate}%`}
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {x.completedSessions}/{x.expectedSessions} คาบ
            </p>
          </div>
          <KpiBulletBar value={x.rate} />
        </div>
      ))}
      {me.subjectBreakdown.every((x) => x.excluded) && (
        <p className="text-xs text-muted-foreground">ไม่มีรายวิชา</p>
      )}
    </div>
  );

  return (
    <div className="flex w-full flex-col gap-4 pb-6">
      <DashboardSettingsButton />
      {modeToggle}
      {/* Hero: ตัวเลขซ้าย · รูปวงกลม+ชื่อขวา */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
        <Card className="relative gap-0 py-0">
          <div className="grid shrink-0 grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto]">
            {/* ขวา (มือถือขึ้นก่อน): รูปวงกลม อยู่หน้าชื่อ + ตำแหน่ง */}
            <div className="flex items-start justify-end gap-4 px-6 pt-6 md:order-2 md:px-10 md:pt-10">
              <Avatar className="h-16 w-16 shrink-0 md:h-24 md:w-24">
                <AvatarImage src={me.photoURL} alt={me.name} className="object-cover" />
                <AvatarFallback className="text-2xl font-black md:text-4xl">{me.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="text-right">
                <h1 className="text-2xl font-black leading-tight md:text-4xl">
                  {firstName}
                  {lastName && <><br />{lastName}</>}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground md:text-lg">
                  ตำแหน่ง {me.position || DEPARTMENT_CONFIG[me.department]?.label || 'ครู'}
                </p>
              </div>
            </div>

            {/* ซ้าย: ตัวเลขหลัก */}
            <div className="flex flex-col gap-6 px-6 pt-6 md:order-1 md:px-10 md:pt-10">
              <p className="text-xs font-bold text-destructive">
                ปีการศึกษา {activeYear.year} ภาคเรียนที่ {activeSemester}
                {' · '}เวลาปฏิบัติงาน {formatThaiDate(range.from)} – {formatThaiDate(range.to)}
                {' · '}เช็คชื่อรายวิชา {formatThaiDate(rollCallRange.from)} – {formatThaiDate(rollCallRange.to)}
              </p>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-bold text-muted-foreground">เวลาปฏิบัติงาน</p>
                  <p className="text-4xl font-black tabular-nums md:text-5xl">
                    {me.attendanceRate === null ? '—' : `${me.attendanceRate}%`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    มา {me.attendedDays}/{me.workingDays} วัน · สาย {attendance?.late ?? 0} · ขาด {attendance?.absent ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-muted-foreground">การเช็คชื่อรายวิชา</p>
                  <p className="text-4xl font-black tabular-nums md:text-5xl">
                    {me.rollCallRate === null ? '—' : `${me.rollCallRate}%`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {me.completedSessions}/{me.expectedSessions} คาบ
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* สไลด์: รายวิชา → พฤติกรรมห้องประจำชั้น (ครูประจำชั้น) */}
          <div className="flex flex-col px-6 pb-6 pt-6 md:px-10 md:pb-10">
            {slideIds.length > 1 ? (
              <Carousel
                setApi={setCarouselApi}
                opts={{ watchDrag: (_api, evt) => !(evt.target as HTMLElement | null)?.closest?.('[data-no-swipe]') }}
              >
                <CarouselContent>
                  <CarouselItem>
                    <p className="mb-3 text-sm font-bold text-muted-foreground">รายวิชาที่ได้รับมอบหมาย</p>
                    {subjectCards}
                  </CarouselItem>
                  {slideIds.includes('behavior') && (
                    <CarouselItem>
                      <p className="mb-3 text-sm font-bold text-muted-foreground">คะแนนประเมินพฤติกรรมในห้องเรียน</p>
                      {visited.has('behavior') && (
                        <HomeroomBehaviorTable
                          classes={homeRoomClasses}
                          year={activeYear.year}
                          semester={(activeSemester === 2 ? 2 : 1) as 1 | 2}
                        />
                      )}
                    </CarouselItem>
                  )}
                </CarouselContent>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <Button size="icon-sm" variant="outline" onClick={() => carouselApi?.scrollPrev()} disabled={slide === 0} aria-label="สไลด์ก่อนหน้า">
                    <HiChevronLeft className="size-4" />
                  </Button>
                  {slideIds.map((id, i) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => carouselApi?.scrollTo(i)}
                      aria-label={`สไลด์ที่ ${i + 1}`}
                      className={`h-2 rounded-full transition-all ${slide === i ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'}`}
                    />
                  ))}
                  <Button size="icon-sm" variant="outline" onClick={() => carouselApi?.scrollNext()} disabled={slide === slideIds.length - 1} aria-label="สไลด์ถัดไป">
                    <HiChevronRight className="size-4" />
                  </Button>
                </div>
              </Carousel>
            ) : (
              <>
                <p className="mb-3 text-sm font-bold text-muted-foreground">รายวิชาที่ได้รับมอบหมาย</p>
                {subjectCards}
              </>
            )}
          </div>
        </Card>
      </motion.div>
      <SubjectAttendanceCalendarDrawer
        open={!!calendarSubjectId}
        onOpenChange={(o) => { if (!o) setCalendarSubjectId(null); }}
        subject={me.subjectBreakdown.find((x) => x.subjectId === calendarSubjectId) ?? null}
        schedule={mySchedule}
        sessions={sessions}
        workingDays={teachingDays}
        range={rollCallRange}
        today={today}
      />
    </div>
  );
}
