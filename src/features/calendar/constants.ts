import type { CalendarEventType } from '@/types/calendar';

export const DAY_NAMES = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;

export const ALL_TYPES: CalendarEventType[] = ['holiday', 'exam', 'activity', 'meeting', 'semester-start', 'semester-end'];

export const glassCard: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  border: '1px solid rgba(255, 255, 255, 0.9)',
  boxShadow: '0 15px 35px -5px rgba(0,0,0,0.06), 0 10px 15px -6px rgba(0,0,0,0.04)',
};

export const containerAnim = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
} as const;

export const cardAnim = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
} as const;
