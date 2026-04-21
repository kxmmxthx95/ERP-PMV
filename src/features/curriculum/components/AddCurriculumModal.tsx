import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import FormModal from '@/components/ui/FormModal';
import { Skeleton } from '@/components/ui/skeleton';
import { Layout } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อหลักสูตร'),
  year: z.string().min(4, 'กรุณากรอกปีการศึกษา (4 หลัก)').max(4, 'ปีการศึกษาต้อง 4 หลัก'),
});

type FormValues = z.infer<typeof schema>;

interface AddCurriculumModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional: called after successful creation (e.g. to select the new map) */
  onCreated?: (mapId: string) => void;
}

export default function AddCurriculumModal({ open, onClose, onCreated }: AddCurriculumModalProps) {
  const { year: activeYear } = useActiveAcademicYear();
  const { createCurriculum } = useCurriculum();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      year: activeYear ?? '',
    },
  });

  // Sync year field when modal opens / activeYear loads
  useEffect(() => {
    if (open) {
      form.reset({
        name: '',
        year: activeYear ?? '',
      });
    }
  }, [open, activeYear, form]);

  const [isInitialLoading, setIsInitialLoading] = useState(false);
  useEffect(() => {
    if (open) {
      setIsInitialLoading(true);
      const timer = setTimeout(() => setIsInitialLoading(false), 400);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const newMap = await createCurriculum(
        values.name,
        values.year,
        undefined
      );
      toast.success(`สร้างหลักสูตร "${values.name}" สำเร็จ!`);
      onCreated?.(newMap.id);
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'เกิดข้อผิดพลาดในการสร้างหลักสูตร');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="สร้างหลักสูตรสถานศึกษา"
      subtitle="กำหนดชื่อและปีการศึกษาเพื่อเตรียมความพร้อมสำหรับวิชาเรียน"
      icon={<Layout size={18} />}
      onSubmit={form.handleSubmit(handleSubmit)}
      submitLabel={isSubmitting ? 'กำลังสร้าง...' : 'ยืนยันสร้างหลักสูตร'}
      submitDisabled={isSubmitting}
    >
      <Form {...form}>
        <div className="space-y-4 py-2">
          {/* ชื่อหลักสูตร */}
          {isInitialLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : (
            <FormField
              control={form.control}
              name="name"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">
                    ชื่อหลักสูตร <span className="text-red-400">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="เช่น หลักสูตรแกนกลาง 2551 (ฉบับปรับปรุง 2560)"
                      className="h-10 rounded-xl bg-black/[0.03] border-transparent focus:ring-slate-300 transition-all font-medium text-xs"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />
          )}

          {/* ปีการศึกษา */}
          {isInitialLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : (
            <FormField
              control={form.control}
              name="year"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">
                    ปีการศึกษา <span className="text-red-400">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="เช่น 2568"
                      maxLength={4}
                      className="h-10 rounded-xl bg-black/[0.03] border-transparent focus:ring-slate-300 transition-all font-medium text-xs"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />
          )}
        </div>
      </Form>
    </FormModal>
  );
}