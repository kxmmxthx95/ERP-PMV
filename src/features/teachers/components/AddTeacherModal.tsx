import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserCheck, Layout, Upload, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useNamePrefix } from '@/hooks/useNamePrefix';
import type { TeacherProfile, NewTeacherProfile } from '@/types/teacher';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import FormModal from '@/components/ui/FormModal';

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
  const [isUploading, setIsUploading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { prefixes, formatFullName, extractNameParts } = useNamePrefix('teacher');
  const [prefix, setPrefix] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (open) {
        if (editingTeacher) {
          // 1. Initial set from teacher record
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

          // 2. If has userId, try to sync latest photo from 'users' feature
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
  }, [open, editingTeacher]);

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    setIsUploading(true);
    try {
      const fileName = `teacher_photos/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setForm(prev => ({ ...prev, photoURL: url }));
      toast.success('อัปโหลดรูปภาพสำเร็จ');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปโหลด');
    } finally {
      setIsUploading(false);
    }
  };

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
    setIsSubmitting(true);

    try {
      const fullName = formatFullName(prefix, firstName.trim(), lastName.trim());
      const finalForm = {
        ...form,
        name: fullName,
        email: form.email?.trim().toLowerCase() || '',
        userId: selectedUserId || undefined
      };

      if (editingTeacher && onUpdate) {
        onUpdate(editingTeacher.id, finalForm);
      } else {
        onSubmit(finalForm);
      }

      onClose();
    } catch (error: any) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const Label = ({ children, required }: { children: React.ReactNode, required?: boolean }) => (
    <label className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1 font-sarabun mb-1.5 block">
      {children} {required && <span className="text-red-400">*</span>}
    </label>
  );

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={editingTeacher ? 'แก้ไขข้อมูลครู' : 'เพิ่มครูใหม่'}
      subtitle={editingTeacher ? 'ปรับปรุงข้อมูลพื้นฐานและสังกัดของบุคลากร' : 'เพิ่มข้อมูลบุคลากรใหม่เข้าสู่ระบบบริหารจัดการ'}
      onSubmit={handleSubmit}
      submitLabel={isSubmitting ? 'กำลังบันทึก...' : editingTeacher ? 'บันทึกการแก้ไข' : 'สร้างข้อมูลครู'}
      submitDisabled={isSubmitting}
      icon={<Layout size={18} />}
    >
      <div className="flex flex-col gap-5 py-2 font-sarabun">
        {/* Tabs Control - Minimal Style */}
        {!editingTeacher && (
          <div className="flex p-1 bg-black/[0.03] rounded-xl w-full mb-2">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${activeTab === 'profile'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              กรอกข้อมูลใหม่
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${activeTab === 'search'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              ค้นหาจากรายชื่อในระบบ
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'profile' ? (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Photo Preview (Small & Subtle) */}
              {(form.photoURL || firstName) && (
                <div className="flex justify-center mb-2">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-600/10 border border-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
                    {form.photoURL ? (
                      <img src={form.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-black text-indigo-500/30">{firstName ? firstName.charAt(0) : '+'}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Form Fields - Strictly Vertical */}
              <div>
                <Label required>คำนำหน้า</Label>
                <Select value={prefix} onValueChange={setPrefix}>
                  <SelectTrigger className="h-11 rounded-xl bg-black/[0.03] border-transparent focus:ring-slate-300 transition-all font-medium text-sm">
                    <SelectValue placeholder="เลือกคำนำหน้าชื่อ" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-white/50 backdrop-blur-xl">
                    {prefixes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label required>ชื่อ</Label>
                <Input
                  placeholder="ระบุชื่อ (เช่น สมชาย)"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-11 rounded-xl bg-black/[0.03] border-transparent focus:ring-slate-300 transition-all font-medium text-sm"
                />
              </div>

              <div>
                <Label required>นามสกุล</Label>
                <Input
                  placeholder="ระบุนามสกุล (เช่น ใจดี)"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-11 rounded-xl bg-black/[0.03] border-transparent focus:ring-slate-300 transition-all font-medium text-sm"
                />
              </div>

              <div>
                <Label>เบอร์โทรศัพท์</Label>
                <Input
                  placeholder="เช่น 0901234567"
                  value={form.phone || ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="h-11 rounded-xl bg-black/[0.03] border-transparent focus:ring-slate-300 transition-all font-medium text-sm"
                />
              </div>

              <div>
                <Label>อีเมล</Label>
                <Input
                  type="email"
                  placeholder="ระบุอีเมลผู้ใช้งาน"
                  value={form.email || ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-11 rounded-xl bg-black/[0.03] border-transparent focus:ring-slate-300 transition-all font-medium text-sm"
                />
              </div>

              <div>
                <Label>ตำแหน่ง</Label>
                <Select
                  value={form.position}
                  onValueChange={(val) => setForm({ ...form, position: val })}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-black/[0.03] border-transparent focus:ring-slate-300 transition-all font-medium text-sm">
                    <SelectValue placeholder="ระบุตำแหน่งบุคลากร" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-white/50 backdrop-blur-xl">
                    {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>ฝ่าย / สังกัด</Label>
                <div className="flex p-1 bg-black/[0.03] rounded-xl h-11">
                  {(['early', 'primary', 'secondary'] as const).map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setForm({ ...form, department: dept })}
                      className={`flex-1 rounded-lg text-[10px] font-bold transition-all ${form.department === dept
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                      {DEPARTMENT_CONFIG[dept].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>URL รูปถ่าย</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="วางลิงก์รูปภาพ (ถ้ามี)"
                      value={form.photoURL || ''}
                      onChange={(e) => setForm({ ...form, photoURL: e.target.value })}
                      className="h-11 rounded-xl bg-black/[0.03] border-transparent focus:ring-slate-300 transition-all font-medium text-sm"
                    />
                  </div>
                  <label className="shrink-0 cursor-pointer h-11 w-11 rounded-xl bg-black/[0.03] hover:bg-black/[0.06] flex items-center justify-center transition-all group">
                    {isUploading ? (
                      <Loader2 size={18} className="text-slate-400 animate-spin" />
                    ) : (
                      <Upload size={18} className="text-slate-400 group-hover:text-blue-600" />
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleUploadImage}
                      disabled={isUploading}
                    />
                  </label>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div>
                <Label>ค้นหารายชื่อจากระบบ</Label>
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="ระบุชื่อหรืออีเมลเพื่อค้นหา..."
                    value={searchTerm}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    className="h-12 rounded-xl bg-black/[0.03] border-transparent pl-10 focus:ring-slate-300 transition-all font-medium text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-hide pr-1">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => selectUser(user)}
                    className="w-full p-4 rounded-xl bg-black/[0.02] border border-transparent hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all text-left flex items-center gap-4 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all overflow-hidden shadow-sm border border-black/[0.03]">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserCheck size={18} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                      <p className="text-[11px] font-medium text-slate-400 truncate tracking-tight">{user.email}</p>
                    </div>
                  </button>
                ))}
                {searchResults.length === 0 && searchTerm.length >= 2 && (
                  <div className="py-12 text-center">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">ไม่พบข้อมูลผู้ใช้งาน</p>
                  </div>
                )}
                {searchTerm.length < 2 && (
                  <div className="py-12 text-center opacity-20">
                    <Search size={32} className="mx-auto mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">พิมพ์เพื่อเริ่มต้นค้นหา</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FormModal>
  );
}
