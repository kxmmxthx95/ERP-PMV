import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { HiOutlineXMark } from 'react-icons/hi2';
import { db } from '@/lib/firebase';
import { fetchStudentsByIds } from '@/lib/firestoreShared/fetchStudentsByIds';
import { useClassroomManager } from '@/features/classes/hooks/useClassroomManager';
import { cn } from '@/lib/utils';
import type { TeachingReflectionStudent } from '@/types/microSyllabus';

type ClassStudentOption = TeachingReflectionStudent;

interface ProblemStudentPickerProps {
  classId?: string;
  enabled?: boolean;
  value: TeachingReflectionStudent[];
  onChange: (students: TeachingReflectionStudent[]) => void;
  label?: string;
}

export function ProblemStudentPicker({
  classId,
  enabled = true,
  value,
  onChange,
  label = 'นักเรียนที่ไม่ตั้งใจเรียน (ถ้ามี)',
}: ProblemStudentPickerProps) {
  const { allClasses } = useClassroomManager();
  const [studentQuery, setStudentQuery] = useState('');
  const [classStudents, setClassStudents] = useState<ClassStudentOption[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [expanded, setExpanded] = useState(() => value.length > 0);

  useEffect(() => {
    if (!enabled) {
      setStudentQuery('');
      setExpanded(false);
      return;
    }
    setStudentQuery('');
    setExpanded(value.length > 0);
  }, [enabled, classId]);

  useEffect(() => {
    if (value.length > 0) setExpanded(true);
  }, [value.length]);

  useEffect(() => {
    if (!enabled || !classId || !expanded) {
      if (!expanded) setClassStudents([]);
      return;
    }

    let cancelled = false;

    async function loadStudents() {
      setLoadingStudents(true);
      try {
        const classDoc = allClasses.find((item) => item.id === classId) as
          | (typeof allClasses)[number] & { studentIds?: string[] }
          | undefined;
        const classStudentIds = (classDoc?.studentIds || []).filter(
          (id): id is string => typeof id === 'string' && id.trim() !== '',
        );

        let studentRows: ClassStudentOption[] = [];

        if (classStudentIds.length > 0) {
          const students = await fetchStudentsByIds<{
            id: string;
            studentCode?: string;
            prefix?: string;
            firstName?: string;
            lastName?: string;
          }>(classStudentIds);
          studentRows = students.map((student) => ({
            id: student.id,
            code: student.studentCode,
            name: `${student.prefix ?? ''}${student.firstName ?? ''} ${student.lastName ?? ''}`.trim(),
          }));
        } else {
          const enrollSnap = await getDocs(
            query(collection(db, 'enrollments'), where('classId', '==', classId)),
          );
          const enrollmentStudentIds = enrollSnap.docs
            .map((snap) => snap.data().studentId as string | undefined)
            .filter((id): id is string => typeof id === 'string' && id.trim() !== '');

          if (enrollmentStudentIds.length > 0) {
            const students = await fetchStudentsByIds<{
              id: string;
              studentCode?: string;
              prefix?: string;
              firstName?: string;
              lastName?: string;
            }>(enrollmentStudentIds);
            studentRows = students.map((student) => ({
              id: student.id,
              code: student.studentCode,
              name: `${student.prefix ?? ''}${student.firstName ?? ''} ${student.lastName ?? ''}`.trim(),
            }));
          }
        }

        if (!cancelled) {
          setClassStudents(
            studentRows.sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name, 'th')),
          );
        }
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    }

    void loadStudents();

    return () => {
      cancelled = true;
    };
  }, [enabled, classId, allClasses, expanded]);

  const selectedIds = useMemo(() => new Set(value.map((student) => student.id)), [value]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return classStudents;
    return classStudents.filter((student) => {
      const haystack = `${student.name} ${student.code ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [classStudents, studentQuery]);

  const toggleStudent = (student: ClassStudentOption) => {
    if (selectedIds.has(student.id)) {
      onChange(value.filter((item) => item.id !== student.id));
      return;
    }
    onChange([...value, student]);
  };

  const removeStudent = (studentId: string) => {
    onChange(value.filter((student) => student.id !== studentId));
  };

  const collapsePicker = () => {
    setExpanded(false);
    setStudentQuery('');
    onChange([]);
  };

  return (
    <div className="space-y-2">
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5 text-left text-[12px] font-bold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 font-sukhumvit"
        >
          {label} — แตะเพื่อเลือก
        </button>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <label
              htmlFor="problem-student-search"
              className="block text-[11px] font-black text-slate-600 font-sukhumvit"
            >
              {label}
            </label>
            <button
              type="button"
              onClick={collapsePicker}
              className="text-[10px] font-black text-slate-400 hover:text-slate-600 shrink-0"
            >
              ไม่ระบุ
            </button>
          </div>
          <input
            id="problem-student-search"
            value={studentQuery}
            onChange={(event) => setStudentQuery(event.target.value)}
            placeholder="ค้นหาชื่อหรือรหัสนักเรียน..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-sarabun text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />

          {loadingStudents ? (
            <p className="text-[11px] font-bold text-slate-400 font-sarabun">กำลังโหลดรายชื่อนักเรียน...</p>
          ) : classStudents.length === 0 ? (
            <p className="text-[11px] font-bold text-slate-400 font-sarabun">ไม่พบรายชื่อนักเรียนในห้องนี้</p>
          ) : filteredStudents.length === 0 ? (
            <p className="text-[11px] font-bold text-slate-400 font-sarabun">ไม่พบนักเรียนที่ตรงกับคำค้นหา</p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white">
              {filteredStudents.map((student) => {
                const checked = selectedIds.has(student.id);
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => toggleStudent(student)}
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 transition-colors',
                      checked ? 'bg-rose-50/80' : 'hover:bg-slate-50',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-black',
                        checked
                          ? 'border-rose-500 bg-rose-500 text-white'
                          : 'border-slate-300 bg-white text-transparent',
                      )}
                      aria-hidden
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1 text-[12px] font-bold text-slate-800 font-sarabun truncate">
                      {student.name}
                    </span>
                    {student.code && (
                      <span className="text-[11px] font-bold text-slate-400 shrink-0">{student.code}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {value.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {value.map((student) => (
                <span
                  key={student.id}
                  className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-700"
                >
                  {student.name}
                  <button
                    type="button"
                    onClick={() => removeStudent(student.id)}
                    className="rounded-full p-0.5 hover:bg-rose-100"
                    aria-label={`ลบ ${student.name}`}
                  >
                    <HiOutlineXMark size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
