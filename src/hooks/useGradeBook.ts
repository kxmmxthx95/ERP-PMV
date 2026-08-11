// src/hooks/useGradeBook.ts
//
// Firebase quota strategy:
//   - ใช้ getDocs (one-shot) แทน onSnapshot เพราะ grade data ไม่ได้เปลี่ยนเรียลไทม์
//   - อ่านครั้งเดียวเมื่อ (classId + subjectId) เปลี่ยน — cache ด้วย useRef
//   - GradeWeightConfig เก็บใน collection 'grade_configs' (document id = configKey)
//   - GradeRecord เก็บใน collection 'grade_records'
//   - exam_scores อ่านแยกตาม examId ที่ผูกกับ exam ของ classId+subjectId เดียวกัน

import { useState, useCallback, useRef } from 'react';
import {
  collection, getDoc, getDocs, setDoc, doc, query, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  GradeWeightConfig, GradeRecord, StudentScoreSummary, GradeLetter,
  GradeThreshold, NewGradeRecord, PassFailResult,
} from '@/types/grades';
import {
  DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, DEFAULT_MAX_SCORES,
  categoryScoreToPercent, rawPointsToPercent, averagePercentScores,
} from '@/types/grades';
import type { Exam, ExamScore } from '@/types/teaching';
import type { Department } from '@/types/curriculum';
import {
  buildStudentIdentityLookup,
  findScoreRecordForStudent,
} from '@/lib/students/studentIdentity';

// ── Helpers ────────────────────────────────────────────────────────────────────

export function calcGrade(pct: number, thresholds: GradeThreshold[]): GradeLetter {
  const sorted = [...thresholds].sort((a, b) => b.minScore - a.minScore);
  for (const t of sorted) {
    if (pct >= t.minScore) return t.grade;
  }
  return 'F';
}

function makeConfigKey(subjectId: string, classId: string, yearId: string, sem: 1 | 2) {
  return `${subjectId}_${classId}_${yearId}_${sem}`;
}

export type OnlineExamScoresByStudent = Map<string, {
  classworkScore: number | null;
  midtermScore: number | null;
  finalScore: number | null;
}>;

export type OnlineExamLinkedFields = {
  classwork: boolean;
  midterm: boolean;
  final: boolean;
};

export function mergeOnlineExamScores(
  summaries: StudentScoreSummary[],
  config: GradeWeightConfig,
  byStudent: OnlineExamScoresByStudent,
  linkedFields: OnlineExamLinkedFields,
): StudentScoreSummary[] {
  return summaries.map(s => {
    const online = byStudent.get(s.studentId);
    return withRecalculatedTotals({
      ...s,
      classworkScore: linkedFields.classwork
        ? (online?.classworkScore ?? s.classworkScore)
        : s.classworkScore,
      midtermScore: linkedFields.midterm
        ? (online?.midtermScore ?? s.midtermScore)
        : s.midtermScore,
      finalScore: linkedFields.final
        ? (online?.finalScore ?? s.finalScore)
        : s.finalScore,
    }, config);
  });
}

function withRecalculatedTotals(
  summary: StudentScoreSummary,
  config: GradeWeightConfig,
): StudentScoreSummary {
  const { weights, thresholds } = config;
  const cwPct = summary.classworkScore !== null
    ? categoryScoreToPercent(summary.classworkScore)
    : null;
  const midPct = summary.midtermScore !== null
    ? categoryScoreToPercent(summary.midtermScore)
    : null;
  const finPct = summary.finalScore !== null
    ? categoryScoreToPercent(summary.finalScore)
    : null;

  const wCw = weights.classwork / 100;
  const wMid = weights.midterm / 100;
  const wFin = weights.final / 100;

  let totalScore: number | null = null;
  let weightedSum = 0;
  let hasAny = false;

  if (cwPct !== null) {
    weightedSum += cwPct * wCw;
    hasAny = true;
  }
  if (midPct !== null) {
    weightedSum += midPct * wMid;
    hasAny = true;
  }
  if (finPct !== null) {
    weightedSum += finPct * wFin;
    hasAny = true;
  }

  if (hasAny) {
    totalScore = Math.round(weightedSum * 10) / 10;
  }

  return {
    ...summary,
    totalScore,
    grade: totalScore !== null ? calcGrade(totalScore, thresholds) : null,
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useGradeBook() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // local state สำหรับ session ที่กำลังดูอยู่
  const [config, setConfig] = useState<GradeWeightConfig | null>(null);
  const [summaries, setSummaries] = useState<StudentScoreSummary[]>([]);
  const [savedRecords, setSavedRecords] = useState<GradeRecord[]>([]);

  // cache เพื่อไม่อ่าน Firestore ซ้ำเมื่อ params ไม่เปลี่ยน
  const cacheKey = useRef<string>('');

  // ── Load grade book สำหรับ subject + class หนึ่งคู่ ──────────────────────────

  const loadGradeBook = useCallback(async (params: {
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    classId: string;
    className: string;
    teacherId: string;
    departmentId: Department;
    academicYearId: string;
    semester: 1 | 2;
    students: Array<{
      studentId: string;
      studentName: string;
      studentCode: string;
      photoURL?: string;
      gender?: 'male' | 'female';
      authUid?: string;
      userId?: string;
      email?: string;
    }>;
  }) => {
    const studentSig = params.students.map(s => s.studentId).sort().join('|');
    const key = `${makeConfigKey(params.subjectId, params.classId, params.academicYearId, params.semester)}::${studentSig}`;
    if (cacheKey.current === key) return; // ไม่อ่านซ้ำ

    setIsLoading(true);
    setError(null);

    try {
      // ── 1. อ่าน GradeWeightConfig (1 doc read) ────────────────────────────────
      let cfg: GradeWeightConfig;
      const cfgRef = doc(db, 'grade_configs', key);
      const cfgSnap = await getDoc(cfgRef).catch(() => null);

      if (cfgSnap?.exists()) {
        cfg = { id: cfgSnap.id, ...cfgSnap.data() } as GradeWeightConfig;
      } else {
        cfg = {
          id: key,
          subjectId: params.subjectId,
          classId: params.classId,
          academicYearId: params.academicYearId,
          semester: params.semester,
          departmentId: params.departmentId,
          weights: { ...DEFAULT_WEIGHTS },
          maxScores: { ...DEFAULT_MAX_SCORES },
          thresholds: [...DEFAULT_THRESHOLDS],
          updatedAt: new Date().toISOString(),
        };
      }
      setConfig(cfg);

      // ── 2. อ่าน exams ของ subject + class (1 query read) ─────────────────────
      const examsSnap = await getDocs(
        query(
          collection(db, 'exams'),
          where('subjectId', '==', params.subjectId),
          where('classId', '==', params.classId),
          where('academicYearId', '==', params.academicYearId),
          where('semester', '==', params.semester),
        )
      ).catch(() => null);

      const exams: Exam[] = examsSnap?.docs.map(d => ({ id: d.id, ...d.data() } as Exam)) ?? [];
      const examIds = exams.map(e => e.id);

      // ── 3. อ่าน exam_scores ทั้งหมดของ examIds เหล่านั้น ─────────────────────
      // Firestore 'in' query รองรับได้สูงสุด 30 items; แบ่ง chunk ถ้าเกิน
      const allScores: ExamScore[] = [];
      if (examIds.length > 0) {
        const chunkSize = 30;
        const chunks: string[][] = [];
        for (let i = 0; i < examIds.length; i += chunkSize) {
          chunks.push(examIds.slice(i, i + chunkSize));
        }
        const scoreSnaps = await Promise.all(
          chunks.map((chunk) =>
            getDocs(query(collection(db, 'exam_scores'), where('examId', 'in', chunk))).catch(() => null),
          ),
        );
        scoreSnaps.forEach((scoresSnap) => {
          scoresSnap?.docs.forEach((d) => allScores.push({ id: d.id, ...d.data() } as ExamScore));
        });
      }

      // ── 4. อ่าน grade_records ที่บันทึกไว้แล้ว (1 query read) ────────────────
      const recordsSnap = await getDocs(
        query(
          collection(db, 'grade_records'),
          where('subjectId', '==', params.subjectId),
          where('classId', '==', params.classId),
          where('academicYearId', '==', params.academicYearId),
          where('semester', '==', params.semester),
        )
      ).catch(() => null);

      const records: GradeRecord[] = recordsSnap?.docs.map(d => ({ id: d.id, ...d.data() } as GradeRecord)) ?? [];
      setSavedRecords(records);
      const recordMap = new Map(records.map(r => [r.studentId, r]));

      const identityLookup = buildStudentIdentityLookup(
        params.students.map(stu => ({
          student: {
            id: stu.studentId,
            studentCode: stu.studentCode,
            authUid: stu.authUid,
            userId: stu.userId,
            email: stu.email,
          },
        })),
      );

      const rosterStudent = (stu: (typeof params.students)[number]) => ({
        id: stu.studentId,
        studentCode: stu.studentCode,
        authUid: stu.authUid,
        userId: stu.userId,
        email: stu.email,
      });

      // ── 5. สร้าง ScoreMap per student per examType ────────────────────────────
      // คะแนน classwork = รวม quiz + classwork type
      // midterm = ค่าสูงสุดของ exam type midterm (ถ้าสอบหลายครั้ง เอาล่าสุด)
      // final = exam type final

      const examByType = new Map<string, Exam[]>();
      exams.forEach(e => {
        const arr = examByType.get(e.type) ?? [];
        arr.push(e);
        examByType.set(e.type, arr);
      });

      // Map: examId → ExamScore[] แยกตาม studentId
      const scoresByExamId = new Map<string, Map<string, ExamScore>>();
      allScores.forEach(s => {
        let m = scoresByExamId.get(s.examId);
        if (!m) { m = new Map(); scoresByExamId.set(s.examId, m); }
        m.set(s.studentId, s);
      });

      // ── 6. Build summaries ─────────────────────────────────────────────────────
      const built: StudentScoreSummary[] = params.students.map(stu => {
        const saved = findScoreRecordForStudent(recordMap, rosterStudent(stu), identityLookup);

        // ถ้ามี saved record แล้ว — ใช้เลย (ครูตรวจแล้ว)
        if (saved) {
          return {
            studentId: stu.studentId,
            studentName: stu.studentName,
            studentCode: stu.studentCode,
            photoURL: stu.photoURL,
            gender: stu.gender,
            classworkScore: saved.classworkScore,
            midtermScore: saved.midtermScore,
            finalScore: saved.finalScore,
            totalScore: saved.totalScore,
            grade: saved.grade,
            result: saved.result ?? null,
            absent: saved.absent,
            note: saved.note,
          };
        }

        // ยังไม่มี record — คำนวณจาก exam_scores อัตโนมัติ
        const getLatestScore = (examType: string): number | null => {
          const typeExams = examByType.get(examType) ?? [];
          if (typeExams.length === 0) return null;
          // เรียงตาม examDate ล่าสุด
          const sorted = [...typeExams].sort((a, b) => b.examDate.localeCompare(a.examDate));
          for (const exam of sorted) {
            const examScores = scoresByExamId.get(exam.id);
            if (!examScores) continue;
            const sc = findScoreRecordForStudent(examScores, rosterStudent(stu), identityLookup);
            if (sc && !sc.absent && sc.score !== undefined) {
              return rawPointsToPercent(sc.score, exam.maxScore);
            }
          }
          return null;
        };

        // classwork = เฉลี่ย % จาก quiz/makeup แต่ละชิ้น (แปลงจากคะแนนเต็มของข้อสอบอัตโนมัติ)
        const classworkExams = [...(examByType.get('quiz') ?? []), ...(examByType.get('makeup') ?? [])];
        const classworkPcts: number[] = [];
        classworkExams.forEach(exam => {
          const examScores = scoresByExamId.get(exam.id);
          if (!examScores) return;
          const sc = findScoreRecordForStudent(examScores, rosterStudent(stu), identityLookup);
          if (sc && !sc.absent && sc.score !== undefined) {
            classworkPcts.push(rawPointsToPercent(sc.score, exam.maxScore));
          }
        });
        const classworkRaw = averagePercentScores(classworkPcts);

        const midtermRaw = getLatestScore('midterm');
        const finalRaw = getLatestScore('final');

        return withRecalculatedTotals({
          studentId: stu.studentId,
          studentName: stu.studentName,
          studentCode: stu.studentCode,
          photoURL: stu.photoURL,
          gender: stu.gender,
          classworkScore: classworkRaw,
          midtermScore: midtermRaw,
          finalScore: finalRaw,
          totalScore: null,
          grade: null,
          absent: false,
        }, cfg);
      });

      setSummaries(built);
      cacheKey.current = key;

      // ── Eagerly create cfgRef ถ้ายังไม่มี (ไม่รอ) ───────────────────────────
      if (!cfgSnap?.exists()) {
        setDoc(cfgRef, { ...cfg }).catch(() => {});
      }
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลเกรดได้');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Update config locally + Firestore ─────────────────────────────────────────

  const saveConfig = useCallback(async (updated: GradeWeightConfig) => {
    const key = updated.id;
    await setDoc(doc(db, 'grade_configs', key), {
      ...updated,
      updatedAt: new Date().toISOString(),
    });
    setConfig(updated);
    cacheKey.current = ''; // invalidate cache เพื่อ recalculate
  }, []);

  // ── Recalculate summaries เมื่อ config เปลี่ยน ───────────────────────────────

  const recalculate = useCallback((newConfig: GradeWeightConfig) => {
    setSummaries(prev => prev.map(s => {
      if (s.classworkScore === null && s.midtermScore === null && s.finalScore === null) return s;
      return withRecalculatedTotals(s, newConfig);
    }));
  }, []);

  // ── Manual override: ครูแก้คะแนนเองในตาราง ────────────────────────────────────

  const updateStudentScore = useCallback((studentId: string, field: 'classworkScore' | 'midtermScore' | 'finalScore' | 'note' | 'absent', value: number | string | boolean | null) => {
    setSummaries(prev => prev.map(s => {
      if (s.studentId !== studentId) return s;
      const updated = { ...s, [field]: value };

      // recalculate total ถ้าเป็น score field
      if (field !== 'note' && field !== 'absent' && config) {
        return withRecalculatedTotals(updated, config);
      }

      return updated;
    }));
  }, [config]);

  // ── นำคะแนนสอบออนไลน์เข้าตาราง (best score per student) ─────────────────────

  const applyOnlineExamScores = useCallback((updates: Array<{
    studentId: string;
    field: 'classworkScore' | 'midtermScore' | 'finalScore';
    score: number;
    mode: 'add' | 'max';
  }>) => {
    if (updates.length === 0 || !config) return 0;

    let applied = 0;
    setSummaries(prev => prev.map(s => {
      const upd = updates.find(u => u.studentId === s.studentId);
      if (!upd) return s;

      applied += 1;
      const current = s[upd.field] as number | null;
      const nextValue = upd.mode === 'add'
        ? (current ?? 0) + upd.score
        : (current !== null ? Math.max(current, upd.score) : upd.score);

      return withRecalculatedTotals({ ...s, [upd.field]: nextValue }, config);
    }));
    return applied;
  }, [config]);

  const revertOnlineExamScores = useCallback((reverts: Array<{
    studentId: string;
    field: 'classworkScore' | 'midtermScore' | 'finalScore';
    previousValue: number | null;
  }>) => {
    if (reverts.length === 0 || !config) return 0;

    let reverted = 0;
    setSummaries(prev => prev.map(s => {
      const rev = reverts.find(r => r.studentId === s.studentId);
      if (!rev) return s;

      reverted += 1;
      return withRecalculatedTotals({ ...s, [rev.field]: rev.previousValue }, config);
    }));
    return reverted;
  }, [config]);

  /** บันทึกผ่าน/ไม่ผ่าน ทีละคน (วิชากิจกรรม) */
  const savePassFailResult = useCallback(async (
    params: {
      subjectId: string;
      subjectName: string;
      subjectCode: string;
      classId: string;
      className: string;
      teacherId: string;
      departmentId: Department;
      academicYearId: string;
      semester: 1 | 2;
    },
    studentId: string,
    result: PassFailResult | null,
  ) => {
    setSummaries((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? {
              ...s,
              result,
              grade: null,
              classworkScore: null,
              midtermScore: null,
              finalScore: null,
              totalScore: null,
            }
          : s,
      ),
    );

    const stu = summaries.find((s) => s.studentId === studentId);
    if (!stu) return;

    const now = new Date().toISOString();
    const docId = `${params.subjectId}_${params.classId}_${studentId}_${params.academicYearId}_${params.semester}`;
    const ref = doc(db, 'grade_records', docId);
    const record: NewGradeRecord = {
      studentId: stu.studentId,
      studentName: stu.studentName,
      studentCode: stu.studentCode,
      subjectId: params.subjectId,
      subjectName: params.subjectName,
      subjectCode: params.subjectCode,
      classId: params.classId,
      className: params.className,
      teacherId: params.teacherId,
      departmentId: params.departmentId,
      academicYearId: params.academicYearId,
      semester: params.semester,
      classworkScore: null,
      midtermScore: null,
      finalScore: null,
      totalScore: null,
      grade: null,
      result,
      absent: false,
      note: stu.note,
      updatedAt: now,
    };
    await setDoc(ref, record, { merge: true });
    setSavedRecords((prev) => {
      const without = prev.filter((r) => r.studentId !== studentId);
      return [...without, { id: docId, ...record }];
    });
    cacheKey.current = '';
  }, [summaries]);

  const invalidateCache = useCallback(() => {
    cacheKey.current = '';
  }, []);

  return {
    isLoading,
    error,
    config,
    summaries,
    savedRecords,
    loadGradeBook,
    invalidateCache,
    saveConfig,
    recalculate,
    updateStudentScore,
    applyOnlineExamScores,
    revertOnlineExamScores,
    savePassFailResult,
  };
}
