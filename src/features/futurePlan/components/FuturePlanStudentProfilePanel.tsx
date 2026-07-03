import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { resolveStudentByAuthUser } from '@/lib/resolveStudentProfile';
import { getInitials } from '@/features/profile/profileLayoutShared';
import StudentAvatar from '@/features/students/components/StudentAvatar';
import { glassStyles } from '@/lib/designTokens';
import { fp } from '@/features/futurePlan/futurePlanTheme';
import { cn } from '@/lib/utils';
import type { Student } from '@/types/student';
import type { Enrollment } from '@/types/student';

function pickCurrentEnrollment(
  enrollments: Enrollment[],
  activeYear: string | null,
  activeSemester: number | null,
): Enrollment | null {
  if (!activeYear || !activeSemester) return null;

  return (
    enrollments
      .filter((item) => item.classId)
      .sort((a, b) => {
        const yearA = Number(a.academicYearId ?? 0);
        const yearB = Number(b.academicYearId ?? 0);
        if (yearA !== yearB) return yearB - yearA;

        const semA = Number(a.semester ?? 0);
        const semB = Number(b.semester ?? 0);
        if (semA !== semB) return semB - semA;

        return (b.enrolledAt ?? '').localeCompare(a.enrolledAt ?? '');
      })
      .find(
        (item) =>
          String(item.academicYearId) === String(activeYear)
          && Number(item.semester ?? 0) === Number(activeSemester),
      ) ?? null
  );
}

export function FuturePlanStudentProfilePanel({
  variant = 'card',
  lastUpdatedLabel,
}: {
  variant?: 'card' | 'profile';
  lastUpdatedLabel?: string;
}) {
  const { user, userData } = useAuth();
  const { year: activeYearId, activeSemester } = useActiveAcademicYear();
  const [student, setStudent] = useState<Student | null>(null);
  const [gradeLevel, setGradeLevel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function loadProfile() {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const resolved = await resolveStudentByAuthUser(user.uid, {
          studentCode: typeof userData?.studentCode === 'string' ? userData.studentCode : undefined,
          email: user.email ?? undefined,
        });

        if (!resolved) {
          if (!isCancelled) {
            setStudent(null);
            setGradeLevel(null);
          }
          return;
        }

        const enrollmentQuery = query(
          collection(db, 'enrollments'),
          where('studentId', '==', resolved.id),
        );
        const enrollmentSnap = await getDocs(enrollmentQuery);
        const enrollments = enrollmentSnap.docs.map(
          (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Enrollment,
        );
        const currentEnrollment = pickCurrentEnrollment(
          enrollments,
          activeYearId,
          activeSemester,
        );

        if (!isCancelled) {
          setStudent(resolved);
          setGradeLevel(currentEnrollment?.gradeLevel ?? null);
        }
      } catch {
        if (!isCancelled) {
          setStudent(null);
          setGradeLevel(null);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      isCancelled = true;
    };
  }, [user?.uid, user?.email, userData?.studentCode, activeYearId, activeSemester]);

  const displayName = student
    ? `${student.prefix ?? ''}${student.firstName} ${student.lastName}`.trim()
    : (typeof userData?.displayName === 'string' ? userData.displayName : '–');

  const studentCode =
    student?.studentCode
    ?? (typeof userData?.studentCode === 'string' ? userData.studentCode : '–');

  if (variant === 'profile') {
    return (
      <header className="flex flex-col items-center pt-2 pb-1 text-center">
        {loading ? (
          <div className="flex flex-col items-center gap-3 animate-pulse">
            <div className="h-24 w-24 rounded-full bg-slate-100" />
            <div className="h-6 w-40 rounded-lg bg-slate-100" />
            <div className="h-4 w-28 rounded-lg bg-slate-100" />
          </div>
        ) : student?.photoURL ? (
          <>
            <img
              src={student.photoURL}
              alt={displayName}
              className="h-24 w-24 rounded-full object-cover ring-4 ring-slate-100"
            />
            <h1 className="mt-4 max-w-full break-words text-2xl font-black text-slate-900">
              {displayName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-bold text-blue-600">รหัส {studentCode}</span>
              {gradeLevel ? (
                <span className="text-xs font-semibold text-slate-500">ระดับชั้น {gradeLevel}</span>
              ) : null}
              {lastUpdatedLabel ? (
                <span className="rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-[11px] font-black text-violet-600">
                  {lastUpdatedLabel}
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 text-2xl font-black text-slate-500 ring-4 ring-slate-50">
              {getInitials(displayName)}
            </div>
            <h1 className="mt-4 max-w-full break-words text-2xl font-black text-slate-900">
              {displayName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-bold text-blue-600">รหัส {studentCode}</span>
              {gradeLevel ? (
                <span className="text-xs font-semibold text-slate-500">ระดับชั้น {gradeLevel}</span>
              ) : null}
              {lastUpdatedLabel ? (
                <span className="rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-[11px] font-black text-violet-600">
                  {lastUpdatedLabel}
                </span>
              ) : null}
            </div>
          </>
        )}
      </header>
    );
  }

  return (
    <div className="rounded-3xl p-5 sm:p-6" style={glassStyles.card}>
      {loading ? (
        <div className="flex items-center gap-4 animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-black/5 shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="h-4 w-40 rounded-lg bg-black/5" />
            <div className="h-3 w-28 rounded-lg bg-black/5" />
            <div className="h-3 w-24 rounded-lg bg-black/5" />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <StudentAvatar
            photoURL={student?.photoURL}
            studentId={student?.id ?? user?.uid ?? 'student'}
            name={displayName}
            gender={student?.gender}
            className="w-16 h-16 rounded-2xl border-2 border-white shadow-md shrink-0"
          />
          <div className="flex-1 min-w-0 space-y-1">
            <p className={cn(fp.heading, 'text-base truncate')}>{displayName}</p>
            <p className="text-sm text-black/70">
              <span className={fp.labelDark}>รหัสนักเรียน</span>
              {' '}
              <span className="font-semibold text-[#0056FF]">{studentCode}</span>
            </p>
            <p className="text-sm text-black/70">
              <span className={fp.labelDark}>ระดับชั้น</span>
              {' '}
              <span className="font-semibold text-[#0056FF]">{gradeLevel ?? '–'}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
