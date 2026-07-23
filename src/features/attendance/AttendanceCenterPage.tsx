import { useAuth } from '@/hooks/useAuth';
import { useTeachingManager } from '@/hooks/useTeachingManager';
import AttendanceSheet from '@/features/teaching/components/AttendanceSheet';
import { resolveTeacherFromAuth } from '@/lib/teachers/teacherIdentity';
import { cn } from '@/lib/utils';

const MOCK_TEACHER_ID = 't03';

/** Same shell as StudentManager / QuestionBankManager */
const PAGE_SHELL = cn(
  'flex min-h-0 w-full flex-1 flex-col overflow-hidden font-sukhumvit',
  'h-[calc(100dvh-4.25rem)] max-h-[calc(100dvh-4.25rem)]',
);

export default function AttendanceCenterPage() {
  const { user, role } = useAuth();
  const fallbackTeacherId = user?.uid ?? MOCK_TEACHER_ID;
  const canViewAllSubjects = role === 'admin' || role === 'sysadmin';
  const mgr = useTeachingManager(fallbackTeacherId, canViewAllSubjects);

  const teacherProfile = resolveTeacherFromAuth(user?.uid ?? '', mgr.teachers);
  const teacherId = teacherProfile?.id ?? mgr.teachers.find((t) => t.userId === user?.uid)?.id ?? fallbackTeacherId;

  return (
    <div className={cn(PAGE_SHELL, 'text-black')}>
      <AttendanceSheet
        teacherId={teacherId}
        academicYearId={mgr.activeYearStr}
        semester={mgr.semester}
        mySubjects={mgr.mySubjects}
        classes={mgr.yearClasses}
        teachers={mgr.teachers}
        getStudentsForClass={mgr.getStudentsForClass}
        getAttendanceForSession={mgr.getAttendanceForSession}
        onSave={mgr.saveAttendanceSession}
        attendance={mgr.attendance}
        leaveRequests={mgr.leaveRequests}
        isRosterDataLoaded={mgr.isRosterDataLoaded}
      />
    </div>
  );
}
