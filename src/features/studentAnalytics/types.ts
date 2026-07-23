export type RiskLevel = 'high' | 'medium' | 'low' | 'none';

export interface StudentAnalyticsRow {
  studentId: string;
  studentCode: string;
  fullName: string;
  photoURL?: string;
  classId: string;
  className: string;
  gpa: number | null;             // 0–4 scale, average over graded subjects
  failingSubjects: number;        // count of subjects graded 'F'
  gradedSubjects: number;
  attendanceRate: number | null;  // class-session attendance, 0–100
  rollCallRate: number | null;    // morning roll-call attendance, 0–100
  riskLevel: RiskLevel;
  riskReasons: string[];
}
