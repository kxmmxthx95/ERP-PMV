import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiBars3, HiCheck } from 'react-icons/hi2';
import { FileSpreadsheet, Plus, Search, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_LABELS } from '@/types/mockUsers';

const DEPARTMENTS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'preschool', label: 'ปฐมวัย' },
  { id: 'primary', label: 'ประถม' },
  { id: 'secondary', label: 'มัธยม' },
];

const ROLE_OPTIONS = [
  { id: 'all', label: 'ทั้งหมด' },
  ...Object.entries(ROLE_LABELS)
    .filter(([key]) => key !== 'sysadmin')
    .map(([id, style]) => ({ id, label: style.label })),
];

interface UserMobileHeaderControlsProps {
  filterRole: string;
  filterDepartment: string;
  onRoleChange: (role: string) => void;
  onDepartmentChange: (dept: string) => void;
  onAdd: () => void;
  onImport: () => void;
  onForceLogout: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isSearchMode: boolean;
  onSearchModeChange: (active: boolean) => void;
}

const iconButtonClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:scale-95';

export default function UserMobileHeaderControls({
  filterRole,
  filterDepartment,
  onRoleChange,
  onDepartmentChange,
  onAdd,
  onImport,
  onForceLogout,
  searchTerm,
  onSearchChange,
  isSearchMode,
  onSearchModeChange,
}: UserMobileHeaderControlsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileActionsEl, setMobileActionsEl] = useState<HTMLElement | null>(null);
  const [centerMobileEl, setCenterMobileEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
    setCenterMobileEl(document.getElementById('header-portal-center-mobile'));
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [menuOpen]);

  const isDeptView = filterRole === 'student' || filterRole === 'teacher';

  const handleRoleSelect = (role: string) => {
    onRoleChange(role);
    onDepartmentChange('all');
  };

  const handleDepartmentSelect = (dept: string) => {
    onDepartmentChange(dept);
  };

  const runAction = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  const searchPortal = isSearchMode && centerMobileEl && createPortal(
    <div className="pointer-events-auto flex w-full max-w-[min(280px,calc(100vw-7rem))] items-center gap-2 rounded-full border border-blue-100 bg-blue-50/90 px-3 py-1 shadow-sm lg:hidden">
      <Search size={14} className="shrink-0 text-slate-400" />
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="ค้นหาชื่อ, นามสกุล, อีเมล..."
        autoFocus
        className="min-w-0 flex-1 bg-transparent text-[11px] font-bold text-slate-800 placeholder:text-slate-400 outline-none font-sarabun"
      />
      <button
        type="button"
        onClick={() => {
          onSearchChange('');
          onSearchModeChange(false);
        }}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-black/5"
        title="ปิดการค้นหา"
      >
        <X size={14} />
      </button>
    </div>,
    centerMobileEl,
  );

  const headerPortal = !isSearchMode && mobileActionsEl && createPortal(
    <div className="relative flex shrink-0 items-center lg:hidden">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className={iconButtonClass}
        title="เมนู"
        aria-label="เมนู"
        aria-expanded={menuOpen}
      >
        <HiBars3 className="h-5 w-5" />
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90] bg-black/20"
            aria-label="ปิดเมนู"
            onClick={() => setMenuOpen(false)}
          />
          <div className="fixed right-4 top-14 z-[100] max-h-[min(70dvh,calc(100dvh-5rem))] w-[min(240px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
            <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 font-sukhumvit">
              ประเภทผู้ใช้
            </p>
            {ROLE_OPTIONS.map((role) => {
              const isActive = filterRole === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleRoleSelect(role.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit transition-colors',
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <span>{role.label}</span>
                  {isActive && <HiCheck className="h-4 w-4 shrink-0" aria-hidden />}
                </button>
              );
            })}

            {isDeptView && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 font-sukhumvit">
                  แผนก · {ROLE_LABELS[filterRole]?.label}
                </p>
                {DEPARTMENTS.map((dept) => {
                  const isActive = filterDepartment === dept.id;
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => handleDepartmentSelect(dept.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit transition-colors',
                        isActive ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      <span>{dept.label}</span>
                      {isActive && <HiCheck className="h-4 w-4 shrink-0" aria-hidden />}
                    </button>
                  );
                })}
              </>
            )}

            <div className="my-1 border-t border-slate-100" />
            <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 font-sukhumvit">
              การทำงาน
            </p>
            <button
              type="button"
              onClick={() => runAction(onAdd)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Plus size={16} className="shrink-0 text-slate-500" />
              เพิ่มผู้ใช้
            </button>
            <button
              type="button"
              onClick={() => runAction(onImport)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-slate-700 transition-colors hover:bg-slate-50"
            >
              <FileSpreadsheet size={16} className="shrink-0 text-slate-500" />
              นำเข้าข้อมูล
            </button>
            <button
              type="button"
              onClick={() => runAction(() => onSearchModeChange(true))}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Search size={16} className="shrink-0 text-slate-500" />
              ค้นหาผู้ใช้
            </button>
            <button
              type="button"
              onClick={() => runAction(onForceLogout)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold font-sukhumvit text-rose-600 transition-colors hover:bg-rose-50"
            >
              <Zap size={16} className="shrink-0" />
              บังคับออกจากระบบ
            </button>
          </div>
        </>
      )}
    </div>,
    mobileActionsEl,
  );

  return (
    <>
      {searchPortal}
      {headerPortal}
    </>
  );
}
