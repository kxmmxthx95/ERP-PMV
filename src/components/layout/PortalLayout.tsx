import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard, UserCog, ShieldCheck, GraduationCap, History, Settings,
  BookUser, BadgeCheck, Users, DoorOpen, Megaphone, BarChart2, UserCheck,
  CalendarDays, FolderOpen, ClipboardList, Home,
  Menu, Bell, LogOut, ChevronRight, ChevronLeft,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';

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
};

function NavIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICON_MAP[name] ?? LayoutDashboard;
  return <Icon size={size} className={className} />;
}

// ---- Types ----
interface MenuItem {
  name: string;
  path: string;
  icon: string;
}

interface MenuSection {
  label?: string;
  items: MenuItem[];
}

// ---- Role Config ----
interface RoleConfig {
  label: string;
  color: string;         // Tailwind text color class
  bgActive: string;      // active item bg
  textActive: string;    // active item text
  iconActive: string;    // active item icon color
  gradient: string;      // logo gradient
  badge: string;         // badge bg + text (Tailwind)
  sections: MenuSection[];
}

const ROLE_CONFIG: Record<string, RoleConfig> = {
  sysadmin: {
    label: 'System Admin',
    color: 'text-violet-600',
    bgActive: 'bg-violet-50',
    textActive: 'text-violet-700',
    iconActive: 'text-violet-500',
    gradient: 'from-violet-500 to-indigo-600',
    badge: 'bg-violet-100 text-violet-700',
    sections: [
      {
        items: [
          { name: 'ภาพรวมระบบ', path: '/sysadmin', icon: 'dashboard' },
        ],
      },
      {
        label: 'จัดการระบบ',
        items: [
          { name: 'ผู้ใช้งานทั้งหมด', path: '/sysadmin/users', icon: 'manage_accounts' },
          { name: 'กำหนดสิทธิ์', path: '/sysadmin/roles', icon: 'admin_panel_settings' },
          { name: 'โรงเรียน / สาขา', path: '/sysadmin/schools', icon: 'school' },
        ],
      },
      {
        label: 'ระบบ',
        items: [
          { name: 'บันทึกกิจกรรม', path: '/sysadmin/logs', icon: 'history' },
          { name: 'ตั้งค่าระบบ', path: '/sysadmin/settings', icon: 'settings' },
        ],
      },
    ],
  },

  admin: {
    label: 'ผู้บริหาร',
    color: 'text-blue-600',
    bgActive: 'bg-blue-50',
    textActive: 'text-blue-700',
    iconActive: 'text-blue-500',
    gradient: 'from-blue-500 to-cyan-500',
    badge: 'bg-blue-100 text-blue-700',
    sections: [
      {
        items: [
          { name: 'ภาพรวม', path: '/admin', icon: 'dashboard' },
        ],
      },
      {
        label: 'บุคลากร',
        items: [
          { name: 'จัดการครู', path: '/admin/teachers', icon: 'person_book' },
          { name: 'จัดการเจ้าหน้าที่', path: '/admin/staff', icon: 'badge' },
        ],
      },
      {
        label: 'นักเรียน',
        items: [
          { name: 'รายชื่อนักเรียน', path: '/admin/students', icon: 'group' },
          { name: 'จัดการห้องเรียน', path: '/admin/classes', icon: 'meeting_room' },
        ],
      },
      {
        label: 'ทั่วไป',
        items: [
          { name: 'ประกาศ', path: '/admin/announcements', icon: 'campaign' },
          { name: 'รายงาน', path: '/admin/reports', icon: 'bar_chart' },
        ],
      },
    ],
  },

  staff: {
    label: 'เจ้าหน้าที่',
    color: 'text-emerald-600',
    bgActive: 'bg-emerald-50',
    textActive: 'text-emerald-700',
    iconActive: 'text-emerald-500',
    gradient: 'from-emerald-400 to-teal-500',
    badge: 'bg-emerald-100 text-emerald-700',
    sections: [
      {
        items: [
          { name: 'หน้าหลัก', path: '/staff', icon: 'dashboard' },
        ],
      },
      {
        label: 'งานนักเรียน',
        items: [
          { name: 'รายชื่อนักเรียน', path: '/staff/students', icon: 'group' },
          { name: 'บันทึกการเข้าเรียน', path: '/staff/attendance', icon: 'how_to_reg' },
        ],
      },
      {
        label: 'งานทั่วไป',
        items: [
          { name: 'ตารางงาน', path: '/staff/schedule', icon: 'calendar_month' },
          { name: 'เอกสาร', path: '/staff/documents', icon: 'folder_open' },
          { name: 'ประกาศ', path: '/staff/announcements', icon: 'campaign' },
        ],
      },
    ],
  },

  teacher: {
    label: 'ครูผู้สอน',
    color: 'text-pink-600',
    bgActive: 'bg-pink-50',
    textActive: 'text-pink-700',
    iconActive: 'text-pink-500',
    gradient: 'from-pink-400 to-rose-500',
    badge: 'bg-pink-100 text-pink-700',
    sections: [
      {
        items: [
          { name: 'หน้าหลัก', path: '/teacher', icon: 'dashboard' },
        ],
      },
      {
        label: 'การสอน',
        items: [
          { name: 'ตารางสอน', path: '/teacher/schedule', icon: 'calendar_month' },
          { name: 'รายชื่อนักเรียน', path: '/teacher/students', icon: 'group' },
          { name: 'บันทึกการเข้าเรียน', path: '/teacher/attendance', icon: 'how_to_reg' },
        ],
      },
      {
        label: 'ผลการเรียน',
        items: [
          { name: 'จัดการคะแนน', path: '/teacher/grades', icon: 'grading' },
          { name: 'รายงานผล', path: '/teacher/reports', icon: 'bar_chart' },
        ],
      },
    ],
  },
};

// Fallback config for unrecognized roles
const DEFAULT_CONFIG: RoleConfig = {
  label: 'Portal',
  color: 'text-slate-600',
  bgActive: 'bg-slate-100',
  textActive: 'text-slate-700',
  iconActive: 'text-slate-500',
  gradient: 'from-slate-400 to-slate-600',
  badge: 'bg-slate-100 text-slate-600',
  sections: [{ items: [{ name: 'หน้าหลัก', path: '/', icon: 'home' }] }],
};

// ---- Main Layout ----
export default function PortalLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { role, logout, user } = useAuth();
  const navigate = useNavigate();

  const config = (role && ROLE_CONFIG[role]) ? ROLE_CONFIG[role] : DEFAULT_CONFIG;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800">

      {/* ---- Mobile Overlay ---- */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
              className="fixed inset-y-0 left-0 w-64 bg-white z-50 shadow-2xl flex flex-col lg:hidden"
            >
              <SidebarContent
                config={config}
                user={user}
                isCollapsed={false}
                onNavigate={() => setIsMobileOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ---- Desktop Sidebar ---- */}
      <motion.aside
        animate={{ width: isCollapsed ? 64 : 256 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
        className="hidden lg:flex flex-col bg-white border-r border-slate-100 sticky top-0 h-screen shadow-sm overflow-hidden"
      >
        <SidebarContent
          config={config}
          user={user}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
      </motion.aside>

      {/* ---- Main Area ---- */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <header className="h-14 border-b border-slate-100 sticky top-0 z-30 px-4 lg:px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors lg:hidden"
            >
              <Menu size={20} />
            </button>

            {/* Page title area - breadcrumb slot */}
            <div className="hidden sm:block">
              <PageTitle config={config} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white" />
            </button>

            <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

            {/* User chip */}
            <div className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white text-[10px] font-bold shadow`}>
                {user?.email?.charAt(0).toUpperCase() ?? 'U'}
              </div>
              <span className="text-xs font-medium text-slate-700 hidden sm:block max-w-[120px] truncate">
                {user?.email?.split('@')[0]}
              </span>
              <button
                onClick={handleLogout}
                title="ออกจากระบบ"
                className="text-slate-400 hover:text-red-500 transition-colors ml-1"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-7xl mx-auto"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}

// ---- Sidebar Content ----
interface SidebarContentProps {
  config: RoleConfig;
  user: any;
  isCollapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}

function SidebarContent({ config, user, isCollapsed, onNavigate, onToggleCollapse }: SidebarContentProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNav = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const isActive = (path: string) => {
    // Exact match for index routes, prefix match for sub-pages
    if (path.split('/').length <= 2) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex flex-col h-full py-4">

      {/* Logo / Brand */}
      <div className={`flex items-center gap-3 px-4 mb-6 ${isCollapsed ? 'justify-center' : ''}`}>
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white font-extrabold text-base shadow-md flex-shrink-0`}>
          P
        </div>
        {!isCollapsed && (
          <div className="overflow-hidden">
            <h1 className="font-extrabold text-sm text-slate-800 leading-tight">Piyamit School</h1>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${config.badge}`}>
              {config.label}
            </span>
          </div>
        )}
      </div>

      {/* Nav Sections */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-4">
        {config.sections.map((section, si) => (
          <div key={si}>
            {/* Section label */}
            {section.label && !isCollapsed && (
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-1">
                {section.label}
              </p>
            )}
            {section.label && isCollapsed && (
              <div className="border-t border-slate-100 my-2" />
            )}

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    title={isCollapsed ? item.name : undefined}
                    className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium transition-all group
                      ${active
                        ? `${config.bgActive} ${config.textActive} shadow-sm`
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }
                      ${isCollapsed ? 'justify-center' : ''}
                    `}
                  >
                    <NavIcon
                      name={item.icon}
                      size={20}
                      className={`flex-shrink-0 transition-colors ${active ? config.iconActive : 'text-slate-400 group-hover:text-slate-600'}`}
                    />
                    {!isCollapsed && (
                      <span className="truncate">{item.name}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: user info + collapse toggle */}
      <div className={`px-3 pt-4 border-t border-slate-100 mt-2 space-y-1`}>
        {/* User row */}
        {!isCollapsed && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-slate-50 mb-1">
            <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
              {user?.email?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-700 truncate">{user?.email?.split('@')[0]}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
        )}

        {/* Settings */}
        <button className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'ตั้งค่า' : undefined}
        >
          <Settings size={20} className="flex-shrink-0" />
          {!isCollapsed && <span>ตั้งค่า</span>}
        </button>

        {/* Collapse toggle (desktop only) */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? 'ขยาย Sidebar' : 'ย่อ Sidebar'}
          >
            {isCollapsed ? <ChevronRight size={20} className="flex-shrink-0" /> : <ChevronLeft size={20} className="flex-shrink-0" />}
            {!isCollapsed && <span>ย่อ Sidebar</span>}
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Page Title (breadcrumb-style) ----
function PageTitle({ config }: { config: RoleConfig }) {
  const location = useLocation();

  // Find current menu item name by matching path
  const allItems = config.sections.flatMap(s => s.items);
  const current = allItems.find(item => {
    if (item.path.split('/').length <= 2) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  });

  return (
    <div>
      <h2 className="text-sm font-bold text-slate-800">
        {current?.name ?? config.label}
      </h2>
    </div>
  );
}
