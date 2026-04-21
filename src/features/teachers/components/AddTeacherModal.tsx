import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, UserCheck, UserPlus, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useNamePrefix } from '@/hooks/useNamePrefix';
import type { TeacherProfile, NewTeacherProfile } from '@/types/teacher';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import { toast } from 'sonner';
import FormModal from '@/components/ui/FormModal';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import React from 'react';

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  department?: string;
}

interface AddTeacherModalProps {
  open: boolean;
  editingTeacher?: TeacherProfile | null;
  existingTeachers?: TeacherProfile[];
  onClose: () => void;
  onSubmit: (data: NewTeacherProfile) => void;
  onUpdate?: (id: string, data: NewTeacherProfile) => void;
  onDelete?: (id: string) => void;
}

const POSITIONS = [
  'ครูบรรจุ',
  'ครูอัตราจ้าง',
  'ครูพิเศษ',
  'อื่นๆ',
];

const DEFAULT_FORM: NewTeacherProfile = {
  name: '',
  employeeCode: '',
  email: '',
  phone: '',
  department: 'primary',
  position: 'ครูบรรจุ',
  teachingSubjectIds: [],
  maxHoursPerWeek: 20,
  status: 'active',
};

export default function AddTeacherModal({
  open,
  editingTeacher,
  existingTeachers = [],
  onClose,
  onSubmit,
  onUpdate,
  onDelete,
}: AddTeacherModalProps) {
  const [form, setForm] = useState<NewTeacherProfile>(DEFAULT_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // ตรวจสอบความซ้ำซ้อน
  const duplicateTeacher = !editingTeacher && form.email 
    ? existingTeachers.find(t => t.email?.toLowerCase() === form.email?.toLowerCase())
    : null;

  // ส่วนจัดการชื่อแยกส่วน
  const { prefixes, formatFullName, extractNameParts } = useNamePrefix('teacher');
  const [prefix, setPrefix] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const isOther = form.position !== 'ครูบรรจุ' &&
    form.position !== 'ครูอัตราจ้าง' &&
    form.position !== 'ครูพิเศษ' &&
    form.position !== '';

  useEffect(() => {
    if (open) {
      if (editingTeacher) {
        setForm({
          name: editingTeacher.name || '',
          employeeCode: editingTeacher.employeeCode || '',
          email: editingTeacher.email || '',
          phone: editingTeacher.phone || '',
          department: editingTeacher.department || 'primary',
          position: editingTeacher.position || 'ครูประจำการ',
          teachingSubjectIds: editingTeacher.teachingSubjectIds || [],
          maxHoursPerWeek: editingTeacher.maxHoursPerWeek || 20,
          status: editingTeacher.status || 'active',
        });
        const parts = extractNameParts(editingTeacher.name);
        setPrefix(parts.prefix);
        setFirstName(parts.firstName);
        setLastName(parts.lastName);
      } else {
        setForm(DEFAULT_FORM);
        setSearchTerm('');
        setSearchResults([]);
        setSelectedUserId(null);
        setPrefix('');
        setFirstName('');
        setLastName('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingTeacher]);

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
    }));
    setSelectedUserId(user.id);
    setSearchResults([]);
    setSearchTerm('');
    toast.success('ดึงข้อมูลผู้ใช้งานสำหเร็จ');
  };

  const set = <K extends keyof NewTeacherProfile>(key: K, value: NewTeacherProfile[K]) => {
    if (key === 'email' || key === 'name') {
      setSelectedUserId(null);
    }
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const isValid = prefix && firstName.trim() && lastName.trim() && form.department;

  const handleSubmit = async () => {
    if (!isValid) return;
    setIsSubmitting(true);

    try {
      const fullName = formatFullName(prefix, firstName.trim(), lastName.trim());
      const employeeCode = form.employeeCode || `T-${Date.now().toString().slice(-6)}`;

      const finalForm = {
        ...form,
        name: fullName,
        email: form.email?.trim().toLowerCase() || '',
        employeeCode,
        userId: selectedUserId // ผูก UID ของระบบผู้ใช้งานไว้ (ถ้ามี)
      };

      if (editingTeacher && onUpdate) {
        onUpdate(editingTeacher.id, finalForm);
      } else {
        onSubmit(finalForm);
      }

      toast.success(editingTeacher ? 'อัปเดตข้อมูลสำเร็จ' : 'เพิ่มข้อมูลครูสำเร็จ');
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (editingTeacher && onDelete) {
      onDelete(editingTeacher.id);
      onClose();
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={editingTeacher ? 'แก้ไขข้อมูลครู' : 'เพิ่มครูใหม่'}
      icon={editingTeacher ? <Pencil size={18} /> : <UserPlus size={18} />}
      onSubmit={handleSubmit}
      submitLabel={isSubmitting ? 'กำลังบันทึก...' : (editingTeacher ? 'บันทึกการแก้ไข' : 'บันทึก')}
      submitDisabled={!isValid || isSubmitting || !!duplicateTeacher}
      onDelete={editingTeacher ? handleDelete : undefined}
      deleteLabel="ลบข้อมูลครู"
      maxWidth="md"
    >
      <div className="space-y-4 py-2">
        {/* Compact Search - No Label */}
        {!editingTeacher && (
          <div className="relative mb-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
              <Input
                value={searchTerm}
                onChange={e => handleSearchUsers(e.target.value)}
                placeholder="ค้นหาชื่อหรืออีเมลเพื่อดึงข้อมูลจากระบบ..."
                className="h-10 pl-9 pr-3 text-[11px] rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-200 transition-all"
              />
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white shadow-2xl rounded-2xl border border-black/5 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {searchResults.map(u => {
                  const isAlreadyTeacher = existingTeachers.some(t => t.email?.toLowerCase() === u.email?.toLowerCase());
                  return (
                    <button
                      key={u.id}
                      disabled={isAlreadyTeacher}
                      onClick={() => selectUser(u)}
                      className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left border-b border-black/5 last:border-0 ${isAlreadyTeacher ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-bold text-black/80">{u.name}</p>
                          {isAlreadyTeacher && (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[8px] font-bold uppercase tracking-wider">บันทึกแล้ว</span>
                          )}
                        </div>
                        <p className="text-[9px] text-black/40">{u.email} · {u.role}</p>
                      </div>
                      {isAlreadyTeacher ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center">
                          <UserCheck size={12} className="text-emerald-500" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center">
                          <UserPlus size={12} className="text-blue-500" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Duplicate Warning */}
        {duplicateTeacher && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
              <UserCheck size={16} className="text-amber-500" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-amber-900">บันทึกข้อมูลครูท่านนี้ไว้แล้ว</p>
              <p className="text-[9px] text-amber-700/70 mt-0.5">อีเมล {duplicateTeacher.email} มียูสเซอร์ที่ใช้งานในตำแหน่งครู/เจ้าหน้าที่อยู่แล้ว</p>
            </div>
          </motion.div>
        )}

        {/* Name Section - Stacked vertically */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-black/50 ml-1">คำนำหน้า <span className="text-red-400">*</span></Label>
            <Select value={prefix} onValueChange={setPrefix}>
              <SelectTrigger className="w-full h-10 text-[11px] rounded-xl bg-black/[0.03] border-transparent focus:ring-1 focus:ring-slate-300">
                <SelectValue placeholder="เลือกคำนำหน้า" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {prefixes.map(p => (
                  <SelectItem key={p} value={p} className="text-[11px]">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-black/50 ml-1">ชื่อ <span className="text-red-400">*</span></Label>
            <Input
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="กรอกชื่อ"
              className="h-10 text-[11px] rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/20"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-black/50 ml-1">นามสกุล <span className="text-red-400">*</span></Label>
            <Input
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="กรอกนามสกุล"
              className="h-10 text-[11px] rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/20"
            />
          </div>
        </div>

        {/* Contact Section - Stacked vertically */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-black/50 ml-1">เบอร์โทรศัพท์</Label>
            <Input
              value={form.phone ?? ''}
              onChange={e => set('phone', e.target.value)}
              placeholder="081-000-0000"
              className="h-10 text-[11px] rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-black/50 ml-1">อีเมลติดต่อ</Label>
            <Input
              value={form.email ?? ''}
              onChange={e => set('email', e.target.value)}
              type="email"
              placeholder="teacher@school.ac.th"
              className="h-10 text-[11px] rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300"
            />
          </div>
        </div>

        {/* Photo URL */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold text-black/50 ml-1">URL รูปถ่าย (ระบุลิงก์)</Label>
          <Input
            value={form.photoURL ?? ''}
            onChange={e => set('photoURL', e.target.value)}
            placeholder="https://example.com/photo.jpg"
            className="h-10 text-[11px] rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300"
          />
        </div>

        {/* Position Type */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold text-black/50 ml-1">ประเภทตำแหน่ง</Label>
          <div className="flex flex-col gap-2">
            <Select
              value={isOther ? 'อื่นๆ' : (form.position || 'ครูบรรจุ')}
              onValueChange={v => v === 'อื่นๆ' ? set('position', 'โปรดระบุ') : set('position', v)}
            >
              <SelectTrigger className="h-10 text-[11px] rounded-xl bg-black/[0.03] border-transparent focus:ring-1 focus:ring-slate-300 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {POSITIONS.map(p => (
                  <SelectItem key={p} value={p} className="text-[11px]">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Other position input */}
            {(isOther || form.position === 'โปรดระบุ') && (
              <Input
                value={form.position === 'โปรดระบุ' ? '' : form.position}
                onChange={e => set('position', e.target.value)}
                placeholder="ระบุชื่อตำแหน่งอื่นๆ..."
                className="h-10 text-[11px] rounded-xl bg-amber-50/40 border-amber-200/40 focus-visible:ring-1 focus-visible:ring-amber-300 animate-in fade-in slide-in-from-top-1"
              />
            )}
          </div>
        </div>

        {/* Department - Button Group Style (100% Match with AddSubjectModal) */}
        <div className="space-y-2">
          <Label className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">ระดับ/กลุ่มสาระ <span className="text-red-400">*</span></Label>
          <div className="flex">
            <ButtonGroup className="w-full bg-black/[0.03] rounded-xl p-0.5 border-black/5">
              {(Object.entries(DEPARTMENT_CONFIG) as [Department, typeof DEPARTMENT_CONFIG[Department]][]).map(([key, cfg], index, array) => {
                const isActive = form.department === key;
                return (
                  <React.Fragment key={key}>
                    <Button
                      type="button"
                      variant={isActive ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => set('department', key)}
                      className={`flex-1 h-8 text-[11px] font-bold rounded-lg px-4 ${isActive
                          ? 'bg-[#1e1e1e] text-white shadow-md'
                          : 'text-black/40 hover:text-black/60'
                        }`}
                    >
                      {cfg.label}
                    </Button>
                    {index < array.length - 1 && <ButtonGroupSeparator />}
                  </React.Fragment>
                );
              })}
            </ButtonGroup>
          </div>
        </div>
      </div>
    </FormModal>
  );
}
