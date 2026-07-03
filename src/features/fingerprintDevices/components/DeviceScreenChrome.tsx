import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DEVICE_SCREEN } from '../deviceScreenTheme';
import { FW, fwRect } from '../deviceScreenLayout';

type IconButtonProps = {
  x: number;
  y: number;
  onClick?: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
};

export function DeviceIconButton({
  x,
  y,
  onClick,
  title,
  children,
  className,
  disabled,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        'absolute z-10 flex items-center justify-center text-white transition hover:opacity-90 disabled:opacity-50',
        className,
      )}
      style={{
        ...fwRect(x, y, FW.headerBtn, FW.headerBtn),
        borderRadius: 8,
        backgroundColor: DEVICE_SCREEN.btn,
      }}
    >
      {children}
    </button>
  );
}

type TitleProps = {
  y: number;
  children: ReactNode;
  muted?: boolean;
  className?: string;
};

export function DeviceScreenTitle({ y, children, muted, className }: TitleProps) {
  return (
    <p
      className={cn(
        'pointer-events-none absolute inset-x-0 z-[1] text-center text-[13px] font-bold leading-none',
        className,
      )}
      style={{
        top: `${(y / FW.H) * 100}%`,
        color: muted ? DEVICE_SCREEN.muted : DEVICE_SCREEN.title,
      }}
    >
      {children}
    </p>
  );
}
