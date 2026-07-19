import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  HiOutlineUsers,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineChatBubbleOvalLeftEllipsis,
  HiOutlineKey,
  HiOutlineUserPlus,
} from 'react-icons/hi2';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { UserData } from '@/types/user';
import { ROLE_LABELS } from '@/types/mockUsers';
import { glassStyles } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import {
  computeUserDashboardSummary,
  computeRoleStats,
  computeDepartmentStats,
  computeRecentSignupUsers,
  formatSignupDate,
} from '@/features/users/utils/userDashboardStats';

interface UsersDashboardProps {
  users: UserData[];
  isLoading?: boolean;
  onRoleSelect?: (role: string) => void;
  onDepartmentSelect?: (department: string) => void;
}

function DashboardCard({
  children,
  className,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <section
      className={cn('rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5', className)}
      style={glassStyles.card}
    >
      {(title || subtitle) && (
        <div className="mb-4 min-w-0">
          {title && <h3 className="text-sm font-black text-slate-800">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-[11px] font-medium text-slate-400">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'blue',
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'blue' | 'emerald' | 'rose' | 'violet' | 'amber' | 'slate';
}) {
  const tones = {
    blue: { bg: 'bg-blue-50/80', text: 'text-blue-700', icon: 'text-blue-500' },
    emerald: { bg: 'bg-emerald-50/80', text: 'text-emerald-700', icon: 'text-emerald-500' },
    rose: { bg: 'bg-rose-50/80', text: 'text-rose-700', icon: 'text-rose-500' },
    violet: { bg: 'bg-violet-50/80', text: 'text-violet-700', icon: 'text-violet-500' },
    amber: { bg: 'bg-amber-50/80', text: 'text-amber-700', icon: 'text-amber-500' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-700', icon: 'text-slate-500' },
  }[tone];

  return (
    <div className={cn('rounded-xl px-3 py-3 sm:px-4', tones.bg)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('text-xl font-black tabular-nums leading-none sm:text-2xl', tones.text)}>
            {value.toLocaleString()}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500 sm:text-[11px]">{label}</p>
        </div>
        <Icon className={cn('size-5 shrink-0', tones.icon)} />
      </div>
    </div>
  );
}

export default function UsersDashboard({
  users,
  isLoading = false,
  onRoleSelect,
  onDepartmentSelect,
}: UsersDashboardProps) {
  const summary = useMemo(() => computeUserDashboardSummary(users), [users]);
  const roleStats = useMemo(() => computeRoleStats(users), [users]);
  const departmentStats = useMemo(() => computeDepartmentStats(users), [users]);
  const recentUsers = useMemo(() => computeRecentSignupUsers(users), [users]);

  const roleChartData = useMemo(
    () => roleStats.map((r) => ({ name: r.label, value: r.count, color: r.color, role: r.role })),
    [roleStats],
  );

  const deptChartData = useMemo(
    () => departmentStats.map((d) => ({ name: d.label, count: d.count, color: d.color, id: d.id })),
    [departmentStats],
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 pt-4 lg:grid-cols-3 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10 pt-4">
      <DashboardCard>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard label="ผู้ใช้ทั้งหมด" value={summary.total} icon={HiOutlineUsers} tone="blue" />
          <StatCard label="ใช้งานอยู่" value={summary.active} icon={HiOutlineCheckCircle} tone="emerald" />
          <StatCard label="ปิดใช้งาน" value={summary.inactive} icon={HiOutlineXCircle} tone="rose" />
          <StatCard label="เชื่อม LINE แล้ว" value={summary.lineLinked} icon={HiOutlineChatBubbleOvalLeftEllipsis} tone="violet" />
          <StatCard label="รอเปลี่ยนรหัสผ่าน" value={summary.mustChangePassword} icon={HiOutlineKey} tone="amber" />
          <StatCard label={`สมัครใหม่ ${30} วัน`} value={summary.recentSignups} icon={HiOutlineUserPlus} tone="slate" />
        </div>
      </DashboardCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardCard title="สัดส่วนตามบทบาท" subtitle="คลิกแถวเพื่อดูรายชื่อในหมวดนั้น">
          {roleChartData.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="h-52 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roleChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {roleChartData.map((entry) => (
                        <Cell key={entry.role} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [`${Number(v).toLocaleString()} คน`, 'จำนวน']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5">
                {roleStats.map((entry) => {
                  const pct = summary.total > 0 ? Math.round((entry.count / summary.total) * 100) : 0;
                  return (
                    <li key={entry.role}>
                      <button
                        type="button"
                        onClick={() => onRoleSelect?.(entry.role)}
                        className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-50"
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-slate-700">
                          {entry.label}
                        </span>
                        <span className="text-[11px] font-black tabular-nums text-slate-500">
                          {entry.count.toLocaleString()}
                          <span className="ml-1 font-semibold text-slate-400">({pct}%)</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีข้อมูลผู้ใช้</p>
          )}
        </DashboardCard>

        <DashboardCard title="จำนวนตามแผนก" subtitle="คลิกแท่งกราฟเพื่อดูรายชื่อตามระดับชั้น">
          {deptChartData.length > 0 ? (
            <div className="h-64 min-h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v) => [`${Number(v).toLocaleString()} คน`, 'จำนวน']}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                    cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={48}
                    onClick={(data) => {
                      const payload = data as { id?: string };
                      if (payload?.id) onDepartmentSelect?.(payload.id);
                    }}
                  >
                    {deptChartData.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} className="cursor-pointer" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีข้อมูลแผนก</p>
          )}
        </DashboardCard>
      </div>

      {recentUsers.length > 0 && (
        <DashboardCard title="ผู้ใช้ที่สมัครใหม่" subtitle={`ภายใน ${30} วันที่ผ่านมา`}>
          <div className="divide-y divide-slate-100">
            {recentUsers.map((user, i) => {
              const roleStyle = ROLE_LABELS[user.role] || { label: user.role, color: '#64748b', bg: '#f1f5f9' };
              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-black"
                    style={{ background: roleStyle.bg, color: roleStyle.color }}
                  >
                    {(user.firstName || user.email || '?').charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">
                      {user.prefix || ''}{user.firstName || ''} {user.lastName || ''}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">{user.email}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className="inline-block rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      style={{ background: roleStyle.bg, color: roleStyle.color }}
                    >
                      {roleStyle.label}
                    </span>
                    <p className="mt-1 text-[10px] font-medium text-slate-400">
                      {formatSignupDate(user.createdAt)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </DashboardCard>
      )}
    </div>
  );
}
