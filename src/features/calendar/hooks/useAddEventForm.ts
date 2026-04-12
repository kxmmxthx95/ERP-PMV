import { useState, useCallback } from 'react';
import type { CalendarEventType } from '@/types/calendar';
import type { NewCalendarEvent } from '@/hooks/useAcademicCalendar';

export interface FormState {
  title: string;
  type: CalendarEventType;
  startDate: string;
  endDate: string;
  targetRoles: string[];
  description: string;
}

const today = new Date().toISOString().slice(0, 10);

function buildForm(defaultDate?: string, initialValues?: Partial<FormState>): FormState {
  return {
    title: '',
    type: 'activity',
    startDate: defaultDate ?? today,
    endDate: defaultDate ?? today,
    targetRoles: ['student', 'teacher'],
    description: '',
    ...initialValues,
  };
}

export interface UseAddEventFormReturn {
  form: FormState;
  errors: Partial<Record<keyof FormState, string>>;

  // Field setters
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  toggleRole: (role: string) => void;

  // Form actions
  reset: (defaultDate?: string) => void;
  validate: () => boolean;
  getSubmitData: () => NewCalendarEvent | null;
}

export function useAddEventForm(
  defaultDate?: string,
  initialValues?: Partial<FormState>,
): UseAddEventFormReturn {
  const [form, setForm] = useState<FormState>(() => buildForm(defaultDate, initialValues));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }, []);

  const toggleRole = useCallback((role: string) => {
    setForm(prev => ({
      ...prev,
      targetRoles: prev.targetRoles.includes(role)
        ? prev.targetRoles.filter(r => r !== role)
        : [...prev.targetRoles, role],
    }));
    setErrors(prev => ({ ...prev, targetRoles: undefined }));
  }, []);

  const reset = useCallback((newDefaultDate?: string) => {
    setForm(buildForm(newDefaultDate ?? defaultDate));
    setErrors({});
  }, [defaultDate]);

  const validate = useCallback((): boolean => {
    const next: typeof errors = {};
    if (!form.title.trim()) next.title = 'กรุณากรอกชื่อกิจกรรม';
    if (!form.startDate) next.startDate = 'กรุณาเลือกวันเริ่มต้น';
    if (!form.endDate) next.endDate = 'กรุณาเลือกวันสิ้นสุด';
    if (form.endDate && form.startDate && form.endDate < form.startDate)
      next.endDate = 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น';
    if (form.targetRoles.length === 0) next.targetRoles = 'กรุณาเลือกอย่างน้อย 1 กลุ่ม';
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form]);

  const getSubmitData = useCallback((): NewCalendarEvent | null => {
    if (!validate()) return null;
    return {
      title: form.title.trim(),
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      targetRoles: form.targetRoles,
      description: form.description.trim() || undefined,
    };
  }, [form, validate]);

  return {
    form,
    errors,
    setField,
    toggleRole,
    reset,
    validate,
    getSubmitData,
  };
}
