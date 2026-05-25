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
  collection, getDocs, setDoc, doc, query, where, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  GradeWeightConfig, GradeRecord, StudentScoreSummary, GradeLetter,
  GradeThreshold, NewGradeRecord,
} from '@/types/grades';
import {
  DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, DEFAULT_MAX_SCORES,
} from '@/types/grades';
import type { Exam, ExamScore } from '@/types/teaching';
import type { Department } from '@/types/curriculum';

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
    }>;
  }) => {
    const key = makeConfigKey(params.subjectId, params.classId, params.academicYearId, params.semester);
    if (cacheKey.current === key) return; // ไม่อ่านซ้ำ

    setIsLoading(true);
    setError(null);

    try {
      // ── 1. อ่าน GradeWeightConfig (1 doc read) ────────────────────────────────
      let cfg: GradeWeightConfig;
      const cfgRef = doc(db, 'grade_configs', key);
      const cfgSnap = await getDocs(
        query(collection(db, 'grade_configs'), where('__name__', '==', key))
      ).catch(() => null);

      const existingCfg = cfgSnap?.docs[0];
      if (existingCfg?.exists()) {
        cfg = { id: existingCfg.id, ...existingCfg.data() } as GradeWeightConfig;
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
        for (let i = 0; i < examIds.length; i += chunkSize) {
          const chunk = examIds.slice(i, i + chunkSize);
          const scoresSnap = await getDocs(
            query(collection(db, 'exam_scores'), where('examId', 'in', chunk))
          ).catch(() => null);
          if (scoresSnap) {
            scoresSnap.docs.forEach(d => allScores.push({ id: d.id, ...d.data() } as ExamScore));
          }
        }
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
        const saved = recordMap.get(stu.studentId);

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
            const sc = scoresByExamId.get(exam.id)?.get(stu.studentId);
            if (sc && !sc.absent && sc.score !== undefined) return sc.score;
          }
          return null;
        };

        // classwork = รวมคะแนน quiz ทั้งหมด (ไม่ normalize)
        const classworkExams = [...(examByType.get('quiz') ?? []), ...(examByType.get('makeup') ?? [])];
        let classworkRaw: number | null = null;
        if (classworkExams.length > 0) {
          let total = 0;
          let hasAny = false;
          classworkExams.forEach(exam => {
            const sc = scoresByExamId.get(exam.id)?.get(stu.studentId);
            if (sc && !sc.absent && sc.score !== undefined) {
              total += sc.score;
              hasAny = true;
            }
          });
          if (hasAny) classworkRaw = total;
        }

        const midtermRaw = getLatestScore('midterm');
        const finalRaw = getLatestScore('final');

        // คำนวณ weighted total
        let totalScore: number | null = null;
        const { weights, maxScores } = cfg;

        const wCw = weights.classwork / 100;
        const wMid = weights.midterm / 100;
        const wFin = weights.final / 100;

        const cwPct = classworkRaw !== null ? (classworkRaw / (maxScores.classwork || 100)) * 100 : null;
        const midPct = midtermRaw !== null ? (midtermRaw / (maxScores.midterm || 100)) * 100 : null;
        const finPct = finalRaw !== null ? (finalRaw / (maxScores.final || 100)) * 100 : null;

        // คำนวณเฉพาะถ้ามีข้อมูลครบตามที่กำหนด
        if (cwPct !== null && midPct !== null && finPct !== null) {
          totalScore = Math.round((cwPct * wCw + midPct * wMid + finPct * wFin) * 10) / 10;
        } else if (midPct !== null && finPct !== null && weights.classwork === 0) {
          totalScore = Math.round((midPct * wMid + finPct * wFin) * 10) / 10;
        }

        const grade: GradeLetter | null = totalScore !== null
          ? calcGrade(totalScore, cfg.thresholds)
          : null;

        return {
          studentId: stu.studentId,
          studentName: stu.studentName,
          studentCode: stu.studentCode,
          photoURL: stu.photoURL,
          gender: stu.gender,
          classworkScore: classworkRaw,
          midtermScore: midtermRaw,
          finalScore: finalRaw,
          totalScore,
          grade,
          absent: false,
        };
      });

      setSummaries(built);
      cacheKey.current = key;

      // ── Eagerly create cfgRef ถ้ายังไม่มี (ไม่รอ) ───────────────────────────
      if (!existingCfg?.exists()) {
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

      const { weights, maxScores, thresholds } = newConfig;
      const cwPct = s.classworkScore !== null ? (s.classworkScore / (maxScores.classwork || 100)) * 100 : null;
      const midPct = s.midtermScore !== null ? (s.midtermScore / (maxScores.midterm || 100)) * 100 : null;
      const finPct = s.finalScore !== null ? (s.finalScore / (maxScores.final || 100)) * 100 : null;

      const wCw = weights.classwork / 100;
      const wMid = weights.midterm / 100;
      const wFin = weights.final / 100;

      let totalScore: number | null = null;
      if (cwPct !== null && midPct !== null && finPct !== null) {
        totalScore = Math.round((cwPct * wCw + midPct * wMid + finPct * wFin) * 10) / 10;
      } else if (midPct !== null && finPct !== null && weights.classwork === 0) {
        totalScore = Math.round((midPct * wMid + finPct * wFin) * 10) / 10;
      }

      return {
        ...s,
        totalScore,
        grade: totalScore !== null ? calcGrade(totalScore, thresholds) : null,
      };
    }));
  }, []);

  // ── Manual override: ครูแก้คะแนนเองในตาราง ────────────────────────────────────

  const updateStudentScore = useCallback((studentId: string, field: 'classworkScore' | 'midtermScore' | 'finalScore' | 'note' | 'absent', value: number | string | boolean | null) => {
    setSummaries(prev => prev.map(s => {
      if (s.studentId !== studentId) return s;
      const updated = { ...s, [field]: value };

      // recalculate total ถ้าเป็น score field
      if (field !== 'note' && field !== 'absent' && config) {
        const { weights, maxScores, thresholds } = config;
        const cwPct = updated.classworkScore !== null ? (updated.classworkScore / (maxScores.classwork || 100)) * 100 : null;
        const midPct = updated.midtermScore !== null ? (updated.midtermScore / (maxScores.midterm || 100)) * 100 : null;
        const finPct = updated.finalScore !== null ? (updated.finalScore / (maxScores.final || 100)) * 100 : null;

        const wCw = weights.classwork / 100;
        const wMid = weights.midterm / 100;
        const wFin = weights.final / 100;

        let totalScore: number | null = null;
        if (cwPct !== null && midPct !== null && finPct !== null) {
          totalScore = Math.round((cwPct * wCw + midPct * wMid + finPct * wFin) * 10) / 10;
        } else if (midPct !== null && finPct !== null && weights.classwork === 0) {
          totalScore = Math.round((midPct * wMid + finPct * wFin) * 10) / 10;
        }

        updated.totalScore = totalScore;
        updated.grade = totalScore !== null ? calcGrade(totalScore, thresholds) : null;
      }

      return updated;
    }));
  }, [config]);

  // ── บันทึก grade_records ทั้งหมดใน batch (ประหยัด quota) ─────────────────────

  const publishGrades = useCallback(async (params: {
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    classId: string;
    className: string;
    teacherId: string;
    departmentId: Department;
    academicYearId: string;
    semester: 1 | 2;
  }) => {
    if (summaries.length === 0) return;

    const batch = writeBatch(db);
    const now = new Date().toISOString();

    summaries.forEach(s => {
      const docId = `${params.subjectId}_${params.classId}_${s.studentId}_${params.academicYearId}_${params.semester}`;
      const ref = doc(db, 'grade_records', docId);
      const record: NewGradeRecord = {
        studentId: s.studentId,
        studentName: s.studentName,
        studentCode: s.studentCode,
        subjectId: params.subjectId,
        subjectName: params.subjectName,
        subjectCode: params.subjectCode,
        classId: params.classId,
        className: params.className,
        teacherId: params.teacherId,
        departmentId: params.departmentId,
        academicYearId: params.academicYearId,
        semester: params.semester,
        classworkScore: s.classworkScore,
        midtermScore: s.midtermScore,
        finalScore: s.finalScore,
        totalScore: s.totalScore,
        grade: s.grade,
        absent: s.absent,
        note: s.note,
        publishedAt: now,
        updatedAt: now,
      };
      batch.set(ref, record, { merge: true });
    });

    await batch.commit();
    cacheKey.current = ''; // invalidate cache
  }, [summaries]);

  return {
    isLoading,
    error,
    config,
    summaries,
    savedRecords,
    loadGradeBook,
    saveConfig,
    recalculate,
    updateStudentScore,
    publishGrades,
  };
}
