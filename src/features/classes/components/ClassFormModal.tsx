import { useState, useEffect } from 'react';
import { Search, Check } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import FormModal from '@/components/ui/FormModal';
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
  const [teacherSearch, setTeacherSearch] = useState('');
  const [showTeacherResults, setShowTeacherResults] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingClass) {
      const { id: _id, createdAt: _ca, ...rest } = editingClass;
      setForm(rest);
      const teacher = teachers.find(t => t.id === rest.homeroomTeacherId);
      setTeacherSearch(teacher?.name || '');
    } else {
      setForm({ ...DEFAULT, academicYearId: yearId, semester });
      setTeacherSearch('');
    }
  }, [open, editingClass, yearId, semester, teachers]);

  const set = <K extends keyof NewClassRoom>(k: K, v: NewClassRoom[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleDeptChange = (dept: Department) => {
    set('departmentId', dept);
    const normalizedDept = dept === 'early' ? 'early-childhood' : dept;
    const grades = getGradesBySection(normalizedDept as any);
    set('gradeLevel', grades.length > 0 ? grades[0].shortLabel : '');
  };

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(teacherSearch.toLowerCase()) ||
    t.employeeCode?.toLowerCase().includes(teacherSearch.toLowerCase())
  );


  const selectTeacher = (t: TeacherProfile) => {
    set('homeroomTeacherId', t.id);
    setTeacherSearch(t.name);
    setShowTeacherResults(false);
  };

  const isValid = form.gradeLevel && form.roomNumber.trim() && form.homeroomTeacherId;
  const isEdit  = !!editingClass;

  const handleSubmit = () => {
    if (!isValid) return;
    try {
      const generatedClassName = `${form.gradeLevel}/${form.roomNumber}`;
      const finalForm = { 
        ...form, 
        className: generatedClassName 
      };

      if (isEdit && editingClass) {
        onUpdate(editingClass.id, finalForm);
      } else {
        onSubmit(finalForm);
      }
      onClose();
    } catch (err) {
      console.error(err);
    }
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
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? `แก้ไขห้อง ${editingClass?.className}` : 'สร้างห้องเรียนใหม่'}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'บันทึก' : 'สร้างห้องเรียน'}
      submitDisabled={!isValid}
      onDelete={isEdit ? handleDelete : undefined}
      deleteLabel="ลบห้อง"
      maxWidth="sm"
    >
      {/* Department selector */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold text-black/40 ml-1 uppercase tracking-wider">ระดับ/แผนก <span className="text-red-400">*</span></Label>
        <div className="flex h-9 bg-black/5 p-0.5 rounded-xl border border-black/5">
          {departments.map(d => {
            const deptValue = d.id === 'early-childhood' ? 'early' : d.id;
            const cfg = DEPARTMENT_CONFIG[deptValue as Department];
            const isActive = form.departmentId === deptValue;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => handleDeptChange(deptValue as Department)}
                className={`flex-1 rounded-lg text-[11px] font-bold transition-all ${
                  isActive 
                    ? 'bg-[#1e1e1e] text-white shadow-md' 
                    : 'text-black/40 hover:text-black/60 hover:bg-black/5'
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grade */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold text-black/50 ml-1 uppercase tracking-wider">ระดับชั้น <span className="text-red-400">*</span></Label>
        <Select value={form.gradeLevel} onValueChange={v => set('gradeLevel', v)}>
          <SelectTrigger className="w-full h-9 text-[11px] rounded-xl bg-black/[0.03] border-transparent focus:ring-1 focus:ring-slate-300">
            <SelectValue placeholder="เลือกชั้น..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl max-h-52">
            {gradesForDept.map(g => (
              <SelectItem key={g.id} value={g.shortLabel} className="text-[11px]">{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Room number */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold text-black/50 ml-1 uppercase tracking-wider">เลขห้อง <span className="text-red-400">*</span></Label>
        <Input
          value={form.roomNumber}
          onChange={e => set('roomNumber', e.target.value)}
          placeholder="เช่น 1, 2"
          className="h-9 text-[11px] rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300"
        />
      </div>

      {/* Searchable Homeroom teacher */}
      <div className="space-y-1.5 relative">
        <Label className="text-[11px] font-semibold text-black/50 ml-1 uppercase tracking-wider">ครูประจำชั้น <span className="text-red-400">*</span></Label>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
          <Input
            value={teacherSearch}
            onChange={e => {
              setTeacherSearch(e.target.value);
              setShowTeacherResults(true);
              if (!e.target.value) set('homeroomTeacherId', '');
            }}
            onFocus={() => setShowTeacherResults(true)}
            placeholder="ค้นหาชื่อครู..."
            className="h-8 pl-8 pr-3 text-[11px] rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300"
          />
        </div>

        {showTeacherResults && teacherSearch && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white/98 backdrop-blur-xl border border-black/5 rounded-2xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-black/5 custom-scrollbar">
            {filteredTeachers.length > 0 ? (
              filteredTeachers.map(t => (
                <button
                  key={t.id}
                  onClick={() => selectTeacher(t)}
                  className="w-full px-4 py-2 text-left hover:bg-black/5 transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="text-[11px] font-bold text-black/80">{t.name}</p>
                    <p className="text-[9px] text-black/40">{t.position || 'ครูผู้สอน'}</p>
                  </div>
                  {form.homeroomTeacherId === t.id && <Check size={12} className="text-emerald-500" />}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-[10px] text-center text-black/30">ไม่พบรายชื่อครู</div>
            )}
          </div>
        )}
        {/* Click outside to close (Overlay) */}
        {showTeacherResults && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowTeacherResults(false)}
          />
        )}
      </div>

      {/* Room location */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold text-black/50 ml-1 uppercase tracking-wider">ที่ตั้งห้องเรียน</Label>
        <Input
          value={form.room ?? ''}
          onChange={e => set('room', e.target.value)}
          placeholder="เช่น อาคาร 2 ชั้น 3 ห้อง 301"
          className="h-8 text-[11px] rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300"
        />
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold text-black/50 ml-1 uppercase tracking-wider">หมายเหตุ</Label>
        <Textarea
          value={form.note ?? ''}
          onChange={e => set('note', e.target.value)}
          placeholder="ระบุรายละเอียดเพิ่มเติม..."
          rows={2}
          className="text-[11px] rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 resize-none p-2.5"
        />
      </div>
    </FormModal>
  );
}
