// src/hooks/useTeacherGradeSummary.ts
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { fetchGradeAssessmentMatrix } from '@/lib/academicStats/fetchGradeAssessmentMatrix';
import type { ClassRoom } from '@/types/class';

export interface ClassGpa {
  classId: string;
  className: string;
  avgGpa: number;
  n: number; // จำนวนนักเรียนในห้องที่มีเกรด
}

/** subjectId -> GPA เฉลี่ยของนักเรียนทั้งห้อง แยกรายห้องที่ครูสอนวิชานั้น */
export type TeacherSubjectGpaMap = Record<string, ClassGpa[]>;

/**
 * GPA เฉลี่ยรายวิชาของครู — ใช้ matrix เดียวกับ Dashboard ผู้บริหาร (คิดเกรดเหมือนสมุดคะแนน:
 * grade_records ถ้ามี ไม่งั้นคิดจากคะแนนสอบ) แล้วเลือกเฉพาะห้อง/วิชาที่ครูสอนจาก classes.enrolledCourses
 * ponytail: one-shot + cache 5 นาที (matrix อ่านทั้งโรงเรียน ไม่ทำ realtime) — ถ้าต้อง realtime
 * ต้องแตก logic คิดเกรดเป็นราย class/subject
 */
export function useTeacherGradeSummary(
  teacherIds: string[],
  schedulePairs: { classId: string; subjectId: string }[] = [],
) {
  const { year, activeSemester } = useActiveAcademicYear();
  const semester = (activeSemester === 2 ? 2 : 1) as 1 | 2;
  const idsKey = teacherIds.filter(Boolean).join('|');
  const pairsKey = schedulePairs.map((p) => `${p.classId}__${p.subjectId}`).join('|');

  const { data } = useQuery({
    queryKey: ['teacherSubjectGpa', idsKey, pairsKey, year, semester],
    enabled: !!year && !!idsKey,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<TeacherSubjectGpaMap> => {
      const ids = new Set(idsKey.split('|'));
      const [matrix, classesSnap] = await Promise.all([
        fetchGradeAssessmentMatrix({ academicYearId: String(year), semester }),
        getDocs(query(collection(db, 'classes'), where('academicYearId', '==', String(year)))),
      ]);

      // classId -> subjectId[] ที่ครูคนนี้สอน
      const mine = new Map<string, Set<string>>();
      classesSnap.docs.forEach((d) => {
        const cls = { id: d.id, ...d.data() } as ClassRoom;
        for (const ec of cls.enrolledCourses ?? []) {
          if (!ids.has(String(ec.teacherId ?? '').trim())) continue;
          if (ec.semester && ec.semester !== semester) continue;
          const set = mine.get(cls.id) ?? new Set<string>();
          set.add(ec.subjectId);
          mine.set(cls.id, set);
        }
      });

      // แหล่งสำรอง: คู่ห้อง/วิชาจากตารางสอน (classId อาจเป็น id เอกสารหรือชื่อห้อง เช่น ม.3/1)
      const classes = classesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClassRoom);
      for (const p of schedulePairs) {
        const cls = classes.find((c) => c.id === p.classId || c.className === p.classId);
        if (!cls) continue;
        const set = mine.get(cls.id) ?? new Set<string>();
        set.add(p.subjectId);
        mine.set(cls.id, set);
      }

      const result: TeacherSubjectGpaMap = {};
      for (const row of matrix.classRows) {
        for (const subjectId of mine.get(row.classId) ?? []) {
          const cell = row.bySubject[subjectId];
          if (!cell || cell.n === 0) continue;
          (result[subjectId] ??= []).push({
            classId: row.classId,
            className: row.className,
            avgGpa: cell.avgGpa,
            n: cell.n,
          });
        }
      }
      if (import.meta.env.DEV) {
        console.debug('[teacherSubjectGpa]', { mineClasses: mine.size, resultSubjects: Object.keys(result) });
        // วินิจฉัยจำนวนนักเรียน: rosterRows = รายชื่อห้องหลัง dedupe ในเมทริกซ์, n = คนที่คิดเกรดได้ต่อวิชา
        console.table(
          Object.entries(result).flatMap(([subjectId, rows]) =>
            rows.map((c) => ({
              subjectId,
              className: c.className,
              n: c.n,
              rosterRows: matrix.studentsByClass[c.classId]?.length ?? 0,
              rosterDistinctIds: new Set((matrix.studentsByClass[c.classId] ?? []).map((r) => r.studentId)).size,
              rosterDistinctCodes: new Set((matrix.studentsByClass[c.classId] ?? []).map((r) => r.studentCode).filter(Boolean)).size,
            })),
          ),
        );
      }
      return result;
    },
  });

  return data ?? {};
}
