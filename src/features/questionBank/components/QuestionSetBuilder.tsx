import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  SUBJECT_GROUP_CONFIG,
  SUBJECT_SUBGROUP_CONFIG,
  DEPARTMENT_CONFIG,
  type SubjectGroupId,
} from '@/types/curriculum';
import { TYPE_CONFIG, type NewQuestionSet, type QuestionSet } from '@/types/questionBank';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useAuth } from '@/hooks/useAuth';
import { previewQuestionSetCode } from '@/features/questionBank/utils/questionSetCode';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: QuestionSet | null;
  prefill?: Partial<BuilderState> | null;
  existingSets?: QuestionSet[];
  onSubmit: (data: NewQuestionSet) => Promise<void> | void;
}

type BuilderState = {
  title: string;
  description: string;
  subjectGroup: SubjectGroupId;
  subSubjectGroup: string;
  department: string;
  gradeLevel: string;
  questionType: string;
};

const getInitialState = (initial?: QuestionSet | null): BuilderState => {
  if (!initial) {
    return {
      title: '',
      description: '',
      subjectGroup: 'other',
      subSubjectGroup: '',
      department: '',
      gradeLevel: '',
      questionType: 'all',
    };
  }
  return {
    title: initial.title,
    description: initial.description ?? '',
    subjectGroup: initial.subjectGroup,
    subSubjectGroup: initial.subSubjectGroup ?? '',
    department: initial.department ?? '',
    gradeLevel: initial.gradeLevel ?? '',
    questionType: initial.questionType ?? 'all',
  };
};

export default function QuestionSetBuilder({ open, onClose, initial, prefill, existingSets = [], onSubmit }: Props) {
  const { year } = useActiveAcademicYear();
  const { user, userData } = useAuth();
  const isEdit = Boolean(initial);
  const init = {
    ...getInitialState(initial),
    ...(!initial && prefill ? prefill : {}),
  };

  const [title, setTitle] = useState(init.title);
  const [description, setDescription] = useState(init.description);
  const [subjectGroup, setSubjectGroup] = useState<SubjectGroupId>(init.subjectGroup);
  const [subSubjectGroup, setSubSubjectGroup] = useState(init.subSubjectGroup);
  const [department, setDepartment] = useState(init.department);
  const [gradeLevel, setGradeLevel] = useState(init.gradeLevel);
  const [questionType, setQuestionType] = useState(init.questionType);

  const canSubmit = useMemo(() => title.trim().length > 0, [title]);

  const creatorDisplayName = useMemo(() => {
    if (isEdit) return initial?.createdByName?.trim() || 'ไม่ระบุ';
    return userData?.name?.trim()
      || userData?.displayName?.trim()
      || userData?.fullName?.trim()
      || user?.displayName?.trim()
      || 'ไม่ระบุ';
  }, [isEdit, initial?.createdByName, user, userData?.displayName, userData?.name, userData?.fullName]);

  const previewSetCode = useMemo(() => {
    if (isEdit && initial?.setCode) return initial.setCode;
    return previewQuestionSetCode(
      {
        curriculumYear: year ?? '',
        department: department || undefined,
        gradeLevel: gradeLevel || undefined,
        subjectGroup,
        subSubjectGroup: subSubjectGroup || undefined,
      },
      existingSets,
    );
  }, [
    department,
    existingSets,
    gradeLevel,
    initial?.setCode,
    isEdit,
    subjectGroup,
    subSubjectGroup,
    year,
  ]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      coverImage: initial?.coverImage,
      subjectGroup,
      subSubjectGroup: subSubjectGroup || undefined,
      department: department || undefined,
      gradeLevel: gradeLevel || undefined,
      questionType: questionType !== 'all' ? (questionType as NewQuestionSet['questionType']) : undefined,
      curriculumYear: year ?? '',
      createdBy: initial?.createdBy ?? '',
      createdByName: initial?.createdByName ?? '',
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-[92vw] sm:max-w-2xl rounded-[2rem] sm:rounded-[2.5rem] border-none p-0 shadow-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        <div className="px-5 sm:px-6 pt-6 sm:pt-7 pb-2 sm:pb-3 flex justify-between items-center">
          <DialogTitle className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
            {isEdit ? 'แก้ไขชุดข้อสอบ' : 'สร้างชุดข้อสอบ'}
          </DialogTitle>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
          className="px-5 sm:px-6 pb-6 sm:pb-7 space-y-3 max-h-[80vh] overflow-y-auto custom-scrollbar"
        >
          {/* รหัสชุดข้อสอบ — แสดงก่อนชื่อชุด */}
          <p className="px-1 font-mono text-sm font-black tracking-wide text-blue-600">
            {previewSetCode}
          </p>

          <Field label="ครูผู้สร้าง">
            <div className="flex h-9 items-center rounded-xl bg-slate-100 px-4 text-xs font-bold text-slate-600">
              {creatorDisplayName}
            </div>
          </Field>

          {/* Row 1: ชื่อชุด + กลุ่มสาระ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="ชื่อชุดข้อสอบ" required>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น ข้อสอบปลายภาค ม.4"
                className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
              />
            </Field>
            <Field label="กลุ่มสาระ" required>
              <select
                value={subjectGroup}
                onChange={(e) => setSubjectGroup(e.target.value as SubjectGroupId)}
                className="w-full h-9 rounded-xl bg-slate-50 border-none px-3 text-xs font-bold outline-none"
              >
                {Object.entries(SUBJECT_GROUP_CONFIG)
                  .sort(([, a], [, b]) => a.order - b.order)
                  .map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.name}</option>
                  ))}
              </select>
            </Field>
          </div>

          {/* Row: วิชา/สาระย่อย (Conditional) */}
          {SUBJECT_SUBGROUP_CONFIG[subjectGroup] && (
            <div className="grid grid-cols-1 gap-3">
              <Field label="วิชา / สาระย่อย">
                <select
                  value={subSubjectGroup}
                  onChange={(e) => setSubSubjectGroup(e.target.value)}
                  className="w-full h-9 rounded-xl bg-slate-50 border-none px-3 text-xs font-bold outline-none animate-in fade-in slide-in-from-top-1 duration-300"
                >
                  <option value="">เลือกสาระย่อย (ถ้ามี)</option>
                  {SUBJECT_SUBGROUP_CONFIG[subjectGroup]?.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {/* Row 2: ประเภทข้อสอบ */}
          <div className="grid grid-cols-1 gap-3">
            <Field label="ประเภทข้อสอบ">
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
                className="w-full h-9 rounded-xl bg-slate-50 border-none px-3 text-xs font-bold outline-none"
              >
                <option value="all">ทั้งหมด (ปรนัย + อัตนัย)</option>
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Row 3: แผนก + ระดับชั้น */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="แผนก">
              <select
                value={department}
                onChange={(e) => { setDepartment(e.target.value); setGradeLevel(''); }}
                className="w-full h-9 rounded-xl bg-slate-50 border-none px-3 text-xs font-bold outline-none"
              >
                <option value="">เลือกแผนก</option>
                {Object.entries(DEPARTMENT_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </Field>
            <Field label="ระดับชั้น">
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                disabled={!department}
                className="w-full h-9 rounded-xl bg-slate-50 border-none px-3 text-xs font-bold outline-none disabled:opacity-50"
              >
                <option value="">เลือกระดับชั้น</option>
                {department &&
                  DEPARTMENT_CONFIG[department as keyof typeof DEPARTMENT_CONFIG]?.grades.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
              </select>
            </Field>
          </div>

          {/* Row 4: คำอธิบาย */}
          <Field label="คำอธิบายชุดข้อสอบ">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="อธิบายวัตถุประสงค์ของชุดข้อสอบนี้"
              className="w-full rounded-xl bg-slate-50 border-none px-4 py-3 text-xs font-bold text-slate-700 placeholder:text-slate-400 resize-none outline-none"
            />
          </Field>

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
              disabled={!canSubmit}
              className="rounded-xl bg-slate-900 text-white font-bold px-10 h-10 border border-slate-900"
            >
              {isEdit ? 'บันทึกชุดข้อสอบ' : 'สร้างชุดข้อสอบ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
    </div>
  );
}
