// src/components/layouts/PortalLayout.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Search, LogOut, Menu, Plus, Megaphone, Clock, FileText, Settings, Zap, ChevronLeft, UserCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/features/auth/authService';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Role config ─────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<string, { label: string; gradient: string }> = {
  sysadmin: { label: 'System Admin', gradient: 'from-violet-500 to-indigo-600' },
  admin: { label: 'ผู้บริหาร', gradient: 'from-sky-500 to-blue-600' },
  teacher: { label: 'ครูผู้สอน', gradient: 'from-rose-500 to-pink-600' },
  staff: { label: 'เจ้าหน้าที่', gradient: 'from-emerald-500 to-teal-600' },
  student: { label: 'นักเรียน', gradient: 'from-amber-500 to-orange-600' },
  parent: { label: 'ผู้ปกครอง', gradient: 'from-blue-400 to-cyan-500' },
};

// ── Bottom Tab Bar Config per Role ──────────────────────────────────────────
const BOTTOM_TAB_CONFIG: Record<string, Array<{ label: string; icon: React.ReactNode; path: string }>> = {
  sysadmin: [
    { label: 'หน้าหลัก', icon: <LayoutDashboard size={20} />, path: '/portal' },
    { label: 'เมนู', icon: <Menu size={20} />, path: '/portal' },
    { label: 'ผู้ใช้', icon: <Plus size={20} className="rotate-45" />, path: '/portal/users' },
    { label: 'ตั้งค่า', icon: <Settings size={20} />, path: '/portal/settings' },
    { label: 'ออกระบบ', icon: <LogOut size={20} />, path: '#' },
  ],
  admin: [
    { label: 'หน้าหลัก', icon: <LayoutDashboard size={20} />, path: '/portal' },
    { label: 'เมนู', icon: <Menu size={20} />, path: '/portal' },
    { label: 'ผู้ใช้', icon: <Plus size={20} className="rotate-45" />, path: '/portal/users' },
    { label: 'รายงาน', icon: <FileText size={20} />, path: '/portal/reports' },
    { label: 'ออกระบบ', icon: <LogOut size={20} />, path: '#' },
  ],
  teacher: [
    { label: 'หน้าหลัก', icon: <LayoutDashboard size={20} />, path: '/portal' },
    { label: 'เมนู', icon: <Menu size={20} />, path: '/portal' },
    { label: 'ออกระบบ', icon: <LogOut size={20} />, path: '#' },
  ],
  staff: [
    { label: 'หน้าหลัก', icon: <LayoutDashboard size={20} />, path: '/portal' },
    { label: 'เมนู', icon: <Menu size={20} />, path: '/portal' },
    { label: 'ลงเวลา', icon: <Clock size={20} />, path: '/portal/staff-attendance' },
    { label: 'การลา', icon: <FileText size={20} />, path: '/portal/leave' },
    { label: 'ออกระบบ', icon: <LogOut size={20} />, path: '#' },
  ],
  student: [
    { label: 'หน้าหลัก', icon: <LayoutDashboard size={20} />, path: '/portal' },
    { label: 'เมนู', icon: <Menu size={20} />, path: '/portal' },
    { label: 'PMV Voice', icon: <Megaphone size={20} />, path: '/portal/feedback' },
    { label: 'ออกระบบ', icon: <LogOut size={20} />, path: '#' },
  ],
  parent: [
    { label: 'หน้าหลัก', icon: <LayoutDashboard size={20} />, path: '/portal' },
    { label: 'เมนู', icon: <Menu size={20} />, path: '/portal' },
    { label: 'ประกาศ', icon: <Megaphone size={20} />, path: '/portal/announcements' },
    { label: 'รายงาน', icon: <FileText size={20} />, path: '/portal/reports' },
    { label: 'ออกระบบ', icon: <LogOut size={20} />, path: '#' },
  ],
};

// ── Glass style (exported so pages can also use it) ───────────────────────────
export const GLASS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.35)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.55)',
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface PortalLayoutProps {
  /** Optional page title shown in header center (desktop) */
  title?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PortalLayout({ title }: PortalLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData, role } = useAuth();
  const [showSearch, setShowSearch] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [view, setView] = useState<'dashboard' | 'menu'>('dashboard');
  const profilePopupRef = useRef<HTMLDivElement | null>(null);

  const isHome = location.pathname === '/portal' || location.pathname === '/portal/';
  const isUsersManagement = location.pathname === '/portal/users' || location.pathname.startsWith('/portal/users/');
  const cfg = ROLE_CONFIG[role ?? ''] ?? ROLE_CONFIG.student;
  const isExecutiveRole = role === 'admin' || role === 'sysadmin';
  const mobileHeaderTabs = useMemo(() => {
    const tabs = BOTTOM_TAB_CONFIG[role ?? 'student'] || BOTTOM_TAB_CONFIG.student;
    if (!isExecutiveRole) return tabs;
    return tabs.filter((tab) => tab.label === 'หน้าหลัก' || tab.label === 'เมนู' || tab.label === 'ออกระบบ');
  }, [role, isExecutiveRole]);
  
  const displayName = userData?.firstName 
    ? `${userData.prefix || ''}${userData.firstName} ${userData.lastName || ''}`.trim()
    : (user?.displayName || user?.email || 'ผู้ใช้งาน');

  const initials = useMemo(() => {
    if (userData?.firstName) return userData.firstName.charAt(0);
    if (user?.displayName) return user.displayName.charAt(0);
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return '?';
  }, [user, userData]);

  const [currentTime, setCurrentTime] = useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showProfilePopup) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profilePopupRef.current && !profilePopupRef.current.contains(target)) {
        setShowProfilePopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfilePopup]);

  const openProfilePopup = () => {
    setShowProfilePopup(true);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('th-TH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  };

  const handleForceLogout = async () => {
    const ok = window.confirm('ต้องการบังคับผู้ใช้ทุกคนให้ออกจากระบบทันทีใช่หรือไม่?');
    if (!ok) return;
    try {
      await setDoc(doc(db, 'system_config', 'auth_controls'), {
        forceLogoutAllAt: serverTimestamp(),
        forcedByUid: user?.uid ?? null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await authService.logout();
    } catch (error) {
      console.error('force logout all failed:', error);
      window.alert('บังคับออกทุกผู้ใช้ไม่สำเร็จ');
    }
  };

  return (
    <div className="h-[100dvh] min-h-[100svh] w-full relative flex flex-col overflow-hidden">

      {/* ── Background (Pure White) ── */}
      <div className="absolute inset-0 z-0 bg-white" />


      {/* ── Top Bar ── */}
      <div className="relative z-20 border-b border-slate-100"
        style={{
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(12px) saturate(180%)',
          WebkitBackdropFilter: 'blur(12px) saturate(180%)',
          borderBottom: 'none',
        }}
      >
        <div className="max-w-[1600px] mx-auto flex items-center justify-between px-6 pb-2.5"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
        >

        {/* LEFT: Avatar + Name/Role Capsule + Date/Time + Settings */}
        <div className="flex items-center gap-3 flex-1 md:flex-none">

          {/* Mobile: Header Tabs */}
          <div className="flex md:hidden items-center justify-between w-full">
            {!isHome ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setView('menu');
                  navigate('/portal');
                }}
                className="flex-shrink-0 flex h-9 w-9 rounded-full items-center justify-center text-slate-700 transition-colors border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
                title="กลับเมนู"
              >
                <ChevronLeft size={20} />
              </motion.button>
            ) : (
              mobileHeaderTabs.map((tab, idx) => {
                return (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (tab.label === 'ออกระบบ') {
                        authService.logout();
                      } else if (tab.label === 'เมนู') {
                        setView('menu');
                        if (!isHome) navigate('/portal');
                      } else {
                        setView('dashboard');
                        navigate(tab.path || '/portal');
                      }
                    }}
                    className={`flex-shrink-0 flex items-center justify-center p-2 rounded-xl transition-all ${
                      (tab.label === 'เมนู' && view === 'menu') || 
                      (tab.label === 'หน้าหลัก' && view === 'dashboard' && isHome) ||
                      (!isHome && location.pathname.startsWith(tab.path) && tab.path !== '/portal')
                        ? 'text-slate-900 bg-slate-100 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-800 border border-transparent'
                    }`}
                    title={tab.label}
                  >
                    {tab.icon}
                  </motion.button>
                );
              })
            )}
          </div>

          {/* Desktop: Back button or Avatar */}
          {!isHome ? (
            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: '#f1f5f9' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setView('menu');
                navigate('/portal');
              }}
              className="hidden md:flex h-9 w-9 rounded-full items-center justify-center text-slate-700 transition-colors border border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400"
              title="กลับเมนู"
            >
              <ChevronLeft size={16} />
            </motion.button>
          ) : (
            <>
              <div ref={profilePopupRef} className="hidden md:flex items-center gap-2 relative">
                {/* Desktop: Avatar (clickable → Profile popup) */}
                <button
                  type="button"
                  className="w-11 h-11 rounded-full flex-shrink-0 cursor-pointer overflow-hidden border-2 border-white shadow-sm ring-1 ring-slate-200/50"
                  onClick={openProfilePopup}
                >
                  {userData?.photoURL || user?.photoURL ? (
                    <img
                      src={userData?.photoURL || user?.photoURL}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className={`w-full h-full bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white font-bold text-sm`}
                    >
                      {initials}
                    </div>
                  )}
                </button>

                {/* Desktop: Name + Role Capsule (clickable → Profile popup) */}
                <button
                  type="button"
                  className="flex items-center rounded-full px-4 py-1.5 cursor-pointer"
                  style={GLASS}
                  onClick={openProfilePopup}
                >
                  <div className="flex flex-col items-start gap-1">
                    <p className="text-[13px] font-black text-slate-800 leading-none">
                      {displayName}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-br ${cfg.gradient} shadow-sm`} />
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                        {cfg.label}
                      </p>
                    </div>
                  </div>
                </button>

                {showProfilePopup && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    className="absolute top-[52px] left-0 z-50 w-[320px] rounded-2xl border border-slate-200 bg-white shadow-2xl p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden ring-1 ring-slate-200">
                        {userData?.photoURL || user?.photoURL ? (
                          <img
                            src={userData?.photoURL || user?.photoURL}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white font-black`}>
                            {initials}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-800 truncate">{displayName}</p>
                        <p className="text-[11px] font-bold text-slate-500 truncate">{cfg.label}</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                      <p className="text-[11px] text-slate-500 truncate">{user?.email || '-'}</p>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfilePopup(false);
                          navigate('/portal/profile');
                        }}
                        className="h-9 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <UserCircle2 size={14} />
                        ข้อมูลส่วนตัว
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowProfilePopup(false)}
                        className="h-9 rounded-xl border border-slate-200 text-slate-600 text-xs font-black hover:bg-slate-50 transition-colors"
                      >
                        ปิด
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </>
          )}

          {/* Time & Date Display (Dashboard only) */}
          {isHome && view === 'dashboard' && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="hidden lg:flex flex-col items-start px-4 border-l border-slate-200/50 py-0.5"
            >
              <p
                className="text-[13px] font-black text-slate-800 tracking-tight leading-none mb-1 uppercase font-sukhumvit"
              >
                {formatTime(currentTime)}
              </p>
              <p
                className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none"
              >
                {formatDate(currentTime)}
              </p>
            </motion.div>
          )}



          {/* Page Title (with separator) */}
          {title && (
            <div className="flex items-center gap-3 ml-2">
              <div className="h-4 w-[1px] bg-slate-300" />
              <p className="text-sm font-bold text-slate-800 tracking-tight">{title}</p>
            </div>
          )}
        </div>

        {/* CENTER: Portal Center + Filters */}
        <div className="hidden lg:flex flex-1 justify-center px-4 gap-4 items-center">
          <div id="header-portal-center" className="flex items-center justify-center" />

          <div id="header-portal-filters" className="flex items-center justify-center" />
        </div>

        {/* RIGHT: Portal Actions + Search + Home/Toggle + Logout */}
        <div className="flex items-center gap-3">
          <div id="header-portal-right-actions" className="flex items-center gap-2" />

          {/* Dashboard/Menu Toggle (Right aligned) */}
          {isHome && (
            <div
              className="hidden lg:flex items-center rounded-full p-1 gap-1 bg-transparent"
            >
              <button
                onClick={() => {
                  setView('dashboard');
                  if (!isHome) navigate('/portal');
                }}
                className={`h-9 w-9 flex items-center justify-center rounded-full transition-all duration-300 ${(!isHome || view === 'dashboard')
                  ? 'bg-transparent text-slate-800 border border-slate-400'
                  : 'text-slate-500 border border-transparent hover:text-slate-800 hover:bg-slate-50'
                  }`}
                title="หน้าหลัก"
              >
                <LayoutDashboard size={16} />
              </button>
              <button
                onClick={() => {
                  setView('menu');
                  if (!isHome) navigate('/portal');
                }}
                className={`h-9 w-9 flex items-center justify-center rounded-full transition-all duration-300 ${(isHome && view === 'menu')
                  ? 'bg-transparent text-slate-800 border border-slate-400'
                  : 'text-slate-500 border border-transparent hover:text-slate-800 hover:bg-slate-50'
                  }`}
                title="เมนู"
              >
                <Menu size={16} />
              </button>
            </div>
          )}



          {/* Force logout button */}
          {role !== 'student' && isUsersManagement && (
            <button
              onClick={handleForceLogout}
              className="hidden md:flex h-9 w-9 rounded-full items-center justify-center text-amber-600 hover:bg-amber-500 hover:text-white hover:shadow-sm transition-all"
              style={GLASS}
              title="บังคับออกจากระบบ"
            >
              <Zap size={16} />
            </button>
          )}




          {/* Logout button - only show on home/dashboard */}
          {isHome && (
            <motion.button
              onClick={() => authService.logout()}
              whileHover={{ backgroundColor: '#dc2626', color: '#fff' }}
              transition={{ duration: 0.2 }}
              className="hidden md:flex h-9 w-9 rounded-full items-center justify-center text-rose-500"
              style={GLASS}
              title="ออกจากระบบ"
            >
              <LogOut size={16} />
            </motion.button>
          )}
        </div>
        </div>
      </div>

      {/* ── Search bar (absolute overlay to prevent layout shift) ── */}
      <AnimatePresence>
        {showSearch && (
          <>
            {/* Dark/Blur Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSearch(false)}
              className="fixed inset-0 z-20 bg-slate-900/10 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-[60px] md:top-[88px] left-0 right-0 z-30 px-4 md:px-8 pointer-events-none"
            >
              <div className="max-w-4xl mx-auto pointer-events-auto">
                <div className="flex items-center gap-2 px-4 py-4 rounded-2xl shadow-2xl" style={{ ...GLASS, background: 'rgba(255,255,255,0.95)' }}>
                  <Search size={18} className="text-slate-500 flex-shrink-0" />
                  <input
                    autoFocus
                    placeholder="ค้นหาเมนู, ข้อมูล, หรือฟังก์ชัน..."
                    className="flex-1 bg-transparent text-lg text-slate-800 placeholder:text-slate-400 outline-none font-sarabun"
                    onBlur={() => {
                      // Small delay to allow clicking buttons if needed, or just remove onBlur if backdrop handles it
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] font-bold text-slate-400 px-2 py-1 rounded bg-slate-100 border border-slate-200/50">ESC</div>
                    <button
                      onClick={() => setShowSearch(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <Plus size={20} className="rotate-45" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Page Content (child routes rendered here) ── */}
      <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="max-w-[1600px] mx-auto w-full px-3 md:px-6 pt-4 pb-6 md:pb-10 flex-1 flex flex-col min-h-0 overflow-y-auto">
            <Outlet context={{ view, showSearch }} />
          </div>
        </div>
      </div>


    </div>
  );
}
