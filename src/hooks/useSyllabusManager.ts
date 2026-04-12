/**
 * useSyllabusManager — Orchestrator Hook
 *
 * ดึงข้อมูลจาก 4 features มารวมกัน:
 *   1. Curriculum   → รายวิชา, หน่วยกิต, คาบ/สัปดาห์
 *   2. Teacher      → ผู้สอน, กลุ่มสาระ, วิชาที่รับผิดชอบ
 *   3. Calendar     → สัปดาห์สอนจริง (หักวันหยุด/สอบ)
 *   4. Grade/Score  → สัดส่วนคะแนน (classwork/midterm/final)
 */
import { useState, useMemo } from 'react';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useTeacherManager } from '@/hooks/useTeacherManager';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import {
  useSyllabus,
  computeTeachingWeeks,
  generateWeeklyPlanSlots,
  inferSemesterDates,
} from '@/hooks/useSyllabus';
import type { CourseSyllabus, WeeklyPlan } from '@/types/syllabus';
import { DEFAULT_ASSESSMENT } from '@/types/syllabus';
import type { Subject } from '@/types/curriculum';
import type { TeacherProfile } from '@/types/teacher';

// ── Composed View Type ────────────────────────────────────────────────────────
// ใช้ใน UI แทนที่จะต้อง join ข้อมูลใน component

export interface SyllabusListItem {
  syllabus:   CourseSyllabus | null;  // null = ยังไม่มี syllabus สำหรับวิชานี้
  subject:    Subject;
  teacher:    TeacherProfile | null;
  hasContent: boolean;
}

export function useSyllabusManager() {
  const { activeYear, year: academicYear, activeSemester } = useActiveAcademicYear();
  const activeYearStr = academicYear ?? '2568';
  const semester = (activeSemester ?? 1) as 1 | 2;

  // ── Data Sources ──────────────────────────────────────────────────────────────
  const curriculum    = useCurriculum();
  const teacherMgr    = useTeacherManager();
  const calendar      = useAcademicCalendar();
  const syllabusStore = useSyllabus();

  // ── UI State ──────────────────────────────────────────────────────────────────
  const [selectedSyllabusId, setSelectedSyllabusId] = useState<string | null>(
    syllabusStore.syllabi[0]?.id ?? null,
  );
  const [filterDept, setFilterDept]   = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // ── Semester Dates (ดึงจาก AcademicYear หรือ fallback) ────────────────────────
  const semesterDates = useMemo(() => {
    if (activeYear) return inferSemesterDates(activeYear, semester);
    // Fallback สำหรับ dev (ภาคเรียน 1 ปี 2568)
    return { start: '2025-05-12', end: '2025-09-30' };
  }, [activeYear, semester]);

  // ── Teaching Week Info ────────────────────────────────────────────────────────
  // จาก Academic Calendar: ตัดวันหยุด + สัปดาห์สอบออก
  const teachingWeekInfo = useMemo(() =>
    computeTeachingWeeks(
      semesterDates.start,
      semesterDates.end,
      3, // default hours; จะ override ต่อวิชาใน getTeachingWeeksForSubject
      calendar.events,
    ),
    [semesterDates, calendar.events],
  );

  // Per-subject teaching week info (ใช้ hoursPerWeek ของแต่ละวิชา)
  const getTeachingWeeksForSubject = (subjectId: string) => {
    const subject = curriculum.subjects.find(s => s.id === subjectId);
    if (!subject) return teachingWeekInfo;
    return computeTeachingWeeks(
      semesterDates.start,
      semesterDates.end,
      subject.hoursPerWeek,
      calendar.events,
    );
  };

  // ── Pre-generate weekly plan slots ───────────────────────────────────────────
  const weeklyPlanTemplate = useMemo(() =>
    generateWeeklyPlanSlots(semesterDates.start, semesterDates.end, calendar.events),
    [semesterDates, calendar.events],
  );

  // ── Syllabus List (joined) ───────────────────────────────────────────────────
  // จับคู่ syllabus กับ subject + teacher ในปีการศึกษา/ภาคเรียนที่ active
  const syllabusListItems = useMemo((): SyllabusListItem[] => {
    const currentSyllabi = syllabusStore.getSyllabiForYear(activeYearStr, semester);

    // รวม syllabus ที่มีอยู่แล้ว + วิชาที่ยังไม่มี syllabus
    const items: SyllabusListItem[] = currentSyllabi.map(syl => {
      const subject = curriculum.subjects.find(s => s.id === syl.subjectId) ?? null;
      const teacher = teacherMgr.teachers.find(t => t.id === syl.teacherId) ?? null;
      return {
        syllabus: syl,
        subject: subject!,
        teacher,
        hasContent: syl.weeklyPlan.length > 0 || syl.description.trim().length > 0,
      };
    }).filter(item => item.subject != null);

    return items;
  }, [syllabusStore.syllabi, curriculum.subjects, teacherMgr.teachers, activeYearStr, semester]);

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    return syllabusListItems.filter(item => {
      if (filterDept !== 'all' && item.subject?.department !== filterDept) return false;
      if (filterStatus !== 'all') {
        const status = item.syllabus?.status ?? 'draft';
        if (status !== filterStatus) return false;
      }
      return true;
    });
  }, [syllabusListItems, filterDept, filterStatus]);

  // ── Selected Syllabus ─────────────────────────────────────────────────────────
  const selectedSyllabus = useMemo(
    () => syllabusStore.syllabi.find(s => s.id === selectedSyllabusId) ?? null,
    [syllabusStore.syllabi, selectedSyllabusId],
  );

  const selectedSubject = selectedSyllabus
    ? curriculum.subjects.find(s => s.id === selectedSyllabus.subjectId) ?? null
    : null;

  const selectedTeacher = selectedSyllabus
    ? teacherMgr.teachers.find(t => t.id === selectedSyllabus.teacherId) ?? null
    : null;

  // ── Create Syllabus ───────────────────────────────────────────────────────────
  // เมื่อ user เลือก subject + teacher → สร้าง syllabus พร้อม weekly plan template

  const createSyllabusForSubject = (
    subject:  Subject,
    teacher:  TeacherProfile,
    gradeLevel: string,
  ) => {
    // Auto-generate weekly plan จาก calendar
    const planSlots = weeklyPlanTemplate.map(slot => ({
      week:             slot.week,
      topic:            '',
      learningOutcomes: [],
      activities:       [],
      materials:        [],
      isHoliday:        slot.isHoliday,
      isExamWeek:       slot.isExamWeek,
      note:             slot.note,
    } as WeeklyPlan));

    const newSyl = syllabusStore.createSyllabus({
      subjectId:    subject.id,
      teacherId:    teacher.id,
      academicYear: activeYearStr,
      semester,
      gradeLevel,

      // Snapshot
      subjectCode:  subject.code,
      subjectName:  subject.name,
      credits:      subject.credits,
      hoursPerWeek: subject.hoursPerWeek,
      teacherName:  teacher.name,
      department:   teacher.department,

      description:   '',
      objectives:    [],
      weeklyPlan:    planSlots,
      assessment:    DEFAULT_ASSESSMENT,
      status:        'draft',
    });

    setSelectedSyllabusId(newSyl.id);
    return newSyl;
  };

  // ── Eligible teachers for a subject ─────────────────────────────────────────
  // ดึงเฉพาะครูที่มี subjectId ใน teachingSubjectIds (จาก Teacher Management)
  const getEligibleTeachers = (subjectId: string): TeacherProfile[] =>
    teacherMgr.getTeachersForSubject(subjectId);

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     syllabusListItems.length,
    draft:     syllabusListItems.filter(i => i.syllabus?.status === 'draft').length,
    submitted: syllabusListItems.filter(i => i.syllabus?.status === 'submitted').length,
    approved:  syllabusListItems.filter(i => i.syllabus?.status === 'approved').length,
  }), [syllabusListItems]);

  return {
    // Academic context
    activeYearStr,
    semester,
    semesterDates,

    // Teaching weeks (from calendar)
    teachingWeekInfo,
    getTeachingWeeksForSubject,
    weeklyPlanTemplate,

    // Lists
    syllabusListItems,
    filteredItems,
    stats,

    // Filters
    filterDept,
    setFilterDept,
    filterStatus,
    setFilterStatus,

    // Selection
    selectedSyllabusId,
    setSelectedSyllabusId,
    selectedSyllabus,
    selectedSubject,
    selectedTeacher,

    // Actions
    createSyllabusForSubject,
    updateSyllabus: syllabusStore.updateSyllabus,
    deleteSyllabus: syllabusStore.deleteSyllabus,
    updateWeeklyPlan: syllabusStore.updateWeeklyPlan,
    updateAssessment: syllabusStore.updateAssessment,
    submitSyllabus:   syllabusStore.submitSyllabus,
    approveSyllabus:  syllabusStore.approveSyllabus,

    // Queries
    getEligibleTeachers,
    allSubjects:      curriculum.subjects,
    allTeachers:      teacherMgr.teachers,
    calendarEvents:   calendar.events,
  };
}
