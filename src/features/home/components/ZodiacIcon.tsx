import type { ZodiacSignId } from '../services/horoscopeApi';
import { cn } from '@/lib/utils';

interface ZodiacIconProps {
  sign: ZodiacSignId;
  className?: string;
}

const STROKE = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Glyph({ sign }: { sign: ZodiacSignId }) {
  switch (sign) {
    case 'aries':
      return (
        <>
          <path d="M8.5 20c0-6.5 1.2-12.5 3.5-15 2.3 2.5 3.5 8.5 3.5 15" />
          <path d="M15.5 20c0-6.5-1.2-12.5-3.5-15" />
        </>
      );
    case 'taurus':
      return (
        <>
          <circle cx="12" cy="14.5" r="4.75" />
          <path d="M8.25 9.75c0-2.5 1.75-4.25 3.75-4.25s3.75 1.75 3.75 4.25" />
        </>
      );
    case 'gemini':
      return (
        <>
          <path d="M9 20V7.5c0-1.8 1.2-2.8 3-2.8s3 1 3 2.8V20" />
          <path d="M7.5 7.5h3M7.5 10.5h3" />
          <path d="M13.5 7.5h3M13.5 10.5h3" />
        </>
      );
    case 'cancer':
      return (
        <>
          <path d="M9.5 8.5a4 4 0 1 0 0 7" />
          <path d="M14.5 15.5a4 4 0 1 0 0-7" />
        </>
      );
    case 'leo':
      return (
        <>
          <circle cx="10.5" cy="12.5" r="4.5" />
          <path d="M14.5 9.5c2.5 0 4.5 2.2 4.5 5.2 0 3.8-2.8 6.8-6.5 6.8" />
        </>
      );
    case 'virgo':
      return (
        <>
          <path d="M7 20V8.5c0-1.5 1-2.5 2.5-2.5M11.5 20V6M16 20V8.5c0-1.5 1-2.5 2.5-2.5" />
          <path d="M11.5 6c0-1.8 1.2-2.8 2.5-2.8 1.3 0 2.5 1 2.5 2.8V20" />
          <path d="M9.5 14.5h4M14 17l2.5 3" />
        </>
      );
    case 'libra':
      return (
        <>
          <path d="M6 16h12" />
          <path d="M8.5 16V9.5c0-2.2 1.5-3.5 3.5-3.5s3.5 1.3 3.5 3.5V16" />
          <path d="M7 9.5h10" />
        </>
      );
    case 'scorpio':
      return (
        <>
          <path d="M7 20V8.5c0-1.5 1-2.5 2.5-2.5M11.5 20V6M16 20V8.5c0-1.5 1-2.5 2.5-2.5" />
          <path d="M11.5 6c0-1.8 1.2-2.8 2.5-2.8 1.3 0 2.5 1 2.5 2.8V14" />
          <path d="M16 14l3.5 3.5M16 14l3.5-3.5" />
        </>
      );
    case 'sagittarius':
      return (
        <>
          <path d="M6 18L18 6" />
          <path d="M11 6h7v7" />
          <path d="M6 13v5h5" />
        </>
      );
    case 'capricorn':
      return (
        <>
          <path d="M7 20V8.5c0-1.5 1-2.5 2.5-2.5M11.5 20V6" />
          <path d="M11.5 6c0-1.8 1.2-2.8 2.5-2.8 1.3 0 2.5 1 2.5 2.8v5.5c0 2.5-1.5 4.2-3.8 4.2" />
        </>
      );
    case 'aquarius':
      return (
        <>
          <path d="M5 9.5c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
          <path d="M5 14.5c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
        </>
      );
    case 'pisces':
      return (
        <>
          <path d="M6 12h12" />
          <path d="M9 8.5a3.5 3.5 0 1 0 0 7" />
          <path d="M15 15.5a3.5 3.5 0 1 0 0-7" />
        </>
      );
    default:
      return null;
  }
}

export function ZodiacIcon({ sign, className }: ZodiacIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('shrink-0', className)}
      aria-hidden
      {...STROKE}
    >
      <Glyph sign={sign} />
    </svg>
  );
}
