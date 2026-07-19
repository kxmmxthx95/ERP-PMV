import { SUBJECT_GROUP_CONFIG, type SubjectGroupId } from '@/types/curriculum';
import { cn } from '@/lib/utils';

export type SubSubjectBadgeStyle = {
  color: string;
  bg: string;
  border: string;
};

export function getSubSubjectBadgeStyle(subjectGroupId?: SubjectGroupId | string): SubSubjectBadgeStyle {
  const groupCfg = subjectGroupId && SUBJECT_GROUP_CONFIG[subjectGroupId as SubjectGroupId];
  if (!groupCfg) {
    return {
      color: '#64748b',
      bg: '#f8fafc',
      border: 'rgba(100,116,139,0.25)',
    };
  }

  return {
    color: groupCfg.color,
    bg: '#ffffff',
    border: groupCfg.border,
  };
}

export function SubSubjectGroupBadge({
  label,
  subjectGroupId,
  className,
  maxWidth = '180px',
}: {
  label: string;
  subjectGroupId?: SubjectGroupId | string;
  className?: string;
  maxWidth?: string | number;
}) {
  const style = getSubSubjectBadgeStyle(subjectGroupId);

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold font-sarabun leading-none truncate shrink-0',
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
