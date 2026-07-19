import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Layers3, Pencil, Trash2, Copy, PlayCircle } from 'lucide-react';
import { HiOutlineEye, HiOutlineXMark, HiExclamationCircle } from 'react-icons/hi2';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { PdfPageViewer } from '@/features/exam/components/PdfExamViewer';
import { cn } from '@/lib/utils';
import { SubSubjectGroupBadge } from '@/components/school/SubSubjectGroupBadge';
import { SUBJECT_GROUP_CONFIG, DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';
import type { QuestionSet } from '@/types/questionBank';

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

async function copySetCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    toast.success('คัดลอกรหัสชุดข้อสอบแล้ว');
  } catch {
    toast.error('ไม่สามารถคัดลอกได้');
  }
}

/** มี PDF แล้วแต่ยังไม่บันทึกเฉลย (คำถามใน subcollection) */
function isPdfAnswerKeyMissing(set: QuestionSet): boolean {
  return Boolean(set.examPdfUrl?.trim()) && (set.questionCount ?? 0) === 0;
}

const ITEMS_PER_PAGE = 10;

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
  const [pdfPreview, setPdfPreview] = useState<QuestionSet | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(sets.length / ITEMS_PER_PAGE));
  const setIdsKey = sets.map((s) => s.id).join(',');

  useEffect(() => {
    setCurrentPage(1);
  }, [setIdsKey]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedSets = sets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const rangeStart = sets.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min(currentPage * ITEMS_PER_PAGE, sets.length);

  if (sets.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white/50 py-10 text-center text-slate-400">
        <Layers3 size={40} className="mb-3 opacity-50" />
        <p className="text-[13px] font-bold text-slate-500 font-sukhumvit">{emptyTitle}</p>
        <p className="mt-1 text-[11px] font-sarabun">{emptyHint}</p>
      </div>
    );
  }

  return (
    <>
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      <div className="flex-1 min-w-0 space-y-2 overflow-y-auto overflow-x-hidden px-0.5 py-2">
      {paginatedSets.map((set, i) => {
        const groupCfg = SUBJECT_GROUP_CONFIG[set.subjectGroup] ?? SUBJECT_GROUP_CONFIG.other;
        const deptCfg = set.department && set.department in DEPARTMENT_CONFIG
          ? DEPARTMENT_CONFIG[set.department as Department]
          : null;
        return (
          <motion.div
            key={set.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.025 }}
            onClick={isStudentView ? undefined : () => onSelect(set)}
            className={cn(
              'relative overflow-hidden rounded-2xl bg-white px-3 py-3 sm:px-4 sm:pb-10 transition-all group shadow-[0_2px_8px_rgba(15,23,42,0.035)]',
              isStudentView ? '' : 'cursor-pointer hover:bg-slate-50/80',
            )}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-3 sm:gap-4">
              {set.coverImage && (
                <div className="shrink-0 w-16 sm:w-20 aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img src={set.coverImage} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1 sm:pr-28">
                {set.setCode && (
                  <div className="mb-1 flex items-center gap-0.5 min-w-0">
                    <span className="max-w-full truncate rounded-full border border-blue-600 bg-white px-2 py-0.5 font-mono text-[10px] font-black text-blue-600">
                      {set.setCode}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void copySetCode(set.setCode!);
                      }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600"
                      title="คัดลอกรหัสชุดข้อสอบ"
                      aria-label="คัดลอกรหัสชุดข้อสอบ"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                )}
                <p className="truncate text-[13px] font-black text-slate-800 font-sukhumvit">{set.title}</p>
                {set.createdByName && (
                  <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400 font-sarabun">
                    สร้างโดย {set.createdByName}
                  </p>
                )}
                {set.description && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 font-sarabun">{set.description}</p>
                )}
              </div>
              </div>

              <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-0.5 sm:absolute sm:right-3 sm:top-3 sm:w-auto">
                {isStudentView ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSimulate?.(set);
                    }}
                    disabled={!set.examPdfUrl?.trim() || (set.questionCount ?? 0) === 0}
                    className="flex h-8 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title="จำลองการสอบ"
                    aria-label={`จำลองการสอบ ${set.title}`}
                  >
                    <PlayCircle size={14} />
                    <span className="font-sukhumvit text-[11px] font-black">จำลองสอบ</span>
                  </button>
                ) : (
                  <>
                    <div
                      className="mr-1 flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <span
                        className={cn(
                          'hidden font-sarabun text-[10px] font-bold sm:inline',
                          set.isPublished ? 'text-emerald-600' : 'text-slate-400',
                        )}
                      >
                        {set.isPublished ? 'เปิด' : 'ปิด'}
                      </span>
                      <Switch
                        checked={set.isPublished}
                        onCheckedChange={(checked) => onTogglePublished?.(set, checked)}
                        aria-label={
                          set.isPublished
                            ? `ปิดไม่ให้นักเรียนเห็น ${set.title}`
                            : `เปิดให้นักเรียนเห็น ${set.title}`
                        }
                        title={set.isPublished ? 'นักเรียนเห็นชุดนี้' : 'นักเรียนยังไม่เห็นชุดนี้'}
                      />
                    </div>
                    {isPdfAnswerKeyMissing(set) && (
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        title="ยังไม่ได้ตั้งค่าเฉลย"
                        aria-label={`${set.title} — ยังไม่ได้ตั้งค่าเฉลย`}
                      >
                        <HiExclamationCircle className="w-5 h-5 text-amber-500" />
                      </span>
                    )}
                    {set.examPdfUrl ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPdfPreview(set);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                        title="ดูตัวอย่าง PDF"
                        aria-label={`ดูตัวอย่าง PDF ${set.title}`}
                      >
                        <HiOutlineEye className="w-4 h-4" />
                      </button>
                    ) : (
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        title="ยังไม่ได้อัปโหลด PDF ข้อสอบ"
                        aria-label={`${set.title} — ยังไม่ได้อัปโหลด PDF ข้อสอบ`}
                      >
                        <HiExclamationCircle className="w-5 h-5 text-red-500" />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onEdit(set); }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      title="แก้ไขชุดข้อสอบ"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDelete(set); }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                      title="ลบชุดข้อสอบ"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>

            <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:absolute sm:bottom-3 sm:right-4 sm:max-w-[calc(100%-2rem)] sm:justify-end">
              {set.gradeLevel && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-black font-sukhumvit"
                  style={
                    deptCfg
                      ? { color: deptCfg.color, background: deptCfg.bg, border: `1px solid ${deptCfg.border}` }
                      : { color: '#475569', background: '#f1f5f9' }
                  }
                >
                  {set.gradeLevel}
                </span>
              )}
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase font-sukhumvit"
                style={{ color: groupCfg.color, background: groupCfg.bg, border: `1px solid ${groupCfg.border}` }}
              >
                {groupCfg.name}
              </span>
              {set.subSubjectGroup && (
                <SubSubjectGroupBadge
                  label={set.subSubjectGroup}
                  subjectGroupId={set.subjectGroup}
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  maxWidth="140px"
                />
              )}
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-600 shrink-0">
                {set.questionCount ?? 0} ข้อ
              </span>
            </div>
            </div>
          </motion.div>
        );
      })}
      </div>

      <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
        <p className="font-sarabun text-[11px] font-bold text-slate-500">
          แสดง {rangeStart}–{rangeEnd} จาก {sets.length} ชุด
        </p>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              aria-label="หน้าก่อนหน้า"
            >
              <ChevronLeft size={16} />
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => {
                if (totalPages > 5) {
                  if (page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 1) {
                    if (page === 2 || page === totalPages - 1) {
                      return (
                        <span key={`ellipsis-${page}`} className="px-0.5 font-sarabun text-[10px] text-slate-300">
                          …
                        </span>
                      );
                    }
                    return null;
                  }
                }

                const isActive = currentPage === page;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      'h-8 min-w-[32px] rounded-lg px-2 font-sukhumvit text-[11px] font-black transition-all',
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
                    )}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              aria-label="หน้าถัดไป"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        )}
      </div>
    </div>

    <Sheet open={pdfPreview !== null} onOpenChange={(next) => { if (!next) setPdfPreview(null); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        className={cn(
          '!inset-0 !left-0 !right-0 !top-0 !bottom-0',
          '!h-dvh !w-screen !max-w-none sm:!max-w-none',
          '!rounded-none border-0 p-0 flex flex-col overflow-hidden bg-white',
        )}
      >
        {pdfPreview?.examPdfUrl ? (
          <>
            <SheetHeader className="flex-row items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-100 text-left shrink-0 space-y-0">
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-base font-black text-slate-800 font-sukhumvit leading-snug truncate">
                  {pdfPreview.title}
                </SheetTitle>
                {pdfPreview.examPdfFileName ? (
                  <p className="mt-0.5 truncate text-[11px] font-bold text-slate-500">{pdfPreview.examPdfFileName}</p>
                ) : null}
              </div>
              <SheetClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
                >
                  <HiOutlineXMark className="w-4 h-4" />
                  <span className="sr-only">ปิด</span>
                </Button>
              </SheetClose>
            </SheetHeader>
            <div className="flex-1 min-h-0 p-3">
              <PdfPageViewer url={pdfPreview.examPdfUrl} className="h-full min-h-0" />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
    </>
  );
}

