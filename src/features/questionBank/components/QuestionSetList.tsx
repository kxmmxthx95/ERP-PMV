import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Layers3, Pencil, Trash2, PlayCircle } from 'lucide-react';
import {
  HiOutlineCog6Tooth,
  HiOutlineEye,
  HiOutlineXMark,
  HiExclamationCircle,
} from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { SubjectFolderCard } from '@/components/SubjectFolderCard';
import { PdfPageViewer } from '@/features/exam/components/PdfExamViewer';
import { cn } from '@/lib/utils';
import {
  loadFolderCardColors,
  saveFolderCardColors,
  type FolderCardColorId,
} from '@/lib/subjectFolderCardColors';
import { SUBJECT_GROUP_CONFIG, type SubjectGroupId } from '@/types/curriculum';
import type { QuestionSet } from '@/types/questionBank';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import { resolveQuestionSetCreatorName } from '@/features/questionBank/utils/questionSetCreatorName';

interface Props {
  sets: QuestionSet[];
  isStudentView?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  onSelect: (set: QuestionSet) => void;
  onEdit: (set: QuestionSet) => void;
  onDelete: (set: QuestionSet) => void;
  onSimulate?: (set: QuestionSet) => void;
  onTogglePublished?: (set: QuestionSet, isPublished: boolean) => void;
}

/** มี PDF แล้วแต่ยังไม่บันทึกเฉลย (คำถามใน subcollection) */
function isPdfAnswerKeyMissing(set: QuestionSet): boolean {
  return Boolean(set.examPdfUrl?.trim()) && (set.questionCount ?? 0) === 0;
}

const QB_SET_FOLDER_COLOR_KEY = 'pmv:question-bank-set-folder-colors:v1';
const FOLDER_GRID_CLASS = 'grid w-full grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 xl:grid-cols-4';
const ACTIONS_PLATE_W = 200;
const ACTIONS_PLATE_H = 220;
const ACTIONS_PLATE_GAP = 8;

const SUBJECT_GROUP_FOLDER_COLOR: Record<SubjectGroupId, FolderCardColorId> = {
  thai: 'rose',
  math: 'blue',
  science: 'emerald',
  social: 'orange',
  pe: 'rose',
  arts: 'violet',
  careers: 'slate',
  foreign: 'sky',
  examM4: 'violet',
  onet: 'amber',
  alevel: 'emerald',
  other: 'slate',
};

function folderColorForSubjectGroup(subjectGroup: SubjectGroupId): FolderCardColorId {
  return SUBJECT_GROUP_FOLDER_COLOR[subjectGroup] ?? 'slate';
}

function SetActionsPlate({
  set,
  anchorRect,
  onClose,
  onEdit,
  onDelete,
  onPreviewPdf,
  onTogglePublished,
}: {
  set: QuestionSet;
  anchorRect: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPreviewPdf: () => void;
  onTogglePublished?: (isPublished: boolean) => void;
}) {
  const placeBelow = anchorRect.top < ACTIONS_PLATE_H + ACTIONS_PLATE_GAP + 12;
  let left = anchorRect.left + anchorRect.width / 2 - ACTIONS_PLATE_W / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - ACTIONS_PLATE_W - 8));
  const top = placeBelow
    ? Math.min(
        anchorRect.bottom + ACTIONS_PLATE_GAP,
        window.innerHeight - ACTIONS_PLATE_H - 8,
      )
    : Math.max(8, anchorRect.top - ACTIONS_PLATE_H - ACTIONS_PLATE_GAP);

  const hasPdf = Boolean(set.examPdfUrl?.trim());
  const answerMissing = isPdfAnswerKeyMissing(set);

  return createPortal(
    <>
      <button
        type="button"
        aria-label="ปิดเมนู"
        className="fixed inset-0 z-[80] cursor-default bg-transparent"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={`จัดการ ${set.title}`}
        className="fixed z-[90] w-[12.5rem] rounded-2xl border border-white/50 bg-white/55 p-2 shadow-lg backdrop-blur-xl"
        style={{ top, left }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="mb-1.5 px-1.5 pt-0.5 text-center font-sukhumvit text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          จัดการ
        </p>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2">
            <span className="font-sukhumvit text-[12px] font-bold text-foreground">
              {set.isPublished ? 'เปิดให้นักเรียนเห็น' : 'ปิดจากนักเรียน'}
            </span>
            <Switch
              checked={set.isPublished}
              onCheckedChange={(checked) => onTogglePublished?.(checked)}
              aria-label={
                set.isPublished
                  ? `ปิดไม่ให้นักเรียนเห็น ${set.title}`
                  : `เปิดให้นักเรียนเห็น ${set.title}`
              }
            />
          </div>

          {answerMissing && (
            <div className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-amber-600">
              <HiExclamationCircle className="h-4 w-4 shrink-0" />
              <span className="font-sukhumvit text-[12px] font-bold">ยังไม่ได้ตั้งค่าเฉลย</span>
            </div>
          )}

          {hasPdf ? (
            <button
              type="button"
              onClick={() => {
                onPreviewPdf();
                onClose();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-sukhumvit text-[12px] font-bold text-foreground hover:bg-white/60"
            >
              <HiOutlineEye className="h-4 w-4 shrink-0 text-muted-foreground" />
              ดูตัวอย่าง PDF
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-destructive">
              <HiExclamationCircle className="h-4 w-4 shrink-0" />
              <span className="font-sukhumvit text-[12px] font-bold">ยังไม่มี PDF</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              onEdit();
              onClose();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-sukhumvit text-[12px] font-bold text-foreground hover:bg-white/60"
          >
            <Pencil size={14} className="shrink-0 text-muted-foreground" />
            แก้ไขชุดข้อสอบ
          </button>

          <button
            type="button"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-sukhumvit text-[12px] font-bold text-destructive hover:bg-destructive/10"
          >
            <Trash2 size={14} className="shrink-0" />
            ลบชุดข้อสอบ
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

function SetActionsGear({
  set,
  onEdit,
  onDelete,
  onPreviewPdf,
  onTogglePublished,
}: {
  set: QuestionSet;
  onEdit: () => void;
  onDelete: () => void;
  onPreviewPdf: () => void;
  onTogglePublished?: (isPublished: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const syncAnchor = () => {
    if (btnRef.current) setAnchorRect(btnRef.current.getBoundingClientRect());
  };

  useEffect(() => {
    if (!open) return;
    syncAnchor();
    const onReposition = () => syncAnchor();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          syncAnchor();
          setOpen((v) => !v);
        }}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-card/80 text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground',
          open && 'border-foreground/20 bg-muted text-foreground',
        )}
        title="จัดการชุดข้อสอบ"
        aria-label={`จัดการ ${set.title}`}
        aria-expanded={open}
      >
        <HiOutlineCog6Tooth className="h-4 w-4" />
      </button>

      {open && anchorRect && (
        <SetActionsPlate
          set={set}
          anchorRect={anchorRect}
          onClose={() => setOpen(false)}
          onEdit={onEdit}
          onDelete={onDelete}
          onPreviewPdf={onPreviewPdf}
          onTogglePublished={onTogglePublished}
        />
      )}
    </>
  );
}

export default function QuestionSetList({
  sets,
  isStudentView = false,
  emptyTitle = 'ไม่พบชุดข้อสอบ',
  emptyHint = 'ลองเปลี่ยนตัวกรองหรือค้นหาด้วยคำอื่น',
  onSelect,
  onEdit,
  onDelete,
  onSimulate,
  onTogglePublished,
}: Props) {
  const { teachers } = useTeachersCollection();
  const [pdfPreview, setPdfPreview] = useState<QuestionSet | null>(null);
  const [folderColors, setFolderColors] = useState<Record<string, FolderCardColorId>>(() =>
    loadFolderCardColors(QB_SET_FOLDER_COLOR_KEY),
  );

  const setFolderColor = useCallback((key: string, id: FolderCardColorId) => {
    setFolderColors((prev) => {
      const next = { ...prev, [key]: id };
      saveFolderCardColors(next, QB_SET_FOLDER_COLOR_KEY);
      return next;
    });
  }, []);

  if (sets.length === 0) {
    return (
      <div className="flex min-h-full w-full flex-1 flex-col items-center justify-center rounded-2xl border border-border bg-card/50 py-10 text-center text-muted-foreground">
        <Layers3 size={40} className="mb-3 opacity-50" />
        <p className="text-[13px] font-bold font-sukhumvit">{emptyTitle}</p>
        <p className="mt-1 text-[11px] font-sarabun">{emptyHint}</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn(FOLDER_GRID_CLASS, 'px-0.5 py-2 pb-6')}>
        {sets.map((set) => {
          const groupCfg = SUBJECT_GROUP_CONFIG[set.subjectGroup] ?? SUBJECT_GROUP_CONFIG.other;
          const colorKey = set.id;
          const qCount = set.questionCount ?? 0;
          const creatorName = resolveQuestionSetCreatorName(set, teachers);
          const subtitle = creatorName || set.setCode?.trim() || groupCfg.name;
          const pdfAnswerMissing = isPdfAnswerKeyMissing(set);
          const needsContent =
            (qCount === 0 && !set.examPdfUrl?.trim())
            || pdfAnswerMissing;
          const warnLabel = pdfAnswerMissing
            ? 'อัปโหลด PDF แล้ว แต่ยังไม่มีเฉลย'
            : 'ยังไม่มีข้อสอบหรือไฟล์ PDF';

          return (
            <div key={set.id} className="flex flex-col items-center gap-1.5">
              <SubjectFolderCard
                title={set.title}
                subtitle={subtitle}
                meta={(
                  <div className="flex flex-wrap items-center justify-center gap-1 pt-0.5">
                    <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary font-sukhumvit">
                      {qCount.toLocaleString('th-TH')} ข้อ
                    </span>
                    {set.gradeLevel ? (
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground font-sukhumvit">
                        {set.gradeLevel}
                      </span>
                    ) : null}
                  </div>
                )}
                colorId={folderColors[colorKey] ?? folderColorForSubjectGroup(set.subjectGroup)}
                onColorChange={(id) => setFolderColor(colorKey, id)}
                onClick={() => {
                  if (isStudentView) {
                    onSimulate?.(set);
                    return;
                  }
                  onSelect(set);
                }}
                imageSrc="/p2.png"
                centerBadge={
                  needsContent ? (
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md ring-2 ring-background"
                      title={warnLabel}
                      aria-label={warnLabel}
                    >
                      <HiExclamationCircle className="h-5 w-5" />
                    </span>
                  ) : undefined
                }
              />

              {isStudentView ? (
                <button
                  type="button"
                  onClick={() => onSimulate?.(set)}
                  disabled={!set.examPdfUrl?.trim() || qCount === 0}
                  className="flex h-8 items-center gap-1.5 rounded-xl bg-primary px-3 text-primary-foreground transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  title="จำลองการสอบ"
                  aria-label={`จำลองการสอบ ${set.title}`}
                >
                  <PlayCircle size={14} />
                  <span className="font-sukhumvit text-[11px] font-black">จำลองสอบ</span>
                </button>
              ) : (
                <SetActionsGear
                  set={set}
                  onEdit={() => onEdit(set)}
                  onDelete={() => onDelete(set)}
                  onPreviewPdf={() => setPdfPreview(set)}
                  onTogglePublished={(checked) => onTogglePublished?.(set, checked)}
                />
              )}
            </div>
          );
        })}
      </div>

      <Sheet open={pdfPreview !== null} onOpenChange={(next) => { if (!next) setPdfPreview(null); }}>
        <SheetContent
          side="right"
          showCloseButton={false}
          aria-describedby={undefined}
          className={cn(
            '!inset-0 !left-0 !right-0 !top-0 !bottom-0',
            '!h-dvh !w-screen !max-w-none sm:!max-w-none',
            '!rounded-none border-0 p-0 flex flex-col overflow-hidden bg-background',
          )}
        >
          {pdfPreview?.examPdfUrl ? (
            <>
              <SheetHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-border px-4 py-3 text-left sm:px-5 shrink-0">
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate font-sukhumvit text-base font-black leading-snug text-foreground">
                    {pdfPreview.title}
                  </SheetTitle>
                  {pdfPreview.examPdfFileName ? (
                    <p className="mt-0.5 truncate text-[11px] font-bold text-muted-foreground">{pdfPreview.examPdfFileName}</p>
                  ) : null}
                </div>
                <SheetClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  >
                    <HiOutlineXMark className="h-4 w-4" />
                    <span className="sr-only">ปิด</span>
                  </Button>
                </SheetClose>
              </SheetHeader>
              <div className="min-h-0 flex-1 p-3">
                <PdfPageViewer url={pdfPreview.examPdfUrl} className="h-full min-h-0" />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
