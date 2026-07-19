import { useEffect, useMemo, useState } from 'react';
import { HiChevronDown, HiOutlineUsers, HiXMark } from 'react-icons/hi2';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ROLE_LABELS } from '@/types/mockUsers';
import type { UserData } from '@/types/user';
import { cn } from '@/lib/utils';
import {
  computeDepartmentUsersByGradeLevel,
  getDepartmentColor,
  getDepartmentLabel,
  type GradeLevelRef,
  type GradeLevelUserGroup,
} from '@/features/users/utils/userDashboardStats';

const DRAWER_CONTENT_CLASS = cn(
  'h-dvh flex flex-col p-0 rounded-none bg-white/95 backdrop-blur-xl',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:h-full sm:rounded-l-3xl',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-lg',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
);

type Props = {
  open: boolean;
  onClose: () => void;
  departmentId: string | null;
  users: UserData[];
  gradeLevels: GradeLevelRef[];
};

function formatUserName(user: UserData): string {
  const name = `${user.prefix || ''}${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || user.email || 'ไม่ทราบชื่อ';
}

function GradeSection({
  group,
  defaultOpen,
}: {
  group: GradeLevelUserGroup;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [group.gradeLevel, defaultOpen]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white/80 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/80"
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border text-sm font-black"
          style={{
            color: group.color,
            borderColor: group.border,
            backgroundColor: group.bg,
          }}
        >
          {group.gradeLevel === 'ไม่ระบุระดับชั้น' ? '?' : group.gradeLevel}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-slate-900">{group.gradeLevel}</span>
          <span className="text-[11px] font-semibold text-slate-400">
            {group.count.toLocaleString()} คน
          </span>
        </span>
        <HiChevronDown
          className={cn(
            'size-4 shrink-0 text-slate-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-3 py-2">
          <ul className="divide-y divide-slate-100">
            {group.users.map((user) => {
              const roleStyle = ROLE_LABELS[user.role] || {
                label: user.role,
                color: '#64748b',
                bg: '#f1f5f9',
              };

              return (
                <li key={user.id} className="flex items-center gap-3 py-2.5">
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-black"
                    style={{ background: roleStyle.bg, color: roleStyle.color }}
                  >
                    {(user.firstName || user.email || '?').charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{formatUserName(user)}</p>
                    <p className="truncate text-[11px] text-slate-400">{user.email}</p>
                  </div>
                  <span
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                    style={{ background: roleStyle.bg, color: roleStyle.color }}
                  >
                    {roleStyle.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function UsersDepartmentDrawer({
  open,
  onClose,
  departmentId,
  users,
  gradeLevels,
}: Props) {
  const groups = useMemo(() => {
    if (!departmentId) return [];
    return computeDepartmentUsersByGradeLevel(users, departmentId, gradeLevels);
  }, [users, departmentId, gradeLevels]);

  const totalUsers = useMemo(
    () => groups.reduce((sum, group) => sum + group.count, 0),
    [groups],
  );

  const departmentLabel = departmentId ? getDepartmentLabel(departmentId) : '';
  const departmentColor = departmentId ? getDepartmentColor(departmentId) : '#94a3b8';

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} direction="right">
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <div className="flex h-full min-h-0 flex-col">
          <DrawerHeader className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-2xl text-white"
                  style={{ backgroundColor: departmentColor }}
                >
                  <HiOutlineUsers size={18} />
                </div>
                <div className="min-w-0 text-left">
                  <DrawerTitle className="truncate text-base font-black text-slate-900">
                    {departmentLabel || 'แผนก'}
                  </DrawerTitle>
                  <DrawerDescription className="text-xs font-semibold text-slate-500">
                    รายชื่อผู้ใช้งานตามระดับชั้น · {totalUsers.toLocaleString()} คน
                  </DrawerDescription>
                </div>
              </div>
              <DrawerClose asChild>
                <button
                  type="button"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50"
                  aria-label="ปิด"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {groups.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-400">
                ยังไม่มีผู้ใช้งานในแผนกนี้
              </p>
            ) : (
              <div className="space-y-3">
                {groups.map((group, index) => (
                  <GradeSection key={group.gradeLevel} group={group} defaultOpen={index === 0} />
                ))}
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
