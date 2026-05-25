import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Shield,
  UserCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { functions as cloudFunctions } from '@/lib/firebase';

const LINE_OA_ID_RAW = (import.meta.env.VITE_LINE_OA_ID || '@pmv-one').trim();
const LINE_OA_ID = LINE_OA_ID_RAW.startsWith('@') ? LINE_OA_ID_RAW : `@${LINE_OA_ID_RAW}`;
const LINK_KEYWORD = 'PMV';
const DEFAULT_LINE_ADD_FRIEND_URL = 'https://lin.ee/QKGIt0J';
const LINE_ADD_FRIEND_URL = (import.meta.env.VITE_LINE_ADD_FRIEND_URL || '').trim() || DEFAULT_LINE_ADD_FRIEND_URL;
const LINE_LOGIN_CHANNEL_ID = (import.meta.env.VITE_LINE_LOGIN_CHANNEL_ID || '').trim();
const LINE_LOGIN_REDIRECT_URI = (import.meta.env.VITE_LINE_LOGIN_REDIRECT_URI || '').trim();
const LINE_OAUTH_STATE_KEY = 'line_oauth_state';

export default function NonStudentProfilePage() {
  const { user, userData, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [lineUid, setLineUid] = useState<string>((userData?.lineUid || userData?.lineToken || '').trim());
  const [copiedKeyword, setCopiedKeyword] = useState(false);
  const [lineLoginStatus, setLineLoginStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [lineLoginError, setLineLoginError] = useState('');
  const codeProcessedRef = useRef(false);

  const headerActionsPortal = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return document.getElementById('header-portal-right-actions');
  }, []);

  useEffect(() => {
    setLineUid((userData?.lineUid || userData?.lineToken || '').trim());
  }, [userData]);

  // รับ ?code= จาก LINE OAuth callback
  useEffect(() => {
    if (codeProcessedRef.current) return;
    const query = new URLSearchParams(location.search);
    const code = query.get('code');
    const state = query.get('state');
    if (!code) return;

    codeProcessedRef.current = true;
    const storedState = sessionStorage.getItem(LINE_OAUTH_STATE_KEY);
    navigate('/portal/profile', { replace: true });

    if (state !== storedState) {
      setLineLoginStatus('error');
      setLineLoginError('state ไม่ตรงกัน กรุณาลองใหม่');
      return;
    }
    sessionStorage.removeItem(LINE_OAUTH_STATE_KEY);
    setLineLoginStatus('processing');

    const callable = httpsCallable<{ code: string }, { success: boolean; lineUid: string; displayName: string }>(
      cloudFunctions,
      'linkLineLoginAccount',
    );
    callable({ code })
      .then((result) => {
        setLineUid(result.data.lineUid);
        setLineLoginStatus('success');
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ';
        setLineLoginError(msg);
        setLineLoginStatus('error');
      });
  }, [location.search, navigate]);

  const displayName = userData?.firstName
    ? `${userData.prefix || ''}${userData.firstName} ${userData.lastName || ''}`.trim()
    : (user?.displayName || user?.email || 'ผู้ใช้งาน');

  const profileItems = [
    {
      label: 'ชื่อ-นามสกุล',
      value: displayName || '-',
      icon: <UserCircle2 size={14} className="text-slate-500" />,
    },
    {
      label: 'บทบาท',
      value: role || '-',
      icon: <Shield size={14} className="text-slate-500" />,
    },
    {
      label: 'อีเมล',
      value: user?.email || userData?.email || '-',
      icon: <Mail size={14} className="text-slate-500" />,
    },
    {
      label: 'เบอร์โทร',
      value: userData?.phone || '-',
      icon: <Phone size={14} className="text-slate-500" />,
    },
  ];

  function handleLineLogin() {
    const state = crypto.randomUUID();
    sessionStorage.setItem(LINE_OAUTH_STATE_KEY, state);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: LINE_LOGIN_CHANNEL_ID,
      redirect_uri: LINE_LOGIN_REDIRECT_URI,
      state,
      scope: 'profile openid',
    });
    window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
  }

  function handleCopyKeyword() {
    navigator.clipboard.writeText(LINK_KEYWORD).then(() => {
      setCopiedKeyword(true);
      setTimeout(() => setCopiedKeyword(false), 1800);
    });
  }

  function openLineAddFriend() {
    window.open(LINE_ADD_FRIEND_URL, '_blank', 'noopener,noreferrer');
  }

  function onHeaderLineClick() {
    if (lineUid) {
      document.getElementById('line-connect-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    openLineAddFriend();
  }

  return (
    <>
      {headerActionsPortal && !lineUid && createPortal(
        <button
          type="button"
          onClick={onHeaderLineClick}
          className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-[11px] font-black transition-all bg-[#06c755] text-white border border-[#06c755] hover:bg-[#05b84d]"
          title="เชื่อม LINE เพื่อรับแจ้งเตือน"
        >
          <Link2 size={13} />
          เชื่อม LINE
        </button>,
        headerActionsPortal,
      )}

      <div className="h-full w-full overflow-y-auto px-3 py-4 sm:p-6">
        <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">โปรไฟล์ผู้ใช้งาน</p>
            <h1 className="mt-2 text-xl sm:text-2xl font-black text-slate-800 break-words">{displayName}</h1>
            <p className="mt-1 text-xs font-medium text-slate-500 break-all">UID: {user?.uid || '-'}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {profileItems.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                    {item.icon}
                    {item.label}
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-700 break-words">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="line-connect-section" className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">LINE Integration</p>
              <h2 className="mt-1 text-lg font-black text-slate-800">เชื่อมต่อ LINE เพื่อรับการแจ้งเตือน</h2>
            </div>

            {/* สถานะการเชื่อมต่อ */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              {lineUid ? (
                <div className="flex items-start gap-2 text-emerald-700">
                  <CheckCircle2 size={16} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-black">เชื่อมบัญชี LINE แล้ว</p>
                    <p className="mt-0.5 font-mono text-[11px]">{lineUid}</p>
                    <p className="mt-1 text-[12px] text-emerald-700/80">พร้อมรับการแจ้งเตือนจากระบบ PMV</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertCircle size={16} />
                  <p className="text-sm font-black">ยังไม่ได้เชื่อมบัญชี LINE</p>
                </div>
              )}
            </div>

            {/* LINE OAuth status feedback */}
            {lineLoginStatus === 'processing' && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 flex items-center gap-2 text-blue-700">
                <Loader2 size={15} className="animate-spin" />
                <p className="text-sm font-bold">กำลังเชื่อมบัญชี LINE...</p>
              </div>
            )}
            {lineLoginStatus === 'success' && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 flex items-center gap-2 text-emerald-700">
                <CheckCircle2 size={15} />
                <p className="text-sm font-bold">เชื่อมบัญชี LINE สำเร็จ!</p>
              </div>
            )}
            {lineLoginStatus === 'error' && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-red-700 space-y-1">
                <div className="flex items-center gap-2">
                  <AlertCircle size={15} />
                  <p className="text-sm font-bold">เชื่อมต่อไม่สำเร็จ</p>
                </div>
                {lineLoginError && <p className="text-[11px] font-mono pl-5">{lineLoginError}</p>}
              </div>
            )}

            {!lineUid && lineLoginStatus !== 'processing' && (
              <div className="space-y-4">
                {/* วิธีที่ 1: LINE Login OAuth */}
                <button
                  type="button"
                  onClick={handleLineLogin}
                  className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-3 text-sm font-black text-white"
                  style={{ background: '#06c755' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                  </svg>
                  เชื่อมด้วย LINE Login
                </button>

                {/* divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[11px] font-bold text-slate-400">หรือเชื่อมผ่าน LINE OA</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* วิธีที่ 2: manual 3 ขั้นตอน */}
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[#06c755]/30 bg-[#06c755]/5 p-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                    <p className="text-xs font-black text-slate-700">1. เพิ่มเพื่อน LINE OA: <span className="font-mono">{LINE_OA_ID}</span></p>
                    <button
                      type="button"
                      onClick={openLineAddFriend}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#06c755] px-3 py-1.5 text-xs font-black text-white hover:bg-[#05b84d] flex-shrink-0"
                    >
                      <MessageCircle size={12} />
                      เพิ่มเพื่อน
                      <ExternalLink size={11} className="opacity-80" />
                    </button>
                  </div>

                  <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                    <p className="text-xs font-black text-slate-700 mb-2">2. พิมพ์ข้อความนี้ในแชต LINE OA</p>
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-3">
                      <span className="flex-1 min-w-0 break-all font-mono text-base sm:text-xl font-black tracking-[0.2em] sm:tracking-widest text-violet-700">{LINK_KEYWORD}</span>
                      <button
                        type="button"
                        onClick={handleCopyKeyword}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-black ${
                          copiedKeyword
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                        }`}
                      >
                        {copiedKeyword ? <Check size={12} /> : <Copy size={12} />}
                        {copiedKeyword ? 'คัดลอกแล้ว' : 'คัดลอก'}
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">ระบบจะส่งลิงก์ยืนยันอัตโนมัติกลับมาในแชต LINE</p>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 space-y-2">
                    <p className="text-xs font-black text-slate-700">3. กดลิงก์ยืนยันที่บอทส่งมา แล้วล็อกอินบัญชีโรงเรียน</p>
                    <p className="text-[12px] text-blue-700">
                      หลังยืนยันสำเร็จ ระบบจะเชื่อมบัญชี LINE ให้อัตโนมัติทันที โดยไม่ต้องกรอก LINE UID
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
