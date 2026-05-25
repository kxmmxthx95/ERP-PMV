import { useEffect, useState, Fragment } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Copy, Layout } from 'lucide-react';
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
  DEPARTMENT_CONFIG, CURRICULUM_TRACK_CONFIG,
  type CurriculumVersion, type CurriculumTrack,
} from '@/types/curriculum';

const schema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อหลักสูตร'),
  year: z.string().min(4, 'กรุณากรอกปีการศึกษา 4 หลัก'),
  department: z.enum(['early', 'primary', 'secondary']).optional().or(z.literal('')),
  level: z.string().optional().or(z.literal('')),
  track: z.string().optional().or(z.literal('')),
  description: z.string().optional(),
  cloneFromId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface AddCurriculumVersionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, year: number, cloneFromId?: string, description?: string, meta?: { track?: CurriculumTrack; level?: string; department?: string }) => Promise<void>;
  versions: CurriculumVersion[];
  versionToEdit?: CurriculumVersion | null;
  onUpdate?: (id: string, data: Partial<CurriculumVersion>) => Promise<void>;
}

export default function AddCurriculumVersionModal({
  open,
  onClose,
  onSubmit,
  versions,
  versionToEdit,
  onUpdate,
}: AddCurriculumVersionModalProps) {
  const isEdit = !!versionToEdit;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentThaiYear = new Date().getFullYear() + 543;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', year: currentThaiYear.toString(), department: '', level: '', track: '', description: '', cloneFromId: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && versionToEdit) {
      form.reset({
        name: versionToEdit.name,
        year: versionToEdit.year?.toString() || currentThaiYear.toString(),
        department: (versionToEdit.department as any) || '',
        level: versionToEdit.level || '',
        track: versionToEdit.track || '',
        description: versionToEdit.description || '',
        cloneFromId: '',
      });
    } else {
      form.reset({ name: '', year: currentThaiYear.toString(), department: '', level: '', track: '', description: '', cloneFromId: '' });
    }
  }, [open, isEdit, versionToEdit, form]);

  const watchDept = form.watch('department') as string;
  const cloneFromId = form.watch('cloneFromId');
  const showClone = !isEdit && !!cloneFromId && cloneFromId !== '_none';

  const availableGrades = watchDept && DEPARTMENT_CONFIG[watchDept as keyof typeof DEPARTMENT_CONFIG]
    ? DEPARTMENT_CONFIG[watchDept as keyof typeof DEPARTMENT_CONFIG].grades
    : [];

  const showTrack = watchDept === 'secondary';

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const meta = {
        track: (values.track && values.track !== '' && values.track !== '_none') ? values.track as CurriculumTrack : undefined,
        level: values.level || undefined,
        department: (values.department && (values.department as string) !== '') ? values.department as string : undefined,
      };

      if (isEdit && versionToEdit && onUpdate) {
        await onUpdate(versionToEdit.id, {
          name: values.name,
          year: parseInt(values.year),
          description: values.description,
          ...meta,
        });
      } else {
        const cloneId = values.cloneFromId && values.cloneFromId !== '_none' ? values.cloneFromId : undefined;
        await onSubmit(values.name, parseInt(values.year), cloneId, values.description, meta);
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
      title={isEdit ? 'แก้ไขข้อมูลหลักสูตร' : 'สร้างหลักสูตรสถานศึกษา'}
      subtitle={
        isEdit
          ? 'แก้ไขชื่อและรายละเอียดของหลักสูตรนี้'
          : 'กำหนดชื่อหลักสูตร พร้อมเลือกคัดลอกโครงสร้างจากหลักสูตรอื่นได้'
      }
      icon={showClone ? <Copy size={18} /> : <Layout size={18} />}
      onSubmit={form.handleSubmit(handleSubmit)}
      submitLabel={isSubmitting ? 'กำลังบันทึก...' : (isEdit ? 'บันทึกการแก้ไข' : 'สร้างหลักสูตร')}
      submitDisabled={isSubmitting}
      maxWidth="sm"
    >
      <Form {...form}>
        <div className="space-y-4 py-2">

          {/* ชื่อหลักสูตร */}
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                ชื่อหลักสูตร <span className="text-rose-400">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="เช่น หลักสูตรแกนกลาง 2568"
                  className="h-10 rounded-3xl text-xs font-medium font-sarabun focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none"
                  style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.4)' }}
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />

          {/* ปีการศึกษา */}
          <FormField control={form.control} name="year" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                ปีการศึกษา (พ.ศ.) <span className="text-rose-400">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={`เช่น ${currentThaiYear}`}
                  className="h-10 rounded-3xl text-xs font-medium font-sarabun focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none"
                  style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.4)' }}
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />

          {/* แผนก */}
          <FormField control={form.control} name="department" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                ระดับการศึกษา
              </FormLabel>
              <FormControl>
                <ButtonGroup className="w-full bg-black/[0.03] rounded-2xl p-0.5 border-black/5">
                  <Button
                    type="button"
                    variant={!field.value ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => { field.onChange(''); form.setValue('level', ''); form.setValue('track', ''); }}
                    className={`flex-1 h-8 text-[10px] font-bold rounded-xl font-sukhumvit ${!field.value ? 'bg-slate-900 text-white shadow-md' : 'text-black/35'}`}
                  >
                    ทั้งหมด
                  </Button>
                  {(['early', 'primary', 'secondary'] as const).map((d) => (
                    <Fragment key={d}>
                      <ButtonGroupSeparator />
                      <Button
                        type="button"
                        variant={field.value === d ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => { field.onChange(d); form.setValue('level', ''); form.setValue('track', ''); }}
                        className={`flex-1 h-8 text-[10px] font-bold rounded-xl font-sukhumvit ${field.value === d ? 'bg-slate-900 text-white shadow-md' : 'text-black/35'}`}
                      >
                        {DEPARTMENT_CONFIG[d].label}
                      </Button>
                    </Fragment>
                  ))}
                </ButtonGroup>
              </FormControl>
            </FormItem>
          )} />

          {/* ระดับชั้น (แสดงเมื่อเลือกแผนก) */}
          {availableGrades.length > 0 && (
            <FormField control={form.control} name="level" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                  ระดับชั้น (ถ้าระบุ)
                </FormLabel>
                <FormControl>
                  <div className="flex flex-wrap gap-1.5 p-1.5 bg-black/[0.02] rounded-2xl border border-black/5">
                    <Button
                      type="button"
                      variant={!field.value ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => field.onChange('')}
                      className={`px-3 h-7 text-[10px] font-bold rounded-xl font-sukhumvit ${!field.value ? 'bg-slate-700 text-white shadow-sm' : 'text-black/30'}`}
                    >
                      ทุกชั้น
                    </Button>
                    {availableGrades.map((g) => (
                      <Button
                        key={g}
                        type="button"
                        variant={field.value === g ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => field.onChange(g)}
                        className={`px-3 h-7 text-[10px] font-bold rounded-xl font-sukhumvit ${field.value === g ? 'bg-slate-900 text-white shadow-md' : 'text-black/35'}`}
                      >
                        {g}
                      </Button>
                    ))}
                  </div>
                </FormControl>
              </FormItem>
            )} />
          )}

          {/* สายการเรียน (แสดงเฉพาะมัธยม) */}
          {showTrack && (
            <FormField control={form.control} name="track" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                  สายการเรียน
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value || '_none'}>
                  <FormControl>
                    <SelectTrigger
                      className="h-10 rounded-3xl text-xs font-sarabun border focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none"
                      style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.4)' }}
                    >
                      <SelectValue placeholder="ไม่ระบุสาย" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="_none" className="text-xs font-sarabun">ไม่ระบุสาย</SelectItem>
                    {(Object.entries(CURRICULUM_TRACK_CONFIG) as [CurriculumTrack, typeof CURRICULUM_TRACK_CONFIG[CurriculumTrack]][]).map(([id, cfg]) => (
                      <SelectItem key={id} value={id} className="text-xs font-sarabun">
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          )}

          {/* หมายเหตุ */}
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                หมายเหตุ
              </FormLabel>
              <FormControl>
                <textarea
                  placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
                  className="w-full min-h-[72px] p-4 rounded-3xl text-xs font-medium font-sarabun focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none outline-none border transition-all"
                  style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.4)' }}
                  {...field}
                />
              </FormControl>
            </FormItem>
          )} />

          {/* คัดลอกจาก */}
          {!isEdit && versions.length > 0 && (
            <FormField control={form.control} name="cloneFromId" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                  คัดลอกโครงสร้างจาก (ไม่บังคับ)
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? '_none'}>
                  <FormControl>
                    <SelectTrigger
                      className="h-10 rounded-3xl text-xs font-sarabun border focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none"
                      style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,180,255,0.4)' }}
                    >
                      <SelectValue placeholder="ไม่คัดลอก (สร้างใหม่)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="_none" className="text-xs font-sarabun">ไม่คัดลอก (สร้างใหม่เปล่า)</SelectItem>
                    {versions.map(v => (
                      <SelectItem key={v.id} value={v.id} className="text-xs font-sarabun">
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          )}

          {showClone && (
            <div
              className="flex items-start gap-2.5 px-4 py-3 rounded-2xl text-[11px] font-sarabun"
              style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}
            >
              <Copy size={13} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-blue-700/80 leading-relaxed">
                รายวิชาทั้งหมดจากหลักสูตรที่เลือกจะถูกคัดลอกมาเป็นจุดเริ่มต้น
                คุณสามารถแก้ไขได้ภายหลัง
              </p>
            </div>
          )}
        </div>
      </Form>
    </FormModal>
  );
}
