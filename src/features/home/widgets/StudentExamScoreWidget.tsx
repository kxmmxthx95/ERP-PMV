import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FileText } from 'lucide-react';
import { WIDGET_CARD, WIDGET_GLASS } from '../widgetStyles';
import { WidgetSkeleton } from '../components/WidgetSkeleton';
import { useExamRoom } from '@/hooks/useExamRoom';
import { useAuth } from '@/hooks/useAuth';
import type { ExamAttempt, ExamRoom } from '@/types/exam';

interface SubjectGroup {
  subjectId: string;
  subjectName: string;
  rooms: Array<{
    room: ExamRoom;
    attempts: ExamAttempt[];
    bestScore: number | null;
    latestAttempt: ExamAttempt | null;
  }>;
  totalAttempts: number;
  bestScore: number | null;
  totalPoints: number | null;
}

function scoreColor(pct: number): string {
  if (pct >= 80) return '#059669';
  if (pct >= 60) return '#d97706';
  return '#e11d48';
}

export default function StudentExamScoreWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { rooms, attempts, isLoading } = useExamRoom();

  const subjectGroups = useMemo<SubjectGroup[]>(() => {
    if (!user?.uid) return [];

    const myAttempts = attempts.filter(
      (a) =>
        String(a.studentId).trim() === user.uid
        && (a.status === 'submitted' || a.status === 'graded' || a.status === 'in_progress'),
    );

    const map = new Map<string, SubjectGroup>();

    for (const room of rooms) {
      const subjectId = room.subjectId ?? `__no_subject_${room.id}`;
      const subjectName = room.subjectName ?? room.title;

      const roomAttempts = myAttempts.filter((a) => a.roomId === room.id);
      if (roomAttempts.length === 0) continue;

      const gradedAttempts = roomAttempts.filter((a) => a.score !== null);
      const bestScore =
        gradedAttempts.length > 0 ? Math.max(...gradedAttempts.map((a) => a.score as number)) : null;
      const latestAttempt =
        roomAttempts.sort((a, b) => (b.round ?? 0) - (a.round ?? 0))[0] ?? null;

      const roomEntry = { room, attempts: roomAttempts, bestScore, latestAttempt };

      if (!map.has(subjectId)) {
        map.set(subjectId, {
          subjectId,
          subjectName,
          rooms: [],
          totalAttempts: 0,
          bestScore: null,
          totalPoints: null,
        });
      }

      const group = map.get(subjectId)!;
      group.rooms.push(roomEntry);
      group.totalAttempts += roomAttempts.length;

      const allGraded = group.rooms.flatMap((r) =>
        r.attempts
          .filter((a) => a.score !== null)
          .map((a) => ({
            score: a.score as number,
            total: r.room.totalPoints,
          })),
      );

      if (allGraded.length > 0) {
        const best = allGraded.reduce((acc, cur) =>
          cur.total > 0 && cur.score / cur.total > (acc.score / acc.total || 0) ? cur : acc,
        );
        group.bestScore = best.score;
        group.totalPoints = best.total;
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.subjectName.localeCompare(b.subjectName, 'th'),
    );
  }, [rooms, attempts, user?.uid]);

  const latestOverall = useMemo(() => {
    let latestRoom: ExamRoom | null = null;
    let latestAtt: ExamAttempt | null = null;

    for (const g of subjectGroups) {
      for (const r of g.rooms) {
        if (
          r.latestAttempt
          && (!latestAtt || (r.latestAttempt.submittedAt || 0) > (latestAtt.submittedAt || 0))
        ) {
          latestAtt = r.latestAttempt;
          latestRoom = r.room;
        }
      }
    }

    return latestRoom && latestAtt ? { room: latestRoom, attempt: latestAtt } : null;
  }, [subjectGroups]);

  const totalAttempts = subjectGroups.reduce((s, g) => s + g.totalAttempts, 0);

  if (isLoading) return <WidgetSkeleton variant="list" />;

  return (
    <div
      style={WIDGET_GLASS}
      className={`${WIDGET_CARD} cursor-pointer group`}
      onClick={() => navigate('/portal/exams')}
    >
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-800 truncate leading-none">ผลการสอบของฉัน</p>
          <p className="text-[10px] font-bold text-slate-400 truncate mt-1">
            {subjectGroups.length > 0
              ? `${subjectGroups.length} วิชา · ${totalAttempts} ครั้งที่สอบ`
              : 'สรุปคะแนนตามรายวิชา'}
          </p>
        </div>
        <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
      </div>

      <div className="flex-1 min-h-0 flex items-center overflow-hidden">
        {subjectGroups.length === 0 ? (
          <div className="flex items-center justify-center gap-2 w-full">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50">
              <FileText size={14} className="text-indigo-300" />
            </div>
            <p className="text-[10px] font-bold text-slate-400 leading-snug">
              ยังไม่มีผลการสอบ · เข้าห้องสอบและส่งคำตอบก่อนดูผล
            </p>
          </div>
        ) : latestOverall ? (
          (() => {
            const { room, attempt } = latestOverall;
            const subjectLabel = room.subjectName || room.title;
            const pct =
              attempt.score !== null && room.totalPoints
                ? Math.round((attempt.score / room.totalPoints) * 100)
                : null;

            return (
              <div className="w-full rounded-xl border px-2.5 py-1.5 bg-indigo-50/50 border-indigo-100">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-[11px] font-black text-slate-800 truncate flex-1">{subjectLabel}</p>
                  {attempt.score !== null ? (
                    <span
                      className="text-[11px] font-black shrink-0 tabular-nums"
                      style={{ color: pct !== null ? scoreColor(pct) : '#6366f1' }}
                    >
                      {attempt.score}
                      <span className="text-[10px] font-bold text-slate-400">/{room.totalPoints}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-600 shrink-0">รอตรวจ</span>
                  )}
                </div>
                <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">{room.title}</p>
              </div>
            );
          })()
        ) : null}
      </div>
    </div>
  );
}
