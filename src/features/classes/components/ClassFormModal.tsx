import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ClassRoom, NewClassRoom } from '@/types/class';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import type { TeacherProfile } from '@/types/teacher';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';

interface ClassFormModalProps {
  open:           boolean;
  editingClass?:  ClassRoom | null;
  yearId:         string;
  semester:       1 | 2;
  teachers:       TeacherProfile[];
  onClose:        () => void;
  onSubmit:       (data: NewClassRoom) => void;
  onUpdate:       (id: string, data: Partial<ClassRoom>) => void;
  onDelete:       (id: string) => void;
}

const DEFAULT: NewClassRoom = {
  className:          '',
  gradeLevel:         '',
  roomNumber:         '1',
  departmentId:       'secondary',
  academicYearId:     '',
  semester:           1,
  homeroomTeacherId:  '',
  studentCount:       0,
  maxStudents:        40,
  room:               '',
  note:               '',
  isActive:           true,
};

export default function ClassFormModal({
  open, editingClass, yearId, semester,
  teachers, onClose, onSubmit, onUpdate, onDelete,
}: ClassFormModalProps) {
  const { departments, getGradesBySection } = useSchoolStructure();
  
  const [form, setForm] = useState<NewClassRoom>({ ...DEFAULT, academicYearId: yearId, semester });

  useEffect(() => {
    if (!open) return;
    if (editingClass) {
      const { id: _id, createdAt: _ca, ...rest } = editingClass;
      setForm(rest);
    } else {
      setForm({ ...DEFAULT, academicYearId: yearId, semester });
    }
  }, [open, editingClass, yearId, semester]);

  const set = <K extends keyof NewClassRoom>(k: K, v: NewClassRoom[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleDeptChange = (dept: Department) => {
    set('departmentId', dept);
    // auto-select first grade of new dept
    const normalizedDept = dept === 'early' ? 'early-childhood' : dept;
    const grades = getGradesBySection(normalizedDept as any);
    set('gradeLevel', grades.length > 0 ? grades[0].id : '');
  };

  const isValid = form.gradeLevel && form.roomNumber.trim() && form.homeroomTeacherId;
  const isEdit  = !!editingClass;

  const handleSubmit = () => {
    if (!isValid) return;
    if (isEdit && editingClass) {
      onUpdate(editingClass.id, form);
    } else {
      onSubmit(form);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!editingClass) return;
    if (window.confirm(`ลบห้อง ${editingClass.className} หรือไม่?`)) {
      onDelete(editingClass.id);
      onClose();
    }
  };

  const normalizedDept = form.departmentId === 'early' ? 'early-childhood' : form.departmentId;
  const gradesForDept = getGradesBySection(normalizedDept as any);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-sm sm:max-w-[400px] rounded-3xl border-0 p-0 overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(32px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
        }}
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-black/05">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-black/80">
              {isEdit ? `แก้ไขห้อง ${editingClass?.className}` : 'สร้างห้องเรียนใหม่'}
            </DialogTitle>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-black/40 hover:bg-black/06 transition-colors">
              <X size={15} />
            </button>
          </div>
          <p className="text-xs text-black/40 mt-1">
            ปีการศึกษา {yearId} · ภาคเรียนที่ {semester}
          </p>
        </DialogHeader>

        <div className="px-5 py-4 space-y-3 max-h-[75vh] overflow-y-auto">
          {/* Department selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-black/60">ระดับ/แผนก <span className="text-red-400">*</span></Label>
            <div className="flex gap-2">
              {departments.map(d => {
                const deptValue = d.id === 'early-childhood' ? 'early' : d.id;
                const cfg = DEPARTMENT_CONFIG[deptValue as Department];
                const isActive = form.departmentId === deptValue;
                return (
                  <button
                    key={d.id}
                    onClick={() => handleDeptChange(deptValue as Department)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all border"
                    style={{
                      background: isActive ? cfg.bg : 'transparent',
                      color: isActive ? cfg.color : 'rgba(0,0,0,0.40)',
                      borderColor: isActive ? cfg.border : 'rgba(0,0,0,0.08)',
                    }}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grade + Room number */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-black/60">ระดับชั้น <span className="text-red-400">*</span></Label>
            <Select value={form.gradeLevel} onValueChange={v => set('gradeLevel', v)}>
              <SelectTrigger className="w-full h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus:ring-1 focus:ring-slate-300">
                <SelectValue placeholder="เลือกชั้น..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-52">
                {gradesForDept.map(g => (
                  <SelectItem key={g.id} value={g.id} className="text-xs">{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-black/60">เลขห้อง <span className="text-red-400">*</span></Label>
            <Input
              value={form.roomNumber}
              onChange={e => set('roomNumber', e.target.value)}
              placeholder="เช่น 1, 2, A"
              className="w-full h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300"
            />
          </div>

          {/* Preview */}
          {form.gradeLevel && form.roomNumber && (
            <div
              className="rounded-xl px-4 py-2.5 flex items-center gap-2"
              style={{ background: DEPARTMENT_CONFIG[form.departmentId].bg }}
            >
              <span className="text-xs font-bold" style={{ color: DEPARTMENT_CONFIG[form.departmentId].color }}>
                ชื่อห้อง:
              </span>
              <span className="text-sm font-bold text-black/70">
                {form.gradeLevel}/{form.roomNumber}
              </span>
            </div>
          )}

          {/* Homeroom teacher */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-black/60">ครูประจำชั้น <span className="text-red-400">*</span></Label>
            <Select value={form.homeroomTeacherId} onValueChange={v => set('homeroomTeacherId', v)}>
              <SelectTrigger className="w-full h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus:ring-1 focus:ring-slate-300">
                <SelectValue placeholder="เลือกครูประจำชั้น..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-52">
                {teachers
                  .filter(t => t.department === form.departmentId || true) // show all, filter by dept optionally
                  .map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                      <span className="ml-1.5 text-black/35 text-[10px]">{t.position}</span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Student count + capacity */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-black/60">จำนวนนักเรียน</Label>
            <Input
              type="number" min={0} max={100}
              value={form.studentCount}
              onChange={e => set('studentCount', Number(e.target.value))}
              className="w-full h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300"
            />
          </div>

          {/* Room location */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-black/60">ที่ตั้งห้องเรียน</Label>
            <Input
              value={form.room ?? ''}
              onChange={e => set('room', e.target.value)}
              placeholder="เช่น อาคาร 2 ห้อง 301"
              className="w-full h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/25"
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-black/60">หมายเหตุ</Label>
            <Textarea
              value={form.note ?? ''}
              onChange={e => set('note', e.target.value)}
              placeholder="หมายเหตุเพิ่มเติม..."
              rows={2}
              className="w-full text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 placeholder:text-black/25 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2 flex items-center justify-between gap-2 border-t border-black/[0.04]">
          <div>
            {isEdit && (
              <Button
                variant="ghost" size="sm" onClick={handleDelete}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs h-8 rounded-lg"
              >
                ลบห้อง
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}
              className="text-xs h-8 rounded-lg border-black/10">
              ยกเลิก
            </Button>
            <Button
              size="sm" onClick={handleSubmit} disabled={!isValid}
              className="text-xs h-8 rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white disabled:opacity-40"
            >
              {isEdit ? 'บันทึก' : 'สร้างห้องเรียน'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
