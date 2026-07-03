import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserCheck, Camera, Trash2 } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useNamePrefix } from '@/hooks/useNamePrefix';
import type { TeacherProfile, NewTeacherProfile } from '@/types/teacher';
import type { Department } from '@/types/curriculum';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

interface AddTeacherModalProps {
  open: boolean;
  editingTeacher?: TeacherProfile | null;
  existingTeachers?: TeacherProfile[];
  onClose: () => void;
  onSubmit: (data: NewTeacherProfile) => void;
  onUpdate?: (id: string, data: NewTeacherProfile) => void;
  onDelete?: (id: string) => void;
}

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  department?: string;
  photoURL?: string;
}

const DEFAULT_FORM: NewTeacherProfile = {
  name: '',
  email: '',
  phone: '',
  department: 'primary',
  position: 'ครูบรรจุ',
  teachingSubjectIds: [],
  status: 'active',
};

const POSITIONS = ['ครูบรรจุ', 'ครูอัตราจ้าง', 'ครูพิเศษ'];
const DEPARTMENT_SHORT_LABEL: Record<Department, string> = {
  early: 'ปฐมวัย',
  primary: 'ประถม',
  secondary: 'มัธยม',
};

const compressImage = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 400;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = url;
  });

export default function AddTeacherModal({
  open,
  editingTeacher,
  onClose,
  onSubmit,
  onUpdate,
}: AddTeacherModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'search'>('profile');
  const [form, setForm] = useState<NewTeacherProfile>(DEFAULT_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { prefixes, formatFullName, extractNameParts } = useNamePrefix('teacher');
  const [prefix, setPrefix] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      if (open) {
        if (editingTeacher) {
          setForm({
            name: editingTeacher.name || '',
            email: editingTeacher.email || '',
            phone: editingTeacher.phone || '',
            department: editingTeacher.department || 'primary',
            position: editingTeacher.position || 'ครูบรรจุ',
            teachingSubjectIds: editingTeacher.teachingSubjectIds || [],
            status: editingTeacher.status || 'active',
            photoURL: editingTeacher.photoURL,
            userId: editingTeacher.userId,
          });

          if (editingTeacher.userId) {
            setSelectedUserId(editingTeacher.userId);
            try {
              const userSnap = await getDoc(doc(db, 'users', editingTeacher.userId));
              if (userSnap.exists()) {
                const userData = userSnap.data();
                if (userData.photoURL) {
                  setForm(prev => ({ ...prev, photoURL: userData.photoURL }));
                }
              }
            } catch (err) {
              console.error('Error syncing user photo:', err);
            }
          }

          const parts = extractNameParts(editingTeacher.name);
          setPrefix(parts.prefix);
          setFirstName(parts.firstName);
          setLastName(parts.lastName);
        } else {
          setForm(DEFAULT_FORM);
          setPrefix('');
          setFirstName('');
          setLastName('');
          setSearchTerm('');
          setSearchResults([]);
          setSelectedUserId(null);
          setActiveTab('profile');
        }
      }
    };

    loadData();
  }, [open, editingTeacher, extractNameParts]);

  const handleSearchUsers = async (val: string) => {
    setSearchTerm(val);
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const q = query(
        collection(db, 'users'),
        where('role', 'in', ['teacher', 'admin'])
      );
      const snap = await getDocs(q);
      const results: UserSearchResult[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        const nameMatch = d.name?.toLowerCase().includes(val.toLowerCase());
        const emailMatch = d.email?.toLowerCase().includes(val.toLowerCase());
        if (nameMatch || emailMatch) {
          results.push({ id: doc.id, ...d } as UserSearchResult);
        }
      });
      setSearchResults(results.slice(0, 5));
    } catch (err) {
      console.error(err);
    }
  };

  const selectUser = (user: UserSearchResult) => {
    const parts = extractNameParts(user.name);
    setPrefix(parts.prefix);
    setFirstName(parts.firstName);
    setLastName(parts.lastName);

    setForm(prev => ({
      ...prev,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      department: (user.department as Department) || prev.department,
      photoURL: user.photoURL,
    }));
    setSelectedUserId(user.id);
    setActiveTab('profile');
    toast.success('ดึงข้อมูลสำเร็จ');
  };

  const handleSubmit = async () => {
    if (!prefix || !firstName.trim() || !lastName.trim()) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }
    if (!selectedUserId) {
      toast.error('กรุณาเชื่อมบัญชีผู้ใช้ก่อนบันทึกข้อมูลครู');
      setActiveTab('search');
      return;
    }
    setIsSubmitting(true);

    try {
      const fullName = formatFullName(prefix, firstName.trim(), lastName.trim());
      const finalForm = {
        ...form,
        name: fullName,
        email: form.email?.trim().toLowerCase() || '',
        userId: selectedUserId
      };

      if (editingTeacher && onUpdate) {
        onUpdate(editingTeacher.id, finalForm);
      } else {
        onSubmit(finalForm);
      }

      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'ไม่ทราบสาเหตุ';
      toast.error('เกิดข้อผิดพลาด: ' + message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) onClose();
    }}>
      <DialogContent
        className="w-[92vw] sm:max-w-md rounded-[2rem] sm:rounded-[2.5rem] border-none p-0 shadow-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)'
        }}
      >
        <div className="px-5 sm:px-6 pt-6 sm:pt-7 pb-2 sm:pb-3 flex justify-between items-center bg-transparent">
          <DialogTitle className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
            {editingTeacher ? 'แก้ไขข้อมูลครู' : 'เพิ่มครูใหม่'}
          </DialogTitle>
        </div>

        <div className="px-5 sm:px-6 pb-3 flex gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex-1 h-8 rounded-lg text-[12px] font-bold transition-all ${activeTab === 'profile'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                }`}
            >
              กรอกข้อมูลใหม่
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`flex-1 h-8 rounded-lg text-[12px] font-bold transition-all ${activeTab === 'search'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                }`}
            >
              ค้นหาจากระบบ
            </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="px-5 sm:px-6 pb-6 sm:pb-7 space-y-3 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {selectedUserId ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700">
              เชื่อมบัญชีผู้ใช้แล้ว: {selectedUserId}
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
              ยังไม่ได้เชื่อมบัญชีผู้ใช้ (ต้องเลือกจากแท็บ "ค้นหาจากระบบ")
            </div>
          )}
          <AnimatePresence mode="wait">
            {activeTab === 'profile' ? (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {/* Name Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">คำนำหน้า</label>
                    <Select value={prefix} onValueChange={setPrefix} required>
                      <SelectTrigger className="h-9 rounded-xl bg-slate-50 border-none shadow-none text-xs font-bold">
                        <SelectValue placeholder="เลือก" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {prefixes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ชื่อ</label>
                    <Input
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="เช่น สมชาย"
                      className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
                    />
                  </div>

                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">นามสกุล</label>
                    <Input
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="เช่น ใจดี"
                      className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
                    />
                  </div>
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">อีเมล</label>
                    <Input
                      type="email"
                      value={form.email || ''}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="ระบุอีเมล"
                      className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">เบอร์โทร</label>
                    <Input
                      value={form.phone || ''}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="เช่น 0901234567"
                      className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
                    />
                  </div>
                </div>

                {/* Position & Department */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ตำแหน่ง</label>
                    <Select value={form.position} onValueChange={(val) => setForm({ ...form, position: val })}>
                      <SelectTrigger className="h-9 rounded-xl bg-slate-50 border-none shadow-none text-xs font-bold w-full">
                        <SelectValue placeholder="เลือกตำแหน่ง" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">แผนก</label>
                    <Select value={form.department} onValueChange={(val) => setForm({ ...form, department: val as Department })}>
                      <SelectTrigger className="h-9 rounded-xl bg-slate-50 border-none shadow-none text-xs font-bold w-full">
                        <SelectValue placeholder="เลือกแผนก" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {(['early', 'primary', 'secondary'] as const).map(dept => (
                          <SelectItem key={dept} value={dept}>{DEPARTMENT_SHORT_LABEL[dept]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Photo */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">รูปภาพ</label>
                  <div
                    className="relative h-24 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-slate-400 transition-all overflow-hidden group"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {form.photoURL ? (
                      <img src={form.photoURL} alt="preview" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                    ) : (
                      <>
                        <Camera size={20} className="text-slate-400" />
                        <p className="text-[11px] font-bold text-slate-500">คลิกเพื่ออัปโหลดรูปภาพ</p>
                      </>
                    )}
                    {form.photoURL && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setForm({ ...form, photoURL: undefined }); }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-500/90 hover:bg-rose-600 text-white shadow-lg transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) setForm({ ...form, photoURL: await compressImage(file) });
                      e.target.value = '';
                    }}
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-10 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-50 transition-all mt-2"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : editingTeacher ? 'บันทึกการแก้ไข' : 'สร้างข้อมูลครู'}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {/* Search Input */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ค้นหารายชื่อ</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="ระบุชื่อหรืออีเมล..."
                      value={searchTerm}
                      onChange={(e) => handleSearchUsers(e.target.value)}
                      className="h-9 rounded-xl bg-slate-50 border-none pl-11 pr-4 text-xs font-bold focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>

                {/* Search Results */}
                <div className="rounded-xl bg-slate-50/50 p-3">
                  <div className="space-y-2 max-h-[340px] overflow-y-auto scrollbar-hide pr-1">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => selectUser(user)}
                        className="w-full p-3 rounded-xl bg-white border border-slate-100 hover:bg-slate-50 hover:border-slate-200 hover:shadow-sm transition-all text-left flex items-center gap-3 group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all overflow-hidden shadow-sm border border-slate-100">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <UserCheck size={18} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                          <p className="text-[12px] font-medium text-slate-400 truncate tracking-tight">{user.email}</p>
                        </div>
                      </button>
                    ))}
                    {searchResults.length === 0 && searchTerm.length >= 2 && (
                      <div className="py-12 text-center">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">ไม่พบข้อมูล</p>
                      </div>
                    )}
                    {searchTerm.length < 2 && (
                      <div className="py-12 text-center opacity-25">
                        <Search size={32} className="mx-auto mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest">พิมพ์เพื่อค้นหา</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </DialogContent>
    </Dialog>
  );
}
