import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AtSign, Key, ChevronRight, User, Eye, EyeOff } from 'lucide-react';
import { authService } from '@/features/auth/authService';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import ChangePasswordModal from './components/ChangePasswordModal';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(localStorage.getItem('remembered_email') || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('remembered_email'));
  const { user, role: authRole } = useAuth();
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [isCheckingPassword, setIsCheckingPassword] = useState(false);
  const hasToastedWarning = useRef(false);

  // สร้าง State สำหรับดึงวันเวลาปัจจุบัน และอัปเดตแบบ Real-time
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const shortMonth = currentTime.toLocaleString('en-US', { month: 'short' });
  const fullYear = currentTime.getFullYear();
  const dayName = currentTime.toLocaleString('en-US', { weekday: 'long' });
  const dateNum = currentTime.getDate().toString().padStart(2, '0');
  const fullMonthYear = currentTime.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const timeString = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // จัดการการนำไปหน้า Dashboard หรือบังคับเปลี่ยนรหัสผ่าน
  useEffect(() => {
    if (user && !isCheckingPassword && !showChangeModal) {
      const checkPasswordStatus = async () => {
        setIsCheckingPassword(true);
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));

          // แจ้งเตือนถ้า role ที่เลือกไม่ตรงกับ role จริงจาก custom claims
          if (authRole && authRole !== role && !hasToastedWarning.current) {
            const ROLE_LABELS: Record<string, string> = {
              student: 'นักเรียน', parent: 'ผู้ปกครอง', teacher: 'ครูผู้สอน',
              staff: 'เจ้าหน้าที่', admin: 'ผู้บริหาร', sysadmin: 'ผู้ดูแลระบบสูงสุด',
            };
            toast.warning(`Role ไม่ตรงกัน — คุณเลือก "${ROLE_LABELS[role] ?? role}" แต่บัญชีนี้เป็น "${ROLE_LABELS[authRole] ?? authRole}" ระบบจะพาไปยังหน้าที่ถูกต้องให้`, { duration: 6000 });
            hasToastedWarning.current = true;
          }

          if (userDoc.exists() && userDoc.data().mustChangePassword) {
            setShowChangeModal(true);
          } else {
            const targetRole = authRole || role;
            navigate(`/${targetRole}`);
          }
        } catch (error) {
          console.error("Error checking password status:", error);
          const targetRole = authRole || role;
          navigate(`/${targetRole}`);
        } finally {
          setIsCheckingPassword(false);
        }
      };
      
      checkPasswordStatus();
    }
  }, [user, authRole, navigate, role, isCheckingPassword, showChangeModal]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // [DEV MODE] บันทึก Role ที่เลือกจาก Dropdown ไว้ใช้ทดสอบ
      if (import.meta.env.DEV) {
        localStorage.setItem('dev_role', role);
      }

      // บันทึกหรือลบอีเมลที่จดจำไว้ใน Local Storage
      if (rememberMe) {
        localStorage.setItem('remembered_email', email);
      } else {
        localStorage.removeItem('remembered_email');
      }

      await authService.login(email, password);
      toast.success('เข้าสู่ระบบสำเร็จ');
      // ไม่ต้องเรียก navigate ที่นี่ ปล่อยให้ useEffect ด้านบนเป็นตัวจัดการเมื่อ state พร้อม
    } catch (error: any) {
      const msg = error.message === 'ไม่พบชื่อผู้ใช้งานหรือรหัสประจำตัวนี้ในระบบ' 
        ? error.message 
        : 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      toast.error(msg);
      console.error(error);
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-cover bg-center"
      style={{
        backgroundImage: "linear-gradient(to bottom right, #fbcfe8, #fda4af, #fecdd3)"
      }}
    >
      <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />

      {/* Main Container - Grid Layout */}
      <div className="relative z-10 w-full max-w-2xl grid grid-cols-1 lg:grid-cols-5 gap-3 items-start">

        {/* LEFT SIDE - Login & References Cards */}
        <div className="flex flex-col gap-3 col-span-1 lg:col-span-3">
          {/* Login Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full bg-white/30 backdrop-blur-xl border border-white/40 rounded-[1.25rem] p-4 shadow-[0_8px_32px_0_rgba(255,192,203,0.3)]"
          >
            {/* Header Section */}
            <div className="flex justify-between items-baseline mb-4">
              <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
                Log in
              </h1>
              <Button
                variant="link"
                className="text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors px-0"
                onClick={() => navigate('/signup')}
              >
                Sign up
              </Button>
            </div>

            <form onSubmit={handleLogin} className="space-y-2">
              {/* Role Dropdown - Pill Shape */}
              <div className="relative">
                <div className="absolute inset-y-0 left-1 pl-2 flex items-center pointer-events-none text-slate-600 z-10">
                  <User className="w-3 h-3" />
                </div>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="w-full h-auto pl-8 pr-3 py-1.5 bg-white/60 border border-white/50 rounded-full text-slate-800 text-xs font-medium focus:ring-2 focus:ring-white/80 transition-all shadow-none">
                    <SelectValue placeholder="เลือกบทบาท (Role)" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-white/50 bg-white/80 backdrop-blur-xl">
                    <SelectItem value="student" className="rounded-lg cursor-pointer text-xs">นักเรียน (Student)</SelectItem>
                    <SelectItem value="parent" className="rounded-lg cursor-pointer text-xs">ผู้ปกครอง (Parent)</SelectItem>
                    <SelectItem value="teacher" className="rounded-lg cursor-pointer text-xs">คุณครู (Teacher)</SelectItem>
                    <SelectItem value="staff" className="rounded-lg cursor-pointer text-xs">บุคลากร (Staff)</SelectItem>
                    <SelectItem value="admin" className="rounded-lg cursor-pointer text-xs">ผู้บริหาร (Admin)</SelectItem>
                    <SelectItem value="sysadmin" className="rounded-lg cursor-pointer text-xs">ผู้ดูแลระบบสูงสุด (SysAdmin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Email Input - Pill Shape */}
              <div className="relative">
                <div className="absolute inset-y-0 left-1 pl-2 flex items-center pointer-events-none text-slate-600 z-10">
                  <AtSign className="w-3 h-3" />
                </div>
                <Input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-auto pl-8 pr-3 py-1.5 bg-white/60 border border-white/50 rounded-full text-slate-800 text-xs font-medium focus-visible:ring-2 focus-visible:ring-white/80 transition-all placeholder:text-slate-500 shadow-none"
                  placeholder="email or username"
                />
              </div>

              {/* Password Input - Pill Shape */}
              <div className="relative">
                <div className="absolute inset-y-0 left-1 pl-2 flex items-center pointer-events-none text-slate-600 z-10">
                  <Key className="w-3 h-3" />
                </div>
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-auto pl-8 pr-8 py-1.5 bg-white/60 border border-white/50 rounded-full text-slate-800 text-xs font-medium focus-visible:ring-2 focus-visible:ring-white/80 transition-all placeholder:text-slate-500 shadow-none"
                  placeholder="password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-1 flex items-center pr-2 text-slate-600 hover:text-slate-800 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>

              {/* Remember Me */}
              <div className="flex items-center space-x-2 px-2 pt-1 z-10 relative">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  className="w-3.5 h-3.5 border-slate-400 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500 text-white rounded-[4px]" 
                />
                <label htmlFor="remember" className="text-[10px] font-medium text-slate-600 cursor-pointer select-none hover:text-slate-800 transition-colors">
                  จดจำรหัสผ่าน (Remember me)
                </label>
              </div>

              {/* Footer Text & Submit Button Section */}
              <div className="flex items-end justify-between pt-3 gap-2">
                <p className="text-[9px] leading-relaxed text-slate-600/80 max-w-[65%]">
                  ระบบบริหารสถานศึกษา เข้าสู่ระบบเพื่อจัดการข้อมูลต และติดตามข่าวสารของโรงเรียน
                  <br/><br/>
                  <a href="#" className="font-semibold text-slate-700 hover:underline">Click here for more info.</a>
                </p>

                {/* Dark Action Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-8 h-8 shrink-0 bg-[#1e1e1e] hover:bg-black text-white rounded-full flex items-center justify-center shadow-xl transition-transform active:scale-95 disabled:opacity-70 p-0"
                >
                  {isLoading ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </form>
          </motion.div>

          {/* School Announcements Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className="w-full bg-slate-900/80 backdrop-blur-xl border border-white/20 rounded-[1rem] p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)]"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white mb-0.5">ประกาศจากทางโรงเรียน</h3>
                <p className="text-[10px] text-slate-400">โรงเรียนปิยามิตรวิทยา (Piyamit News Feed)</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse shadow-[0_0_8px_rgba(236,72,153,0.5)]" />
                <Button className="w-7 h-7 bg-white/10 hover:bg-white/20 text-white rounded-full p-0 flex items-center justify-center transition-colors">
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2 border-t border-white/5 pt-3">
              <div className="flex items-start gap-2.5 group cursor-pointer">
                <div className="w-1 h-1 rounded-full bg-pink-400 mt-1.5 flex-shrink-0" />
                <p className="text-[10px] text-slate-300 leading-relaxed font-medium group-hover:text-white transition-colors">
                  📢 แจ้งกำหนดการเปิดภาคเรียนที่ 1 ปีการศึกษา 2567 ในวันที่ 16 พฤษภาคมนี้
                </p>
              </div>
              <div className="flex items-start gap-2.5 group cursor-pointer">
                <div className="w-1 h-1 rounded-full bg-slate-500 mt-1.5 flex-shrink-0" />
                <p className="text-[10px] text-slate-400 leading-relaxed group-hover:text-slate-200 transition-colors">
                  📝 ตรวจสอบรายชื่อห้องเรียนและรหัสนักเรียนใหม่ได้ที่ Dashboard หลังเข้าสู่ระบบ
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* RIGHT SIDE - Calendar Card (Hidden on mobile) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          className="hidden lg:flex lg:col-span-2 self-stretch"
        >
          <div className="w-full h-full bg-white/95 backdrop-blur-xl border border-white/50 rounded-[1.25rem] p-3.5 shadow-[0_8px_32px_0_rgba(255,255,255,0.3)] flex flex-col">
            {/* Calendar Header — Jan left, Minimalism style right */}
            <div className="flex justify-between items-start mb-1">
              <div>
                <h2 className="text-3xl font-light text-slate-800 leading-none">{shortMonth}</h2>
                <p className="text-2xl font-light text-slate-300 mt-0.5">{fullYear}</p>
              </div>
              <div className="text-right pt-0.5">
                <p className="text-[10px] text-slate-400">PIYAMITWITTAYA</p>
                <p className="text-[10px] text-slate-400 mt-0.5">SCHOOL MAMAGEMENT</p>
              </div>
            </div>

            {/* Pink Circle — flex-1 to fill remaining space */}
            <div className="flex-1 flex items-center justify-center py-2">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-300 to-pink-400 rounded-full shadow-lg" />
            </div>

            {/* Date Info */}
            <div className="border-t border-slate-200 pt-2 mb-2">
              <p className="text-xs text-slate-600">{dayName} {dateNum}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{fullMonthYear}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{timeString}</p>
            </div>

            {/* Bottom Section */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-500">Creativestyle</p>
              <Button className="w-6 h-6 bg-slate-800 hover:bg-slate-900 text-white rounded-full p-0 flex items-center justify-center transition-colors">
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-[10px] text-slate-500 text-center mt-1.5">Click Here</p>
          </div>
        </motion.div>
      </div>
      {/* First-time Password Change Modal */}
      {user && (
        <ChangePasswordModal 
          user={user} 
          isOpen={showChangeModal} 
          onSuccess={() => {
            setShowChangeModal(false);
            const targetRole = authRole || role;
            navigate(`/${targetRole}`);
          }} 
        />
      )}
    </div>
  );
}