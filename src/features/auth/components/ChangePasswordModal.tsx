import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Lock, ShieldCheck, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider 
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from 'firebase/auth';

interface ChangePasswordModalProps {
  user: User;
  onSuccess: () => void;
  isOpen: boolean;
}

export default function ChangePasswordModal({ user, onSuccess, isOpen }: ChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      return toast.error('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
    }
    
    if (newPassword !== confirmPassword) {
      return toast.error('รหัสผ่านใหม่ไม่ตรงกัน');
    }

    setIsLoading(true);
    try {
      // 1. Re-authenticate
      const credential = EmailAuthProvider.credential(user.email!, oldPassword);
      await reauthenticateWithCredential(user, credential);
      
      // 2. Update Password
      await updatePassword(user, newPassword);
      
      // 3. Update Firestore flag
      await updateDoc(doc(db, 'users', user.uid), {
        mustChangePassword: false,
        lastPasswordChange: new Date()
      });

      toast.success('เปลี่ยนรหัสผ่านสำเร็จแล้ว');
      onSuccess();
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/wrong-password') {
        toast.error('รหัสผ่านเดิมไม่ถูกต้อง');
      } else {
        toast.error('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-white/80 backdrop-blur-2xl border border-white/50 rounded-[2rem] p-8 shadow-2xl"
          >
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 bg-pink-100 rounded-2xl flex items-center justify-center text-pink-500 mb-4 shadow-inner">
                <ShieldCheck size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">เปลี่ยนรหัสผ่านครั้งแรก</h2>
              <p className="text-sm text-slate-500 mt-2">
                เพื่อความปลอดภัยกรุณาเปลี่ยนรหัสผ่านใหม่ก่อนเข้าใช้งานระบบ
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 ml-3 uppercase tracking-wider">รหัสผ่านเดิม</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showOld ? "text" : "password"}
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="pl-11 pr-12 h-12 bg-white/50 border-white/60 rounded-2xl text-slate-800 focus:ring-2 focus:ring-pink-200 transition-all border shadow-sm"
                    placeholder="Current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld(!showOld)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 ml-3 uppercase tracking-wider">รหัสผ่านใหม่</label>
                <div className="relative">
                  <Key size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showNew ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-11 pr-12 h-12 bg-white/50 border-white/60 rounded-2xl text-slate-800 focus:ring-2 focus:ring-pink-200 transition-all border shadow-sm"
                    placeholder="At least 6 characters"
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
                <label className="text-[11px] font-bold text-slate-500 ml-3 uppercase tracking-wider">ยืนยันรหัสผ่านใหม่</label>
                <div className="relative">
                  <ShieldCheck size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-11 h-12 bg-white/50 border-white/60 rounded-2xl text-slate-800 focus:ring-2 focus:ring-pink-200 transition-all border shadow-sm"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-[#1e1e1e] hover:bg-black text-white rounded-2xl font-bold transition-all shadow-xl active:scale-[0.98] disabled:opacity-70 mt-4"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    เปลี่ยนรหัสผ่านและเข้าสู่ระบบ <ChevronRight size={18} />
                  </div>
                )}
              </Button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
