import { useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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

const schema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อหลักสูตร'),
  year: z.string().min(4, 'กรุณากรอกปีการศึกษา (4 หลัก)').max(4, 'ปีการศึกษาต้อง 4 หลัก'),
  department: z.enum(['early', 'primary', 'secondary']).refine(v => v, 'กรุณาเลือกแผนก'),
  gradeLevel: z.string().min(1, 'กรุณาเลือกระดับชั้น'),
  semester: z.enum(['1', '2']).refine(v => v, 'กรุณาเลือกภาคเรียน'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface AddCurriculumModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AddCurriculumModal({ open, onClose }: AddCurriculumModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      year: '',
      department: 'early',
      gradeLevel: '',
      semester: '1',
      description: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: '',
        year: '',
        department: 'early',
        gradeLevel: '',
        semester: '1',
        description: ''
      });
    }
  }, [open, form]);

  // ดึงระดับชั้นตามแผนกที่เลือก
  const selectedDepartment = form.watch('department');

  // Reset gradeLevel เมื่อเปลี่ยน department
  useEffect(() => {
    form.setValue('gradeLevel', '');
  }, [selectedDepartment, form]);

  const handleSubmit = (values: FormValues) => {
    console.log('Create Curriculum:', values);
    toast.success(`สร้างหลักสูตร ${values.name} สำเร็จ!`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-3xl shadow-2xl sm:max-w-[400px] p-6">
        <DialogHeader className="flex flex-row items-center gap-3 border-b border-black/5 pb-4 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#1e1e1e] flex items-center justify-center shadow-md flex-shrink-0">
            <BookOpen className="text-white" size={18} />
          </div>
          <div className="flex flex-col items-start">
            <DialogTitle className="text-sm font-bold text-black/80">สร้างหลักสูตรใหม่</DialogTitle>
            <p className="text-xs text-black/40 mt-0.5">กำหนดรายละเอียดสำหรับหลักสูตรสถานศึกษา</p>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    ชื่อหลักสูตร <span className="text-red-400">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="เช่น หลักสูตรแกนกลาง 2551 (ฉบับปรับปรุง 2560)"
                      className="h-9 text-xs rounded-xl bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px] font-medium" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="year"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    ปีการศึกษาที่เริ่มใช้ <span className="text-red-400">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="เช่น 2568"
                      maxLength={4}
                      className="h-9 text-xs rounded-xl bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none w-full sm:w-1/2"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px] font-medium" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    คำอธิบายเพิ่มเติม
                  </FormLabel>
                  <FormControl>
                    <textarea
                      placeholder="รายละเอียดย่อ..."
                      rows={3}
                      className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 outline-none transition-all resize-none focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px] font-medium" />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2 gap-2 sm:gap-0 border-t border-black/5 mt-2 pt-4">
              <Button type="button" variant="ghost" onClick={onClose} className="h-8 text-[11px] rounded-lg hover:bg-slate-100 font-medium">
                ยกเลิก
              </Button>
              <Button type="submit" className="h-8 text-[11px] rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white font-medium">
                สร้างหลักสูตร
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}