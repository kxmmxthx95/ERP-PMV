import { useState, useMemo, useEffect } from 'react';
import { Search, Check, UserPlus, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import FormModal from '@/components/ui/FormModal';
import { useStudentManager } from '@/hooks/useStudentManager';
import type { ClassRoom } from '@/types/class';
import { toast } from 'sonner';

interface ClassAddStudentModalProps {
  open: boolean;
  onClose: () => void;
  targetClass: ClassRoom | null;
}

export default function ClassAddStudentModal({
  open,
  onClose,
  targetClass,
}: ClassAddStudentModalProps) {
  const {
    students,
    enrollments,
    addEnrollment,
    updateEnrollment
  } = useStudentManager(targetClass?.academicYearId);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 1. กรองนักเรียนที่อยู่ในระดับชั้นเดียวกัน และยังไม่มีห้อง หรืออยู่ในห้องนี้อยู่แล้ว
  const availableStudents = useMemo(() => {
    if (!targetClass) return [];

    return students.filter(s => {
      // ค้นหาการลงทะเบียนของนักเรียนในปีและเทอมนี้
      const enrollment = enrollments.find(e =>
        e.studentId === s.id &&
        e.academicYearId === targetClass.academicYearId &&
        e.semester === targetClass.semester
      );

      // เงื่อนไข: 
      // 1. ต้องเป็นนักเรียนสถานะปกติ (active)
      // 2. ถ้ามีผลการลงทะเบียนแล้ว:
      //    - ต้องเป็นระดับชั้นเดียวกัน (gradeLevel)
      //    - ต้องไม่มีห้อง (classId === '') หรือ อยู่ในห้องเป้าหมายนี้ (classId === targetClass.id)

      if (s.status !== 'active') return false;

      if (enrollment) {
        return enrollment.gradeLevel === targetClass.gradeLevel &&
          (!enrollment.classId || enrollment.classId === targetClass.id);
      }

      return false;
    });
  }, [students, enrollments, targetClass]);

  // 2. จัดการสถานะการเลือก (Initial load)
  useEffect(() => {
    if (open && targetClass) {
      const currentInClass = enrollments
        .filter(e => e.classId === targetClass.id && e.semester === targetClass.semester && e.academicYearId === targetClass.academicYearId)
        .map(e => e.studentId);
      setSelectedIds(new Set(currentInClass));
      setSearchTerm('');
    }
  }, [open, targetClass, enrollments]);

  // 3. ค้นหา
  const filtered = availableStudents.filter(s => {
    const q = searchTerm.toLowerCase();
    const fullName = `${s.prefix}${s.firstName} ${s.lastName}`.toLowerCase();
    return fullName.includes(q) || s.studentCode.includes(q);
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSave = async () => {
    if (!targetClass) return;

    try {
      const promises = availableStudents.map(async (s) => {
        const isSelected = selectedIds.has(s.id);
        const enrollment = enrollments.find(e =>
          e.studentId === s.id &&
          e.academicYearId === targetClass.academicYearId &&
          e.semester === targetClass.semester
        );

        if (isSelected) {
          if (enrollment) {
            await updateEnrollment(enrollment.id, {
              classId: targetClass.id,
              className: targetClass.className,
            });
          } else {
            await addEnrollment({
              studentId: s.id,
              classId: targetClass.id,
              className: targetClass.className,
              gradeLevel: targetClass.gradeLevel,
              departmentId: targetClass.departmentId,
              academicYearId: targetClass.academicYearId,
              semester: targetClass.semester,
              status: 'studying',
            });
          }
        } else {
          if (enrollment && enrollment.classId === targetClass.id) {
            await updateEnrollment(enrollment.id, {
              classId: '',
              className: '',
            });
          }
        }
      });

      await Promise.all(promises);
      toast.success(`จัดรายชื่อนักเรียนเข้าห้อง ${targetClass.className} สำเร็จ`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  if (!targetClass) return null;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="จัดนักเรียนเข้าห้องเรียน"
      subtitle={`ปี ${targetClass.academicYearId} · ห้อง ${targetClass.className} · ระดับ ${targetClass.gradeLevel}`}
      icon={<UserPlus size={18} />}
      onSubmit={handleSave}
      submitLabel="บันทึก"
      maxWidth="2xl"
      footerNote={`ระบบจะบันทึกรายชื่อนักเรียนลงในปี ${targetClass.academicYearId}`}
    >
      <div className="relative mt-0">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
        <Input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="ค้นหาชื่อ หรือ เลขประจำตัวนักเรียน..."
          className="w-full h-9 pl-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300"
        />
      </div>

      <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] font-bold text-black/30 uppercase tracking-wider">รายชื่อนักเรียน (ระดับ {targetClass.gradeLevel})</span>
          <span className="text-[10px] font-bold text-black/30">{selectedIds.size} คนที่เลือก</span>
        </div>

        {filtered.length > 0 ? (
          filtered.map(s => (
            <div
              key={s.id}
              onClick={() => toggleSelect(s.id)}
              className={`group flex items-center gap-4 p-3.5 rounded-2xl transition-all cursor-pointer border ${selectedIds.has(s.id)
                  ? 'bg-emerald-50 border-emerald-100 shadow-sm'
                  : 'bg-white border-transparent hover:bg-black/[0.02]'
                }`}
            >
              <Checkbox
                checked={selectedIds.has(s.id)}
                onCheckedChange={() => toggleSelect(s.id)}
                className="rounded-md border-black/10 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-transparent"
              />
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-[12px] font-bold text-slate-400 shrink-0">
                {s.firstName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[12px] font-bold ${selectedIds.has(s.id) ? 'text-emerald-800' : 'text-black/80'}`}>
                  {s.prefix}{s.firstName} {s.lastName}
                </p>
                <p className="text-[10px] text-black/40 font-medium">รหัส: {s.studentCode}</p>
              </div>
              {selectedIds.has(s.id) && (
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                  <Check size={12} strokeWidth={3} />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-black/20">
            <Users size={32} strokeWidth={1.5} className="mb-2 opacity-20" />
            <p className="text-[11px] font-medium italic">ไม่พบนักเรียนที่พร้อมจัดเข้าห้องนี้</p>
          </div>
        )}
      </div>
    </FormModal>
  );
}