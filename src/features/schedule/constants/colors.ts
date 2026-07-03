export const SLOT_COLORS = [
  { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.30)', text: '#1d4ed8', accent: 'rgba(59,130,246,0.85)' },
  { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.30)', text: '#7c3aed', accent: 'rgba(168,85,247,0.85)' },
  { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.30)', text: '#047857', accent: 'rgba(16,185,129,0.85)' },
  { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.30)', text: '#c2410c', accent: 'rgba(249,115,22,0.85)' },
  { bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.30)', text: '#be185d', accent: 'rgba(236,72,153,0.85)' },
  { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.30)', text: '#a16207', accent: 'rgba(234,179,8,0.85)' },
  { bg: 'rgba(20,184,166,0.12)', border: 'rgba(20,184,166,0.30)', text: '#0f766e', accent: 'rgba(20,184,166,0.85)' },
];

/** สีตามกลุ่มสาระวิชา (อ้างอิงจาก SUBJECT_CONFIG ใน src/.docs/tasks/icon.md) */
export const SUBJECT_CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; accent: string; label: string }> = {
  math: {
    bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.30)', text: '#1d4ed8',
    accent: 'rgba(59,130,246,0.85)', label: 'คณิตศาสตร์',
  },
  science: {
    bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.30)', text: '#047857',
    accent: 'rgba(16,185,129,0.85)', label: 'วิทยาศาสตร์',
  },
  language: {
    bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.30)', text: '#0369a1',
    accent: 'rgba(14,165,233,0.85)', label: 'ภาษาต่างประเทศ',
  },
  thai: {
    bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.30)', text: '#be123c',
    accent: 'rgba(244,63,94,0.85)', label: 'ภาษาไทย',
  },
  social: {
    bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.30)', text: '#c2410c',
    accent: 'rgba(249,115,22,0.85)', label: 'สังคมศึกษา',
  },
  art: {
    bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.30)', text: '#7e22ce',
    accent: 'rgba(168,85,247,0.85)', label: 'ศิลปะ',
  },
  health: {
    bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.30)', text: '#b91c1c',
    accent: 'rgba(239,68,68,0.85)', label: 'สุขศึกษาและพลศึกษา',
  },
  work: {
    bg: 'rgba(120,113,108,0.12)', border: 'rgba(120,113,108,0.30)', text: '#44403c',
    accent: 'rgba(120,113,108,0.85)', label: 'การงานอาชีพ',
  },
  default: {
    bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.30)', text: '#374151',
    accent: 'rgba(107,114,128,0.85)', label: 'วิชาเพิ่มเติม',
  },
};

/** Map คำในชื่อวิชาไปยัง category key */
const CATEGORY_KEYWORDS: [string, string][] = [
  ['คณิต', 'math'],
  ['math', 'math'],
  ['วิทย์', 'science'],
  ['science', 'science'],
  ['ชีว', 'science'],
  ['เคมี', 'science'],
  ['ฟิสิกส์', 'science'],
  ['อังกฤษ', 'language'],
  ['english', 'language'],
  ['ภาษาไทย', 'thai'],
  ['ไทย', 'thai'],
  ['สังคม', 'social'],
  ['ประวัติ', 'social'],
  ['ภูมิ', 'social'],
  ['ศิลป', 'art'],
  ['ดนตรี', 'art'],
  ['นาฏ', 'art'],
  ['สุขศึกษา', 'health'],
  ['พลศึกษา', 'health'],
  ['พล', 'health'],
  ['การงาน', 'work'],
  ['คอมพิวเตอร์', 'work'],
  ['อาชีพ', 'work'],
  ['กิจกรรม', 'default'],
  ['ชุมนุม', 'default'],
  ['โฮมรูม', 'default'],
];

/** Map SubjectGroupId keys (curriculum) → SUBJECT_CATEGORY_COLORS keys */
const SUBJECT_GROUP_ALIASES: Record<string, string> = {
  pe: 'health',
  arts: 'art',
  careers: 'work',
  foreign: 'language',
  other: 'default',
  examM4: 'default',
  onet: 'default',
  alevel: 'science',
};

export function subjectColorByName(subjectName: string, subjectGroup?: string): { bg: string; border: string; text: string; accent: string } {
  // If group is provided and exists in our color map, use it first
  if (subjectGroup) {
    const resolved = SUBJECT_GROUP_ALIASES[subjectGroup] ?? subjectGroup;
    if (SUBJECT_CATEGORY_COLORS[resolved]) {
      return SUBJECT_CATEGORY_COLORS[resolved];
    }
  }

  const trimmed = (subjectName || '').trim();
  // Avoid hash-based slot colors for unresolved Firestore IDs shown before metadata loads
  if (/^[A-Za-z0-9_-]{16,}$/.test(trimmed) && !/[\u0E00-\u0E7F]/.test(trimmed)) {
    return SUBJECT_CATEGORY_COLORS.default;
  }

  const lower = trimmed.toLowerCase();
  for (const [kw, cat] of CATEGORY_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) return SUBJECT_CATEGORY_COLORS[cat];
  }
  return subjectColor(subjectName);
}

export function getSubjectCategory(subjectName: string, subjectGroup?: string): string {
  if (subjectGroup) {
    const resolved = SUBJECT_GROUP_ALIASES[subjectGroup] ?? subjectGroup;
    if (SUBJECT_CATEGORY_COLORS[resolved]) return resolved;
  }
  const lower = (subjectName || '').toLowerCase();
  for (const [kw, cat] of CATEGORY_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) return cat;
  }
  return 'other';
}

export function subjectColor(subjectId: string) {
  let hash = 0;
  for (const ch of subjectId) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return SLOT_COLORS[hash % SLOT_COLORS.length];
}

export function withAlpha(color: string, alpha: number): string {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/i);
  if (!m) return color;
  const [, r, g, b] = m;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function subjectGradient(
  color: { bg: string; border: string; text: string; accent: string },
  isCurrent = false,
): string {
  const strong = withAlpha(color.accent, isCurrent ? 0.94 : 0.9);
  const mid = withAlpha(color.accent, isCurrent ? 0.82 : 0.76);
  const soft = withAlpha(color.bg, isCurrent ? 0.88 : 0.82);
  const sheen = withAlpha(color.accent, isCurrent ? 0.38 : 0.28);
  return [
    `radial-gradient(120% 130% at 100% 100%, ${sheen} 0%, transparent 56%)`,
    'radial-gradient(140% 120% at 0% 0%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 52%)',
    `linear-gradient(160deg, ${strong} 0%, ${mid} 46%, ${soft} 100%)`,
  ].join(', ');
}

export function subjectCardShadow(
  color: { accent: string },
  isCurrent = false,
): string {
  return isCurrent
    ? `0 0 0 2px ${withAlpha(color.accent, 0.26)}, inset 0 1px 0 rgba(255,255,255,0.42), 0 12px 20px -18px ${withAlpha(color.accent, 0.68)}`
    : `inset 0 1px 0 rgba(255,255,255,0.34), 0 12px 20px -18px ${withAlpha(color.accent, 0.52)}`;
}
