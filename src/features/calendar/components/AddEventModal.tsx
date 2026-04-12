import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { EVENT_TYPE_CONFIG, type CalendarEventType, type CalendarEvent } from '@/types/calendar';
import type { NewCalendarEvent } from '@/hooks/useAcademicCalendar';
import { ALL_TYPES } from '../constants';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

interface AddEventModalProps {
  open: boolean;
  defaultDate?: string;           // YYYY-MM-DD — pre-fill when adding new event
  eventToEdit?: CalendarEvent;    // if provided → edit mode
  onClose: () => void;
  onSubmit: (event: NewCalendarEvent) => void;
  onUpdate?: (id: string, event: NewCalendarEvent) => void;
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
      startDate: defaultDate ?? new Date().toISOString().slice(0, 10),
      endDate: defaultDate ?? new Date().toISOString().slice(0, 10),
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
      form.reset({
        title: '',
        type: 'activity',
        startDate: defaultDate ?? new Date().toISOString().slice(0, 10),
        endDate: defaultDate ?? new Date().toISOString().slice(0, 10),
        targetRoles: ['student', 'teacher'],
        description: '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventToEdit?.id, isEditMode, open, defaultDate, form]);

  // Reset to blank when switching to add mode
  const handleExitComplete = () => {
    if (!isEditMode) {
      form.reset();
    }
  };

  const onSubmitForm = (values: z.infer<typeof formSchema>) => {
    const data: NewCalendarEvent = {
      title: values.title.trim(),
      type: values.type as CalendarEventType,
      startDate: values.startDate,
      endDate: values.endDate,
      targetRoles: values.targetRoles,
      description: values.description?.trim() || undefined,
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
    <AnimatePresence onExitComplete={handleExitComplete}>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-md pointer-events-auto rounded-3xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(32px) saturate(180%)',
                WebkitBackdropFilter: 'blur(32px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.95)',
                boxShadow: '0 24px 60px rgba(0,0,0,0.12)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-6 py-5"
                style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-2xl flex items-center justify-center"
                    style={{
                      background: isEditMode
                        ? 'linear-gradient(135deg,#f97316,#ef4444)'
                        : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                      boxShadow: isEditMode ? '0 0 16px #f9731650' : '0 0 16px #7c3aed50',
                    }}
                  >
                    {isEditMode
                      ? <Pencil size={16} className="text-white" />
                      : <CalendarPlus size={18} className="text-white" />}
                  </div>
                  <h2 className="font-bold text-black/80 text-base">
                    {isEditMode ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรม'}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-black/35 hover:bg-black/06 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitForm)}>
                  {/* Body */}
                  <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

                    {/* Title */}
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }: any) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1 text-xs font-semibold text-black/50">
                            ชื่อกิจกรรม <span className="text-red-400">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="เช่น สอบกลางภาค เทอม 1"
                              className="w-full text-sm px-3.5 py-2.5 rounded-2xl outline-none transition-all h-auto shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 bg-black/5 border-black/10"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-[11px] font-medium" />
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
                          <FormItem>
                            <FormLabel className="flex items-center gap-1 text-xs font-semibold text-black/50">
                              ประเภทกิจกรรม <span className="text-red-400">*</span>
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger
                                  className="w-full text-sm px-3.5 py-2.5 rounded-2xl outline-none transition-all cursor-pointer h-auto shadow-none border-none focus:ring-1 focus:ring-slate-300"
                                  style={{
                                    color: typeCfg.color,
                                    background: typeCfg.bg,
                                    border: `1px solid ${typeCfg.border}`,
                                    fontWeight: 600,
                                  }}
                                >
                                  <SelectValue placeholder="เลือกประเภทกิจกรรม" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-2xl shadow-lg">
                                {ALL_TYPES.map(t => (
                                  <SelectItem key={t} value={t} className="text-xs rounded-lg cursor-pointer">
                                    {EVENT_TYPE_CONFIG[t].label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-[11px] font-medium" />
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
                          <FormItem>
                            <FormLabel className="flex items-center gap-1 text-xs font-semibold text-black/50">
                              วันเริ่มต้น <span className="text-red-400">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                className="w-full text-sm px-3.5 py-2.5 rounded-2xl outline-none transition-all h-auto shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 bg-black/5 border-black/10"
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
                            <FormMessage className="text-[11px] font-medium" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }: any) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1 text-xs font-semibold text-black/50">
                              วันสิ้นสุด <span className="text-red-400">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                min={form.getValues('startDate')}
                                className="w-full text-sm px-3.5 py-2.5 rounded-2xl outline-none transition-all h-auto shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 bg-black/5 border-black/10"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-[11px] font-medium" />
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
                          <FormItem>
                            <FormLabel className="flex items-center gap-1 text-xs font-semibold text-black/50">
                              แสดงให้กลุ่ม <span className="text-red-400">*</span>
                            </FormLabel>
                            <FormControl>
                              <div className="space-y-2.5 pt-0.5">
                                {/* Roles */}
                                <div className="flex flex-wrap gap-2">
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
                                    className="text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all duration-150"
                                    style={{
                                      background: allRolesSelected ? 'rgba(124,58,237,0.10)' : 'rgba(0,0,0,0.04)',
                                      border: `1px solid ${allRolesSelected ? 'rgba(124,58,237,0.30)' : 'transparent'}`,
                                      color: allRolesSelected ? '#7c3aed' : 'rgba(0,0,0,0.40)',
                                    }}
                                  >
                                    ทั้งหมด
                                  </button>
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
                                        className="text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all duration-150"
                                        style={{
                                          background: active ? 'rgba(124,58,237,0.10)' : 'rgba(0,0,0,0.04)',
                                          border: `1px solid ${active ? 'rgba(124,58,237,0.30)' : 'transparent'}`,
                                          color: active ? '#7c3aed' : 'rgba(0,0,0,0.40)',
                                        }}
                                      >
                                        {r.label}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Departments */}
                                <div>
                                  <p className="text-[10px] font-semibold text-black/30 mb-1.5 uppercase tracking-wide">แผนก</p>
                                  <div className="flex flex-wrap gap-2">
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
                                      className="text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all duration-150"
                                      style={{
                                        background: allDeptsSelected ? 'rgba(16,185,129,0.10)' : 'rgba(0,0,0,0.04)',
                                        border: `1px solid ${allDeptsSelected ? 'rgba(16,185,129,0.30)' : 'transparent'}`,
                                        color: allDeptsSelected ? '#059669' : 'rgba(0,0,0,0.40)',
                                      }}
                                    >
                                      ทั้งหมด
                                    </button>
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
                                          className="text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all duration-150"
                                          style={{
                                            background: active ? 'rgba(16,185,129,0.10)' : 'rgba(0,0,0,0.04)',
                                            border: `1px solid ${active ? 'rgba(16,185,129,0.30)' : 'transparent'}`,
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
                            <FormMessage className="text-[11px] font-medium" />
                          </FormItem>
                        );
                      }}
                    />

                    {/* Description */}
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }: any) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1 text-xs font-semibold text-black/50">รายละเอียด (ไม่บังคับ)</FormLabel>
                          <FormControl>
                            <textarea
                              placeholder="รายละเอียดเพิ่มเติม..."
                              rows={3}
                              className="w-full text-sm px-3.5 py-2.5 rounded-2xl outline-none transition-all resize-none focus-visible:ring-1 focus-visible:ring-slate-300 bg-black/5 border border-black/10"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-[11px] font-medium" />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Footer */}
                  <div
                    className="flex items-center justify-between gap-3 px-6 py-4"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
                  >
                    {/* Delete button (edit mode only) */}
                    <div>
                      {isEditMode && onDelete && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleDelete}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] h-auto hover:bg-red-50"
                          style={{
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.20)',
                            color: '#ef4444',
                          }}
                        >
                          <Trash2 size={13} />
                          ลบกิจกรรม
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        className="px-4 py-2 rounded-2xl text-xs font-semibold text-black/50 hover:bg-black/05 transition-colors h-auto"
                      >
                        ยกเลิก
                      </Button>
                      <Button
                        type="submit"
                        className="flex items-center gap-2 px-5 py-2 rounded-2xl text-xs font-semibold text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] h-auto border-0"
                        style={{
                          background: isEditMode
                            ? 'linear-gradient(135deg,#f97316,#ef4444)'
                            : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                          boxShadow: isEditMode
                            ? '0 0 16px #f9731650, 0 4px 12px rgba(0,0,0,0.15)'
                            : '0 0 16px #7c3aed50, 0 4px 12px rgba(0,0,0,0.15)',
                        }}
                      >
                        {isEditMode ? <Pencil size={14} /> : <CalendarPlus size={14} />}
                        {isEditMode ? 'บันทึกการแก้ไข' : 'บันทึกกิจกรรม'}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
