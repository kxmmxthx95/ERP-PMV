import { useEffect, useState } from 'react';
import { useSetQuestions } from '@/hooks/useSetQuestions';
import type { QuestionSet } from '@/types/questionBank';
import QuestionSimulatorModal from './QuestionSimulatorModal';
import { IndeterminateProgress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface Props {
  set: QuestionSet;
  open: boolean;
  onClose: () => void;
}

/** จำลองชุดข้อสอบทีละข้อ (โจทย์ + ตัวเลือก → ส่ง → ข้อถัดไป) */
export default function QuestionSetStepSimulator({ set, open, onClose }: Props) {
  const { questions, isLoading } = useSetQuestions(open ? set.id : null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open, set.id]);

  useEffect(() => {
    if (questions.length === 0) return;
    setIndex((i) => Math.min(i, questions.length - 1));
  }, [questions.length]);

  if (!open) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center gap-3 bg-black/40 supports-backdrop-filter:backdrop-blur-sm">
        <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-8 shadow-xl">
          <IndeterminateProgress className="w-40" />
          <p className="font-sarabun text-[13px] font-bold text-muted-foreground">กำลังโหลดข้อสอบ...</p>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="mt-1 h-10 w-full rounded-xl text-xs font-bold"
          >
            ยกเลิก
          </Button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center gap-3 bg-black/40 supports-backdrop-filter:backdrop-blur-sm px-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-2xl border border-border bg-card px-6 py-8 text-center shadow-xl">
          <p className="font-sukhumvit text-lg font-black tracking-tight text-foreground">ยังจำลองชุดนี้ไม่ได้</p>
          <p className="font-sarabun text-[13px] text-muted-foreground">ชุดข้อสอบนี้ยังไม่มีข้อสอบ</p>
          <Button
            type="button"
            onClick={onClose}
            className="mt-3 h-10 w-full rounded-xl text-xs font-bold"
          >
            กลับ
          </Button>
        </div>
      </div>
    );
  }

  const question = questions[index]!;
  const last = questions.length - 1;

  return (
    <QuestionSimulatorModal
      open={open}
      onClose={onClose}
      question={question}
      progressLabel={`${set.title} · ข้อ ${index + 1}/${questions.length}`}
      canPrev={index > 0}
      canNext={index < last}
      onPrev={() => setIndex((i) => Math.max(0, i - 1))}
      onNext={() => setIndex((i) => Math.min(i + 1, last))}
    />
  );
}
