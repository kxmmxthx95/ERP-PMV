import { useParams, useNavigate } from 'react-router-dom';
import { HiOutlineChevronLeft } from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { CourseOnDemandView } from './CourseOnDemandView';

export default function CoursePlayerPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user, userData, role } = useAuth();

  if (!courseId) {
    navigate('/portal/courses', { replace: true });
    return null;
  }

  const ud = userData as {
    firstName?: string;
    lastName?: string;
    prefix?: string;
    studentCode?: string;
    classId?: string;
  } | null;

  const displayName = ud?.firstName
    ? `${ud.prefix ?? ''}${ud.firstName} ${ud.lastName ?? ''}`.trim()
    : (user?.displayName ?? user?.email ?? 'ผู้ใช้งาน');

  const currentUser = {
    id: user?.uid ?? '',
    name: displayName,
    role: role ?? 'student',
    studentCode: ud?.studentCode,
    classId: ud?.classId,
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate('/portal/courses')}
        className="flex items-center gap-1.5 w-fit text-sm text-black/50 hover:text-black/80 transition-colors"
      >
        <HiOutlineChevronLeft className="size-4" />
        กลับไปรายการคอร์ส
      </button>

      {/* Player — fills remaining height */}
      <div className="flex-1 min-h-[500px]">
        <CourseOnDemandView courseId={courseId} currentUser={currentUser} />
      </div>
    </div>
  );
}
