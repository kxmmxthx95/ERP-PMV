3.// src/hooks/useExamRoom.ts
import { useState, useCallback, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ExamRoom, ExamAttempt, ExamRoomStatus, ExamQuestionPublic } from '@/types/exam';
import type { Question, MultipleChoicePayload } from '@/types/questionBank';
import { useActiveAcademicYear } from './useActiveAcademicYear';
import { useAuth } from './useAuth';

// ── Helpers ──────────────────────────────────────────────────────────────────
const normalizeTimestamp = (val: any): number => {
  if (typeof val === 'number') return val;
  if (val && typeof val.toMillis === 'function') return val.toMillis();
  if (val && typeof val.seconds === 'number') return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
  if (val instanceof Date) return val.getTime();
  return 0;
};

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
export function useExamRoom() {
  const { user, role, userData } = useAuth();
  const { year: academicYear, activeSemester } = useActiveAcademicYear();
  const [rooms, setRooms] = useState<ExamRoom[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load exam rooms by role
  useEffect(() => {
    if (!user?.uid || !academicYear || !activeSemester) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const resolveStudentContext = async (): Promise<{
      classIds: string[];
      gradeLevels: string[];
      studentIds: string[];
    }> => {
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

      return {
        classIds: Array.from(ids),
        gradeLevels: Array.from(grades),
        studentIds: Array.from(studentIds),
      };
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
            const data = snap.docs.map(d => {
              const raw = d.data();
              return {
                ...raw,
                id: d.id,
                startTime: normalizeTimestamp(raw.startTime),
                endTime: normalizeTimestamp(raw.endTime),
                createdAt: normalizeTimestamp(raw.createdAt),
              } as ExamRoom;
            });
            setRooms(data);
            setIsLoading(false);
          }, (err) => {
            console.error('Error loading teacher exam rooms:', err);
            if (!cancelled) setIsLoading(false);
          });
          return;
        }

        // Students see rooms for their enrolled class in current year/semester.
        if (role === 'student') {
          const studentCtx = await resolveStudentContext();
          if (cancelled) return;
          if (studentCtx.classIds.length === 0 && studentCtx.gradeLevels.length === 0) {
            setRooms([]);
            setIsLoading(false);
            return;
          }

          const qRef = query(
            collection(db, 'exam_rooms'),
            where('academicYearId', '==', String(academicYear)),
            where('semester', '==', activeSemester),
          );
          unsubscribe = onSnapshot(qRef, (snap) => {
            if (cancelled) return;
            const data = snap.docs
              .map(d => {
                const raw = d.data();
                return {
                  ...raw,
                  id: d.id,
                  startTime: normalizeTimestamp(raw.startTime),
                  endTime: normalizeTimestamp(raw.endTime),
                  createdAt: normalizeTimestamp(raw.createdAt),
                } as ExamRoom;
              })
              .filter((room) => {
                const byClass = !!room.classId && studentCtx.classIds.includes(room.classId);
                const byGrade = !!room.gradeLevel && studentCtx.gradeLevels.includes(room.gradeLevel);
                return byClass || byGrade;
              });
            setRooms(data);
            setIsLoading(false);
          }, (err) => {
            console.error('Error loading student exam rooms:', err);
            if (!cancelled) setIsLoading(false);
          });
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
          const data = snap.docs.map(d => {
            const raw = d.data();
            return {
              ...raw,
              id: d.id,
              startTime: normalizeTimestamp(raw.startTime),
              endTime: normalizeTimestamp(raw.endTime),
              createdAt: normalizeTimestamp(raw.createdAt),
            } as ExamRoom;
          });
          setRooms(data);
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

  // Load attempts — one sub-collection listener per room (no chunked where-in queries)
  useEffect(() => {
    if (rooms.length === 0) {
      setAttempts([]);
      return;
    }

    const unsubscribes: (() => void)[] = [];
    const attemptsMap = new Map<string, ExamAttempt>();

    rooms.forEach((room) => {
      const q = collection(db, 'exam_rooms', room.id, 'attempts');

      const unsub = onSnapshot(q, (snap) => {
        snap.docChanges().forEach(change => {
          if (change.type === 'removed') {
            attemptsMap.delete(change.doc.id);
          } else {
            const raw = change.doc.data();
            attemptsMap.set(change.doc.id, {
              ...raw,
              id: change.doc.id,
              roomId: room.id,
              startedAt: normalizeTimestamp(raw.startedAt),
              submittedAt: raw.submittedAt ? normalizeTimestamp(raw.submittedAt) : null,
              lastSavedAt: normalizeTimestamp(raw.lastSavedAt),
            } as ExamAttempt);
          }
        });
        setAttempts(Array.from(attemptsMap.values()));
      }, (err) => {
        console.error('Error loading exam attempts:', err);
      });
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [rooms]);

  const createRoom = useCallback(async (data: Omit<ExamRoom, 'id' | 'createdAt' | 'status' | 'currentRound' | 'completedRounds'>) => {
    try {
      const roomDoc = await addDoc(collection(db, 'exam_rooms'), {
        ...data,
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

  const calculateRoomScores = useCallback(async (roomId: string, round: number) => {
    try {
      const roomSnap = await getDoc(doc(db, 'exam_rooms', roomId));
      if (!roomSnap.exists()) return;
      const roomData = { id: roomSnap.id, ...roomSnap.data() } as ExamRoom;

      const roundKey = String(round);
      const roundConfig = roomData.roundQuestions?.[roundKey]
        || roomData.roundQuestions?.['∞']
        || roomData.roundQuestions?.['1']
        || (roomData.roundQuestions ? Object.values(roomData.roundQuestions)[0] : undefined);

      const fallbackSetId = roundConfig?.questionSetId || roomData.questionSetId;
      const selectedIds = roundConfig?.questionIds || roomData.selectedQuestionIds || [];
      const setByQuestionId = roundConfig?.questionSetByQuestionId || {};

      if (selectedIds.length === 0) return;

      const candidateSetIds = new Set<string>();
      selectedIds.forEach((qid) => {
        const mappedSetId = setByQuestionId[qid];
        if (mappedSetId) candidateSetIds.add(mappedSetId);
      });
      if (fallbackSetId) candidateSetIds.add(fallbackSetId);

      const setIds = Array.from(candidateSetIds);
      const questionMap = new Map<string, Question>();
      
      await Promise.all(
        setIds.map(async (setId) => {
          const snap = await getDocs(collection(db, 'question_sets', setId, 'questions'));
          snap.docs.forEach((d) => {
            questionMap.set(d.id, { id: d.id, ...d.data() } as Question);
          });
        })
      );

      const attemptsQ = query(
        collection(db, 'exam_rooms', roomId, 'attempts'),
        where('round', '==', round),
        where('status', '==', 'submitted')
      );
      const attemptsSnap = await getDocs(attemptsQ);

      const batch = writeBatch(db);
      attemptsSnap.docs.forEach((attemptDoc) => {
        const attemptData = attemptDoc.data() as ExamAttempt;
        let totalScore = 0;

        selectedIds.forEach((qid) => {
          const q = questionMap.get(qid);
          if (!q) return;

          const studentAnswer = attemptData.answers[qid];
          if (!studentAnswer) return;

          if (q.type === 'multiple_choice') {
            const payload = q.payload as MultipleChoicePayload;
            const correctOption = payload.options.find(o => o.isCorrect);
            if (correctOption && correctOption.id === studentAnswer) {
              totalScore += (q as any).points || 1;
            }
          }
        });

        batch.update(attemptDoc.ref, {
          score: totalScore,
          status: 'graded',
        });
      });

      await batch.commit();
    } catch (err) {
      console.error('Error calculating room scores:', err);
    }
  }, []);

  const updateRoomStatus = useCallback(async (roomId: string, status: ExamRoomStatus) => {
    try {
      const room = rooms.find(r => r.id === roomId);
      if (!room) return;

      const maxAttempts = room.settings?.maxAttempts ?? 1;

      if (status === 'active') {
        const nextRound = (room.currentRound ?? 0) + 1;
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

        // Trigger score calculation for the round that just ended
        if (currentRound > 0) {
          void calculateRoomScores(roomId, currentRound);
        }
      } else {
        await updateDoc(doc(db, 'exam_rooms', roomId), { status });
      }
    } catch (err) {
      console.error('Error updating exam room status:', err);
      throw err;
    }
  }, [rooms, calculateRoomScores]);

  const updateRoom = useCallback(async (roomId: string, data: Partial<ExamRoom>) => {
    try {
      const { id, createdAt, ...updateData } = data as any;
      await updateDoc(doc(db, 'exam_rooms', roomId), updateData);
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
    } catch (err) {
      console.error('Error resetting student attempt:', err);
      throw err;
    }
  }, []);

  // Reset ALL attempts in a room (full exam reset)
  const resetAllAttempts = useCallback(async (roomId: string) => {
    try {
      const attQ = collection(db, 'exam_rooms', roomId, 'attempts');
      const snap = await getDocs(attQ);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      // Also reset round counters
      await updateDoc(doc(db, 'exam_rooms', roomId), {
        currentRound: 0,
        completedRounds: 0,
        status: 'upcoming',
      });
    } catch (err) {
      console.error('Error resetting all attempts:', err);
      throw err;
    }
  }, []);

  const getAttemptsForRoom = useCallback((roomId: string) => {
    return attempts.filter(a => a.roomId === roomId);
  }, [attempts]);

  // Auto-close expired active rooms (when teacher is viewing)
  useEffect(() => {
    if (role !== 'teacher' || isLoading || rooms.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      rooms.forEach(room => {
        // If room is active and past its endTime, close it automatically.
        if (room.status === 'active' && room.endTime && now > room.endTime + 2000) { // 2s buffer
          console.log(`[useExamRoom] Auto-closing expired room: ${room.id}`);
          void updateRoomStatus(room.id, 'closed');
        }
      });
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [rooms, role, isLoading, updateRoomStatus]);

  // Auto-calculate scores for late submissions (submitted after room closed)
  useEffect(() => {
    if (role !== 'teacher' || isLoading || attempts.length === 0) return;

    // Filter attempts that are 'submitted' but have no score
    const uncalculated = attempts.filter(a => a.status === 'submitted' && a.score === null);
    if (uncalculated.length === 0) return;

    // Group by roomId and round to minimize calls
    const tasks = new Map<string, Set<number>>();
    uncalculated.forEach(a => {
      if (!tasks.has(a.roomId)) tasks.set(a.roomId, new Set());
      tasks.get(a.roomId)!.add(a.round);
    });

    tasks.forEach((rounds, rId) => {
      rounds.forEach(round => {
        console.log(`[useExamRoom] Auto-calculating late submission for room ${rId} round ${round}`);
        void calculateRoomScores(rId, round);
      });
    });
  }, [attempts, role, isLoading, calculateRoomScores]);

  return { rooms, attempts, isLoading, createRoom, updateRoom, updateRoomStatus, deleteRoom, getAttemptsForRoom, resetStudentAttempt, resetAllAttempts };
}

// ── Hook: useExamAttempt (student side) ───────────────────────────────────────
export function useExamAttempt(roomId: string) {
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [room, setRoom] = useState<ExamRoom | null>(null);
  const [questions, setQuestions] = useState<ExamQuestionPublic[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // Real-time listener for the student's attempt
  useEffect(() => {
    if (!roomId || !attempt?.id) return;
    
    const unsub = onSnapshot(doc(db, 'exam_rooms', roomId, 'attempts', attempt.id), (snap) => {
      if (snap.exists()) {
        const raw = snap.data();
        setAttempt(prev => {
          if (!prev) return null;
          // Only update if status or score changed to avoid noise during active typing
          if (raw.status === prev.status && raw.score === prev.score && (raw.answers ? Object.keys(raw.answers).length : 0) <= (prev.answers ? Object.keys(prev.answers).length : 0)) {
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


  const fetchQuestions = useCallback(async (roomData: ExamRoom): Promise<ExamQuestionPublic[]> => {
    setIsLoadingQuestions(true);
    try {
      const rawRound = Number(roomData.currentRound ?? 1);
      const currentRound = Number.isFinite(rawRound) && rawRound > 0 ? rawRound : 1;
      const roundKey = String(currentRound);
      const roundConfig =
        roomData.roundQuestions?.[roundKey]
        || roomData.roundQuestions?.['∞']
        || roomData.roundQuestions?.['1']
        || (roomData.roundQuestions ? Object.values(roomData.roundQuestions)[0] : undefined);

      const fallbackSetId = roundConfig?.questionSetId || roomData.questionSetId;
      const selectedIds = roundConfig?.questionIds || roomData.selectedQuestionIds || [];
      const setByQuestionId = roundConfig?.questionSetByQuestionId || {};

      if (selectedIds.length === 0) {
        setQuestions([]);
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
        return [];
      }

      const setIds = Array.from(candidateSetIds);
      const setSnapshots = await Promise.all(
        setIds.map((setId) => getDocs(collection(db, 'question_sets', setId, 'questions'))),
      );

      const questionMap = new Map<string, ExamQuestionPublic>();
      setSnapshots.forEach((snap) => {
        snap.docs.forEach((d) => {
          const data = d.data() as {
            orderIndex?: number;
            order?: number;
            text?: string;
            questionText?: string;
            points?: number;
            options?: Array<{ id?: string; text?: string }>;
            payload?: { options?: Array<{ id?: string; text?: string }> };
          };
          const payloadOptions = Array.isArray(data.payload?.options) ? data.payload.options : [];
          const rawOptions = Array.isArray(data.options) && data.options.length > 0
            ? data.options
            : payloadOptions;
          const options = rawOptions.map((opt, index) => ({
            id: opt.id || `opt-${index + 1}`,
            text: opt.text || '',
          }));

          questionMap.set(d.id, {
            id: d.id,
            order: data.orderIndex ?? data.order ?? 0,
            text: data.questionText || data.text || '',
            points: data.points || 0,
            options,
          });
        });
      });

      const orderedQuestions = selectedIds
        .map((qid, index) => {
          const q = questionMap.get(qid);
          if (!q) return null;
          return { ...q, order: q.order || index + 1 };
        })
        .filter((q): q is ExamQuestionPublic => q !== null);

      setQuestions(orderedQuestions);
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

      const loadedQuestions = await fetchQuestions(found);
      if (loadedQuestions.length === 0) {
        setError(prev => prev ?? 'ไม่พบข้อสอบในห้องนี้ กรุณาแจ้งครูผู้สอน');
        setIsJoining(false);
        return false;
      }

      const currentRound = found.currentRound ?? 1;

      // Check if student already has an in-progress attempt for this round
      const existingAttempts = query(
        collection(db, 'exam_rooms', roomId, 'attempts'),
        where('studentId', '==', studentId),
        where('round', '==', currentRound),
      );
      const existingSnap = await getDocs(existingAttempts);

      if (!existingSnap.empty) {
        const existingRaw = existingSnap.docs[0].data();
        let existing = {
          ...existingRaw,
          id: existingSnap.docs[0].id,
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

  const saveAnswer = useCallback(async (questionId: string, optionId: string) => {
    if (!attempt) return;
    if (attempt.status !== 'in_progress') return;
    const updated = {
      ...attempt,
      answers: { ...attempt.answers, [questionId]: optionId },
      lastSavedAt: Date.now(),
    };

    setAttempt(updated);
    localStorage.setItem(`exam_attempt_${roomId}_${attempt.studentId}`, JSON.stringify(updated));

    try {
      await updateDoc(doc(db, 'exam_rooms', roomId, 'attempts', attempt.id), {
        answers: updated.answers,
        lastSavedAt: Timestamp.now(),
      });
    } catch (err) {
      console.error('Error saving answer to server:', err);
    }
  }, [attempt, roomId]);

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

  const submitAttempt = useCallback(async () => {
    if (!attempt) return;
    try {
      const updated = { ...attempt, status: 'submitted' as const, submittedAt: Date.now() };

      await updateDoc(doc(db, 'exam_rooms', roomId, 'attempts', attempt.id), {
        answers: updated.answers,
        status: 'submitted',
        submittedAt: Timestamp.now(),
        lastSavedAt: Timestamp.now(),
      });

      setAttempt(updated);
      localStorage.removeItem(`exam_attempt_${roomId}_${attempt.studentId}`);
    } catch (err) {
      console.error('Error submitting attempt:', err);
    }
  }, [attempt, roomId]);

  const isSubmitted = attempt?.status === 'submitted' || attempt?.status === 'graded';

  return { attempt, room, questions, isJoining, isLoadingQuestions, error, joinRoom, saveAnswer, recordSuspicious, submitAttempt, isSubmitted };
}
