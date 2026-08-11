import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTeachersCollection } from '@/hooks/useTeachersCollection';
import { resolveTeacherFromAuth } from '@/lib/teachers/teacherIdentity';
import {
  getBrowseVisibleDepartments,
  resolveHomeDepartment,
} from '@/lib/departments/homeDepartment';

export function useBrowseVisibleDepartments() {
  const { role, user, userData } = useAuth();
  const { teachers } = useTeachersCollection();

  const currentTeacher = useMemo(
    () => (user?.uid ? resolveTeacherFromAuth(user.uid, teachers) : null),
    [user?.uid, teachers],
  );

  const homeDepartment = useMemo(
    () => resolveHomeDepartment(role, { teacher: currentTeacher, userData }),
    [role, currentTeacher, userData],
  );

  const browseVisibleDepartments = useMemo(
    () => getBrowseVisibleDepartments(role, homeDepartment),
    [role, homeDepartment],
  );

  const isDeptScoped = browseVisibleDepartments !== undefined;

  return {
    role,
    homeDepartment,
    browseVisibleDepartments,
    isDeptScoped,
  };
}
