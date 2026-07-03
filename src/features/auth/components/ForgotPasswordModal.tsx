import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, GraduationCap, Key, ShieldCheck, ChevronRight, Eye, EyeOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { authService } from '@/features/auth/authService';
import {
  formatNationalId,
  normalizeNationalId,
} from '@/features/students/components/studentDetailFormShared';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getCallableMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export default function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [studentCode, setStudentCode] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const resetForm = () => {
    setStudentCode('');
    setNationalId('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNew(false);
    setShowConfirm(false);
  };

  const handleClose = () => {
    if (isLoading) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const code = studentCode.trim();
    if (!code) {
      return toast.error('กรุณากรอกรหัสนักเรียน');
    }
    const digits = normalizeNationalId(nationalId);
    if (digits.length !== 13) {
      return toast.error('เลขบัตรประชาชนต้องครบ 13 หลัก');
    }
    if (newPassword.length < 6) {
      return toast.error('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
    }
    if (newPassword !== confirmPassword) {
      return toast.error('รหัสผ่านไม่ตรงกัน');
    }

    setIsLoading(true);
    try {
      await authService.resetPasswordByNationalId(code, digits, newPassword, confirmPassword);
      toast.success('เปลี่ยนรหัสผ่านสำเร็จแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
      resetForm();
      onClose();
    } catch (error: unknown) {
      toast.error(getCallableMessage(error, 'ไม่สามารถเปลี่ยนรหัสผ่านได้'));
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls =
    'w-full pl-11 pr-12 h-12 bg-white/50 border border-white/60 rounded-2xl text-slate-800 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-sm font-bold';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            aria-label="ปิด"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-white/80 backdrop-blur-2xl border border-white/50 rounded-[2rem] p-8 shadow-2xl"
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="absolute right-5 top-5 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-4 shadow-inner">
                <Key size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">ลืมรหัสผ่าน</h2>
              <p className="text-sm text-slate-500 mt-2">
                กรอกรหัสนักเรียน เลขบัตรประชาชน 13 หลัก และตั้งรหัสผ่านใหม่
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 ml-3 uppercase tracking-wider">
                  รหัสนักเรียน
                </label>
                <div className="relative">
                  <GraduationCap size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    className={inputCls}
                    placeholder="เช่น 13796"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 ml-3 uppercase tracking-wider">
                  เลขบัตรประชาชน
                </label>
                <div className="relative">
                  <CreditCard size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    value={formatNationalId(nationalId) ?? ''}
                    onChange={(e) => setNationalId(normalizeNationalId(e.target.value))}
                    maxLength={17}
                    className={inputCls}
                    placeholder="X-XXXX-XXXXX-XX-X"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 ml-3 uppercase tracking-wider">
                  รหัสผ่านใหม่
                </label>
                <div className="relative">
                  <Key size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputCls}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 ml-3 uppercase tracking-wider">
                  ยืนยันรหัสผ่าน
                </label>
                <div className="relative">
                  <ShieldCheck size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputCls}
                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-[#1e1e1e] hover:bg-black text-white rounded-2xl font-bold transition-all shadow-xl active:scale-[0.98] disabled:opacity-70 mt-4 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    เปลี่ยนรหัสผ่าน
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
