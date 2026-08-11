import type { IconType } from 'react-icons';
import { HiChartBar, HiDocumentText, HiStar, HiSun } from 'react-icons/hi2';
import type { ExamRoom, ScoreCollectionType } from '@/types/exam';

export const SCORE_COLLECTION_CONFIG: Record<
  ScoreCollectionType,
  { label: string; desc: string; color: string; bg: string; border: string }
> = {
  classwork: {
    label: 'ประเมินผล',
    desc: 'ประเมินผลไม่นำมาคำนวนคะแนนเก็บ',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.08)',
    border: 'rgba(99,102,241,0.25)',
  },
  quiz: {
    label: 'สอบย่อย',
    desc: 'ทดสอบย่อยในชั้นเรียน',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.3)',
  },
  midterm: {
    label: 'กลางภาค',
    desc: 'สอบกลางภาคเรียน',
    color: '#0ea5e9',
    bg: 'rgba(14,165,233,0.08)',
    border: 'rgba(14,165,233,0.25)',
  },
  final: {
    label: 'ปลายภาค',
    desc: 'สอบปลายภาคเรียน',
    color: '#059669',
    bg: 'rgba(5,150,105,0.08)',
    border: 'rgba(5,150,105,0.25)',
  },
};

export const SCORE_COLLECTION_ICONS: Record<ScoreCollectionType, IconType> = {
  classwork: HiChartBar,
  quiz: HiDocumentText,
  midterm: HiStar,
  final: HiSun,
};

/** Short labels on type plate (card overlay) */
export const SCORE_COLLECTION_PLATE_LABELS: Record<ScoreCollectionType, string> = {
  classwork: 'ประเมิน',
  quiz: 'เก็บ',
  midterm: 'กลางภาค',
  final: 'ปลายภาค',
};

export const SCORE_COLLECTION_TYPES = Object.keys(SCORE_COLLECTION_CONFIG) as ScoreCollectionType[];

export type ScoreCollectionFilterKey = 'all' | ScoreCollectionType | 'unset';

export const SCORE_COLLECTION_FILTER_OPTIONS: ReadonlyArray<{
  key: ScoreCollectionFilterKey;
  label: string;
  color: string;
}> = [
  { key: 'all', label: 'ทุกประเภท', color: '#64748b' },
  ...SCORE_COLLECTION_TYPES.map((type) => ({
    key: type as ScoreCollectionFilterKey,
    label: SCORE_COLLECTION_CONFIG[type].label,
    color: SCORE_COLLECTION_CONFIG[type].color,
  })),
  { key: 'unset', label: 'ยังไม่ตั้ง', color: '#cbd5e1' },
];

export function resolveRoomScoreCollectionType(room: ExamRoom): ScoreCollectionType | null {
  const raw = room.settings?.scoreCollectionType ?? room.settings?.gradeBookScoreType;
  if (typeof raw === 'string' && raw in SCORE_COLLECTION_CONFIG) {
    return raw as ScoreCollectionType;
  }
  return null;
}

export function isRoomScoreCollectionUnset(room: ExamRoom): boolean {
  return resolveRoomScoreCollectionType(room) == null
    && room.settings?.scoreCollectionEnabled !== true;
}
