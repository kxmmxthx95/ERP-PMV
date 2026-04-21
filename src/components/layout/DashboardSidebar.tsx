import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import UserProfileModal from '@/features/users/components/UserProfileModal';
import { useDynamicSidebar } from '@/hooks/useDynamicSidebar';
import {
  LayoutDashboard, UserCog, ShieldCheck, GraduationCap, History, Settings,
  BookUser, BadgeCheck, Users, DoorOpen, Megaphone, BarChart2, UserCheck,
  CalendarDays, FolderOpen, ClipboardList, Home, Flag, HelpCircle,
  Menu, LogOut, Network, BookOpen, TableProperties, FileText, UserRoundCheck,
  Eye,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  dashboard: LayoutDashboard,
  manage_accounts: UserCog,
  admin_panel_settings: ShieldCheck,
  school: GraduationCap,
  history: History,
  settings: Settings,
  person_book: BookUser,
  badge: BadgeCheck,
  group: Users,
  meeting_room: DoorOpen,
  campaign: Megaphone,
  bar_chart: BarChart2,
  how_to_reg: UserCheck,
  calendar_month: CalendarDays,
  folder_open: FolderOpen,
  grading: ClipboardList,
  home: Home,
  flag: Flag,
  help: HelpCircle,
  structure: Network,
  curriculum: BookOpen,
  schedule: TableProperties,
  syllabus: FileText,
  classes: DoorOpen,
  pending_users: UserRoundCheck,
};

function NavIcon({ name, size = 20, className, style }: { name: string; size?: number; className?: string; style?: React.CSSProperties }) {
  const Icon = ICON_MAP[name] ?? LayoutDashboard;
  return <Icon size={size} className={className} style={style} />;
}

// ---- Types ----
export interface NavItem {
  name: string;
  path: string;
  icon: string;
}

export interface NavSection {
  items: NavItem[];
}

export interface RoleConfig {
  label: string;
  gradient: string;
  sections: NavSection[];
}

// ---- Role Configs ----
export const ROLE_CONFIGS: Record<string, RoleConfig> = {
  sysadmin: {
    label: 'System Admin',
    gradient: 'from-violet-400 to-indigo-500',
    sections: [{
      items: [
        { name: 'จัดการผู้ใช้', path: '/sysadmin/users', icon: 'manage_accounts' },
        { name: 'อนุมัติบัญชีใหม่', path: '/sysadmin/pending-users', icon: 'pending_users' },
        { name: 'กำหนดสิทธิ์', path: '/sysadmin/roles', icon: 'admin_panel_settings' },
        { name: 'จัดการโครงสร้างระบบ', path: '/sysadmin/structure', icon: 'structure' },
        { name: 'บันทึกระบบ', path: '/sysadmin/logs', icon: 'history' },
        { name: 'ปฏิทินการศึกษา', path: '/sysadmin/calendar', icon: 'calendar_month' },
        { name: 'จัดการครู', path: '/sysadmin/teachers', icon: 'person_book' },
        { name: 'จัดการชั้นเรียน', path: '/sysadmin/classes', icon: 'classes' },
        { name: 'จัดการนักเรียน', path: '/sysadmin/students', icon: 'group' },
        { name: 'จัดการหลักสูตร', path: '/sysadmin/curriculum', icon: 'curriculum' },
        { name: 'แผนการสอน', path: '/sysadmin/syllabus', icon: 'syllabus' },
        { name: 'ตารางสอน', path: '/sysadmin/schedule', icon: 'schedule' },
      ],
    }],
  },
  admin: {
    label: 'ผู้บริหาร',
    gradient: 'from-sky-400 to-blue-500',
    sections: [{
      items: [
        { name: 'ภาพรวม', path: '/admin', icon: 'dashboard' },
        { name: 'จัดการครู', path: '/admin/teachers', icon: 'person_book' },
        { name: 'จัดการชั้นเรียน', path: '/admin/classes', icon: 'classes' },
        { name: 'จัดการเจ้าหน้าที่', path: '/admin/staff', icon: 'badge' },
        { name: 'รายชื่อนักเรียน', path: '/admin/students', icon: 'group' },
        { name: 'จัดการห้องเรียน', path: '/admin/classes', icon: 'meeting_room' },
        { name: 'ประกาศ', path: '/admin/announcements', icon: 'campaign' },
        { name: 'ปฏิทินการศึกษา', path: '/admin/calendar', icon: 'calendar_month' },
        { name: 'จัดการหลักสูตร', path: '/admin/curriculum', icon: 'curriculum' },
        { name: 'แผนการสอน', path: '/admin/syllabus', icon: 'syllabus' },
        { name: 'รายงาน', path: '/admin/reports', icon: 'bar_chart' },
      ],
    }],
  },
  staff: {
    label: 'เจ้าหน้าที่',
    gradient: 'from-emerald-400 to-teal-500',
    sections: [{
      items: [
        { name: 'หน้าหลัก', path: '/staff', icon: 'dashboard' },
        { name: 'รายชื่อนักเรียน', path: '/staff/students', icon: 'group' },
        { name: 'บันทึกการเข้าเรียน', path: '/staff/attendance', icon: 'how_to_reg' },
        { name: 'ตารางงาน', path: '/staff/schedule', icon: 'calendar_month' },
        { name: 'เอกสาร', path: '/staff/documents', icon: 'folder_open' },
        { name: 'ปฏิทินการศึกษา', path: '/staff/calendar', icon: 'calendar_month' },
        { name: 'ประกาศ', path: '/staff/announcements', icon: 'campaign' },
      ],
    }],
  },
  teacher: {
    label: 'ครูผู้สอน',
    gradient: 'from-rose-400 to-pink-500',
    sections: [{
      items: [
        { name: 'หน้าหลัก', path: '/teacher', icon: 'dashboard' },
        { name: 'ตารางสอน', path: '/teacher/schedule', icon: 'calendar_month' },
        { name: 'รายชื่อนักเรียน', path: '/teacher/students', icon: 'group' },
        { name: 'บันทึกการเข้าเรียน', path: '/teacher/attendance', icon: 'how_to_reg' },
        { name: 'จัดการคะแนน', path: '/teacher/grades', icon: 'grading' },
        { name: 'แผนการสอน', path: '/teacher/syllabus', icon: 'syllabus' },
        { name: 'ปฏิทินการศึกษา', path: '/teacher/calendar', icon: 'calendar_month' },
        { name: 'รายงานผล', path: '/teacher/reports', icon: 'bar_chart' },
      ],
    }],
  },
};

// ---- Sidebar Component ----
interface DashboardSidebarProps {
  onMobileClose?: () => void;
  onExpandChange?: (expanded: boolean) => void;
}

export default function DashboardSidebar({ onMobileClose, onExpandChange }: DashboardSidebarProps) {
  const { user, role, logout } = useAuth() as any;
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // ดึง Role จาก Auth หรือถ้าไม่มีให้ดึงจาก URL
  let activeRole = role || location.pathname.split('/')[1];

  // God Mode: ให้ Sidebar เปลี่ยนเมนูไปตาม URL ที่กำลังดูอยู่ (เพื่อให้ตรวจสอบได้ทุก Role)
  if (user?.email === 'sysadmin@pmv.com') {
    activeRole = location.pathname.split('/')[1];
  }

  // Fallback กรณี Role ที่ได้มาไม่มีใน Config ให้กลับไปใช้ URL
  if (!ROLE_CONFIGS[activeRole]) {
    activeRole = location.pathname.split('/')[1];
  }

  const config = ROLE_CONFIGS[activeRole] ?? null;
  const { filterNavItems, isFeatureEnabled } = useDynamicSidebar(activeRole);
  const allItems = filterNavItems(config?.sections.flatMap(s => s.items) ?? []);

  const isActive = (path: string) => {
    const depth = path.split('/').filter(Boolean).length;
    return depth <= 1
      ? location.pathname === path
      : location.pathname.startsWith(path);
  };

  const handleNav = (path: string) => {
    navigate(path);
    onMobileClose?.();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth); // 1. บังคับลบ Session ของ Firebase ออกจากเบราว์เซอร์
      if (typeof logout === 'function') await logout(); // 2. ล้าง State ภายในแอปพลิเคชัน
    } catch (error) {
      console.error("Logout error:", error);
    }
    navigate('/login', { replace: true }); // replace: true เพื่อไม่ให้กดปุ่ม Back กลับมาได้
  };

  const handleToggle = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    onExpandChange?.(next);
  };

  const COLLAPSED_W = 72;
  const EXPANDED_W = 240;

  return (
    <motion.div
      animate={{ width: isExpanded ? EXPANDED_W : COLLAPSED_W }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex flex-col h-full select-none flex-shrink-0 overflow-hidden"
      style={{
        background: '#ffffff',
        borderRight: '1px solid rgba(0,0,0,0.07)',
      }}
    >
      {/* ── Top: Hamburger & Portal Switcher (For SysAdmin) ── */}
      <div
        className="flex flex-col flex-shrink-0"
        style={{
          minHeight: 64,
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: isExpanded ? 20 : 0,
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          background: 'rgba(0,0,0,0.01)',
        }}
      >
        <div className="flex items-center">
          <button
            onClick={handleToggle}
            className="w-10 h-10 rounded-full flex items-center justify-center text-black/50 hover:bg-black/06 transition-colors duration-150 flex-shrink-0"
          >
            <Menu size={20} />
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="ml-3 text-xs font-bold text-black/70 whitespace-nowrap overflow-hidden"
              >
                {config?.label ?? 'Master Console'}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Portal Switcher (God Mode Only) */}
        {user?.email === 'sysadmin@pmv.com' && (
          <div className="mt-3 flex flex-col gap-1 px-2 overflow-hidden">
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col gap-1"
                >
                  <span className="text-[10px] uppercase font-bold text-black/20 px-2 mb-1 tracking-widest">Switch Portal</span>
                  <div className="flex flex-wrap gap-1.5 px-1.5">
                    {[
                      { id: 'sysadmin', icon: ShieldCheck, color: 'from-violet-500 to-indigo-600' },
                      { id: 'admin', icon: GraduationCap, color: 'from-sky-500 to-blue-600' },
                      { id: 'staff', icon: BadgeCheck, color: 'from-emerald-500 to-teal-600' },
                      { id: 'teacher', icon: UserCog, color: 'from-rose-500 to-pink-600' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleNav(`/${p.id}`)}
                        title={p.id.toUpperCase()}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 shadow-sm bg-gradient-to-br ${p.color} ${
                          activeRole === p.id 
                            ? 'ring-2 ring-white ring-offset-1 scale-105' 
                            : 'opacity-50 grayscale-[0.5] hover:opacity-100 hover:grayscale-0'
                        }`}
                      >
                        <p.icon size={14} strokeWidth={2.5} />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Nav items ── */}
      <nav className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden py-2">
        {allItems.map((item) => {
          const active = isActive(item.path);
          const isViewOnly = item.accessLevel === 'view-only';
          return (
            <div key={item.path} className="relative group px-2">
              <button
                onClick={() => handleNav(item.path)}
                className="relative w-full flex items-center transition-colors duration-150"
                style={{
                  height: 40,
                  borderRadius: 20,
                  paddingLeft: isExpanded ? 14 : 0,
                  paddingRight: isExpanded ? 14 : 0,
                  justifyContent: isExpanded ? 'flex-start' : 'center',
                  gap: isExpanded ? 12 : 0,
                  background: active ? '#f2f2f2' : 'transparent',
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = '#f5f5f5';
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <NavIcon
                  name={item.icon}
                  size={20}
                  className="flex-shrink-0 transition-colors"
                  style={{ color: active ? '#000000' : 'rgba(0,0,0,0.45)' }}
                />

                <AnimatePresence>
                  {isExpanded && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.15 }}
                      className="flex-1 flex items-center justify-between overflow-hidden"
                    >
                      <span
                        className="text-xs font-medium whitespace-nowrap overflow-hidden"
                        style={{ color: active ? '#000000' : 'rgba(0,0,0,0.60)' }}
                      >
                        {item.name}
                      </span>
                      {isViewOnly && (
                        <Eye size={11} className="flex-shrink-0 ml-1 text-amber-400" />
                      )}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* View-only dot — collapsed state */}
                {!isExpanded && isViewOnly && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </button>

              {/* Tooltip — only when collapsed */}
              {!isExpanded && (
                <div
                  className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl text-black/70 text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 z-50"
                  style={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid rgba(0,0,0,0.08)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                  }}
                >
                  {item.name}
                  <div
                    className="absolute right-full top-1/2 -translate-y-1/2"
                    style={{
                      borderWidth: '5px',
                      borderStyle: 'solid',
                      borderColor: 'transparent rgba(255,255,255,0.95) transparent transparent',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Separator ── */}
      <div className="h-px mx-4 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.07)' }} />

      {/* ── Bottom actions ── */}
      <div className="flex flex-col py-2 px-2 flex-shrink-0 gap-0.5">
        {/* Settings, Report, Help */}
        {[
          { icon: 'flag', label: 'รายงานปัญหา', onClick: undefined, feature: 'reports' },
          { icon: 'help', label: 'ช่วยเหลือ', onClick: undefined, feature: 'help' },
          { icon: 'settings', label: 'ตั้งค่า', onClick: () => handleNav(`/${activeRole}/settings`), feature: 'settings' },
        ].filter(item => {
          // เมนูตั้งค่า: ให้สิทธิ์เฉพาะ sysadmin เท่านั้น (Hard-coded lock)
          if (item.feature === 'settings') {
            return activeRole === 'sysadmin';
          }
          
          // เมนูอื่นๆ: เช็คตามสิทธิ์ที่อนุมัติปกติ
          return isFeatureEnabled(item.feature);
        }).map(({ icon, label, onClick }) => (
          <div key={label} className="relative group">
            <button
              onClick={onClick}
              className="relative w-full flex items-center transition-colors duration-150"
              style={{
                height: 40,
                borderRadius: 20,
                paddingLeft: isExpanded ? 14 : 0,
                paddingRight: isExpanded ? 14 : 0,
                justifyContent: isExpanded ? 'flex-start' : 'center',
                gap: isExpanded ? 12 : 0,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f5f5f5'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <NavIcon name={icon} size={20} className="flex-shrink-0" style={{ color: 'rgba(0,0,0,0.45)' }} />
              <AnimatePresence>
                {isExpanded && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs font-medium whitespace-nowrap"
                    style={{ color: 'rgba(0,0,0,0.60)' }}
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            {!isExpanded && (
              <div
                className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl text-black/70 text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 z-50"
                style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}
              >
                {label}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Separator ── */}
      <div className="h-px mx-4 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.07)' }} />

      {/* ── User Profile & Logout ── */}
      <div className="flex-shrink-0 px-2 py-3 space-y-1">
        {/* User Profile */}
        <div
          onClick={() => setIsProfileOpen(true)}
          className="flex items-center transition-all duration-150 rounded-xl cursor-pointer hover:bg-black/[0.03]"
          style={{
            height: 48,
            paddingLeft: isExpanded ? 10 : 0,
            paddingRight: isExpanded ? 10 : 0,
            justifyContent: isExpanded ? 'flex-start' : 'center',
          }}
        >
          <div className="relative flex-shrink-0">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm" />
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm bg-gradient-to-br ${config?.gradient || 'from-slate-400 to-slate-500'}`}>
                {user?.displayName?.charAt(0).toUpperCase() || config?.label.charAt(0) || 'U'}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" title="Online" />
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="ml-3 flex flex-col min-w-0 overflow-hidden"
              >
                <span className="text-xs font-bold text-black/80 truncate">
                  {user?.displayName || user?.email?.split('@')[0] || 'ผู้ใช้งานระบบ'}
                </span>
                <span className="text-[10px] text-black/40 font-medium truncate">
                  {config?.label || activeRole}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative group">
          <button
            onClick={handleLogout}
            className="relative w-full flex items-center transition-colors duration-150 text-red-600 hover:text-red-700"
            style={{
              height: 44,
              borderRadius: 22,
              paddingLeft: isExpanded ? 10 : 0,
              paddingRight: isExpanded ? 10 : 0,
              justifyContent: isExpanded ? 'flex-start' : 'center',
              gap: isExpanded ? 10 : 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fef2f2'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
              <LogOut size={20} />
            </div>

            <AnimatePresence>
              {isExpanded && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                  className="text-xs font-semibold whitespace-nowrap"
                >
                  ออกจากระบบ
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {!isExpanded && (
            <div
              className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl text-black/70 text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 z-50"
              style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}
            >
              ออกจากระบบ
            </div>
          )}
        </div>
      </div>

      <UserProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
      />
    </motion.div>
  );
}
