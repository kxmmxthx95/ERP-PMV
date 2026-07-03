import { useEffect, useRef, useState } from 'react';
import { HiCheck, HiChevronDown, HiUsers } from 'react-icons/hi2';
import { ROLE_LABELS } from '@/types/mockUsers';
import { cn } from '@/lib/utils';

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

interface UserRoleFilterButtonProps {
  filterRole: string;
  filterDepartment: string;
  onRoleChange: (role: string) => void;
  onDepartmentChange: (dept: string) => void;
}

export default function UserRoleFilterButton({
  filterRole,
  filterDepartment,
  onRoleChange,
  onDepartmentChange,
}: UserRoleFilterButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isDeptView = filterRole === 'student' || filterRole === 'teacher';
  const hasActiveFilter = filterRole !== 'all' || filterDepartment !== 'all';

  const currentLabel =
    filterRole === 'all'
      ? 'ทั้งหมด'
      : ROLE_LABELS[filterRole as keyof typeof ROLE_LABELS]?.label ?? filterRole;

  const deptSuffix =
    isDeptView && filterDepartment !== 'all'
      ? ` · ${DEPARTMENTS.find((dept) => dept.id === filterDepartment)?.label ?? ''}`
      : '';

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleRoleSelect = (role: string) => {
    onRoleChange(role);
    onDepartmentChange('all');
    if (role !== 'student' && role !== 'teacher') {
      setOpen(false);
    }
  };

  const handleDepartmentSelect = (dept: string) => {
    onDepartmentChange(dept);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex h-9 max-w-[148px] items-center gap-1 rounded-full px-2.5 text-[11px] font-black transition-all shrink-0',
          hasActiveFilter
            ? 'border border-slate-300 bg-white/40 text-slate-800 shadow-xs'
            : 'border border-transparent text-slate-600 hover:bg-white/40',
        )}
        title="กรองตามประเภทผู้ใช้"
        aria-label="กรองตามประเภทผู้ใช้"
        aria-expanded={open}
      >
        <HiUsers className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {currentLabel}
          {deptSuffix}
        </span>
        <HiChevronDown
          className={cn('h-3 w-3 shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[120] mt-2 w-[min(240px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="max-h-[min(70dvh,420px)] overflow-y-auto p-1.5">
            <p className="px-3 py-1.5 font-sukhumvit text-[10px] font-black uppercase tracking-widest text-slate-400">
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
                    'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left font-sukhumvit text-[13px] font-bold transition-colors',
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
                <p className="px-3 py-1.5 font-sukhumvit text-[10px] font-black uppercase tracking-widest text-slate-400">
                  แผนก · {ROLE_LABELS[filterRole as keyof typeof ROLE_LABELS]?.label}
                </p>
                {DEPARTMENTS.map((dept) => {
                  const isActive = filterDepartment === dept.id;
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => handleDepartmentSelect(dept.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left font-sukhumvit text-[13px] font-bold transition-colors',
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
          </div>
        </div>
      )}
    </div>
  );
}
