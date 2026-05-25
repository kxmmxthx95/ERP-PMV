
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, Users, UserCheck, Database, HeartPulse,
  TrendingUp, History, ArrowRight, User, CheckCircle2, AlertTriangle,
  ShieldCheck, CloudUpload, Activity,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const STAT_ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  group: Users,
  person_check: UserCheck,
  database: Database,
  heart_check: HeartPulse,
};

const ACTION_ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  person_add: UserPlus,
  admin_panel_settings: ShieldCheck,
  cloud_upload: CloudUpload,
  history: History,
};

function StatIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = STAT_ICON_MAP[name] ?? Users;
  return <Icon {...props} />;
}

function ActionIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = ACTION_ICON_MAP[name] ?? History;
  return <Icon {...props} />;
}

// ── Styles ──────────────────────────────────────────────────────────────────
const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.55)',
  backdropFilter: 'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  border: '1.5px solid rgba(0,0,0,0.15)',
};

const glassBright: React.CSSProperties = {
  background: 'rgba(255,255,255,0.75)',
  backdropFilter: 'blur(30px) saturate(200%)',
  WebkitBackdropFilter: 'blur(30px) saturate(200%)',
  border: '1.5px solid rgba(0,0,0,0.12)',
};

// ── Static data ───────────────────────────────────────────────────────────
const quickActions = [
  { label: 'เพิ่มผู้ใช้', icon: 'person_add', path: '/portal/users', glow: '#7c3aed', gradient: 'from-violet-500 to-indigo-500' },
  { label: 'กำหนดสิทธิ์', icon: 'admin_panel_settings', path: '/portal/roles', glow: '#2563eb', gradient: 'from-sky-500 to-blue-600' },
  { label: 'Backup ข้อมูล', icon: 'cloud_upload', path: '/portal/settings', glow: '#d97706', gradient: 'from-amber-400 to-orange-500' },
  { label: 'ดู Audit Log', icon: 'history', path: '/portal/logs', glow: '#059669', gradient: 'from-emerald-400 to-teal-500' },
];

const systemServices = [
  { name: 'Firebase Auth', latency: '12ms', ok: true },
  { name: 'Firestore Database', latency: '28ms', ok: true },
  { name: 'Cloud Storage', latency: '45ms', ok: true },
  { name: 'Cloud Functions', latency: '120ms', ok: true },
  { name: 'FCM Notifications', latency: '65ms', ok: true },
];

// ── Animations ────────────────────────────────────────────────────────────
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const pop = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 280, damping: 24 } },
};

// ── Component ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const dashboardBgImage = "url('/Bg.jpg'), url('/BG.jpg'), url('https://nutty-yellow-w6lw8f8pkd.edgeone.app/BG.jpg')";

  const [stats, setStats] = useState<any[]>([]);
  const [roleBreakdown, setRoleBreakdown] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        let activeUsers = 0;
        const roleCount: Record<string, number> = {
          student: 0, parent: 0, teacher: 0, staff: 0, admin: 0, sysadmin: 0,
        };

        usersSnap.forEach(doc => {
          const d = doc.data();
          if (d.role && roleCount[d.role] !== undefined) roleCount[d.role]++;
          if (d.status === 'active') activeUsers++;
        });

        const totalUsers = usersSnap.size;

        setRoleBreakdown([
          { role: 'นักเรียน', count: roleCount.student, pct: totalUsers ? Math.round((roleCount.student / totalUsers) * 100) : 0, color: '#7c3aed' },
          { role: 'ผู้ปกครอง', count: roleCount.parent, pct: totalUsers ? Math.round((roleCount.parent / totalUsers) * 100) : 0, color: '#2563eb' },
          { role: 'ครูผู้สอน', count: roleCount.teacher, pct: totalUsers ? Math.round((roleCount.teacher / totalUsers) * 100) : 0, color: '#e11d48' },
          { role: 'เจ้าหน้าที่', count: roleCount.staff, pct: totalUsers ? Math.round((roleCount.staff / totalUsers) * 100) : 0, color: '#059669' },
          { role: 'ผู้บริหาร', count: roleCount.admin, pct: totalUsers ? Math.round((roleCount.admin / totalUsers) * 100) : 0, color: '#d97706' },
          { role: 'System Admin', count: roleCount.sysadmin, pct: totalUsers ? Math.round((roleCount.sysadmin / totalUsers) * 100) : 0, color: '#64748b' },
        ]);

        setStats([
          { label: 'บัญชีผู้ใช้ทั้งหมด', value: totalUsers.toLocaleString(), sub: 'บัญชีทั้งหมดในระบบ', trend: 'neutral', icon: 'group', glow: '#7c3aed', gradient: 'from-violet-500 to-indigo-500' },
          { label: 'ผู้ใช้ที่ Active', value: activeUsers.toLocaleString(), sub: 'สถานะปกติ', trend: 'up', icon: 'person_check', glow: '#059669', gradient: 'from-emerald-400 to-teal-500' },
          { label: 'พื้นที่จัดเก็บ (GB)', value: '45', sub: '45 / 100 GB ที่ใช้', trend: 'neutral', icon: 'database', glow: '#d97706', gradient: 'from-amber-400 to-orange-500' },
          { label: 'สถานะระบบ', value: 'Online', sub: 'Uptime 99.9%', trend: 'up', icon: 'heart_check', glow: '#0ea5e9', gradient: 'from-sky-400 to-blue-500' },
        ]);

        const logsQuery = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(5));
        const logsSnap = await getDocs(logsQuery);
        setRecentLogs(logsSnap.docs.map(doc => {
          const d = doc.data();
          const date = d.timestamp ? new Date(d.timestamp) : new Date();
          return {
            id: doc.id,
            action: d.action || 'Unknown Action',
            user: d.user || 'System',
            time: date.toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
            status: d.status || 'success',
          };
        }));
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      }
    };
    fetchDashboardData();
  }, []);

  const today = new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const totalUsersCount = roleBreakdown.reduce((s, r) => s + r.count, 0);

  return (
    /* ── Holy Grail outer shell ─────────────────────────────── */
    <div className="relative w-full bg-transparent overflow-hidden h-full">
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat scale-105"
        style={{
          backgroundImage: dashboardBgImage,
          filter: 'blur(10px) brightness(0.95)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 z-0 bg-white/20" />
      <div className="relative z-10 flex flex-col h-full gap-3 sm:gap-4">

        {/* ── Pinned header ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-black/[0.06]"
        >
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-black/85 tracking-tight">ภาพรวมระบบ</h1>
            <p className="text-sm text-black/35 mt-0.5">{today}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate('/portal/users')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 0 20px #7c3aed60,0 4px 12px rgba(0,0,0,0.3)' }}
            >
              <UserPlus size={12} />
              เพิ่มผู้ใช้งาน
            </button>
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-black/40 hover:text-black/70 transition-all duration-150"
              style={glassBright}
            >
              <CloudUpload size={14} />
              Import CSV
            </button>
          </div>
        </motion.div>

        {/* ── Scrollable Bento body ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-0 sm:pr-1">

          {/* Bento grid: responsive mobile/desktop */}
          <motion.div
            variants={stagger} initial="hidden" animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-auto lg:auto-rows-[160px]"
          >

            {/* ── 4 Stat Cards (1×1 each) ─────────────────────────── */}
            {stats.map((s) => (
              <motion.div
                key={s.label} variants={pop}
                className="col-span-1 row-span-1 p-4 sm:p-5 rounded-3xl flex flex-col justify-between hover:scale-[1.02] transition-transform duration-200 cursor-default min-w-0"
                style={glass}
              >
                <div
                  className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${s.gradient} flex items-center justify-center`}
                  style={{ boxShadow: `0 0 14px ${s.glow}55` }}
                >
                  <StatIcon name={s.icon} size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-extrabold text-black/80 leading-none break-words">{s.value}</p>
                  <p className="text-[11px] text-black/40 mt-0.5 font-medium">{s.label}</p>
                  <div className={`mt-2 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.trend === 'up' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-black/05 text-black/35'
                    }`}>
                    {s.trend === 'up' && <TrendingUp size={10} />}
                    {s.sub}
                  </div>
                </div>
              </motion.div>
            ))}

            {/* ── Role Breakdown — 2×2 (tall + wide) on lg, full on mobile ─────────────── */}
            <motion.div
              variants={pop}
              className="col-span-1 sm:col-span-2 row-span-1 lg:row-span-2 p-4 sm:p-5 rounded-3xl flex flex-col lg:h-[336px]"
              style={glass}
            >
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="font-bold text-black/75 text-sm">ผู้ใช้แยกตาม Role</h2>
                <span className="text-xs text-black/35">รวม {totalUsersCount.toLocaleString()} คน</span>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3.5">
                {roleBreakdown.map((r) => (
                  <div key={r.role}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-black/50 font-medium">{r.role}</span>
                      <span className="text-xs font-bold text-black/70">{r.count}</span>
                    </div>
                    {/* progress bar intentionally removed per request */}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ── Quick Actions — 2×1 (wide) on lg, full on mobile ──────────────────────── */}
            <motion.div
              variants={pop}
              className="col-span-1 sm:col-span-2 row-span-1 p-4 sm:p-5 rounded-3xl flex flex-col"
              style={glass}
            >
              <h2 className="font-bold text-black/75 text-sm mb-3 flex-shrink-0">จัดการด่วน</h2>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 min-h-0">
                {quickActions.map((a) => (
                  <button
                    key={a.label}
                    onClick={() => navigate(a.path)}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl transition-all duration-150 hover:scale-[1.05] active:scale-[0.97]"
                    style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl bg-gradient-to-br ${a.gradient} flex items-center justify-center`}
                      style={{ boxShadow: `0 0 10px ${a.glow}35` }}
                    >
                      <ActionIcon name={a.icon} size={17} className="text-white" />
                    </div>
                    <span className="text-[10px] font-semibold text-black/50 leading-tight text-center px-1">{a.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* ── System Services — 2×1 (wide) on lg, full on mobile ────────────────────── */}
            <motion.div
              variants={pop}
              className="col-span-1 sm:col-span-2 row-span-1 p-4 sm:p-5 rounded-3xl flex flex-col"
              style={glass}
            >
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <Activity size={14} className="text-black/30" />
                  <h2 className="font-bold text-black/75 text-sm">สถานะ Services</h2>
                </div>
                <span
                  className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}
                >
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  All Online
                </span>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide divide-y" style={{ '--tw-divide-opacity': '0.06' } as any}>
                {systemServices.map((svc) => (
                  <div key={svc.name} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#10b981' }} />
                      <span className="text-xs text-black/55 font-medium">{svc.name}</span>
                    </div>
                    <span className="text-[11px] text-black/30 font-mono">{svc.latency}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ── Audit Log — 4×2 (full width, tall) on lg, card list on mobile ─────────────── */}
            <motion.div
              variants={pop}
              className="col-span-1 sm:col-span-2 lg:col-span-4 row-span-1 lg:row-span-2 rounded-3xl overflow-hidden flex flex-col lg:h-[336px]"
              style={glass}
            >
              {/* Table header */}
              <div
                className="flex items-center justify-between px-4 sm:px-6 py-4 flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-center gap-2">
                  <History size={16} className="text-black/30" />
                  <h2 className="font-bold text-black/75 text-sm">Audit Log ล่าสุด</h2>
                </div>
                <button
                  onClick={() => navigate('/portal/logs')}
                  className="text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors flex items-center gap-1"
                >
                  ดูทั้งหมด <ArrowRight size={13} />
                </button>
              </div>

              {/* Scrollable content: table on desktop, card list on mobile */}
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {/* Desktop Table */}
                <table className="w-full text-sm hidden lg:table">
                  <thead className="sticky top-0" style={{ background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(12px)' }}>
                    <tr>
                      {['การกระทำ', 'ผู้ใช้', 'เวลา', 'สถานะ'].map((h) => (
                        <th
                          key={h}
                          className="text-left px-6 py-3 text-[11px] font-semibold tracking-wider"
                          style={{ color: 'rgba(0,0,0,0.35)' }}
                        >
                          {h.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="transition-colors hover:bg-black/[0.02]"
                        style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: log.status === 'success' ? '#10b981' : '#f59e0b' }}
                            />
                            <span className="font-medium text-black/65">{log.action}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="text-xs text-black/40 flex items-center gap-1">
                            <User size={12} className="text-black/20" />
                            {log.user}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-xs text-black/30">{log.time}</td>
                        <td className="px-6 py-3.5">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
                            style={log.status === 'success'
                              ? { background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }
                              : { background: 'rgba(245,158,11,0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.20)' }
                            }
                          >
                            {log.status === 'success' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                            {log.status === 'success' ? 'Success' : 'Warning'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {recentLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-xs text-black/30">
                          ไม่พบประวัติการใช้งานระบบ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Mobile Card List */}
                <div className="lg:hidden space-y-3 p-4 sm:p-6">
                  {recentLogs.length === 0 ? (
                    <div className="text-center py-8 text-xs text-black/30">
                      ไม่พบประวัติการใช้งานระบบ
                    </div>
                  ) : (
                    recentLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl transition-colors hover:bg-black/[0.02]"
                        style={{ background: 'rgba(0,0,0,0.02)' }}
                      >
                        <div className="flex items-start gap-2.5 mb-2">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                            style={{ background: log.status === 'success' ? '#10b981' : '#f59e0b' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-black/65 text-sm">{log.action}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <User size={12} className="text-black/20 flex-shrink-0" />
                              <span className="text-xs text-black/40 truncate">{log.user}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between ml-4 pt-2 border-t border-black/[0.06]">
                          <span className="text-[11px] text-black/30">{log.time}</span>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={log.status === 'success'
                              ? { background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }
                              : { background: 'rgba(245,158,11,0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.20)' }
                            }
                          >
                            {log.status === 'success' ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                            {log.status === 'success' ? 'Success' : 'Warning'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>

          </motion.div>

          {/* Bottom spacer */}
          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}
