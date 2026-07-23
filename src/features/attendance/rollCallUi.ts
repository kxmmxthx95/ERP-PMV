import type { RollCallStatus } from '@/types/morningRollCall';

export type MarkableRollCallStatus = Exclude<RollCallStatus, 'unmarked'>;

/** Shared status styles — MorningRollCallWidget + page drawer */
export const ROLL_CALL_OPTIONS: {
  value: MarkableRollCallStatus;
  label: string;
  className: string;
  activeClassName: string;
  cardClassName: string;
  badgeClassName: string;
}[] = [
  {
    value: 'present',
    label: 'มา',
    className: 'border-emerald-200 text-emerald-600 bg-white',
    activeClassName: 'border-emerald-500 bg-emerald-500 text-white',
    cardClassName: 'bg-emerald-50/90 border-emerald-200',
    badgeClassName: 'bg-emerald-100 text-emerald-700',
  },
  {
    value: 'late',
    label: 'สาย',
    className: 'border-amber-200 text-amber-700 bg-white',
    activeClassName: 'border-amber-500 bg-amber-500 text-white',
    cardClassName: 'bg-amber-50/90 border-amber-200',
    badgeClassName: 'bg-amber-100 text-amber-700',
  },
  {
    value: 'absent',
    label: 'ขาด',
    className: 'border-rose-200 text-rose-700 bg-white',
    activeClassName: 'border-rose-500 bg-rose-500 text-white',
    cardClassName: 'bg-rose-50/90 border-rose-200',
    badgeClassName: 'bg-rose-100 text-rose-700',
  },
  {
    value: 'leave',
    label: 'ลา',
    className: 'border-blue-200 text-blue-700 bg-white',
    activeClassName: 'border-blue-500 bg-blue-500 text-white',
    cardClassName: 'bg-blue-50/90 border-blue-200',
    badgeClassName: 'bg-blue-100 text-blue-700',
  },
];
