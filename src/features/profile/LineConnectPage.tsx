import { useEffect, useMemo, useRef, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { useLocation, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { doc, getDocFromServer } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { auth, db, functions as cloudFunctions } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';

type LinkStatus = 'idle' | 'linking' | 'success' | 'error';
const LINE_CONNECT_TOKEN_KEY = 'line_connect_token';

function getErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code?: unknown }).code ?? '').trim();
    return code;
  }
  return '';
}

function shouldClearStoredToken(error: unknown): boolean {
  const code = getErrorCode(error);
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';

  return (
    code.includes('invalid-argument') ||
    code.includes('not-found') ||
    code.includes('failed-precondition') ||
    code.includes('deadline-exceeded') ||
    message.includes('invalid-argument') ||
    message.includes('not-found') ||
    message.includes('failed-precondition') ||
    message.includes('deadline-exceeded')
  );
}

function getFriendlyError(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code.includes('unauthenticated')) {
      return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง';
    }
    if (error.code.includes('permission-denied')) {
      return 'บัญชีนี้ไม่มีสิทธิ์เชื่อมต่อ LINE';
    }
    if (error.code.includes('unavailable')) {
      return 'ระบบเชื่อมต่อขัดข้องชั่วคราว กรุณาลองใหม่';
    }
    if (error.code.includes('deadline-exceeded')) {
      return 'ลิงก์หมดอายุแล้ว กรุณาพิมพ์ PMV ใหม่ใน LINE';
    }
    if (error.code.includes('not-found')) {
      return 'ไม่พบลิงก์ยืนยัน กรุณาพิมพ์ PMV ใหม่ใน LINE (หลังย้าย Firebase ต้องขอลิงก์ใหม่)';
    }
    if (error.code.includes('failed-precondition')) {
      return 'ลิงก์นี้ถูกใช้งานแล้ว หรือไม่สามารถใช้งานได้';
    }
    if (error.message && error.message !== 'INTERNAL') {
      return error.message;
    }
  }
  if (typeof error === 'object' && error !== null) {
    const maybe = error as { code?: unknown; message?: unknown };
    const code = typeof maybe.code === 'string' ? maybe.code : '';
    if (code.includes('unauthenticated')) {
      return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง';
    }
    if (code.includes('permission-denied')) {
      return 'บัญชีนี้ไม่มีสิทธิ์เชื่อมต่อ LINE';
    }
    if (code.includes('unavailable')) {
      return 'ระบบเชื่อมต่อขัดข้องชั่วคราว กรุณาลองใหม่';
    }
  }
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
  const { user, isLoading, role } = useAuth();

  const [status, setStatus] = useState<LinkStatus>('idle');
  const [message, setMessage] = useState('กำลังตรวจสอบลิงก์...');
  const [lineUid, setLineUid] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string>('');
  const [retryNonce, setRetryNonce] = useState(0);
  const calledRef = useRef(false);

  const linkToken = useMemo(() => {
    const query = new URLSearchParams(location.search);
    const fromQuery = (query.get('token') || '').trim();
    if (fromQuery) {
      sessionStorage.setItem(LINE_CONNECT_TOKEN_KEY, fromQuery);
      return fromQuery;
    }
    return (sessionStorage.getItem(LINE_CONNECT_TOKEN_KEY) || '').trim();
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
      setErrorCode('');

      try {
        // Ensure auth token is fresh before calling callable function.
        await auth.currentUser?.getIdToken(true);
        const callable = httpsCallable<{ token: string }, { success: boolean; lineUid: string }>(
          cloudFunctions,
          'completeLineLinkWithToken',
        );
        const result = await callable({ token: linkToken });

        const linkedUid = result.data.lineUid || '';
        setLineUid(linkedUid);
        setStatus('success');
        setMessage('เชื่อมบัญชี LINE สำเร็จแล้ว');
        sessionStorage.removeItem(LINE_CONNECT_TOKEN_KEY);

        if (user?.uid) {
          const userSnap = await getDocFromServer(doc(db, 'users', user.uid)).catch(() => null);
          const mergedUserData = {
            ...(useAuthStore.getState().userData ?? {}),
            ...(userSnap?.exists() ? userSnap.data() : {}),
            lineToken: linkedUid,
            lineUid: linkedUid,
            authUid: user.uid,
            email: user.email ?? undefined,
            role: role ?? undefined,
          };
          useAuthStore.getState().setUser(user, role, mergedUserData);
        }
      } catch (error) {
        const rawCode = getErrorCode(error);
        setErrorCode(rawCode || 'unknown');
        if (rawCode.includes('unauthenticated')) {
          calledRef.current = false;
          const redirect = `${location.pathname}${location.search}`;
          navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
          return;
        }
        if (shouldClearStoredToken(error)) {
          sessionStorage.removeItem(LINE_CONNECT_TOKEN_KEY);
        }
        setStatus('error');
        setMessage(getFriendlyError(error));
      }
    };

    void connect();
  }, [isLoading, linkToken, location.pathname, location.search, navigate, retryNonce, role, user]);

  const handleRetry = () => {
    calledRef.current = false;
    setStatus('idle');
    setMessage('กำลังตรวจสอบลิงก์...');
    setRetryNonce((prev) => prev + 1);
  };

  const handleRequestNewToken = () => {
    sessionStorage.removeItem(LINE_CONNECT_TOKEN_KEY);
    calledRef.current = false;
    setStatus('error');
    setMessage('กรุณากลับไปที่ LINE แล้วพิมพ์ PMV ใหม่ เพื่อรับลิงก์เชื่อมต่อใหม่');
    setErrorCode('');
  };

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
          <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-red-700 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5" />
              <p className="text-sm font-bold">{message}</p>
            </div>
            {errorCode ? (
              <p className="text-[11px] font-mono text-red-600/90">error: {errorCode}</p>
            ) : null}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-black text-red-700 hover:bg-red-100/40"
              >
                ลองเชื่อมอีกครั้ง
              </button>
              <button
                type="button"
                onClick={handleRequestNewToken}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-black text-amber-700 hover:bg-amber-100/70"
              >
                ขอ token ใหม่จาก LINE
              </button>
            </div>
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
