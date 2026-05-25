import { useEffect } from 'react';
import { CalendarPlus, Pencil } from 'lucide-react';
import { EVENT_TYPE_CONFIG, type CalendarEventType, type CalendarEvent } from '@/types/calendar';
import { ALL_TYPES } from '../constants';
import { Input } from '@/components/ui/input';
import FormModal from '@/components/ui/FormModal';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const ALL_ROLES = [
  { value: 'student',  label: 'นักเรียน' },
  { value: 'parent',   label: 'ผู้ปกครอง' },
  { value: 'teacher',  label: 'ครูผู้สอน' },
  { value: 'staff',    label: 'เจ้าหน้าที่' },
  { value: 'admin',    label: 'ผู้บริหาร' },
  { value: 'sysadmin', label: 'System Admin' },
];

const ALL_DEPARTMENTS = [
  { value: 'dept:early',     label: 'ปฐมวัย' },
  { value: 'dept:primary',   label: 'ประถมศึกษา' },
  { value: 'dept:secondary', label: 'มัธยมศึกษา' },
];

export type EventFormData = Omit<CalendarEvent, 'id' | 'academicYearId' | 'createdBy'>;

interface AddEventModalProps {
  open: boolean;
  defaultDate?: string;
  eventToEdit?: CalendarEvent;
  onClose: () => void;
  onSubmit: (event: EventFormData) => void;
  onUpdate?: (id: string, event: Partial<CalendarEvent>) => void;
  onDelete?: (id: string) => void;
}

const formSchema = z.object({
  title: z.string().min(1, 'กรุณากรอกชื่อกิจกรรม'),
  type: z.string(),
  startDate: z.string().min(1, 'กรุณาเลือกวันเริ่มต้น'),
  endDate: z.string().min(1, 'กรุณาเลือกวันสิ้นสุด'),
  targetRoles: z.array(z.string()).min(1, 'กรุณาเลือกอย่างน้อย 1 กลุ่ม'),
  description: z.string().optional(),
}).refine(data => data.endDate >= data.startDate, {
  message: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น',
  path: ['endDate'],
});

const inputStyle = {
  background: 'rgba(255,255,255,0.6)',
  borderColor: 'rgba(200,180,255,0.4)',
};

export default function AddEventModal({
  open,
  defaultDate,
  eventToEdit,
  onClose,
  onSubmit,
  onUpdate,
  onDelete,
}: AddEventModalProps) {
  const isEditMode = !!eventToEdit;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      type: 'activity',
      startDate: defaultDate ?? new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
      endDate: defaultDate ?? new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
      targetRoles: ['student', 'teacher'],
      description: '',
    },
  });

  useEffect(() => {
    if (isEditMode) {
      form.reset({
        title: eventToEdit.title,
        type: eventToEdit.type,
        startDate: eventToEdit.startDate,
        endDate: eventToEdit.endDate,
        targetRoles: eventToEdit.targetRoles,
        description: eventToEdit.description ?? '',
      });
    } else if (open) {
      const todayLocal = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      form.reset({
        title: '',
        type: 'activity',
        startDate: defaultDate ?? todayLocal,
        endDate: defaultDate ?? todayLocal,
        targetRoles: ['student', 'teacher'],
        description: '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventToEdit?.id, isEditMode, open, defaultDate, form]);

  const onSubmitForm = (values: z.infer<typeof formSchema>) => {
    const data: EventFormData = {
      title: values.title.trim(),
      type: values.type as CalendarEventType,
      startDate: values.startDate,
      endDate: values.endDate,
      targetRoles: values.targetRoles,
      description: values.description?.trim() || '',
    };
    if (isEditMode && onUpdate) {
      onUpdate(eventToEdit.id, data);
    } else {
      onSubmit(data);
    }
    onClose();
  };

  const handleDelete = () => {
    if (isEditMode && onDelete) {
      onDelete(eventToEdit.id);
      onClose();
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEditMode ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรม'}
      icon={isEditMode ? <Pencil size={14} /> : <CalendarPlus size={14} />}
      submitLabel={isEditMode ? 'บันทึกการแก้ไข' : 'ยืนยันเพิ่มกิจกรรม'}
      submitDisabled={!form.formState.isValid}
      onSubmit={() => form.handleSubmit(onSubmitForm)()}
      onDelete={isEditMode && onDelete ? handleDelete : undefined}
      deleteLabel="ลบกิจกรรม"
      maxWidth="md"
    >
      <Form {...form}>
        <form className="space-y-5">

          {/* Title */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }: any) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                  ชื่อกิจกรรม <span className="text-rose-400">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="เช่น สอบกลางภาค เทอม 1"
                    className="h-10 rounded-3xl border text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none font-sarabun"
                    style={inputStyle}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-[10px] font-medium" />
              </FormItem>
            )}
          />

          {/* Type */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }: any) => {
              const typeCfg = EVENT_TYPE_CONFIG[field.value as CalendarEventType] || EVENT_TYPE_CONFIG['activity'];
              return (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                    ประเภทกิจกรรม <span className="text-rose-400">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger
                        className="w-full h-10 rounded-3xl border text-xs font-bold shadow-none focus:ring-2 focus:ring-blue-500/20 font-sukhumvit"
                        style={{
                          color: typeCfg.color,
                          background: `${typeCfg.color}12`,
                          borderColor: `${typeCfg.color}30`,
                        }}
                      >
                        <SelectValue placeholder="เลือกประเภทกิจกรรม" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent
                      className="rounded-[1.5rem] overflow-hidden p-1.5"
                      style={{
                        background: 'rgba(255,255,255,0.97)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255,255,255,0.95)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.14)',
                      }}
                    >
                      {ALL_TYPES.map(t => (
                        <SelectItem key={t} value={t} className="text-[11px] font-bold rounded-xl font-sukhumvit cursor-pointer">
                          {EVENT_TYPE_CONFIG[t].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[10px] font-medium" />
                </FormItem>
              );
            }}
          />

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }: any) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                    วันเริ่มต้น <span className="text-rose-400">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className="h-10 rounded-3xl border text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none font-sarabun"
                      style={inputStyle}
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        const end = form.getValues('endDate');
                        if (end < e.target.value) form.setValue('endDate', e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage className="text-[10px] font-medium" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }: any) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                    วันสิ้นสุด <span className="text-rose-400">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      min={form.getValues('startDate')}
                      className="h-10 rounded-3xl border text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none font-sarabun"
                      style={inputStyle}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[10px] font-medium" />
                </FormItem>
              )}
            />
          </div>

          {/* Target Roles + Departments */}
          <FormField
            control={form.control}
            name="targetRoles"
            render={({ field }: any) => {
              const allDeptsSelected = ALL_DEPARTMENTS.every(d => field.value.includes(d.value));
              const allRolesSelected = ALL_ROLES.every(r => field.value.includes(r.value));

              const toggleAll = (items: { value: string }[], allSelected: boolean) => {
                const vals = items.map(x => x.value);
                if (allSelected) {
                  field.onChange(field.value.filter((v: string) => !vals.includes(v)));
                } else {
                  const next = [...field.value];
                  vals.forEach(v => { if (!next.includes(v)) next.push(v); });
                  field.onChange(next);
                }
              };

              const toggle = (val: string) => {
                const active = field.value.includes(val);
                field.onChange(active ? field.value.filter((v: string) => v !== val) : [...field.value, val]);
              };

              return (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                    แสดงให้กลุ่ม <span className="text-rose-400">*</span>
                  </FormLabel>
                  <FormControl>
                    <div
                      className="rounded-2xl p-4 space-y-4"
                      style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(200,180,255,0.3)' }}
                    >
                      {/* Roles */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sukhumvit">ผู้ใช้งาน</p>
                          <button
                            type="button"
                            onClick={() => toggleAll(ALL_ROLES, allRolesSelected)}
                            className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg transition-colors hover:bg-black/5 text-slate-400"
                          >
                            {allRolesSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {ALL_ROLES.map(r => {
                            const active = field.value.includes(r.value);
                            return (
                              <button
                                key={r.value}
                                type="button"
                                onClick={() => toggle(r.value)}
                                className="text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all duration-200 font-sukhumvit"
                                style={{
                                  background: active ? 'rgba(99,102,241,0.10)' : 'rgba(0,0,0,0.03)',
                                  border: `1px solid ${active ? 'rgba(99,102,241,0.22)' : 'transparent'}`,
                                  color: active ? '#4f46e5' : 'rgba(0,0,0,0.40)',
                                }}
                              >
                                {r.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Departments */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sukhumvit">แผนก</p>
                          <button
                            type="button"
                            onClick={() => toggleAll(ALL_DEPARTMENTS, allDeptsSelected)}
                            className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg transition-colors hover:bg-black/5 text-slate-400"
                          >
                            {allDeptsSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {ALL_DEPARTMENTS.map(d => {
                            const active = field.value.includes(d.value);
                            return (
                              <button
                                key={d.value}
                                type="button"
                                onClick={() => toggle(d.value)}
                                className="text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all duration-200 font-sukhumvit"
                                style={{
                                  background: active ? 'rgba(16,185,129,0.10)' : 'rgba(0,0,0,0.03)',
                                  border: `1px solid ${active ? 'rgba(16,185,129,0.22)' : 'transparent'}`,
                                  color: active ? '#059669' : 'rgba(0,0,0,0.40)',
                                }}
                              >
                                {d.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage className="text-[10px] font-medium" />
                </FormItem>
              );
            }}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }: any) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-[11px] font-bold text-slate-600 uppercase tracking-widest font-sukhumvit">
                  รายละเอียด (ไม่บังคับ)
                </FormLabel>
                <FormControl>
                  <textarea
                    placeholder="ระบุข้อมูลเพิ่มเติมของกิจกรรม..."
                    rows={3}
                    className="w-full text-xs px-4 py-3 rounded-2xl outline-none transition-all resize-none focus:ring-2 focus:ring-blue-500/20 font-sarabun border"
                    style={inputStyle}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-[10px] font-medium" />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FormModal>
  );
}
