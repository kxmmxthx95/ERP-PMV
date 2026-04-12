import { useEffect } from 'react';
import { X, BookPlus, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  DEPARTMENT_CONFIG, CATEGORY_CONFIG, SUBJECT_GROUP_CONFIG,
  type Subject, type Department, type SubjectCategory, type SubjectGroupId,
} from '@/types/curriculum';
import type { NewSubject } from '@/hooks/useCurriculum';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';

const CATEGORIES: SubjectCategory[] = ['core', 'added', 'elective', 'activity'];

const schema = z.object({
  code:         z.string().min(1, 'กรุณากรอกรหัสวิชา'),
  codeEn:       z.string().optional(),
  name:         z.string().min(1, 'กรุณากรอกชื่อวิชา'),
  nameEn:       z.string().optional(),
  credits:      z.number({ error: 'หน่วยกิตต้องไม่ติดลบ' }).min(0, 'หน่วยกิตต้องไม่ติดลบ'),
  hoursPerWeek: z.number({ error: 'ต้องมีอย่างน้อย 1 ชั่วโมง/สัปดาห์' }).min(1, 'ต้องมีอย่างน้อย 1 ชั่วโมง/สัปดาห์'),
  totalHours:   z.number({ error: 'ต้องไม่ติดลบ' }).min(0, 'ต้องไม่ติดลบ'),
  department:   z.string().min(1, 'กรุณาเลือกแผนก'),
  gradeLevel:   z.string().optional(),
  subjectGroup: z.string().min(1, 'กรุณาเลือกกลุ่มสาระ'),
  category:     z.enum(['core', 'added', 'elective', 'activity'] as const),
  description:  z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface AddSubjectModalProps {
  open: boolean;
  defaultDepartment: Department;
  subjectToEdit?: Subject;
  onClose: () => void;
  onSubmit: (data: NewSubject) => void;
  onUpdate: (id: string, data: NewSubject) => void;
  onDelete: (id: string) => void;
}

export default function AddSubjectModal({
  open,
  defaultDepartment,
  subjectToEdit,
  onClose,
  onSubmit,
  onUpdate,
  onDelete,
}: AddSubjectModalProps) {
  const isEditMode = !!subjectToEdit;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '', codeEn: '', name: '', nameEn: '', credits: 1, hoursPerWeek: 2, totalHours: 40,
      department: defaultDepartment, gradeLevel: '', subjectGroup: 'other', category: 'core', description: '',
    },
  });

  useEffect(() => {
    if (isEditMode) {
      form.reset({
        code: subjectToEdit.code,
        codeEn: (subjectToEdit as any).codeEn ?? '',
        name: subjectToEdit.name,
        nameEn: subjectToEdit.nameEn ?? '',
        credits: subjectToEdit.credits,
        hoursPerWeek: subjectToEdit.hoursPerWeek,
        totalHours: (subjectToEdit as any).totalHours ?? 40,
        department: subjectToEdit.department,
        gradeLevel: (subjectToEdit as any).gradeLevel ?? '',
        subjectGroup: (subjectToEdit as any).subjectGroup ?? 'other',
        category: subjectToEdit.category,
        description: subjectToEdit.description ?? '',
      });
    } else if (open) {
      form.reset({
        code: '', codeEn: '', name: '', nameEn: '', credits: 1, hoursPerWeek: 2, totalHours: 40,
        department: defaultDepartment, gradeLevel: '', subjectGroup: 'other',
        category: 'core', description: ''
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectToEdit?.id, open]);

  const { departments, getGradesBySection } = useSchoolStructure();

  const deptValue = form.watch('department');
  const deptCfg = DEPARTMENT_CONFIG[deptValue as Department] ?? { bg: 'rgba(0,0,0,0.05)', color: '#1e1e1e', border: 'rgba(0,0,0,0.1)' };
  
  // แปลงค่า early ให้ตรงกับ hook
  const normalizedDept = deptValue === 'early' ? 'early-childhood' : deptValue;
  const grades = normalizedDept ? getGradesBySection(normalizedDept as any) : [];

  const handleSubmit = (values: FormValues) => {
    const data: NewSubject = {
      code: values.code.trim().toUpperCase(),
      ...((values.codeEn) ? { codeEn: values.codeEn.trim().toUpperCase() } : {}),
      name: values.name.trim(),
      nameEn: values.nameEn?.trim() || undefined,
      credits: values.credits,
      hoursPerWeek: values.hoursPerWeek,
      totalHours: values.totalHours,
      department: values.department as Department,
      category: values.category,
      description: values.description?.trim() || undefined,
      ...((values.gradeLevel) ? { gradeLevel: values.gradeLevel } : {}),
      ...((values.subjectGroup) ? { subjectGroup: values.subjectGroup as SubjectGroupId } : {})
    } as any;
    if (isEditMode) {
      onUpdate(subjectToEdit.id, data);
    } else {
      onSubmit(data);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md rounded-3xl border-0 p-0 overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(32px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
        }}
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-black/5">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-black/80 flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg,${deptCfg.color},${deptCfg.color}aa)`,
                  boxShadow: `0 0 16px ${deptCfg.color}40`,
                }}
              >
                {isEditMode ? <Pencil size={16} className="text-white" /> : <BookPlus size={18} className="text-white" />}
              </div>
              {isEditMode ? 'แก้ไขวิชา' : 'เพิ่มวิชาใหม่'}
            </DialogTitle>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-black/40 hover:bg-black/06 transition-colors">
              <X size={15} />
            </button>
          </div>
        </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)}>
                  <div className="px-5 py-4 space-y-3 max-h-[75vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="code" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">รหัสวิชา (ไทย)</FormLabel>
                          <FormControl><Input placeholder="ท11101" {...field} className="uppercase rounded-lg" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="codeEn" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">รหัสวิชา (อังกฤษ)</FormLabel>
                          <FormControl><Input placeholder="TH11101" {...field} className="uppercase rounded-lg" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">ชื่อวิชา (ไทย)</FormLabel>
                          <FormControl><Input placeholder="คณิตศาสตร์" {...field} className="rounded-lg" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="nameEn" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">ชื่อวิชา (อังกฤษ)</FormLabel>
                          <FormControl><Input placeholder="Mathematics" {...field} className="rounded-lg" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="credits" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">หน่วยกิต</FormLabel>
                          <FormControl><Input type="number" step="0.5" min="0" {...field} onChange={e => field.onChange(Number(e.target.value))} className="rounded-lg" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="hoursPerWeek" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">ชั่วโมง/สัปดาห์</FormLabel>
                          <FormControl><Input type="number" min="1" {...field} onChange={e => field.onChange(Number(e.target.value))} className="rounded-lg" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="totalHours" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">ชั่วโมงเต็ม</FormLabel>
                          <FormControl><Input type="number" min="0" {...field} onChange={e => field.onChange(Number(e.target.value))} className="rounded-lg" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="department" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">แผนก</FormLabel>
                          <Select onValueChange={(val) => { field.onChange(val); form.setValue('gradeLevel', ''); }} value={field.value}>
                            <FormControl>
                              <SelectTrigger style={{ background: deptCfg.bg, border: `1px solid ${deptCfg.border}`, color: deptCfg.color }} className="w-full rounded-lg">
                                <SelectValue placeholder="เลือกแผนก" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {departments.map(d => {
                                const val = d.id === 'early-childhood' ? 'early' : d.id;
                                return <SelectItem key={d.id} value={val}>{d.label}</SelectItem>;
                              })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="gradeLevel" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">ระดับชั้น</FormLabel>
                          <Select onValueChange={(v) => field.onChange(v === 'none' ? '' : v)} value={field.value || 'none'} disabled={!deptValue}>
                            <FormControl><SelectTrigger className="w-full rounded-lg"><SelectValue placeholder="เลือกระดับชั้น" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="none">เลือกระดับชั้น</SelectItem>
                              {grades.map(g => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="subjectGroup" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">กลุ่มสาระการเรียนรู้</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="w-full rounded-lg"><SelectValue placeholder="เลือกกลุ่มสาระ..." /></SelectTrigger></FormControl>
                          <SelectContent>
                            {Object.entries(SUBJECT_GROUP_CONFIG).map(([id, g]) => (
                              <SelectItem key={id} value={id}>{g.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">หมวดวิชา</FormLabel>
                        <FormControl>
                          <div className="flex gap-2 flex-wrap">
                            {CATEGORIES.map(cat => {
                              const active = field.value === cat;
                              const catCfg = CATEGORY_CONFIG[cat];
                              return (
                                <button
                                  key={cat} type="button" onClick={() => field.onChange(cat)}
                                  className="text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all duration-150"
                                  style={{
                                    background: active ? catCfg.bg : 'rgba(0,0,0,0.04)',
                                    border: `1px solid ${active ? catCfg.color + '50' : 'transparent'}`,
                                    color: active ? catCfg.color : 'rgba(0,0,0,0.40)',
                                  }}
                                >{catCfg.label}</button>
                              );
                            })}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <textarea
                            placeholder="คำอธิบายย่อ..." rows={2}
                            className="w-full text-sm px-3 py-2 rounded-lg outline-none transition-all resize-none bg-black/5 border border-black/10 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <div>
                      {isEditMode && (
                        <Button type="button" variant="destructive" size="sm" onClick={() => { onDelete(subjectToEdit.id); onClose(); }}>
                          <Trash2 size={13} className="mr-1.5" /> ลบวิชา
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={onClose}>ยกเลิก</Button>
                      <Button
                        type="submit" size="sm"
                        className="text-white"
                        style={{ background: `linear-gradient(135deg,${deptCfg.color},${deptCfg.color}aa)`, boxShadow: `0 0 12px ${deptCfg.color}40` }}
                      >
                        {isEditMode ? 'บันทึกการแก้ไข' : 'เพิ่มวิชา'}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
      </DialogContent>
    </Dialog>
  );
}
