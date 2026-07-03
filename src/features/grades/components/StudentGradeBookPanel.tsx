import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, AlertCircle, BookOpen, ClipboardList, GraduationCap, Monitor, RefreshCw,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { normalizeExamScore } from '@/lib/students/studentIdentity';
import { useStudentGradeBook, type StudentSubjectGradeCard } from '@/hooks/useStudentGradeBook';
import { StudentExamScoreDetailDrawer } from '@/features/exam/components/StudentExamScoreDetailDrawer';
import StudentSubjectAttendanceDrawer from '@/features/grades/components/StudentSubjectAttendanceDrawer';
import { attemptScorePercent } from '@/lib/exam/examRoomScoring';
import { rawPointsToPercent } from '@/types/grades';
import { GLASS } from '@/components/layouts/PortalLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { subjectCardShadow, subjectColorByName, subjectGradient } from '@/features/schedule/constants/colors';
import { SubjectGradeCardPattern } from '@/features/curriculum/utils/subjectVisual';
import { CATEGORY_CONFIG, type SubjectCategory } from '@/types/curriculum';
import type { Exam, ExamScore, ExamType } from '@/types/teaching';
import type { ExamAttempt, ExamRoom } from '@/types/exam';

const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  midterm: 'กลางภาค',
  final: 'ปลายภาค',
  quiz: 'เก็บคะแนน',
  makeup: 'แก้ตัว',
};

const EXAM_TYPE_COLOR: Record<ExamType, { text: string; bg: string }> = {
  midterm: { text: '#e11d48', bg: '#ffe4e6' },
  final: { text: '#7c3aed', bg: '#f3e8ff' },
  quiz: { text: '#d97706', bg: '#fef3c7' },
  makeup: { text: '#059669', bg: '#d1fae5' },
};

type StudentExamCard = {
  id: string;
  kind: 'online' | 'offline';
  title: string;
  typeLabel: string;
  typeColor: string;
  typeBg: string;
  scorePercent: number | null;
  scoreLabel: string;
  statusLabel: string;
  statusTone: 'success' | 'pending' | 'muted';
  room?: ExamRoom;
  attemptsByRound?: Map<number, ExamAttempt>;
  roundNumbers?: number[];
};

function attendanceTone(pct: number | null): { text: string; bg: string } {
  if (pct === null) return { text: '#94a3b8', bg: '#f1f5f9' };
  if (pct >= 80) return { text: '#059669', bg: '#d1fae5' };
  if (pct >= 60) return { text: '#d97706', bg: '#fef3c7' };
  return { text: '#e11d48', bg: '#ffe4e6' };
}

function formatGradeDisplay(grade: string | null): string {
  if (!grade) return '—';
  if (grade === 'A') return '4';
  if (grade === 'B+') return '3.5';
  if (grade === 'B') return '3';
  if (grade === 'C+') return '2.5';
  if (grade === 'C') return '2';
  if (grade === 'D+') return '1.5';
  if (grade === 'D') return '1';
  if (grade === 'F') return '0';
  return grade;
}

function gradeTone(grade: string | null): { text: string; bg: string } {
  if (!grade) return { text: '#94a3b8', bg: '#f1f5f9' };
  const g = grade.trim();
  if (g === 'A' || g === 'B+' || g === 'B' || g === '4' || g === '3.5' || g === '3') return { text: '#059669', bg: '#d1fae5' };
  if (g === 'C+' || g === 'C' || g === '2.5' || g === '2') return { text: '#2563eb', bg: '#dbeafe' };
  if (g === 'D+' || g === 'D' || g === '1.5' || g === '1') return { text: '#d97706', bg: '#fef3c7' };
  return { text: '#e11d48', bg: '#ffe4e6' };
}

const CATEGORY_ALIASES: Record<string, SubjectCategory> = {
  core: 'core',
  basic: 'core',
  added: 'added',
  additional: 'added',
  activity: 'activity',
  elective: 'elective',
};

function categoryBadgeStyle(category: string): { background: string; color: string; borderColor: string } {
  const key = CATEGORY_ALIASES[category] ?? 'core';
  const cfg = CATEGORY_CONFIG[key];
  return {
    background: cfg.color,
    color: '#ffffff',
    borderColor: 'rgba(255,255,255,0.35)',
  };
}

function SubjectGradeCardSkeleton() {
  return (
    <div className="rounded-[1.5rem] p-4 border border-slate-200/70 bg-gradient-to-br from-slate-200/90 via-slate-100/80 to-slate-200/70 flex flex-col gap-3 animate-pulse">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-[4.5rem] rounded-lg bg-white/70" />
        <Skeleton className="h-4 w-12 rounded bg-white/50" />
        <Skeleton className="ml-auto h-5 w-12 rounded-full bg-white/60" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-[82%] rounded-lg bg-white/70" />
        <Skeleton className="h-4 w-[58%] rounded-lg bg-white/50" />
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Skeleton className="h-[3.75rem] rounded-xl bg-white/80" />
        <Skeleton className="h-[3.75rem] rounded-xl bg-white/80" />
      </div>
    </div>
  );
}

function StudentGradeBookSkeleton() {
  return (
    <div className="flex flex-col gap-4 h-full pb-24">
      <div className="hidden md:flex rounded-[1.5rem] px-5 py-4 items-center justify-between gap-3" style={GLASS}>
        <div className="space-y-2">
          <Skeleton className="h-4 w-36 bg-slate-200" />
          <Skeleton className="h-3 w-52 bg-slate-100" />
        </div>
        <Skeleton className="h-9 w-9 rounded-full bg-slate-100" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <SubjectGradeCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function SubjectStat({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  tone: { text: string; bg: string };
  onClick?: () => void;
}) {
  const content = (
    <>
      <p className="text-[9px] font-bold text-slate-400 font-sukhumvit">{label}</p>
      <p className="text-[15px] font-black tabular-nums leading-none mt-1 font-sukhumvit" style={{ color: tone.text }}>
        {value}
      </p>
    </>
  );

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onClick();
          }
        }}
        className="rounded-xl border border-white/70 bg-white/80 px-2.5 py-2 min-w-0 shadow-sm text-left transition-colors hover:bg-white active:scale-[0.98] cursor-pointer"
        title="ดูประวัติการเข้าเรียน"
      >
        {content}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/70 bg-white/80 px-2.5 py-2 min-w-0 shadow-sm">
      {content}
    </div>
  );
}

export default function StudentGradeBookPanel() {
  const { user } = useAuth();
  const { loading, error, student, classRoom, subjectCards, academicYear, yearStartDate, yearEndDate, reload } = useStudentGradeBook();

  const [selectedSubject, setSelectedSubject] = useState<StudentSubjectGradeCard | null>(null);
  const [examLoading, setExamLoading] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [examCards, setExamCards] = useState<StudentExamCard[]>([]);
  const [drawerRoom, setDrawerRoom] = useState<ExamRoom | null>(null);
  const drawerAttemptsByRound = useMemo(() => new Map<number, ExamAttempt>(), []);
  const drawerRoundNumbers = useMemo(() => [] as number[], []);
  const [attendanceDrawerSubject, setAttendanceDrawerSubject] = useState<StudentSubjectGradeCard | null>(null);

  const [isMdOrBelow, setIsMdOrBelow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  );
  const [headerCenterMobileEl, setHeaderCenterMobileEl] = useState<HTMLElement | null>(null);
  const [headerMobileBackEl, setHeaderMobileBackEl] = useState<HTMLElement | null>(null);
  const [headerMobileActionsEl, setHeaderMobileActionsEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderCenterMobileEl(document.getElementById('header-portal-center-mobile'));
    setHeaderMobileBackEl(document.getElementById('header-portal-mobile-back'));
    setHeaderMobileActionsEl(document.getElementById('header-portal-mobile-actions'));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsMdOrBelow(!mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const defaultBack = document.getElementById('portal-default-mobile-back');
    if (!defaultBack) return;
    defaultBack.style.display = isMdOrBelow && selectedSubject ? 'none' : '';
  }, [isMdOrBelow, selectedSubject]);

  const loadExams = useCallback(async (subject: StudentSubjectGradeCard) => {
    if (!student || !academicYear) return;

    setExamLoading(true);
    setExamError(null);

    try {
      const cards: StudentExamCard[] = [];
      const gradeLevel = classRoom?.gradeLevel ?? '';

      const [examsSnap, roomsByClass, roomsByGrade] = await Promise.all([
        getDocs(query(
          collection(db, 'exams'),
          where('subjectId', '==', subject.subjectId),
          where('classId', '==', subject.classId),
          where('academicYearId', '==', String(academicYear)),
          where('semester', '==', subject.semester),
        )).catch(() => null),
        getDocs(query(
          collection(db, 'exam_rooms'),
          where('classId', '==', subject.classId),
          where('academicYearId', '==', String(academicYear)),
          where('semester', '==', subject.semester),
        )).catch(() => null),
        gradeLevel
          ? getDocs(query(
              collection(db, 'exam_rooms'),
              where('gradeLevel', '==', gradeLevel),
              where('academicYearId', '==', String(academicYear)),
              where('semester', '==', subject.semester),
            )).catch(() => null)
          : Promise.resolve(null),
      ]);

      const examDocs = examsSnap?.docs.map((d) => ({ id: d.id, ...d.data() } as Exam)) ?? [];
      const examIds = examDocs.map((exam) => exam.id);
      const scoresByExamId = new Map<string, ExamScore>();

      if (examIds.length > 0) {
        const scoreSnap = await getDocs(query(
          collection(db, 'exam_scores'),
          where('examId', 'in', examIds.slice(0, 30)),
        )).catch(() => null);
        scoreSnap?.docs.forEach((d) => {
          const score = { id: d.id, ...d.data() } as ExamScore;
          if (score.studentId === student.id || score.studentId === user?.uid) {
            scoresByExamId.set(score.examId, score);
          }
        });
      }

      examDocs.forEach((exam) => {
        const cfg = EXAM_TYPE_COLOR[exam.type];
        const myScore = scoresByExamId.get(exam.id);
        const scorePercent = myScore && typeof myScore.score === 'number'
          ? Math.round(rawPointsToPercent(myScore.score, exam.maxScore))
          : null;

        cards.push({
          id: exam.id,
          kind: 'offline',
          title: exam.title,
          typeLabel: EXAM_TYPE_LABEL[exam.type],
          typeColor: cfg.text,
          typeBg: cfg.bg,
          scorePercent,
          scoreLabel: scorePercent !== null ? `${scorePercent}%` : '—',
          statusLabel: myScore?.absent ? 'ขาดสอบ' : scorePercent !== null ? 'มีคะแนน' : 'ยังไม่มีคะแนน',
          statusTone: scorePercent !== null ? 'success' : myScore?.absent ? 'muted' : 'pending',
        });
      });

      const roomDocs = [
        ...(roomsByClass?.docs ?? []),
        ...(roomsByGrade?.docs.filter((d) => !roomsByClass?.docs.some((c) => c.id === d.id)) ?? []),
      ];

      const normalizeTs = (val: unknown): number => {
        if (typeof val === 'number') return val;
        if (val && typeof (val as { toMillis?: () => number }).toMillis === 'function') {
          return (val as { toMillis: () => number }).toMillis();
        }
        return 0;
      };

      const rooms = roomDocs
        .map((d) => {
          const raw = d.data();
          return {
            ...raw,
            id: d.id,
            startTime: normalizeTs(raw.startTime),
            endTime: normalizeTs(raw.endTime),
          } as ExamRoom;
        })
        .filter((room) => {
          const linked = room.settings?.gradeBookSubjects ?? [];
          if (linked.length > 0) {
            return linked.some((item) => item.subjectId === subject.subjectId);
          }
          const legacyId = room.settings?.gradeBookSubjectId ?? room.subjectId;
          return legacyId === subject.subjectId;
        });

      // Fetch attempts per-room (no collectionGroup = no index needed)
      // Filter by studentId in memory — each room's attempts subcollection is small
      const attemptsByRoom = await Promise.all(
        rooms.map(async (room) => {
          try {
            const snap = await getDocs(collection(db, 'exam_rooms', room.id, 'attempts'));
            return snap.docs
              .filter((d) => {
                const sid = String(d.data()?.studentId ?? '').trim();
                return sid === String(student.id).trim() || sid === String(user?.uid ?? '').trim();
              })
              .map((d) => {
                const raw = d.data();
                return {
                  ...raw,
                  id: d.id,
                  roomId: room.id,
                  score: normalizeExamScore(raw.score),
                } as ExamAttempt;
              });
          } catch {
            return [] as ExamAttempt[];
          }
        }),
      );
      const attempts = attemptsByRoom.flat();


      rooms.forEach((room) => {
        const roomAttempts = attempts.filter((att) => {
          if (att.roomId !== room.id) return false;
          const attStudentId = String(att.studentId).trim();
          return attStudentId === student.id || attStudentId === user?.uid;
        });

        if (roomAttempts.length === 0) return;

        const scoreType = room.settings?.scoreCollectionType ?? 'classwork';
        const scoreTypeCfg: Record<string, { label: string; color: string; bg: string }> = {
          classwork: { label: 'เก็บคะแนน', color: '#d97706', bg: '#fef3c7' },
          quiz: { label: 'ทดสอบย่อย', color: '#d97706', bg: '#fef3c7' },
          midterm: { label: 'กลางภาค', color: '#e11d48', bg: '#ffe4e6' },
          final: { label: 'ปลายภาค', color: '#7c3aed', bg: '#f3e8ff' },
        };
        const typeCfg = scoreTypeCfg[scoreType] ?? scoreTypeCfg.classwork;

        const attemptsByRound = new Map<number, ExamAttempt>();
        roomAttempts.forEach((att) => {
          const round = att.round ?? 1;
          const existing = attemptsByRound.get(round);
          if (!existing || (att.submittedAt ?? 0) > (existing.submittedAt ?? 0)) {
            attemptsByRound.set(round, att);
          }
        });

        const roundNumbers = [...attemptsByRound.keys()].sort((a, b) => a - b);
        const bestAttempt = [...roomAttempts]
          .filter((att) => att.score !== null)
          .sort((a, b) => (attemptScorePercent(room, b) ?? -1) - (attemptScorePercent(room, a) ?? -1))[0]
          ?? roomAttempts.sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))[0];

        const scorePercent = bestAttempt ? attemptScorePercent(room, bestAttempt) : null;
        const statusLabel = bestAttempt?.status === 'graded'
          ? 'ตรวจแล้ว'
          : bestAttempt?.status === 'submitted'
            ? 'ส่งแล้ว'
            : 'กำลังทำ';

        cards.push({
          id: room.id,
          kind: 'online',
          title: room.title,
          typeLabel: typeCfg.label,
          typeColor: typeCfg.color,
          typeBg: typeCfg.bg,
          scorePercent,
          scoreLabel: scorePercent !== null ? `${scorePercent}%` : '—',
          statusLabel,
          statusTone: scorePercent !== null ? 'success' : bestAttempt ? 'pending' : 'muted',
          room,
          attemptsByRound,
          roundNumbers,
        });
      });

      cards.sort((a, b) => a.title.localeCompare(b.title, 'th'));
      setExamCards(cards);
    } catch (err) {
      console.error('[StudentGradeBookPanel] loadExams', err);
      setExamError('โหลดรายการสอบไม่สำเร็จ');
      setExamCards([]);
    } finally {
      setExamLoading(false);
    }
  }, [student, user?.uid, academicYear, classRoom?.gradeLevel]);

  useEffect(() => {
    if (!selectedSubject) {
      setExamCards([]);
      setExamError(null);
      return;
    }
    void loadExams(selectedSubject);
  }, [selectedSubject, loadExams]);

  const drawerStudent = useMemo(() => {
    if (!student) return null;
    return {
      id: student.id,
      fullName: `${student.prefix ?? ''}${student.firstName ?? ''} ${student.lastName ?? ''}`.trim(),
      studentCode: student.studentCode ?? '',
      photoURL: student.photoURL,
      gender: student.gender,
    };
  }, [student]);

  const mobileBackPortal = isMdOrBelow && selectedSubject && headerMobileBackEl && createPortal(
    <button
      type="button"
      onClick={() => setSelectedSubject(null)}
      className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
      title="กลับ"
      aria-label="กลับ"
    >
      <ArrowLeft size={18} />
    </button>,
    headerMobileBackEl,
  );

  const mobileHeaderPortal = isMdOrBelow && headerCenterMobileEl && createPortal(
    <div className="pointer-events-auto flex min-w-0 max-w-[calc(100vw-112px)] items-center justify-center lg:hidden">
      <div className="flex min-w-0 items-center gap-1.5 text-black/80">
        <GraduationCap size={14} className="shrink-0" />
        <span className="truncate font-sukhumvit text-[12px] font-black">
          {selectedSubject ? selectedSubject.subjectName : 'สมุดคะแนน'}
        </span>
      </div>
    </div>,
    headerCenterMobileEl,
  );

  const mobileActionsPortal = isMdOrBelow && headerMobileActionsEl && createPortal(
    <div className="pointer-events-auto flex items-center gap-1.5 lg:hidden">
      {!selectedSubject && (
        <button
          type="button"
          onClick={() => void reload()}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
          title="โหลดข้อมูลใหม่"
          aria-label="โหลดข้อมูลใหม่"
        >
          <RefreshCw size={15} />
        </button>
      )}
    </div>,
    headerMobileActionsEl,
  );

  if (loading) {
    return <StudentGradeBookSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 px-6 text-center">
        <AlertCircle size={24} className="text-amber-500" />
        <p className="text-sm font-bold text-slate-700 font-sukhumvit">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full pb-24">
      {mobileBackPortal}
      {mobileHeaderPortal}
      {mobileActionsPortal}

      {!selectedSubject ? (
        <>
          <div className="hidden md:flex rounded-[1.5rem] px-5 py-4 items-center justify-between gap-3" style={GLASS}>
            <div>
              <p className="text-[15px] font-black text-slate-800 font-sukhumvit">สมุดคะแนนของฉัน</p>
              <p className="text-[11px] text-slate-400 font-sarabun mt-0.5">
                ห้อง {classRoom?.className ?? '—'} · ปีการศึกษา {academicYear} · ทั้ง 2 เทอม
              </p>
            </div>
            <button
              type="button"
              onClick={() => void reload()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              title="โหลดข้อมูลใหม่"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          {subjectCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <BookOpen size={28} className="text-slate-300" />
              <p className="text-[13px] text-slate-400 font-sarabun">ยังไม่มีรายวิชาในหลักสูตรของห้องเรียน</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {subjectCards.map((card) => {
                const attTone = attendanceTone(card.attendancePct);
                const formattedGrade = formatGradeDisplay(card.grade);
                const grTone = gradeTone(formattedGrade);
                const subjectColor = subjectColorByName(card.subjectName, card.subjectGroup);
                const cardStyle = {
                  background: subjectGradient(subjectColor),
                  boxShadow: subjectCardShadow(subjectColor),
                };
                const textShadow = '0 1px 2.5px rgba(0,0,0,0.35)';
                const categoryBadge = categoryBadgeStyle(card.category);
                return (
                  <motion.button
                    key={card.key}
                    whileHover={{ scale: 1.01, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedSubject(card)}
                    className="relative overflow-hidden text-left rounded-[1.5rem] p-4 border border-white/20 transition-all flex flex-col gap-3"
                    style={cardStyle}
                  >
                    <SubjectGradeCardPattern
                      subjectName={card.subjectName}
                      subjectGroup={card.subjectGroup}
                    />
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.18) 0%, transparent 55%)' }}
                    />
                    <div className="relative flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-lg font-sukhumvit border"
                        style={{
                          ...categoryBadge,
                          textShadow: '0 1px 2px rgba(0,0,0,0.25)',
                        }}
                      >
                        {card.categoryLabel}
                      </span>
                      {card.subjectCode && (
                        <span className="text-[10px] font-sarabun text-white/85" style={{ textShadow }}>
                          {card.subjectCode}
                        </span>
                      )}
                      <span
                        className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full font-sukhumvit bg-white/20 text-white/95 border border-white/25"
                        style={{ textShadow }}
                      >
                        เทอม {card.semester}
                      </span>
                    </div>

                    <p
                      className="relative text-[14px] font-black font-sukhumvit line-clamp-2 leading-snug text-white"
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
                    >
                      {card.subjectName}
                    </p>

                    <div className="relative grid grid-cols-2 gap-2 pt-1">
                      <SubjectStat
                        label="เข้าเรียน"
                        value={card.attendancePct !== null ? `${card.attendancePct}%` : '—'}
                        tone={attTone}
                        onClick={() => setAttendanceDrawerSubject(card)}
                      />
                      <SubjectStat
                        label="เกรด"
                        value={card.grade ? formattedGrade : (card.totalScore !== null ? `${card.totalScore}%` : '—')}
                        tone={grTone}
                      />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setSelectedSubject(null)}
            className="hidden md:inline-flex self-start items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold font-sukhumvit text-slate-600 bg-white/80 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={12} />
            กลับรายวิชา
          </button>

          <div className="flex items-center gap-2">
            <ClipboardList size={14} className="text-slate-500" />
            <p className="text-[13px] font-black text-slate-800 font-sukhumvit">การสอบของฉัน</p>
          </div>

          {examLoading ? (
            <div className="py-10 text-center text-[12px] text-slate-400 font-sarabun">กำลังโหลดการสอบ...</div>
          ) : examError ? (
            <div className="py-10 text-center text-[12px] text-rose-500 font-sarabun">{examError}</div>
          ) : examCards.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-slate-400 font-sarabun">
              ยังไม่มีรายการสอบสำหรับวิชานี้
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {examCards.map((exam) => (
                <motion.button
                  key={`${exam.kind}_${exam.id}`}
                  type="button"
                  whileHover={{ scale: 1 }}
                  whileTap={{ scale: 1 }}
                  disabled={true}
                  onClick={undefined}
                  className={cn(
                    'text-left rounded-[1.5rem] p-4 border transition-all flex flex-col gap-2',
                    'cursor-default',
                  )}
                  style={{
                    background: 'rgba(255,255,255,0.92)',
                    borderColor: 'rgba(226,232,240,0.9)',
                  }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-lg font-sukhumvit"
                      style={{ background: exam.typeBg, color: exam.typeColor }}
                    >
                      {exam.typeLabel}
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg font-sukhumvit bg-slate-100 text-slate-500">
                      {exam.kind === 'online' ? 'ออนไลน์' : 'กระดาษ'}
                    </span>
                    {exam.kind === 'online' && <Monitor size={12} className="ml-auto text-violet-500" />}
                  </div>

                  <p className="text-[13px] font-black text-slate-800 font-sukhumvit line-clamp-2">{exam.title}</p>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 font-sukhumvit">คะแนน</p>
                      <p className="text-[18px] font-black text-slate-800 font-sukhumvit tabular-nums">{exam.scoreLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-slate-400 font-sukhumvit">สถานะ</p>
                      <span className={cn(
                        'inline-flex text-[10px] font-black px-2 py-0.5 rounded-full font-sukhumvit',
                        exam.statusTone === 'success' && 'bg-emerald-50 text-emerald-600',
                        exam.statusTone === 'pending' && 'bg-amber-50 text-amber-600',
                        exam.statusTone === 'muted' && 'bg-slate-100 text-slate-500',
                      )}>
                        {exam.statusLabel}
                      </span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      {drawerRoom && (
        <StudentExamScoreDetailDrawer
          open={!!drawerRoom}
          onClose={() => setDrawerRoom(null)}
          room={drawerRoom}
          student={drawerStudent}
          attemptsByRound={drawerAttemptsByRound}
          roundNumbers={drawerRoundNumbers}
        />
      )}

      <StudentSubjectAttendanceDrawer
        open={!!attendanceDrawerSubject}
        onClose={() => setAttendanceDrawerSubject(null)}
        subject={attendanceDrawerSubject}
        studentId={student?.id ?? null}
        academicYearId={academicYear ? String(academicYear) : null}
        yearStartDate={yearStartDate}
        yearEndDate={yearEndDate}
      />
    </div>
  );
}
