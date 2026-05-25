import AttendanceSheet from '@/features/teaching/components/AttendanceSheet';
import type { Subject } from '@/types/curriculum';
import type { ClassRoom } from '@/types/class';
import type { AttendanceRecord, NewAttendanceRecord } from '@/types/teaching';
import type { TeacherProfile } from '@/types/teacher';

interface Props {
  teacherId: string;
  academicYearId: string;
  semester: 1 | 2;
  mySubjects: Subject[];
  classes: ClassRoom[];
  teachers?: TeacherProfile[];
  getStudentsForClass: (classId: string) => { student: { id: string; studentCode: string; prefix: string; firstName: string; lastName: string } }[];
  getAttendanceForSession: (subjectId: string, classId: string, date: string, period: number) => AttendanceRecord[];
  onSave: (records: NewAttendanceRecord[]) => Promise<void>;
  leaveRequests?: any[]; // Using any for simplicity or import LeaveRequest
}

export default function TodayTab(props: Props) {
  return <AttendanceSheet {...props} />;
}
