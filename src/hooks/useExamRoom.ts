3.// src/hooks/useExamRoom.ts
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  query,
  where,
  documentId,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  Timestamp,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { chunkIds } from '@/lib/firestoreShared/fetchStudentsByIds';
import { normalizeExamScore } from '@/lib/students/studentIdentity';
import type { ExamRoom, ExamAttempt, ExamRoomStatus, ExamQuestionPublic } from '@/types/exam';
import type { QuestionPayload, QuestionType } from '@/types/questionBank';
import { resolveQuestionPoints } from '@/lib/exam/questionPoints';
import { canSubmitExamManually } from '@/lib/exam/examSubmitPolicy';
import {
  gradeAttemptAnswers,
  loadQuestionMapForSets,
  loadRoomForGrading,
  resolveEffectiveQuestionIds,
  resolveRoundGradingConfig,
  type GradingQuestionDoc,
} from '@/lib/exam/autoGradeAttempt';
import {
  buildAttemptScoreUpdate,
  getManualEssayQuestions,
} from '@/lib/exam/manualEssayGrading';
import type { Question } from '@/types/questionBank';
import {
  deriveSetOrder,
  describeMissingQuestionsError,
  getRoundQuestionConfig,
  roomHasSavedQuestions,
} from '@/lib/exam/roundQuestions';
import { seededShuffle } from '@/lib/exam/questionShuffle';
import { useActiveAcademicYear } from './useActiveAcademicYear';
import { useAuth } from './useAuth';
import { requestExamAttemptGrading } from '@/features/exam/utils/examGradingApi';

// ── Helpers ──────────────────────────────────────────────────────────────────
const normalizeTimestamp = (val: any): number => {
  if (typeof val === 'number') return val;
  if (val && typeof val.toMillis === 'function') return val.toMillis();
  if (val && typeof val.seconds === 'number') return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
  if (val instanceof Date) return val.getTime();
  return 0;
};

/** Firestore rejects `undefined` field values — omit them before writes. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function parseQuestionDoc(
  d: QueryDocumentSnapshot,
  questionPointsOverride?: Record<string, number>,
): ExamQuestionPublic {
  const data = d.data() as {
    type?: QuestionType;
    orderIndex?: number;
    order?: number;
    text?: string;
    questionText?: string;
    points?: number;
    options?: Array<{ id?: string; text?: string }>;
    payload?: QuestionPayload & { options?: Array<{ id?: string; text?: string }> };
  };
  const type: QuestionType = data.type === 'essay' ? 'essay' : 'multiple_choice';
  const payloadOptions = Array.isArray(data.payload?.options) ? data.payload.options : [];
  const rawOptions = Array.isArray(data.options) && data.options.length > 0
    ? data.options
    : payloadOptions;
  const options = rawOptions.map((opt, index) => ({
    id: opt.id || String(index + 1),
    text: opt.text || '',
  }));
  const payload = (data.payload ?? (type === 'multiple_choice'
    ? { options }
    : { rubric: '', maxScore: 1 })) as QuestionPayload;
  const points = resolveQuestionPoints(
    d.id,
    questionPointsOverride,
    { type, payload },
    typeof data.points === 'number' ? data.points : undefined,
  );

  return {
    id: d.id,
    order: data.orderIndex ?? data.order ?? 0,
    text: data.questionText || data.text || '',
    points,
    options,
    questionType: type,
  };
}

export const EXAM_ROOM_QUESTIONS_NOT_SAVED = 'EXAM_ROOM_QUESTIONS_NOT_SAVED';

// ── Mock questions (public — no answers) ────────────────────────────────────
export const MOCK_QUESTIONS_PUBLIC = [
  {
    id: 'q1', order: 1, points: 20,
    text: '2 + 2 × 5 = ?',
    options: [
      { id: 'opt-a', text: '12' },
      { id: 'opt-b', text: '20' },
      { id: 'opt-c', text: '10' },
      { id: 'opt-d', text: '14' },
    ],
  },
  {
    id: 'q2', order: 2, points: 20,
    text: 'ค่า x จากสมการ 3x − 6 = 9 คือ?',
    options: [
      { id: 'opt-a', text: '3' },
      { id: 'opt-b', text: '4' },
      { id: 'opt-c', text: '5' },
      { id: 'opt-d', text: '6' },
    ],
  },
  {
    id: 'q3', order: 3, points: 20,
    text: 'พื้นที่สี่เหลี่ยมผืนผ้ากว้าง 4 ซม. ยาว 7 ซม. คือ?',
    options: [
      { id: 'opt-a', text: '22 ตร.ซม.' },
      { id: 'opt-b', text: '11 ตร.ซม.' },
      { id: 'opt-c', text: '28 ตร.ซม.' },
      { id: 'opt-d', text: '14 ตร.ซม.' },
    ],
  },
  {
    id: 'q4', order: 4, points: 20,
    text: '√144 = ?',
    options: [
      { id: 'opt-a', text: '11' },
      { id: 'opt-b', text: '12' },
      { id: 'opt-c', text: '13' },
      { id: 'opt-d', text: '14' },
    ],
  },
  {
    id: 'q5', order: 5, points: 20,
    text: 'เศษส่วน 3/4 คิดเป็นกี่เปอร์เซ็นต์?',
    options: [
      { id: 'opt-a', text: '70%' },
      { id: 'opt-b', text: '72%' },
      { id: 'opt-c', text: '75%' },
      { id: 'opt-d', text: '80%' },
    ],
  },
];

// ── Hook: useExamRoom (teacher/admin side) ────────────────────────────────────

/** How attempts are loaded — biggest Firestore quota lever for this hook. */
export type ExamAttemptsLoadMode =
  /** One-time fetch for closed rooms + realtime listener on `active` rooms only (default — safe for manager/dashboard). */
  | 'all'
  /** Realtime listener on rooms with status === 'active' only (live proctoring / alerts). */
  | 'active'
  /** Realtime listener scoped to current user's own attempts in every room (student score views). */
  | 'mine'
  /** Skip attempts entirely (create-room shortcuts). */
  | 'none';

export interface UseExamRoomOptions {
  loadAttempts?: ExamAttemptsLoadMode;
  /**
   * Room ids the caller currently has open (detail view / proctor modal). Only matters for
   * non-teacher roles in `all` mode (admin/staff/sysadmin) — teachers already see a small,
   * per-teacher room set so live-listening every active room of theirs is cheap. Admin/staff
   * see EVERY active room school-wide with no owner filter, so N concurrently-logged-in admins
   * would each open a live listener on all of them — multiplying reads by admin session count.
   * Restricting live listeners to `focusRoomIds` keeps that multiplication bounded to rooms an
   * admin actually opened, not every active room in the school.
   */
  focusRoomIds?: string[];
}

type StudentExamContext = {
  classIds: string[];
  gradeLevels: string[];
  studentIds: string[];
};

// Session cache — home widget + exam pages remount resolve often
const studentCtxCache = new Map<string, { at: number; ctx: StudentExamContext }>();
const STUDENT_CTX_TTL_MS = 5 * 60 * 1000;

// Closed rooms' attempts are frozen once grading settles — cache per-roomId so reopening
// the same room's detail/proctor view within a session (or remounting ExamManager) doesn't
// re-fetch a subcollection that hasn't changed. Explicitly invalidated after mutations that
// touch a closed room's attempts (reset, finish).
const demandAttemptsCache = new Map<string, { at: number; attempts: ExamAttempt[] }>();
const DEMAND_ATTEMPTS_TTL_MS = 5 * 60 * 1000;

function mapRoomDoc(d: { id: string; data: () => Record<string, unknown> }): ExamRoom {
  const raw = d.data();
  return {
    ...raw,
    id: d.id,
    startTime: normalizeTimestamp(raw.startTime),
    endTime: normalizeTimestamp(raw.endTime),
    createdAt: normalizeTimestamp(raw.createdAt),
  } as ExamRoom;
}

function mapAttemptDoc(
  d: { id: string; data: () => Record<string, unknown> },
  roomId: string,
): ExamAttempt {
  const raw = d.data() as Record<string, unknown>;
  return {
    ...raw,
    id: d.id,
    roomId,
    score: normalizeExamScore(raw.score),
    startedAt: normalizeTimestamp(raw.startedAt),
    submittedAt: raw.submittedAt ? normalizeTimestamp(raw.submittedAt) : null,
    lastSavedAt: normalizeTimestamp(raw.lastSavedAt),
  } as ExamAttempt;
}

export function useExamRoom(options: UseExamRoomOptions = {}) {
  const loadAttempts = options.loadAttempts ?? 'all';
  // Stable string so effects don't resubscribe when the caller passes a fresh array each
  // render with the same content (e.g. an unmemoized [detailRoom?.id, proctoringRoom?.id]).
  const focusRoomIdsKey = useMemo(
    () => (options.focusRoomIds ?? []).filter(Boolean).slice().sort().join(','),
    [options.focusRoomIds],
  );
  const { user, role, userData } = useAuth();
  const { year: academicYear, activeSemester } = useActiveAcademicYear();
  const [rooms, setRooms] = useState<ExamRoom[]>([]);
  // `liveAttempts` = active rooms (or every room in `mine` mode) via onSnapshot.
  // `demandAttempts` = closed/non-active rooms, fetched only when a caller actually
  // opens that room's detail/proctor view — see loadRoomAttempts below. Merged into
  // the `attempts` memo exposed to callers.
  const [liveAttempts, setLiveAttempts] = useState<ExamAttempt[]>([]);
  const [demandAttempts, setDemandAttempts] = useState<Record<string, ExamAttempt[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const recalcAttemptedRef = useRef(new Set<string>());
  // Tracks roomId:round combos currently being auto-graded — prevents concurrent duplicate calls
  const gradingInFlightRef = useRef(new Set<string>());
  // Always-current rooms ref — lets callbacks read latest rooms without closing over the state value,
  // so useCallback/useEffect deps don't need to list `rooms` and won't re-run on every snapshot
  const roomsRef = useRef<ExamRoom[]>([]);
  roomsRef.current = rooms;

  // Stable string of sorted room IDs — changes only when the set of rooms actually changes,
  // not on every onSnapshot that emits the same rooms with new object references
  const roomIds = useMemo(() => rooms.map(r => r.id).sort().join(','), [rooms]);
  // Same idea, scoped to rooms currently `active` — drives which attempts listeners stay live
  const activeRoomIds = useMemo(
    () => rooms.filter(r => r.status === 'active').map(r => r.id).sort().join(','),
    [rooms],
  );

  // Load exam rooms by role
  useEffect(() => {
    if (!user?.uid || !academicYear || !activeSemester) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const resolveStudentContext = async (): Promise<StudentExamContext> => {
      const cached = studentCtxCache.get(user.uid);
      if (cached && Date.now() - cached.at < STUDENT_CTX_TTL_MS) {
        return cached.ctx;
      }

      const ids = new Set<string>();
      const grades = new Set<string>();
      const studentIds = new Set<string>([user.uid]);

      // Fast path from auth profile if present.
      const profile = (userData && typeof userData === 'object')
        ? (userData as Record<string, unknown>)
        : {};
      const profileClassId = typeof profile.classId === 'string'
        ? profile.classId
        : (typeof profile.classroomId === 'string' ? profile.classroomId : '');
      if (profileClassId.trim()) ids.add(profileClassId.trim());
      const profileGradeLevel = typeof profile.gradeLevel === 'string' ? profile.gradeLevel.trim() : '';
      if (profileGradeLevel) grades.add(profileGradeLevel);
      const profileStudentCode = typeof profile.studentCode === 'string' ? profile.studentCode.trim() : '';

      // Fallback from students profile document.
      try {
        const studentSnap = await getDoc(doc(db, 'students', user.uid));
        if (studentSnap.exists()) {
          const s = studentSnap.data() as Record<string, unknown>;
          studentIds.add(studentSnap.id);
          const classId = typeof s.classId === 'string'
            ? s.classId
            : (typeof s.classroomId === 'string' ? s.classroomId : '');
          if (classId.trim()) ids.add(classId.trim());
          const gradeLevel = typeof s.gradeLevel === 'string' ? s.gradeLevel.trim() : '';
          if (gradeLevel) grades.add(gradeLevel);
        }
      } catch (err) {
        console.warn('[useExamRoom] resolve student profile classId failed:', err);
      }

      // Find linked student profile by authUid (legacy data support).
      try {
        const byAuthUidQ = query(collection(db, 'students'), where('authUid', '==', user.uid));
        const byAuthUidSnap = await getDocs(byAuthUidQ);
        byAuthUidSnap.docs.forEach((d) => {
          studentIds.add(d.id);
          const s = d.data() as Record<string, unknown>;
          const classId = typeof s.classId === 'string'
            ? s.classId
            : (typeof s.classroomId === 'string' ? s.classroomId : '');
          if (classId && classId.trim()) ids.add(classId.trim());
          const gradeLevel = typeof s.gradeLevel === 'string' ? s.gradeLevel.trim() : '';
          if (gradeLevel) grades.add(gradeLevel);
        });
      } catch (err) {
        console.warn('[useExamRoom] resolve students by authUid failed:', err);
      }

      // Find profile by studentCode when uid mapping does not match.
      if (profileStudentCode) {
        try {
          const byCodeQ = query(collection(db, 'students'), where('studentCode', '==', profileStudentCode));
          const byCodeSnap = await getDocs(byCodeQ);
          byCodeSnap.docs.forEach((d) => {
            studentIds.add(d.id);
            const s = d.data() as Record<string, unknown>;
            const classId = typeof s.classId === 'string'
              ? s.classId
              : (typeof s.classroomId === 'string' ? s.classroomId : '');
            if (classId && classId.trim()) ids.add(classId.trim());
            const gradeLevel = typeof s.gradeLevel === 'string' ? s.gradeLevel.trim() : '';
            if (gradeLevel) grades.add(gradeLevel);
          });
        } catch (err) {
          console.warn('[useExamRoom] resolve students by studentCode failed:', err);
        }
      }

      // Source of truth for current year/semester.
      try {
        const studentIdList = Array.from(studentIds);
        const chunks: string[][] = [];
        for (let i = 0; i < studentIdList.length; i += 10) {
          chunks.push(studentIdList.slice(i, i + 10));
        }

        for (const chunk of chunks) {
          if (chunk.length === 0) continue;
          try {
            const enrollQ = query(
              collection(db, 'enrollments'),
              where('studentId', 'in', chunk),
              where('academicYearId', '==', String(academicYear)),
            );
            const enrollSnap = await getDocs(enrollQ);
            enrollSnap.docs.forEach((d) => {
              const data = d.data() as { classId?: string; semester?: number; gradeLevel?: string };
              if (data.semester && Number(data.semester) !== Number(activeSemester)) return;
              if (data.classId) ids.add(data.classId);
              if (data.gradeLevel && data.gradeLevel.trim()) grades.add(data.gradeLevel.trim());
            });
          } catch {
            // Fallback when composite index is not ready
            const enrollQ = query(
              collection(db, 'enrollments'),
              where('studentId', 'in', chunk),
            );
            const enrollSnap = await getDocs(enrollQ);
            enrollSnap.docs.forEach((d) => {
              const data = d.data() as {
                classId?: string;
                semester?: number;
                gradeLevel?: string;
                academicYearId?: string;
              };
              if (String(data.academicYearId ?? '') !== String(academicYear)) return;
              if (data.semester && Number(data.semester) !== Number(activeSemester)) return;
              if (data.classId) ids.add(data.classId);
              if (data.gradeLevel && data.gradeLevel.trim()) grades.add(data.gradeLevel.trim());
            });
          }
        }
      } catch (err) {
        console.warn('[useExamRoom] resolve student enrollments failed:', err);
      }

      const ctx = {
        classIds: Array.from(ids),
        gradeLevels: Array.from(grades),
        studentIds: Array.from(studentIds),
      };
      studentCtxCache.set(user.uid, { at: Date.now(), ctx });
      return ctx;
    };

    const attach = async () => {
      try {
        // Teachers see own rooms only.
        if (role === 'teacher') {
          const qRef = query(
            collection(db, 'exam_rooms'),
            where('academicYearId', '==', String(academicYear)),
            where('semester', '==', activeSemester),
            where('teacherId', '==', user.uid),
          );
          unsubscribe = onSnapshot(qRef, (snap) => {
            if (cancelled) return;
            setRooms(snap.docs.map(mapRoomDoc));
            setIsLoading(false);
          }, (err) => {
            console.error('Error loading teacher exam rooms:', err);
            if (!cancelled) setIsLoading(false);
          });
          return;
        }

        // Students: scope the query to their own class/gradeLevel — avoid listening to
        // every exam room in the school (was: whole-semester listener + client-side filter,
        // billed as (concurrent students) × (all rooms that semester) on every room change).
        if (role === 'student') {
          const studentCtx = await resolveStudentContext();
          if (cancelled) return;
          if (studentCtx.classIds.length === 0 && studentCtx.gradeLevels.length === 0) {
            setRooms([]);
            setIsLoading(false);
            return;
          }

          let byClassRooms: ExamRoom[] = [];
          let byGradeRooms: ExamRoom[] = [];
          const mergeAndEmit = () => {
            if (cancelled) return;
            const map = new Map<string, ExamRoom>();
            [...byClassRooms, ...byGradeRooms].forEach((r) => map.set(r.id, r));
            setRooms([...map.values()]);
            setIsLoading(false);
          };

          const unsubs: Array<() => void> = [];
          // Firestore `in` caps at 10 values — a student only ever has a handful of class/grade
          // matches in practice, so this is not a real limitation here.
          const classIdsChunk = studentCtx.classIds.slice(0, 10);
          if (classIdsChunk.length > 0) {
            const qClass = query(
              collection(db, 'exam_rooms'),
              where('academicYearId', '==', String(academicYear)),
              where('semester', '==', activeSemester),
              where('classId', 'in', classIdsChunk),
            );
            unsubs.push(onSnapshot(qClass, (snap) => {
              byClassRooms = snap.docs.map(mapRoomDoc);
              mergeAndEmit();
            }, (err) => {
              console.error('Error loading student exam rooms (classId):', err);
              if (!cancelled) setIsLoading(false);
            }));
          }

          const gradeLevelsChunk = studentCtx.gradeLevels.slice(0, 10);
          if (gradeLevelsChunk.length > 0) {
            const qGrade = query(
              collection(db, 'exam_rooms'),
              where('academicYearId', '==', String(academicYear)),
              where('semester', '==', activeSemester),
              where('gradeLevel', 'in', gradeLevelsChunk),
            );
            unsubs.push(onSnapshot(qGrade, (snap) => {
              byGradeRooms = snap.docs.map(mapRoomDoc);
              mergeAndEmit();
            }, (err) => {
              console.error('Error loading student exam rooms (gradeLevel):', err);
              if (!cancelled) setIsLoading(false);
            }));
          }

          unsubscribe = () => unsubs.forEach((u) => u());
          return;
        }

        // Admin/staff/others: see all rooms in current year/semester.
        const qRef = query(
          collection(db, 'exam_rooms'),
          where('academicYearId', '==', String(academicYear)),
          where('semester', '==', activeSemester),
        );
        unsubscribe = onSnapshot(qRef, (snap) => {
          if (cancelled) return;
          setRooms(snap.docs.map(mapRoomDoc));
          setIsLoading(false);
        }, (err) => {
          console.error('Error loading exam rooms:', err);
          if (!cancelled) setIsLoading(false);
        });
      } catch (err) {
        console.error('Error attaching exam rooms listener:', err);
        if (!cancelled) setIsLoading(false);
      }
    };

    void attach();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid, role, academicYear, activeSemester, userData]);

  // Load attempts — realtime, not polled, and not eager for closed rooms. Rooms that are no
  // longer `active` can't get new attempts writes, so instead of fetching every closed room's
  // whole subcollection up front (was: billed as (all closed rooms ever created) × reads on
  // every ExamManager mount, even when none are open), only `active` rooms (or, in `mine`
  // mode, every room — already cheap because it's filtered to the current user) get a live
  // `onSnapshot` listener here. Closed rooms are fetched on demand by loadRoomAttempts, only
  // when a caller actually opens that room (detail view / proctor modal).
  //
  // Admin/staff/sysadmin see EVERY active room school-wide (no teacherId filter on rooms) — if
  // every active room got a live listener here, N concurrently-logged-in admins would each pay
  // for all of them, multiplying reads by admin session count. Teachers only ever see their own
  // (small) room set, so that multiplication doesn't apply — only non-teacher roles are scoped
  // down to `focusRoomIds` (rooms they've actually opened); everything else falls back to the
  // one-time demand fetch via loadRoomAttempts.
  useEffect(() => {
    if (!roomIds || loadAttempts === 'none') {
      setLiveAttempts([]);
      return;
    }

    const ids = roomIds.split(',');
    const activeIds = activeRoomIds.split(',').filter(Boolean);
    const isBroadScope = loadAttempts === 'all' && role !== 'teacher';
    const focusSet = new Set(focusRoomIdsKey ? focusRoomIdsKey.split(',') : []);
    const liveIds = loadAttempts === 'mine'
      ? ids
      : isBroadScope
        ? activeIds.filter((id) => focusSet.has(id))
        : activeIds;
    const studentFilter = loadAttempts === 'mine' ? user?.uid : undefined;

    if (loadAttempts === 'mine' && !studentFilter) {
      setLiveAttempts([]);
      return;
    }

    let cancelled = false;
    const liveByRoom: Record<string, ExamAttempt[]> = {};

    const emit = () => {
      if (cancelled) return;
      setLiveAttempts(Object.values(liveByRoom).flat());
    };

    const unsubs = liveIds.map((roomId) => {
      const base = collection(db, 'exam_rooms', roomId, 'attempts');
      const q = studentFilter ? query(base, where('studentId', '==', studentFilter)) : base;
      return onSnapshot(q, (snap) => {
        liveByRoom[roomId] = snap.docs.map((d) => mapAttemptDoc(d, roomId));
        emit();
      }, (err) => {
        console.error('[useExamRoom] attempts listener failed:', roomId, err);
      });
    });

    if (liveIds.length === 0) {
      setLiveAttempts([]);
    }

    return () => {
      cancelled = true;
      unsubs.forEach((unsub) => unsub());
    };
  }, [roomIds, activeRoomIds, loadAttempts, user?.uid, role, focusRoomIdsKey]);

  // Closed rooms dropped from demandAttempts when they stop being requested (e.g. detail view
  // closed) would just refetch next time — cheap to keep them around for the session instead.
  // A room that later goes live again (next round started) is excluded from the demand side
  // here so its attempts aren't double-counted against the live listener's copy.
  const attempts = useMemo(() => {
    const demandEntries = Object.entries(demandAttempts);
    if (demandEntries.length === 0) return liveAttempts;
    // Mirror the live-listener effect's liveIds logic so a room that's actually being
    // live-streamed isn't also counted from its (now stale) demand-loaded copy.
    const activeIds = activeRoomIds.split(',').filter(Boolean);
    const isBroadScope = loadAttempts === 'all' && role !== 'teacher';
    const focusSet = new Set(focusRoomIdsKey ? focusRoomIdsKey.split(',') : []);
    const liveIdSet = new Set(
      loadAttempts === 'mine'
        ? []
        : isBroadScope
          ? activeIds.filter((id) => focusSet.has(id))
          : activeIds,
    );
    const demandOnly = demandEntries
      .filter(([roomId]) => !liveIdSet.has(roomId))
      .flatMap(([, list]) => list);
    if (demandOnly.length === 0) return liveAttempts;
    return [...liveAttempts, ...demandOnly];
  }, [liveAttempts, demandAttempts, activeRoomIds, loadAttempts, role, focusRoomIdsKey]);

  // On-demand fetch for a single closed room's attempts — call when a room's detail/proctor
  // view opens. No-op for rooms already covered by the live listener above (active rooms, or
  // any room in `mine` mode).
  const loadRoomAttempts = useCallback(async (roomId: string, opts?: { force?: boolean }) => {
    if (!roomId || loadAttempts === 'none' || loadAttempts === 'mine') return;

    if (!opts?.force) {
      const room = roomsRef.current.find((r) => r.id === roomId);
      if (room?.status === 'active') return;
      const cached = demandAttemptsCache.get(roomId);
      if (cached && Date.now() - cached.at < DEMAND_ATTEMPTS_TTL_MS) {
        setDemandAttempts((prev) => (prev[roomId] ? prev : { ...prev, [roomId]: cached.attempts }));
        return;
      }
    }

    try {
      const snap = await getDocs(collection(db, 'exam_rooms', roomId, 'attempts'));
      const list = snap.docs.map((d) => mapAttemptDoc(d, roomId));
      demandAttemptsCache.set(roomId, { at: Date.now(), attempts: list });
      setDemandAttempts((prev) => ({ ...prev, [roomId]: list }));
    } catch (err) {
      console.error('[useExamRoom] load room attempts failed:', roomId, err);
    }
  }, [loadAttempts]);

  const createRoom = useCallback(async (data: Omit<ExamRoom, 'id' | 'createdAt' | 'status' | 'currentRound' | 'completedRounds'>) => {
    try {
      const roomDoc = await addDoc(collection(db, 'exam_rooms'), {
        ...stripUndefined(data as Record<string, unknown>),
        status: 'upcoming',
        currentRound: 0,
        completedRounds: 0,
        createdAt: Timestamp.now(),
      });
      return { ...data, id: roomDoc.id, status: 'upcoming' as ExamRoomStatus, currentRound: 0, completedRounds: 0, createdAt: Date.now() };
    } catch (err) {
      console.error('Error creating exam room:', err);
      throw err;
    }
  }, []);

  const calculateRoomScores = useCallback(async (roomId: string, round: number, options?: { includeGraded?: boolean }) => {
    try {
      const roomData = await loadRoomForGrading(db, roomId);
      if (!roomData) return;

      const {
        selectedQuestionIds,
        questionPoints,
        candidateSetIds,
      } = resolveRoundGradingConfig(roomData, round);

      if (candidateSetIds.length === 0) return;

      const questionMap = await loadQuestionMapForSets(db, candidateSetIds);
      if (questionMap.size === 0) return;

      const questionsForRound: Question[] = resolveEffectiveQuestionIds(
        selectedQuestionIds,
        questionMap,
      ).map((questionId) => {
        const q = questionMap.get(questionId) as GradingQuestionDoc;
        return {
          id: q.id,
          setId: '',
          orderIndex: q.orderIndex ?? 0,
          curriculumYear: '',
          difficulty: 'medium' as const,
          type: q.type,
          questionText: '',
          images: [],
          payload: q.payload,
          createdBy: '',
          createdAt: 0,
          updatedAt: 0,
        };
      });
      const manualEssayQuestions = getManualEssayQuestions(questionsForRound);

      const attemptsQ = query(
        collection(db, 'exam_rooms', roomId, 'attempts'),
        where('round', '==', round),
      );
      const attemptsSnap = await getDocs(attemptsQ);

      const batch = writeBatch(db);
      let pending = 0;

      attemptsSnap.docs.forEach((attemptDoc) => {
        const attemptData = attemptDoc.data() as ExamAttempt;
        const status = attemptData.status;
        const canGrade =
          status === 'submitted'
          || (options?.includeGraded === true && status === 'graded');
        if (!canGrade) return;

        const answers = attemptData.answers && typeof attemptData.answers === 'object'
          ? attemptData.answers
          : {};
        const result = gradeAttemptAnswers(
          selectedQuestionIds,
          questionMap,
          answers,
          questionPoints,
        );

        if (result.kind === 'skipped_no_questions' || result.kind === 'skipped_no_set_ids') {
          return;
        }

        const isPartial = result.kind === 'partial_graded';
        const existingManual = attemptData.manualScores ?? {};
        const hasSavedManual = Object.keys(existingManual).length > 0;

        if (hasSavedManual && manualEssayQuestions.length > 0) {
          const attemptWithObjective: ExamAttempt = {
            ...attemptData,
            objectiveScore: result.score,
            score: result.score,
            pendingManualGrading: isPartial,
          };
          const merged = buildAttemptScoreUpdate(
            attemptWithObjective,
            existingManual,
            manualEssayQuestions,
          );
          batch.update(attemptDoc.ref, {
            ...merged,
            objectiveMaxPoints: result.autoGradableMaxPoints,
            manualEssayCount: result.manualEssayCount,
          });
        } else {
          batch.update(attemptDoc.ref, {
            score: result.score,
            status: isPartial ? 'submitted' : 'graded',
            objectiveScore: result.score,
            objectiveMaxPoints: result.autoGradableMaxPoints,
            pendingManualGrading: isPartial,
            manualEssayCount: result.manualEssayCount,
          });
        }
        pending += 1;
      });

      if (pending > 0) {
        await batch.commit();
      }
    } catch (err) {
      console.error('Error calculating room scores:', err);
    }
  }, []);

  const updateRoomStatus = useCallback(async (roomId: string, status: ExamRoomStatus) => {
    try {
      const room = roomsRef.current.find(r => r.id === roomId);
      if (!room) return;

      const maxAttempts = room.settings?.maxAttempts ?? 1;

      if (status === 'active') {
        const nextRound = (room.currentRound ?? 0) + 1;
        if (!roomHasSavedQuestions(room, nextRound)) {
          throw new Error(EXAM_ROOM_QUESTIONS_NOT_SAVED);
        }
        const now = Date.now();
        const durationMs = (room.durationMinutes || 60) * 60 * 1000;
        await updateDoc(doc(db, 'exam_rooms', roomId), {
          status: 'active',
          currentRound: nextRound,
          startTime: now,
          endTime: now + durationMs,
        });
      } else if (status === 'closed') {
        const completed = (room.completedRounds ?? 0) + 1;
        const hasMoreRounds = maxAttempts === 0 || completed < maxAttempts;
        const currentRound = room.currentRound;

        // Auto-submit every in-progress attempt in the current room/round
        // before closing, so students currently doing the exam are finalized.
        const attemptsRef = collection(db, 'exam_rooms', roomId, 'attempts');
        const attemptsSnap = await getDocs(attemptsRef);
        const inProgressDocs = attemptsSnap.docs.filter((d) => {
          const data = d.data() as Partial<ExamAttempt>;
          const isInProgress = data.status === 'in_progress';
          // If currentRound is known, only finalize that round.
          if (!currentRound || currentRound <= 0) return isInProgress;
          return isInProgress && Number(data.round) === Number(currentRound);
        });

        if (inProgressDocs.length > 0) {
          for (let i = 0; i < inProgressDocs.length; i += 450) {
            const chunk = inProgressDocs.slice(i, i + 450);
            const batch = writeBatch(db);
            chunk.forEach((attemptDoc) => {
              batch.update(attemptDoc.ref, {
                status: 'submitted',
                submittedAt: Timestamp.now(),
                lastSavedAt: Timestamp.now(),
              });
            });
            await batch.commit();
          }
        }

        await updateDoc(doc(db, 'exam_rooms', roomId), {
          status: hasMoreRounds ? 'upcoming' : 'closed',
          completedRounds: completed,
        });

        // คะแนนทั้งรอบคำนวณโดย finalizeExamRoundOnClose (Cloud Function) เพียงจุดเดียว —
        // ไม่เรียก calculateRoomScores() ซ้ำจาก client เพื่อกันคำนวณแข่งกัน 2 ทาง

        // Room just left the live listener (active → upcoming/closed) — force a fresh
        // demand-load so an open detail view doesn't flash empty mid-transition.
        demandAttemptsCache.delete(roomId);
        void loadRoomAttempts(roomId, { force: true });
      } else {
        await updateDoc(doc(db, 'exam_rooms', roomId), { status });
      }
    } catch (err) {
      console.error('Error updating exam room status:', err);
      throw err;
    }
  }, [loadRoomAttempts]); // roomsRef is a ref — reading .current doesn't need to be a dep

  // Permanently close a room configured for unlimited rounds (maxAttempts === 0).
  // Unlike updateRoomStatus('closed'), this always lands on 'closed' — it never
  // loops back to 'upcoming' — since unlimited rooms otherwise have no way to
  // reach a terminal state on their own.
  const finishRoom = useCallback(async (roomId: string) => {
    try {
      const room = roomsRef.current.find(r => r.id === roomId);
      if (!room) return;

      if (room.status !== 'active') {
        await updateDoc(doc(db, 'exam_rooms', roomId), { status: 'closed' });
        void loadRoomAttempts(roomId, { force: true });
        return;
      }

      const currentRound = room.currentRound;
      const attemptsRef = collection(db, 'exam_rooms', roomId, 'attempts');
      const attemptsSnap = await getDocs(attemptsRef);
      const inProgressDocs = attemptsSnap.docs.filter((d) => {
        const data = d.data() as Partial<ExamAttempt>;
        const isInProgress = data.status === 'in_progress';
        if (!currentRound || currentRound <= 0) return isInProgress;
        return isInProgress && Number(data.round) === Number(currentRound);
      });

      if (inProgressDocs.length > 0) {
        for (let i = 0; i < inProgressDocs.length; i += 450) {
          const chunk = inProgressDocs.slice(i, i + 450);
          const batch = writeBatch(db);
          chunk.forEach((attemptDoc) => {
            batch.update(attemptDoc.ref, {
              status: 'submitted',
              submittedAt: Timestamp.now(),
              lastSavedAt: Timestamp.now(),
            });
          });
          await batch.commit();
        }
      }

      await updateDoc(doc(db, 'exam_rooms', roomId), {
        status: 'closed',
        completedRounds: (room.completedRounds ?? 0) + 1,
      });

      // คะแนนคำนวณโดย finalizeExamRoundOnClose (Cloud Function) เพียงจุดเดียว —
      // ไม่เรียก calculateRoomScores() ซ้ำจาก client เพื่อกันคำนวณแข่งกัน 2 ทาง

      // Room just left the live listener (active → closed) — force a fresh demand-load so
      // an open detail view doesn't flash empty while its onSnapshot is still tearing down.
      demandAttemptsCache.delete(roomId);
      void loadRoomAttempts(roomId, { force: true });
    } catch (err) {
      console.error('Error finishing exam room:', err);
      throw err;
    }
  }, [loadRoomAttempts]);

  const updateRoom = useCallback(async (roomId: string, data: Partial<ExamRoom>) => {
    try {
      const { id, createdAt, ...updateData } = data as any;
      await updateDoc(doc(db, 'exam_rooms', roomId), stripUndefined(updateData));
    } catch (err) {
      console.error('Error updating exam room:', err);
      throw err;
    }
  }, []);

  const deleteRoom = useCallback(async (roomId: string) => {
    try {
      await deleteDoc(doc(db, 'exam_rooms', roomId));
    } catch (err) {
      console.error('Error deleting exam room:', err);
      throw err;
    }
  }, []);

  // Reset a single student's attempt(s) in a room
  const resetStudentAttempt = useCallback(async (roomId: string, studentId: string) => {
    try {
      const attQ = query(
        collection(db, 'exam_rooms', roomId, 'attempts'),
        where('studentId', '==', studentId),
      );
      const snap = await getDocs(attQ);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      // Closed-room deletions aren't covered by a live listener — force-refresh so the
      // open detail view reflects the reset immediately instead of waiting on cache TTL.
      demandAttemptsCache.delete(roomId);
      void loadRoomAttempts(roomId, { force: true });
    } catch (err) {
      console.error('Error resetting student attempt:', err);
      throw err;
    }
  }, [loadRoomAttempts]);

  // Reset ALL attempts in a room (full exam reset)
  const resetAllAttempts = useCallback(async (roomId: string) => {
    try {
      const attQ = collection(db, 'exam_rooms', roomId, 'attempts');
      const snap = await getDocs(attQ);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      // Also reset round counters. Round numbers restart from 1 after this, so the
      // finalizeExamRoundOnClose lock (finalizedRounds) must clear too, or the next
      // "round 1" would be seen as already-finalized and never get graded.
      await updateDoc(doc(db, 'exam_rooms', roomId), {
        currentRound: 0,
        completedRounds: 0,
        status: 'upcoming',
        finalizedRounds: [],
      });
      demandAttemptsCache.delete(roomId);
      void loadRoomAttempts(roomId, { force: true });
    } catch (err) {
      console.error('Error resetting all attempts:', err);
      throw err;
    }
  }, [loadRoomAttempts]);

  const getAttemptsForRoom = useCallback((roomId: string) => {
    return attempts.filter(a => a.roomId === roomId);
  }, [attempts]);

  // Auto-close expired active rooms (when teacher is viewing)
  // Uses roomsRef so the interval callback always sees fresh room data without
  // needing rooms/updateRoomStatus in deps (both are now stable across snapshots)
  useEffect(() => {
    if (role !== 'teacher' || isLoading) return;

    const interval = setInterval(() => {
      const now = Date.now();
      roomsRef.current.forEach(room => {
        if (room.status === 'active' && room.endTime && now > room.endTime + 2000) {
          console.log(`[useExamRoom] Auto-closing expired room: ${room.id}`);
          void updateRoomStatus(room.id, 'closed');
        }
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [role, isLoading, updateRoomStatus]);

  // One-time repair for attempts wrongly scored 0 by a legacy Cloud Function bug.
  // Plain "submitted, score still null" attempts are NOT recalculated here anymore —
  // that's now finalizeExamRoundOnClose's (Cloud Function) job alone, so this effect
  // running in every open teacher/admin tab doesn't race it right after a room closes.
  useEffect(() => {
    const canAutoGrade = role === 'teacher' || role === 'admin' || role === 'sysadmin';
    if (!canAutoGrade || isLoading || attempts.length === 0) return;

    const regradeZeroTasks = new Set<string>();

    const uncalculated = attempts.filter((a) => {
      const room = roomsRef.current.find((r) => r.id === a.roomId);
      // รอบที่ยังเปิดอยู่ — รอครูปิดแล้วค่อยคำนวณทั้งรอบทีเดียว
      if (
        room?.status === 'active'
        && Number(a.round) === Number(room.currentRound)
      ) {
        return false;
      }

      // One-time re-grade for attempts wrongly scored 0 (legacy Cloud Function bug)
      if (a.status === 'graded' && normalizeExamScore(a.score) === 0) {
        const answerCount = a.answers ? Object.keys(a.answers).length : 0;
        if (answerCount === 0) return false;
        const manualTotal = Object.values(a.manualScores ?? {}).reduce(
          (sum, value) => sum + (typeof value === 'number' && Number.isFinite(value) ? value : 0),
          0,
        );
        if (manualTotal > 0) return false;
        const taskKey = `${a.roomId}:${a.round}:regrade-zero`;
        if (recalcAttemptedRef.current.has(taskKey)) return false;
        recalcAttemptedRef.current.add(taskKey);
        regradeZeroTasks.add(`${a.roomId}:${a.round}`);
        return true;
      }
      return false;
    });
    if (uncalculated.length === 0) return;

    const tasks = new Map<string, Set<number>>();
    uncalculated.forEach((a) => {
      if (!tasks.has(a.roomId)) tasks.set(a.roomId, new Set());
      tasks.get(a.roomId)!.add(a.round);
    });

    tasks.forEach((rounds, rId) => {
      rounds.forEach((round) => {
        const flightKey = `${rId}:${round}`;
        // Skip if a calculateRoomScores call is already in-flight for this room/round —
        // prevents concurrent duplicate writes that would each trigger another snapshot cycle
        if (gradingInFlightRef.current.has(flightKey)) return;
        gradingInFlightRef.current.add(flightKey);
        const needsIncludeGraded = regradeZeroTasks.has(flightKey);
        console.log(`[useExamRoom] Auto-calculating scores for room ${rId} round ${round}`);
        void calculateRoomScores(rId, round, needsIncludeGraded ? { includeGraded: true } : undefined)
          .finally(() => gradingInFlightRef.current.delete(flightKey));
      });
    });
  }, [attempts, role, isLoading, calculateRoomScores]);

  return { rooms, attempts, isLoading, createRoom, updateRoom, updateRoomStatus, finishRoom, deleteRoom, getAttemptsForRoom, loadRoomAttempts, resetStudentAttempt, resetAllAttempts, calculateRoomScores };
}

// ── Hook: useExamAttempt (student side) ───────────────────────────────────────
export type ExamRoomPreview = Pick<ExamRoom, 'title' | 'gradeLevel' | 'subjectName' | 'className' | 'subjectGroupId' | 'subSubjectGroup'>;

export type ExamPdfPart = {
  setId: string;
  partIndex: number;
  partLabel: string;
  title: string;
  examPdfUrl: string;
  examPdfHiddenPages: number[];
};

export type ExamAnswerSheetGroup = {
  setId: string;
  partLabel: string;
  title: string;
  questions: ExamQuestionPublic[];
};

function parseSetTitle(data: Record<string, unknown> | undefined, index: number): string {
  if (typeof data?.title === 'string' && data.title.trim()) return data.title.trim();
  return `ชุดข้อสอบ ${index + 1}`;
}

function metaMapFromSetSnaps(
  setMetaSnaps: Array<{ id: string; data: () => Record<string, unknown> | undefined }>,
): Map<string, Record<string, unknown>> {
  const metaById = new Map<string, Record<string, unknown>>();
  setMetaSnaps.forEach((snap) => {
    const data = snap.data();
    if (data) metaById.set(snap.id, data);
  });
  return metaById;
}

function parseExamPdfHiddenPages(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is number => Number.isInteger(p) && p >= 1);
}

function buildExamPdfPartsFromSetSnaps(
  orderedSetIds: string[],
  metaById: Map<string, Record<string, unknown>>,
): ExamPdfPart[] {
  const parts: ExamPdfPart[] = [];
  orderedSetIds.forEach((setId, index) => {
    const data = metaById.get(setId);
    const url = data?.examPdfUrl;
    if (typeof url !== 'string' || !url.trim()) return;
    parts.push({
      setId,
      partIndex: index,
      partLabel: `Part ${index + 1}`,
      title: parseSetTitle(data, index),
      examPdfUrl: url,
      examPdfHiddenPages: parseExamPdfHiddenPages(data?.examPdfHiddenPages),
    });
  });
  return parts;
}

function buildAnswerSheetGroups(
  orderedQuestions: ExamQuestionPublic[],
  orderedSetIds: string[],
  setByQuestionId: Record<string, string>,
  fallbackSetId: string,
  metaById: Map<string, Record<string, unknown>>,
): ExamAnswerSheetGroup[] {
  if (orderedSetIds.length <= 1) {
    return orderedQuestions.length > 0
      ? [{
          setId: orderedSetIds[0] ?? fallbackSetId ?? '',
          partLabel: 'Part 1',
          title: parseSetTitle(metaById.get(orderedSetIds[0] ?? ''), 0),
          questions: orderedQuestions,
        }]
      : [];
  }

  return orderedSetIds
    .map((setId, index) => ({
      setId,
      partLabel: `Part ${index + 1}`,
      title: parseSetTitle(metaById.get(setId), index),
      questions: orderedQuestions.filter(
        (q) => (setByQuestionId[q.id] ?? fallbackSetId) === setId,
      ),
    }))
    .filter((group) => group.questions.length > 0);
}

export function useExamAttempt(roomId: string) {
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [room, setRoom] = useState<ExamRoom | null>(null);
  const [roomPreview, setRoomPreview] = useState<ExamRoomPreview | null>(null);
  const [questions, setQuestions] = useState<ExamQuestionPublic[]>([]);
  const [examPdfParts, setExamPdfParts] = useState<ExamPdfPart[]>([]);
  const [answerSheetGroups, setAnswerSheetGroups] = useState<ExamAnswerSheetGroup[]>([]);
  const [examPdfUrl, setExamPdfUrl] = useState<string | null>(null);
  const [examPdfHiddenPages, setExamPdfHiddenPages] = useState<number[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const attemptRef = useRef<ExamAttempt | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  attemptRef.current = attempt;

  useEffect(() => {
    if (!roomId) {
      setRoomPreview(null);
      return;
    }
    let cancelled = false;
    void getDoc(doc(db, 'exam_rooms', roomId))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const data = snap.data() as Partial<ExamRoom>;
        setRoomPreview({
          title: data.title?.trim() || 'ห้องสอบออนไลน์',
          gradeLevel: data.gradeLevel,
          subjectName: data.subjectName,
          className: data.className,
          subjectGroupId: data.subjectGroupId,
          subSubjectGroup: data.subSubjectGroup,
        });
      })
      .catch(() => {
        // Preview is optional; join still validates password.
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // Real-time listener for the student's attempt
  useEffect(() => {
    if (!roomId || !attempt?.id) return;
    
    const unsub = onSnapshot(doc(db, 'exam_rooms', roomId, 'attempts', attempt.id), (snap) => {
      if (snap.exists()) {
        const raw = snap.data();
        setAttempt(prev => {
          if (!prev) return null;
          const gradingFieldsChanged =
            raw.objectiveMaxPoints !== prev.objectiveMaxPoints
            || raw.pendingManualGrading !== prev.pendingManualGrading
            || raw.manualEssayCount !== prev.manualEssayCount;
          // Only skip noisy updates during active typing; always apply grading results.
          if (
            raw.status === prev.status
            && raw.score === prev.score
            && !gradingFieldsChanged
            && (raw.answers ? Object.keys(raw.answers).length : 0) <= (prev.answers ? Object.keys(prev.answers).length : 0)
          ) {
            return prev;
          }
          return {
            ...prev,
            ...raw,
            id: snap.id,
            startedAt: normalizeTimestamp(raw.startedAt),
            submittedAt: raw.submittedAt ? normalizeTimestamp(raw.submittedAt) : null,
            lastSavedAt: normalizeTimestamp(raw.lastSavedAt),
          } as ExamAttempt;
        });
      }
    });

    return () => unsub();
  }, [roomId, attempt?.id]);

  // Recover stuck grading after round close (submitted but score still null)
  useEffect(() => {
    if (!roomId || !attempt?.id || !room) return;
    if (attempt.status !== 'submitted') return;
    if (typeof attempt.score === 'number') return;
    // ระหว่างรอบยังเปิด — รอครูปิดห้องก่อนจึงคำนวณคะแนนทั้งรอบ
    if (room.status === 'active') return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      void requestExamAttemptGrading(roomId, attempt.id).catch((err) => {
        console.warn('Exam grading recovery failed:', err);
      });
    }, 2000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [roomId, room?.status, attempt?.id, attempt?.status, attempt?.score]);


  const fetchQuestions = useCallback(async (roomData: ExamRoom, studentId?: string): Promise<ExamQuestionPublic[]> => {
    setIsLoadingQuestions(true);
    try {
      const { roundConfig } = getRoundQuestionConfig(roomData);

      const fallbackSetId = roundConfig?.questionSetId || roomData.questionSetId;
      const selectedIds = roundConfig?.questionIds || roomData.selectedQuestionIds || [];
      const setByQuestionId = roundConfig?.questionSetByQuestionId || {};

      if (selectedIds.length === 0 && !fallbackSetId) {
        setQuestions([]);
        setExamPdfParts([]);
        setAnswerSheetGroups([]);
        setExamPdfUrl(null);
        setExamPdfHiddenPages([]);
        return [];
      }

      const candidateSetIds = new Set<string>();
      selectedIds.forEach((qid) => {
        const mappedSetId = setByQuestionId[qid];
        if (mappedSetId) candidateSetIds.add(mappedSetId);
      });
      if (fallbackSetId) candidateSetIds.add(fallbackSetId);

      if (candidateSetIds.size === 0) {
        setQuestions([]);
        setExamPdfParts([]);
        setAnswerSheetGroups([]);
        setExamPdfUrl(null);
        setExamPdfHiddenPages([]);
        return [];
      }

      const orderedSetIds = deriveSetOrder(
        selectedIds,
        setByQuestionId,
        fallbackSetId ?? '',
      );
      const setIds = Array.from(candidateSetIds);
      const metaIdsToLoad = orderedSetIds.length > 0 ? orderedSetIds : setIds;
      let metaById = new Map<string, Record<string, unknown>>();

      try {
        // ดึง metadata ของทุก set ด้วย documentId 'in' แบบ batch แทนการ getDoc ทีละ set (N+1)
        const metaSnaps = await Promise.all(
          chunkIds(metaIdsToLoad).map((group) =>
            getDocs(query(collection(db, 'question_sets'), where(documentId(), 'in', group))),
          ),
        );
        const setMetaSnaps = metaSnaps.flatMap((snap) =>
          snap.docs.map((d) => ({ id: d.id, data: () => d.data() as Record<string, unknown> | undefined })),
        );
        metaById = metaMapFromSetSnaps(setMetaSnaps);
        const parts = buildExamPdfPartsFromSetSnaps(metaIdsToLoad, metaById);
        setExamPdfParts(parts);
        setExamPdfUrl(parts[0]?.examPdfUrl ?? null);
        setExamPdfHiddenPages(parts[0]?.examPdfHiddenPages ?? []);
      } catch {
        setExamPdfParts([]);
        setExamPdfUrl(null);
        setExamPdfHiddenPages([]);
      }

      const questionPoints = roundConfig?.questionPoints ?? {};

      const setSnapshots = await Promise.all(
        setIds.map((setId) => getDocs(collection(db, 'question_sets', setId, 'questions'))),
      );

      const questionMap = new Map<string, ExamQuestionPublic>();
      setSnapshots.forEach((snap) => {
        snap.docs.forEach((d) => {
          questionMap.set(d.id, parseQuestionDoc(d, questionPoints));
        });
      });

      let orderedQuestions: ExamQuestionPublic[] = [];

      if (selectedIds.length > 0) {
        orderedQuestions = selectedIds
          .map((qid, index) => {
            const q = questionMap.get(qid);
            if (!q) return null;
            return { ...q, order: q.order || index + 1 };
          })
          .filter((q): q is ExamQuestionPublic => q !== null);
      }

      // Fallback: load all questions from set when IDs missing or stale (e.g. after PDF answer-key re-save)
      if (orderedQuestions.length === 0 && questionMap.size > 0) {
        orderedQuestions = Array.from(questionMap.values())
          .sort((a, b) => a.order - b.order)
          .map((q, index) => ({ ...q, order: index + 1 }));
      }

      // สลับลำดับข้อสำหรับนักเรียนแต่ละคน (ถ้าเปิดใช้) — เฉพาะข้อที่ไม่ใช่ชุด PDF
      // (PDF ผูกกับหน้ากระดาษคำตอบตายตัว สลับไม่ได้) ใช้ seed คงที่ต่อคน/ห้อง/รอบ/ชุด
      // เพื่อให้ลำดับเดิมทุกครั้งที่โหลดซ้ำ (resume/refresh)
      if (roomData.settings?.shuffleQuestions && studentId) {
        const roundNum = Number(roomData.currentRound ?? 1) || 1;
        const indicesBySetId = new Map<string, number[]>();

        orderedQuestions.forEach((q, idx) => {
          const setId = setByQuestionId[q.id] || fallbackSetId || '';
          const isPdfSet = typeof metaById.get(setId)?.examPdfUrl === 'string'
            && !!(metaById.get(setId)?.examPdfUrl as string).trim();
          if (isPdfSet) return;
          const arr = indicesBySetId.get(setId) ?? [];
          arr.push(idx);
          indicesBySetId.set(setId, arr);
        });

        const shuffled = [...orderedQuestions];
        indicesBySetId.forEach((indices, setId) => {
          if (indices.length < 2) return;
          const values = indices.map((i) => orderedQuestions[i]);
          const shuffledValues = seededShuffle(values, `${studentId}_${roomData.id}_${roundNum}_${setId}`);
          indices.forEach((originalIdx, k) => {
            shuffled[originalIdx] = shuffledValues[k];
          });
        });
        orderedQuestions = shuffled;
      }

      setQuestions(orderedQuestions);
      setAnswerSheetGroups(
        buildAnswerSheetGroups(
          orderedQuestions,
          orderedSetIds.length > 0 ? orderedSetIds : setIds,
          setByQuestionId,
          fallbackSetId ?? '',
          metaById,
        ),
      );
      setIsLoadingQuestions(false);
      return orderedQuestions;
    } catch (err) {
      setIsLoadingQuestions(false);
      console.error('Error fetching questions:', err);
      const code = (err as { code?: string } | null)?.code;
      if (code === 'permission-denied') {
        setError('ไม่มีสิทธิ์เข้าถึงข้อสอบ กรุณาแจ้งครูผู้สอน');
      } else {
        setError('ไม่สามารถโหลดข้อสอบได้');
      }
      setQuestions([]);
      setAnswerSheetGroups([]);
      return [];
    }
  }, []);

  const joinRoom = useCallback(async (password: string, studentId: string, studentName: string) => {
    setIsJoining(true);
    setError(null);
    try {
      const snap = await getDoc(doc(db, 'exam_rooms', roomId));

      if (!snap.exists()) {
        setError('ไม่พบห้องสอบ');
        setIsJoining(false);
        return false;
      }

      const found = { id: snap.id, ...snap.data() } as ExamRoom;
      if (found.password !== password) {
        setError('รหัสห้องสอบไม่ถูกต้อง');
        setIsJoining(false);
        return false;
      }
      if (found.status !== 'active') {
        setError('ห้องสอบยังไม่เปิด หรือปิดไปแล้ว');
        setIsJoining(false);
        return false;
      }
      const now = Date.now();
      const startMs = typeof found.startTime === 'number' ? found.startTime : 0;
      const endMs = typeof found.endTime === 'number' ? found.endTime : 0;
      if (startMs > 0 && now < startMs) {
        setError('ยังไม่ถึงเวลาเริ่มสอบ');
        setIsJoining(false);
        return false;
      }
      if (endMs > 0 && now >= endMs) {
        setError('หมดเวลาทำข้อสอบแล้ว');
        setIsJoining(false);
        return false;
      }

      const loadedQuestions = await fetchQuestions(found, studentId);
      if (loadedQuestions.length === 0) {
        setError(prev => prev ?? describeMissingQuestionsError(found));
        setIsJoining(false);
        return false;
      }

      const currentRound = found.currentRound ?? 1;

      // Prefer studentId query; fall back if composite index missing
      let matchingAttemptDoc: { id: string; data: () => Record<string, unknown> } | undefined;
      try {
        const mineSnap = await getDocs(
          query(
            collection(db, 'exam_rooms', roomId, 'attempts'),
            where('studentId', '==', studentId),
            where('round', '==', currentRound),
          ),
        );
        matchingAttemptDoc = mineSnap.docs[0];
      } catch {
        try {
          const byStudentSnap = await getDocs(
            query(
              collection(db, 'exam_rooms', roomId, 'attempts'),
              where('studentId', '==', studentId),
            ),
          );
          matchingAttemptDoc = byStudentSnap.docs.find((d) => d.data()?.round === currentRound);
        } catch {
          const allAttemptsSnap = await getDocs(collection(db, 'exam_rooms', roomId, 'attempts'));
          matchingAttemptDoc = allAttemptsSnap.docs.find((d) => {
            const data = d.data();
            return String(data?.studentId).trim() === String(studentId).trim()
              && data?.round === currentRound;
          });
        }
      }

      if (matchingAttemptDoc) {
        const existingRaw = matchingAttemptDoc.data();
        let existing = {
          ...existingRaw,
          id: matchingAttemptDoc.id,
          startedAt: normalizeTimestamp(existingRaw?.startedAt),
          submittedAt: existingRaw?.submittedAt ? normalizeTimestamp(existingRaw?.submittedAt) : null,
          lastSavedAt: normalizeTimestamp(existingRaw?.lastSavedAt),
        } as ExamAttempt;

        // Merge answers from localStorage if available
        const localStr = localStorage.getItem(`exam_attempt_${roomId}_${studentId}`);
        if (localStr) {
          try {
            const localData = JSON.parse(localStr);
            if (localData && localData.answers) {
              existing = { ...existing, answers: localData.answers, lastSavedAt: localData.lastSavedAt || existing.lastSavedAt };
            }
          } catch (e) {
            console.error('Error parsing local attempt:', e);
          }
        }

        setAttempt(existing);
        setRoom(found);
        setIsJoining(false);
        return true;
      }

      // ตรวจสอบว่านักเรียนอยู่ห้องเรียนตรงกับที่ห้องสอบนี้กำหนดไว้ก่อนสร้าง attempt ใหม่
      // (เฉพาะตอนเข้าครั้งแรก — ไม่บล็อกการ resume attempt ที่มีอยู่แล้ว)
      // ถ้าห้องสอบไม่ได้ผูกกับห้องเรียนใดห้องหนึ่ง (classId ว่าง) หรือหา classId ของนักเรียนไม่เจอ จะไม่บล็อก
      if (found.classId) {
        let studentClassId: string | undefined;
        const studentSnap = await getDoc(doc(db, 'students', studentId));
        studentClassId = studentSnap.exists() ? (studentSnap.data() as { classId?: string })?.classId : undefined;

        if (!studentClassId) {
          const byAuthUid = await getDocs(query(collection(db, 'students'), where('authUid', '==', studentId)));
          studentClassId = byAuthUid.docs[0]?.data()?.classId;
        }
        if (!studentClassId) {
          const byUserId = await getDocs(query(collection(db, 'students'), where('userId', '==', studentId)));
          studentClassId = byUserId.docs[0]?.data()?.classId;
        }

        if (studentClassId && studentClassId !== found.classId) {
          setError(`ห้องสอบนี้จัดไว้สำหรับห้อง ${found.className || ''} — คุณไม่ได้อยู่ห้องนี้ กรุณาตรวจสอบห้องสอบกับครูผู้สอนก่อนเข้าใหม่`);
          setIsJoining(false);
          return false;
        }
      }

      // Create new attempt
      const newAttemptDoc = await addDoc(collection(db, 'exam_rooms', roomId, 'attempts'), {
        studentId,
        studentName,
        roomId,
        round: currentRound,
        status: 'in_progress',
        answers: {},
        suspiciousActivities: 0,
        score: null,
        startedAt: Timestamp.now(),
        submittedAt: null,
        lastSavedAt: Timestamp.now(),
      });

      const newAttempt: ExamAttempt = {
        id: newAttemptDoc.id,
        studentId,
        studentName,
        roomId,
        round: currentRound,
        status: 'in_progress',
        answers: {},
        suspiciousActivities: 0,
        score: null,
        startedAt: Date.now(),
        submittedAt: null,
        lastSavedAt: Date.now(),
      };

      localStorage.setItem(`exam_attempt_${roomId}_${studentId}`, JSON.stringify(newAttempt));
      setAttempt(newAttempt);
      setRoom(found);
      setIsJoining(false);
      return true;
    } catch (err) {
      console.error('Error joining exam room:', err);
      setError('เกิดข้อผิดพลาดในการเข้าห้องสอบ');
      setIsJoining(false);
      return false;
    }
  }, [roomId, fetchQuestions]);

  const flushAnswerSave = useCallback(async () => {
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const current = attemptRef.current;
    if (!current || current.status !== 'in_progress' || !roomId) return;
    try {
      await updateDoc(doc(db, 'exam_rooms', roomId, 'attempts', current.id), {
        answers: current.answers,
        lastSavedAt: Timestamp.now(),
      });
    } catch (err) {
      console.error('Error saving answer to server:', err);
    }
  }, [roomId]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        void flushAnswerSave();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', () => {
      void flushAnswerSave();
    });
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      void flushAnswerSave();
    };
  }, [flushAnswerSave]);

  const saveAnswer = useCallback(async (questionId: string, optionId: string) => {
    if (!attempt) return;
    if (attempt.status !== 'in_progress') return;
    const nextAnswers = { ...attempt.answers };
    if (!optionId.trim()) {
      delete nextAnswers[questionId];
    } else {
      nextAnswers[questionId] = optionId;
    }
    const updated = {
      ...attempt,
      answers: nextAnswers,
      lastSavedAt: Date.now(),
    };

    setAttempt(updated);
    attemptRef.current = updated;
    localStorage.setItem(`exam_attempt_${roomId}_${attempt.studentId}`, JSON.stringify(updated));

    // Debounce Firestore writes — local + localStorage stay immediate
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void flushAnswerSave();
    }, 600);
  }, [attempt, roomId, flushAnswerSave]);

  const recordSuspicious = useCallback(async () => {
    if (!attempt) return;
    try {
      const updated = { ...attempt, suspiciousActivities: (attempt.suspiciousActivities || 0) + 1 };
      await updateDoc(doc(db, 'exam_rooms', roomId, 'attempts', attempt.id), {
        suspiciousActivities: updated.suspiciousActivities,
      });
      setAttempt(updated);
    } catch (err) {
      console.error('Error recording suspicious activity:', err);
    }
  }, [attempt]);

  const submitAttempt = useCallback(async (options?: { force?: boolean }) => {
    if (!attempt || !room) return;
    if (!options?.force && !canSubmitExamManually(attempt.startedAt)) {
      return;
    }
    try {
      await flushAnswerSave();
      const latest = attemptRef.current ?? attempt;
      const updated = { ...latest, status: 'submitted' as const, submittedAt: Date.now() };

      await updateDoc(doc(db, 'exam_rooms', roomId, 'attempts', latest.id), {
        answers: updated.answers,
        status: 'submitted',
        submittedAt: Timestamp.now(),
        lastSavedAt: Timestamp.now(),
      });

      setAttempt(updated);
      localStorage.removeItem(`exam_attempt_${roomId}_${latest.studentId}`);

      // คะแนนทั้งรอบคำนวณทีเดียวตอนครูปิดห้อง — ไม่ตรวจรายคนตอนส่ง
      if (room.status !== 'active') {
        try {
          await requestExamAttemptGrading(roomId, latest.id);
        } catch (gradeErr) {
          console.warn('Exam grading callable failed, waiting for trigger:', gradeErr);
        }
      }
    } catch (err) {
      console.error('Error submitting attempt:', err);
    }
  }, [attempt, room, roomId, flushAnswerSave]);

  const isSubmitted = attempt?.status === 'submitted' || attempt?.status === 'graded';

  return {
    attempt,
    room,
    roomPreview,
    questions,
    examPdfParts,
    answerSheetGroups,
    examPdfUrl,
    examPdfHiddenPages,
    isJoining,
    isLoadingQuestions,
    error,
    joinRoom,
    saveAnswer,
    recordSuspicious,
    submitAttempt,
    isSubmitted,
  };
}
