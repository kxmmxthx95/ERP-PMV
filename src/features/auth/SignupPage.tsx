import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AtSign, Key, User, Eye, EyeOff, ChevronRight, ChevronLeft, Phone } from 'lucide-react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNamePrefix, type PrefixGroup } from '@/hooks/useNamePrefix';
import { useRoleOptions } from '@/hooks/useRoleOptions';

export default function SignupPage() {
  const navigate = useNavigate();
  const { roleOptions } = useRoleOptions();
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Form fields
  const [prefix, setPrefix] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Prefix Hook Logic
  const prefixGroup = (role === 'student' || role === 'teacher' ? role : 'adult') as PrefixGroup;
  const { prefixes } = useNamePrefix(prefixGroup);

  const formatPhone = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 10);
    let formatted = cleaned;
    if (cleaned.length > 3 && cleaned.length <= 6) {
      formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    } else if (cleaned.length > 6) {
      formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return formatted;
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prefix) {
      toast.error('กรุณาเลือกคำนำหน้า');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('กรุณากรอกชื่อและนามสกุล');
      return;
    }
    if (!role) {
      toast.error('กรุณาเลือกบทบาทที่ต้องการ');
      return;
    }
    if (phone.length < 12) {
      toast.error('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');
      return;
    }
    setStep(2);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน');
      return;
    }
    if (password.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setIsLoading(true);
    try {
      // 1. สร้างบัญชีใน Firebase Auth
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );

      // 2. ตั้ง displayName
      const displayName = `${prefix}${firstName.trim()} ${lastName.trim()}`;
      await updateProfile(credential.user, { displayName });

      // 3. บันทึกลง registration_requests — เพื่อรอให้ SysAdmin ตรวจสอบก่อนย้ายเข้า users หลัก
      await setDoc(doc(db, 'registration_requests', credential.user.uid), {
        uid: credential.user.uid,
        email: email.trim().toLowerCase(),
        displayName,
        prefix,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        role: role,
        status: 'pending',
        createdAt: Timestamp.now(),
      });

      // 4. Sign out ทันที รอ Admin อนุมัติก่อน
      await auth.signOut();

      toast.success('สมัครสมาชิกสำเร็จ! กรุณารอการอนุมัติจากผู้ดูแลระบบ');
      setTimeout(() => navigate('/login'), 2500);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        toast.error('อีเมลนี้ถูกใช้งานแล้ว');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('รูปแบบอีเมลไม่ถูกต้อง');
      } else {
        toast.error('เกิดข้อผิดพลาด: ' + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden"
      style={{
        backgroundImage: 'linear-gradient(to bottom right, #e0f2fe, #bae6fd, #7dd3fc)',
      }}
    >
      <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="bg-white/30 backdrop-blur-xl border border-white/40 rounded-[1.25rem] p-6 shadow-[0_8px_32px_0_rgba(56,189,248,0.2)]">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-semibold text-slate-800">สมัครสมาชิก</h1>
              <p className="text-xs text-slate-500 mt-0.5">ระบบบริหารสถานศึกษา PMV-ONE</p>
            </div>
            <div className="flex gap-1">
              <div className={`w-6 h-1.5 rounded-full transition-colors ${step >= 1 ? 'bg-sky-500' : 'bg-slate-200'}`} />
              <div className={`w-6 h-1.5 rounded-full transition-colors ${step >= 2 ? 'bg-sky-500' : 'bg-slate-200'}`} />
            </div>
          </div>

          {/* Step 1: ข้อมูลส่วนตัว */}
          {step === 1 && (
            <motion.form
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleNextStep}
              className="space-y-3"
            >
              <p className="text-xs font-medium text-slate-600 mb-2">ขั้นตอนที่ 1 — ข้อมูลส่วนตัว</p>

              <div className="relative">
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="w-full bg-white/60 border-white/50 rounded-full h-9 text-xs focus:ring-sky-300">
                    <SelectValue placeholder="เลือกบทบาทที่ต้องการสมัคร" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.filter(r => r.value !== 'sysadmin').map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <Select value={prefix} onValueChange={setPrefix}>
                  <SelectTrigger className="w-full bg-white/60 border-white/50 rounded-full h-9 text-xs focus:ring-sky-300">
                    <SelectValue placeholder="คำนำหน้า" />
                  </SelectTrigger>
                  <SelectContent>
                    {prefixes.map(opt => (
                      <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="ชื่อ"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="pl-9 h-9 bg-white/60 border-white/50 rounded-full text-xs placeholder:text-slate-400 shadow-none focus-visible:ring-2 focus-visible:ring-sky-300"
                />
              </div>

              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="นามสกุล"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="pl-9 h-9 bg-white/60 border-white/50 rounded-full text-xs placeholder:text-slate-400 shadow-none focus-visible:ring-2 focus-visible:ring-sky-300"
                />
              </div>

              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  type="tel"
                  placeholder="เบอร์โทรศัพท์"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  required
                  maxLength={12}
                  className="pl-9 h-9 bg-white/60 border-white/50 rounded-full text-xs placeholder:text-slate-400 shadow-none focus-visible:ring-2 focus-visible:ring-sky-300"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  className="bg-sky-500 hover:bg-sky-600 text-white rounded-full px-5 h-9 text-xs font-medium flex items-center gap-1.5"
                >
                  ถัดไป <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.form>
          )}


          {/* Step 2: ข้อมูลบัญชี */}
          {step === 2 && (
            <motion.form
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleSignup}
              className="space-y-3"
            >
              <p className="text-xs font-medium text-slate-600 mb-2">ขั้นตอนที่ 2 — ข้อมูลบัญชี</p>

              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  type="email"
                  placeholder="อีเมล"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-9 h-auto py-2 bg-white/60 border-white/50 rounded-full text-sm placeholder:text-slate-400 shadow-none focus-visible:ring-2 focus-visible:ring-sky-300"
                />
              </div>

              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-9 pr-9 h-auto py-2 bg-white/60 border-white/50 rounded-full text-sm placeholder:text-slate-400 shadow-none focus-visible:ring-2 focus-visible:ring-sky-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="ยืนยันรหัสผ่าน"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pl-9 pr-9 h-auto py-2 bg-white/60 border-white/50 rounded-full text-sm placeholder:text-slate-400 shadow-none focus-visible:ring-2 focus-visible:ring-sky-300"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <p className="text-[10px] text-slate-500 px-1 leading-relaxed">
                หลังสมัครสำเร็จ บัญชีจะรอการอนุมัติจากผู้ดูแลระบบก่อนเข้าใช้งานได้
              </p>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> ย้อนกลับ
                </button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-sky-500 hover:bg-sky-600 text-white rounded-full px-5 h-9 text-xs font-medium"
                >
                  {isLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'สมัครสมาชิก'
                  )}
                </Button>
              </div>
            </motion.form>
          )}

          {/* Footer */}
          <div className="mt-5 pt-4 border-t border-white/30 text-center">
            <p className="text-[11px] text-slate-500">
              มีบัญชีแล้ว?{' '}
              <button
                onClick={() => navigate('/login')}
                className="font-semibold text-sky-600 hover:underline"
              >
                เข้าสู่ระบบ
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
