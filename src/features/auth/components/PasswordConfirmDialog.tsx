import { useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Lock } from 'lucide-react';
import FormModal from '@/components/ui/FormModal';
import { Input } from '@/components/ui/input';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface PasswordConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => Promise<void>;
  title: string;
  subtitle?: string;
  confirmLabel?: string;
}

function getErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : '';
  }
  return '';
}

export default function PasswordConfirmDialog({
  open,
  onClose,
  onVerified,
  title,
  subtitle,
  confirmLabel = 'ยืนยัน',
}: PasswordConfirmDialogProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const resetAndClose = () => {
    setPassword('');
    setShowPassword(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!user?.email) {
      toast.error('บัญชีนี้ไม่รองรับการยืนยันรหัสผ่าน');
      return;
    }
    if (!password.trim()) {
      toast.error('กรุณากรอกรหัสผ่าน');
      return;
    }

    setIsLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, password.trim());
      await reauthenticateWithCredential(user, credential);
      await onVerified();
      resetAndClose();
    } catch (error: unknown) {
      const errorCode = getErrorCode(error);
      if (errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
        toast.error('รหัสผ่านไม่ถูกต้อง');
      } else {
        toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={resetAndClose}
      title={title}
      subtitle={subtitle}
      icon={<AlertTriangle size={18} className="text-rose-500" />}
      onSubmit={handleSubmit}
      submitLabel={isLoading ? 'กำลังตรวจสอบ...' : confirmLabel}
      submitDisabled={isLoading || !password.trim()}
      submitClassName="bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20"
      maxWidth="sm"
    >
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-500 ml-1 uppercase tracking-wider">
          รหัสผ่านของคุณ
        </label>
        <div className="relative">
          <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && password.trim() && !isLoading) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            autoFocus
            placeholder="กรอกรหัสผ่านเพื่อยืนยัน"
            className="pl-11 pr-12 h-11 bg-white/60 border-white/70 rounded-2xl text-slate-800"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
    </FormModal>
  );
}
