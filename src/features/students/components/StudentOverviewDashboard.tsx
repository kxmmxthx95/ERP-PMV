import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  HiAcademicCap,
  HiCheckCircle,
  HiUser,
  HiUsers,
} from 'react-icons/hi2';
import type { IconType } from 'react-icons';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import type { StudentCard } from '@/types/student';

const GLASS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'กำลังศึกษา',
  inactive: 'พักการศึกษา',
  graduated: 'จบการศึกษา',
  transferred: 'ย้ายออก',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#14b8a6',
  inactive: '#f59e0b',
  graduated: '#6366f1',
  transferred: '#94a3b8',
};

const GRADE_ORDER = [
  'อ.1', 'อ.2', 'อ.3',
  'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6',
  'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6',
  'ไม่ระบุ',
];

function inferDepartment(gradeLevel: string | null | undefined): Department | null {
  const grade = String(gradeLevel ?? '').trim();
  if (!grade) return null;
  if (grade.startsWith('อ')) return 'early';
  if (grade.startsWith('ป')) return 'primary';
  if (grade.startsWith('ม')) return 'secondary';
  return null;
}

function sortGradeEntries(entries: [string, number][]): [string, number][] {
  return [...entries].sort((a, b) => {
    const ia = GRADE_ORDER.indexOf(a[0]);
    const ib = GRADE_ORDER.indexOf(b[0]);
    if (ia === -1 && ib === -1) return a[0].localeCompare(b[0], 'th');
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

interface StudentOverviewDashboardProps {
  studentCards: StudentCard[];
  stats: {
    total: number;
    active: number;
    male: number;
    female: number;
  };
  academicYear?: string;
}

export default function StudentOverviewDashboard({
  studentCards,
  stats,
  academicYear,
}: StudentOverviewDashboardProps) {
  const statusSummary = useMemo(() => {
    return studentCards.reduce(
      (acc, { student }) => {
        const key = student.status || 'inactive';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [studentCards]);

  const gradeSummary = useMemo(() => {
    const map = studentCards.reduce((acc, { currentGrade }) => {
      const key = currentGrade || 'ไม่ระบุ';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return sortGradeEntries(Object.entries(map));
  }, [studentCards]);

  const classSummary = useMemo(() => {
    const map = studentCards.reduce((acc, { currentClass }) => {
      const key = currentClass || 'ยังไม่จัดห้อง';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [studentCards]);

  const departmentSummary = useMemo(() => {
    const counts: Record<Department, number> = { early: 0, primary: 0, secondary: 0 };
    studentCards.forEach(({ currentGrade }) => {
      const dept = inferDepartment(currentGrade);
      if (dept) counts[dept] += 1;
    });
    return (Object.keys(DEPARTMENT_CONFIG) as Department[]).map((department) => ({
      department,
      label: DEPARTMENT_CONFIG[department].label,
      count: counts[department],
      pct: stats.total > 0 ? Math.round((counts[department] / stats.total) * 100) : 0,
    }));
  }, [studentCards, stats.total]);

  const statusChartData = useMemo(
    () =>
      Object.entries(statusSummary).map(([status, count]) => ({
        name: STATUS_LABEL[status] || status,
        value: count,
        color: STATUS_COLORS[status] || '#94a3b8',
      })),
    [statusSummary],
  );

  const gradeChartData = useMemo(
    () => gradeSummary.map(([grade, count]) => ({ name: grade, value: count })),
    [gradeSummary],
  );

  const classChartData = useMemo(
    () => classSummary.slice(0, 10).map(([className, count]) => ({ name: className, value: count })),
    [classSummary],
  );

  const statCards: {
    key: string;
    label: string;
    value: number;
    color: string;
    icon: IconType;
  }[] = [
    { key: 'total', label: 'นักเรียนทั้งหมด', value: stats.total, color: 'text-slate-800', icon: HiUsers },
    { key: 'active', label: 'กำลังศึกษา', value: stats.active, color: 'text-teal-600', icon: HiCheckCircle },
    { key: 'male', label: 'ชาย', value: stats.male, color: 'text-sky-600', icon: HiUser },
    { key: 'female', label: 'หญิง', value: stats.female, color: 'text-pink-600', icon: HiUser },
  ];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 -left-10 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute top-16 -right-16 h-72 w-72 rounded-full bg-violet-200/35 blur-3xl" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-500">Student Registry</p>
            <h1 className="mt-1 text-xl font-black text-slate-900">ภาพรวมนักเรียน</h1>
            <p className="text-sm font-medium text-slate-500">
              สถิติการลงทะเบียนและการจัดห้องเรียน
              {academicYear ? ` · ปีการศึกษา ${academicYear}` : ''}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 shadow-sm border border-white">
            <HiAcademicCap className="h-4 w-4 text-indigo-500" />
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400">ห้องเรียนที่มีนักเรียน</p>
              <p className="text-sm font-black text-slate-800">
                {classSummary.filter(([name]) => name !== 'ยังไม่จัดห้อง').length} ห้อง
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((item) => (
            <div
              key={item.key}
              className="rounded-3xl border border-white bg-white/60 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <item.icon className={`h-4 w-4 ${item.color}`} />
                <span className="text-[10px] font-black text-slate-400">รวม</span>
              </div>
              <p className={`mt-4 text-3xl font-black ${item.color}`}>
                {item.value.toLocaleString('th-TH')}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <section style={GLASS} className="rounded-[28px] p-4 sm:p-5 xl:col-span-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-teal-600">Status</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">สัดส่วนตามสถานะ</h2>
            <div className="mt-4 h-52">
              {statusChartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm font-bold text-slate-300">
                  ไม่มีข้อมูล
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {statusChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: 'none',
                        boxShadow: '0 10px 28px rgba(15,23,42,0.12)',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {statusChartData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-2 rounded-2xl bg-white/55 px-3 py-2"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate text-[11px] font-bold text-slate-500">{item.name}</span>
                  <span className="ml-auto text-[11px] font-black text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={GLASS} className="rounded-[28px] p-4 sm:p-5 xl:col-span-7">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-600">Grade Levels</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">จำนวนนักเรียนตามระดับชั้น</h2>
            <div className="mt-4 h-64">
              {gradeChartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm font-bold text-slate-300">
                  ไม่มีข้อมูล
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeChartData} barCategoryGap={12}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: 'none',
                        boxShadow: '0 10px 28px rgba(15,23,42,0.12)',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    />
                    <Bar dataKey="value" fill="#38bdf8" radius={[10, 10, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section style={GLASS} className="rounded-[28px] p-4 sm:p-5 xl:col-span-12">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-600">Departments</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">แยกตามระดับการศึกษา</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {departmentSummary.map((dept) => (
                <div key={dept.department} className="rounded-3xl border border-white bg-white/55 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-slate-800">{dept.label}</p>
                      <p className="text-[11px] font-semibold text-slate-400">
                        {dept.count.toLocaleString('th-TH')} คน
                      </p>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-black"
                      style={{
                        color: DEPARTMENT_CONFIG[dept.department].color,
                        background: DEPARTMENT_CONFIG[dept.department].bg,
                        border: `1px solid ${DEPARTMENT_CONFIG[dept.department].border}`,
                      }}
                    >
                      {dept.pct}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${dept.pct}%`,
                        backgroundColor: DEPARTMENT_CONFIG[dept.department].color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={GLASS} className="rounded-[28px] p-4 sm:p-5 xl:col-span-12">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-500">Classrooms</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">การกระจายตามห้องเรียน</h2>
            <p className="text-xs font-semibold text-slate-400">แสดง 10 ห้องที่มีนักเรียนมากที่สุด</p>
            <div className="mt-4" style={{ height: Math.max(240, classChartData.length * 34) }}>
              {classChartData.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm font-bold text-slate-300">
                  ไม่มีข้อมูล
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classChartData} layout="vertical" margin={{ left: 4, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={72}
                      tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: 'none',
                        boxShadow: '0 10px 28px rgba(15,23,42,0.12)',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    />
                    <Bar dataKey="value" fill="#818cf8" radius={[0, 8, 8, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
