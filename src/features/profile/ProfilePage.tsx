import { useAuth } from '@/hooks/useAuth';
import StudentProfilePage from '@/features/students/StudentProfilePage';
import NonStudentProfilePage from './NonStudentProfilePage';

export default function ProfilePage() {
  const { role } = useAuth();

  if (role === 'student') {
    return <StudentProfilePage />;
  }

  return <NonStudentProfilePage />;
}

