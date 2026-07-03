import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { TYPE_CONFIG, type NewQuestionSet, type QuestionSet } from '@/types/questionBank';
import { previewQuestionSetCode } from '@/features/questionBank/utils/questionSetCode';
import { safeStorageFilename, imageUploadContentType } from '@/lib/safeStorageFilename';
import type { GradeBookExerciseContext } from '@/features/grades/utils/exerciseSets';
import { buildExerciseSetPayload } from '@/features/grades/utils/exerciseSets';

interface Props {
  open: boolean;
  onClose: () => void;
  context: GradeBookExerciseContext;
  initial?: QuestionSet | null;
  existingSets?: QuestionSet[];
  onSubmit: (data: NewQuestionSet) => Promise<void> | void;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-sukhumvit">
        {label}{required ? ' *' : ''}
      </label>
      {children}
    </div>
  );
}

export default function ExerciseSetBuilder({
  open,
  onClose,
  context,
  initial,
  existingSets = [],
  onSubmit,
}: Props) {
  const isEdit = Boolean(initial);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [questionType, setQuestionType] = useState(initial?.questionType ?? 'all');
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? '');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setQuestionType(initial?.questionType ?? 'all');
    setCoverImage(initial?.coverImage ?? '');
  }, [open, initial]);

  const canSubmit = useMemo(() => title.trim().length > 0, [title]);

  const previewSetCode = useMemo(() => {
    if (isEdit && initial?.setCode) return initial.setCode;
    return previewQuestionSetCode(
      {
        curriculumYear: context.curriculumYear,
        department: context.departmentId,
        gradeLevel: context.gradeLevel,
        subjectGroup: context.subjectGroup,
      },
      existingSets,
    );
  }, [context, existingSets, initial?.setCode, isEdit]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const base = buildExerciseSetPayload(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        coverImage: coverImage || undefined,
        subjectGroup: context.subjectGroup,
        curriculumYear: context.curriculumYear,
        department: context.departmentId,
        gradeLevel: context.gradeLevel,
        questionType: questionType !== 'all' ? (questionType as NewQuestionSet['questionType']) : undefined,
      },
      context,
    );
    await onSubmit(base);
    onClose();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const storageRef = ref(storage, `question_sets/covers/${safeStorageFilename(file.name)}`);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: imageUploadContentType(file),
    });

    uploadTask.on(
      'state_changed',
      null,
      (error) => {
        console.error(error);
        setIsUploading(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setCoverImage(downloadURL);
        setIsUploading(false);
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-[92vw] sm:max-w-xl rounded-[2rem] border-none p-0 shadow-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        <div className="px-5 sm:px-6 pt-6 pb-2 flex justify-between items-center">
          <DialogTitle className="text-lg font-black text-slate-800 tracking-tight font-sukhumvit">
            {isEdit ? 'แก้ไขแบบฝึกหัด' : 'สร้างแบบฝึกหัด'}
          </DialogTitle>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
          className="px-5 sm:px-6 pb-6 space-y-3 max-h-[80vh] overflow-y-auto"
        >
          <div className="rounded-2xl bg-slate-50/80 border border-slate-100 px-3 py-2.5 text-[11px] font-sarabun text-slate-600">
            <p><span className="font-bold text-slate-700">วิชา:</span> {context.subjectName}</p>
            <p><span className="font-bold text-slate-700">ชั้นเรียน:</span> {context.className} · {context.gradeLevel}</p>
          </div>

          <div className="flex justify-center py-1">
            <div className="relative group w-full max-w-[280px] aspect-[16/9] rounded-2xl bg-slate-100 border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center">
              {coverImage ? (
                <>
                  <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setCoverImage('')}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {isUploading ? (
                    <Loader2 size={22} className="animate-spin text-indigo-500" />
                  ) : (
                    <>
                      <ImagePlus size={22} />
                      <span className="text-[10px] font-black uppercase tracking-wider">อัปโหลดหน้าปก</span>
                    </>
                  )}
                </button>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>

          <p className="px-1 font-mono text-sm font-black tracking-wide text-blue-600">{previewSetCode}</p>

          <Field label="ชื่อแบบฝึกหัด" required>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น แบบฝึกหัดหน่วยที่ 1"
              className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
            />
          </Field>

          <Field label="คำอธิบาย">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
              className="w-full rounded-xl bg-slate-50 border-none px-3 py-2 text-xs font-sarabun outline-none resize-none"
            />
          </Field>

          <Field label="ประเภทข้อ">
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

          <DialogFooter className="pt-2 gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">
              ยกเลิก
            </Button>
            <Button type="submit" disabled={!canSubmit} className="rounded-xl">
              {isEdit ? 'บันทึก' : 'สร้างแบบฝึกหัด'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
