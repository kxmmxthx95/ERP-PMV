import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { TeacherProfile, NewTeacherProfile } from '@/types/teacher';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';

interface AddTeacherModalProps {
  open: boolean;
  editingTeacher?: TeacherProfile | null;
  onClose: () => void;
  onSubmit: (data: NewTeacherProfile) => void;
  onUpdate?: (id: string, data: NewTeacherProfile) => void;
  onDelete?: (id: string) => void;
}

const POSITIONS = [
  'ครู',
  'ครูชำนาญการ',
  'ครูชำนาญการพิเศษ',
  'ครูเชี่ยวชาญ',
  'ครูเชี่ยวชาญพิเศษ',
];

const DEFAULT_FORM: NewTeacherProfile = {
  name: '',
  nameEn: '',
  employeeCode: '',
  email: '',
  phone: '',
  department: 'primary',
  position: 'ครู',
  teachingSubjectIds: [],
  maxHoursPerWeek: 18,
  status: 'active',
};

export default function AddTeacherModal({
  open,
  editingTeacher,
  onClose,
  onSubmit,
  onUpdate,
  onDelete,
}: AddTeacherModalProps) {
  const [form, setForm] = useState<NewTeacherProfile>(DEFAULT_FORM);

  useEffect(() => {
    if (open) {
      if (editingTeacher) {
        const { id: _id, createdAt: _ca, ...rest } = editingTeacher;
        setForm(rest);
      } else {
        setForm(DEFAULT_FORM);
      }
    }
  }, [open, editingTeacher]);

  const set = <K extends keyof NewTeacherProfile>(key: K, value: NewTeacherProfile[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const isValid = form.name.trim() && form.employeeCode.trim() && form.department;

  const handleSubmit = () => {
    if (!isValid) return;
    if (editingTeacher && onUpdate) {
      onUpdate(editingTeacher.id, form);
    } else {
      onSubmit(form);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-lg rounded-3xl border-0 p-0 overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(32px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-black/5">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-black/80">
              {editingTeacher ? 'แก้ไขข้อมูลครู' : 'เพิ่มครูใหม่'}
            </DialogTitle>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-black/40 hover:bg-black/06 hover:text-black/60 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-black/60">ชื่อ–นามสกุล <span className="text-red-400">*</span></Label>
              <Input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="ครูสมหมาย ..."
                className="h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/25"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-black/60">ชื่อภาษาอังกฤษ</Label>
              <Input
                value={form.nameEn ?? ''}
                onChange={e => set('nameEn', e.target.value)}
                placeholder="Sommai ..."
                className="h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/25"
              />
            </div>
          </div>

          {/* Code + Position row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-black/60">รหัสครู <span className="text-red-400">*</span></Label>
              <Input
                value={form.employeeCode}
                onChange={e => set('employeeCode', e.target.value)}
                placeholder="T001"
                className="h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/25 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-black/60">ตำแหน่ง</Label>
              <Select value={form.position ?? 'ครู'} onValueChange={v => set('position', v)}>
                <SelectTrigger className="h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus:ring-1 focus:ring-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {POSITIONS.map(p => (
                    <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-black/60">ระดับ/กลุ่มสาระ <span className="text-red-400">*</span></Label>
            <div className="flex gap-2">
              {(Object.entries(DEPARTMENT_CONFIG) as [Department, typeof DEPARTMENT_CONFIG[Department]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => set('department', key)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all border"
                  style={{
                    background: form.department === key ? cfg.bg : 'transparent',
                    color: form.department === key ? cfg.color : 'rgba(0,0,0,0.40)',
                    borderColor: form.department === key ? cfg.border : 'rgba(0,0,0,0.08)',
                  }}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-black/60">อีเมล</Label>
              <Input
                value={form.email ?? ''}
                onChange={e => set('email', e.target.value)}
                type="email"
                placeholder="teacher@school.ac.th"
                className="h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/25"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-black/60">เบอร์โทร</Label>
              <Input
                value={form.phone ?? ''}
                onChange={e => set('phone', e.target.value)}
                placeholder="081-000-0000"
                className="h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/25"
              />
            </div>
          </div>

          {/* Max hours */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-black/60">
              ภาระงานสอนสูงสุด
              <span className="font-normal text-black/35 ml-1">(คาบ/สัปดาห์)</span>
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={40}
                value={form.maxHoursPerWeek}
                onChange={e => set('maxHoursPerWeek', Number(e.target.value))}
                className="h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 w-24"
              />
              <span className="text-xs text-black/40">คาบ (ประมาณ {Math.round(form.maxHoursPerWeek * 50 / 60)} ชั่วโมง)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex items-center justify-between gap-2 border-t border-black/5">
          <div>
            {editingTeacher && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { onDelete(editingTeacher.id); onClose(); }}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs h-8 rounded-lg"
              >
                ลบครู
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs h-8 rounded-lg border-black/10"
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!isValid}
              className="text-xs h-8 rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white disabled:opacity-40"
            >
              {editingTeacher ? 'บันทึก' : 'เพิ่มครู'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
