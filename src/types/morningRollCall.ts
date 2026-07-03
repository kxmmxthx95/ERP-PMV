export type RollCallStatus = 'present' | 'absent' | 'late' | 'leave' | 'unmarked';

export interface StudentRollCall {
  studentId: string;
  studentName: string;
  studentCode: string;
  status: RollCallStatus;
  note?: string;
  photoURL?: string;
  gender?: 'male' | 'female';
}

export interface MorningRollCallSession {
  id: string;
  date: string;
  classId: string;
  className: string;
  departmentId: string;
  academicYearId: string;
  semester: number;
  recordedBy: string;
  recordedByName: string;
  attendance: StudentRollCall[];
  summary: {
    present: number;
    absent: number;
    late: number;
    leave: number;
  };
  presentStudentIds: string[];
  absentStudentIds: string[];
  lateStudentIds: string[];
  leaveStudentIds: string[];
  totalStudents: number;
  createdAt: string;
  updatedAt: string;
}

export interface NewMorningRollCall {
  date: string;
  classId: string;
  className: string;
  departmentId: string;
  academicYearId: string;
  semester: number;
  recordedBy: string;
  recordedByName: string;
  attendance: StudentRollCall[];
}
