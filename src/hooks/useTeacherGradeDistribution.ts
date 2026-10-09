// src/hooks/useTeacherGradeDistribution.ts
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { fetchGradeAssessmentMatrix } from '@/lib/academicStats/fetchGradeAssessmentMatrix';
import type { ClassRoom } from '@/types/class';

export const GRADE_COLUMNS = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'] as const;

export interface ClassGradeDistribution {
  classId: string;
  className: string;
  total: number;    // จำนวนนักเรียนในห้อง (รายชื่อห้องของเมทริกซ์)
  graded: number;   // จำนวนที่มีเกรด A–F
  counts: Record<string, number>; // letter -> จำนวนคน
}

/** subjectId -> รายห้องที่ครูสอนวิชานั้น */
export type TeacherGradeDistribution = Record<string, ClassGradeDistribution[]>;

/**
 * จำนวนนักเรียนตามเกรด แยกรายวิชา/ห้อง — ใช้เมทริกซ์เดียวกับ Dashboard ผู้บริหาร (คิดเกรดเหมือนสมุดคะแนน)
 * แล้วเลือกเฉพาะห้อง/วิชาที่ครูสอน (classes.enrolledCourses + ตารางสอนเป็นแหล่งสำรอง)
 * ponytail: one-shot + cache 5 นาที (matrix อ่านทั้งโรงเรียน ไม่ทำ realtime); ร/มส/0 แยกจาก "ยังไม่มีเกรด" ไม่ได้
 * เพราะเมทริกซ์เก็บเฉพาะเกรด A–F
 */
export function useTeacherGradeDistribution(
  teacherIds: string[],
  schedulePairs: { classId: string; subjectId: string }[],
  enabled: boolean,
) {
  const { year, activeSemester } = useActiveAcademicYear();
  const semester = (activeSemester === 2 ? 2 : 1) as 1 | 2;
  const idsKey = teacherIds.filter(Boolean).join('|');
  const pairsKey = schedulePairs.map((p) => `${p.classId}__${p.subjectId}`).join('|');

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['teacherGradeDistribution', idsKey, pairsKey, year, semester],
    enabled: enabled && !!year && !!idsKey,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<TeacherGradeDistribution> => {
      const ids = new Set(idsKey.split('|'));
      const [matrix, classesSnap] = await Promise.all([
        fetchGradeAssessmentMatrix({ academicYearId: String(year), semester }),
        getDocs(query(collection(db, 'classes'), where('academicYearId', '==', String(year)))),
      ]);
      const classes = classesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClassRoom);

      // classId -> subjectId[] ที่ครูคนนี้สอน
      const mine = new Map<string, Set<string>>();
      const add = (classId: string, subjectId: string) => {
        const set = mine.get(classId) ?? new Set<string>();
        set.add(subjectId);
        mine.set(classId, set);
      };
      for (const cls of classes) {
        for (const ec of cls.enrolledCourses ?? []) {
          if (!ids.has(String(ec.teacherId ?? '').trim())) continue;
          if (ec.semester && ec.semester !== semester) continue;
          add(cls.id, ec.subjectId);
        }
      }
      for (const p of schedulePairs) {
        const cls = classes.find((c) => c.id === p.classId || c.className === p.classId);
        if (cls) add(cls.id, p.subjectId);
      }

      // รายชื่อห้องที่ถูกต้อง = ใบลงทะเบียนของปีที่สถานะ 'studying' (กติกาเดียวกับจำนวนนักเรียนในหน้าห้องเรียน)
      // เมทริกซ์รวมทุกแหล่ง (รวมคนย้าย/จบ/ข้อมูลเก่า) จึงนับเกินได้ — กรองให้เหลือเฉพาะคนที่ยังเรียนอยู่ในห้อง
      const studying = new Map<string, Set<string>>();
      const mineIds = [...mine.keys()];
      for (let i = 0; i < mineIds.length; i += 30) {
        const snap = await getDocs(query(
          collection(db, 'enrollments'),
          where('academicYearId', '==', String(year)),
          where('classId', 'in', mineIds.slice(i, i + 30)),
        ));
        snap.docs.forEach((d) => {
          const e = d.data() as { classId?: string; studentId?: string; status?: string };
          if ((e.status ?? 'studying') !== 'studying' || !e.classId || !e.studentId) return;
          const set = studying.get(e.classId) ?? new Set<string>();
          set.add(String(e.studentId));
          studying.set(e.classId, set);
        });
      }

      const result: TeacherGradeDistribution = {};
      for (const [classId, subjectIds] of mine) {
        const allRows = matrix.studentsByClass[classId] ?? [];
        const roster = studying.get(classId);
        // ไม่มีใบลงทะเบียนเลย (ข้อมูลเก่า) → ใช้รายชื่อจากเมทริกซ์เหมือนเดิม
        const rows = roster && roster.size > 0 ? allRows.filter((r) => roster.has(r.studentId)) : allRows;
        const total = roster && roster.size > 0 ? roster.size : allRows.length;
        const className = matrix.classRows.find((r) => r.classId === classId)?.className
          ?? classes.find((c) => c.id === classId)?.className ?? classId;
        for (const subjectId of subjectIds) {
          const counts: Record<string, number> = {};
          let graded = 0;
          for (const r of rows) {
            const g = r.bySubject[subjectId]?.grade;
            if (!g) continue;
            counts[g] = (counts[g] ?? 0) + 1;
            graded += 1;
          }
          (result[subjectId] ??= []).push({ classId, className, total, graded, counts });
        }
      }

      if (import.meta.env.DEV) {
        // วินิจฉัยจำนวนนักเรียน: total ต้องเท่าจำนวนคนจริงในห้อง
        console.table(
          Object.entries(result).flatMap(([subjectId, list]) =>
            list.map((c) => ({
              subjectId,
              className: c.className,
              total: c.total,
              graded: c.graded,
              matrixRows: (matrix.studentsByClass[c.classId] ?? []).length,
              distinctIds: new Set((matrix.studentsByClass[c.classId] ?? []).map((r) => r.studentId)).size,
              distinctCodes: new Set((matrix.studentsByClass[c.classId] ?? []).map((r) => r.studentCode).filter(Boolean)).size,
            })),
          ),
        );
      }
      return result;
    },
  });

  return { data: data ?? {}, loading: enabled && isFetching && !data, refreshing: isFetching, reload: () => void refetch() };
}
