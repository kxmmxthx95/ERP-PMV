import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { functions as cloudFunctions } from '@/lib/firebase';

type LinkStatus = 'idle' | 'linking' | 'success' | 'error';

function getFriendlyError(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const maybe = error as { message?: unknown };
    if (typeof maybe.message === 'string' && maybe.message.trim()) {
      if (maybe.message.includes('deadline-exceeded')) {
        return 'ลิงก์หมดอายุแล้ว กรุณาพิมพ์ PMV ใหม่ใน LINE';
      }
      if (maybe.message.includes('not-found')) {
        return 'ไม่พบลิงก์ยืนยัน กรุณาพิมพ์ PMV ใหม่ใน LINE';
      }
      if (maybe.message.includes('failed-precondition')) {
        return 'ลิงก์นี้ถูกใช้งานแล้ว หรือไม่สามารถใช้งานได้';
      }
    }
  }
  return 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
}

export default function LineConnectPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();

  const [status, setStatus] = useState<LinkStatus>('idle');
  const [message, setMessage] = useState('กำลังตรวจสอบลิงก์...');
  const [lineUid, setLineUid] = useState<string>('');
  const calledRef = useRef(false);

  const linkToken = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return (query.get('token') || '').trim();
  }, [location.search]);

  useEffect(() => {
    if (!linkToken) {
      setStatus('error');
      setMessage('ไม่พบ token สำหรับเชื่อมบัญชี กรุณาพิมพ์ PMV ใหม่ใน LINE');
      return;
    }

    if (isLoading) return;

    if (!user) {
      const redirect = `${location.pathname}${location.search}`;
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      return;
    }

    if (calledRef.current) return;
    calledRef.current = true;

    const connect = async () => {
      setStatus('linking');
      setMessage('กำลังเชื่อมบัญชี LINE...');

      try {
        const callable = httpsCallable<{ token: string }, { success: boolean; lineUid: string }>(
          cloudFunctions,
          'completeLineLinkWithToken',
        );
        const result = await callable({ token: linkToken });

        setLineUid(result.data.lineUid || '');
        setStatus('success');
        setMessage('เชื่อมบัญชี LINE สำเร็จแล้ว');
      } catch (error) {
        setStatus('error');
        setMessage(getFriendlyError(error));
      }
    };

    void connect();
  }, [isLoading, linkToken, location.pathname, location.search, navigate, user]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">LINE Connect</p>
        <h1 className="text-xl font-black text-slate-800">ยืนยันการเชื่อมต่อ LINE</h1>

        {status === 'linking' || status === 'idle' ? (
          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 flex items-start gap-2 text-blue-700">
            <Loader2 size={16} className="mt-0.5 animate-spin" />
            <p className="text-sm font-bold">{message}</p>
          </div>
        ) : null}

        {status === 'success' ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-emerald-700 space-y-1">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5" />
              <p className="text-sm font-black">{message}</p>
            </div>
            {lineUid ? <p className="text-[12px] font-mono">LINE UID: {lineUid}</p> : null}
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-red-700 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5" />
            <p className="text-sm font-bold">{message}</p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => navigate('/portal/profile')}
          className="w-full rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-black hover:bg-slate-800"
        >
          กลับไปหน้าโปรไฟล์
        </button>
      </div>
    </div>
  );
}
