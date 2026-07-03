import { useAuth } from '@/hooks/useAuth';
import { useTeachingManager } from '@/hooks/useTeachingManager';
import AttendanceSheet from '@/features/teaching/components/AttendanceSheet';

const MOCK_TEACHER_ID = 't03';

export default function AttendanceCenterPage() {
  const { user, role } = useAuth();
  const fallbackTeacherId = user?.uid ?? MOCK_TEACHER_ID;
  const canViewAllSubjects = role === 'admin' || role === 'sysadmin';
  const mgr = useTeachingManager(fallbackTeacherId, canViewAllSubjects);

  const mappedTeacherId = mgr.teachers.find((t) => t.userId === user?.uid)?.id;
  const teacherId = mappedTeacherId ?? fallbackTeacherId;

  return (
    <div className="flex h-full flex-col overflow-hidden text-black">
      <div className="flex-1 min-h-0">
        <AttendanceSheet
          teacherId={teacherId}
          academicYearId={mgr.activeYearStr}
          semester={mgr.semester}
          mySubjects={mgr.mySubjects}
          classes={mgr.classes}
          teachers={mgr.teachers}
          getStudentsForClass={mgr.getStudentsForClass}
          getAttendanceForSession={mgr.getAttendanceForSession}
          onSave={mgr.saveAttendanceSession}
          attendance={mgr.attendance}
          leaveRequests={mgr.leaveRequests}
          // Note: In a real app, you'd pass the full attendance list if needed for history/summary
          // but let's assume AttendanceSheet can fetch what it needs or we pass it here
        />
      </div>
    </div>
  );
}
