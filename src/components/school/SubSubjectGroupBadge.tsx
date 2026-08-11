import {
  DEPARTMENT_CONFIG,
  SUBJECT_GROUP_CONFIG,
  type Department,
  type SubjectGroupId,
} from '@/types/curriculum';
import { getGradeLevelBadgeStyle } from '@/lib/school/gradeLevelBadge';
import { cn } from '@/lib/utils';

export type SubSubjectBadgeStyle = {
  color: string;
  bg: string;
  border: string;
};

const DEFAULT_BADGE_STYLE: SubSubjectBadgeStyle = {
  color: '#64748b',
  bg: '#f8fafc',
  border: 'rgba(100,116,139,0.25)',
};

export function getSubSubjectBadgeStyle(options?: {
  subjectGroupId?: SubjectGroupId | string;
  department?: Department;
  gradeLevel?: string;
}): SubSubjectBadgeStyle {
  const { subjectGroupId, department, gradeLevel } = options ?? {};

  const groupCfg = subjectGroupId && SUBJECT_GROUP_CONFIG[subjectGroupId as SubjectGroupId];
  if (groupCfg) {
    return {
      color: groupCfg.color,
      bg: groupCfg.bg,
      border: groupCfg.border,
    };
  }

  if (department && DEPARTMENT_CONFIG[department]) {
    const deptCfg = DEPARTMENT_CONFIG[department];
    return {
      color: deptCfg.color,
      bg: deptCfg.bg,
      border: deptCfg.border,
    };
  }

  if (gradeLevel?.trim()) {
    return getGradeLevelBadgeStyle(gradeLevel);
  }

  return DEFAULT_BADGE_STYLE;
}

export function SubSubjectGroupBadge({
  label,
  subjectGroupId,
  department,
  gradeLevel,
  className,
  maxWidth = '180px',
}: {
  label: string;
  subjectGroupId?: SubjectGroupId | string;
  department?: Department;
  gradeLevel?: string;
  className?: string;
  maxWidth?: string | number;
}) {
  const style = getSubSubjectBadgeStyle({ subjectGroupId, department, gradeLevel });

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold font-sukhumvit leading-none truncate shrink-0',
        className,
      )}
      style={{
        color: style.color,
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        maxWidth,
      }}
      title={label}
    >
      {label}
    </span>
  );
}
