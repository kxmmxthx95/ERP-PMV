// src/components/layouts/PortalLayout.tsx
import React, { memo, useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Search, LogOut, Plus, ChevronLeft, Home } from 'lucide-react';
import {
  HiOutlineHome,
  HiOutlineSquares2X2,
  HiOutlineUsers,
  HiOutlineCog6Tooth,
  HiOutlineArrowLeftOnRectangle,
  HiOutlineDocumentText,
  HiOutlineClock,
  HiOutlineMegaphone,
  HiUser,
  HiCpuChip,
} from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { PermissionVisible } from '@/components/PermissionGate';
import { authService } from '@/features/auth/authService';
import { colors } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

function isUserLineConnected(userData: { lineUid?: string; lineToken?: string } | null | undefined): boolean {
  return Boolean((userData?.lineUid || userData?.lineToken || '').trim());
}

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
    { label: 'หน้าหลัก', icon: <HiOutlineHome size={20} />, path: '/portal' },
    { label: 'เมนู', icon: <HiOutlineSquares2X2 size={20} />, path: '/portal' },
    { label: 'ผู้ใช้', icon: <HiOutlineUsers size={20} />, path: '/portal/users' },
    { label: 'ตั้งค่า', icon: <HiOutlineCog6Tooth size={20} />, path: '/portal/settings' },
    { label: 'ออกระบบ', icon: <HiOutlineArrowLeftOnRectangle size={20} />, path: '#' },
  ],
  admin: [
    { label: 'หน้าหลัก', icon: <HiOutlineHome size={20} />, path: '/portal' },
    { label: 'เมนู', icon: <HiOutlineSquares2X2 size={20} />, path: '/portal' },
    { label: 'ผู้ใช้', icon: <HiOutlineUsers size={20} />, path: '/portal/users' },
    { label: 'ออกระบบ', icon: <HiOutlineArrowLeftOnRectangle size={20} />, path: '#' },
  ],
  teacher: [
    { label: 'หน้าหลัก', icon: <HiOutlineHome size={20} />, path: '/portal' },
    { label: 'เมนู', icon: <HiOutlineSquares2X2 size={20} />, path: '/portal' },
    { label: 'ออกระบบ', icon: <HiOutlineArrowLeftOnRectangle size={20} />, path: '#' },
  ],
  staff: [
    { label: 'หน้าหลัก', icon: <HiOutlineHome size={20} />, path: '/portal' },
    { label: 'เมนู', icon: <HiOutlineSquares2X2 size={20} />, path: '/portal' },
    { label: 'ลงเวลา', icon: <HiOutlineClock size={20} />, path: '/portal/staff-attendance' },
    { label: 'การลา', icon: <HiOutlineDocumentText size={20} />, path: '/portal/leave' },
    { label: 'ออกระบบ', icon: <HiOutlineArrowLeftOnRectangle size={20} />, path: '#' },
  ],
  student: [
    { label: 'หน้าหลัก', icon: <HiOutlineHome size={20} />, path: '/portal' },
    { label: 'เมนู', icon: <HiOutlineSquares2X2 size={20} />, path: '/portal' },
    { label: 'PMV Voice', icon: <HiOutlineMegaphone size={20} />, path: '/portal/feedback' },
    { label: 'ออกระบบ', icon: <HiOutlineArrowLeftOnRectangle size={20} />, path: '#' },
  ],
  parent: [
    { label: 'หน้าหลัก', icon: <HiOutlineHome size={20} />, path: '/portal' },
    { label: 'เมนู', icon: <HiOutlineSquares2X2 size={20} />, path: '/portal' },
    { label: 'ประกาศ', icon: <HiOutlineMegaphone size={20} />, path: '/portal/announcements' },
    { label: 'ออกระบบ', icon: <HiOutlineArrowLeftOnRectangle size={20} />, path: '#' },
  ],
};

export const GLASS: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.05)',
};

function formatPortalDate(date: Date) {
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatPortalTime(date: Date) {
  return new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/** Isolated 1s tick — re-renders only this block, not PortalLayout / Outlet. */
const PortalHeaderClock = memo(function PortalHeaderClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="hidden lg:flex flex-col items-start px-4 border-l border-slate-200/50 py-0.5"
    >
      <p className="text-[13px] font-black text-slate-800 tracking-tight leading-none mb-1 uppercase font-sukhumvit">
        {formatPortalTime(now)}
      </p>
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
        {formatPortalDate(now)}
      </p>
    </motion.div>
  );
});

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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isHome = location.pathname === '/portal' || location.pathname === '/portal/';
  const isAiAgentsPage = location.pathname.startsWith('/portal/ai-agents');
  /** AI Agent shortcut — portal home (dashboard + menu) only */
  const showAiAgentButton = isHome;
  const cfg = ROLE_CONFIG[role ?? ''] ?? ROLE_CONFIG.student;
  const isExecutiveRole = role === 'admin' || role === 'sysadmin';
  const mobileHeaderTabs = useMemo(() => {
    const tabs = BOTTOM_TAB_CONFIG[role ?? 'student'] || BOTTOM_TAB_CONFIG.student;
    // Filter out "ออกระบบ" to hide it from the normal header tabs
    const filtered = tabs.filter((tab) => tab.label !== 'ออกระบบ');
    if (!isExecutiveRole) return filtered;
    return filtered.filter((tab) => tab.label === 'หน้าหลัก' || tab.label === 'เมนู');
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

  const isLineConnected = isUserLineConnected(userData);

  useEffect(() => {
    if (!showProfilePopup) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobile) return; // Let mobile close be explicitly handled by tapping the user profile button
      const target = event.target as Node;
      if (profilePopupRef.current && !profilePopupRef.current.contains(target)) {
        setShowProfilePopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfilePopup, isMobile]);

  const openProfilePopup = () => {
    setShowProfilePopup(prev => !prev);
  };

  const renderDesktopHomeMenuButtons = () => (
    <>
      <button
        type="button"
        onClick={() => {
          setView('dashboard');
          navigate('/portal');
        }}
        className={`h-9 w-9 flex items-center justify-center rounded-full transition-all duration-300 shrink-0 ${(!isHome || view === 'dashboard')
          ? 'bg-white/40 text-slate-800 border border-slate-300 shadow-xs'
          : 'text-slate-600 border border-transparent'
          }`}
        title="หน้าหลัก"
      >
        <Home size={16} />
      </button>
      <button
        type="button"
        onClick={() => {
          setView('menu');
          navigate('/portal');
        }}
        className={`h-9 w-9 flex items-center justify-center rounded-full transition-all duration-300 shrink-0 ${(isHome && view === 'menu')
          ? 'bg-white/40 text-slate-800 border border-slate-300 shadow-xs'
          : 'text-slate-600 border border-transparent'
          }`}
        title="เมนู"
      >
        <LayoutDashboard size={16} />
      </button>
    </>
  );

  const renderMobileHeaderTabButton = (tab: (typeof mobileHeaderTabs)[number], idx: number) => (
    <motion.button
      key={`${tab.label}-${idx}`}
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
      className={`flex-shrink-0 flex items-center justify-center w-8 h-8 lg:w-9 lg:h-9 rounded-full transition-all ${
        (tab.label === 'เมนู' && view === 'menu')
        || (tab.label === 'หน้าหลัก' && view === 'dashboard' && isHome)
        || (!isHome && location.pathname.startsWith(tab.path) && tab.path !== '/portal')
          ? 'text-slate-800 border border-slate-300 shadow-sm bg-white/40 backdrop-blur-sm'
          : tab.label === 'ออกระบบ'
            ? 'text-rose-500 border border-transparent bg-transparent hover:bg-rose-50'
            : 'text-slate-500 border border-transparent bg-transparent'
      }`}
      title={tab.label}
    >
      {React.isValidElement(tab.icon)
        ? React.cloneElement(tab.icon as React.ReactElement<{ size?: number }>, { size: 18 })
        : tab.icon}
    </motion.button>
  );

  const mobilePrimaryNavTabs = useMemo(
    () => mobileHeaderTabs.filter((tab) => tab.label === 'หน้าหลัก' || tab.label === 'เมนู'),
    [mobileHeaderTabs],
  );
  const mobileSecondaryNavTabs = useMemo(
    () => mobileHeaderTabs.filter((tab) => tab.label !== 'หน้าหลัก' && tab.label !== 'เมนู'),
    [mobileHeaderTabs],
  );
  const renderAiAgentHeaderButton = (size: 'sm' | 'md' = 'md') => (
    <PermissionVisible featureKey="aiAgents" require="view-only">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        type="button"
        onClick={() => navigate('/portal/ai-agents')}
        className={cn(
          'flex items-center justify-center rounded-full transition-all duration-300',
          size === 'sm' ? 'h-8 w-8 lg:h-9 lg:w-9' : 'h-9 w-9',
          isAiAgentsPage
            ? 'bg-violet-600 text-white border border-violet-500 shadow-sm'
            : 'text-violet-600 border border-transparent hover:bg-violet-50 hover:border-violet-200',
        )}
        title="AI Agent Command"
        aria-label="AI Agent Command"
      >
        <HiCpuChip size={size === 'sm' ? 18 : 16} />
      </motion.button>
    </PermissionVisible>
  );

  const renderMobileAvatar = (alignRight: boolean) => (
    <div className="relative flex items-center gap-2">
      {!alignRight && (
        <button
          type="button"
          className={cn(
            'w-8 h-8 lg:w-9 lg:h-9 rounded-full flex-shrink-0 cursor-pointer overflow-hidden border-2 shadow-sm',
            isLineConnected ? 'border-[#06c755] ring-2 ring-[#06c755]/30' : 'border-slate-200',
          )}
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
              className={`w-full h-full bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white font-bold text-xs`}
            >
              {initials}
            </div>
          )}
        </button>
      )}

      {/* Name and Role text */}
      <button
        type="button"
        onClick={openProfilePopup}
        className={`flex flex-col gap-0.5 cursor-pointer text-left ${alignRight ? 'items-end text-right' : 'items-start text-left'}`}
      >
        <p className="text-[12px] font-black text-slate-800 leading-tight truncate max-w-[120px]">
          {displayName}
        </p>
        <div className="flex items-center gap-1">
          {!alignRight && <div className={`w-1 h-1 rounded-full bg-gradient-to-br ${cfg.gradient} shadow-xs`} />}
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none">
            {cfg.label}
          </p>
          {alignRight && <div className={`w-1 h-1 rounded-full bg-gradient-to-br ${cfg.gradient} shadow-xs`} />}
        </div>
      </button>

      {alignRight && (
        <button
          type="button"
          className={cn(
            'w-8 h-8 lg:w-9 lg:h-9 rounded-full flex-shrink-0 cursor-pointer overflow-hidden border-2 shadow-sm',
            isLineConnected ? 'border-[#06c755] ring-2 ring-[#06c755]/30' : 'border-slate-200',
          )}
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
              className={`w-full h-full bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white font-bold text-xs`}
            >
              {initials}
            </div>
          )}
        </button>
      )}
    </div>
  );

  const headerShellBg =
    showProfilePopup && isMobile ? '#121212' : colors.palette.shell;

  return (
    <div className="h-[100dvh] min-h-[100svh] min-h-[-webkit-fill-available] w-full relative flex flex-col overflow-hidden pt-safe pb-safe px-safe">

      {/* ── Background shell (fixed = ทะลุ safe-area / notch / แถบสายโทร iOS) ── */}
      <div
        className="fixed inset-0 z-0"
        style={{ background: colors.palette.shell }}
        aria-hidden
      />

      {/* ── Top Bar ── */}
      <div
        className="relative z-20 transition-all duration-300 border-none"
        style={{
          background: headerShellBg,
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        }}
      >
        <div className="max-w-[1600px] mx-auto relative flex items-center justify-between px-4 lg:px-6 pb-2 lg:pb-2.5 pt-2">

        {/* LEFT: Avatar + Name/Role Capsule + Date/Time + Settings */}
        <div className="flex items-center gap-3 flex-1 lg:flex-none">

          {/* Mobile: Header Tabs */}
          <div className="flex lg:hidden items-center justify-between w-full">
            {showProfilePopup ? (
              <div className="flex items-center justify-between w-full min-h-10 py-1 text-white animate-fadeIn">
                {/* Left side: Avatar + User Info (Clickable to close) */}
                <button
                  type="button"
                  onClick={() => setShowProfilePopup(false)}
                  className="flex items-center gap-2 cursor-pointer text-left focus:outline-none"
                >
                  <div
                    className={cn(
                      'w-8 h-8 lg:w-9 lg:h-9 rounded-full flex-shrink-0 overflow-hidden border-2 shadow-sm',
                      isLineConnected ? 'border-[#06c755] ring-2 ring-[#06c755]/40' : 'border-slate-700',
                    )}
                  >
                    {userData?.photoURL || user?.photoURL ? (
                      <img
                        src={userData?.photoURL || user?.photoURL}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className={`w-full h-full bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white font-bold text-xs`}
                      >
                        {initials}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-0.5">
                    <p className="text-[12px] font-black text-white leading-tight truncate max-w-[135px]">
                      {displayName}
                    </p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                      {cfg.label}
                    </p>
                  </div>
                </button>

                {/* Right side: ข้อมูลส่วนตัว and ออกระบบ icons */}
                <div className="flex items-center gap-2">
                  {/* ข้อมูลส่วนตัว button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowProfilePopup(false);
                      navigate('/portal/profile');
                    }}
                    className="flex h-8 w-8 lg:h-9 lg:w-9 rounded-full items-center justify-center border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-100 transition-colors"
                    title="ข้อมูลส่วนตัว"
                  >
                    <HiUser size={18} />
                  </motion.button>

                  {/* ออกระบบ button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowProfilePopup(false);
                      authService.logout();
                    }}
                    className="flex h-8 w-8 lg:h-9 lg:w-9 rounded-full items-center justify-center border border-slate-200 bg-white text-rose-500 shadow-sm hover:bg-rose-50 transition-colors"
                    title="ออกจากระบบ"
                  >
                    <LogOut size={18} />
                  </motion.button>
                </div>
              </div>
            ) : isHome ? (
              <>
                {/* Left side: Avatar */}
                {renderMobileAvatar(false)}

                {/* Right side: Navigation Tabs */}
                <div className="flex items-center gap-1 min-h-10">
                  {mobileSecondaryNavTabs.map((tab, idx) => renderMobileHeaderTabButton(tab, idx))}
                  {showAiAgentButton && renderAiAgentHeaderButton('sm')}
                  {mobilePrimaryNavTabs.map((tab, idx) => renderMobileHeaderTabButton(tab, idx))}
                </div>
              </>
            ) : (
              <>
                {/* Left side: Back Button */}
                <div className="relative flex items-center justify-between w-full min-h-10">
                  <div id="header-portal-mobile-back" className="flex-shrink-0 relative z-10">
                    <motion.button
                      id="portal-default-mobile-back"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setView('menu');
                        navigate('/portal');
                      }}
                      className="flex h-9 w-9 lg:h-9 lg:w-9 rounded-full items-center justify-center text-slate-700 transition-colors border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
                      title="กลับเมนู"
                    >
                      <ChevronLeft size={20} />
                    </motion.button>
                  </div>
                  <div
                    id="header-portal-center-mobile"
                    className="absolute inset-x-0 top-0 bottom-0 flex items-center justify-center pointer-events-none"
                  />
                  <div className="flex items-center justify-end relative z-10 shrink-0 gap-1">
                    <div id="header-portal-mobile-actions" className="flex items-center justify-end" />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Desktop: Avatar */}
          <div ref={profilePopupRef} className="hidden lg:flex items-center gap-2 relative">
            {/* Desktop: Avatar (clickable → Profile popup) */}
            <button
              type="button"
              className={cn(
                'w-11 h-11 rounded-full flex-shrink-0 cursor-pointer overflow-hidden border-2 border-white shadow-sm',
                isLineConnected ? 'ring-2 ring-[#06c755]' : 'ring-1 ring-slate-200/50',
              )}
              onClick={openProfilePopup}
              title={isLineConnected ? 'เชื่อม LINE แล้ว' : undefined}
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
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full overflow-hidden',
                      isLineConnected ? 'ring-2 ring-[#06c755]' : 'ring-1 ring-slate-200',
                    )}
                  >
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
                    <HiUser size={14} />
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

          {/* Time & Date Display (Dashboard only) — isolated tick, no Outlet re-render */}
          {isHome && view === 'dashboard' && <PortalHeaderClock />}



          {/* Page Title (with separator) */}
          {title && (
            <div className="flex items-center gap-3 ml-2">
              <div className="h-4 w-[1px] bg-slate-300" />
              <p className="text-sm font-bold text-slate-800 tracking-tight">{title}</p>
            </div>
          )}
        </div>

        {/* CENTER: Filters (desktop) */}
        <div className="hidden lg:flex flex-1 justify-center px-4 gap-4 items-center">
          <div id="header-portal-filters" className="flex items-center justify-center" />
        </div>

        {/* CENTER: Fixed viewport-centered portal (desktop) */}
        <div
          id="header-portal-center"
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 lg:flex items-center justify-center"
        />

        {/* RIGHT: Portal Actions + Home/Menu + Logout (logout after menu) */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center rounded-full p-1 gap-1 bg-transparent">
            <div id="header-portal-right-actions" className="flex items-center gap-1" />
            {showAiAgentButton && renderAiAgentHeaderButton()}
          </div>

          <div className="hidden lg:flex items-center gap-1.5 shrink-0">
            <div id="header-portal-home-actions" className="flex items-center gap-1.5" />
            {renderDesktopHomeMenuButtons()}
          </div>

          {isHome && (
            <button
              type="button"
              onClick={() => authService.logout()}
              className="hidden lg:flex h-9 w-9 rounded-full items-center justify-center text-rose-500 shrink-0"
              style={GLASS}
              title="ออกจากระบบ"
            >
              <LogOut size={16} />
            </button>
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
              className="absolute top-[60px] lg:top-[88px] left-0 right-0 z-30 px-4 lg:px-8 pointer-events-none"
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
      <div className="relative flex-1 flex flex-col min-h-0 min-w-0">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide overscroll-y-contain">
          <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-5 lg:px-8 pt-2 lg:pt-3 pb-5 lg:pb-12 min-h-full flex flex-col">
            {/* Inner gutter so card shadows are not clipped by the scroll edges */}
            <div className="px-1.5 py-3 sm:px-2 sm:py-4 flex flex-col flex-1 min-h-0 w-full">
              <Outlet context={{ view, showSearch }} />
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
