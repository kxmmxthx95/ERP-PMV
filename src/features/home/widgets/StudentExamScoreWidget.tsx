import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, BookOpen, Trophy, FileText, Clock } from 'lucide-react';
import { WIDGET_GLASS } from '../widgetStyles';
import { useExamRoom } from '@/hooks/useExamRoom';
import { useAuth } from '@/hooks/useAuth';
import type { ExamAttempt, ExamRoom } from '@/types/exam';

// ── Types ─────────────────────────────────────────────────────────────────────

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
  avgScore: number | null;
  bestScore: number | null;
  totalPoints: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(pct: number): string {
  if (pct >= 80) return '#059669';
  if (pct >= 60) return '#d97706';
  return '#e11d48';
}

function scoreBg(pct: number): string {
  if (pct >= 80) return 'rgba(5,150,105,0.1)';
  if (pct >= 60) return 'rgba(217,119,6,0.1)';
  return 'rgba(225,29,72,0.1)';
}

function formatDate(ts: number | null): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50 animate-pulse">
      <div className="w-9 h-9 rounded-xl bg-slate-200" />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="w-32 h-3 rounded-full bg-slate-200" />
        <div className="w-20 h-2.5 rounded-full bg-slate-200" />
      </div>
      <div className="w-14 h-6 rounded-full bg-slate-200" />
    </div>
  );
}

// Subject list row
function SubjectRow({ group, onClick }: { group: SubjectGroup; onClick: () => void }) {
  const pct = group.bestScore !== null && group.totalPoints
    ? Math.round((group.bestScore / group.totalPoints) * 100)
    : null;

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all hover:bg-indigo-50/80 active:bg-indigo-100/60"
      style={{ background: 'rgba(248,250,252,0.9)' }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(99,102,241,0.1)' }}>
        <BookOpen size={16} style={{ color: '#6366f1' }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-slate-800 font-sukhumvit truncate">{group.subjectName}</p>
        <p className="text-[11px] text-slate-400 font-sarabun">
          {group.totalAttempts} ครั้ง · {group.rooms.length} ห้องสอบ
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {pct !== null ? (
          <span className="text-[12px] font-black px-2.5 py-1 rounded-full"
            style={{ color: scoreColor(pct), background: scoreBg(pct) }}>
            {pct}%
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 font-sarabun">รอผล</span>
        )}
        <ChevronRight size={14} className="text-slate-300" />
      </div>
    </motion.button>
  );
}

// Attempt row inside a room
function AttemptRow({ attempt, totalPoints }: { attempt: ExamAttempt; totalPoints: number | null }) {
  const pct = attempt.score !== null && totalPoints
    ? Math.round((attempt.score / totalPoints) * 100)
    : null;
  const isGraded = attempt.status === 'graded' || attempt.status === 'submitted';

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
      style={{ background: 'rgba(248,250,252,0.9)' }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-black text-indigo-500"
        style={{ background: 'rgba(99,102,241,0.1)' }}>
        {attempt.round}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-slate-700 font-sarabun">รอบที่ {attempt.round}</p>
        <p className="text-[10px] text-slate-400 flex items-center gap-1">
          <Clock size={9} />
          {formatDate(attempt.submittedAt)}
        </p>
      </div>

      {isGraded ? (
        pct !== null ? (
          <div className="flex flex-col items-end">
            <span className="text-[13px] font-black"
              style={{ color: scoreColor(pct) }}>
              {attempt.score}
              {totalPoints && <span className="text-[10px] font-bold text-slate-400">/{totalPoints}</span>}
            </span>
            <span className="text-[10px] font-bold" style={{ color: scoreColor(pct) }}>{pct}%</span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">รอตรวจ</span>
        )
      ) : (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-bold border border-amber-200">
          กำลังสอบ
        </span>
      )}
    </div>
  );
}

// Room detail panel
function RoomDetail({ group, onBack }: { group: SubjectGroup; onBack: () => void }) {
  const [selectedRoomIdx, setSelectedRoomIdx] = useState(0);
  const current = group.rooms[selectedRoomIdx];

  return (
    <motion.div
      key="room-detail"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      className="flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onBack}
          className="w-7 h-7 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-all shrink-0">
          <ChevronLeft size={14} className="text-slate-600" />
        </button>
        <div className="min-w-0">
          <p className="text-[13px] font-black text-slate-800 font-sukhumvit truncate">{group.subjectName}</p>
          <p className="text-[10px] text-slate-400">{group.totalAttempts} ครั้งที่สอบ</p>
        </div>
      </div>

      {/* Summary bar */}
      {group.bestScore !== null && group.totalPoints && (() => {
        const pct = Math.round((group.bestScore / group.totalPoints) * 100);
        return (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{ background: scoreBg(pct), border: `1px solid ${scoreColor(pct)}30` }}>
            <Trophy size={16} style={{ color: scoreColor(pct) }} />
            <div className="flex-1">
              <p className="text-[11px] font-bold text-slate-600 font-sarabun">คะแนนสูงสุด</p>
              <p className="text-[18px] font-black leading-none font-sukhumvit" style={{ color: scoreColor(pct) }}>
                {group.bestScore}
                <span className="text-[12px] font-bold text-slate-400 ml-1">/{group.totalPoints} คะแนน</span>
              </p>
            </div>
            <span className="text-[20px] font-black" style={{ color: scoreColor(pct) }}>{pct}%</span>
          </div>
        );
      })()}

      {/* Room tabs */}
      {group.rooms.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          {group.rooms.map((r, i) => (
            <button key={r.room.id}
              onClick={() => setSelectedRoomIdx(i)}
              className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
              style={{
                background: i === selectedRoomIdx ? '#6366f1' : 'rgba(248,250,252,0.9)',
                color: i === selectedRoomIdx ? '#fff' : '#64748b',
              }}>
              {r.room.title.length > 14 ? r.room.title.slice(0, 14) + '…' : r.room.title}
            </button>
          ))}
        </div>
      )}

      {/* Room header */}
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: 'rgba(99,102,241,0.1)' }}>
          <FileText size={13} style={{ color: '#6366f1' }} />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-slate-700 font-sukhumvit">{current.room.title}</p>
          {current.room.className && (
            <p className="text-[10px] text-slate-400">ห้อง {current.room.className}</p>
          )}
        </div>
      </div>

      {/* Attempts */}
      <div className="flex flex-col gap-1.5">
        {current.attempts.length === 0 ? (
          <p className="text-[12px] text-slate-400 font-sarabun text-center py-4">ยังไม่มีผลการสอบ</p>
        ) : (
          current.attempts
            .sort((a, b) => (b.round ?? 0) - (a.round ?? 0))
            .map(att => (
              <AttemptRow key={att.id} attempt={att} totalPoints={current.room.totalPoints} />
            ))
        )}
      </div>
    </motion.div>
  );
}

// ── Main Widget ───────────────────────────────────────────────────────────────

export default function StudentExamScoreWidget() {
  const { user } = useAuth();
  const { rooms, attempts, isLoading } = useExamRoom();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // Group by subject, filter to only this student's attempts
  const subjectGroups = useMemo<SubjectGroup[]>(() => {
    if (!user?.uid) return [];

    const myAttempts = attempts.filter(a =>
      String(a.studentId).trim() === user.uid &&
      (a.status === 'submitted' || a.status === 'graded' || a.status === 'in_progress')
    );

    // Map: subjectId → group
    const map = new Map<string, SubjectGroup>();

    for (const room of rooms) {
      const subjectId = room.subjectId ?? `__no_subject_${room.id}`;
      const subjectName = room.subjectName ?? room.title;

      const roomAttempts = myAttempts.filter(a => a.roomId === room.id);
      if (roomAttempts.length === 0) continue; // student hasn't attempted this room

      const gradedAttempts = roomAttempts.filter(a => a.score !== null);
      const bestScore = gradedAttempts.length > 0
        ? Math.max(...gradedAttempts.map(a => a.score as number))
        : null;
      const latestAttempt = roomAttempts
        .sort((a, b) => (b.round ?? 0) - (a.round ?? 0))[0] ?? null;

      const roomEntry = { room, attempts: roomAttempts, bestScore, latestAttempt };

      if (!map.has(subjectId)) {
        map.set(subjectId, {
          subjectId,
          subjectName,
          rooms: [],
          totalAttempts: 0,
          avgScore: null,
          bestScore: null,
          totalPoints: null,
        });
      }

      const group = map.get(subjectId)!;
      group.rooms.push(roomEntry);
      group.totalAttempts += roomAttempts.length;

      // Aggregate best score across rooms (using the highest % for fair comparison)
      const allGraded = group.rooms.flatMap(r =>
        r.attempts.filter(a => a.score !== null).map(a => ({
          score: a.score as number,
          total: r.room.totalPoints,
        }))
      );

      if (allGraded.length > 0) {
        const best = allGraded.reduce((acc, cur) =>
          cur.total > 0 && (cur.score / cur.total) > ((acc.score / acc.total) || 0) ? cur : acc
        );
        group.bestScore = best.score;
        group.totalPoints = best.total;

        const avg = allGraded.reduce((s, c) => s + c.score, 0) / allGraded.length;
        group.avgScore = Math.round(avg * 10) / 10;
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.subjectName.localeCompare(b.subjectName, 'th')
    );
  }, [rooms, attempts, user?.uid]);

  const { latestOverall, selectedGroup } = useMemo(() => {
    const group = selectedSubjectId
      ? subjectGroups.find(g => g.subjectId === selectedSubjectId) ?? null
      : null;
    
    // Find latest attempt overall
    let latestRoom: ExamRoom | null = null;
    let latestAtt: ExamAttempt | null = null;
    
    for (const g of subjectGroups) {
      for (const r of g.rooms) {
        if (r.latestAttempt && (!latestAtt || (r.latestAttempt.submittedAt || 0) > (latestAtt.submittedAt || 0))) {
          latestAtt = r.latestAttempt;
          latestRoom = r.room;
        }
      }
    }
    
    return { latestOverall: latestRoom && latestAtt ? { room: latestRoom, attempt: latestAtt } : null, selectedGroup: group };
  }, [subjectGroups, selectedSubjectId]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={WIDGET_GLASS} className="rounded-3xl p-5 flex flex-col gap-4 w-full overflow-hidden">
      {/* Widget Header */}
      <div className="flex items-center gap-3">
        <div>
          <p className="text-[13px] font-black text-slate-800 font-sukhumvit">ผลการสอบของฉัน</p>
          <p className="text-[11px] text-slate-400 font-sarabun">
            {subjectGroups.length > 0
              ? `${subjectGroups.length} วิชา · ${subjectGroups.reduce((s, g) => s + g.totalAttempts, 0)} ครั้งที่สอบ`
              : 'สรุปคะแนนตามรายวิชา'}
          </p>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col gap-2">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </motion.div>

        ) : subjectGroups.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.08)' }}>
              <FileText size={22} style={{ color: '#a5b4fc' }} />
            </div>
            <p className="text-[13px] text-slate-400 font-sarabun text-center leading-relaxed">
              ยังไม่มีผลการสอบ<br />
              <span className="text-[11px]">เข้าห้องสอบและส่งคำตอบก่อนดูผล</span>
            </p>
          </motion.div>

        ) : selectedGroup ? (
          <RoomDetail
            key={selectedGroup.subjectId}
            group={selectedGroup}
            onBack={() => setSelectedSubjectId(null)}
          />

        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col gap-2">
            
            {/* Latest Exam Highlight */}
            {latestOverall && (
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-[11px] font-black text-slate-400 font-sukhumvit uppercase tracking-wider">ห้องสอบล่าสุด</span>
                </div>
                <div className="p-4 rounded-[1.5rem] bg-indigo-50/50 border border-indigo-100 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-slate-800 font-sukhumvit truncate">
                      {latestOverall.room.subjectName || latestOverall.room.title}
                    </p>
                    <p className="text-[11px] text-indigo-500 font-bold font-sarabun truncate">
                      {latestOverall.room.title}
                    </p>
                  </div>
                  <div className="text-right">
                    {latestOverall.attempt.score !== null ? (
                      <>
                        <span className="text-[16px] font-black text-indigo-600 block leading-none">
                          {latestOverall.attempt.score}
                          <span className="text-[10px] font-bold text-indigo-300 ml-0.5">/{latestOverall.room.totalPoints}</span>
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Graded</span>
                      </>
                    ) : (
                      <span className="text-[10px] px-2 py-1 rounded-lg bg-amber-100 text-amber-700 font-bold">รอตรวจ</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-1 px-1">
               <span className="text-[11px] font-black text-slate-400 font-sukhumvit uppercase tracking-wider">รายวิชาทั้งหมด</span>
            </div>

            {subjectGroups.map(group => (
              <SubjectRow
                key={group.subjectId}
                group={group}
                onClick={() => setSelectedSubjectId(group.subjectId)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
