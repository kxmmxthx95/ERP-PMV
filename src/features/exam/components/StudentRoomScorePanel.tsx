import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiArrowLeft, HiPlay } from 'react-icons/hi2';
import { StudentExamScoreDetailDrawer } from '@/features/exam/components/StudentExamScoreDetailDrawer';
import { getExamRoomRoundTotalPoints } from '@/lib/exam/roundQuestions';
import { formatScorePoints } from '@/lib/exam/examRoomScoring';
import { resolveAttemptTotalScore } from '@/lib/exam/manualEssayGrading';
import {
  indexStudentAttemptsByRound,
  isStudentRoundScoreRevealed,
} from '@/lib/exam/studentScoreReveal';
import { HEADER_ICON_BTN } from '@/lib/headerIconBtn';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { rawPointsToPercent } from '@/types/grades';
import type { ExamAttempt, ExamRoom } from '@/types/exam';type Props = {
  room: ExamRoom;
  attempts: ExamAttempt[];
  onBack: () => void;
  onTakeExam?: () => void;
  headerPortalEl?: HTMLElement | null;
};

function statusLabel(room: ExamRoom): string {
  if (room.status === 'active') return 'กำลังเปิดสอบ';
  if (room.status === 'upcoming') return 'รอเปิด';
  return 'ปิดแล้ว';
}

export function StudentRoomScorePanel({
  room,
  attempts,
  onBack,
  onTakeExam,
  headerPortalEl,
}: Props) {
  const { user, userData } = useAuth();
  const [drillRound, setDrillRound] = useState<number | null>(null);
  const [headerMobileEl, setHeaderMobileEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderMobileEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  const attemptsByRound = useMemo(
    () => indexStudentAttemptsByRound(attempts),
    [attempts],
  );

  const roundNumbers = useMemo(() => {
    const fromAttempts = [...attemptsByRound.keys()];
    const maxAttempts = room.settings?.maxAttempts ?? 1;
    const configured = maxAttempts === 0
      ? []
      : Array.from({ length: maxAttempts }, (_, i) => i + 1);
    const completed = Math.max(0, room.completedRounds ?? 0);
    const current = Math.max(0, room.currentRound ?? 0);
    const merged = new Set<number>([
      ...configured,
      ...fromAttempts,
      ...(completed > 0 ? Array.from({ length: completed }, (_, i) => i + 1) : []),
      ...(current > 0 ? [current] : []),
    ]);
    const list = [...merged].filter((n) => n > 0).sort((a, b) => a - b);
    return list.length > 0 ? list : [1];
  }, [attemptsByRound, room.settings?.maxAttempts, room.completedRounds, room.currentRound]);

  const selfStudent = useMemo(() => {
    if (!user?.uid) return null;
    const fullName = [userData?.prefix, userData?.firstName, userData?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim()
      || userData?.displayName
      || userData?.name
      || user.displayName
      || 'ฉัน';
    return {
      id: user.uid,
      fullName,
      studentCode: String(userData?.studentCode ?? ''),
      photoURL: userData?.photoURL ?? user.photoURL ?? undefined,
    };
  }, [user, userData]);

  const showTakeExam = room.status === 'active' && !!onTakeExam;
  const immediate = room.settings?.showResultImmediately !== false;

  const backBtn = (
    <button
      type="button"
      onClick={onBack}
      className={HEADER_ICON_BTN}
      title="กลับ"
      aria-label="กลับ"
    >
      <HiArrowLeft size={16} />
    </button>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden font-sukhumvit">
      {headerPortalEl ? createPortal(
        <div className="pointer-events-auto flex items-center gap-1.5">
          {backBtn}
        </div>,
        headerPortalEl,
      ) : null}
      {headerMobileEl ? createPortal(
        <div className="pointer-events-auto flex items-center gap-1.5 lg:hidden">
          {backBtn}
        </div>,
        headerMobileEl,
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pb-14 lg:pb-4">
        <div className="shrink-0 rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-[15px] font-black text-foreground leading-snug line-clamp-2">
            {room.title}
          </p>
          <p className="mt-1 text-[11px] font-bold text-muted-foreground">
            {room.subjectName || '—'}
            {' · '}
            {statusLabel(room)}
            {!immediate && room.status !== 'closed' ? ' · คะแนนเปิดเมื่อครูอนุญาต/ปิดห้อง' : ''}
          </p>
          {showTakeExam && (
            <button
              type="button"
              onClick={onTakeExam}
              className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl bg-primary text-[12px] font-black text-primary-foreground"
            >
              <HiPlay className="h-4 w-4" />
              ทำข้อสอบ
            </button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="shrink-0 border-b border-border px-4 py-3">
            <p className="text-[12px] font-black text-foreground">คะแนนของฉัน</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
            {roundNumbers.length === 0 ? (
              <div className="px-4 py-12 text-center text-muted-foreground">
                <p className="text-[13px] font-sarabun">ยังไม่มีรอบสอบ</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {roundNumbers.map((round) => {
                  const att = attemptsByRound.get(round) ?? null;
                  const revealed = isStudentRoundScoreRevealed(room, round, att);
                  const score = revealed ? resolveAttemptTotalScore(att) : null;
                  const maxPts = getExamRoomRoundTotalPoints(room, round);
                  const inProgress = att?.status === 'in_progress';
                  const canDrill = revealed && !!att && att.status !== 'in_progress';

                  let detail: string;
                  if (!att) detail = 'ยังไม่ได้สอบ';
                  else if (inProgress) detail = 'กำลังทำข้อสอบ';
                  else if (!revealed) detail = 'ยังไม่เปิดเผยคะแนน';
                  else if (score === null) detail = 'รอตรวจ';
                  else if (maxPts > 0) {
                    const pct = Math.round(rawPointsToPercent(score, maxPts));
                    detail = `${formatScorePoints(score)} / ${formatScorePoints(maxPts)} · ${pct}%`;
                  } else {
                    detail = formatScorePoints(score);
                  }

                  return (
                    <button
                      key={round}
                      type="button"
                      disabled={!canDrill}
                      onClick={() => {
                        if (canDrill) setDrillRound(round);
                      }}
                      className={cn(
                        'flex items-center justify-between gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0',
                        canDrill ? 'hover:bg-muted/40 cursor-pointer' : 'cursor-default opacity-90',
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-foreground">รอบ {round}</p>
                        <p className="text-[11px] font-sarabun text-muted-foreground">{detail}</p>
                      </div>
                      {canDrill && (
                        <span className="shrink-0 text-[11px] font-black text-primary">ดูรายข้อ</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <StudentExamScoreDetailDrawer
        open={drillRound !== null && !!selfStudent}
        onClose={() => setDrillRound(null)}
        room={room}
        student={selfStudent}
        attemptsByRound={attemptsByRound}
        roundNumbers={roundNumbers.filter((r) =>
          isStudentRoundScoreRevealed(room, r, attemptsByRound.get(r)),
        )}
        initialRound={drillRound ?? undefined}
      />
    </div>
  );
}
