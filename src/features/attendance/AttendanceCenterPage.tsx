import { useAuth } from '@/hooks/useAuth';
import { useTeachingManager } from '@/hooks/useTeachingManager';
import AttendanceSheet from '@/features/teaching/components/AttendanceSheet';

const MOCK_TEACHER_ID = 't03';

export default function AttendanceCenterPage() {
  const { user } = useAuth();
  const teacherId = user?.uid ?? MOCK_TEACHER_ID;
  const mgr = useTeachingManager(teacherId);

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
