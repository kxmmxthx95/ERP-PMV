// src/types/teacherKpi.ts
import type { Department } from '@/types/curriculum';

export interface TeacherSubjectKpi {
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  rate: number | null;       // % เช็คชื่อเฉพาะวิชานี้ (null = ไม่มีคาบที่ควรสอน)
  completedSessions: number;
  expectedSessions: number;
  excluded: boolean;         // true = ครูตั้งค่าไม่นำวิชานี้มารวมคำนวณ
  inSchedule: boolean;       // true = วิชานี้มีคาบอยู่ในตารางสอนจริงแล้ว (false = ได้รับมอบหมายแต่ยังไม่ถูกจัดตาราง)
}

export interface TeacherKpiRow {
  teacherId: string;
  userId: string | null;
  name: string;
  photoURL?: string;
  department: Department;
  position?: string;

  attendanceRate: number | null;   // % เข้างานตลอดเทอม (null = ไม่มีข้อมูล/ไม่มี userId ผูกไว้)
  attendedDays: number;
  workingDays: number;

  rollCallRate: number | null;     // % เช็คชื่อรวม เฉพาะวิชาที่ไม่ถูกยกเว้น (null = ไม่มีคาบสอนในตาราง)
  completedSessions: number;
  expectedSessions: number;

  subjectBreakdown: TeacherSubjectKpi[]; // % เช็คชื่อแยกรายวิชา (รวมวิชาที่ถูกยกเว้นด้วย เพื่อแสดงใน Drawer)
}

export interface TeacherKpiSummary {
  academicYearId: string;
  semester: 1 | 2;
  semesterStartDate: string;   // วันเริ่มเทอมจริง (จากปฏิทิน/แบ่งครึ่งปี)
  semesterEndDate: string;
  effectiveStartDate: string;  // วันที่ใช้คำนวณจริง (= วันตั้งค่า ถ้ามีและอยู่ในช่วงเทอม)
  computedThroughDate: string; // วันสุดท้ายที่นับรวม (วันนี้ หรือ semesterEndDate ถ้าเทอมจบแล้ว)
  rows: TeacherKpiRow[];
}

export interface TeacherKpiSettings {
  academicYearId: string;
  semester: 1 | 2;
  startDate: string; // "YYYY-MM-DD" — วันที่เริ่มเก็บค่า KPI (ว่าง = ใช้วันเริ่มเทอมจริง)
  excludedSubjectsByTeacher?: Record<string, string[]>; // teacherId -> subjectId[] ที่ไม่นำมาคำนวณ % เช็คชื่อ
  updatedAt?: string;
  updatedBy?: string;
}

export const KPI_WARNING_THRESHOLD = 79;
export const KPI_CRITICAL_THRESHOLD = 60;

export function getKpiStatusColor(value: number | null): 'neutral' | 'warning' | 'critical' {
  if (value === null) return 'neutral';
  if (value < KPI_CRITICAL_THRESHOLD) return 'critical';
  if (value < KPI_WARNING_THRESHOLD) return 'warning';
  return 'neutral';
}
