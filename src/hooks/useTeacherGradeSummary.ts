// src/hooks/useTeacherGradeSummary.ts
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { gradeLetterToGpa, type GradeLetter, type GradeRecord } from '@/types/grades';

/** ตัวอักษรที่นับเข้า GPA — ไม่รวม ร / มส / 0 */
const GPA_LETTERS: GradeLetter[] = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'];

export interface TeacherClassGrade {
  key: string; // classId__subjectId
  className: string;
  subjectName: string;
  subjectCode: string;
  studentCount: number;
  gradedCount: number;       // นักเรียนที่มีเกรดแล้ว
  avgGpa: number | null;
  distribution: Record<string, number>; // letter -> count (เฉพาะ GPA_LETTERS)
}

export interface TeacherGradeSummary {
  classes: TeacherClassGrade[];
  overallAvgGpa: number | null;
  studentCount: number;
  gradedCount: number;
}

export const GRADE_DISTRIBUTION_LETTERS = GPA_LETTERS;

function summarize(records: GradeRecord[]): TeacherGradeSummary {
  const groups = new Map<string, GradeRecord[]>();
  for (const r of records) {
    const key = `${r.classId}__${r.subjectId}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  let gpaSum = 0;
  let gpaN = 0;
  const classes: TeacherClassGrade[] = Array.from(groups.entries()).map(([key, rows]) => {
    const distribution: Record<string, number> = {};
    let sum = 0;
    let n = 0;
    for (const r of rows) {
      if (r.grade && GPA_LETTERS.includes(r.grade)) {
        distribution[r.grade] = (distribution[r.grade] ?? 0) + 1;
        sum += gradeLetterToGpa(r.grade);
        n += 1;
      }
    }
    gpaSum += sum;
    gpaN += n;
    return {
      key,
      className: rows[0].className,
      subjectName: rows[0].subjectName,
      subjectCode: rows[0].subjectCode,
      studentCount: rows.length,
      gradedCount: rows.filter((r) => r.grade).length,
      avgGpa: n > 0 ? sum / n : null,
      distribution,
    };
  }).sort((a, b) => a.className.localeCompare(b.className, 'th') || a.subjectName.localeCompare(b.subjectName, 'th'));

  return {
    classes,
    overallAvgGpa: gpaN > 0 ? gpaSum / gpaN : null,
    studentCount: classes.reduce((s, c) => s + c.studentCount, 0),
    gradedCount: classes.reduce((s, c) => s + c.gradedCount, 0),
  };
}

/**
 * สรุปเกรดจาก grade_records ที่ครูบันทึกแล้ว (1 query)
 * ponytail: นับเฉพาะ record ที่บันทึกในสมุดคะแนน — ห้องที่ยังไม่เคยกดบันทึกจะไม่ปรากฏ
 */
export function useTeacherGradeSummary(teacherId: string | undefined) {
  const { year, activeSemester } = useActiveAcademicYear();
  const semester = activeSemester === 2 ? 2 : 1;

  return useQuery({
    queryKey: ['teacherGradeSummary', teacherId, year, semester],
    enabled: !!teacherId && !!year,
    queryFn: async () => {
      const snap = await getDocs(
        query(
          collection(db, 'grade_records'),
          where('academicYearId', '==', year),
          where('semester', '==', semester),
          where('teacherId', '==', teacherId),
        ),
      );
      return summarize(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GradeRecord)));
    },
  });
}
