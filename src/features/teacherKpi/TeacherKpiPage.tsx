// src/features/teacherKpi/TeacherKpiPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { HiOutlineChartBarSquare, HiOutlineMagnifyingGlass, HiXMark } from 'react-icons/hi2';
import { toast } from 'sonner';
import { IndeterminateProgress } from '@/components/ui/progress';
import { PermissionVisible } from '@/components/PermissionGate';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import {
  ExamFilterShowResultsButton,
  ExamMobileFilterDrawer,
  ExamMobileFilterTriggerButton,
} from '@/features/exam/components/ExamMobileFilterMenuButton';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import type { TeacherKpiRow } from '@/types/teacherKpi';
import { useTeacherKpi } from '@/hooks/useTeacherKpi';
import { cn } from '@/lib/utils';
import { KpiBulletBar } from './components/KpiBulletBar';
import { KpiStartDateSetting } from './components/KpiStartDateSetting';
import { TeacherSubjectExclusionDrawer } from './components/TeacherSubjectExclusionDrawer';

type SortKey = 'rollcall_asc' | 'attendance_asc' | 'name_asc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'rollcall_asc', label: 'เช็คชื่อต่ำสุดก่อน' },
  { value: 'attendance_asc', label: 'เข้างานต่ำสุดก่อน' },
  { value: 'name_asc', label: 'ชื่อ ก-ฮ' },
];

const DEPARTMENT_ORDER: Department[] = ['early', 'primary', 'secondary'];

function sortRows(rows: TeacherKpiRow[], sortKey: SortKey): TeacherKpiRow[] {
  const withRank = (row: TeacherKpiRow) => ({
    rollcall: row.rollCallRate ?? 101,
    attendance: row.attendanceRate ?? 101,
  });
  return [...rows].sort((a, b) => {
    if (sortKey === 'name_asc') return a.name.localeCompare(b.name, 'th');
    if (sortKey === 'attendance_asc') return withRank(a).attendance - withRank(b).attendance;
    return withRank(a).rollcall - withRank(b).rollcall;
  });
}

function TeacherIdentity({ row, onClick }: { row: TeacherKpiRow; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 items-center gap-2.5 text-left transition-opacity hover:opacity-70"
    >
      <StudentAvatar
        photoURL={row.photoURL}
        studentId={row.teacherId}
        name={row.name}
        className="h-8 w-8 shrink-0 rounded-lg"
      />
      <div className="min-w-0">
        <p className="truncate font-sukhumvit text-[13px] font-bold text-slate-800">{row.name}</p>
        {row.position && (
          <p className="truncate font-sarabun text-[11px] text-slate-400">{row.position}</p>
        )}
      </div>
    </button>
  );
}

export default function TeacherKpiPage() {
  const { user } = useAuth();
  const { canEdit } = useMyPermissions();
  const {
    summary, isLoading, isRefreshing, error,
    kpiSettings, saveKpiStartDate, saveExcludedSubjects,
  } = useTeacherKpi();
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('rollcall_asc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherKpiRow | null>(null);
  const canEditKpi = canEdit('teacherKpi');
  const [homeActionsEl, setHomeActionsEl] = useState<HTMLElement | null>(null);
  const [mobileActionsEl, setMobileActionsEl] = useState<HTMLElement | null>(null);
  const [isLgUp, setIsLgUp] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );

  useEffect(() => {
    setHomeActionsEl(document.getElementById('header-portal-home-actions'));
    setMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  useEffect(() => {
    const handleResize = () => setIsLgUp(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const hasActiveFilters =
    search.trim().length > 0
    || departmentFilter !== 'all'
    || sortKey !== 'rollcall_asc';

  const groupedRows = useMemo(() => {
    if (!summary) return [];
    const searchLower = search.trim().toLowerCase();

    const filtered = summary.rows.filter((row) => {
      if (departmentFilter !== 'all' && row.department !== departmentFilter) return false;
      if (searchLower && !row.name.toLowerCase().includes(searchLower)) return false;
      return true;
    });

    return DEPARTMENT_ORDER
      .map((dept) => ({
        department: dept,
        rows: sortRows(filtered.filter((r) => r.department === dept), sortKey),
      }))
      .filter((group) => group.rows.length > 0);
  }, [summary, search, departmentFilter, sortKey]);

  const totalCount = summary?.rows.length ?? 0;
  const visibleCount = groupedRows.reduce((sum, g) => sum + g.rows.length, 0);

  const clearFilters = () => {
    setSearch('');
    setDepartmentFilter('all');
    setSortKey('rollcall_asc');
  };

  const settingsButton = (
    <PermissionVisible featureKey="teacherKpi" require="edit">
      <KpiStartDateSetting
        currentStartDate={kpiSettings.startDate}
        semesterStartDate={summary?.semesterStartDate ?? ''}
        semesterEndDate={summary?.semesterEndDate ?? ''}
        onSave={async (date) => {
          await saveKpiStartDate(date, user?.uid);
          toast.success(date ? `ตั้งวันเริ่มคำนวณ KPI เป็น ${date}` : 'ยกเลิกวันที่ตั้งค่า — ใช้วันเริ่มเทอมจริง');
        }}
      />
    </PermissionVisible>
  );

  const headerActions = (
    <div className="flex items-center gap-1.5">
      {settingsButton}
      <ExamMobileFilterTriggerButton
        onClick={() => setFilterOpen(true)}
        title="ตัวกรอง KPI ครู"
        hasActiveFilters={hasActiveFilters}
      />
    </div>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4">
      {isLgUp && homeActionsEl && createPortal(headerActions, homeActionsEl)}
      {!isLgUp && mobileActionsEl && createPortal(headerActions, mobileActionsEl)}

      <ExamMobileFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        direction="right"
        title="ตัวกรอง KPI ครู"
        description="ค้นหา เลือกแผนก และเรียงลำดับ"
        footer={(
          <>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  clearFilters();
                  setFilterOpen(false);
                }}
                className="h-11 flex-1 rounded-xl border border-rose-200 bg-rose-50 text-[13px] font-black text-rose-600 transition-colors hover:bg-rose-100"
              >
                ล้างตัวกรอง
              </button>
            )}
            <ExamFilterShowResultsButton onClick={() => setFilterOpen(false)} />
          </>
        )}
      >
        <div>
          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">
            ค้นหา
          </label>
          <div className="relative">
            <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อครู..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-[13px] font-bold text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-blue-200 focus:ring-4 focus:ring-blue-50/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="ล้างคำค้นหา"
              >
                <HiXMark className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">แผนก</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: 'all' as const, label: 'ทุกแผนก' },
              ...DEPARTMENT_ORDER.map((dept) => ({
                id: dept,
                label: DEPARTMENT_CONFIG[dept].label,
              })),
            ]).map((opt) => {
              const isActive = departmentFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDepartmentFilter(opt.id)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-[12px] font-black transition-all',
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">เรียงลำดับ</p>
          <div className="flex flex-col gap-1.5">
            {SORT_OPTIONS.map((opt) => {
              const isActive = sortKey === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSortKey(opt.value)}
                  className={cn(
                    'h-10 rounded-xl px-3 text-left text-[12px] font-bold transition-all',
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </ExamMobileFilterDrawer>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1"
      >
        <div className="flex items-center gap-2">
          <HiOutlineChartBarSquare className="h-5 w-5 text-slate-700" />
          <h1 className="font-sukhumvit text-lg font-black text-slate-900">ประเมิน KPI ครู</h1>
        </div>
        {summary && (
          <p className="font-sarabun text-[12px] text-slate-400">
            ข้อมูลเทอม {summary.semester}/{summary.academicYearId} ({summary.semesterStartDate} ถึง {summary.semesterEndDate})
            {' '}— คำนวณจากวันที่ {summary.effectiveStartDate} ถึงวันที่ {summary.computedThroughDate}
            {kpiSettings.startDate === summary.effectiveStartDate && kpiSettings.startDate && (
              <span className="ml-1 text-blue-600">(ตั้งค่าเอง)</span>
            )}
          </p>
        )}
      </motion.div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <IndeterminateProgress className="w-48" />
            <p className="font-sarabun text-[13px] text-slate-400">กำลังคำนวณข้อมูล KPI ของครูทั้งโรงเรียน...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center font-sarabun text-[13px] text-rose-500">{error}</div>
        ) : groupedRows.length === 0 ? (
          <div className="py-16 text-center font-sarabun text-[13px] text-slate-400">
            {totalCount === 0 ? 'ยังไม่มีข้อมูลครูในระบบ' : 'ไม่พบครูที่ตรงกับเงื่อนไข'}
          </div>
        ) : (
          <>
            {isRefreshing && (
              <p className="mb-2 font-sarabun text-[11px] text-slate-400">กำลังปรับปรุงข้อมูล...</p>
            )}

            {/* Desktop ledger table */}
            <div className="hidden md:block">
              {groupedRows.map((group) => (
                <div key={group.department} className="mb-4">
                  <div className="border-b border-slate-200 bg-slate-50/60 px-3 py-1.5">
                    <p className="font-sukhumvit text-[11px] font-black uppercase tracking-wide text-slate-500">
                      {DEPARTMENT_CONFIG[group.department].label} ({group.rows.length} คน)
                    </p>
                  </div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th scope="col" className="w-[36%] px-3 py-2 text-left font-sukhumvit text-[11px] font-bold text-slate-400">ครู</th>
                        <th scope="col" className="w-[32%] px-3 py-2 text-left font-sukhumvit text-[11px] font-bold text-slate-400">% เข้างาน</th>
                        <th scope="col" className="w-[32%] px-3 py-2 text-left font-sukhumvit text-[11px] font-bold text-slate-400">% เช็คชื่อ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.teacherId} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                          <td className="px-3 py-2.5">
                            <TeacherIdentity row={row} onClick={() => setSelectedTeacher(row)} />
                          </td>
                          <td className="px-3 py-2.5"><KpiBulletBar value={row.attendanceRate} /></td>
                          <td className="px-3 py-2.5"><KpiBulletBar value={row.rollCallRate} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {/* Mobile cards */}
            <div className="flex flex-col gap-4 md:hidden">
              {groupedRows.map((group) => (
                <div key={group.department}>
                  <p className="mb-1.5 px-1 font-sukhumvit text-[11px] font-black uppercase tracking-wide text-slate-500">
                    {DEPARTMENT_CONFIG[group.department].label} ({group.rows.length} คน)
                  </p>
                  <div className="flex flex-col gap-2">
                    {group.rows.map((row) => (
                      <div key={row.teacherId} className="rounded-xl border border-slate-200 bg-white p-3">
                        <TeacherIdentity row={row} onClick={() => setSelectedTeacher(row)} />
                        <div className="mt-2.5 flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-16 shrink-0 font-sarabun text-[11px] text-slate-400">เข้างาน</span>
                            <KpiBulletBar value={row.attendanceRate} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-16 shrink-0 font-sarabun text-[11px] text-slate-400">เช็คชื่อ</span>
                            <KpiBulletBar value={row.rollCallRate} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-3 text-center font-sarabun text-[11px] text-slate-300">
              แสดง {visibleCount} จาก {totalCount} คน
            </p>
          </>
        )}
      </div>

      <TeacherSubjectExclusionDrawer
        open={selectedTeacher !== null}
        onOpenChange={(next) => { if (!next) setSelectedTeacher(null); }}
        teacher={selectedTeacher}
        canEdit={canEditKpi}
        onSave={async (subjectIds) => {
          if (!selectedTeacher) return;
          await saveExcludedSubjects(selectedTeacher.teacherId, subjectIds, user?.uid);
          toast.success(`บันทึกรายวิชาที่ไม่นำมาคำนวณของ ${selectedTeacher.name} แล้ว`);
        }}
      />
    </div>
  );
}
