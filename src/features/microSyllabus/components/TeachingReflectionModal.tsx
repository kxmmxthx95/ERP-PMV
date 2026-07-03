import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { HiOutlineXMark } from 'react-icons/hi2';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { fetchStudentsByIds } from '@/lib/firestoreShared/fetchStudentsByIds';
import { cn } from '@/lib/utils';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import type {
  TeachingOverview,
  TeachingPlanStatus,
  TeachingReflection,
  TeachingReflectionStudent,
} from '@/types/microSyllabus';

const PLAN_STATUS_OPTIONS: { value: TeachingPlanStatus; label: string }[] = [
  { value: 'on_plan', label: 'ตามแผน' },
  { value: 'off_plan', label: 'หลุดแผน' },
];

const OVERVIEW_OPTIONS: { value: TeachingOverview; label: string }[] = [
  { value: 'good', label: 'ดี' },
  { value: 'medium', label: 'ปานกลาง' },
  { value: 'review', label: 'ทบทวนใหม่' },
];

type ClassStudentOption = TeachingReflectionStudent;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (reflection: TeachingReflection) => Promise<void>;
  classId?: string;
  dateLabel?: string;
}

function RadioCard<T extends string>({
  name,
  value,
  checked,
  label,
  onSelect,
}: {
  name: string;
  value: T;
  checked: boolean;
  label: string;
  onSelect: (value: T) => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-black font-sukhumvit transition-colors',
        checked
          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      {label}
    </label>
  );
}

export default function TeachingReflectionModal({
  open,
  onClose,
  onSubmit,
  classId,
  dateLabel,
}: Props) {
  const { allClasses } = useClassroomManager();
  const [planStatus, setPlanStatus] = useState<TeachingPlanStatus>('on_plan');
  const [overview, setOverview] = useState<TeachingOverview>('good');
  const [studentQuery, setStudentQuery] = useState('');
  const [problemStudents, setProblemStudents] = useState<TeachingReflectionStudent[]>([]);
  const [additionalRequest, setAdditionalRequest] = useState('');
  const [classStudents, setClassStudents] = useState<ClassStudentOption[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlanStatus('on_plan');
    setOverview('good');
    setStudentQuery('');
    setProblemStudents([]);
    setAdditionalRequest('');
  }, [open]);

  useEffect(() => {
    if (!open || !classId) {
      setClassStudents([]);
      return;
    }

    let cancelled = false;

    async function loadStudents() {
      setLoadingStudents(true);
      try {
        const classDoc = allClasses.find((item) => item.id === classId) as
          | (typeof allClasses)[number] & { studentIds?: string[] }
          | undefined;
        const classStudentIds = (classDoc?.studentIds || []).filter(
          (id): id is string => typeof id === 'string' && id.trim() !== '',
        );

        let studentRows: ClassStudentOption[] = [];

        if (classStudentIds.length > 0) {
          const students = await fetchStudentsByIds<{
            id: string;
            studentCode?: string;
            prefix?: string;
            firstName?: string;
            lastName?: string;
          }>(classStudentIds);
          studentRows = students.map((student) => ({
            id: student.id,
            code: student.studentCode,
            name: `${student.prefix ?? ''}${student.firstName ?? ''} ${student.lastName ?? ''}`.trim(),
          }));
        } else {
          const enrollSnap = await getDocs(
            query(collection(db, 'enrollments'), where('classId', '==', classId)),
          );
          const enrollmentStudentIds = enrollSnap.docs
            .map((snap) => snap.data().studentId as string | undefined)
            .filter((id): id is string => typeof id === 'string' && id.trim() !== '');

          if (enrollmentStudentIds.length > 0) {
            const students = await fetchStudentsByIds<{
              id: string;
              studentCode?: string;
              prefix?: string;
              firstName?: string;
              lastName?: string;
            }>(enrollmentStudentIds);
            studentRows = students.map((student) => ({
              id: student.id,
              code: student.studentCode,
              name: `${student.prefix ?? ''}${student.firstName ?? ''} ${student.lastName ?? ''}`.trim(),
            }));
          }
        }

        if (!cancelled) {
          setClassStudents(
            studentRows.sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name, 'th')),
          );
        }
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    }

    void loadStudents();

    return () => {
      cancelled = true;
    };
  }, [open, classId, allClasses]);

  const filteredStudents = useMemo(() => {
    if (studentQuery.trim().length < 5) return [];
    const q = studentQuery.trim().toLowerCase();
    const selectedIds = new Set(problemStudents.map((student) => student.id));

    return classStudents
      .filter((student) => !selectedIds.has(student.id))
      .filter((student) => {
        const haystack = `${student.name} ${student.code ?? ''}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 8);
  }, [classStudents, problemStudents, studentQuery]);

  const addProblemStudent = (student: ClassStudentOption) => {
    setProblemStudents((current) => [...current, student]);
    setStudentQuery('');
  };

  const removeProblemStudent = (studentId: string) => {
    setProblemStudents((current) => current.filter((student) => student.id !== studentId));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSubmit({
        planStatus,
        overview,
        problemStudents: problemStudents.length > 0 ? problemStudents : undefined,
        additionalRequest: additionalRequest.trim() || undefined,
        recordedAt: new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 p-0 sm:max-w-lg">
        <div className="border-b border-slate-100 px-5 py-4">
          <DialogTitle className="text-base font-black text-slate-800 font-sukhumvit">
            บันทึกผลหลังการสอน
          </DialogTitle>
          {dateLabel && (
            <DialogDescription className="mt-1 text-xs text-slate-500 font-sarabun">
              {dateLabel}
            </DialogDescription>
          )}
        </div>

        <div className="space-y-5 px-5 py-4">
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 font-sukhumvit">
              สถานะ
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PLAN_STATUS_OPTIONS.map((option) => (
                <RadioCard
                  key={option.value}
                  name="plan-status"
                  value={option.value}
                  checked={planStatus === option.value}
                  label={option.label}
                  onSelect={setPlanStatus}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 font-sukhumvit">
              ภาพรวม
            </p>
            <div className="grid grid-cols-3 gap-2">
              {OVERVIEW_OPTIONS.map((option) => (
                <RadioCard
                  key={option.value}
                  name="overview"
                  value={option.value}
                  checked={overview === option.value}
                  label={option.label}
                  onSelect={setOverview}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="problem-student-search"
              className="text-[11px] font-black uppercase tracking-wide text-slate-500 font-sukhumvit"
            >
              นักเรียนที่มีปัญหา
            </label>
            <p className="text-[11px] text-slate-400 font-sarabun">ไม่จำเป็นต้องใส่ก็ได้</p>
            <input
              id="problem-student-search"
              value={studentQuery}
              onChange={(event) => setStudentQuery(event.target.value)}
              placeholder="ค้นหาชื่อนักเรียน (อย่างน้อย 5 ตัวอักษร)"
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-sarabun text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
            {studentQuery.trim().length > 0 && studentQuery.trim().length < 5 && (
              <p className="text-[11px] font-bold text-slate-400 font-sarabun">
                พิมพ์อย่างน้อย 5 ตัวอักษรเพื่อค้นหา
              </p>
            )}
            {loadingStudents && studentQuery.trim().length >= 5 && (
              <p className="text-[11px] font-bold text-slate-400 font-sarabun">กำลังโหลดรายชื่อนักเรียน...</p>
            )}
            {!loadingStudents && studentQuery.trim().length >= 5 && filteredStudents.length === 0 && (
              <p className="text-[11px] font-bold text-slate-400 font-sarabun">ไม่พบนักเรียนที่ตรงกับคำค้นหา</p>
            )}
            {filteredStudents.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {filteredStudents.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => addProblemStudent(student)}
                    className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-slate-50"
                  >
                    <span className="text-sm font-bold text-slate-800 font-sarabun">{student.name}</span>
                    {student.code && (
                      <span className="text-[11px] font-bold text-slate-400">{student.code}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {problemStudents.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {problemStudents.map((student) => (
                  <span
                    key={student.id}
                    className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-700"
                  >
                    {student.name}
                    <button
                      type="button"
                      onClick={() => removeProblemStudent(student.id)}
                      className="rounded-full p-0.5 hover:bg-rose-100"
                      aria-label={`ลบ ${student.name}`}
                    >
                      <HiOutlineXMark size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="additional-request"
              className="text-[11px] font-black uppercase tracking-wide text-slate-500 font-sukhumvit"
            >
              คำร้องขอเพิ่มเติม
            </label>
            <textarea
              id="additional-request"
              value={additionalRequest}
              onChange={(event) => setAdditionalRequest(event.target.value)}
              rows={4}
              placeholder="ระบุสิ่งที่ต้องการให้โรงเรียนช่วยเหลือหรือติดตามเพิ่มเติม..."
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-sarabun text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-slate-100 px-5 py-4 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="h-11 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกผลการสอน'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
