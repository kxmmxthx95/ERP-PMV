import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Shield, Lock, Eye, EyeOff, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { updatePassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { toast } from 'sonner';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { user, role } = useAuth() as any;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน');
      return;
    }

    setIsLoading(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        setIsSuccess(true);
        setNewPassword('');
        setConfirmPassword('');
        toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
        setTimeout(() => {
          setIsSuccess(false);
        }, 3000);
      }
    } catch (error: any) {
      console.error('Password change error:', error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error('กรุณาออกจากระบบแล้วเข้าใหม่เพื่อความปลอดภัยในการเปลี่ยนรหัสผ่าน');
      } else {
        toast.error('เกิดข้อผิดพลาด: ' + (error.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white pointer-events-auto w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl relative"
              style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(16px)',
              }}
            >
              {/* Close Button */}
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors z-10"
              >
                <X size={18} className="text-black/50" />
              </button>

              {/* Header / Profile Info */}
              <div className="pt-12 pb-8 px-8 flex flex-col items-center text-center bg-gradient-to-b from-slate-50 to-white">
                <div className="relative mb-4">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-24 h-24 rounded-[32px] object-cover border-4 border-white shadow-xl" />
                  ) : (
                    <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-xl border-4 border-white">
                      {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-4 border-white rounded-full" />
                </div>
                
                <h3 className="text-xl font-bold text-black/90">
                  {user?.displayName || 'ผู้ใช้งานระบบ'}
                </h3>
                <div className="mt-1 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
                  <Shield size={10} />
                  {role || 'System Admin'}
                </div>
              </div>

              {/* Information List */}
              <div className="px-8 pb-6 space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-black/[0.02] border border-black/[0.03]">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-black/40 shadow-sm">
                    <Mail size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest leading-none mb-1">E-mail Address</p>
                    <p className="text-xs font-medium text-black/70 truncate">{user?.email || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Password Change Section */}
              <div className="px-8 pb-8 border-t border-black/5 mt-2">
                <div className="flex items-center gap-2 py-6">
                  <Lock size={16} className="text-black/30" />
                  <h4 className="text-xs font-bold text-black/80 uppercase tracking-widest pt-0.5">เปลี่ยนรหัสผ่านใหม่</h4>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">รหัสผ่านใหม่</label>
                    <div className="relative">
                      <Input 
                        type={showPwd ? 'text' : 'password'}
                        placeholder="อย่างน้อย 6 ตัวอักษร"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-11 rounded-2xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none pr-10 text-xs font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-black/20 hover:text-black/40 transition-colors"
                      >
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">ยืนยันรหัสผ่านใหม่</label>
                    <Input 
                      type={showPwd ? 'text' : 'password'}
                      placeholder="กรอกรหัสผ่านอีกครั้ง"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-11 rounded-2xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none text-xs font-medium"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isLoading || !newPassword || newPassword !== confirmPassword}
                    className={`w-full h-11 rounded-2xl transition-all duration-300 font-bold text-xs tracking-wide shadow-lg ${
                      isSuccess 
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200' 
                        : 'bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white shadow-black/10'
                    }`}
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isSuccess ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        เปลี่ยนรหัสผ่านแล้ว
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Save size={16} />
                        บันทึกรหัสผ่านใหม่
                      </div>
                    )}
                  </Button>
                </form>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
