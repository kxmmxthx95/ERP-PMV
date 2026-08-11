import { useEffect, useState, Fragment } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { HiBookOpen, HiPencil } from 'react-icons/hi2';
import { Input } from '@/components/ui/input';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import FormModal from '@/components/ui/FormModal';
import {
  COURSE_CATEGORY_CONFIG, SUBJECT_GROUP_CONFIG, DEPARTMENT_CONFIG,
  gradingSchemeLabel,
  type CourseCategory, type CurriculumCourse, type NewCurriculumCourse,
} from '@/types/curriculum';

const schema = z.object({
  courseCode: z.string().trim().min(1, 'กรุณากรอกรหัสวิชา').max(20),
  courseName: z.string().trim().min(2, 'ชื่อวิชาต้องมีอย่างน้อย 2 ตัวอักษร'),
  credit: z.number({ message: 'กรุณากรอกหน่วยกิต' }).min(0),
  periodsPerWeek: z.number().min(0).optional().or(z.literal('')),
  totalHours: z.number().min(0).optional().or(z.literal('')),
  category: z.enum(['basic', 'additional', 'activity'] as const),
  department: z.enum(['early', 'primary', 'secondary'] as const),
  subjectGroup: z.string().min(1, 'กรุณาเลือกกลุ่มสาระ'),
  gradeLevel: z.string().optional().or(z.literal('')),
  semester: z.number().min(1).max(2).optional().or(z.literal('')),
  academicYear: z.number().min(2500).max(2600).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

interface AddCourseModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: NewCurriculumCourse) => Promise<void>;
  onUpdate?: (id: string, data: Partial<CurriculumCourse>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  courseToEdit?: CurriculumCourse | null;
  existingCodes?: string[];
}

const CATEGORIES: CourseCategory[] = ['basic', 'additional', 'activity'];

export default function AddCourseModal({
  open,
  onClose,
  onSubmit,
  onUpdate,
  onDelete,
  courseToEdit,
  existingCodes = [],
}: AddCourseModalProps) {
  const isEdit = !!courseToEdit;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      courseCode: '', courseName: '', credit: undefined as any,
      periodsPerWeek: undefined as any, totalHours: undefined as any,
      category: 'basic', department: 'primary', subjectGroup: '', gradeLevel: '',
      semester: 1,
      academicYear: new Date().getFullYear() + 543,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && courseToEdit) {
      form.reset({
        courseCode: courseToEdit.courseCode,
        courseName: courseToEdit.courseName,
        credit: courseToEdit.credit,
        periodsPerWeek: courseToEdit.periodsPerWeek,
        totalHours: courseToEdit.totalHours,
        category: courseToEdit.category,
        department: (courseToEdit.department as any) || 'primary',
        subjectGroup: courseToEdit.subjectGroup ?? '',
        gradeLevel: courseToEdit.gradeLevel ?? '',
        semester: courseToEdit.semester ?? 1,
        academicYear: courseToEdit.academicYear ?? (new Date().getFullYear() + 543),
      });
    } else {
      form.reset({
        courseCode: '', courseName: '', credit: undefined as any,
        periodsPerWeek: undefined as any, totalHours: undefined as any,
        category: 'basic', department: 'primary', subjectGroup: '', gradeLevel: '',
        semester: 1,
        academicYear: new Date().getFullYear() + 543,
      });
    }
  }, [open, isEdit, courseToEdit, form]);

  const handleSubmit = async (values: FormValues) => {
    const code = values.courseCode.trim().toUpperCase();
    const isDupe = existingCodes
      .filter(c => c !== courseToEdit?.courseCode)
      .includes(code);
    if (isDupe) {
      form.setError('courseCode', { message: `รหัสวิชา "${code}" มีอยู่แล้ว` });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...values,
        courseCode: code,
        periodsPerWeek: (values.periodsPerWeek === '' || values.periodsPerWeek === undefined) ? null : Number(values.periodsPerWeek),
        totalHours: (values.totalHours === '' || values.totalHours === undefined) ? null : Number(values.totalHours),
        semester: (values.semester === '' || values.semester === undefined) ? null : Number(values.semester),
        academicYear: (values.academicYear === '' || values.academicYear === undefined) ? null : Number(values.academicYear),
        subjectGroup: values.subjectGroup,
        gradeLevel: values.gradeLevel || '',
      };

      if (isEdit && courseToEdit && onUpdate) {
        await onUpdate(courseToEdit.id, payload as any);
      } else {
        await onSubmit(payload as any);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'แก้ไขรายวิชา' : 'เพิ่มรายวิชาใหม่'}
      subtitle={isEdit ? `แก้ไขรายละเอียดวิชา ${courseToEdit?.courseCode}` : 'กรอกข้อมูลพื้นฐานเพื่อเพิ่มวิชาในหลักสูตร'}
      icon={isEdit ? <HiPencil size={18} /> : <HiBookOpen size={18} />}
      onSubmit={form.handleSubmit(handleSubmit)}
      submitLabel={isSubmitting ? 'กำลังบันทึก...' : (isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มวิชา')}
      submitDisabled={isSubmitting}
      onDelete={isEdit && onDelete ? () => onDelete(courseToEdit!.id) : undefined}
      deleteLabel="ยกเลิกการใช้งานวิชานี้ (Retire)"
      maxWidth="sm"
    >
      <Form {...form}>
        <div className="space-y-4 py-2">
          {/* ปีการศึกษา (ย้ายมาไว้บนสุด) */}
          <FormField control={form.control} name="academicYear" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                ปีที่ต้องเรียน (พ.ศ.)
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="เช่น 2568"
                  className="h-10 rounded-3xl text-xs font-medium font-sarabun focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none"
                  style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(147,197,253,0.4)' }}
                  value={field.value ?? ''}
                  onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </FormControl>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />

          {/* รหัสวิชา */}
          <FormField control={form.control} name="courseCode" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                รหัสวิชา <span className="text-rose-400">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="เช่น ท11101"
                  className="h-10 rounded-3xl text-xs font-medium font-sarabun focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none uppercase"
                  style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(147,197,253,0.4)' }}
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />

          {/* ชื่อวิชา */}
          <FormField control={form.control} name="courseName" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                ชื่อรายวิชา <span className="text-rose-400">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="เช่น ภาษาไทย"
                  className="h-10 rounded-3xl text-xs font-medium font-sarabun focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none"
                  style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(147,197,253,0.4)' }}
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />

          {/* หน่วยกิต / จำนวนคาบ / ชั่วโมงเต็ม */}
          <div className="grid grid-cols-3 gap-3">
            <FormField control={form.control} name="credit" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                  หน่วยกิต <span className="text-rose-400">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number" step="0.5"
                    className="h-10 rounded-3xl text-xs font-medium font-sarabun focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none"
                    style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(147,197,253,0.4)' }}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <FormField control={form.control} name="periodsPerWeek" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                  จำนวน/สัปดาห์
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="คาบ"
                    className="h-10 rounded-3xl text-xs font-medium font-sarabun focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none"
                    style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(147,197,253,0.4)' }}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <FormField control={form.control} name="totalHours" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                  ชั่วโมงเต็ม
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="ชม."
                    className="h-10 rounded-3xl text-xs font-medium font-sarabun focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none"
                    style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(147,197,253,0.4)' }}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />
          </div>

          {/* กลุ่มสาระ */}
          <FormField control={form.control} name="subjectGroup" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                กลุ่มสาระการเรียนรู้ <span className="text-rose-400">*</span>
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger
                    className="w-full h-10 rounded-3xl text-xs font-sarabun border focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none"
                    style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(147,197,253,0.4)' }}
                  >
                    <SelectValue placeholder="เลือกกลุ่มสาระ" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="rounded-2xl">
                  {Object.entries(SUBJECT_GROUP_CONFIG).map(([id, g]) => (
                    <SelectItem key={id} value={id} className="text-xs font-sarabun">{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />

          {/* แผนก */}
          <FormField control={form.control} name="department" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                แผนก <span className="text-rose-400">*</span>
              </FormLabel>
              <FormControl>
                <ButtonGroup className="w-full bg-black/[0.03] rounded-2xl p-0.5 border-black/5">
                  {(['early', 'primary', 'secondary'] as const).map((d, idx) => (
                    <Fragment key={d}>
                      {idx > 0 && <ButtonGroupSeparator />}
                      <Button
                        type="button"
                        variant={field.value === d ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          field.onChange(d);
                          // Reset grade level when department changes
                          form.setValue('gradeLevel', '');
                        }}
                        className={`flex-1 h-8 text-[11px] font-bold rounded-xl font-sukhumvit ${field.value === d ? 'bg-blue-600 text-white shadow-md' : 'text-black/40'}`}
                      >
                        {DEPARTMENT_CONFIG[d].label}
                      </Button>
                    </Fragment>
                  ))}
                </ButtonGroup>
              </FormControl>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />

          {/* ระดับชั้น */}
          <FormField control={form.control} name="gradeLevel" render={({ field }) => {
            const dept = form.watch('department');
            const grades = DEPARTMENT_CONFIG[dept]?.grades || [];
            
            return (
              <FormItem>
                <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                  ระดับชั้น (ถ้าระบุ)
                </FormLabel>
                <FormControl>
                  <div className="flex flex-wrap gap-1.5 p-1 bg-black/[0.02] rounded-2xl border border-black/5">
                    <Button
                      type="button"
                      variant={!field.value ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => field.onChange('')}
                      className={`px-3 h-8 text-[10px] font-bold rounded-xl font-sukhumvit ${!field.value ? 'bg-blue-500 text-white shadow-sm' : 'text-black/30'}`}
                    >
                      ทั้งหมด
                    </Button>
                    {grades.map((g) => (
                      <Button
                        key={g}
                        type="button"
                        variant={field.value === g ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => field.onChange(g)}
                        className={`px-3 h-8 text-[10px] font-bold rounded-xl font-sukhumvit ${field.value === g ? 'bg-blue-600 text-white shadow-md' : 'text-black/40'}`}
                      >
                        {g}
                      </Button>
                    ))}
                  </div>
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            );
          }} />

          {/* ภาคเรียน */}
          <FormField control={form.control} name="semester" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                ภาคเรียน <span className="text-rose-400">*</span>
              </FormLabel>
              <FormControl>
                <ButtonGroup className="w-full bg-black/[0.03] rounded-2xl p-0.5 border-black/5">
                  {[1, 2].map((s, idx) => (
                    <Fragment key={s}>
                      {idx > 0 && <ButtonGroupSeparator />}
                      <Button
                        type="button"
                        variant={field.value === s ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => field.onChange(s)}
                        className={`flex-1 h-8 text-[11px] font-bold rounded-xl font-sukhumvit ${field.value === s ? 'bg-blue-600 text-white shadow-md' : 'text-black/40'}`}
                      >
                        ภาคเรียนที่ {s}
                      </Button>
                    </Fragment>
                  ))}
                </ButtonGroup>
              </FormControl>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />

          {/* หมวดวิชา */}
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                หมวดวิชา <span className="text-rose-400">*</span>
              </FormLabel>
              <FormControl>
                <ButtonGroup className="w-full bg-black/[0.03] rounded-2xl p-0.5 border-black/5">
                  {CATEGORIES.map((cat, idx) => {
                    const cfg = COURSE_CATEGORY_CONFIG[cat];
                    return (
                      <Fragment key={cat}>
                        {idx > 0 && <ButtonGroupSeparator />}
                        <Button
                          type="button"
                          variant={field.value === cat ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => field.onChange(cat)}
                          className={`flex-1 h-8 text-[11px] font-bold rounded-xl font-sukhumvit ${field.value === cat ? 'bg-blue-600 text-white shadow-md' : 'text-black/40'}`}
                        >
                          {cfg.label}
                        </Button>
                      </Fragment>
                    );
                  })}
                </ButtonGroup>
              </FormControl>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />

          {/* รูปแบบผลการเรียน — ล็อกตามหมวด (กิจกรรม = ผ/มผ บังคับ) */}
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit pl-0.5">
              รูปแบบผลการเรียน
            </p>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2.5">
              <span className="text-[12px] font-black text-foreground font-sukhumvit">
                {gradingSchemeLabel(form.watch('category'))}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground font-sukhumvit">
                {form.watch('category') === 'activity'
                  ? '· หมวดกิจกรรมบังคับ · ไม่เข้า GPA'
                  : '· ตัดเกรด A–F ตามเกณฑ์'}
              </span>
            </div>
          </div>
        </div>
      </Form>
    </FormModal>
  );
}
