// src/features/teacherDashboard/TeacherDashboardPage.tsx
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { IndeterminateProgress } from '@/components/ui/progress';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTeacherDashboardKpi } from '@/hooks/useTeacherDashboardKpi';
import { useTeacherGradeSummary } from '@/hooks/useTeacherGradeSummary';
import { useAuth } from '@/hooks/useAuth';
import { formatGpa } from '@/types/grades';
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
  const { user } = useAuth();
  const { row: me, teacherId, range, classSubjectPairs, attendanceSummary: attendance, isLoading: kpiLoading } = useTeacherDashboardKpi();
  const gpaBySubject = useTeacherGradeSummary([teacherId ?? '', user?.uid ?? ''], classSubjectPairs);

  if (!activeYear) {
    return <p className="p-6 text-sm text-muted-foreground">กรุณาตั้งค่าปีการศึกษาก่อน</p>;
  }
  if (kpiLoading) return <IndeterminateProgress />;
  if (!me) {
    return <p className="p-6 text-sm text-muted-foreground">ไม่พบข้อมูลครูที่ผูกกับบัญชีนี้</p>;
  }

  // บรรทัดแรก = คำนำหน้า+ชื่อ · บรรทัดสอง = นามสกุล (แยกที่ช่องว่างแรก)
  const [firstName, ...rest] = me.name.trim().split(/\s+/);
  const lastName = rest.join(' ');

  return (
    <div className="flex w-full flex-col gap-4 pb-6">
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
                {' · '}ช่วงเก็บค่า {formatThaiDate(range.from)} – {formatThaiDate(range.to)}
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
          {/* รายวิชาที่ได้รับมอบหมาย: เต็มความกว้างและพื้นที่ที่เหลือ */}
          <div className="flex flex-col px-6 pb-6 pt-6 md:px-10 md:pb-10">
            <p className="mb-3 text-sm font-bold text-muted-foreground">รายวิชาที่ได้รับมอบหมาย</p>
            <div className="grid auto-rows-min grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {me.subjectBreakdown.filter((x) => !x.excluded).map((x) => (
                <div key={x.subjectId} className="flex flex-col gap-3 rounded-2xl bg-muted/40 p-5">
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
                  <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-xs">
                    <span className="font-bold text-muted-foreground">เกรดเฉลี่ยนักเรียนทั้งห้อง</span>
                    {(gpaBySubject[x.subjectId] ?? []).length === 0 ? (
                      <span className="text-base font-black">—</span>
                    ) : (
                      gpaBySubject[x.subjectId]
                        .slice()
                        .sort((p, q) => p.className.localeCompare(q.className, 'th'))
                        .map((c) => (
                          <div key={c.classId} className="flex items-baseline justify-between gap-2">
                            <span className="truncate font-bold">{c.className}</span>
                            <span className="tabular-nums">
                              <span className="text-base font-black">{formatGpa(Number(c.avgGpa.toFixed(2)))}</span>
                              <span className="ml-1 text-muted-foreground">({c.n} คน)</span>
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              ))}
              {me.subjectBreakdown.every((x) => x.excluded) && (
                <p className="text-xs text-muted-foreground">ไม่มีรายวิชา</p>
              )}
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
