import { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sessionCache } from '@/lib/sessionCache';

const CACHE_SYLLABI = 'cache:syllabi';
import type {
  CourseSyllabus, NewSyllabus, WeeklyPlan, TeachingWeekInfo, AssessmentSchema,
} from '@/types/syllabus';
import type { CalendarEvent } from '@/types/calendar';
import type { AcademicYear } from '@/types/settings';

// ── Teaching Week Calculator ──────────────────────────────────────────────────
// หัวใจของ feature: คำนวณสัปดาห์สอนจริงจาก calendar

export function computeTeachingWeeks(
  semesterStart: string,    // YYYY-MM-DD
  semesterEnd:   string,    // YYYY-MM-DD
  hoursPerWeek:  number,
  calendarEvents: CalendarEvent[],
): TeachingWeekInfo {
  const start = new Date(semesterStart);
  const end   = new Date(semesterEnd);

  // ── นับสัปดาห์ทั้งหมดในภาคเรียน ─────────────────────────────────────────────
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  void msPerWeek; // used below in cursor loop

  // ── สร้าง array ของสัปดาห์ (วันจันทร์ต้นสัปดาห์) ─────────────────────────────
  const weeks: { weekStart: string; weekEnd: string }[] = [];
  const cursor = new Date(start);
  // เลื่อนไปวันจันทร์แรก
  const dayOfWeek = cursor.getDay();
  if (dayOfWeek !== 1) {
    cursor.setDate(cursor.getDate() + (dayOfWeek === 0 ? 1 : 8 - dayOfWeek));
  }

  while (cursor <= end) {
    const weekStart = cursor.toISOString().slice(0, 10);
    const weekEndDate = new Date(cursor);
    weekEndDate.setDate(weekEndDate.getDate() + 4); // ศุกร์
    const weekEnd = weekEndDate.toISOString().slice(0, 10);
    weeks.push({ weekStart, weekEnd });
    cursor.setDate(cursor.getDate() + 7);
  }

  // ── จำแนก event type ──────────────────────────────────────────────────────────
  const holidays = calendarEvents.filter(e => e.type === 'holiday');
  const exams    = calendarEvents.filter(e => e.type === 'exam');

  // ── ตรวจว่าสัปดาห์ไหนมีวันหยุด / สอบ ────────────────────────────────────────
  const weekInfoList = weeks.map(w => {
    const isHoliday = holidays.some(h => h.startDate <= w.weekEnd && h.endDate >= w.weekStart);
    const isExam    = exams.some(e => e.startDate <= w.weekEnd && e.endDate >= w.weekStart);
    return { ...w, isHoliday, isExam };
  });

  const holidayWeeks = weekInfoList.filter(w => w.isHoliday && !w.isExam).length;
  const examWeeks    = weekInfoList.filter(w => w.isExam).length;
  const effectiveTeachingWeeks = weeks.length - holidayWeeks - examWeeks;
  const totalHours   = effectiveTeachingWeeks * hoursPerWeek;

  return {
    totalCalendarWeeks: weeks.length,
    holidayWeeks,
    examWeeks,
    effectiveTeachingWeeks,
    totalHours,
    semesterStart,
    semesterEnd,
  };
}

// ── Auto-generate weekly plan slots ──────────────────────────────────────────
// สร้าง template แผนรายสัปดาห์ให้ครูกรอก

export function generateWeeklyPlanSlots(
  semesterStart:  string,
  semesterEnd:    string,
  calendarEvents: CalendarEvent[],
): Omit<WeeklyPlan, 'topic' | 'learningOutcomes' | 'activities'>[] {
  const start = new Date(semesterStart);
  const end   = new Date(semesterEnd);

  const weeks: { week: number; weekStart: string; weekEnd: string }[] = [];
  const cursor = new Date(start);
  const dayOfWeek = cursor.getDay();
  if (dayOfWeek !== 1) {
    cursor.setDate(cursor.getDate() + (dayOfWeek === 0 ? 1 : 8 - dayOfWeek));
  }

  let weekNum = 1;
  while (cursor <= end) {
    const weekStart = cursor.toISOString().slice(0, 10);
    const weekEndDate = new Date(cursor);
    weekEndDate.setDate(weekEndDate.getDate() + 4);
    const weekEnd = weekEndDate.toISOString().slice(0, 10);
    weeks.push({ week: weekNum++, weekStart, weekEnd });
    cursor.setDate(cursor.getDate() + 7);
  }

  const holidays = calendarEvents.filter(e => e.type === 'holiday');
  const exams    = calendarEvents.filter(e => e.type === 'exam');

  return weeks.map(w => {
    const holidayInWeek = holidays.find(h => h.startDate <= w.weekEnd && h.endDate >= w.weekStart);
    const examInWeek    = exams.find(e => e.startDate <= w.weekEnd && e.endDate >= w.weekStart);
    return {
      week: w.week,
      isHoliday: !!holidayInWeek,
      isExamWeek: !!examInWeek,
      note: examInWeek
        ? `สัปดาห์สอบ: ${examInWeek.title}`
        : holidayInWeek
        ? `วันหยุด: ${holidayInWeek.title}`
        : undefined,
    };
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSyllabus() {
  const [syllabi, setSyllabi] = useState<CourseSyllabus[]>(
    () => sessionCache.get<CourseSyllabus[]>(CACHE_SYLLABI) ?? []
  );

  // ── ดึงข้อมูล Real-time จาก Firebase (ข้ามถ้า cache ยังใช้ได้) ──────────────────
  useEffect(() => {
    if (sessionCache.get(CACHE_SYLLABI)) return;
    const unsub = onSnapshot(collection(db, 'syllabi'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as CourseSyllabus));
      setSyllabi(data);
      sessionCache.set(CACHE_SYLLABI, data);
    });
    return () => unsub();
  }, []);

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  const createSyllabus = async (data: NewSyllabus): Promise<CourseSyllabus> => {
    const now = new Date().toISOString().slice(0, 10);
    const newSyllabusData = { ...data, createdAt: now, updatedAt: now };
    const docRef = await addDoc(collection(db, 'syllabi'), newSyllabusData);
    sessionCache.invalidate(CACHE_SYLLABI);
    return { id: docRef.id, ...newSyllabusData } as CourseSyllabus;
  };

  const updateSyllabus = async (id: string, data: Partial<Omit<CourseSyllabus, 'id' | 'createdAt'>>) => {
    await updateDoc(doc(db, 'syllabi', id), {
      ...data,
      updatedAt: new Date().toISOString().slice(0, 10)
    });
    sessionCache.invalidate(CACHE_SYLLABI);
  };

  const deleteSyllabus = async (id: string) => {
    await deleteDoc(doc(db, 'syllabi', id));
    sessionCache.invalidate(CACHE_SYLLABI);
  };

  // ── Weekly Plan CRUD ──────────────────────────────────────────────────────────

  const updateWeeklyPlan = async (syllabusId: string, week: number, data: Partial<WeeklyPlan>) => {
    const syllabus = syllabi.find(s => s.id === syllabusId);
    if (!syllabus) return;
    const updatedPlan = syllabus.weeklyPlan.map(w =>
      w.week === week ? { ...w, ...data } : w,
    );
    await updateDoc(doc(db, 'syllabi', syllabusId), {
      weeklyPlan: updatedPlan,
      updatedAt: new Date().toISOString().slice(0, 10)
    });
    sessionCache.invalidate(CACHE_SYLLABI);
  };

  const updateAssessment = async (syllabusId: string, assessment: AssessmentSchema) => {
    await updateSyllabus(syllabusId, { assessment });
  };

  const submitSyllabus = async (id: string) => await updateSyllabus(id, { status: 'submitted' });
  const approveSyllabus = async (id: string) => await updateSyllabus(id, { status: 'approved' });

  // ── Queries ───────────────────────────────────────────────────────────────────

  const getSyllabiForYear = (academicYear: string, semester: 1 | 2) =>
    syllabi.filter(s => s.academicYear === academicYear && s.semester === semester);

  const getSyllabusBySubjectTeacher = (
    subjectId: string,
    teacherId: string,
    academicYear: string,
    semester: 1 | 2,
  ) => syllabi.find(s =>
    s.subjectId === subjectId &&
    s.teacherId === teacherId &&
    s.academicYear === academicYear &&
    s.semester === semester,
  ) ?? null;

  // สัดส่วนสถานะ
  const statusSummary = useMemo(() => {
    const result = { draft: 0, submitted: 0, approved: 0 };
    for (const s of syllabi) result[s.status]++;
    return result;
  }, [syllabi]);

  return {
    syllabi,
    statusSummary,
    createSyllabus,
    updateSyllabus,
    deleteSyllabus,
    updateWeeklyPlan,
    updateAssessment,
    submitSyllabus,
    approveSyllabus,
    getSyllabiForYear,
    getSyllabusBySubjectTeacher,
  };
}

// ── Utility: infer semester dates from AcademicYear ───────────────────────────
// ตัวช่วยหาวันเริ่ม-สิ้นสุดภาคเรียนเมื่อไม่มีข้อมูลเฉพาะ

export function inferSemesterDates(
  activeYear: AcademicYear,
  semester: 1 | 2,
): { start: string; end: string } {
  const start = new Date(activeYear.startDate);
  const end   = new Date(activeYear.endDate);
  const midMs = (start.getTime() + end.getTime()) / 2;
  const mid   = new Date(midMs);
  const midStr = mid.toISOString().slice(0, 10);

  if (semester === 1) {
    return { start: activeYear.startDate, end: midStr };
  }
  // shift mid by 1 day for semester 2 start
  const sem2Start = new Date(mid);
  sem2Start.setDate(sem2Start.getDate() + 1);
  return { start: sem2Start.toISOString().slice(0, 10), end: activeYear.endDate };
}
