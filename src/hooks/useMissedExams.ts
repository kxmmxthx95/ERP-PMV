// src/hooks/useMissedExams.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { fetchMissedExamsForStudent, fetchMissedExamsForTeacher } from '@/lib/exam/fetchMissedExams';

export function useMissedExams() {
  const { user, role } = useAuth();
  const { year, activeSemester, isLoaded } = useActiveAcademicYear();

  return useQuery({
    queryKey: ['missedExams', role, user?.uid, year, activeSemester],
    queryFn: () => {
      if (!user?.uid) return Promise.resolve([]);
      if (role === 'student') return fetchMissedExamsForStudent(user.uid, year, activeSemester as 1 | 2);
      // teacher = scoped to own rooms/exams; admin/sysadmin = school-wide
      const teacherId = role === 'teacher' ? user.uid : undefined;
      return fetchMissedExamsForTeacher(teacherId, year, activeSemester as 1 | 2);
    },
    enabled: isLoaded && !!user?.uid
      && (role === 'student' || role === 'teacher' || role === 'admin' || role === 'sysadmin'),
  });
}
