
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, Users, UserCheck, Database, HeartPulse,
  TrendingUp, History, ArrowRight, User, CheckCircle2, AlertTriangle,
  ShieldCheck, CloudUpload,
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

// ── Styles helpers ──────────────────────────────────────────────────────────
/** Light card — glassmorphism */
const glassCard: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.65)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255, 255, 255, 0.8)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
};

/** Glass card for prominent elements */
const glassBright: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(30px) saturate(180%)',
  WebkitBackdropFilter: 'blur(30px) saturate(180%)',
  border: '1px solid rgba(255, 255, 255, 0.95)',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)',
};

// ── Static Data (UI Setup) ───────────────────────────────────────────────────
const quickActions = [
  { label: 'เพิ่มผู้ใช้',   icon: 'person_add',          path: '/sysadmin/users',    glow: '#7c3aed', gradient: 'from-violet-500 to-indigo-500' },
  { label: 'กำหนดสิทธิ์',  icon: 'admin_panel_settings', path: '/sysadmin/roles',    glow: '#2563eb', gradient: 'from-sky-500 to-blue-600' },
  { label: 'Backup ข้อมูล', icon: 'cloud_upload',         path: '/sysadmin/settings', glow: '#d97706', gradient: 'from-amber-400 to-orange-500' },
  { label: 'ดู Audit Log',  icon: 'history',              path: '/sysadmin/logs',     glow: '#059669', gradient: 'from-emerald-400 to-teal-500' },
];

const systemServices = [
  { name: 'Firebase Auth',      latency: '12ms',  ok: true },
  { name: 'Firestore Database', latency: '28ms',  ok: true },
  { name: 'Cloud Storage',      latency: '45ms',  ok: true },
  { name: 'Cloud Functions',    latency: '120ms', ok: true },
  { name: 'FCM Notifications',  latency: '65ms',  ok: true },
];

// ── Animation ────────────────────────────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const cardAnim = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 22 } },
};

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function SysAdminDashboard() {
  const navigate = useNavigate();
  
  // 1. สร้าง State สำหรับเก็บข้อมูลจริง
  const [stats, setStats] = useState<any[]>([]);
  const [roleBreakdown, setRoleBreakdown] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  // 2. ใช้ useEffect สำหรับ Fetch ข้อมูลจาก Firebase เมื่อหน้าโหลด
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // 1. ดึงข้อมูลผู้ใช้เพื่อนับจำนวนและแยกตาม Role
        const usersSnap = await getDocs(collection(db, 'users'));
        let activeUsers = 0;
        const roleCount: Record<string, number> = {
          student: 0, parent: 0, teacher: 0, staff: 0, admin: 0, sysadmin: 0
        };

        usersSnap.forEach(doc => {
          const data = doc.data();
          if (data.role && roleCount[data.role] !== undefined) {
            roleCount[data.role]++;
          }
          if (data.status === 'active') {
            activeUsers++;
          }
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
          {
            label: 'บัญชีผู้ใช้ทั้งหมด',
            value: totalUsers.toLocaleString(),
            sub: 'บัญชีทั้งหมดในระบบ',
            trend: 'neutral',
            icon: 'group',
            glow: '#7c3aed',
            gradient: 'from-violet-500 to-indigo-500',
          },
          {
            label: 'ผู้ใช้ที่ Active',
            value: activeUsers.toLocaleString(),
            sub: 'สถานะปกติ',
            trend: 'up',
            icon: 'person_check',
            glow: '#059669',
            gradient: 'from-emerald-400 to-teal-500',
          },
          {
            label: 'พื้นที่จัดเก็บ (GB)',
            value: '45',
            sub: '45 / 100 GB ที่ใช้',
            trend: 'neutral',
            icon: 'database',
            glow: '#d97706',
            gradient: 'from-amber-400 to-orange-500',
          },
          {
            label: 'สถานะระบบ',
            value: 'Online',
            sub: 'Uptime 99.9%',
            trend: 'up',
            icon: 'heart_check',
            glow: '#0ea5e9',
            gradient: 'from-sky-400 to-blue-500',
          },
        ]);

        // 2. ดึงข้อมูล Audit Logs ล่าสุด (5 รายการ)
        const logsQuery = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(5));
        const logsSnap = await getDocs(logsQuery);
        const logsData = logsSnap.docs.map(doc => {
          const data = doc.data();
          const date = data.timestamp ? new Date(data.timestamp) : new Date();
          return {
            id: doc.id,
            action: data.action || 'Unknown Action',
            user: data.user || 'System',
            time: date.toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
            status: data.status || 'success',
          };
        });
        setRecentLogs(logsData);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchDashboardData();
  }, []);

  const today = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const totalUsersCount = roleBreakdown.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="space-y-5 text-black">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-black/85 tracking-tight">ภาพรวมระบบ</h1>
          <p className="text-sm text-black/35 mt-0.5">{today}</p>
        </div>

        <div className="flex gap-2">
          {/* Primary CTA — glass + gradient glow */}
          <button
            onClick={() => navigate('/sysadmin/users')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              boxShadow: '0 0 20px #7c3aed60, 0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <UserPlus size={12} />
            เพิ่มผู้ใช้งาน
          </button>

          {/* Secondary — glass */}
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-white/70 hover:text-white transition-all duration-150"
            style={glassBright}
          >
            <CloudUpload size={18} />
            Import CSV
          </button>
        </div>
      </motion.div>

      {/* ── Stat Cards ── */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((s) => (
          <motion.div key={s.label} variants={cardAnim}>
            <div
              className="p-5 rounded-3xl h-full hover:scale-[1.02] transition-transform duration-200 cursor-default"
              style={glassCard}
            >
              {/* Icon */}
              <div
                className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${s.gradient} flex items-center justify-center mb-4`}
                style={{ boxShadow: `0 0 18px ${s.glow}55` }}
              >
                <StatIcon name={s.icon} size={20} className="text-white" />
              </div>

              <p className="text-2xl font-extrabold text-black/80 leading-none">{s.value}</p>
              <p className="text-xs text-black/40 mt-1 font-medium">{s.label}</p>

              {/* Trend badge */}
              <div className={`mt-3 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                s.trend === 'up' ? 'bg-emerald-500/12 text-emerald-600' : 'bg-black/06 text-black/35'
              }`}>
                {s.trend === 'up' && <TrendingUp size={12} />}
                {s.sub}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Middle Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Role Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="p-5 rounded-3xl"
          style={glassCard}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-black/75 text-sm">ผู้ใช้แยกตาม Role</h2>
            <span className="text-xs text-black/35">รวม {totalUsersCount.toLocaleString()} คน</span>
          </div>
          <div className="space-y-4">
            {roleBreakdown.map((r) => (
              <div key={r.role}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-black/50 font-medium">{r.role}</span>
                  <span className="text-xs font-bold text-black/70">{r.count}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${r.pct}%` }}
                    transition={{ delay: 0.3, duration: 0.7, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: r.color, boxShadow: `0 0 8px ${r.color}80` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="p-5 rounded-3xl"
          style={glassCard}
        >
          <h2 className="font-bold text-black/75 text-sm mb-5">จัดการด่วน</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((a) => (
              <button
                key={a.label}
                onClick={() => navigate(a.path)}
                className="flex flex-col items-center gap-2.5 p-4 rounded-2xl transition-all duration-150 hover:scale-[1.04] active:scale-[0.98] text-center"
                style={{
                  background: 'rgba(0,0,0,0.04)',
                  border: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${a.gradient} flex items-center justify-center`}
                  style={{ boxShadow: `0 0 12px ${a.glow}35` }}
                >
                  <ActionIcon name={a.icon} size={20} className="text-white" />
                </div>
                <span className="text-[11px] font-semibold text-black/50 leading-tight">{a.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* System Services */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="p-5 rounded-3xl"
          style={glassCard}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-black/75 text-sm">สถานะ Services</h2>
            <span
              className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              All Online
            </span>
          </div>
          <div className="space-y-0.5">
            {systemServices.map((svc) => (
              <div
                key={svc.name}
                className="flex items-center justify-between py-2.5 border-b last:border-0"
                style={{ borderColor: 'rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: '#10b981' }}
                  />
                  <span className="text-xs text-black/55 font-medium">{svc.name}</span>
                </div>
                <span className="text-[11px] text-black/30 font-mono">{svc.latency}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Audit Log Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-3xl overflow-hidden"
        style={glassCard}
      >
        {/* Table header bar */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center gap-2">
            <History size={18} className="text-black/30" />
            <h2 className="font-bold text-black/75 text-sm">Audit Log ล่าสุด</h2>
          </div>
          <button
            onClick={() => navigate('/sysadmin/logs')}
            className="text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors flex items-center gap-1"
          >
            ดูทั้งหมด
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
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
                        style={{
                          background: log.status === 'success' ? '#10b981' : '#f59e0b',
                        }}
                      />
                      <span className="font-medium text-black/65">{log.action}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="text-xs text-black/40 flex items-center gap-1">
                      <User size={13} className="text-black/20" />
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
                      {log.status === 'success' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                      {log.status === 'success' ? 'Success' : 'Warning'}
                    </span>
                  </td>
                </tr>
              ))}
              {recentLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-xs text-black/30">
                    ไม่พบประวัติการใช้งานระบบ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

    </div>
  );
}
