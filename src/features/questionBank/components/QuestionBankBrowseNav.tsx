import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { HiArrowRight } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { SubjectIcon } from '@/features/curriculum/utils/subjectVisual';
import { SubjectFolderCard } from '@/components/SubjectFolderCard';
import {
  loadFolderCardColors,
  saveFolderCardColors,
  type FolderCardColorId,
} from '@/lib/subjectFolderCardColors';
import {
  SUBJECT_GROUP_CONFIG,
  SUBJECT_SUBGROUP_CONFIG,
  type SubjectGroupId,
} from '@/types/curriculum';
import type { QuestionSet } from '@/types/questionBank';

export const UNSPECIFIED_SUB_SUBJECT = '__none__';

const QB_FOLDER_COLOR_KEY = 'pmv:question-bank-folder-colors:v1';

/** โฟลเดอร์วิชาย่อย — สีตามกลุ่มสาระ */
const SUBJECT_GROUP_FOLDER_COLOR: Record<SubjectGroupId, FolderCardColorId> = {
  thai: 'rose',
  math: 'blue',
  science: 'emerald',
  social: 'orange',
  pe: 'rose',
  arts: 'violet',
  careers: 'slate',
  foreign: 'sky',
  examM4: 'violet',
  onet: 'amber',
  alevel: 'emerald',
  other: 'slate',
};

function folderColorForSubjectGroup(subjectGroup: SubjectGroupId): FolderCardColorId {
  return SUBJECT_GROUP_FOLDER_COLOR[subjectGroup] ?? 'slate';
}

export type QuestionBankBrowseStep =
  | { level: 'groups' }
  | { level: 'subgroups'; subjectGroup: SubjectGroupId }
  | { level: 'sets'; subjectGroup: SubjectGroupId; subSubjectGroup?: string };

const DASHBOARD_KICKER_CLASS = 'text-[10px] font-black uppercase tracking-[0.18em] sm:text-[11px]';
const DASHBOARD_SECTION_TITLE_CLASS = 'mt-1 text-sm font-black text-slate-900 sm:text-lg';
const DASHBOARD_SECTION_META_CLASS = 'text-[11px] font-semibold text-slate-400 sm:text-xs';
const GROUP_GRID_CLASS = 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3';
const FOLDER_GRID_CLASS = 'grid w-full grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 xl:grid-cols-4';

export function groupHasSubSubjects(subjectGroup: SubjectGroupId): boolean {
  return (SUBJECT_SUBGROUP_CONFIG[subjectGroup]?.length ?? 0) > 0;
}

export function nextBrowseStepAfterGroup(subjectGroup: SubjectGroupId): QuestionBankBrowseStep {
  if (groupHasSubSubjects(subjectGroup)) {
    return { level: 'subgroups', subjectGroup };
  }
  return { level: 'sets', subjectGroup };
}

export function previousBrowseStep(step: QuestionBankBrowseStep): QuestionBankBrowseStep {
  if (step.level === 'sets' && groupHasSubSubjects(step.subjectGroup)) {
    return { level: 'subgroups', subjectGroup: step.subjectGroup };
  }
  return { level: 'groups' };
}

export function browseStepLabel(step: QuestionBankBrowseStep): string {
  if (step.level === 'groups') return 'คลังข้อสอบ';
  const groupName = SUBJECT_GROUP_CONFIG[step.subjectGroup]?.name ?? step.subjectGroup;
  if (step.level === 'subgroups') return groupName;
  if (step.subSubjectGroup === UNSPECIFIED_SUB_SUBJECT) return `${groupName} · ไม่ระบุวิชาย่อย`;
  if (step.subSubjectGroup) return `${groupName} · ${step.subSubjectGroup}`;
  return groupName;
}

function countGroupSets(sets: QuestionSet[], subjectGroup: SubjectGroupId): number {
  return sets.filter((set) => set.subjectGroup === subjectGroup).length;
}

function countSubSubjectSets(
  sets: QuestionSet[],
  subjectGroup: SubjectGroupId,
  subSubjectGroup: string,
): number {
  return sets.filter((set) => {
    if (set.subjectGroup !== subjectGroup) return false;
    if (subSubjectGroup === UNSPECIFIED_SUB_SUBJECT) return !set.subSubjectGroup?.trim();
    return set.subSubjectGroup === subSubjectGroup;
  }).length;
}

function SubjectCategoryHeroCard({
  title,
  count,
  accentColor,
  subjectGroupId,
  onClick,
  delay = 0,
}: {
  title: string;
  count: number;
  accentColor: string;
  subjectGroupId?: SubjectGroupId | string;
  onClick: () => void;
  delay?: number;
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 360, damping: 28 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="group relative flex min-h-[128px] w-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-sm transition hover:shadow-md active:scale-[0.99] sm:min-h-[148px] sm:p-6"
    >
      <p
        className="relative z-10 max-w-[72%] text-left text-[17px] font-black leading-snug text-slate-900 sm:text-[20px] lg:text-[22px] font-sukhumvit"
        title={title}
      >
        {title}
      </p>

      <div className="relative z-10 flex items-center gap-1.5 pt-5">
        <span
          className="text-[10px] font-black uppercase tracking-[0.16em] sm:text-[11px] font-sukhumvit"
          style={{ color: accentColor }}
        >
          {count.toLocaleString('th-TH')} ชุด
        </span>
        <HiArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          style={{ color: accentColor }}
        />
      </div>

      <div
        className="pointer-events-none absolute -bottom-3 -right-3 flex size-[5.5rem] items-center justify-center opacity-20 sm:size-24"
        style={{ color: accentColor }}
      >
        <SubjectIcon
          subjectGroup={typeof subjectGroupId === 'string' ? subjectGroupId : title}
          size={56}
          className="sm:!h-[4.5rem] sm:!w-[4.5rem]"
        />
      </div>
    </motion.button>
  );
}

function BrowseSectionHeader({
  kicker,
  kickerColor,
  title,
  meta,
}: {
  kicker: string;
  kickerColor: string;
  title: string;
  meta: string;
}) {
  return (
    <div className="mb-3 hidden sm:mb-4 lg:block">
      <p className={cn(DASHBOARD_KICKER_CLASS)} style={{ color: kickerColor }}>
        {kicker}
      </p>
      <h2 className={DASHBOARD_SECTION_TITLE_CLASS}>{title}</h2>
      <p className={DASHBOARD_SECTION_META_CLASS}>{meta}</p>
    </div>
  );
}

interface Props {
  step: Exclude<QuestionBankBrowseStep, { level: 'sets' }>;
  sets: QuestionSet[];
  onSelectGroup: (subjectGroup: SubjectGroupId) => void;
  onSelectSubGroup: (subSubjectGroup: string) => void;
}

export default function QuestionBankBrowseNav({
  step,
  sets,
  onSelectGroup,
  onSelectSubGroup,
}: Props) {
  const [folderColors, setFolderColors] = useState<Record<string, FolderCardColorId>>(() =>
    loadFolderCardColors(QB_FOLDER_COLOR_KEY),
  );

  const setFolderColor = useCallback((key: string, id: FolderCardColorId) => {
    setFolderColors((prev) => {
      const next = { ...prev, [key]: id };
      saveFolderCardColors(next, QB_FOLDER_COLOR_KEY);
      return next;
    });
  }, []);

  if (step.level === 'groups') {
    const groups = (Object.entries(SUBJECT_GROUP_CONFIG) as [SubjectGroupId, typeof SUBJECT_GROUP_CONFIG[SubjectGroupId]][])
      .sort(([, a], [, b]) => a.order - b.order);

    return (
      <section>
        <BrowseSectionHeader
          kicker="Question Bank"
          kickerColor="#6366f1"
          title="เลือกกลุ่มสาระ"
          meta="แตะการ์ดเพื่อดูชุดข้อสอบในกลุ่มนั้น"
        />
        <div className={GROUP_GRID_CLASS}>
          {groups.map(([id, cfg], index) => (
            <SubjectCategoryHeroCard
              key={id}
              title={cfg.name}
              count={countGroupSets(sets, id)}
              accentColor={cfg.color}
              subjectGroupId={id}
              onClick={() => onSelectGroup(id)}
              delay={index * 0.03}
            />
          ))}
        </div>
      </section>
    );
  }

  const groupCfg = SUBJECT_GROUP_CONFIG[step.subjectGroup];
  const configuredSubs = SUBJECT_SUBGROUP_CONFIG[step.subjectGroup] ?? [];
  const hasUnspecified = countSubSubjectSets(sets, step.subjectGroup, UNSPECIFIED_SUB_SUBJECT) > 0;
  const subCards = [
    ...configuredSubs.map((sub) => ({
      key: sub,
      title: sub,
      count: countSubSubjectSets(sets, step.subjectGroup, sub),
    })),
    ...(hasUnspecified
      ? [{
          key: UNSPECIFIED_SUB_SUBJECT,
          title: 'ไม่ระบุวิชาย่อย',
          count: countSubSubjectSets(sets, step.subjectGroup, UNSPECIFIED_SUB_SUBJECT),
        }]
      : []),
  ];

  return (
    <section>
      <div className={FOLDER_GRID_CLASS}>
        {subCards.map((card) => {
          const colorKey = `${step.subjectGroup}|${card.key}`;
          return (
            <SubjectFolderCard
              key={card.key}
              title={card.title}
              subtitle={groupCfg.name}
              meta={(
                <p className="pt-0.5 text-[11px] font-black text-muted-foreground">
                  {card.count.toLocaleString('th-TH')} ชุด
                </p>
              )}
              colorId={folderColors[colorKey] ?? folderColorForSubjectGroup(step.subjectGroup)}
              onColorChange={(id) => setFolderColor(colorKey, id)}
              onClick={() => onSelectSubGroup(card.key)}
              showPaper={card.count > 0}
            />
          );
        })}
      </div>
    </section>
  );
}
