import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_CONFIGS } from './DashboardSidebar';
import { Menu, Search, X, Bell, ChevronDown } from 'lucide-react';

interface DashboardTopbarProps {
  onMobileMenuOpen: () => void;
}

export default function DashboardTopbar({ onMobileMenuOpen }: DashboardTopbarProps) {
  const { role, user } = useAuth();
  const location = useLocation();
  const [search, setSearch] = useState('');

  // ดึง Role จาก Auth หรือถ้าไม่มี (กรณี Bypass Login) ให้ดึงจาก URL แทน
  const activeRole = role || location.pathname.split('/')[1];
  const config = activeRole ? (ROLE_CONFIGS[activeRole] ?? null) : null;

  // Resolve current page name
  const allItems = config?.sections.flatMap(s => s.items) ?? [];
  const currentItem = allItems.find(item => {
    const depth = item.path.split('/').filter(Boolean).length;
    return depth <= 1
      ? location.pathname === item.path
      : location.pathname.startsWith(item.path);
  });
  const currentPageName = currentItem?.name ?? config?.label ?? 'Dashboard';

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const avatar = displayName.charAt(0).toUpperCase();

  return (
    /**
     * Borderless topbar — seamless with gradient wallpaper.
     * No visible bottom border. Ultra-translucent glass.
     * Blends into the environment like a floating layer.
     */
    <header
      className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 lg:px-6"
      style={{
        background: 'rgba(239, 239, 239, 0.65)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Mobile hamburger */}
      <button
        onClick={onMobileMenuOpen}
        className="p-2 rounded-lg text-black/30 hover:text-black/60 active:text-black transition-colors lg:hidden flex-shrink-0"
      >
        <Menu size={20} />
      </button>

      {/* Search — minimal glass pill */}
      <div
        className="flex items-center gap-2 h-8 px-3 rounded-full w-56 flex-shrink-0 transition-all focus-within:w-64 group"
        style={{
          background: 'rgba(0,0,0,0.06)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <Search size={14} className="flex-shrink-0 text-black/30 group-focus-within:text-black/50 transition-colors" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหา..."
        className="bg-transparent text-xs text-black/70 placeholder-black/25 outline-none w-full"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-black/25 hover:text-black/50 transition-colors flex-shrink-0"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Page title */}
      <div className="hidden md:block flex-1 ml-2">
        <h2 className="text-xs font-semibold text-black/45">{currentPageName}</h2>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto">

        {/* Notification button */}
        <button
          className="relative w-7 h-7 rounded-full flex items-center justify-center text-black/30 hover:text-black/60 transition-colors duration-150"
        >
          <Bell size={16} />
          <span
            className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"
            style={{ background: '#f43f5e' }}
          />
        </button>

        {/* User chip */}
        <div
          className="flex items-center gap-2 px-2.5 py-1 rounded-full cursor-pointer transition-all duration-150 hover:bg-black/05"
          style={{
            background: 'rgba(255,255,255,0.70)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          {/* Avatar */}
          <div
            className={`w-6 h-6 rounded-full bg-gradient-to-br ${config?.gradient ?? 'from-slate-400 to-slate-600'} flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0`}
          >
            {avatar}
          </div>

          {/* Name */}
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-black/65 leading-none">{displayName}</p>
            <p className="text-[10px] text-black/30 leading-none mt-0.5">{config?.label}</p>
          </div>

          <ChevronDown size={14} className="text-black/20 hidden sm:block ml-0.5" />
        </div>
      </div>
    </header>
  );
}
