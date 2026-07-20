import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useAuth } from '@/hooks/useAuth';
import { useCurriculum } from '@/hooks/useCurriculum';
import type { ExamRoom } from '@/types/exam';
import {
  DEPARTMENT_CONFIG,
  SUBJECT_GROUP_CONFIG,
  SUBJECT_SUBGROUP_CONFIG,
  type Department,
  type SubjectGroupId,
} from '@/types/curriculum';

export interface CreateRoomPrefill {
  title?: string;
  subjectId?: string;
  classId?: string;
  gradeLevel?: string;
}

interface CreateRoomModalProps {
  onClose: () => void;
  onCreate: (data: Omit<ExamRoom, 'id' | 'createdAt' | 'status' | 'currentRound' | 'completedRounds'>) => Promise<ExamRoom>;
  onUpdate: (roomId: string, data: Partial<ExamRoom>) => Promise<void>;
  editRoom?: ExamRoom | null;
  prefill?: CreateRoomPrefill | null;
}

function inferDepartmentFromGrade(gradeLevel?: string): Department | '' {
  if (!gradeLevel) return '';
  if (gradeLevel.startsWith('อ.')) return 'early';
  if (gradeLevel.startsWith('ป.')) return 'primary';
  if (gradeLevel.startsWith('ม.')) return 'secondary';
  return '';
}

export function CreateRoomModal({
  onClose,
  onCreate,
  onUpdate,
  editRoom,
  prefill,
}: CreateRoomModalProps) {
  const { user, userData } = useAuth();
  const { year: academicYear, activeSemester } = useActiveAcademicYear();
  const { classes } = useClassroomManager();
  const { subjects } = useCurriculum();

  const [form, setForm] = useState({
    title: editRoom?.title || prefill?.title || '',
    departmentId: (editRoom?.departmentId as Department) || inferDepartmentFromGrade(prefill?.gradeLevel) || ('' as Department | ''),
    gradeLevel: editRoom?.gradeLevel || prefill?.gradeLevel || '',
    classId: editRoom?.classId || prefill?.classId || '',
    subjectGroupId: (editRoom?.subjectGroupId as SubjectGroupId) || ('' as SubjectGroupId | ''),
    subSubjectGroup: editRoom?.subSubjectGroup || '',
    subjectId: editRoom?.subjectId || prefill?.subjectId || '',
    password: editRoom?.password || '',
    durationMinutes: editRoom?.durationMinutes || 60,
    maxAttempts: editRoom?.settings?.maxAttempts ?? 1,
    shuffleQuestions: editRoom?.settings?.shuffleQuestions || false,
    showResultImmediately: editRoom?.settings?.showResultImmediately || true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm({
      title: editRoom?.title || prefill?.title || '',
      departmentId: (editRoom?.departmentId as Department) || inferDepartmentFromGrade(prefill?.gradeLevel) || ('' as Department | ''),
      gradeLevel: editRoom?.gradeLevel || prefill?.gradeLevel || '',
      classId: editRoom?.classId || prefill?.classId || '',
      subjectGroupId: (editRoom?.subjectGroupId as SubjectGroupId) || ('' as SubjectGroupId | ''),
      subSubjectGroup: editRoom?.subSubjectGroup || '',
      subjectId: editRoom?.subjectId || prefill?.subjectId || '',
      password: editRoom?.password || '',
      durationMinutes: editRoom?.durationMinutes || 60,
      maxAttempts: editRoom?.settings?.maxAttempts ?? 1,
      shuffleQuestions: editRoom?.settings?.shuffleQuestions || false,
      showResultImmediately: (editRoom?.settings?.showResultImmediately ?? true) as true,
    });
  }, [editRoom, prefill]);

  const gradeOptions = form.departmentId ? DEPARTMENT_CONFIG[form.departmentId].grades : [];
  const classOptions = classes.filter((c) => {
    const classDept = c.departmentId || c.department || inferDepartmentFromGrade(c.gradeLevel);
    const passDept = !form.departmentId || classDept === form.departmentId;
    const passGrade = !form.gradeLevel || c.gradeLevel === form.gradeLevel;
    return passDept && passGrade;
  }).sort((a, b) => Number(a.roomNumber) - Number(b.roomNumber));

  const subjectGroupOptions = Object.entries(SUBJECT_GROUP_CONFIG).sort(([, a], [, b]) => a.order - b.order);
  const subSubjectOptions = form.subjectGroupId
    ? SUBJECT_SUBGROUP_CONFIG[form.subjectGroupId as SubjectGroupId] ?? []
    : [];

  const handleSubmit = async () => {
    if (!form.title || !form.password || !user?.uid || !academicYear || !activeSemester) return;
    setIsSubmitting(true);
    try {
      const selectedSubject = subjects.find((s) => s.id === form.subjectId);
      const subjectName = selectedSubject ? selectedSubject.name : (form.subjectId || '');

      const selectedClass = classes.find((c) => c.id === form.classId);
      const className = selectedClass ? `${selectedClass.gradeLevel}/${selectedClass.roomNumber}` : '';

      const now = Date.now();
      const roomData = {
        title: form.title,
        subjectId: form.subjectId,
        subjectName,
        classId: form.classId,
        className,
        password: form.password,
        durationMinutes: form.durationMinutes,
        academicYearId: String(academicYear),
        departmentId: form.departmentId || 'secondary',
        gradeLevel: form.gradeLevel,
        subjectGroupId: form.subjectGroupId,
        subSubjectGroup: form.subSubjectGroup || undefined,
        semester: activeSemester as 1 | 2,
        settings: {
          shuffleQuestions: form.shuffleQuestions,
          showResultImmediately: form.showResultImmediately,
          allowReview: true,
          maxAttempts: form.maxAttempts,
        },
      };

      if (editRoom) {
        await onUpdate(editRoom.id, roomData);
      } else {
        const creatorName =
          [userData?.prefix, userData?.firstName, userData?.lastName].filter(Boolean).join(' ').trim()
          || userData?.displayName
          || userData?.name
          || user?.displayName
          || 'ครู';
        const creatorPhotoURL = userData?.photoURL || user?.photoURL;
        await onCreate({
          ...roomData,
          startTime: now,
          endTime: now + form.durationMinutes * 60 * 1000,
          examPaperId: 'paper-001',
          teacherId: user.uid,
          teacherName: creatorName,
          ...(creatorPhotoURL ? { teacherPhotoURL: creatorPhotoURL } : {}),
          questionCount: 0,
          totalPoints: 0,
        });
      }
      onClose();
    } catch (err) {
      console.error('Error creating exam room:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[92vw] sm:max-w-2xl rounded-[2rem] sm:rounded-[2.5rem] border border-slate-200/60 p-0 overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        <div className="px-5 sm:px-6 pt-6 sm:pt-7 pb-2 sm:pb-3 flex justify-between items-center bg-transparent">
          <DialogTitle className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
            {editRoom ? 'แก้ไขห้องสอบ' : 'สร้างห้องสอบใหม่'}
          </DialogTitle>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="px-5 sm:px-6 pb-6 sm:pb-7 space-y-3 max-h-[80vh] overflow-y-auto custom-scrollbar"
        >
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              ชื่อห้องสอบ <span className="text-rose-400">*</span>
            </label>
            <Input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="เช่น สอบกลางภาค คณิตศาสตร์ ม.3"
              className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 min-w-0">
            <div className="space-y-1 min-w-0">
              <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">แผนก</label>
              <select
                value={form.departmentId}
                onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value as Department, gradeLevel: '', classId: '' }))}
                className="h-9 w-full min-w-0 rounded-xl bg-slate-50 border-none px-2 sm:px-3 text-[11px] sm:text-xs font-bold outline-none"
              >
                <option value="">เลือกแผนก</option>
                {Object.entries(DEPARTMENT_CONFIG).map(([id, cfg]) => (
                  <option key={id} value={id}>{cfg.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1 min-w-0">
              <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">ระดับชั้น</label>
              <select
                value={form.gradeLevel}
                onChange={(e) => setForm((p) => ({ ...p, gradeLevel: e.target.value, classId: '' }))}
                disabled={!form.departmentId}
                className="h-9 w-full min-w-0 rounded-xl bg-slate-50 border-none px-2 sm:px-3 text-[11px] sm:text-xs font-bold outline-none disabled:opacity-50"
              >
                <option value="">เลือกระดับชั้น</option>
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1 min-w-0">
              <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">ห้องเรียน</label>
              <select
                value={form.classId}
                onChange={(e) => setForm((p) => ({ ...p, classId: e.target.value }))}
                disabled={!form.departmentId}
                className="h-9 w-full min-w-0 rounded-xl bg-slate-50 border-none px-2 sm:px-3 text-[11px] sm:text-xs font-bold outline-none disabled:opacity-50"
              >
                <option value="">เลือกห้องเรียน</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.gradeLevel}/{c.roomNumber}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">กลุ่มสาระ</label>
              <select
                value={form.subjectGroupId}
                onChange={(e) => setForm((p) => ({
                  ...p,
                  subjectGroupId: e.target.value as SubjectGroupId,
                  subSubjectGroup: '',
                }))}
                className="h-9 w-full rounded-xl bg-slate-50 border-none px-3 text-xs font-bold outline-none"
              >
                <option value="">เลือกกลุ่มสาระ</option>
                {subjectGroupOptions.map(([id, cfg]) => (
                  <option key={id} value={id}>{cfg.name}</option>
                ))}
              </select>
            </div>

            {subSubjectOptions.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">วิชา / สาระย่อย</label>
                <select
                  value={form.subSubjectGroup}
                  onChange={(e) => setForm((p) => ({ ...p, subSubjectGroup: e.target.value }))}
                  className="h-9 w-full rounded-xl bg-slate-50 border-none px-3 text-xs font-bold outline-none"
                >
                  <option value="">เลือกสาระย่อย (ถ้ามี)</option>
                  {subSubjectOptions.map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                รหัสเข้าห้องสอบ <span className="text-rose-400">*</span>
              </label>
              <Input
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="1234"
                className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">เวลา (นาที)</label>
              <Input
                type="number"
                min={1}
                value={form.durationMinutes}
                onChange={(e) => setForm((p) => ({ ...p, durationMinutes: Number(e.target.value) }))}
                className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">จำนวนครั้งที่สอบได้</label>
              <select
                value={form.maxAttempts}
                onChange={(e) => setForm((p) => ({ ...p, maxAttempts: Number(e.target.value) }))}
                className="h-9 w-full rounded-xl bg-slate-50 border-none px-3 text-xs font-bold outline-none"
              >
                <option value={0}>ไม่จำกัด</option>
                <option value={1}>1 ครั้ง</option>
                <option value={2}>2 ครั้ง</option>
                <option value={3}>3 ครั้ง</option>
              </select>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="rounded-xl font-bold text-slate-500 h-10"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !form.title || !form.password}
              className="rounded-xl bg-slate-900 text-white font-bold px-10 h-10 border border-slate-800"
            >
              {isSubmitting ? 'กำลังบันทึก...' : editRoom ? 'บันทึกการแก้ไข' : 'สร้างห้องสอบ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
