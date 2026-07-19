import type { UserData } from '@/types/user';
import { ROLE_LABELS } from '@/types/mockUsers';
import { getGradeLevelBadgeStyle } from '@/lib/school/gradeLevelBadge';

export interface UserDashboardSummary {
  total: number;
  active: number;
  inactive: number;
  lineLinked: number;
  mustChangePassword: number;
  recentSignups: number;
}

export interface RoleStatEntry {
  role: string;
  label: string;
  count: number;
  color: string;
  bg: string;
}

export interface DepartmentStatEntry {
  id: string;
  label: string;
  count: number;
  color: string;
}

const DEPARTMENT_CONFIG: Record<string, { label: string; color: string }> = {
  preschool: { label: 'ปฐมวัย', color: '#ec4899' },
  early: { label: 'ปฐมวัย', color: '#ec4899' },
  'early-childhood': { label: 'ปฐมวัย', color: '#ec4899' },
  primary: { label: 'ประถมศึกษา', color: '#3b82f6' },
  secondary: { label: 'มัธยมศึกษา', color: '#8b5cf6' },
};

const RECENT_DAYS = 30;

function parseCreatedAt(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const d = (value as { toDate: () => Date }).toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const seconds = (value as { seconds: number }).seconds;
    return new Date(seconds * 1000);
  }
  return null;
}

export function normalizeDepartmentId(dept?: string): string | null {
  if (!dept?.trim()) return null;
  const v = dept.trim().toLowerCase();
  if (v === 'preschool' || v === 'early' || v === 'early-childhood' || v.includes('ปฐม')) return 'preschool';
  if (v === 'primary' || v.includes('ประถม')) return 'primary';
  if (v === 'secondary' || v.includes('มัธยม')) return 'secondary';
  return dept;
}

export function computeUserDashboardSummary(users: UserData[]): UserDashboardSummary {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_DAYS);

  let active = 0;
  let inactive = 0;
  let lineLinked = 0;
  let mustChangePassword = 0;
  let recentSignups = 0;

  for (const user of users) {
    if (user.status === 'active') active += 1;
    else inactive += 1;

    if (user.lineUid?.trim()) lineLinked += 1;
    if ((user as { mustChangePassword?: boolean }).mustChangePassword) mustChangePassword += 1;

    const created = parseCreatedAt(user.createdAt);
    if (created && created >= cutoff) recentSignups += 1;
  }

  return {
    total: users.length,
    active,
    inactive,
    lineLinked,
    mustChangePassword,
    recentSignups,
  };
}

export function computeRoleStats(users: UserData[]): RoleStatEntry[] {
  const counts = new Map<string, number>();
  for (const user of users) {
    const role = user.role || 'unknown';
    counts.set(role, (counts.get(role) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([role, count]) => {
      const style = ROLE_LABELS[role] || { label: role, color: '#64748b', bg: '#f1f5f9' };
      return {
        role,
        label: style.label,
        count,
        color: style.color,
        bg: style.bg,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function computeDepartmentStats(users: UserData[]): DepartmentStatEntry[] {
  const counts = new Map<string, number>();

  for (const user of users) {
    const normalized = normalizeDepartmentId(user.department);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  const order = ['preschool', 'primary', 'secondary'];
  return order
    .filter((id) => (counts.get(id) || 0) > 0)
    .map((id) => ({
      id,
      label: DEPARTMENT_CONFIG[id]?.label || id,
      count: counts.get(id) || 0,
      color: DEPARTMENT_CONFIG[id]?.color || '#94a3b8',
    }));
}

export function computeRecentSignupUsers(users: UserData[], limit = 8): UserData[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_DAYS);

  return users
    .map((user) => ({ user, created: parseCreatedAt(user.createdAt) }))
    .filter((entry): entry is { user: UserData; created: Date } => !!entry.created && entry.created >= cutoff)
    .sort((a, b) => b.created.getTime() - a.created.getTime())
    .slice(0, limit)
    .map((entry) => entry.user);
}

export function formatSignupDate(value: unknown): string {
  const date = parseCreatedAt(value);
  if (!date) return '—';
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

export type GradeLevelRef = {
  id: string;
  label: string;
  shortLabel: string;
  section: string;
};

export interface GradeLevelUserGroup {
  gradeLevel: string;
  color: string;
  bg: string;
  border: string;
  users: UserData[];
  count: number;
}

const DEPARTMENT_SECTION: Record<string, string> = {
  preschool: 'early-childhood',
  primary: 'primary',
  secondary: 'secondary',
};

const UNASSIGNED_GRADE = 'ไม่ระบุระดับชั้น';

export function getDepartmentLabel(departmentId: string): string {
  return DEPARTMENT_CONFIG[departmentId]?.label || departmentId;
}

export function getDepartmentColor(departmentId: string): string {
  return DEPARTMENT_CONFIG[departmentId]?.color || '#94a3b8';
}

export function resolveUserGradeLevelLabel(
  user: UserData,
  gradeLevels: GradeLevelRef[],
): string {
  const raw = String((user as { gradeLevel?: string }).gradeLevel ?? '').trim();
  if (!raw) return UNASSIGNED_GRADE;

  const byId = gradeLevels.find((grade) => grade.id === raw);
  if (byId) return byId.shortLabel;

  const byShort = gradeLevels.find((grade) => grade.shortLabel === raw);
  if (byShort) return byShort.shortLabel;

  const byLabel = gradeLevels.find((grade) => grade.label === raw);
  if (byLabel) return byLabel.shortLabel;

  if (/^(อ\.|ป\.|ม\.|เตรียม)/.test(raw)) return raw;

  return raw;
}

function sortGradeGroups(
  entries: [string, UserData[]][],
  departmentId: string,
  gradeLevels: GradeLevelRef[],
): [string, UserData[]][] {
  const section = DEPARTMENT_SECTION[departmentId];
  const orderedGrades = section
    ? gradeLevels.filter((grade) => grade.section === section).map((grade) => grade.shortLabel)
    : [];

  return [...entries].sort((a, b) => {
    if (a[0] === UNASSIGNED_GRADE) return 1;
    if (b[0] === UNASSIGNED_GRADE) return -1;

    const indexA = orderedGrades.indexOf(a[0]);
    const indexB = orderedGrades.indexOf(b[0]);
    if (indexA === -1 && indexB === -1) return a[0].localeCompare(b[0], 'th');
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
}

export function computeDepartmentUsersByGradeLevel(
  users: UserData[],
  departmentId: string,
  gradeLevels: GradeLevelRef[],
): GradeLevelUserGroup[] {
  const deptUsers = users.filter((user) => normalizeDepartmentId(user.department) === departmentId);
  const groups = new Map<string, UserData[]>();

  for (const user of deptUsers) {
    const label = resolveUserGradeLevelLabel(user, gradeLevels);
    const list = groups.get(label) ?? [];
    list.push(user);
    groups.set(label, list);
  }

  return sortGradeGroups([...groups.entries()], departmentId, gradeLevels).map(([gradeLevel, groupUsers]) => {
    const badge = getGradeLevelBadgeStyle(gradeLevel === UNASSIGNED_GRADE ? '' : gradeLevel);
    const sortedUsers = [...groupUsers].sort((a, b) => {
      const nameA = `${a.prefix || ''}${a.firstName || ''} ${a.lastName || ''}`.trim();
      const nameB = `${b.prefix || ''}${b.firstName || ''} ${b.lastName || ''}`.trim();
      return nameA.localeCompare(nameB, 'th');
    });

    return {
      gradeLevel,
      ...badge,
      users: sortedUsers,
      count: sortedUsers.length,
    };
  });
}
