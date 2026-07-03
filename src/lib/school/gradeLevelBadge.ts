import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';

export type GradeBadgeStyle = {
  color: string;
  bg: string;
  border: string;
};

const GRADE_PALETTES: Record<Department, GradeBadgeStyle[]> = {
  early: [
    { color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' },
    { color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' },
    { color: '#c026d3', bg: '#fdf4ff', border: '#f5d0fe' },
  ],
  primary: [
    { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
    { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
    { color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
    { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
    { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
    { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  ],
  secondary: [
    { color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
    { color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
    { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
    { color: '#9333ea', bg: '#faf5ff', border: '#e9d5ff' },
    { color: '#a855f7', bg: '#faf5ff', border: '#e9d5ff' },
    { color: '#c026d3', bg: '#fdf4ff', border: '#f5d0fe' },
  ],
};

export function inferDepartmentFromGradeLevel(gradeLevel: string): Department {
  const trimmed = gradeLevel.trim();
  if (trimmed.startsWith('อ.')) return 'early';
  if (trimmed.startsWith('ป.')) return 'primary';
  return 'secondary';
}

export function getGradeLevelBadgeStyle(gradeLevel: string): GradeBadgeStyle {
  const trimmed = gradeLevel.trim();
  if (!trimmed) {
    return { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
  }

  const dept = inferDepartmentFromGradeLevel(trimmed);
  const grades = DEPARTMENT_CONFIG[dept].grades;
  const index = grades.indexOf(trimmed);
  const palette = GRADE_PALETTES[dept];

  if (index >= 0 && palette[index]) {
    return palette[index];
  }

  const fallback = DEPARTMENT_CONFIG[dept];
  return {
    color: fallback.color,
    bg: fallback.bg.replace(/[\d.]+\)$/, '0.12)'),
    border: fallback.border,
  };
}

export function formatClassRoomBadgeLabel(gradeLevel: string, roomNumber?: string): string {
  const grade = gradeLevel.trim();
  if (!grade) return '';
  if (roomNumber?.trim()) return `${grade}/${roomNumber.trim()}`;
  return grade;
}
