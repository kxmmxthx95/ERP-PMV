import { useState } from 'react';
import { HiAcademicCap, HiBriefcase, HiSparkles, HiUser, HiUserGroup } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import type { DeviceLiveUser, UserListCategory } from '../types';
import {
  USER_LIST_CATEGORIES,
  filterUsersByCategory,
} from '../utils/userListCategory';

type Props = {
  users: DeviceLiveUser[];
  isLoading?: boolean;
  statusLabel?: string;
  isLive?: boolean;
  selectedCategory?: UserListCategory | null;
  onCategoryChange?: (category: UserListCategory) => void;
};

const CATEGORY_ICONS: Record<UserListCategory, typeof HiUser> = {
  student: HiAcademicCap,
  teacher: HiUser,
  special_teacher: HiSparkles,
  staff: HiBriefcase,
};

export default function RegisteredUsersPanel({
  users,
  isLoading = false,
  statusLabel,
  isLive = false,
  selectedCategory: selectedCategoryProp,
  onCategoryChange,
}: Props) {
  const [localCategory, setLocalCategory] = useState<UserListCategory | null>(null);
  const selectedCategory = selectedCategoryProp ?? localCategory;
  const setCategory = onCategoryChange ?? setLocalCategory;

  const filtered = isLive ? users : filterUsersByCategory(users, selectedCategory);
  const categoryLabel = USER_LIST_CATEGORIES.find((c) => c.id === selectedCategory)?.label;

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <HiUserGroup className="h-5 w-5 text-sky-600" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
          รายชื่อผู้ใช้งาน
        </h3>
      </div>

      {isLive ? (
        <p className="mb-3 text-[11px] leading-relaxed text-emerald-700">
          รายชื่อ sync จากบอร์ดจริง — เลือกหมวดบนจอเครื่องหรือด้านล่าง
        </p>
      ) : (
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
          ผู้ใช้ที่ผูก Template ID แล้ว — เลือกหมวดเพื่อดูรายชื่อ
        </p>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {USER_LIST_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id];
          const active = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center transition',
                active
                  ? 'border-sky-600 bg-sky-50 text-sky-800'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-sky-200',
              )}
            >
              <Icon className={cn('h-5 w-5', active ? 'text-sky-600' : 'text-slate-400')} />
              <span className="text-[10px] font-bold leading-tight">{cat.label}</span>
            </button>
          );
        })}
      </div>

      {statusLabel ? (
        <p className="mb-2 text-xs font-semibold text-slate-600">{statusLabel}</p>
      ) : selectedCategory && !isLoading ? (
        <p className="mb-2 text-xs font-semibold text-slate-600">
          {categoryLabel}: {filtered.length} คน
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-xs text-slate-500">กำลังโหลด...</p>
      ) : !selectedCategory && !isLive ? (
        <p className="text-xs text-slate-500">เลือกประเภทด้านบนเพื่อดูรายชื่อ</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-slate-500">ไม่มีรายชื่อในหมวดนี้</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.map((user) => (
            <li
              key={user.templateId}
              className={cn(
                'flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-xs',
              )}
            >
              <span className="shrink-0 font-mono text-[11px] font-bold text-sky-700">
                #{String(user.templateId).padStart(3, '0')}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{user.name}</span>
              {user.code ? (
                <span className="shrink-0 text-[10px] text-slate-400">{user.code}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
