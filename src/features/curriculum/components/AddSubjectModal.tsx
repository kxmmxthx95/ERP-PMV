import React, { useEffect, useState, useMemo } from 'react';
import { BookPlus, Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  DEPARTMENT_CONFIG, CATEGORY_CONFIG, SUBJECT_GROUP_CONFIG,
  type Subject, type Department, type SubjectCategory, type SubjectGroupId,
} from '@/types/curriculum';
import type { NewSubject } from '@/hooks/useCurriculum';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import FormModal from '@/components/ui/FormModal';

const CATEGORIES: SubjectCategory[] = ['core', 'added', 'elective', 'activity'];

const schema = z.object({
  code: z.string().trim()
    .min(1, 'กรุณากรอกรหัสวิชา')
    .max(20, 'รหัสวิชาต้องไม่เกิน 20 ตัวอักษร'),
  name: z.string().trim()
    .min(2, 'ชื่อวิชาต้องมีอย่างน้อย 2 ตัวอักษร'),
  credits: z.number({ message: 'กรุณากรอกหน่วยกิต' }).min(0, 'หน่วยกิตต้องไม่ติดลบ'),
  hoursPerWeek: z.number({ message: 'กรุณากรอกชั่วโมง/สัปดาห์' }).min(0.5, 'ต้องมีอย่างน้อย 0.5 ชั่วโมง/สัปดาห์'),
  totalHours: z.number({ message: 'กรุณากรอกรวมชั่วโมง' }).min(0, 'ต้องไม่ติดลบ'),
  department: z.enum(['early', 'primary', 'secondary'] as const, {
    message: 'กรุณาเลือกแผนก',
  }),
  gradeLevel: z.string().min(1, 'กรุณาเลือกระดับชั้น'),
  subjectGroup: z.string().min(1, 'กรุณาเลือกกลุ่มสาระ'),
  category: z.enum(['core', 'added', 'elective', 'activity'] as const, {
    message: 'กรุณาเลือกหมวดวิชา',
  }),
});

type FormValues = z.infer<typeof schema>;

interface AddSubjectModalProps {
  open: boolean;
  defaultDepartment: Department;
  defaultGrade?: string;
  defaultSubjectGroup?: string;
  defaultCategory?: SubjectCategory;
  subjectToEdit?: Subject;
  existingSubjects?: Subject[];
  onClose: () => void;
  onSubmit: (data: NewSubject) => void;
  onUpdate: (id: string, data: NewSubject) => void;
  onDelete: (id: string) => void;
}

export default function AddSubjectModal({
  open,
  defaultDepartment,
  defaultGrade = '',
  defaultSubjectGroup = '',
  defaultCategory = 'core',
  subjectToEdit,
  existingSubjects = [],
  onClose,
  onSubmit,
  onUpdate,
  onDelete,
}: AddSubjectModalProps) {
  const isEditMode = !!subjectToEdit;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '', name: '', credits: undefined as any, hoursPerWeek: undefined as any, totalHours: undefined as any,
      gradeLevel: '', department: 'primary', subjectGroup: '', category: 'core',
    },
  });

  const [, setIsInitialLoading] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      form.reset({
        code: subjectToEdit.code,
        name: subjectToEdit.name,
        credits: subjectToEdit.credits,
        hoursPerWeek: subjectToEdit.hoursPerWeek,
        totalHours: (subjectToEdit as any).totalHours ?? 40,
        gradeLevel: subjectToEdit.gradeLevel || '',
        department: subjectToEdit.department || 'primary',
        category: subjectToEdit.category || 'core',
      });
    } else {
      form.reset({
        code: '',
        name: '',
        credits: undefined as any,
        hoursPerWeek: undefined as any,
        totalHours: undefined as any,
        gradeLevel: defaultGrade,
        department: defaultDepartment,
        subjectGroup: defaultSubjectGroup,
        category: defaultCategory,
      });
    }

    if (open) {
      setIsInitialLoading(true);
      const timer = setTimeout(() => setIsInitialLoading(false), 400);
      return () => clearTimeout(timer);
    }
  }, [subjectToEdit?.id, open, isEditMode, form, defaultDepartment, defaultGrade, defaultSubjectGroup, defaultCategory]);


  // ── normalize gradeLevel ──────────────────────────
  const normalizeGradeLevel = (raw: string): string => {
    if (!raw) return '';
    const s = raw.trim();
    const map: Record<string, string> = {
      'เตรียมอนุบาล': 'pre-k', 'อนุบาล 1': 'k1', 'อนุบาล 2': 'k2', 'อนุบาล 3': 'k3',
      'ป.1': 'p1', 'ป.2': 'p2', 'ป.3': 'p3', 'ป.4': 'p4', 'ป.5': 'p5', 'ป.6': 'p6',
      'ม.1': 'm1', 'ม.2': 'm2', 'ม.3': 'm3', 'ม.4': 'm4', 'ม.5': 'm5', 'ม.6': 'm6',
    };
    return map[s] ?? s;
  };

  // ดึงระดับชั้นตามแผนกที่เลือก
  const selectedDept = form.watch('department');
  const grades = useMemo(() => {
    const config = DEPARTMENT_CONFIG[selectedDept];
    if (!config) return [];
    return config.grades.map(g => ({ id: normalizeGradeLevel(g), label: g }));
  }, [selectedDept]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const onFormSubmit = async (values: FormValues) => {
    const newCode = values.code.trim().toUpperCase();
    const duplicate = existingSubjects.find(
      s => s.code.toUpperCase() === newCode && s.id !== subjectToEdit?.id
    );
    if (duplicate) {
      form.setError('code', { message: `รหัสวิชา "${newCode}" มีอยู่แล้ว (${duplicate.name})` });
      return;
    }

    setIsSubmitting(true);
    try {
      const data: NewSubject = {
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        credits: values.credits,
        hoursPerWeek: values.hoursPerWeek,
        totalHours: values.totalHours,
        department: values.department,
        gradeLevel: values.gradeLevel,
        subjectGroup: values.subjectGroup as SubjectGroupId,
        category: values.category,
      };

      if (isEditMode && subjectToEdit) {
        await onUpdate(subjectToEdit.id, data);
      } else {
        await onSubmit(data);
      }
      onClose();
    } catch (error) {
      console.error('Submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEditMode ? 'แก้ไขข้อมูลวิชา' : 'เพิ่มรายวิชาใหม่'}
      subtitle={isEditMode ? `แก้ไขรายละเอียดวิชา ${subjectToEdit?.code}` : 'กรอกข้อมูลพื้นฐานเพื่อเพิ่มวิชาในคลังหลักสูตร'}
      icon={isEditMode ? <Pencil size={18} /> : <BookPlus size={18} />}
      onSubmit={form.handleSubmit(onFormSubmit)}
      submitLabel={isSubmitting ? 'กำลังบันทึก...' : (isEditMode ? 'บันทึกการแก้ไข' : 'บันทึก')}
      submitDisabled={isSubmitting}
      onDelete={isEditMode ? () => onDelete(subjectToEdit!.id) : undefined}
      deleteLabel="ลบวิชานี้"
    >
      <Form {...form}>
        <div className="space-y-4 py-2">
          {/* รหัสวิชาไทย */}
          <FormField control={form.control} name="code" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">
                รหัสวิชา <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl><Input placeholder="กรุณากรอกรหัสวิชา" {...field} className="uppercase h-10 rounded-xl bg-black/[0.03] border-transparent focus:ring-slate-300 transition-all font-medium" /></FormControl>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />

          {/* ชื่อวิชาไทย */}
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">
                ชื่อรายวิชา <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl><Input placeholder="กรุณากรอกชื่อวิชา" {...field} className="h-10 rounded-xl bg-black/[0.03] border-transparent focus:ring-slate-300 transition-all font-medium" /></FormControl>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />

          {/* กลุ่มสาระการเรียนรู้ (ย้ายมาไว้หลังชื่อ EN) */}
          <FormField control={form.control} name="subjectGroup" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">
                กลุ่มสาระการเรียนรู้ <span className="text-red-500">*</span>
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full h-10 rounded-xl bg-black/[0.03] border-transparent transition-all">
                    <SelectValue placeholder="เลือกกลุ่มสาระ" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="rounded-xl border-white/50 backdrop-blur-xl">
                  {Object.entries(SUBJECT_GROUP_CONFIG).map(([id, g]) => (
                    <SelectItem key={id} value={id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />

          {/* หน่วยกิต / ชั่วโมง / รวมชม. (บรรทัดเดียว) */}
          <div className="grid grid-cols-3 gap-3">
            <FormField control={form.control} name="credits" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">
                  หน่วยกิต <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl><Input type="number" step="0.5" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} className="h-10 rounded-xl bg-black/[0.03] border-transparent" /></FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />
            <FormField control={form.control} name="hoursPerWeek" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">
                  ชม./สัปดาห์ <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} className="h-10 rounded-xl bg-black/[0.03] border-transparent" /></FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />
            <FormField control={form.control} name="totalHours" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">
                  รวม ชม. <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} className="h-10 rounded-xl bg-black/[0.03] border-transparent" /></FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />
          </div>

          {/* แผนกโรงเรียน (โชว์ก่อนระดับชั้น) */}
          <FormField control={form.control} name="department" render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">
                แผนกโรงเรียน <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <div className="flex">
                  <ButtonGroup className="w-full bg-black/[0.03] rounded-xl p-0.5 border-black/5">
                    <Button
                      type="button"
                      variant={field.value === 'early' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => {
                        field.onChange('early');
                        // รีเซ็ตเกรดเมื่อเปลี่ยนแผนก
                        form.setValue('gradeLevel', '');
                      }}
                      className={`flex-1 h-8 text-[11px] font-bold rounded-lg px-4 ${field.value === 'early' ? 'bg-[#1e1e1e] text-white shadow-md' : 'text-black/40 hover:text-black/60'}`}
                    >
                      ปฐมวัย
                    </Button>
                    <ButtonGroupSeparator />
                    <Button
                      type="button"
                      variant={field.value === 'primary' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => {
                        field.onChange('primary');
                        form.setValue('gradeLevel', '');
                      }}
                      className={`flex-1 h-8 text-[11px] font-bold rounded-lg px-4 ${field.value === 'primary' ? 'bg-[#1e1e1e] text-white shadow-md' : 'text-black/40 hover:text-black/60'}`}
                    >
                      ประถม
                    </Button>
                    <ButtonGroupSeparator />
                    <Button
                      type="button"
                      variant={field.value === 'secondary' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => {
                        field.onChange('secondary');
                        form.setValue('gradeLevel', '');
                      }}
                      className={`flex-1 h-8 text-[11px] font-bold rounded-lg px-4 ${field.value === 'secondary' ? 'bg-[#1e1e1e] text-white shadow-md' : 'text-black/40 hover:text-black/60'}`}
                    >
                      มัธยม
                    </Button>
                  </ButtonGroup>
                </div>
              </FormControl>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />

          {/* ระดับชั้น (ButtonGroup based on selected department) */}
          <FormField control={form.control} name="gradeLevel" render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">
                ระดับชั้นเรียน <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-2">
                  <ButtonGroup className="w-full bg-black/[0.03] rounded-xl p-0.5 border-black/5 flex-wrap">
                    {grades.map((g, idx) => (
                      <React.Fragment key={g.id}>
                        {idx > 0 && <ButtonGroupSeparator />}
                        <Button
                          type="button"
                          variant={field.value === g.id ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => field.onChange(g.id)}
                          className={`flex-1 min-w-[50px] h-8 text-[11px] font-bold rounded-lg px-3 ${field.value === g.id ? 'bg-[#1e1e1e] text-white shadow-md' : 'text-black/40 hover:text-black/60'}`}
                        >
                          {g.label}
                        </Button>
                      </React.Fragment>
                    ))}
                  </ButtonGroup>
                </div>
              </FormControl>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />

          {/* หมวดวิชา (ButtonGroup) */}
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">
                หมวดวิชา <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-2">
                  <ButtonGroup className="w-full bg-black/[0.03] rounded-xl p-0.5 border-black/5 flex-wrap">
                    {CATEGORIES.map((cat, idx) => {
                      const cfg = CATEGORY_CONFIG[cat];
                      return (
                        <React.Fragment key={cat}>
                          {idx > 0 && <ButtonGroupSeparator />}
                          <Button
                            type="button"
                            variant={field.value === cat ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => field.onChange(cat)}
                            className={`flex-1 h-8 text-[11px] font-bold rounded-lg px-3 ${field.value === cat ? 'bg-[#1e1e1e] text-white shadow-md' : 'text-black/40 hover:text-black/60'}`}
                          >
                            {cfg.label}
                          </Button>
                        </React.Fragment>
                      );
                    })}
                  </ButtonGroup>
                </div>
              </FormControl>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />
        </div>
      </Form>
    </FormModal>
  );
}
