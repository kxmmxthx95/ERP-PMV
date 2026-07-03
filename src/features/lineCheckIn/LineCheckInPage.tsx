import { useCallback, useEffect, useMemo, useState } from 'react';
import liff from '@line/liff';
import {
  HiArrowPath,
  HiArrowRightOnRectangle,
  HiCalendarDays,
  HiCheckCircle,
  HiClock,
  HiExclamationTriangle,
  HiMapPin,
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import {
  callLineStaffAttendance,
  type LineStaffStatusResponse,
} from './lineCheckInApi';

const LIFF_ID = (import.meta.env.VITE_LIFF_CHECKIN_ID || '').trim();
const LINE_ADD_FRIEND_URL =
  (import.meta.env.VITE_LINE_ADD_FRIEND_URL || 'https://lin.ee/QKGIt0J').trim();

const STATUS_LABEL: Record<string, string> = {
  present: 'มาทำงาน',
  late: 'มาสาย',
  absent: 'ขาด',
};

function formatThaiDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: string }).message);
    if (msg.includes('failed-precondition')) {
      return msg.replace(/^FirebaseError:\s*/i, '').replace(/^\w+\//, '');
    }
    return msg.replace(/^FirebaseError:\s*/i, '');
  }
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}

export default function LineCheckInPage() {
  const [booting, setBooting] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [lineDisplayName, setLineDisplayName] = useState('');
  const [status, setStatus] = useState<LineStaffStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<'checkIn' | 'checkOut' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inLineApp, setInLineApp] = useState(false);

  const refreshStatus = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await callLineStaffAttendance(token, 'status');
      setStatus(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!LIFF_ID) {
        setError('ยังไม่ได้ตั้งค่า LIFF ID (VITE_LIFF_CHECKIN_ID)');
        setBooting(false);
        return;
      }

      try {
        await liff.init({ liffId: LIFF_ID });
        if (cancelled) return;

        setInLineApp(liff.isInClient());

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const token = liff.getAccessToken();
        if (!token) {
          setError('ไม่พบ LINE access token — กรุณาเปิดจากแอป LINE');
          setBooting(false);
          return;
        }

        const profile = await liff.getProfile();
        setLineDisplayName(profile.displayName);
        setAccessToken(token);
        await refreshStatus(token);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [refreshStatus]);

  const linkedStatus = useMemo(() => {
    if (!status || !status.linked) return null;
    return status;
  }, [status]);

  const handleAction = async (action: 'checkIn' | 'checkOut') => {
    if (!accessToken) return;
    setActionLoading(action);
    setError(null);
    try {
      const data = await callLineStaffAttendance(accessToken, action);
      setStatus(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  if (booting) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <p className="text-sm text-white/80">กำลังเชื่อมต่อ LINE…</p>
        </div>
      </Shell>
    );
  }

  if (!LIFF_ID) {
    return (
      <Shell>
        <AlertCard
          title="ยังไม่พร้อมใช้งาน"
          message="ตั้งค่า VITE_LIFF_CHECKIN_ID ใน LINE Developers Console แล้ว deploy ใหม่"
        />
      </Shell>
    );
  }

  if (!inLineApp) {
    return (
      <Shell>
        <AlertCard
          title="เปิดจาก LINE"
          message="Mini App นี้ต้องเปิดผ่านแอป LINE (ลิงก์ LIFF หรือจากแชท OA)"
        />
        <a
          href={LINE_ADD_FRIEND_URL}
          className="mt-4 block rounded-2xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white backdrop-blur"
        >
          เพิ่มเพื่อน OA PMV-ONE
        </a>
      </Shell>
    );
  }

  if (status && !status.linked) {
    return (
      <Shell>
        <div className="rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-200">ยังไม่เชื่อมบัญชี</p>
          <h1 className="mt-2 text-xl font-black text-white">
            {status.lineDisplayName || lineDisplayName || 'LINE User'}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/85">{status.message}</p>
          <ol className="mt-4 space-y-2 text-sm text-white/80">
            <li>1. เข้าสู่ระบบ PMV-ONE ที่เว็บ</li>
            <li>2. ไปที่โปรไฟล์ → เชื่อม LINE</li>
            <li>3. พิมพ์ <strong className="text-white">PMV</strong> ในแชท LINE OA</li>
          </ol>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-200/90">PMV Staff</p>
        <h1 className="mt-1 text-2xl font-black text-white">ลงเวลาวันนี้</h1>
        {linkedStatus && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/75">
            <HiCalendarDays className="h-4 w-4" />
            {formatThaiDate(linkedStatus.date)}
          </p>
        )}
      </header>

      {linkedStatus && (
        <section className="mb-4 rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl">
          <p className="text-sm text-white/70">{linkedStatus.displayName}</p>

          {linkedStatus.isHoliday ? (
            <div className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-400/15 px-4 py-3">
              <p className="text-sm font-bold text-amber-100">วันหยุด</p>
              <p className="text-lg font-black text-white">{linkedStatus.holidayTitle ?? 'วันหยุด'}</p>
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <TimeBlock label="เช็คอิน" value={linkedStatus.record?.checkInTime ?? '--:--'} />
                <TimeBlock label="เช็คเอาต์" value={linkedStatus.record?.checkOutTime ?? '--:--'} />
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                <span className="text-sm text-white/70">สถานะ</span>
                <span className="text-base font-black text-white">
                  {linkedStatus.record
                    ? STATUS_LABEL[linkedStatus.record.status] ?? linkedStatus.record.status
                    : 'ยังไม่ลงเวลา'}
                </span>
              </div>
            </>
          )}
        </section>
      )}

      {error && (
        <div className="mb-4 flex gap-2 rounded-2xl border border-rose-300/30 bg-rose-500/20 px-4 py-3 text-sm text-rose-50">
          <HiExclamationTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <ActionButton
          icon={HiMapPin}
          label="เช็คอิน"
          loading={actionLoading === 'checkIn'}
          disabled={
            loading ||
            actionLoading !== null ||
            !linkedStatus?.canCheckIn
          }
          onClick={() => void handleAction('checkIn')}
          variant="primary"
        />
        <ActionButton
          icon={HiArrowRightOnRectangle}
          label="เช็คเอาต์"
          loading={actionLoading === 'checkOut'}
          disabled={
            loading ||
            actionLoading !== null ||
            !linkedStatus?.canCheckOut
          }
          onClick={() => void handleAction('checkOut')}
          variant="secondary"
        />
      </div>

      <button
        type="button"
        onClick={() => accessToken && void refreshStatus(accessToken)}
        disabled={loading || actionLoading !== null || !accessToken}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 py-3 text-sm font-semibold text-white/90 disabled:opacity-50"
      >
        <HiArrowPath className={cn('h-4 w-4', loading && 'animate-spin')} />
        รีเฟรชสถานะ
      </button>

      {linkedStatus?.record?.checkInTime && linkedStatus.record.checkOutTime && (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-emerald-200">
          <HiCheckCircle className="h-4 w-4" />
          ลงเวลาครบแล้ววันนี้
        </p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-dvh min-h-[-webkit-fill-available] px-safe pt-safe pb-safe text-white"
      style={{
        background: 'linear-gradient(160deg, #0f766e 0%, #115e59 45%, #134e4a 100%)',
      }}
    >
      <div className="mx-auto max-w-md px-4 py-6">{children}</div>
    </div>
  );
}

function TimeBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/20 px-3 py-3">
      <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-white/60">
        <HiClock className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-xl font-black tabular-nums">{value}</p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  loading,
  variant,
}: {
  icon: typeof HiMapPin;
  label: string;
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  variant: 'primary' | 'secondary';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-3xl border px-3 py-4 text-sm font-bold transition active:scale-[0.98] disabled:opacity-45',
        variant === 'primary'
          ? 'border-emerald-200/40 bg-emerald-400/25 text-white shadow-lg shadow-emerald-950/20'
          : 'border-white/25 bg-white/10 text-white',
      )}
    >
      {loading ? (
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      ) : (
        <Icon className="h-7 w-7" />
      )}
      {label}
    </button>
  );
}

function AlertCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl">
      <p className="text-lg font-black text-white">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-white/80">{message}</p>
    </div>
  );
}
