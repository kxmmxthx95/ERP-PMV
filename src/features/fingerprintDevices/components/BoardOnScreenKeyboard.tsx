import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { DEVICE_SCREEN } from '../deviceScreenTheme';

type Props = {
  onKey: (key: string) => void;
  className?: string;
  style?: CSSProperties;
};

const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

export default function BoardOnScreenKeyboard({ onKey, className, style }: Props) {
  return (
    <div
      className={cn('absolute inset-x-0 bottom-0 z-10 flex flex-col border-t px-0.5 pb-0.5 pt-0.5', className)}
      style={{ backgroundColor: DEVICE_SCREEN.surface, borderColor: DEVICE_SCREEN.border, ...style }}
    >
      {ROWS.map((row, ri) => (
        <div key={ri} className="mb-0.5 flex justify-center gap-0.5">
          {row.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onKey(key)}
              className="flex h-4 min-w-[14px] flex-1 items-center justify-center rounded text-[7px] font-bold sm:h-[18px] sm:text-[8px]"
              style={{ backgroundColor: DEVICE_SCREEN.surface, color: DEVICE_SCREEN.text, border: `1px solid ${DEVICE_SCREEN.border}` }}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => onKey(' ')}
          className="h-4 flex-1 rounded text-[7px] font-bold sm:h-[18px] sm:text-[8px]"
          style={{ backgroundColor: DEVICE_SCREEN.surface, color: DEVICE_SCREEN.text, border: `1px solid ${DEVICE_SCREEN.border}` }}
        >
          space
        </button>
        <button
          type="button"
          onClick={() => onKey('⌫')}
          className="h-4 w-8 rounded text-[7px] font-bold sm:h-[18px] sm:w-10 sm:text-[8px]"
          style={{ backgroundColor: DEVICE_SCREEN.surface, color: DEVICE_SCREEN.text, border: `1px solid ${DEVICE_SCREEN.border}` }}
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={() => onKey('OK')}
          className="h-4 w-8 rounded text-[7px] font-bold sm:h-[18px] sm:w-10 sm:text-[8px]"
          style={{ backgroundColor: DEVICE_SCREEN.btn, color: DEVICE_SCREEN.btnText }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
