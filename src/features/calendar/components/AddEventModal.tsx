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
  { value: 'dept:early',   label: 'ปฐมวัย' },
  { value: 'dept:primary', label: 'ประถมศึกษา' },
  { value: 'dept:secondary', label: 'มัธยมศึกษา' },
];

export type EventFormData = Omit<CalendarEvent, 'id' | 'academicYearId' | 'createdBy'>;

interface AddEventModalProps {
  open: boolean;
  defaultDate?: string;           // YYYY-MM-DD — pre-fill when adding new event
  eventToEdit?: CalendarEvent;    // if provided → edit mode
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
  message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น",
  path: ["endDate"],
});

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

  // Sync form whenever eventToEdit changes (e.g. user clicks different event)
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

  const handleFormSubmit = () => {
    form.handleSubmit(onSubmitForm)();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isEditMode ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรม'}
      icon={isEditMode ? <Pencil size={14} /> : <CalendarPlus size={14} />}
      submitLabel={isEditMode ? 'บันทึกการแก้ไข' : 'ยืนยันเพิ่มกิจกรรม'}
      submitDisabled={!form.formState.isValid}
      onSubmit={handleFormSubmit}
      onDelete={isEditMode && onDelete ? handleDelete : undefined}
      deleteLabel="ลบกิจกรรม"
      maxWidth="md"
    >
      <Form {...form}>
        <form>
          <div className="space-y-4">

                    {/* Title */}
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }: any) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-[11px] font-semibold text-black/50 ml-1 uppercase tracking-wider">
                            ชื่อกิจกรรม <span className="text-red-400">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="เช่น สอบกลางภาค เทอม 1"
                              className="w-full text-xs px-4 py-2.5 rounded-xl outline-none transition-all h-10 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 bg-black/[0.03] border-transparent"
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
                            <FormLabel className="text-[11px] font-semibold text-black/50 ml-1 uppercase tracking-wider">
                              ประเภทกิจกรรม <span className="text-red-400">*</span>
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger
                                  className="w-full text-xs px-4 py-2.5 rounded-xl outline-none transition-all cursor-pointer h-10 shadow-none border-transparent focus:ring-1 focus:ring-slate-300"
                                  style={{
                                    color: typeCfg.color,
                                    background: `${typeCfg.color}10`,
                                    fontWeight: 700,
                                  }}
                                >
                                  <SelectValue placeholder="เลือกประเภทกิจกรรม" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-xl shadow-lg border">
                                {ALL_TYPES.map(t => (
                                  <SelectItem key={t} value={t} className="text-xs rounded-lg cursor-pointer">
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
                            <FormLabel className="text-[11px] font-semibold text-black/50 ml-1 uppercase tracking-wider">
                              วันเริ่มต้น <span className="text-red-400">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                className="w-full text-xs px-4 py-2.5 rounded-xl outline-none transition-all h-10 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 bg-black/[0.03] border-transparent"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e);
                                  const end = form.getValues('endDate');
                                  if (end < e.target.value) {
                                    form.setValue('endDate', e.target.value);
                                  }
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
                            <FormLabel className="text-[11px] font-semibold text-black/50 ml-1 uppercase tracking-wider">
                              วันสิ้นสุด <span className="text-red-400">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                min={form.getValues('startDate')}
                                className="w-full text-xs px-4 py-2.5 rounded-xl outline-none transition-all h-10 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 bg-black/[0.03] border-transparent"
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

                        return (
                          <FormItem className="space-y-1.5">
                            <FormLabel className="text-[11px] font-semibold text-black/50 ml-1 uppercase tracking-wider">
                              แสดงให้กลุ่ม <span className="text-red-400">*</span>
                            </FormLabel>
                            <FormControl>
                              <div className="space-y-4 pt-1">
                                {/* Roles */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between px-1">
                                    <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest">ผู้ใช้</p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const allRoleValues = ALL_ROLES.map(r => r.value);
                                        if (allRolesSelected) {
                                          field.onChange(field.value.filter((r: string) => !allRoleValues.includes(r)));
                                        } else {
                                          const newRoles = [...field.value];
                                          allRoleValues.forEach(v => {
                                            if (!newRoles.includes(v)) newRoles.push(v);
                                          });
                                          field.onChange(newRoles);
                                        }
                                      }}
                                      className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md transition-colors hover:bg-black/5 text-black/40"
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
                                          onClick={() => {
                                            const newRoles = active
                                              ? field.value.filter((val: string) => val !== r.value)
                                              : [...field.value, r.value];
                                            field.onChange(newRoles);
                                          }}
                                          className="text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all duration-200"
                                          style={{
                                            background: active ? 'rgba(99,102,241,0.12)' : 'rgba(0,0,0,0.03)',
                                            border: `1px solid ${active ? 'rgba(99,102,241,0.20)' : 'transparent'}`,
                                            color: active ? '#4f46e5' : 'rgba(0,0,0,0.45)',
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
                                  <div className="flex items-center justify-between px-1">
                                    <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest">แผนก</p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const allDeptValues = ALL_DEPARTMENTS.map(d => d.value);
                                        if (allDeptsSelected) {
                                          field.onChange(field.value.filter((r: string) => !allDeptValues.includes(r)));
                                        } else {
                                          const newRoles = [...field.value];
                                          allDeptValues.forEach(v => {
                                            if (!newRoles.includes(v)) newRoles.push(v);
                                          });
                                          field.onChange(newRoles);
                                        }
                                      }}
                                      className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md transition-colors hover:bg-black/5 text-black/40"
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
                                          onClick={() => {
                                            const newRoles = active
                                              ? field.value.filter((val: string) => val !== d.value)
                                              : [...field.value, d.value];
                                            field.onChange(newRoles);
                                          }}
                                          className="text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all duration-200"
                                          style={{
                                            background: active ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.03)',
                                            border: `1px solid ${active ? 'rgba(16,185,129,0.20)' : 'transparent'}`,
                                            color: active ? '#059669' : 'rgba(0,0,0,0.45)',
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
                  <FormLabel className="text-[11px] font-semibold text-black/50 ml-1 uppercase tracking-wider">รายละเอียด (ไม่บังคับ)</FormLabel>
                  <FormControl>
                    <textarea
                      placeholder="ระบุข้อมูลเพิ่มเติมของกิจกรรม..."
                      rows={3}
                      className="w-full text-xs px-4 py-3 rounded-xl outline-none transition-all resize-none focus-visible:ring-1 focus-visible:ring-slate-300 bg-black/[0.03] border-transparent"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[10px] font-medium" />
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>
    </FormModal>
  );
}
