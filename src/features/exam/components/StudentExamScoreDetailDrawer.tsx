import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
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
import { isHtmlContent } from '@/lib/exam/examAnswerFormat';
import {
  buildAttemptScoreUpdate,
  getManualEssayQuestions,
  getQuestionMaxPoints,
} from '@/lib/exam/manualEssayGrading';
import { describeMissingQuestionsError } from '@/lib/exam/roundQuestions';
import { shouldShowExamPartHeaders, type ExamPartGroupMeta } from '@/lib/exam/examPartGroups';
import { getPartBadgeTheme } from '@/features/exam/utils/partBadgeTheme';
import { computePartScoreSummaries } from '@/features/exam/utils/partScoreSummary';
import { db } from '@/lib/firebase';
import { logActivity } from '@/lib/activityLogger';
import { normalizeExamScore } from '@/lib/students/studentIdentity';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import ImageZoomModal from '@/features/exam/components/ImageZoomModal';
import type { ExamAttempt, ExamRoom } from '@/types/exam';
import type { Question } from '@/types/questionBank';
import {
  gradeSimulationAnswers,
  type GradedQuestionResult,
} from '@/features/questionBank/utils/gradeSimulationAnswers';

function groupResultsByPart(
  results: GradedQuestionResult[],
  partGroups: ExamPartGroupMeta[],
): Array<ExamPartGroupMeta & { results: GradedQuestionResult[] }> {
  const byQuestionId = new Map(results.map((result) => [result.questionId, result]));

  return partGroups.map((part) => ({
    ...part,
    results: part.questionIds
      .map((questionId, index) => {
        const result = byQuestionId.get(questionId);
        if (!result) return null;
        return { ...result, label: String(index + 1) };
      })
      .filter((result): result is GradedQuestionResult => result !== null),
  }));
}

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
  student: SummaryStudent | null;
  attemptsByRound: Map<number, ExamAttempt>;
  roundNumbers: number[];
  initialRound?: number;
};

function StatusIcon({ status }: { status: GradedQuestionResult['status'] }) {
  if (status === 'correct') return <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />;
  if (status === 'wrong') return <XCircle size={16} className="text-rose-500 shrink-0" />;
  return <MinusCircle size={16} className="text-slate-300 shrink-0" />;
}

function GradedAnswerDisplay({
  value,
  tone = 'default',
}: {
  value: string;
  tone?: 'default' | 'correct';
}) {
  if (!value || value === '-') {
    return <span className="font-bold text-slate-400">-</span>;
  }

  if (isHtmlContent(value)) {
    return (
      <ExamQuestionContent
        html={value}
        variant="option"
        className={cn(
          '!inline-block w-full !bg-transparent !py-0 !px-0 !shadow-none text-[11px]',
          tone === 'correct' ? 'text-emerald-700' : 'text-slate-700',
          '[&_img]:max-h-28 [&_img]:rounded-lg [&_img]:border [&_img]:border-slate-200 [&_img]:cursor-pointer [&_img]:hover:opacity-90 [&_img]:transition-opacity',
        )}
      />
    );
  }

  return (
    <span className={cn('font-bold', tone === 'correct' ? 'text-emerald-700' : 'text-slate-700')}>
      {value}
    </span>
  );
}

const normalizeTimestamp = (val: any): number => {
  if (typeof val === 'number') return val;
  if (val && typeof val.toMillis === 'function') return val.toMillis();
  if (val && typeof val.seconds === 'number') return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
  if (val instanceof Date) return val.getTime();
  return 0;
};

export function StudentExamScoreDetailDrawer({
  open,
  onClose,
  room,
  student,
  attemptsByRound,
  roundNumbers,
  initialRound,
}: Props) {
  const { role } = useAuth();
  const canEditScores = role === 'teacher' || role === 'admin' || role === 'sysadmin';

  const availableRounds = useMemo(
    () => roundNumbers.filter((round) => attemptsByRound.has(round)),
    [roundNumbers, attemptsByRound],
  );

  const [activeRound, setActiveRound] = useState<number>(() => initialRound ?? availableRounds[0] ?? 1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gradeSummary, setGradeSummary] = useState<ReturnType<typeof gradeSimulationAnswers> | null>(null);
  const [partGroups, setPartGroups] = useState<ExamPartGroupMeta[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [draftScores, setDraftScores] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  const questionPoints = useMemo(() => {
    const roundKey = String(activeRound);
    return room.roundQuestions?.[roundKey]?.questionPoints
      ?? room.roundQuestions?.['∞']?.questionPoints
      ?? room.roundQuestions?.['1']?.questionPoints
      ?? {};
  }, [room.roundQuestions, activeRound]);

  const manualEssayQuestions = useMemo(
    () => getManualEssayQuestions(questions),
    [questions],
  );

  const manualEssayMetaById = useMemo(() => {
    const map = new Map<string, { maxPoints: number }>();
    manualEssayQuestions.forEach((question) => {
      map.set(question.id, {
        maxPoints: getQuestionMaxPoints(question, questionPoints),
      });
    });
    return map;
  }, [manualEssayQuestions, questionPoints]);

  const hasManualEssays = manualEssayQuestions.length > 0;

  useEffect(() => {
    if (!open || !student) return;
    const nextRound = initialRound && attemptsByRound.has(initialRound)
      ? initialRound
      : availableRounds[availableRounds.length - 1] ?? 1;
    setActiveRound(nextRound);
  }, [open, student, initialRound, attemptsByRound, availableRounds]);

  const initialAttempt = useMemo(
    () => attemptsByRound.get(activeRound) ?? null,
    [attemptsByRound, activeRound],
  );

  const [liveAttempt, setLiveAttempt] = useState<ExamAttempt | null>(null);

  useEffect(() => {
    if (!open || !initialAttempt) {
      setLiveAttempt(null);
      return;
    }

    setLiveAttempt(initialAttempt);

    const unsub = onSnapshot(
      doc(db, 'exam_rooms', room.id, 'attempts', initialAttempt.id),
      (snap) => {
        if (snap.exists()) {
          const raw = snap.data();
          setLiveAttempt({
            ...raw,
            id: snap.id,
            roomId: room.id,
            score: normalizeExamScore(raw.score),
            startedAt: normalizeTimestamp(raw.startedAt),
            submittedAt: raw.submittedAt ? normalizeTimestamp(raw.submittedAt) : null,
            lastSavedAt: normalizeTimestamp(raw.lastSavedAt),
          } as ExamAttempt);
        }
      },
      (err) => {
        console.error('Error listening to attempt:', err);
      }
    );

    return () => {
      unsub();
    };
  }, [open, initialAttempt?.id, room.id]);

  const attempt = liveAttempt || initialAttempt;
  const roundTotal = useMemo(() => {
    const roundKey = String(activeRound);
    const points =
      room.roundQuestions?.[roundKey]?.totalPoints
      ?? room.roundQuestions?.['∞']?.totalPoints
      ?? room.roundQuestions?.['1']?.totalPoints
      ?? room.totalPoints
      ?? 0;
    return Number(points) > 0 ? Number(points) : 0;
  }, [room, activeRound]);

  const groupedResults = useMemo(() => {
    if (!gradeSummary) return [];
    if (partGroups.length === 0) {
      return [{
        setId: '',
        partIndex: 0,
        partLabel: 'Part 1',
        title: '',
        questionIds: gradeSummary.results.map((r) => r.questionId),
        results: gradeSummary.results,
      }];
    }
    return groupResultsByPart(gradeSummary.results, partGroups);
  }, [gradeSummary, partGroups]);

  const showPartHeaders = shouldShowExamPartHeaders(partGroups);

  const partScoreSummaries = useMemo(() => {
    if (!gradeSummary || groupedResults.length === 0) return [];
    return computePartScoreSummaries(
      groupedResults,
      questions,
      questionPoints,
      attempt,
      draftScores,
    );
  }, [gradeSummary, groupedResults, questions, questionPoints, attempt, draftScores]);

  const attemptScore = normalizeExamScore(attempt?.score);

  useEffect(() => {
    if (!attempt) {
      setDraftScores({});
      return;
    }
    const next: Record<string, number> = {};
    manualEssayQuestions.forEach((question) => {
      const saved = attempt.manualScores?.[question.id];
      if (typeof saved === 'number' && Number.isFinite(saved)) {
        next[question.id] = saved;
      }
    });
    setDraftScores(next);
  }, [attempt?.id, attempt?.manualScores, manualEssayQuestions]);

  const handleSaveManualScores = useCallback(async () => {
    if (!attempt || manualEssayQuestions.length === 0) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      const update = buildAttemptScoreUpdate(attempt, draftScores, manualEssayQuestions);
      await updateDoc(
        doc(db, 'exam_rooms', room.id, 'attempts', attempt.id),
        update,
      );
      await logActivity({
        action: 'grade_exam_essay',
        category: 'academic',
        status: 'success',
        targetId: attempt.id,
        metadata: {
          roomId: room.id,
          round: activeRound,
          studentId: attempt.studentId,
          score: update.score,
          source: 'score_detail_drawer',
        },
      });
      toast.success('บันทึกคะแนนข้อเขียนสำเร็จ');
    } catch {
      setSaveError('บันทึกคะแนนข้อเขียนไม่สำเร็จ');
      toast.error('บันทึกคะแนนข้อเขียนไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  }, [attempt, manualEssayQuestions, draftScores, room.id, activeRound]);

  const setDraftScore = useCallback((questionId: string, maxPoints: number, raw: string) => {
    setDraftScores((prev) => {
      const next = { ...prev };
      if (raw === '') {
        delete next[questionId];
        return next;
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return prev;
      next[questionId] = Math.min(maxPoints, Math.max(0, parsed));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open || !student || !attempt) {
      setGradeSummary(null);
      setPartGroups([]);
      setQuestions([]);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    void (async () => {
      try {
        const { questions: loadedQuestions, partGroups: groups } = await fetchRoomRoundExamData(room, activeRound);
        if (cancelled) return;
        if (loadedQuestions.length === 0) {
          setGradeSummary(null);
          setPartGroups([]);
          setQuestions([]);
          setLoadError(describeMissingQuestionsError(room));
          return;
        }
        setQuestions(loadedQuestions);
        setPartGroups(groups);
        setGradeSummary(gradeSimulationAnswers(loadedQuestions, attempt.answers ?? {}));
      } catch {
        if (!cancelled) {
          setGradeSummary(null);
          setPartGroups([]);
          setQuestions([]);
          setLoadError('โหลดรายละเอียดคะแนนไม่สำเร็จ');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, student, attempt, room, activeRound]);

  return (
    <Drawer open={open} onOpenChange={(val) => !val && onClose()}>
      <DrawerContent className="max-h-[92vh] rounded-t-[2rem] border-slate-200 bg-white/95 backdrop-blur-xl">
        <DrawerHeader className="border-b border-slate-100 pb-4 text-left">
          <DrawerTitle className="sr-only">รายละเอียดคะแนนสอบ</DrawerTitle>
          <DrawerDescription className="sr-only">
            แสดงคะแนนรายข้อของนักเรียน
          </DrawerDescription>
          {student && (
            <div className="flex items-start gap-3">
              <StudentAvatar
                photoURL={student.photoURL}
                studentId={student.id}
                name={student.fullName}
                gender={student.gender}
                className="h-12 w-12 shrink-0 rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-black text-slate-800 font-sukhumvit truncate">
                  {student.fullName}
                </p>
                <p className="text-[12px] text-blue-600 font-sarabun tabular-nums">
                  รหัส {student.studentCode}
                </p>
                <p className="text-[11px] text-slate-400 font-sarabun mt-0.5 truncate">
                  {room.title}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide font-sukhumvit">
                  คะแนน
                </p>
                {attemptScore !== null ? (
                  <p className="text-[22px] font-black text-emerald-600 font-sukhumvit tabular-nums">
                    {attemptScore}
                    {roundTotal > 0 && (
                      <span className="text-[13px] text-slate-400 font-bold">/{roundTotal}</span>
                    )}
                  </p>
                ) : attempt ? (
                  <p className="text-[12px] font-bold text-amber-600 font-sarabun">รอตรวจ</p>
                ) : (
                  <p className="text-[12px] text-slate-300 font-bold">-</p>
                )}
              </div>
            </div>
          )}

          {availableRounds.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {availableRounds.map((round) => (
                <button
                  key={round}
                  type="button"
                  onClick={() => setActiveRound(round)}
                  className={cn(
                    'h-8 px-3 rounded-xl text-[11px] font-black font-sukhumvit transition-all',
                    activeRound === round
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  ครั้ง {round}
                </button>
              ))}
            </div>
          )}
        </DrawerHeader>

        <div
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'IMG') {
              const src = (target as HTMLImageElement).src;
              if (src) setZoomImageUrl(src);
            }
          }}
          className="overflow-y-auto px-4 pb-6 pt-3 max-h-[calc(92vh-11rem)] scrollbar-hide"
        >
          {!attempt ? (
            <div className="py-12 text-center text-slate-400 font-sarabun text-[13px]">
              ยังไม่มีข้อมูลการสอบในรอบนี้
            </div>
          ) : isLoading ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <IndeterminateProgress className="w-40" />
              <p className="text-[12px] text-slate-400 font-sarabun">กำลังโหลดรายละเอียด...</p>
            </div>
          ) : loadError ? (
            <div className="py-12 text-center text-rose-500 font-sarabun text-[13px]">
              {loadError}
            </div>
          ) : gradeSummary ? (
            <div className="flex flex-col gap-3">
              {showPartHeaders ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {partScoreSummaries.map((part) => {
                    const theme = getPartBadgeTheme(part.partIndex);
                    return (
                      <div
                        key={`score-${part.setId}-${part.partIndex}`}
                        className={cn(
                          'rounded-2xl border p-3',
                          theme.headerBorder,
                          theme.headerBg,
                        )}
                      >
                        <div className="mb-2 flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              'shrink-0 rounded-md px-1.5 py-0.5 font-sukhumvit text-[9px] font-black uppercase tracking-wide text-white',
                              theme.badge,
                            )}
                          >
                            {part.partLabel}
                          </span>
                          <p className="min-w-0 truncate font-sarabun text-[11px] font-bold text-slate-800">
                            {part.title}
                          </p>
                        </div>
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 font-sukhumvit">คะแนน</p>
                            <p className="font-sukhumvit text-[22px] font-black tabular-nums leading-none">
                              {part.earnedPoints !== null ? (
                                <>
                                  <span className="text-emerald-600">{part.earnedPoints}</span>
                                  <span className="text-[14px] text-slate-400">/{part.maxPoints}</span>
                                </>
                              ) : (
                                <span className="text-[14px] text-amber-600">รอตรวจ</span>
                              )}
                            </p>
                          </div>
                          <div className="flex gap-1.5 text-[10px] font-bold font-sarabun">
                            <span className="rounded-lg bg-emerald-100 px-2 py-1 text-emerald-700">{part.correct} ถูก</span>
                            <span className="rounded-lg bg-rose-100 px-2 py-1 text-rose-700">{part.wrong} ผิด</span>
                            <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-500">{part.unanswered} ไม่ตอบ</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                    <p className="text-[18px] font-black text-emerald-600 font-sukhumvit">{gradeSummary.correct}</p>
                    <p className="text-[10px] font-bold text-emerald-500 font-sarabun">ถูก</p>
                  </div>
                  <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-center">
                    <p className="text-[18px] font-black text-rose-600 font-sukhumvit">{gradeSummary.wrong}</p>
                    <p className="text-[10px] font-bold text-rose-500 font-sarabun">ผิด</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                    <p className="text-[18px] font-black text-slate-500 font-sukhumvit">{gradeSummary.unanswered}</p>
                    <p className="text-[10px] font-bold text-slate-400 font-sarabun">ไม่ตอบ</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {partScoreSummaries.map((part) => {
                  const theme = getPartBadgeTheme(part.partIndex);
                  return (
                    <div
                      key={`${part.setId}-${part.partIndex}`}
                      className="rounded-2xl border border-slate-200 overflow-hidden"
                    >
                      {showPartHeaders && (
                        <div
                          className={cn(
                            'border-b px-3 py-2.5',
                            theme.headerBorder,
                            theme.headerBg,
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={cn(
                                'shrink-0 rounded-md px-1.5 py-0.5 font-sukhumvit text-[9px] font-black uppercase tracking-wide text-white',
                                theme.badge,
                              )}
                            >
                              {part.partLabel}
                            </span>
                            <p className="min-w-0 truncate font-sarabun text-[11px] font-bold text-slate-800">
                              {part.title}
                            </p>
                            <div className="ml-auto shrink-0 text-right">
                              <p className="font-sukhumvit text-[13px] font-black tabular-nums text-slate-800">
                                {part.earnedPoints !== null ? (
                                  <>
                                    <span className="text-emerald-600">{part.earnedPoints}</span>
                                    <span className="text-slate-400">/{part.maxPoints}</span>
                                  </>
                                ) : (
                                  <span className="text-[11px] text-amber-600">รอตรวจ</span>
                                )}
                              </p>
                              <p className="text-[9px] font-bold text-slate-500 font-sarabun tabular-nums">
                                {part.correct} ถูก · {part.wrong} ผิด · {part.unanswered} ไม่ตอบ
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {part.results.map((result) => {
                        const manualMeta = manualEssayMetaById.get(result.questionId);
                        const isManualEssay = Boolean(manualMeta);

                        return (
                        <div
                          key={result.questionId}
                          className={cn(
                            'flex items-start gap-3 px-3 py-3 border-b border-slate-100 last:border-b-0',
                            isManualEssay && 'bg-amber-50/50',
                            !isManualEssay && result.status === 'correct' && 'bg-emerald-50/40',
                            !isManualEssay && result.status === 'wrong' && 'bg-rose-50/40',
                          )}
                        >
                          {!isManualEssay && <StatusIcon status={result.status} />}
                          {isManualEssay && (
                            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[9px] font-black text-amber-700">
                              ข
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[12px] font-black text-slate-700 font-sukhumvit">
                                ข้อ {result.label}
                                {isManualEssay && (
                                  <span className="ml-1.5 text-[10px] font-bold text-amber-600 font-sarabun">
                                    (ข้อเขียน)
                                  </span>
                                )}
                              </p>
                              {isManualEssay && manualMeta && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <input
                                    type="number"
                                    min={0}
                                    max={manualMeta.maxPoints}
                                    step={0.5}
                                    value={draftScores[result.questionId] ?? ''}
                                    onChange={(event) => setDraftScore(
                                      result.questionId,
                                      manualMeta.maxPoints,
                                      event.target.value,
                                    )}
                                    disabled={!canEditScores}
                                    className="h-8 w-16 rounded-lg border border-amber-200 bg-white px-2 text-[13px] font-black text-slate-800 font-sukhumvit tabular-nums outline-none focus:ring-2 focus:ring-amber-500/30 disabled:bg-slate-50/50 disabled:border-slate-200 disabled:text-slate-400"
                                    aria-label={`คะแนนข้อ ${result.label}`}
                                  />
                                  <span className="text-[11px] text-slate-400 font-sarabun tabular-nums">
                                    / {manualMeta.maxPoints}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-sarabun mt-0.5">
                              <span>ตอบ: </span>
                              <GradedAnswerDisplay value={result.yourAnswerLabel} />
                            </div>
                            {!isManualEssay && result.status === 'wrong' && (
                              <div className="text-[11px] text-emerald-600 font-sarabun mt-0.5">
                                <span>เฉลย: </span>
                                <GradedAnswerDisplay value={result.correctAnswerLabel} tone="correct" />
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {canEditScores && hasManualEssays && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[12px] text-amber-800 font-sarabun leading-snug">
                    ข้อเขียนต้องให้คะแนนด้วยตนเอง — คะแนนไม่เกินค่าที่ตั้งไว้ต่อข้อ
                  </p>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void handleSaveManualScores()}
                    className="h-9 shrink-0 rounded-xl bg-amber-600 px-4 text-[12px] font-black text-white font-sukhumvit hover:bg-amber-700 disabled:opacity-60"
                  >
                    {isSaving ? 'กำลังบันทึก...' : 'บันทึกคะแนนข้อเขียน'}
                  </button>
                </div>
              )}

              {saveError && (
                <p className="text-center text-[12px] text-rose-500 font-sarabun">{saveError}</p>
              )}

              {attempt.submittedAt && (
                <p className="text-center text-[10px] text-slate-400 font-sarabun">
                  ส่งเมื่อ {new Date(attempt.submittedAt).toLocaleString('th-TH')}
                </p>
              )}
            </div>
          ) : null}
        </div>
        <ImageZoomModal src={zoomImageUrl} onClose={() => setZoomImageUrl(null)} />
      </DrawerContent>
    </Drawer>
  );
}
