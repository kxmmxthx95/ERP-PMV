import { cn } from '@/lib/utils';
import { HiSignal, HiStop } from 'react-icons/hi2';
import type { SerialBridgeStatus } from '../types';

type Props = {
  status: SerialBridgeStatus;
  serialSupported: boolean;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  className?: string;
};

const STATUS_LABEL: Record<SerialBridgeStatus, string> = {
  disconnected: 'Mock',
  connecting: 'กำลังเชื่อม…',
  live: 'Live',
};

export default function SerialLiveControls({
  status,
  serialSupported,
  error,
  onConnect,
  onDisconnect,
  className,
}: Props) {
  const isLive = status === 'live';
  const isConnecting = status === 'connecting';

  return (
    <div className={cn('flex w-full max-w-[340px] flex-col gap-2', className)}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            isLive
              ? 'bg-emerald-100 text-emerald-800'
              : isConnecting
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-200 text-slate-600',
          )}
        >
          {STATUS_LABEL[status]}
        </span>

        {isLive ? (
          <button
            type="button"
            onClick={onDisconnect}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <HiStop className="h-3.5 w-3.5" />
            ตัดการเชื่อมต่อ
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={!serialSupported || isConnecting}
            className="inline-flex items-center gap-1 rounded-lg border border-sky-600 bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <HiSignal className="h-3.5 w-3.5" />
            เชื่อมบอร์ดจริง
          </button>
        )}
      </div>

      {!serialSupported && (
        <p className="text-[10px] leading-snug text-amber-700">
          Web Serial ใช้ได้บน Chrome/Edge เมื่อเปิด localhost — ต่อ USB กับ ESP32 แล้วกดเชื่อม
        </p>
      )}

      {error ? (
        <p className="text-[10px] leading-snug text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
