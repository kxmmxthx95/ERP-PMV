import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, GraduationCap } from 'lucide-react';
import { authService } from '@/features/auth/authService';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import ChangePasswordModal from './components/ChangePasswordModal';
import ForgotPasswordModal from './components/ForgotPasswordModal';

function getErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : '';
  }
  return '';
}

function getSafeRedirectPath(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  return raw;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(localStorage.getItem('remembered_email') || '');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('remembered_email'));
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [hasError, setHasError] = useState(false);

  const { user } = useAuth();
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const hasCheckedPassword = useRef(false);
  const redirectPath = getSafeRedirectPath(new URLSearchParams(location.search).get('redirect'));

  // จัดการ Redirect หลัง Login
  useEffect(() => {
    if (user && !hasCheckedPassword.current && !showChangeModal) {
      const checkPasswordStatus = async () => {
        hasCheckedPassword.current = true;
        try {
          const lookupUid = authService.getFirestoreUid(user.uid);
          const userDoc = await getDoc(doc(db, 'users', lookupUid));
          if (userDoc.exists() && userDoc.data().mustChangePassword) {
            setShowChangeModal(true);
            setIsLoading(false);
          } else {
            navigate(redirectPath);
            setIsLoading(false);
          }
        } catch {
          navigate(redirectPath);
          setIsLoading(false);
        }
      };
      checkPasswordStatus();
    }
  }, [navigate, redirectPath, showChangeModal, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setHasError(false);
    try {
      if (rememberMe) {
        localStorage.setItem('remembered_email', email);
      } else {
        localStorage.removeItem('remembered_email');
      }
      await authService.login(email, password);
      toast.success('เข้าสู่ระบบสำเร็จ 🎉');
    } catch (error: unknown) {
      setHasError(true);
      const errorCode = getErrorCode(error);
      if (errorCode === 'auth/user-not-found') {
        toast.error('ไม่มีผู้ใช้งานนี้ในระบบ');
      } else if (errorCode === 'auth/wrong-password') {
        toast.error('รหัสผ่านผิด');
      } else if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/invalid-email') {
        toast.error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else {
        toast.error('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden flex items-center justify-center py-8">
      {/* ── Background Image with Blur ── */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat scale-105"
        style={{
          backgroundImage: 'url(https://nutty-yellow-w6lw8f8pkd.edgeone.app/BG.jpg)',
          filter: 'blur(10px) brightness(0.95)',
        }}
      />
      <div className="absolute inset-0 z-0 bg-white/20" />
      {/* ── Ambient blobs ── */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-100/30 blur-[120px]" />
        <div className="absolute bottom-[0%] right-[-5%] w-[400px] h-[400px] rounded-full bg-sky-50/40 blur-[100px]" />
      </div>

      {/* ── Main card ── */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 w-full max-w-sm mx-4"
      >
        {/* Glass card */}
        <div
          className="rounded-[3.5rem] p-6 sm:p-8 shadow-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.45)',
            backdropFilter: 'blur(28px) saturate(200%)',
            WebkitBackdropFilter: 'blur(28px) saturate(200%)',
            border: '1px solid rgba(255,255,255,0.70)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.10), 0 4px 20px rgba(0,0,0,0.06)',
          }}
        >
          {/* ── Logo / Brand ── */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #f9a8d4, #fb7185)',
                boxShadow: '0 8px 24px rgba(251,113,133,0.45)',
              }}
            >
              <GraduationCap size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">PIYAMIT SCHOOL</h1>
            <p className="text-xs text-slate-500 mt-0.5">ระบบบริหารจัดการสถานศึกษา</p>
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email field */}
            <div className="space-y-1.5">
              <div
                className="relative flex items-center w-full rounded-2xl transition-all duration-200"
                style={{
                  background: focusedField === 'email' ? 'rgba(255,255,255,0.85)' : (hasError ? 'rgba(254,226,226,0.6)' : 'rgba(255,255,255,0.55)'),
                  border: focusedField === 'email' ? '1.5px solid rgba(59,130,246,0.6)' : (hasError ? '1.5px solid rgba(239,68,68,0.6)' : '1.5px solid rgba(255,255,255,0.6)'),
                  boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(59,130,246,0.15)' : (hasError ? '0 0 0 3px rgba(239,68,68,0.15)' : 'none'),
                }}
              >
                <Mail size={15} className={`absolute left-3.5 flex-shrink-0 ${hasError ? 'text-red-400' : 'text-slate-400'}`} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => { setEmail(e.target.value); setHasError(false); }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="กรอกอีเมล์เพื่อเข้าสู่ระบบ"
                  className="flex-1 min-w-0 bg-transparent pl-9 pr-4 py-2.5 h-11 text-sm text-slate-800 placeholder:text-slate-400 outline-none font-sarabun"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <div
                className="relative flex items-center w-full rounded-2xl transition-all duration-200"
                style={{
                  background: focusedField === 'password' ? 'rgba(255,255,255,0.85)' : (hasError ? 'rgba(254,226,226,0.6)' : 'rgba(255,255,255,0.55)'),
                  border: focusedField === 'password' ? '1.5px solid rgba(59,130,246,0.6)' : (hasError ? '1.5px solid rgba(239,68,68,0.6)' : '1.5px solid rgba(255,255,255,0.6)'),
                  boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(59,130,246,0.15)' : (hasError ? '0 0 0 3px rgba(239,68,68,0.15)' : 'none'),
                }}
              >
                <Lock size={15} className={`absolute left-3.5 flex-shrink-0 ${hasError ? 'text-red-400' : 'text-slate-400'}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => { setPassword(e.target.value); setHasError(false); }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="รหัสผ่าน"
                  className="flex-1 min-w-0 bg-transparent pl-9 pr-11 py-2.5 h-11 text-sm text-slate-800 placeholder:text-slate-400 outline-none font-sarabun"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={showPassword ? 'off' : 'on'}
                      initial={{ opacity: 0, rotate: -15 }}
                      animate={{ opacity: 1, rotate: 0 }}
                      exit={{ opacity: 0, rotate: 15 }}
                      transition={{ duration: 0.15 }}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </motion.div>
                  </AnimatePresence>
                </button>
              </div>
            </div>

            {/* Remember me + forgot password */}
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <span className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors select-none">
                  จำรหัสผ่าน
                </span>
                <div
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`relative w-8 h-4.5 rounded-full transition-all duration-200 flex-shrink-0 ${rememberMe ? 'bg-black' : 'bg-slate-300'}`}
                  style={{ width: '32px', height: '18px' }}
                >
                  <motion.div
                    animate={{ x: rememberMe ? 15 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full shadow-sm"
                  />
                </div>
              </label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
              >
                ลืมรหัสผ่าน?
              </button>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="relative w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white mt-2 overflow-hidden disabled:opacity-70"
              style={{
                background: '#1e1e1e',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              }}
            >
              {/* Shimmer effect */}
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                  animation: 'shimmer 2.5s infinite',
                }}
              />

              <AnimatePresence mode="wait" initial={false}>
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"
                  />
                ) : (
                  <motion.span
                    key="label"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    เข้าสู่ระบบ
                    <ArrowRight size={16} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </form>

          {/* Footer */}
          <p className="text-[10px] text-center text-slate-400 mt-6 leading-relaxed">
            สำหรับผู้ที่มีบัญชีในระบบเท่านั้น
            <br />
            ติดต่อผู้ดูแลระบบหากไม่สามารถเข้าใช้งานได้
          </p>
        </div>

        {/* Version tag */}
        <p className="text-center text-[10px] text-slate-400/70 mt-4">
          Dev. C.Metha 2026
        </p>
      </motion.div>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
      />

      {/* First-time Password Change Modal */}
      {user && (
        <ChangePasswordModal
          user={user}
          isOpen={showChangeModal}
          onSuccess={() => {
            setShowChangeModal(false);
            navigate(redirectPath);
          }}
        />
      )}
    </div>
  );
}
