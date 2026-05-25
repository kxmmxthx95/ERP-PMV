/**
 * useTeacherSyllabus — Teacher-specific Syllabus Hook
 *
 * Wraps useSyllabusManager แต่กรองข้อมูลเฉพาะของครูคนปัจจุบัน:
 * - เห็นเฉพาะ syllabus ของตัวเอง
 * - สร้างได้เฉพาะวิชาที่ตัวเองรับผิดชอบ (teachingSubjectIds)
 * - ส่งตรวจได้ — แต่ "อนุมัติ" ทำได้แค่ admin/sysadmin
 */
import { useState, useMemo } from 'react';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTeacherManager } from '@/features/teachers/hooks/useTeacherManager';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useCurriculum } from '@/hooks/useCurriculum';
import {
  useSyllabus,
  computeTeachingWeeks,
  generateWeeklyPlanSlots,
  inferSemesterDates,
} from '@/hooks/useSyllabus';
import { useSchedule } from '@/hooks/useSchedule';
import { DEFAULT_ASSESSMENT } from '@/types/syllabus';
import type { CourseSyllabus, WeeklyPlan, AssessmentSchema } from '@/types/syllabus';
import type { Subject } from '@/types/curriculum';
import type { SchoolDay } from '@/types/schedule';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface TeacherSubjectCard {
  subject:     Subject;
  syllabus:    CourseSyllabus | null; // null = ยังไม่มี syllabus
  filledWeeks: number;
  totalWeeks:  number;
  fillPct:     number;
  canCreate:   boolean; // true เมื่อยังไม่มี syllabus สำหรับวิชานี้
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTeacherSyllabus(
  /** teacherId ของครูที่ login อยู่ — เชื่อมกับ useAuth() ตอน production */
  currentTeacherId: string,
) {
  const { activeYear, year: academicYear, activeSemester } = useActiveAcademicYear();
  const activeYearStr = academicYear ?? '2568';
  const semester = (activeSemester ?? 1) as 1 | 2;

  // ── Data Sources ──────────────────────────────────────────────────────────────
  const teacherMgr    = useTeacherManager();
  const curriculum    = useCurriculum();
  const calendar      = useAcademicCalendar();
  const syllabusStore = useSyllabus();
  const schedule      = useSchedule();

  // ── ข้อมูลครูคนปัจจุบัน ──────────────────────────────────────────────────────
  const currentTeacher = useMemo(
    () => teacherMgr.teachers.find(t => t.id === currentTeacherId) ?? null,
    [teacherMgr.teachers, currentTeacherId],
  );

  // ── วิชาที่ครูรับผิดชอบ (จาก teachingSubjectIds) ─────────────────────────────
  const mySubjects = useMemo((): Subject[] => {
    if (!currentTeacher) return [];
    return curriculum.subjects.filter(s =>
      currentTeacher.teachingSubjectIds.includes(s.id),
    );
  }, [currentTeacher, curriculum.subjects]);

  // ── Semester Dates ────────────────────────────────────────────────────────────
  const semesterDates = useMemo(() => {
    if (activeYear) return inferSemesterDates(activeYear, semester);
    return { start: '2025-05-12', end: '2025-09-30' };
  }, [activeYear, semester]);

  // ── Teaching Week Info ────────────────────────────────────────────────────────
  const getTeachingWeeksForSubject = (subjectId: string) => {
    const subject = curriculum.subjects.find(s => s.id === subjectId);
    return computeTeachingWeeks(
      semesterDates.start,
      semesterDates.end,
      subject?.hoursPerWeek ?? 3,
      calendar.events,
    );
  };

  // ── Syllabi ของครูคนนี้ ───────────────────────────────────────────────────────
  const mySyllabi = useMemo(() =>
    syllabusStore.syllabi.filter(s =>
      s.teacherId === currentTeacherId &&
      s.academicYear === activeYearStr &&
      s.semester === semester,
    ),
    [syllabusStore.syllabi, currentTeacherId, activeYearStr, semester],
  );

  // ── Subject Cards (จับคู่วิชา + syllabus) ────────────────────────────────────
  const subjectCards = useMemo((): TeacherSubjectCard[] =>
    mySubjects.map(subject => {
      const syllabus = mySyllabi.find(s => s.subjectId === subject.id) ?? null;
      const filledWeeks = syllabus?.weeklyPlan.filter(w => w.topic.trim()).length ?? 0;
      const totalWeeks  = syllabus?.weeklyPlan.length ?? 0;
      return {
        subject,
        syllabus,
        filledWeeks,
        totalWeeks,
        fillPct: totalWeeks > 0 ? Math.round(filledWeeks / totalWeeks * 100) : 0,
        canCreate: syllabus === null,
      };
    }),
    [mySubjects, mySyllabi],
  );

  // ── Selection ─────────────────────────────────────────────────────────────────
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    mySubjects[0]?.id ?? null,
  );

  const selectedCard = useMemo(
    () => subjectCards.find(c => c.subject.id === selectedSubjectId) ?? null,
    [subjectCards, selectedSubjectId],
  );

  const selectedSyllabus = selectedCard?.syllabus ?? null;
  const selectedSubject  = selectedCard?.subject  ?? null;

  // ── Create Syllabus ───────────────────────────────────────────────────────────
  const createSyllabus = async (subject: Subject, gradeLevel: string) => {
    if (!currentTeacher) return;

    const weeklyPlanTemplate = generateWeeklyPlanSlots(
      semesterDates.start,
      semesterDates.end,
      calendar.events,
    );

    const planSlots: WeeklyPlan[] = weeklyPlanTemplate.map(slot => ({
      week:             slot.week,
      topic:            '',
      learningOutcomes: [],
      activities:       [],
      materials:        [],
      isHoliday:        slot.isHoliday,
      isExamWeek:       slot.isExamWeek,
      note:             slot.note,
    }));

    await syllabusStore.createSyllabus({
      subjectId:    subject.id,
      teacherId:    currentTeacherId,
      academicYear: activeYearStr,
      semester,
      gradeLevel,
      subjectCode:  subject.code,
      subjectName:  subject.name,
      credits:      subject.credits,
      hoursPerWeek: subject.hoursPerWeek,
      teacherName:  currentTeacher.name,
      department:   currentTeacher.department,
      description:  '',
      objectives:   [],
      weeklyPlan:   planSlots,
      assessment:   DEFAULT_ASSESSMENT,
      status:       'draft',
    });
  };

  // ── Teaching Days per Subject (from schedule) ─────────────────────────────────
  // ดูว่าครูคนนี้สอนวิชานั้นวันอะไรบ้างในตารางสอน
  const getTeachingDaysForSubject = (subjectId: string): SchoolDay[] => {
    const entries = schedule.getEntriesForTeacher(
      currentTeacherId,
      activeYearStr,
      semester,
    ).filter(e => e.subjectId === subjectId);

    // unique days
    const days = [...new Set(entries.map(e => e.day as SchoolDay))].sort();
    return days;
  };

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     mySyllabi.length,
    draft:     mySyllabi.filter(s => s.status === 'draft').length,
    submitted: mySyllabi.filter(s => s.status === 'submitted').length,
    approved:  mySyllabi.filter(s => s.status === 'approved').length,
    noSyllabus: mySubjects.length - mySyllabi.length, // วิชาที่ยังไม่มีแผน
  }), [mySyllabi, mySubjects]);

  // สรุป completion ภาพรวม
  const completionSummary = useMemo(() => {
    const allWeeks     = mySyllabi.reduce((sum, s) => sum + s.weeklyPlan.length, 0);
    const filledWeeks  = mySyllabi.reduce(
      (sum, s) => sum + s.weeklyPlan.filter(w => w.topic.trim()).length, 0,
    );
    return {
      allWeeks,
      filledWeeks,
      pct: allWeeks > 0 ? Math.round(filledWeeks / allWeeks * 100) : 0,
    };
  }, [mySyllabi]);

  return {
    // Context
    activeYearStr,
    semester,
    semesterDates,
    currentTeacher,

    // My subjects & syllabi
    mySubjects,
    mySyllabi,
    subjectCards,
    stats,
    completionSummary,

    // Selection
    selectedSubjectId,
    setSelectedSubjectId,
    selectedCard,
    selectedSyllabus,
    selectedSubject,

    // Teaching weeks
    getTeachingWeeksForSubject,

    // Schedule-based queries
    getTeachingDaysForSubject,
    calendarEvents: calendar.events,

    // Actions (teacher-scoped)
    createSyllabus,
    updateSyllabus:    async (id: string, data: Partial<CourseSyllabus>) => await syllabusStore.updateSyllabus(id, data),
    updateWeeklyPlan:  async (id: string, week: number, data: Partial<WeeklyPlan>) => await syllabusStore.updateWeeklyPlan(id, week, data),
    updateAssessment:  async (id: string, a: AssessmentSchema) => await syllabusStore.updateAssessment(id, a),
    submitSyllabus:    async (id: string) => await syllabusStore.submitSyllabus(id),
    // deleteSyllabus ไม่เปิดให้ teacher ลบ — ต้องผ่าน admin
  };
}
