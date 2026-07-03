/** Distinct colors per exam part (badge, header strip, PDF tab). */
export const PART_BADGE_THEMES = [
  {
    badge: 'bg-blue-600',
    headerBorder: 'border-blue-200/80',
    headerBg: 'bg-blue-50/95',
    tabActive: 'border-blue-400 bg-blue-50 text-blue-800',
  },
  {
    badge: 'bg-violet-600',
    headerBorder: 'border-violet-200/80',
    headerBg: 'bg-violet-50/95',
    tabActive: 'border-violet-400 bg-violet-50 text-violet-800',
  },
  {
    badge: 'bg-emerald-600',
    headerBorder: 'border-emerald-200/80',
    headerBg: 'bg-emerald-50/95',
    tabActive: 'border-emerald-400 bg-emerald-50 text-emerald-800',
  },
  {
    badge: 'bg-amber-600',
    headerBorder: 'border-amber-200/80',
    headerBg: 'bg-amber-50/95',
    tabActive: 'border-amber-400 bg-amber-50 text-amber-900',
  },
  {
    badge: 'bg-rose-600',
    headerBorder: 'border-rose-200/80',
    headerBg: 'bg-rose-50/95',
    tabActive: 'border-rose-400 bg-rose-50 text-rose-800',
  },
  {
    badge: 'bg-cyan-600',
    headerBorder: 'border-cyan-200/80',
    headerBg: 'bg-cyan-50/95',
    tabActive: 'border-cyan-400 bg-cyan-50 text-cyan-900',
  },
] as const;

export function getPartBadgeTheme(partIndex: number) {
  return PART_BADGE_THEMES[((partIndex % PART_BADGE_THEMES.length) + PART_BADGE_THEMES.length) % PART_BADGE_THEMES.length];
}
