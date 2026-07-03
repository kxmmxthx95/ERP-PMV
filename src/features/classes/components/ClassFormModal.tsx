import { useState, useEffect, useMemo } from 'react';
import { Search, Check, X } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import FormModal from '@/components/ui/FormModal';
import type { ClassRoom, NewClassRoom } from '@/types/class';
import type { Department } from '@/types/curriculum';

import type { TeacherProfile } from '@/types/teacher';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';
import { toast } from 'sonner';
import {
  buildHomeroomTeacherUpdate,
  isHomeroomTeacherSelected,
  MAX_HOMEROOM_TEACHERS,
  resolveHomeroomTeacherIds,
  resolveHomeroomTeachers,
  toggleHomeroomTeacherIds,
} from '@/features/classes/utils/homeroomTeachers';
import { cn } from '@/lib/utils';

interface ClassFormModalProps {
  open: boolean;
  editingClass?: ClassRoom | null;
  yearId: string;
  semester: 1 | 2;
  teachers: TeacherProfile[];
  onClose: () => void;
  onSubmit: (data: NewClassRoom) => void;
  onUpdate: (id: string, data: Partial<ClassRoom>) => void;
  onDelete: (id: string) => void;
}

const DEFAULT: NewClassRoom = {
  className: '',
  gradeLevel: '',
  roomNumber: '1',
  departmentId: 'secondary',
  department: 'secondary',
  academicYearId: '',
  semester: 1,
  homeroomTeacherId: '',
  homeroomTeacherIds: [],
  enrolledCourses: [],
  studentCount: 0,
  maxStudents: 40,
  track: '',
  trackColor: 'bg-slate-500 shadow-slate-500/40',
  room: '',
  note: '',
  isActive: true,
};

export default function ClassFormModal({
  open, editingClass, yearId, semester,
  teachers, onClose, onSubmit, onUpdate, onDelete,
}: ClassFormModalProps) {
  const { getGradesBySection } = useSchoolStructure();

  const [form, setForm] = useState<NewClassRoom>({ ...DEFAULT, academicYearId: yearId, semester });
  const [teacherSearch, setTeacherSearch] = useState('');
  const [showTeacherResults, setShowTeacherResults] = useState(false);

  const activeTeachers = useMemo(
    () => teachers.filter((t) => t.status === 'active'),
    [teachers],
  );

  const selectedHomeroomTeachers = useMemo(
    () => resolveHomeroomTeachers(form, activeTeachers),
    [form, activeTeachers],
  );

  useEffect(() => {
    if (!open) return;
    if (editingClass) {
      const { id: _id, createdAt: _ca, ...rest } = editingClass;
      const normalizedIds = resolveHomeroomTeacherIds(rest, activeTeachers);
      setForm({
        ...rest,
        homeroomTeacherIds: normalizedIds,
        homeroomTeacherId: normalizedIds[0] ?? '',
      });
    } else {
      setForm({ ...DEFAULT, academicYearId: yearId, semester });
    }
    setTeacherSearch('');
  }, [open, editingClass, yearId, semester, activeTeachers]);

  const set = <K extends keyof NewClassRoom>(k: K, v: NewClassRoom[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleDeptChange = (dept: Department) => {
    set('departmentId', dept);
    set('department', dept);
    const normalizedDept = dept === 'early' ? 'early-childhood' : dept;
    const grades = getGradesBySection(normalizedDept as any);
    set('gradeLevel', grades.length > 0 ? grades[0].shortLabel : '');
  };

  const filteredTeachers = activeTeachers.filter(t =>
    t.name.toLowerCase().includes(teacherSearch.toLowerCase())
  );

  const toggleTeacher = (teacher: TeacherProfile) => {
    const { nextIds, changed, atLimit } = toggleHomeroomTeacherIds(teacher, form, activeTeachers);
    if (atLimit) {
      toast.error(`กำหนดครูประจำชั้นได้สูงสุด ${MAX_HOMEROOM_TEACHERS} คน`);
      return;
    }
    if (!changed) return;
    setForm((prev) => ({
      ...prev,
      ...buildHomeroomTeacherUpdate(nextIds),
    }));
    setShowTeacherResults(false);
  };

  const removeTeacher = (teacherId: string) => {
    const nextIds = resolveHomeroomTeacherIds(form, activeTeachers).filter((id) => id !== teacherId);
    setForm((prev) => ({
      ...prev,
      ...buildHomeroomTeacherUpdate(nextIds),
    }));
  };

  const isValid = !!(form.academicYearId && form.gradeLevel && form.roomNumber.trim());
  const isEdit = !!editingClass;

  const handleSubmit = () => {
    if (!isValid) return;
    try {
      const generatedClassName = `${form.gradeLevel}/${form.roomNumber}`;
      const finalForm = {
        ...form,
        className: generatedClassName,
        ...buildHomeroomTeacherUpdate(resolveHomeroomTeacherIds(form, activeTeachers)),
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


      {/* 2. Department Selection */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">แผนก <span className="text-red-400">*</span></Label>
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
          {(['early', 'primary', 'secondary'] as Department[]).map(dept => {
            const isActive = form.departmentId === dept;
            const label = dept === 'early' ? 'ปฐมวัย' : dept === 'primary' ? 'ประถม' : 'มัธยม';
            return (
              <button
                key={dept}
                type="button"
                onClick={() => handleDeptChange(dept)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Academic Year */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ปีการศึกษา <span className="text-red-400">*</span></Label>
        <Input
          value={form.academicYearId}
          onChange={e => set('academicYearId', e.target.value)}
          placeholder="เช่น 2567"
          className="h-10 text-sm rounded-xl bg-slate-50 border-slate-200"
        />
      </div>

      {/* 3. Grade & Room */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ระดับชั้น <span className="text-red-400">*</span></Label>
          <Select value={form.gradeLevel} onValueChange={v => set('gradeLevel', v)}>
            <SelectTrigger className="h-10 text-sm rounded-xl bg-slate-50 border-slate-200">
              <SelectValue placeholder="เลือกชั้น..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {gradesForDept.map(g => (
                <SelectItem key={g.id} value={g.shortLabel} className="text-sm">{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ชื่อห้องเรียน (ทับ) <span className="text-red-400">*</span></Label>
          <Input
            value={form.roomNumber}
            onChange={e => set('roomNumber', e.target.value)}
            placeholder="เช่น 1 (สำหรับห้อง ม.4/1)"
            className="h-10 text-sm rounded-xl bg-slate-50 border-slate-200"
          />
        </div>
      </div>



      {/* 5. Track / Program */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">แผนการเรียน / ชื่อแผนก</Label>
        <Input
          value={form.track || ''}
          onChange={e => set('track', e.target.value)}
          placeholder="เช่น วิทย์-คณิต, ศิลป์-คำนวณ"
          className="h-10 text-sm rounded-xl bg-slate-50 border-slate-200"
        />
      </div>

      {/* 6. Homeroom Teachers */}
      <div className="space-y-1.5 relative">
        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          ครูประจำชั้น <span className="text-slate-400 font-medium normal-case">(สูงสุด {MAX_HOMEROOM_TEACHERS} คน)</span>
        </Label>

        {selectedHomeroomTeachers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedHomeroomTeachers.map((t) => (
              <div
                key={t.id}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700"
              >
                <span>{t.name}</span>
                <button
                  type="button"
                  onClick={() => removeTeacher(t.id)}
                  className="text-blue-400 hover:text-blue-700"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={teacherSearch}
            onChange={e => {
              setTeacherSearch(e.target.value);
              setShowTeacherResults(true);
            }}
            onFocus={() => setShowTeacherResults(true)}
            placeholder="ค้นหาชื่อครู..."
            className="h-10 pl-9 text-sm rounded-xl bg-slate-50 border-slate-200"
          />
        </div>

        {showTeacherResults && teacherSearch && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
            {filteredTeachers.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-400">ไม่พบรายชื่อครู</p>
            ) : (
              filteredTeachers.map(t => {
                const isSelected = isHomeroomTeacherSelected(t, form, activeTeachers);
                const atLimit = selectedHomeroomTeachers.length >= MAX_HOMEROOM_TEACHERS && !isSelected;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={atLimit}
                    onClick={() => toggleTeacher(t)}
                    className={cn(
                      'w-full px-4 py-2 text-left text-sm flex items-center justify-between',
                      atLimit ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-50',
                    )}
                  >
                    <span>{t.name}</span>
                    {isSelected && <Check size={14} className="text-blue-500" />}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">หมายเหตุ</Label>
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
