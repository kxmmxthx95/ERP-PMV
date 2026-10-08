// src/features/teacherDashboard/TeacherDashboardPage.tsx
import { motion } from 'framer-motion';
import {
  HiOutlineAcademicCap,
  HiOutlineBriefcase,
  HiOutlineChartBar,
  HiOutlineClipboardDocumentCheck,
} from 'react-icons/hi2';
import type { IconType } from 'react-icons';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { IndeterminateProgress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTeacherDashboardKpi } from '@/hooks/useTeacherDashboardKpi';
import { useTeacherGradeSummary, GRADE_DISTRIBUTION_LETTERS } from '@/hooks/useTeacherGradeSummary';
import PersonalAttendanceCalendarPanel from '@/features/home/widgets/PersonalAttendanceCalendarPanel';
import { KpiBulletBar } from '@/features/teacherKpi/components/KpiBulletBar';
import { formatGpa } from '@/types/grades';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import { cn } from '@/lib/utils';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3 } }),
};

function StatCard({
  index, icon: Icon, label, value, sub,
}: { index: number; icon: IconType; label: string; value: string; sub: string }) {
  return (
    <motion.div custom={index} variants={fadeUp} initial="hidden" animate="show">
      <Card size="sm" className="h-full">
        <CardContent className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-2xl font-black tabular-nums leading-tight">{value}</p>
            <p className="truncate text-xs text-muted-foreground">{sub}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: IconType; children: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="text-sm font-black">{children}</h2>
    </div>
  );
}

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const { activeYear, activeSemester } = useActiveAcademicYear();
  const { row: me, teacherId, attendanceSummary: attendance, isLoading: kpiLoading } = useTeacherDashboardKpi();
  const { data: grades } = useTeacherGradeSummary(
    [teacherId ?? '', user?.uid ?? ''],
  );

  if (!activeYear) {
    return <p className="p-6 text-sm text-muted-foreground">กรุณาตั้งค่าปีการศึกษาก่อน</p>;
  }
  if (kpiLoading) return <IndeterminateProgress />;
  if (!me) {
    return <p className="p-6 text-sm text-muted-foreground">ไม่พบข้อมูลครูที่ผูกกับบัญชีนี้</p>;
  }

  const gradedPct = grades && grades.studentCount > 0
    ? Math.round((grades.gradedCount / grades.studentCount) * 100)
    : null;

  return (
    <div className="flex w-full flex-col gap-4 pb-6">
      {/* โปรไฟล์ */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
        <Card size="sm">
          <CardContent className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={me.photoURL} alt={me.name} />
              <AvatarFallback>{me.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black">{me.name}</h1>
              <p className="truncate text-xs text-muted-foreground">
                {[me.position, DEPARTMENT_CONFIG[me.department]?.label].filter(Boolean).join(' · ')}
              </p>
              <p className="text-xs text-muted-foreground">
                ปีการศึกษา {activeYear.year} ภาคเรียนที่ {activeSemester}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* การ์ดสรุป */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          index={1}
          icon={HiOutlineClipboardDocumentCheck}
          label="การเช็คชื่อรายวิชา"
          value={me.rollCallRate === null ? '—' : `${me.rollCallRate}%`}
          sub={`${me.completedSessions}/${me.expectedSessions} คาบ`}
        />
        <StatCard
          index={2}
          icon={HiOutlineBriefcase}
          label="เวลาปฏิบัติงาน"
          value={me.attendanceRate === null ? '—' : `${me.attendanceRate}%`}
          sub={`มา ${me.attendedDays}/${me.workingDays} วัน · สาย ${attendance?.late ?? 0} · ขาด ${attendance?.absent ?? 0}`}
        />
        <StatCard
          index={3}
          icon={HiOutlineAcademicCap}
          label="เกรดเฉลี่ยนักเรียน"
          value={grades?.overallAvgGpa == null ? '—' : formatGpa(Number(grades.overallAvgGpa.toFixed(2)))}
          sub={gradedPct === null ? 'ยังไม่มีผลการเรียน' : `ตัดเกรดแล้ว ${gradedPct}%`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* การเข้าสอนรายวิชา */}
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show">
          <Card>
            <CardContent>
              <SectionTitle icon={HiOutlineClipboardDocumentCheck}>การเช็คชื่อรายวิชา</SectionTitle>
              <div className="flex flex-col gap-3">
                {me.subjectBreakdown.filter((s) => !s.excluded).map((s) => (
                  <div key={s.subjectId}>
                    <div className="mb-1 flex justify-between gap-2 text-xs">
                      <span className="truncate font-bold">{s.subjectName}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {s.completedSessions}/{s.expectedSessions} คาบ
                      </span>
                    </div>
                    <KpiBulletBar value={s.rate} />
                  </div>
                ))}
                {me.subjectBreakdown.every((s) => s.excluded) && (
                  <p className="text-xs text-muted-foreground">ไม่มีรายวิชา</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ปฏิทินเวลาปฏิบัติงาน */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="show">
          <Card>
            <CardContent>
              <SectionTitle icon={HiOutlineBriefcase}>ปฏิทินเวลาปฏิบัติงาน</SectionTitle>
              {/* ponytail: ไม่ส่งข้อมูลการลา (นอกขอบเขต) — วันลาจะแสดงตามบันทึกเวลาจริง */}
              <PersonalAttendanceCalendarPanel userId={user!.uid} leaveRequests={[]} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ผลการเรียนรายห้อง/วิชา */}
      <motion.div custom={6} variants={fadeUp} initial="hidden" animate="show">
        <SectionTitle icon={HiOutlineChartBar}>ผลการเรียนรายห้อง/วิชา</SectionTitle>
        {!grades || grades.classes.length === 0 ? (
          <Card size="sm">
            <CardContent className="text-xs text-muted-foreground">
              ยังไม่มีผลการเรียนที่บันทึกในสมุดคะแนนภาคเรียนนี้
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {grades.classes.map((c) => {
              const max = Math.max(1, ...GRADE_DISTRIBUTION_LETTERS.map((l) => c.distribution[l] ?? 0));
              return (
                <Card key={c.key} size="sm">
                  <CardContent>
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{c.subjectName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.className} · {c.subjectCode}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xl font-black tabular-nums">
                          {c.avgGpa === null ? '—' : formatGpa(Number(c.avgGpa.toFixed(2)))}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          ตัดเกรด {c.gradedCount}/{c.studentCount}
                        </p>
                      </div>
                    </div>
                    <div className="flex h-16 items-end gap-1">
                      {GRADE_DISTRIBUTION_LETTERS.map((l) => {
                        const n = c.distribution[l] ?? 0;
                        return (
                          <div key={l} className="flex flex-1 flex-col items-center gap-0.5">
                            <span className="text-[9px] tabular-nums text-muted-foreground">{n || ''}</span>
                            <div
                              className={cn('w-full rounded-t-md', n ? 'bg-primary' : 'bg-muted')}
                              style={{ height: `${n ? Math.max(8, (n / max) * 100) : 4}%` }}
                            />
                            <span className="text-[9px] font-bold">{l}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
