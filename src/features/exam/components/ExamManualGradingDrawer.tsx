import { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { HiMiniPencil } from 'react-icons/hi2';
import ImageZoomModal from '@/features/exam/components/ImageZoomModal';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { IndeterminateProgress } from '@/components/ui/progress';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import ExamQuestionContent from '@/features/questionBank/components/ExamQuestionContent';
import { fetchRoomRoundExamData } from '@/lib/exam/fetchRoomRoundQuestions';
import { parseExamAnswerValue } from '@/lib/exam/examAnswerFormat';
import {
  buildAttemptScoreUpdate,
  getManualEssayQuestions,
  getQuestionMaxPoints,
  isManualEssayGradingComplete,
} from '@/lib/exam/manualEssayGrading';
import { getRoundQuestionConfigForRound } from '@/lib/exam/roundQuestions';
import { db } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import { normalizeExamScore } from '@/lib/students/studentIdentity';
import { cn } from '@/lib/utils';
import type { ExamAttempt, ExamRoom } from '@/types/exam';
import type { Question } from '@/types/questionBank';

type SummaryStudent = {
  id: string;
  fullName: string;
  studentCode: string;
  photoURL?: string;
  gender?: 'male' | 'female';
};

type Props = {
  open: boolean;
  onClose: () => void;
  room: ExamRoom;
  round: number;
  students: SummaryStudent[];
  attempts: ExamAttempt[];
  onSaved?: () => void;
};

function findAttemptForStudent(
  attempts: ExamAttempt[],
  round: number,
  studentId: string,
): ExamAttempt | null {
  return attempts.find(
    (attempt) => attempt.round === round && attempt.studentId === studentId,
  ) ?? null;
}

export function ExamManualGradingDrawer({
  open,
  onClose,
  room,
  round,
  students,
  attempts,
  onSaved,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [essayQuestions, setEssayQuestions] = useState<Question[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [draftScores, setDraftScores] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  const roundAttempts = useMemo(
    () => attempts.filter((attempt) => attempt.round === round),
    [attempts, round],
  );

  const gradableStudents = useMemo(() => {
    const attemptStudentIds = new Set(roundAttempts.map((attempt) => attempt.studentId));
    return students.filter((student) => attemptStudentIds.has(student.id));
  }, [students, roundAttempts]);

  const questionPoints = useMemo(() => {
    const roundKey = String(round);
    return room.roundQuestions?.[roundKey]?.questionPoints
      ?? room.roundQuestions?.['∞']?.questionPoints
      ?? room.roundQuestions?.['1']?.questionPoints
      ?? {};
  }, [room.roundQuestions, round]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    void (async () => {
      try {
        const { questions } = await fetchRoomRoundExamData(room, round);
        if (cancelled) return;
        const manualEssays = getManualEssayQuestions(questions);
        if (manualEssays.length === 0) {
          setEssayQuestions([]);
          setLoadError('ชุดข้อสอบรอบนี้ไม่มีข้ออัตนัยที่ต้องตรวจ');
          return;
        }
        setEssayQuestions(manualEssays);
        const firstPending = gradableStudents.find((student) => {
          const attempt = findAttemptForStudent(roundAttempts, round, student.id);
          return attempt && !isManualEssayGradingComplete(attempt.manualScores, manualEssays);
        });
        setSelectedStudentId(firstPending?.id ?? gradableStudents[0]?.id ?? null);
      } catch {
        if (!cancelled) {
          setEssayQuestions([]);
          setLoadError('โหลดข้อสอบไม่สำเร็จ');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, room, round, gradableStudents, roundAttempts]);

  const selectedAttempt = selectedStudentId
    ? findAttemptForStudent(roundAttempts, round, selectedStudentId)
    : null;

  const selectedStudent = selectedStudentId
    ? gradableStudents.find((student) => student.id === selectedStudentId) ?? null
    : null;

  useEffect(() => {
    if (!selectedAttempt) {
      setDraftScores({});
      return;
    }
    const next: Record<string, number> = {};
    essayQuestions.forEach((question) => {
      const saved = selectedAttempt.manualScores?.[question.id];
      if (typeof saved === 'number' && Number.isFinite(saved)) {
        next[question.id] = saved;
      }
    });
    setDraftScores(next);
  }, [selectedAttempt, essayQuestions]);

  const handleSave = useCallback(async () => {
    if (!selectedAttempt || essayQuestions.length === 0) return;

    setIsSaving(true);
    try {
      const update = buildAttemptScoreUpdate(selectedAttempt, draftScores, essayQuestions);
      await updateDoc(
        doc(db, 'exam_rooms', room.id, 'attempts', selectedAttempt.id),
        update,
      );
      await logActivity({
        action: 'grade_exam_essay',
        category: 'academic',
        status: 'success',
        targetId: selectedAttempt.id,
        metadata: {
          roomId: room.id,
          round,
          studentId: selectedAttempt.studentId,
          score: update.score,
        },
      });
      toast.success('บันทึกคะแนนสำเร็จ');
      onSaved?.();
    } catch {
      setLoadError('บันทึกคะแนนไม่สำเร็จ');
      toast.error('บันทึกคะแนนไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  }, [selectedAttempt, essayQuestions, draftScores, room.id, round, onSaved]);

  const roundLabel = getRoundQuestionConfigForRound(room, round).roundConfig
    ? `ครั้ง ${round}`
    : `ครั้ง ${round}`;

  return (
    <Drawer open={open} onOpenChange={(val) => !val && onClose()}>
      <DrawerContent className="max-h-[92vh] rounded-t-[2rem] border-slate-200 bg-white/95 backdrop-blur-xl">
        <DrawerHeader className="border-b border-slate-100 pb-4 text-left">
          <DrawerTitle className="flex items-center gap-2 text-[16px] font-black text-slate-800 font-sukhumvit">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <HiMiniPencil size={16} />
            </span>
            ตรวจข้ออัตนัย — {roundLabel}
          </DrawerTitle>
          <DrawerDescription className="text-[12px] text-slate-500 font-sarabun">
            {room.title}
          </DrawerDescription>
        </DrawerHeader>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <IndeterminateProgress className="w-40" />
            <p className="text-[12px] text-slate-400 font-sarabun">กำลังโหลดข้อสอบ...</p>
          </div>
        ) : loadError ? (
          <div className="py-12 px-4 text-center text-rose-500 font-sarabun text-[13px]">
            {loadError}
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
            <div className="border-b md:border-b-0 md:border-r border-slate-100 max-h-48 md:max-h-[calc(92vh-8rem)] overflow-y-auto">
              {gradableStudents.length === 0 ? (
                <p className="p-4 text-[12px] text-slate-400 font-sarabun">ยังไม่มีนักเรียนที่ส่งข้อสอบในรอบนี้</p>
              ) : (
                gradableStudents.map((student) => {
                  const attempt = findAttemptForStudent(roundAttempts, round, student.id);
                  const pending = attempt
                    ? !isManualEssayGradingComplete(attempt.manualScores, essayQuestions)
                    : false;
                  const active = student.id === selectedStudentId;

                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => setSelectedStudentId(student.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-3 text-left border-b border-slate-50 transition-colors',
                        active ? 'bg-amber-50/80' : 'hover:bg-slate-50',
                      )}
                    >
                      <StudentAvatar
                        photoURL={student.photoURL}
                        studentId={student.id}
                        name={student.fullName}
                        gender={student.gender}
                        className="h-9 w-9 shrink-0 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-slate-800 font-sukhumvit truncate">
                          {student.fullName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-sarabun tabular-nums">
                          รหัส {student.studentCode}
                        </p>
                      </div>
                      {pending ? (
                        <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-700 font-sukhumvit">
                          รอตรวจ
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-700 font-sukhumvit">
                          ครบ
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="overflow-y-auto px-4 pb-6 pt-3 max-h-[calc(92vh-8rem)] md:max-h-[calc(92vh-8rem)]">
              {!selectedStudent || !selectedAttempt ? (
                <div className="py-12 text-center text-slate-400 font-sarabun text-[13px]">
                  เลือกนักเรียนเพื่อตรวจข้ออัตนัย
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-black text-slate-800 font-sukhumvit">
                        {selectedStudent.fullName}
                      </p>
                      <p className="text-[11px] text-slate-500 font-sarabun">
                        คะแนนปรนัย {normalizeExamScore(selectedAttempt.score) ?? 0} คะแนน
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void handleSave()}
                      className="h-9 px-4 rounded-xl bg-amber-600 text-white text-[12px] font-black font-sukhumvit hover:bg-amber-700 disabled:opacity-60"
                    >
                      {isSaving ? 'กำลังบันทึก...' : 'บันทึกคะแนน'}
                    </button>
                  </div>

                  {essayQuestions.map((question, index) => {
                    const maxPoints = getQuestionMaxPoints(question, questionPoints);
                    const answerRaw = selectedAttempt.answers?.[question.id] ?? '';
                    const answer = parseExamAnswerValue(answerRaw);
                    const draftValue = draftScores[question.id];

                    return (
                      <div
                        key={question.id}
                        className="rounded-2xl border border-slate-200 overflow-hidden bg-white"
                      >
                        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                          <p className="text-[11px] font-black text-amber-700 font-sukhumvit uppercase tracking-wide">
                            ข้ออัตนัย {index + 1} • เต็ม {maxPoints} คะแนน
                          </p>
                        </div>

                        <div className="px-4 py-3 border-b border-slate-100">
                          <ExamQuestionContent html={question.questionText} />
                        </div>

                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-sukhumvit mb-2">
                            คำตอบนักเรียน
                          </p>
                          {answer.text.trim() ? (
                            <p className="text-[13px] text-slate-700 font-sarabun whitespace-pre-wrap">
                              {answer.text}
                            </p>
                          ) : (
                            <p className="text-[12px] text-slate-400 font-sarabun italic">ไม่ได้กรอกข้อความ</p>
                          )}
                          {answer.imageUrl && (
                            <img
                              src={answer.imageUrl}
                              alt="คำตอบนักเรียน"
                              data-vaul-no-drag
                              onClick={() => setZoomImageUrl(answer.imageUrl || null)}
                              className="mt-3 max-h-64 w-auto max-w-full rounded-xl border border-slate-200 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            />
                          )}
                        </div>

                        <div className="px-4 py-3 flex items-center gap-3">
                          <label className="text-[12px] font-bold text-slate-600 font-sarabun shrink-0">
                            ให้คะแนน
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={maxPoints}
                            step={0.5}
                            value={draftValue ?? ''}
                            onChange={(event) => {
                              const raw = event.target.value;
                              setDraftScores((prev) => {
                                const next = { ...prev };
                                if (raw === '') {
                                  delete next[question.id];
                                  return next;
                                }
                                const parsed = Number(raw);
                                if (!Number.isFinite(parsed)) return prev;
                                next[question.id] = Math.min(maxPoints, Math.max(0, parsed));
                                return next;
                              });
                            }}
                            className="h-10 w-24 rounded-xl border border-slate-200 px-3 text-[14px] font-black text-slate-800 font-sukhumvit tabular-nums outline-none focus:ring-2 focus:ring-amber-500/30"
                          />
                          <span className="text-[12px] text-slate-400 font-sarabun">/ {maxPoints}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        <ImageZoomModal src={zoomImageUrl} onClose={() => setZoomImageUrl(null)} />
      </DrawerContent>
    </Drawer>
  );
}
